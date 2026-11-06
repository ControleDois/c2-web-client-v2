import type { ConfigPayload } from '../../lib/config'
import { MoneyInput } from '../../components/form/MoneyInput'

interface VerbaAlimentacaoSectionProps {
  value: ConfigPayload
  onChange: (patch: Partial<ConfigPayload>) => void
  onOpen: () => void
}

const COLABORADOR_URL = import.meta.env.VITE_COLABORADOR_URL ?? 'https://colaborador.controledois.com.br'

// Liga a verba de alimentação em viagem para qualquer nicho: o colaborador pede pelo app do
// colaborador e o financeiro aprova e paga (depósito manual no cartão iFood).
export function VerbaAlimentacaoSection({ value, onChange, onOpen }: VerbaAlimentacaoSectionProps) {
  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2.5">
        <input
          type="checkbox"
          checked={Boolean(value.meal_allowance_enabled)}
          onChange={(event) => onChange({ meal_allowance_enabled: event.target.checked })}
          className="h-4 w-4 accent-[var(--blue-500)]"
        />
        <span className="text-[13.5px] font-semibold text-[var(--ink)]">Ativar verba de alimentação em viagem</span>
      </label>
      <p className="text-[12.5px] text-[var(--muted)]">
        Cada colaborador entra no app do colaborador com o próprio usuário, marca no calendário os dias em que vai estar
        viajando e pede a verba. O financeiro aprova e paga; dia pedido ou pago fica travado e não pode ser pedido de novo.
      </p>

      {value.meal_allowance_enabled && (
        <>
          <div className="max-w-xs">
            <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Valor da diária (por dia)</span>
            <div className="mt-1.5">
              <MoneyInput
                value={value.meal_allowance_daily_value ?? 0}
                onChange={(event) => onChange({ meal_allowance_daily_value: event.target.value })}
                className="w-full rounded-xl bg-[var(--surface)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-[var(--border)] focus:outline-none"
              />
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--page)] p-4 text-[12.5px] text-[var(--ink-soft)]">
            <p className="font-bold text-[var(--ink)]">Como o colaborador acessa</p>
            <p className="mt-1">
              Cadastre o colaborador em Pessoas com um usuário de acesso a esta empresa. Ele entra em{' '}
              <a href={COLABORADOR_URL} target="_blank" rel="noreferrer" className="font-semibold text-[var(--blue-700)] hover:underline">
                {COLABORADOR_URL.replace(/^https?:\/\//, '')}
              </a>{' '}
              com o e-mail e a senha dele.
            </p>
          </div>

          <button
            type="button"
            onClick={onOpen}
            className="w-fit rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-[var(--blue-700)]"
          >
            Ver pedidos de verba →
          </button>
        </>
      )}
    </div>
  )
}
