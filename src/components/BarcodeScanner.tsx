import { useEffect, useRef, useState } from 'react'
import wasmUrl from 'zxing-wasm/reader/zxing_reader.wasm?url'

interface BarcodeScannerProps {
  // Chamado a cada leitura. O mesmo código só é lido de novo depois de ficar `repeatAfterMs`
  // fora da câmera (para bipar várias unidades do mesmo produto, afaste e aproxime de novo).
  onScan: (code: string) => void
  paused?: boolean
  repeatAfterMs?: number
  className?: string
  // Conteúdo por cima da câmera (botões, dicas)
  children?: React.ReactNode
}

// Só os formatos de produto: quanto menos formatos, mais rápida a leitura.
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'itf', 'code_39']
// Faixa da imagem analisada (centro da câmera, onde fica a mira) e tamanho dela em pixels.
const CROP_WIDTH = 0.9
const CROP_HEIGHT = 0.5
const MAX_SIDE = 1100
const INTERVAL_MS = 70

type Detector = { detect: (source: CanvasImageSource) => Promise<{ rawValue: string }[]> }

let polyfill: Promise<Detector> | null = null

// Leitor do próprio navegador quando existe (Chrome/Android); no iPhone (Safari não tem),
// o zxing-cpp em WebAssembly, servido pelo nosso próprio site.
async function createDetector(): Promise<Detector> {
  const Native = (window as unknown as {
    BarcodeDetector?: { new (o: { formats: string[] }): Detector; getSupportedFormats?: () => Promise<string[]> }
  }).BarcodeDetector
  if (Native) {
    try {
      const supported = (await Native.getSupportedFormats?.()) ?? []
      const formats = FORMATS.filter((format) => supported.includes(format))
      if (formats.includes('ean_13')) return new Native({ formats })
    } catch {
      // usa o WebAssembly
    }
  }
  polyfill ??= import('barcode-detector/ponyfill').then(({ BarcodeDetector, prepareZXingModule }) => {
    prepareZXingModule({
      overrides: { locateFile: (path: string, prefix: string) => (path.endsWith('.wasm') ? wasmUrl : prefix + path) },
      fireImmediately: true,
    })
    return new BarcodeDetector({ formats: FORMATS as never }) as unknown as Detector
  })
  return polyfill
}

