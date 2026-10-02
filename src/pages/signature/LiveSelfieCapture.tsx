import { useCallback, useEffect, useRef, useState } from 'react'
import { CameraIcon, CheckCircleIcon } from '../../components/icons'
import { drawStampBar, formatDateTime, formatFixLine, type GeoFix } from '../../lib/photoWatermark'

interface LiveSelfieCaptureProps {
  onCapture: (blob: Blob | null) => void
  location: GeoFix
  addressLine: string | null
}

type Stage = 'align' | 'closer' | 'back' | 'blink' | 'capture'
type Phase = 'loading' | 'running' | 'fallback' | 'captured' | 'error'

type FaceApi = typeof import('@vladmandic/face-api')
type Point = { x: number; y: number }

const STEPS: { stage: Stage; label: string }[] = [
  { stage: 'align', label: 'Enquadrar' },
  { stage: 'closer', label: 'Aproximar' },
  { stage: 'back', label: 'Afastar' },
  { stage: 'blink', label: 'Piscar' },
]

const HINTS: Record<Stage, string> = {
  align: 'Posicione o rosto dentro do contorno',
  closer: 'Aproxime o rosto da câmera',
  back: 'Agora afaste o rosto um pouco',
  blink: 'Pisque os olhos',
  capture: 'Fique parado…',
}

const FRAMES_ALIGN = 6
const FRAMES_MOVE = 3
const LOOP_DELAY_MS = 15
const BLINK_WINDOW_MS = 2000
const BLINK_RELAX_AFTER_MS = 6000
const BLINK_SKIP_AFTER_MS = 12000

function dist(a: Point, b: Point) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function eyeAspectRatio(p: Point[], start: number) {
  return (dist(p[start + 1], p[start + 5]) + dist(p[start + 2], p[start + 4])) / (2 * dist(p[start], p[start + 3]))
}

