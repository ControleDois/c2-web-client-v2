import { useEffect, useRef, useState } from 'react'

interface BarcodeScannerProps {
  // Chamado a cada leitura. O mesmo código só é lido de novo depois de `repeatAfterMs`
  // (para bipar várias unidades do mesmo produto, afaste e aproxime de novo).
  onScan: (code: string) => void
  paused?: boolean
  repeatAfterMs?: number
  className?: string
}

// Formatos de código de barras de produto (EAN, UPC, Code 128/39, ITF).
const FORMATS = ['ean_13', 'ean_8', 'upc_a', 'upc_e', 'code_128', 'code_39', 'itf', 'codabar']

type Detector = { detect: (source: HTMLVideoElement) => Promise<{ rawValue: string }[]> }

// Leitor pela câmera traseira do celular. Usa o leitor nativo do navegador (Chrome/Android) e,
// onde não existe (iPhone), a biblioteca ZXing.
export function BarcodeScanner({ onScan, paused = false, repeatAfterMs = 1200, className = '' }: BarcodeScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const last = useRef<{ code: string; at: number }>({ code: '', at: 0 })
  const pausedRef = useRef(paused)
  const onScanRef = useRef(onScan)
  const [error, setError] = useState<string | null>(null)
  const [torch, setTorch] = useState<{ on: boolean; track: MediaStreamTrack } | null>(null)

  pausedRef.current = paused
  onScanRef.current = onScan

  useEffect(() => {
    let stopped = false
    let stream: MediaStream | null = null
    let frame = 0
    let zxingControls: { stop: () => void } | null = null

    const emit = (code: string) => {
      const value = code.trim()
      if (!value || pausedRef.current) return
      const now = Date.now()
      if (value === last.current.code && now - last.current.at < repeatAfterMs) {
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
      const NativeDetector = (window as unknown as { BarcodeDetector?: new (o: { formats: string[] }) => Detector }).BarcodeDetector
      try {
        if (NativeDetector) {
          stream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 }, height: { ideal: 720 } },
            audio: false,
          })
          if (stopped) return
          const video = videoRef.current!
          video.srcObject = stream
          await video.play()
          const track = stream.getVideoTracks()[0]
          const caps = (track.getCapabilities?.() ?? {}) as { torch?: boolean }
          if (caps.torch) setTorch({ on: false, track })
          const detector = new NativeDetector({ formats: FORMATS })
          let busy = false
          const loop = async () => {
            if (stopped) return
            if (!busy && video.readyState >= 2) {
              busy = true
              try {
                const codes = await detector.detect(video)
                if (codes[0]?.rawValue) emit(codes[0].rawValue)
              } catch {
                // quadro ruim: tenta no próximo
              }
              busy = false
            }
            frame = window.setTimeout(loop, 120)
          }
          void loop()
        } else {
          const { BrowserMultiFormatReader } = await import('@zxing/browser')
          if (stopped) return
          const reader = new BrowserMultiFormatReader()
          zxingControls = await reader.decodeFromConstraints(
            { video: { facingMode: { ideal: 'environment' } }, audio: false },
            videoRef.current!,
            (result) => {
              if (result) emit(result.getText())
            }
          )
        }
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
      window.clearTimeout(frame)
      zxingControls?.stop()
      stream?.getTracks().forEach((track) => track.stop())
    }
  }, [repeatAfterMs])

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
          <video ref={videoRef} muted playsInline className="h-full w-full object-cover" />
          {/* Faixa de mira */}
          <div className="pointer-events-none absolute inset-x-[10%] top-1/2 h-[38%] -translate-y-1/2 rounded-xl border-2 border-white/80 shadow-[0_0_0_999px_rgba(0,0,0,0.35)]">
            <div className="absolute inset-x-3 top-1/2 h-0.5 -translate-y-1/2 animate-pulse bg-[var(--red-500)]" />
          </div>
          {paused && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/55 text-[13px] font-semibold text-white">Leitura pausada</div>
          )}
          {torch && (
            <button
              type="button"
              onClick={() => void toggleTorch()}
              className="absolute top-2 right-2 rounded-full bg-black/55 px-3 py-1.5 text-[12px] font-bold text-white"
            >
              {torch.on ? 'Desligar luz' : 'Ligar luz'}
            </button>
          )}
        </>
      )}
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
