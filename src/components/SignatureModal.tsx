import { useEffect, useRef, useState } from 'react'
import { TextField } from './form/TextField'
import { CloseIcon, UserIcon } from './icons'

interface SignatureModalProps {
  open: boolean
  title?: string
  hint?: string
  saving?: boolean
  error?: string | null
  onClose: () => void
  onSave: (payload: { name: string; image: string }) => void
}

// Assinatura desenhada com o dedo (ou mouse) numa área branca. Devolve a
// imagem PNG em base64 e o nome de quem assinou.
export function SignatureModal({
  open,
  title = 'Assinatura do cliente',
  hint = 'Peça para o cliente assinar com o dedo no quadro abaixo.',
  saving = false,
  error = null,
  onClose,
  onSave,
}: SignatureModalProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const drawing = useRef(false)
  const [name, setName] = useState('')
  const [hasInk, setHasInk] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  function clear() {
    const canvas = canvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!canvas || !ctx) return
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setHasInk(false)
  }

  useEffect(() => {
    if (!open) return
    setName('')
    setLocalError(null)
    // espera o canvas montar
    const timer = window.setTimeout(clear, 0)
    return () => window.clearTimeout(timer)
  }, [open])

  if (!open) return null

  function point(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: ((event.clientX - rect.left) * canvas.width) / rect.width,
      y: ((event.clientY - rect.top) * canvas.height) / rect.height,
    }
  }

  function handleDown(event: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drawing.current = true
    const { x, y } = point(event)
    ctx.strokeStyle = '#111111'
    ctx.lineWidth = 3
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + 0.1, y + 0.1)
    ctx.stroke()
    setHasInk(true)
  }

  function handleMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const ctx = canvasRef.current?.getContext('2d')
    if (!ctx) return
    const { x, y } = point(event)
    ctx.lineTo(x, y)
    ctx.stroke()
  }

  function handleUp() {
    drawing.current = false
  }

  function handleSave() {
    if (!name.trim()) {
      setLocalError('Escreva o nome de quem está assinando.')
      return
    }
    if (!hasInk || !canvasRef.current) {
      setLocalError('Peça para o cliente assinar no quadro.')
      return
    }
    setLocalError(null)
    onSave({ name: name.trim(), image: canvasRef.current.toDataURL('image/png') })
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={saving ? undefined : onClose}>
      <div
        className="max-h-[92vh] w-full max-w-[560px] overflow-y-auto rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[16px] font-bold text-[var(--ink)]">{title}</h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--ink-soft)]">{hint}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Fechar"
            className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)]"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4">
          <TextField
            label="Nome de quem assina"
            icon={<UserIcon className="h-4 w-4" />}
            placeholder="Nome completo"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </div>

        <div className="mt-4 overflow-hidden rounded-xl border-2 border-dashed border-[var(--border)] bg-white">
          <canvas
            ref={canvasRef}
            width={800}
            height={320}
            className="block h-[200px] w-full touch-none cursor-crosshair"
            onPointerDown={handleDown}
            onPointerMove={handleMove}
            onPointerUp={handleUp}
            onPointerCancel={handleUp}
          />
        </div>
        <button type="button" onClick={clear} disabled={saving} className="mt-2 text-[12.5px] font-semibold text-[var(--blue-700)] hover:underline">
          Limpar e assinar de novo
        </button>

        {(localError || error) && (
          <p className="mt-3 rounded-xl bg-[var(--red-100)] px-4 py-2.5 text-[13px] font-medium text-[var(--red-500)]">{localError ?? error}</p>
        )}

        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onClose} disabled={saving} className="rounded-xl px-4 py-2.5 text-[14px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="rounded-xl bg-[var(--blue-500)] px-5 py-2.5 text-[14px] font-bold text-white hover:bg-[var(--blue-700)] disabled:opacity-60"
          >
            {saving ? 'Salvando…' : 'Salvar assinatura'}
          </button>
        </div>
      </div>
    </div>
  )
}
