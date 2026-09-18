import type { ConfigPayload } from '../../lib/config'

interface PontoSectionProps {
  value: ConfigPayload
  onChange: (patch: Partial<ConfigPayload>) => void
  onOpenTimeClock: () => void
}

export function PontoSection({ value, onChange, onOpenTimeClock }: PontoSectionProps) {
  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2.5">
        <input
          type="checkbox"
          checked={Boolean(value.time_clock_enabled)}
          onChange={(event) => onChange({ time_clock_enabled: event.target.checked })}
          className="h-4 w-4 accent-[var(--blue-500)]"
        />
        <span className="text-[13.5px] font-semibold text-[var(--ink)]">Ativar Controle de Ponto</span>
      </label>
      <p className="text-[12.5px] text-[var(--muted)]">
        Acompanhe em tempo real quem entrou e saiu da empresa através de um relógio de ponto
        biométrico (ex: Control iD). Disponível pra qualquer nicho.
      </p>

      {value.time_clock_enabled && (
        <button
          type="button"
          onClick={onOpenTimeClock}
          className="w-fit rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-[var(--blue-700)]"
        >
          Acessar Controle de Ponto →
        </button>
      )}
    </div>
  )
}
