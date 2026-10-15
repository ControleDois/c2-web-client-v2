import { useEffect, useState } from 'react'
import { LockIcon } from './icons'

interface UpgradeModalProps {
  onSeePlans: () => void
}

// Aparece sozinho quando o servidor recusa algo por causa do plano (recurso fora do plano ou limite atingido).
export function UpgradeModal({ onSeePlans }: UpgradeModalProps) {
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    function handle(event: Event) {
      const detail = (event as CustomEvent<{ message?: string | null }>).detail
      setMessage(detail?.message || 'Este recurso faz parte dos planos pagos.')
    }
    window.addEventListener('c2:plan-required', handle)
    return () => window.removeEventListener('c2:plan-required', handle)
  }, [])

  if (!message) return null

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center bg-black/50 p-4" onClick={() => setMessage(null)}>
      <div className="w-full max-w-sm rounded-3xl bg-[var(--surface)] p-7 text-center shadow-xl" onClick={(event) => event.stopPropagation()}>
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[var(--blue-100)] text-[var(--blue-700)]">
          <LockIcon className="h-6 w-6" />
        </span>
        <h2 className="mt-4 text-[18px] font-bold text-[var(--ink)]">Disponível nos planos</h2>
        <p className="mt-2 text-[13.5px] leading-relaxed text-[var(--ink-soft)]">{message}</p>
        <div className="mt-6 flex flex-col gap-2">
          <button
            type="button"
            onClick={() => {
              setMessage(null)
              onSeePlans()
            }}
            className="rounded-xl bg-[var(--blue-500)] py-3 text-[14px] font-bold text-white transition hover:bg-[var(--blue-700)]"
          >
            Ver planos
          </button>
          <button type="button" onClick={() => setMessage(null)} className="rounded-xl py-2.5 text-[13.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]">
            Agora não
          </button>
        </div>
      </div>
    </div>
  )
}
