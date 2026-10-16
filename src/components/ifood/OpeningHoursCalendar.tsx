import type { IfoodOpeningDay } from '../../lib/ifood'

// Horário semanal no estilo do Portal do Parceiro do iFood: lista de dias à esquerda, grade da semana à
// direita (blocos verdes onde a loja está aberta) e o resumo de horas embaixo.

interface Props {
  days: IfoodOpeningDay[]
  labels: Record<string, string>
  order: string[]
}

const GRID_HEIGHT = 480
const DAY_MINUTES = 24 * 60

function toMinutes(time: string) {
  const [h, m] = time.split(':').map(Number)
  return (h || 0) * 60 + (m || 0)
}

// Período já em minutos; fim menor ou igual ao início é dia seguinte.
function span(period: { start: string; end: string }) {
  const start = toMinutes(period.start)
  let end = toMinutes(period.end)
  if (end <= start) end += DAY_MINUTES
  return { start, end }
}

function formatHours(minutes: number) {
  const h = Math.floor(minutes / 60)
  const m = Math.round(minutes % 60)
  return m ? `${h}h${String(m).padStart(2, '0')}` : `${h}h`
}

function formatHoursLong(minutes: number) {
  const h = minutes / 60
  const text = Number.isInteger(h) ? String(h) : h.toFixed(1).replace('.', ',')
  return `${text} ${h === 1 ? 'hora' : 'horas'}`
}

