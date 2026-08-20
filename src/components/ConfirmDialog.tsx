import { AlertCircleIcon } from './icons'

interface ConfirmDialogProps {
  open: boolean
  title: string
  message: string
  confirmLabel?: string
  cancelLabel?: string
  danger?: boolean
  loading?: boolean
  onConfirm: () => void
  onCancel: () => void
}

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = 'Confirmar',
  cancelLabel = 'Cancelar',
  danger = true,
  loading = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-[400px] rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3">
          <span
            className={`flex h-10 w-10 flex-none items-center justify-center rounded-full ${
              danger ? 'bg-[var(--red-100)] text-[var(--red-500)]' : 'bg-[var(--blue-100)] text-[var(--blue-700)]'
            }`}
          >
            <AlertCircleIcon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-[15px] font-bold text-[var(--ink)]">{title}</h2>
            <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--ink-soft)]">{message}</p>
          </div>
        </div>

        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-xl px-4 py-2 text-[13.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-60"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={loading}
            className={`rounded-xl px-4 py-2 text-[13.5px] font-bold text-white transition disabled:opacity-60 ${
              danger ? 'bg-[var(--red-500)] hover:bg-red-600' : 'bg-[var(--blue-500)] hover:bg-[var(--blue-700)]'
            }`}
          >
            {loading ? 'Aguarde…' : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
