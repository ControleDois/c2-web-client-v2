import { useCallback, useEffect, useRef, useState } from 'react'
import { buildStampLines, drawStampBar, getCurrentFix, type GeoFix } from '../lib/photoWatermark'
import { CameraIcon, CloseIcon } from './icons'

export interface LiveCapture {
  file: File
  takenAt: string
  fix: GeoFix | null
}

interface LiveCameraModalProps {
  open: boolean
  onCapture: (capture: LiveCapture) => void
  onClose: () => void
}

const MAX_SIDE = 1600

// Câmera ao vivo (traseira no celular, webcam no computador): a foto é tirada
// na hora e já sai carimbada com data/hora, GPS e endereço aproximado — não dá
// para "tirar" uma foto antiga por aqui. O modal fica aberto para várias fotos
// seguidas; cada uma é entregue assim que é tirada.
export function LiveCameraModal({ open, onCapture, onClose }: LiveCameraModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const fixRef = useRef<GeoFix | null>(null)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [ready, setReady] = useState(false)
  const [locationState, setLocationState] = useState<'loading' | 'ok' | 'unavailable'>('loading')
  const [stamping, setStamping] = useState(false)
  const [taken, setTaken] = useState(0)

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
    setReady(false)
  }, [])

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setCameraError(null)
    setTaken(0)
    setLocationState('loading')
    fixRef.current = null

    // Pede a localização já na abertura (o aparelho pergunta a permissão uma vez).
    getCurrentFix()
      .then((fix) => {
        if (cancelled) return
        fixRef.current = fix
        setLocationState('ok')
      })
      .catch(() => {
        if (!cancelled) setLocationState('unavailable')
      })

    if (!navigator.mediaDevices?.getUserMedia) {
      setCameraError('Este navegador não permite usar a câmera por aqui. Use o botão "Anexar" para escolher a foto.')
      return
    }

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 } }, audio: false })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          video.play().catch(() => {})
        }
      })
      .catch(() => {
        if (!cancelled) {
          setCameraError(
            'Não consegui abrir a câmera. Libere a permissão de câmera no navegador ou use o botão "Anexar".'
          )
        }
      })

    return () => {
      cancelled = true
      stopCamera()
    }
  }, [open, stopCamera])

  if (!open) return null

  async function handleCapture() {
    const video = videoRef.current
    if (!video || !video.videoWidth || stamping) return
    setStamping(true)
    try {
      const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight))
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(video.videoWidth * scale)
      canvas.height = Math.round(video.videoHeight * scale)
      canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)

      const takenAt = new Date()
      const fix = fixRef.current
      drawStampBar(canvas, await buildStampLines(fix))

      const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.88))
      if (!blob) return
      const file = new File([blob], `foto-${takenAt.getTime()}.jpg`, { type: 'image/jpeg' })
      onCapture({ file, takenAt: takenAt.toISOString(), fix })
      setTaken((count) => count + 1)
    } finally {
      setStamping(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[65] flex flex-col bg-black">
      <div className="flex flex-none items-center justify-between px-4 py-3 text-white">
        <div className="text-[13px]">
          <p className="font-bold">Tirar foto agora</p>
          <p className="text-[11.5px] opacity-70">
            {locationState === 'loading' && 'Obtendo localização…'}
            {locationState === 'ok' && 'Localização obtida — a foto sai com data, hora e local'}
            {locationState === 'unavailable' && 'Sem localização: a foto sai só com data e hora'}
          </p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Fechar câmera"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center overflow-hidden">
        {cameraError ? (
          <p className="max-w-sm px-6 text-center text-[14px] text-white">{cameraError}</p>
        ) : (
          <video
            ref={videoRef}
            playsInline
            muted
            onLoadedMetadata={() => setReady(true)}
            className="h-full w-full object-contain"
          />
        )}
      </div>

      <div className="flex flex-none items-center justify-between gap-4 px-6 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] text-white">
        <span className="w-20 text-[12.5px] opacity-80">
          {taken > 0 ? `${taken} foto${taken === 1 ? '' : 's'}` : ''}
        </span>
        <button
          type="button"
          onClick={handleCapture}
          disabled={!ready || stamping || Boolean(cameraError)}
          aria-label="Tirar foto"
          className="flex h-16 w-16 items-center justify-center rounded-full border-4 border-white bg-white/20 disabled:opacity-40"
        >
          {stamping ? (
            <span className="h-6 w-6 animate-spin rounded-full border-2 border-white border-t-transparent" />
          ) : (
            <CameraIcon className="h-7 w-7" />
          )}
        </button>
        <button
          type="button"
          onClick={onClose}
          className="w-20 rounded-xl bg-white/10 px-3 py-2 text-[13px] font-bold hover:bg-white/20"
        >
          {taken > 0 ? 'Concluir' : 'Fechar'}
        </button>
      </div>
    </div>
  )
}