export function BarcodeScanner({ onScan, paused = false, repeatAfterMs = 1200, className = '', children }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const last = useRef<{ code: string; at: number }>({ code: '', at: 0 })
  const pausedRef = useRef(paused)
  const onScanRef = useRef(onScan)
  const repeatRef = useRef(repeatAfterMs)
  const [error, setError] = useState<string | null>(null)
  const [starting, setStarting] = useState(true)
  const [torch, setTorch] = useState<{ on: boolean; track: MediaStreamTrack } | null>(null)

  pausedRef.current = paused
  onScanRef.current = onScan
  repeatRef.current = repeatAfterMs

  useEffect(() => {
    let stopped = false
    let stream: MediaStream | null = null
    let timer = 0

    const emit = (code: string) => {
      const value = code.trim()
      if (!value || pausedRef.current) return
      const now = Date.now()
      if (value === last.current.code && now - last.current.at < repeatRef.current) {
        last.current.at = now
        return
      }
      last.current = { code: value, at: now }
      onScanRef.current(value)
    }

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('Este navegador não deixa usar a câmera. Digite o código abaixo.')
        return
      }
      try {
        const [detector, media] = await Promise.all([
          createDetector(),
          navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } },
            audio: false,
          }),
        ])
        stream = media
        if (stopped) return
        const video = videoRef.current!
        video.srcObject = stream
        video.setAttribute('playsinline', 'true')
        await video.play().catch(() => undefined)
        const track = stream.getVideoTracks()[0]
        const caps = (track.getCapabilities?.() ?? {}) as { torch?: boolean; focusMode?: string[] }
        if (caps.focusMode?.includes('continuous')) {
          track.applyConstraints({ advanced: [{ focusMode: 'continuous' } as MediaTrackConstraintSet] }).catch(() => undefined)
        }
        if (caps.torch) setTorch({ on: false, track })
        setStarting(false)

        const canvas = document.createElement('canvas')
        const ctx = canvas.getContext('2d', { willReadFrequently: true })!
        const loop = async () => {
          if (stopped) return
          if (!pausedRef.current && video.readyState >= 2 && video.videoWidth) {
            // Recorta o centro (onde fica a mira) e reduz: menos pixels, leitura bem mais rápida.
            const sw = video.videoWidth * CROP_WIDTH
            const sh = video.videoHeight * CROP_HEIGHT
            const scale = Math.min(1, MAX_SIDE / Math.max(sw, sh))
            canvas.width = Math.round(sw * scale)
            canvas.height = Math.round(sh * scale)
            ctx.drawImage(video, (video.videoWidth - sw) / 2, (video.videoHeight - sh) / 2, sw, sh, 0, 0, canvas.width, canvas.height)
            try {
              const codes = await detector.detect(canvas)
              if (codes[0]?.rawValue) emit(codes[0].rawValue)
            } catch {
              // quadro ruim: tenta no próximo
            }
          }
          timer = window.setTimeout(() => void loop(), INTERVAL_MS)
        }
        void loop()
      } catch (err) {
        const name = (err as { name?: string })?.name
        setError(
          name === 'NotAllowedError'
            ? 'A câmera foi bloqueada. Libere a câmera para este site nas configurações do navegador ou digite o código abaixo.'
            : 'Não foi possível abrir a câmera. Digite o código abaixo.'
        )
      }
    }

    void start()
    return () => {
      stopped = true
      window.clearTimeout(timer)
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  async function toggleTorch() {
    if (!torch) return
    try {
      await torch.track.applyConstraints({ advanced: [{ torch: !torch.on } as MediaTrackConstraintSet] })
      setTorch({ ...torch, on: !torch.on })
    } catch {
      setTorch(null)
    }
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl bg-black ${className}`}>
      {error ? (
        <div className="flex h-full min-h-[160px] items-center justify-center p-5 text-center text-[13px] font-medium text-white/85">{error}</div>
      ) : (
        <>
          <video ref={videoRef} muted autoPlay playsInline disablePictureInPicture className="pointer-events-none h-full w-full object-cover" />
          {/* Mira: a faixa clara é a parte analisada */}
          <div className="pointer-events-none absolute inset-x-[7%] top-1/2 h-[42%] -translate-y-1/2 rounded-xl border-2 border-white/90 shadow-[0_0_0_999px_rgba(0,0,0,0.3)]">
            <div className="absolute inset-x-3 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-[var(--red-500)]" />
          </div>
          {starting && <div className="absolute inset-0 flex items-center justify-center text-[13px] font-semibold text-white/80">Abrindo a câmera…</div>}
          {paused && !starting && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-[13px] font-semibold text-white">Leitura pausada</div>
          )}
          {torch && (
            <button
              type="button"
              onClick={() => void toggleTorch()}
              className="absolute bottom-2 left-2 rounded-full bg-black/55 px-3 py-1.5 text-[12px] font-bold text-white"
            >
              {torch.on ? 'Desligar luz' : 'Ligar luz'}
            </button>
          )}
        </>
      )}
      {children}
    </div>
  )
}

// Sinal de leitura: bipe curto e vibração (quando o celular deixa).
export function scanFeedback(ok = true) {
  try {
    navigator.vibrate?.(ok ? 60 : [80, 60, 80])
  } catch {
    // sem vibração
  }
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.frequency.value = ok ? 1650 : 320
    gain.gain.value = 0.08
    osc.connect(gain).connect(ctx.destination)
    osc.start()
    osc.stop(ctx.currentTime + (ok ? 0.09 : 0.25))
    osc.onended = () => void ctx.close()
  } catch {
    // sem som
  }
}