export function OpeningHoursCalendar({ days, labels, order }: Props) {
  const byDay = new Map(days.map((entry) => [entry.day, entry]))
  const nextDay = (day: string) => order[(order.indexOf(day) + 1) % order.length]

  // Pedaços de cada dia (o que passa da meia-noite continua no dia seguinte).
  const segments = new Map<string, { start: number; end: number; from: string; to: string }[]>()
  const add = (day: string, seg: { start: number; end: number; from: string; to: string }) =>
    segments.set(day, [...(segments.get(day) ?? []), seg])

  for (const entry of days) {
    for (const period of entry.periods) {
      if (!period.start || !period.end) continue
      const { start, end } = span(period)
      if (end <= DAY_MINUTES) add(entry.day, { start, end, from: period.start, to: period.end })
      else {
        add(entry.day, { start, end: DAY_MINUTES, from: period.start, to: '24:00' })
        add(nextDay(entry.day), { start: 0, end: end - DAY_MINUTES, from: '00:00', to: period.end })
      }
    }
  }

  const openMinutes = (day: string) =>
    (byDay.get(day)?.periods ?? []).reduce((sum, period) => (period.start && period.end ? sum + (span(period).end - span(period).start) : sum), 0)

  const overlap = (from: number, to: number) => {
    let total = 0
    for (const list of segments.values()) {
      for (const seg of list) total += Math.max(0, Math.min(seg.end, to) - Math.max(seg.start, from))
    }
    return total
  }

  const totalWeek = order.reduce((sum, day) => sum + openMinutes(day), 0)
  const lunch = overlap(11 * 60, 15 * 60)
  const dinner = overlap(18 * 60, 23 * 60)

  const hourMarks = [0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22]

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
        {/* Dias da semana */}
        <ul className="flex flex-col gap-2">
          {order.map((day) => {
            const entry = byDay.get(day)
            const open = (entry?.periods.length ?? 0) > 0
            return (
              <li key={day} className="rounded-xl bg-[var(--page)] px-4 py-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[14.5px] font-bold text-[var(--ink)]">{labels[day]}</p>
                  <span
                    className={`rounded-md px-2 py-0.5 text-[11.5px] font-bold ${
                      open ? 'bg-[var(--green-100)] text-[var(--green-600)]' : 'bg-[var(--surface)] text-[var(--muted)] ring-1 ring-[var(--border)]'
                    }`}
                  >
                    {open ? 'Aberta' : 'Fechada'}
                  </span>
                </div>
                <p className="mt-1 text-[12.5px] text-[var(--ink-soft)]">
                  {open ? entry!.periods.map((period) => `${period.start} às ${period.end}h`).join(' · ') : 'Loja fechada'}
                </p>
              </li>
            )
          })}
        </ul>

        {/* Grade da semana */}
        <div className="overflow-x-auto rounded-xl bg-[var(--page)] p-3">
          <div className="min-w-[640px]">
            <div className="grid grid-cols-[40px_repeat(7,1fr)] gap-1.5">
              <div />
              {order.map((day) => {
                const minutes = openMinutes(day)
                return (
                  <div key={day} className="pb-2 text-center">
                    <p className="text-[13px] font-bold text-[var(--ink)]">{labels[day].slice(0, 3)}</p>
                    <p className={`text-[10.5px] font-semibold ${minutes ? 'text-[var(--green-600)]' : 'text-[var(--muted)]'}`}>
                      {minutes ? `Aberta por ${formatHours(minutes)}` : 'Fechada'}
                    </p>
                  </div>
                )
              })}

              <div className="relative" style={{ height: GRID_HEIGHT }}>
                {hourMarks.map((hour) => (
                  <span
                    key={hour}
                    className="absolute right-1 -translate-y-1/2 text-[10px] text-[var(--muted)]"
                    style={{ top: `${(hour / 24) * 100}%` }}
                  >
                    {hour}h
                  </span>
                ))}
              </div>

              {order.map((day) => (
                <div
                  key={day}
                  className="relative overflow-hidden rounded-md bg-[var(--surface)]"
                  style={{
                    height: GRID_HEIGHT,
                    backgroundImage: `repeating-linear-gradient(to bottom, transparent 0, transparent calc(${GRID_HEIGHT / 12}px - 1px), var(--border) calc(${GRID_HEIGHT / 12}px - 1px), var(--border) ${GRID_HEIGHT / 12}px)`,
                  }}
                >
                  {(segments.get(day) ?? []).map((seg, index) => (
                    <div
                      key={index}
                      className="absolute inset-x-0.5 flex items-start overflow-hidden rounded-md bg-[var(--green-100)] px-1.5 py-1 text-[10px] font-bold leading-tight text-[var(--green-600)] ring-1 ring-[var(--green-600)]/20"
                      style={{ top: `${(seg.start / DAY_MINUTES) * 100}%`, height: `${((seg.end - seg.start) / DAY_MINUTES) * 100}%` }}
                    >
                      {seg.from} - {seg.to}
                    </div>
                  ))}
                  {(segments.get(day) ?? []).length === 0 && (
                    <span className="absolute left-1.5 top-1.5 text-[10px] text-[var(--muted)]">Loja fechada</span>
                  )}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Resumo */}
      <div>
        <h3 className="mb-2 text-[14px] font-bold text-[var(--ink)]">Resumo da semana</h3>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-xl bg-[var(--page)] px-4 py-3">
            <p className="text-[12.5px] text-[var(--ink-soft)]">Horas abertas na semana</p>
            <p className="mt-0.5 text-[19px] font-bold text-[var(--ink)]">{formatHoursLong(totalWeek)}</p>
          </div>
          <div className="rounded-xl bg-[var(--page)] px-4 py-3">
            <p className="text-[12.5px] text-[var(--ink-soft)]">No horário de almoço | 11h às 15h</p>
            <p className="mt-0.5 text-[19px] font-bold text-[var(--ink)]">{formatHoursLong(lunch)}</p>
          </div>
          <div className="rounded-xl bg-[var(--page)] px-4 py-3">
            <p className="text-[12.5px] text-[var(--ink-soft)]">No horário de jantar | 18h às 23h</p>
            <p className="mt-0.5 text-[19px] font-bold text-[var(--ink)]">{formatHoursLong(dinner)}</p>
          </div>
        </div>
      </div>
    </div>
  )
}
