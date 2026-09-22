import type { ConfigPayload } from '../../lib/config'

interface PontoSectionProps {
  value: ConfigPayload
  onChange: (patch: Partial<ConfigPayload>) => void
  onOpenTimeClock: () => void
}

const WEEKDAY_OPTIONS: { value: number; label: string }[] = [
  { value: 1, label: 'Seg' },
  { value: 2, label: 'Ter' },
  { value: 3, label: 'Qua' },
  { value: 4, label: 'Qui' },
  { value: 5, label: 'Sex' },
  { value: 6, label: 'Sáb' },
  { value: 7, label: 'Dom' },
]

export function PontoSection({ value, onChange, onOpenTimeClock }: PontoSectionProps) {
  const workDays = (value.time_clock_default_work_days ?? '1,2,3,4,5')
    .split(',')
    .map((day) => Number(day.trim()))
    .filter((day) => day >= 1 && day <= 7)

  function toggleWorkDay(day: number) {
    const next = workDays.includes(day) ? workDays.filter((d) => d !== day) : [...workDays, day].sort((a, b) => a - b)
    onChange({ time_clock_default_work_days: next.join(',') })
  }

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
        <>
          <button
            type="button"
            onClick={onOpenTimeClock}
            className="w-fit rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-[var(--blue-700)]"
          >
            Acessar Controle de Ponto →
          </button>

          <div className="mt-2 rounded-2xl border border-[var(--border)] bg-[var(--page)] p-4">
            <h3 className="text-[13px] font-bold text-[var(--ink)]">Jornada padrão da empresa</h3>
            <p className="mt-1 text-[12px] text-[var(--ink-soft)]">
              Usada nos relatórios e na folha de pagamento estimada de quem não tem um horário
              próprio cadastrado (Pessoas → editar funcionário).
            </p>

            <div className="mt-3">
              <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Dias de trabalho</span>
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {WEEKDAY_OPTIONS.map((day) => (
                  <button
                    key={day.value}
                    type="button"
                    onClick={() => toggleWorkDay(day.value)}
                    className={`rounded-lg px-3 py-1.5 text-[12px] font-bold transition ${
                      workDays.includes(day.value)
                        ? 'bg-[var(--blue-500)] text-white'
                        : 'bg-[var(--surface)] text-[var(--ink-soft)] hover:text-[var(--ink)]'
                    }`}
                  >
                    {day.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Entrada prevista</span>
                <input
                  type="time"
                  value={value.time_clock_default_start_time ?? '08:00'}
                  onChange={(event) => onChange({ time_clock_default_start_time: event.target.value })}
                  className="min-w-0 w-full rounded-xl bg-[var(--surface)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Saída prevista</span>
                <input
                  type="time"
                  value={value.time_clock_default_end_time ?? '18:00'}
                  onChange={(event) => onChange({ time_clock_default_end_time: event.target.value })}
                  className="min-w-0 w-full rounded-xl bg-[var(--surface)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Almoço (min)</span>
                <input
                  type="number"
                  min={0}
                  value={value.time_clock_default_lunch_break_minutes ?? 60}
                  onChange={(event) =>
                    onChange({ time_clock_default_lunch_break_minutes: Number(event.target.value) || 0 })
                  }
                  className="min-w-0 w-full rounded-xl bg-[var(--surface)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Tolerância (min)</span>
                <input
                  type="number"
                  min={0}
                  value={value.time_clock_default_tolerance_minutes ?? 10}
                  onChange={(event) =>
                    onChange({ time_clock_default_tolerance_minutes: Number(event.target.value) || 0 })
                  }
                  className="min-w-0 w-full rounded-xl bg-[var(--surface)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                />
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--page)] p-4">
            <h3 className="text-[13px] font-bold text-[var(--ink)]">Folha de pagamento estimada</h3>
            <p className="mt-1 text-[12px] text-[var(--ink-soft)]">
              Parâmetros usados pra calcular a folha com base nas horas trabalhadas. O salário/valor-hora
              de cada funcionário é cadastrado em Pessoas.
            </p>

            <div className="mt-3 grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Adicional de hora extra (%)</span>
                <input
                  type="number"
                  min={0}
                  value={value.time_clock_overtime_percent ?? 50}
                  onChange={(event) => onChange({ time_clock_overtime_percent: Number(event.target.value) || 0 })}
                  className="min-w-0 w-full rounded-xl bg-[var(--surface)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Horas/mês (salário → valor-hora)</span>
                <input
                  type="number"
                  min={1}
                  value={value.time_clock_hours_month_divisor ?? 220}
                  onChange={(event) => onChange({ time_clock_hours_month_divisor: Number(event.target.value) || 220 })}
                  className="min-w-0 w-full rounded-xl bg-[var(--surface)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                />
              </label>
            </div>

            <label className="mt-3 flex items-center gap-2.5">
              <input
                type="checkbox"
                checked={value.time_clock_absence_discount_enabled ?? true}
                onChange={(event) => onChange({ time_clock_absence_discount_enabled: event.target.checked })}
                className="h-4 w-4 accent-[var(--blue-500)]"
              />
              <span className="text-[12.5px] font-semibold text-[var(--ink)]">
                Descontar faltas e horas a menos na folha estimada
              </span>
            </label>
          </div>
        </>
      )}
    </div>
  )
}
