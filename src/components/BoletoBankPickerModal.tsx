import type { BoletoBank } from '../lib/bills'

interface BoletoBankPickerModalProps {
  open: boolean
  banks: BoletoBank[]
  loading?: boolean
  onPick: (bank: BoletoBank) => void
  onCancel: () => void
}

export function BoletoBankPickerModal({ open, banks, loading = false, onPick, onCancel }: BoletoBankPickerModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onCancel}>
      <div
        className="w-full max-w-[400px] rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <h2 className="text-[15px] font-bold text-[var(--ink)]">Gerar boleto por qual banco?</h2>
        <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--ink-soft)]">
          Esta empresa tem mais de um banco habilitado para boleto.
        </p>

        <div className="mt-4 flex flex-col gap-2">
          {banks.map((bank) => (
            <button
              key={bank.id}
              type="button"
              disabled={loading}
              onClick={() => onPick(bank)}
              className="rounded-xl border border-[var(--border)] px-4 py-3 text-left text-[14px] font-bold text-[var(--ink)] transition hover:border-[var(--blue-300)] hover:bg-[var(--page)] disabled:opacity-60"
            >
              {bank.name}
            </button>
          ))}
        </div>

        <div className="mt-5 flex justify-end">
          <button
            type="button"
            onClick={onCancel}
            disabled={loading}
            className="rounded-xl px-4 py-2 text-[13.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-60"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