export function LiveSelfieCapture({ onCapture, location, addressLine }: LiveSelfieCaptureProps) {
  const stampDataRef = useRef({ location, addressLine })
  stampDataRef.current = { location, addressLine }
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const aliveRef = useRef(false)
  const [phase, setPhase] = useState<Phase>('loading')
  const [stage, setStage] = useState<Stage>('align')
  const [faceFound, setFaceFound] = useState(false)
  const [errorMessage, setErrorMessage] = useState('')
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [attempt, setAttempt] = useState(0)
  const [canSkipBlink, setCanSkipBlink] = useState(false)

  const stopCamera = useCallback(() => {
    aliveRef.current = false
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const grabFrame = useCallback(() => {
    const video = videoRef.current
    if (!video || !video.videoWidth) return
    const scale = Math.min(1, 720 / video.videoWidth)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
    const stamp = stampDataRef.current
    drawStampBar(canvas, [
      `Capturado em ${formatDateTime()}`,
      formatFixLine(stamp.location),
      ...(stamp.addressLine ? [stamp.addressLine] : []),
    ])
    canvas.toBlob(
      (blob) => {
        if (!blob) return
        stopCamera()
        setPreviewUrl((old) => {
          if (old) URL.revokeObjectURL(old)
          return URL.createObjectURL(blob)
        })
        setPhase('captured')
        onCapture(blob)
      },
      'image/jpeg',
      0.9
    )
  }, [onCapture, stopCamera])

  useEffect(() => {
    let cancelled = false
    aliveRef.current = true
    setPhase('loading')
    setStage('align')
    setFaceFound(false)
    setCanSkipBlink(false)

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setErrorMessage('Seu navegador não permite usar a câmera. Abra o link em outro navegador.')
        setPhase('error')
        return
      }

      let stream: MediaStream
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: 'user',
            width: { ideal: 720 },
            height: { ideal: 960 },
          },
          audio: false,
        })
      } catch {
        if (!cancelled) {
          setErrorMessage(
            'Não conseguimos acessar a câmera. Permita o acesso nas configurações do navegador e tente de novo.'
          )
          setPhase('error')
        }
        return
      }

      if (cancelled) {
        stream.getTracks().forEach((track) => track.stop())
        return
      }

      streamRef.current = stream
      const video = videoRef.current
      if (!video) return
      video.srcObject = stream
      await video.play().catch(() => {})

      let faceapi: FaceApi
      try {
        faceapi = await import('@vladmandic/face-api')
        await faceapi.nets.tinyFaceDetector.loadFromUri('/face-models')
        await faceapi.nets.faceLandmark68TinyNet.loadFromUri('/face-models')
      } catch {
        // Sem o detector (rede/dispositivo fraco) a pessoa ainda precisa
        // tirar a foto ao vivo, só sem os desafios de movimento.
        if (!cancelled) setPhase('fallback')
        return
      }
      if (cancelled) return
      setPhase('running')

      const options = new faceapi.TinyFaceDetectorOptions({
        inputSize: 160,
        scoreThreshold: 0.5,
      })
      let current: Stage = 'align'
      let streak = 0
      let baseRatio = 0
      let ratioSum = 0
      let eyesClosedSeen = false
      let captureFrames = 0
      let blinkStartedAt = 0
      let openEar = 0
      const earHistory: { t: number; ear: number }[] = []

      const advance = (next: Stage) => {
        current = next
        streak = 0
        if (next === 'blink') blinkStartedAt = performance.now()
        setStage(next)
      }

      while (aliveRef.current && !cancelled) {
        await new Promise((resolve) => setTimeout(resolve, LOOP_DELAY_MS))
        if (!aliveRef.current || cancelled) break

        let result
        try {
          result = await faceapi.detectSingleFace(video, options).withFaceLandmarks(true)
        } catch {
          result = undefined
        }
        if (!aliveRef.current || cancelled) break

        if (!result) {
          setFaceFound(false)
          streak = 0
          ratioSum = 0
          captureFrames = 0
          continue
        }
        setFaceFound(true)

        const box = result.detection.box
        const ratio = box.width / video.videoWidth
        const cx = (box.x + box.width / 2) / video.videoWidth
        const cy = (box.y + box.height / 2) / video.videoHeight
        const centered = cx > 0.3 && cx < 0.7 && cy > 0.28 && cy < 0.72
        const points = result.landmarks.positions as Point[]
        const ear = (eyeAspectRatio(points, 36) + eyeAspectRatio(points, 42)) / 2

        if (current === 'align') {
          if (centered && ratio > 0.2 && ratio < 0.62) {
            streak += 1
            ratioSum += ratio
            if (streak >= FRAMES_ALIGN) {
              baseRatio = ratioSum / streak
              advance('closer')
            }
          } else {
            streak = 0
            ratioSum = 0
          }
        } else if (current === 'closer') {
          streak = ratio >= baseRatio * 1.3 ? streak + 1 : 0
          if (streak >= FRAMES_MOVE) advance('back')
        } else if (current === 'back') {
          streak = centered && ratio <= baseRatio * 1.1 ? streak + 1 : 0
          if (streak >= FRAMES_MOVE) advance('blink')
        } else if (current === 'blink') {
          // Compara com o MAIOR valor recente (olho bem aberto) em vez de uma
          // base fixa: o modelo leve oscila e a piscada dura ~150ms, então o
          // critério precisa ser tolerante e relaxar com o tempo.
          const now = performance.now()
          earHistory.push({ t: now, ear })
          while (earHistory.length && now - earHistory[0].t > BLINK_WINDOW_MS) earHistory.shift()
          const recentMax = Math.max(...earHistory.map((item) => item.ear))
          const elapsed = now - blinkStartedAt
          const closeLimit = recentMax * (elapsed > BLINK_RELAX_AFTER_MS ? 0.9 : 0.82)

          if (ear < closeLimit) {
            eyesClosedSeen = true
          } else if (eyesClosedSeen) {
            openEar = recentMax
            advance('capture')
          }
          if (elapsed > BLINK_SKIP_AFTER_MS) setCanSkipBlink(true)
        } else if (current === 'capture') {
          captureFrames = centered && ear > openEar * 0.85 ? captureFrames + 1 : 0
          if (captureFrames >= 3) {
            aliveRef.current = false
            grabFrame()
            break
          }
        }
      }
    }

    start()

    return () => {
      cancelled = true
      stopCamera()
    }
  }, [attempt, grabFrame, stopCamera])

  useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl)
    }
  }, [previewUrl])

  function retake() {
    onCapture(null)
    setPreviewUrl(null)
    setAttempt((value) => value + 1)
  }

  if (phase === 'captured' && previewUrl) {
    return (
      <div className="flex flex-col gap-3">
        <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-black">
          <img src={previewUrl} alt="Foto capturada" className="mx-auto max-h-80 w-full object-contain" />
        </div>
        <div className="flex items-center justify-between">
          <span className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--green-600)]">
            <CheckCircleIcon className="h-4 w-4" />
            Foto registrada
          </span>
          <button
            type="button"
            onClick={retake}
            className="text-[12.5px] font-semibold text-[var(--blue-500)] hover:underline"
          >
            Tirar outra
          </button>
        </div>
      </div>
    )
  }

  if (phase === 'error') {
    return (
      <div className="flex flex-col items-center gap-3 rounded-2xl bg-[var(--red-100)] px-4 py-5 text-center">
        <CameraIcon className="h-7 w-7 text-[var(--red-500)]" />
        <p className="text-[13px] font-medium text-[var(--red-500)]">{errorMessage}</p>
        <button
          type="button"
          onClick={() => setAttempt((value) => value + 1)}
          className="rounded-xl bg-[var(--blue-500)] px-4 py-2 text-[13px] font-bold text-white hover:bg-[var(--blue-700)]"
        >
          Tentar novamente
        </button>
      </div>
    )
  }

  const activeIndex = STEPS.findIndex((step) => step.stage === stage)
  const ringColor = phase === 'running' && faceFound ? '#4ade80' : 'rgba(255,255,255,0.85)'

  return (
    <div className="flex flex-col gap-3">
      <div className="relative mx-auto aspect-[3/4] w-full max-w-[320px] overflow-hidden rounded-2xl bg-black">
        <video
          ref={videoRef}
          playsInline
          muted
          className="h-full w-full object-cover"
          style={{ transform: 'scaleX(-1)' }}
        />
        <svg
          viewBox="0 0 300 400"
          preserveAspectRatio="xMidYMid slice"
          className="pointer-events-none absolute inset-0 h-full w-full"
          aria-hidden="true"
        >
          <defs>
            <mask id="face-oval-mask">
              <rect width="300" height="400" fill="white" />
              <ellipse cx="150" cy="190" rx="100" ry="135" fill="black" />
            </mask>
          </defs>
          <rect width="300" height="400" fill="rgba(0,0,0,0.55)" mask="url(#face-oval-mask)" />
          <ellipse cx="150" cy="190" rx="100" ry="135" fill="none" stroke={ringColor} strokeWidth="3" />
        </svg>
        <div className="absolute inset-x-0 bottom-3 flex justify-center px-3">
          <span className="rounded-full bg-black/70 px-3.5 py-1.5 text-center text-[12.5px] font-semibold text-white">
            {phase === 'loading'
              ? 'Preparando a câmera…'
              : phase === 'fallback'
                ? 'Enquadre o rosto e tire a foto'
                : faceFound
                  ? HINTS[stage]
                  : 'Não encontramos seu rosto'}
          </span>
        </div>
      </div>

      {phase === 'running' && (
        <ol className="flex items-center justify-center gap-1.5">
          {STEPS.map((step, index) => {
            const done = stage === 'capture' || index < activeIndex
            const active = index === activeIndex
            return (
              <li
                key={step.stage}
                className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[11.5px] font-bold ${
                  done
                    ? 'bg-[var(--green-600)] text-white'
                    : active
                      ? 'bg-[var(--blue-500)] text-white'
                      : 'bg-[var(--page)] text-[var(--muted)]'
                }`}
              >
                {done && <CheckCircleIcon className="h-3 w-3" />}
                {step.label}
              </li>
            )
          })}
        </ol>
      )}

      {phase === 'running' && stage === 'blink' && canSkipBlink && (
        <button
          type="button"
          onClick={grabFrame}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[13px] font-bold text-[var(--ink)] hover:bg-[var(--page)]"
        >
          Não consegui piscar? Tirar a foto assim mesmo
        </button>
      )}

      {phase === 'fallback' && (
        <button
          type="button"
          onClick={grabFrame}
          className="rounded-xl bg-[var(--blue-500)] px-4 py-3 text-[13.5px] font-bold text-white hover:bg-[var(--blue-700)]"
        >
          Tirar foto
        </button>
      )}

      <p className="text-center text-[11.5px] text-[var(--muted)]">
        A foto é tirada na hora, com data, hora e localização registradas. Não é possível enviar uma imagem da galeria.
      </p>
    </div>
  )
}
