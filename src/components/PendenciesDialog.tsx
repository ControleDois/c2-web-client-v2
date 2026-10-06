import type { Pendencies } from '../lib/pendencies'
import { AlertCircleIcon } from './icons'

interface PendenciesDialogProps {
  pendencies: Pendencies | null
  onClose: () => void
}

export function PendenciesDialog({ pendencies, onClose }: PendenciesDialogProps) {
  if (!pendencies) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[85vh] w-full max-w-[560px] flex-col rounded-2xl bg-[var(--surface)] shadow-[var(--card-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start gap-3 p-6 pb-4">
          <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[var(--red-100)] text-[var(--red-500)]">
            <AlertCircleIcon className="h-5 w-5" />
          </span>
          <div>
            <h2 className="text-[15px] font-bold text-[var(--ink)]">{pendencies.title}</h2>
            <p className="mt-0.5 text-[13px] text-[var(--ink-soft)]">
              {pendencies.total === 1 ? '1 item' : `${pendencies.total} itens`} para corrigir antes de continuar.
            </p>
          </div>
        </div>

        <div className="flex flex-col gap-3 overflow-y-auto px-6 pb-2">
          {pendencies.groups.map((group) => (
            <section key={group.label} className="rounded-xl bg-[var(--page)] p-3.5">
              <h3 className="text-[12.5px] font-bold text-[var(--ink)]">{group.label}</h3>
              <ul className="mt-1.5 flex flex-col gap-1.5">
                {group.items.map((item, index) => (
                  <li key={index} className="flex gap-2 text-[13px] leading-relaxed text-[var(--ink-soft)]">
                    <span className="mt-[7px] h-1.5 w-1.5 flex-none rounded-full bg-[var(--red-500)]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>

        <div className="flex justify-end p-6 pt-4">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl bg-[var(--blue-500)] px-5 py-2 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)]"
          >
            Entendi
          </button>
        </div>
      </div>
    </div>
  )
}
