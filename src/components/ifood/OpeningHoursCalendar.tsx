import { useState } from 'react'
import type { IfoodOpeningDay } from '../../lib/ifood'
import { ConfirmDialog } from '../ConfirmDialog'
import { Select } from '../form/Select'
import { PencilIcon, PlusIcon, TrashIcon } from '../icons'
import { buttonPrimary } from './ui'

// Horário semanal no estilo do Portal do Parceiro do iFood: lista de dias à esquerda, grade da semana à
// direita (blocos verdes onde a loja está aberta) e o resumo de horas embaixo.

interface Props {
  days: IfoodOpeningDay[]
  labels: Record<string, string>
  order: string[]
  // Salva a semana inteira no iFood. Devolve null se deu certo, ou a mensagem de erro para mostrar na janelinha.
  onSave: (days: IfoodOpeningDay[]) => Promise<string | null>
  busy?: boolean
}

type Period = { start: string; end: string }

const SLOT_HOURS = 2
const pad2 = (value: number) => String(value).padStart(2, '0')
const hhmm = (minutes: number) => `${pad2(Math.floor(minutes / 60))}:${pad2(minutes % 60)}`

const BASE_TIMES = [...Array.from({ length: 96 }, (_, i) => hhmm(i * 15)), '23:59']

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

export function OpeningHoursCalendar({ days, labels, order, onSave, busy = false }: Props) {
  const byDay = new Map(days.map((entry) => [entry.day, entry]))
  const nextDay = (day: string) => order[(order.indexOf(day) + 1) % order.length]

  // Pedaços de cada dia (o que passa da meia-noite continua no dia seguinte).
  type Segment = { start: number; end: number; from: string; to: string; origin: string; index: number }
  const segments = new Map<string, Segment[]>()
  const add = (day: string, seg: Segment) => segments.set(day, [...(segments.get(day) ?? []), seg])

  for (const entry of days) {
    entry.periods.forEach((period, index) => {
      if (!period.start || !period.end) return
      const { start, end } = span(period)
      if (end <= DAY_MINUTES) add(entry.day, { start, end, from: period.start, to: period.end, origin: entry.day, index })
      else {
        add(entry.day, { start, end: DAY_MINUTES, from: period.start, to: '24:00', origin: entry.day, index })
        add(nextDay(entry.day), { start: 0, end: end - DAY_MINUTES, from: '00:00', to: period.end, origin: entry.day, index })
      }
    })
  }

  // ---- edição direto na grade ----
  const [dialog, setDialog] = useState<{ day: string; periods: Period[]; open: boolean } | null>(null)
  const [dialogError, setDialogError] = useState<string | null>(null)
  const [selected, setSelected] = useState<string | null>(null)
  const [removing, setRemoving] = useState<{ day: string; index: number } | null>(null)

  const periodsOf = (day: string): Period[] => (byDay.get(day)?.periods ?? []).map((period) => ({ ...period }))
  const withDay = (day: string, periods: Period[]) =>
    order.map((name) => ({ day: name, periods: name === day ? periods : periodsOf(name) }))

  function openInclude(day: string, hour: number) {
    const start = hour * 60
    const end = Math.min(start + SLOT_HOURS * 60, DAY_MINUTES - 1)
    setDialogError(null)
    setDialog({ day, periods: [...periodsOf(day), { start: hhmm(start), end: end >= DAY_MINUTES - 1 ? '23:59' : hhmm(end) }], open: true })
  }

  function openEdit(day: string) {
    setDialogError(null)
    setSelected(null)
    setDialog({ day, periods: periodsOf(day), open: periodsOf(day).length > 0 })
  }

  function validate(periods: Period[]): string | null {
    const spans = periods.map(span).sort((a, b) => a.start - b.start)
    for (const item of periods) {
      if (!item.start || !item.end) return 'Escolha a hora de abrir e a de fechar em todos os horários.'
      if (item.start === item.end) return 'A hora de fechar precisa ser diferente da hora de abrir.'
    }
    for (let i = 1; i < spans.length; i++) {
      if (spans[i].start < spans[i - 1].end) return 'Os horários do mesmo dia não podem se sobrepor.'
    }
    return null
  }

  async function saveDialog() {
    if (!dialog) return
    const periods = dialog.open ? dialog.periods : []
    const problem = dialog.open ? validate(periods) : null
    if (problem) return setDialogError(problem)
    const error = await onSave(withDay(dialog.day, periods))
    if (error) setDialogError(error)
    else setDialog(null)
  }

  async function removePeriod() {
    if (!removing) return
    const periods = periodsOf(removing.day).filter((_, index) => index !== removing.index)
    const error = await onSave(withDay(removing.day, periods))
    if (error) setDialogError(error)
    setRemoving(null)
    setSelected(null)
  }

  const timeOptions = (current: string) =>
    (BASE_TIMES.includes(current) || !current ? BASE_TIMES : [...BASE_TIMES, current].sort()).map((time) => (
      <option key={time} value={time}>
        {time}
      </option>
    ))

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
                  style={{ height: GRID_HEIGHT }}
                >
                  {/* Áreas vazias: passar o mouse mostra "Incluir" */}
                  {Array.from({ length: 24 / SLOT_HOURS }, (_, slot) => (
                    <button
                      key={slot}
                      type="button"
                      onClick={() => openInclude(day, slot * SLOT_HOURS)}
                      aria-label={`Incluir horário na ${labels[day]} a partir das ${slot * SLOT_HOURS}h`}
                      className="group absolute inset-x-0 flex items-center justify-center border-b border-[var(--border)] transition hover:bg-[var(--blue-100)]"
                      style={{ top: `${((slot * SLOT_HOURS) / 24) * 100}%`, height: `${(SLOT_HOURS / 24) * 100}%` }}
                    >
                      <span className="hidden items-center gap-1 text-[11px] font-bold text-[var(--blue-700)] group-hover:flex">
                        <PlusIcon className="h-3 w-3" />
                        Incluir
                      </span>
                    </button>
                  ))}

                  {/* Horários abertos: passar o mouse mostra "Editar" e "Excluir" */}
                  {(segments.get(day) ?? []).map((seg, index) => {
                    const key = `${seg.origin}-${seg.index}-${day}-${index}`
                    const showing = selected === key
                    return (
                      <div
                        key={key}
                        onClick={() => setSelected(showing ? null : key)}
                        className="group absolute inset-x-0.5 z-10 cursor-pointer overflow-hidden rounded-md bg-[var(--green-100)] ring-1 ring-[var(--green-600)]/25"
                        style={{ top: `${(seg.start / DAY_MINUTES) * 100}%`, height: `${((seg.end - seg.start) / DAY_MINUTES) * 100}%` }}
                      >
                        <span className="block px-1.5 py-1 text-[10px] font-bold leading-tight text-[var(--green-600)]">
                          {seg.from} - {seg.to}
                        </span>
                        <div
                          className={`absolute inset-0 items-center justify-center gap-1 bg-[var(--green-100)]/95 px-1 ${
                            seg.end - seg.start < 150 ? 'flex-row' : 'flex-col'
                          } ${showing ? 'flex' : 'hidden group-hover:flex'}`}
                        >
                          {seg.end - seg.start < 150 ? (
                            <>
                              <button
                                type="button"
                                title="Editar"
                                aria-label="Editar este horário"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  openEdit(seg.origin)
                                }}
                                className="rounded-md bg-[var(--surface)] p-1 text-[var(--blue-700)] ring-1 ring-[var(--border)] hover:bg-[var(--blue-100)]"
                              >
                                <PencilIcon className="h-3 w-3" />
                              </button>
                              <button
                                type="button"
                                title="Excluir"
                                aria-label="Excluir este horário"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setRemoving({ day: seg.origin, index: seg.index })
                                }}
                                className="rounded-md bg-[var(--surface)] p-1 text-[var(--red-500)] ring-1 ring-[var(--border)] hover:bg-[var(--red-100)]"
                              >
                                <TrashIcon className="h-3 w-3" />
                              </button>
                            </>
                          ) : (
                            <>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  openEdit(seg.origin)
                                }}
                                className="w-full max-w-[84px] rounded-md bg-[var(--surface)] px-2 py-1 text-[11px] font-bold text-[var(--blue-700)] ring-1 ring-[var(--border)] hover:bg-[var(--blue-100)]"
                              >
                                Editar
                              </button>
                              <button
                                type="button"
                                onClick={(event) => {
                                  event.stopPropagation()
                                  setRemoving({ day: seg.origin, index: seg.index })
                                }}
                                className="w-full max-w-[84px] rounded-md bg-[var(--surface)] px-2 py-1 text-[11px] font-bold text-[var(--red-500)] ring-1 ring-[var(--border)] hover:bg-[var(--red-100)]"
                              >
                                Excluir
                              </button>
                            </>
                          )}
                        </div>
                      </div>
                    )
                  })}
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
      {dialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={busy ? undefined : () => setDialog(null)}>
          <div className="w-full max-w-[420px] rounded-2xl bg-[var(--surface)] p-5 shadow-[var(--card-shadow)] sm:p-6" onClick={(event) => event.stopPropagation()}>
            <div className="flex items-center justify-between gap-3">
              <h3 className="text-[18px] font-bold text-[var(--ink)]">{labels[dialog.day]}</h3>
              <button
                type="button"
                role="switch"
                aria-checked={dialog.open}
                aria-label="Aberto neste dia"
                onClick={() =>
                  setDialog((current) =>
                    current
                      ? {
                          ...current,
                          open: !current.open,
                          periods: !current.open && current.periods.length === 0 ? [{ start: '08:00', end: '18:00' }] : current.periods,
                        }
                      : current
                  )
                }
                className={`relative h-7 w-12 flex-none rounded-full transition ${dialog.open ? 'bg-[var(--green-600)]' : 'bg-[var(--muted)]/50'}`}
              >
                <span className={`absolute top-0.5 h-6 w-6 rounded-full bg-white transition-all ${dialog.open ? 'left-[22px]' : 'left-0.5'}`} />
              </button>
            </div>
            <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
              {dialog.open ? 'A loja abre neste dia nos horários abaixo.' : 'A loja fica fechada neste dia.'}
            </p>

            {dialog.open && (
              <div className="mt-4 flex flex-col gap-3">
                {dialog.periods.map((period, index) => (
                  <div key={index} className="flex items-center gap-2">
                    <Select
                      variant="page"
                      className="flex-1"
                      value={period.start}
                      onChange={(value) =>
                        setDialog((current) =>
                          current ? { ...current, periods: current.periods.map((item, i) => (i === index ? { ...item, start: value } : item)) } : current
                        )
                      }
                    >
                      {timeOptions(period.start)}
                    </Select>
                    <span className="text-[13px] text-[var(--muted)]">até</span>
                    <Select
                      variant="page"
                      className="flex-1"
                      value={period.end}
                      onChange={(value) =>
                        setDialog((current) =>
                          current ? { ...current, periods: current.periods.map((item, i) => (i === index ? { ...item, end: value } : item)) } : current
                        )
                      }
                    >
                      {timeOptions(period.end)}
                    </Select>
                    <button
                      type="button"
                      aria-label="Tirar este horário"
                      onClick={() =>
                        setDialog((current) => {
                          if (!current) return current
                          const periods = current.periods.filter((_, i) => i !== index)
                          return { ...current, periods, open: periods.length > 0 }
                        })
                      }
                      className="flex-none rounded-lg p-2 text-[var(--red-500)] hover:bg-[var(--red-100)]"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  onClick={() => setDialog((current) => (current ? { ...current, periods: [...current.periods, { start: '', end: '' }] } : current))}
                  className="flex items-center gap-1.5 self-start text-[13px] font-bold text-[var(--blue-700)] hover:underline"
                >
                  <PlusIcon className="h-4 w-4" />
                  Adicionar outro horário
                </button>
              </div>
            )}

            {dialogError && <p className="mt-3 rounded-xl bg-[var(--red-100)] px-4 py-3 text-[13px] font-medium text-[var(--red-500)]">{dialogError}</p>}

            <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button type="button" onClick={() => setDialog(null)} disabled={busy} className="rounded-xl px-5 py-3 text-[14px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-60">
                Cancelar
              </button>
              <button type="button" onClick={saveDialog} disabled={busy} className={buttonPrimary}>
                {busy ? 'Salvando…' : 'Salvar no iFood'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={removing !== null}
        title="Tirar este horário?"
        message="A loja deixa de abrir nesse horário, e a mudança vale na hora no iFood."
        confirmLabel="Sim, excluir"
        cancelLabel="Agora não"
        loading={busy}
        onConfirm={removePeriod}
        onCancel={() => setRemoving(null)}
      />
    </div>
  )
}
