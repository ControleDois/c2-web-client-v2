import { useEffect, useMemo, useState } from 'react'
import {
  addDaysToKey,
  agendaDateKey,
  agendaTime,
  agendaToday,
  fetchGlassAppointments,
  GLASS_APPOINTMENT_TYPES,
  monthGridDays,
  monthStartKey,
  weekStartKey,
  type GlassAppointmentRecord,
} from '../../lib/glass'
import { ApiError } from '../../lib/api'
import { SelectField } from '../../components/form/SelectField'
import { GlassAppointmentModal, type GlassAppointmentDraft } from './GlassAppointmentModal'
import { ChevronLeftIcon, ChevronRightIcon, PlusIcon } from '../../components/icons'
import type { AuthCompany, AuthSession } from '../../lib/auth'

interface GlassSchedulePageProps {
  session: AuthSession
  company: AuthCompany
}

const TYPE_TONES: Record<string, string> = {
  medicao: 'border-l-[var(--blue-500)]',
  instalacao: 'border-l-[var(--green-600)]',
  entrega: 'border-l-[var(--amber-500)]',
  assistencia: 'border-l-[var(--red-500)]',
}

const WEEKDAYS = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom']
const MONTHS = ['Janeiro', 'Fevereiro', 'Março', 'Abril', 'Maio', 'Junho', 'Julho', 'Agosto', 'Setembro', 'Outubro', 'Novembro', 'Dezembro']

function monthLabel(key: string) {
  const [year, month] = key.split('-').map(Number)
  return `${MONTHS[month - 1]} de ${year}`
}

function dayLabel(key: string) {
  const [, month, day] = key.split('-')
  return `${day}/${month}`
}

export function GlassSchedulePage({ session, company }: GlassSchedulePageProps) {
  const token = session.token.token
  const [mode, setMode] = useState<'month' | 'week'>('month')
  const [weekStart, setWeekStart] = useState(() => weekStartKey(agendaToday()))
  const [monthStart, setMonthStart] = useState(() => monthStartKey(agendaToday()))
  const [selectedDay, setSelectedDay] = useState(() => agendaToday())
  const [type, setType] = useState('')
  const [appointments, setAppointments] = useState<GlassAppointmentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [draft, setDraft] = useState<GlassAppointmentDraft | null>(null)

  const weekDays = useMemo(() => Array.from({ length: 7 }, (_, index) => addDaysToKey(weekStart, index)), [weekStart])
  const monthDays = useMemo(() => monthGridDays(monthStart), [monthStart])
  const days = mode === 'month' ? monthDays : weekDays
  const today = agendaToday()
  const rangeFrom = days[0]
  const rangeTo = days[days.length - 1]

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchGlassAppointments(token, company.id, { from: rangeFrom, to: rangeTo, type })
      .then((res) => {
        if (!cancelled) setAppointments(res)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Não foi possível carregar a agenda.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, company.id, rangeFrom, rangeTo, type, reloadKey])

  const byDay = useMemo(() => {
    const map = new Map<string, GlassAppointmentRecord[]>()
    for (const appointment of appointments) {
      const key = agendaDateKey(appointment.scheduled_at)
      map.set(key, [...(map.get(key) ?? []), appointment])
    }
    return map
  }, [appointments])

  function typeLabel(value: string) {
    return GLASS_APPOINTMENT_TYPES.find((item) => item.value === value)?.label ?? value
  }

  function who(appointment: GlassAppointmentRecord) {
    return appointment.people?.name ?? appointment.order?.people?.name ?? 'Sem cliente'
  }

  function responsible(appointment: GlassAppointmentRecord) {
    return appointment.responsible?.name ?? appointment.team ?? null
  }

  function previous() {
    if (mode === 'month') setMonthStart((current) => monthStartKey(current, -1))
    else setWeekStart((current) => addDaysToKey(current, -7))
  }

  function next() {
    if (mode === 'month') setMonthStart((current) => monthStartKey(current, 1))
    else setWeekStart((current) => addDaysToKey(current, 7))
  }

  function goToday() {
    setWeekStart(weekStartKey(today))
    setMonthStart(monthStartKey(today))
    setSelectedDay(today)
  }

  function openWeekOf(day: string) {
    setWeekStart(weekStartKey(day))
    setSelectedDay(day)
    setMode('week')
  }

  const selectedList = byDay.get(selectedDay) ?? []
  const inMonth = (day: string) => day.slice(0, 7) === monthStart.slice(0, 7)

  function renderAppointment(appointment: GlassAppointmentRecord, compact: boolean) {
    const done = appointment.status === 2
    return (
      <button
        key={appointment.id}
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          setDraft({ appointment })
        }}
        className={`w-full rounded-lg border-l-4 bg-[var(--page)] px-2.5 text-left hover:bg-[var(--blue-100)] ${
          compact ? 'py-1' : 'py-2'
        } ${TYPE_TONES[appointment.type] ?? ''} ${done ? 'opacity-50' : ''}`}
      >
        <p className={`truncate text-[12px] font-bold text-[var(--ink)] ${done ? 'line-through' : ''}`}>
          {agendaTime(appointment.scheduled_at)} · {typeLabel(appointment.type)}
          {appointment.status === 1 && <span className="ml-1 text-[var(--green-600)]">✓</span>}
        </p>
        <p className="truncate text-[12px] text-[var(--ink-soft)]">{who(appointment)}</p>
        {!compact && (appointment.order || responsible(appointment)) && (
          <p className="truncate text-[11px] text-[var(--muted)]">
            {[appointment.order ? `#${appointment.order.code}` : null, responsible(appointment)].filter(Boolean).join(' · ')}
          </p>
        )}
      </button>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Vidraçaria</p>
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Agenda</h1>
        </div>
        <button
          type="button"
          onClick={() => setDraft({ date: mode === 'month' ? selectedDay : days.includes(today) ? today : days[0] })}
          className="flex items-center gap-2 rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)]"
        >
          <PlusIcon className="h-4 w-4" />
          Novo agendamento
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
          <button
            type="button"
            onClick={previous}
            aria-label={mode === 'month' ? 'Mês anterior' : 'Semana anterior'}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--ink-soft)] hover:bg-[var(--page)]"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={goToday}
            className="rounded-lg px-3 py-1.5 text-[12.5px] font-bold text-[var(--ink)] hover:bg-[var(--page)]"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={next}
            aria-label={mode === 'month' ? 'Próximo mês' : 'Próxima semana'}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--ink-soft)] hover:bg-[var(--page)]"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
        <span className="text-[14px] font-semibold text-[var(--ink)]">
          {mode === 'month' ? monthLabel(monthStart) : `${dayLabel(weekDays[0])} a ${dayLabel(weekDays[6])}`}
        </span>
        <div className="flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
          {(
            [
              ['month', 'Mês'],
              ['week', 'Semana'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setMode(value)}
              className={`rounded-lg px-3 py-1.5 text-[12.5px] font-bold transition ${
                mode === value ? 'bg-[var(--blue-500)] text-white' : 'text-[var(--ink-soft)] hover:bg-[var(--page)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="ml-auto min-w-[180px]">
          <SelectField label="" variant="surface" value={type} onChange={(event) => setType(event.target.value)}>
            <option value="">Todos os tipos</option>
            {GLASS_APPOINTMENT_TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </SelectField>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-[var(--red-100)] p-4 text-[13.5px] font-medium text-[var(--red-500)]">{error}</div>
      )}

      {mode === 'week' ? (
        <div className={`grid gap-3 md:grid-cols-2 xl:grid-cols-7 ${loading ? 'opacity-60' : ''}`}>
          {weekDays.map((day, index) => {
            const list = byDay.get(day) ?? []
            return (
              <div
                key={day}
                className={`flex min-h-[140px] flex-col rounded-2xl border bg-[var(--surface)] p-3 ${
                  day === today ? 'border-[var(--blue-500)]' : 'border-[var(--border)]'
                }`}
              >
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[12.5px] font-bold text-[var(--ink)]">
                    {WEEKDAYS[index]} <span className="font-medium text-[var(--muted)]">{dayLabel(day)}</span>
                  </p>
                  <button
                    type="button"
                    onClick={() => setDraft({ date: day })}
                    aria-label={`Agendar em ${dayLabel(day)}`}
                    className="inline-flex h-6 w-6 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
                  >
                    <PlusIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="flex flex-col gap-2">
                  {list.map((appointment) => renderAppointment(appointment, false))}
                  {list.length === 0 && <p className="text-[11.5px] text-[var(--muted)]">Livre</p>}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className={loading ? 'opacity-60' : ''}>
          <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
            {WEEKDAYS.map((weekday) => (
              <p key={weekday} className="px-1 text-center text-[11.5px] font-bold tracking-wide text-[var(--muted)] uppercase">
                {weekday}
              </p>
            ))}
            {monthDays.map((day) => {
              const list = byDay.get(day) ?? []
              const selected = day === selectedDay
              return (
                <div
                  key={day}
                  role="button"
                  tabIndex={0}
                  onClick={() => setSelectedDay(day)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') setSelectedDay(day)
                  }}
                  className={`flex min-h-[64px] cursor-pointer flex-col rounded-xl border p-1.5 text-left transition sm:min-h-[104px] sm:p-2 ${
                    selected
                      ? 'border-[var(--blue-500)] bg-[var(--blue-100)]'
                      : day === today
                        ? 'border-[var(--blue-500)] bg-[var(--surface)]'
                        : 'border-[var(--border)] bg-[var(--surface)] hover:bg-[var(--page)]'
                  } ${inMonth(day) ? '' : 'opacity-45'}`}
                >
                  <div className="flex items-center justify-between">
                    <span
                      className={`text-[12.5px] font-bold ${
                        day === today ? 'rounded-md bg-[var(--blue-500)] px-1.5 text-white' : 'text-[var(--ink)]'
                      }`}
                    >
                      {Number(day.slice(8))}
                    </span>
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation()
                        setDraft({ date: day })
                      }}
                      aria-label={`Agendar em ${dayLabel(day)}`}
                      className="hidden h-5 w-5 items-center justify-center rounded-md text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)] sm:inline-flex"
                    >
                      <PlusIcon className="h-3 w-3" />
                    </button>
                  </div>
                  <div className="mt-1 hidden flex-col gap-1 sm:flex">
                    {list.slice(0, 2).map((appointment) => renderAppointment(appointment, true))}
                    {list.length > 2 && (
                      <button
                        type="button"
                        onClick={(event) => {
                          event.stopPropagation()
                          openWeekOf(day)
                        }}
                        className="text-left text-[11.5px] font-bold text-[var(--blue-700)] hover:underline"
                      >
                        + {list.length - 2} {list.length - 2 === 1 ? 'visita' : 'visitas'}
                      </button>
                    )}
                  </div>
                  {list.length > 0 && (
                    <div className="mt-1 flex flex-wrap gap-1 sm:hidden">
                      {list.slice(0, 4).map((appointment) => (
                        <span
                          key={appointment.id}
                          className={`h-1.5 w-1.5 rounded-full ${
                            { medicao: 'bg-[var(--blue-500)]', instalacao: 'bg-[var(--green-600)]', entrega: 'bg-[var(--amber-500)]', assistencia: 'bg-[var(--red-500)]' }[appointment.type] ?? 'bg-[var(--muted)]'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          <div className="mt-5 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="mb-3 flex items-center justify-between gap-3">
              <h2 className="text-[14px] font-bold text-[var(--ink)]">
                {selectedDay === today ? 'Hoje' : dayLabel(selectedDay)}
                <span className="ml-2 font-medium text-[var(--muted)]">
                  {selectedList.length === 0
                    ? 'nenhuma visita'
                    : `${selectedList.length} ${selectedList.length === 1 ? 'visita' : 'visitas'}`}
                </span>
              </h2>
              <button
                type="button"
                onClick={() => setDraft({ date: selectedDay })}
                className="flex items-center gap-1.5 rounded-lg bg-[var(--page)] px-3 py-1.5 text-[12.5px] font-bold text-[var(--blue-700)] hover:bg-[var(--blue-100)]"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Agendar neste dia
              </button>
            </div>
            {selectedList.length === 0 ? (
              <p className="text-[13px] text-[var(--muted)]">
                Dia livre. Toque em um dia do calendário para ver as visitas, ou em “Agendar neste dia” para marcar uma medição ou instalação.
              </p>
            ) : (
              <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {selectedList.map((appointment) => renderAppointment(appointment, false))}
              </div>
            )}
          </div>
        </div>
      )}

      <GlassAppointmentModal
        open={Boolean(draft)}
        session={session}
        company={company}
        draft={draft}
        onClose={() => setDraft(null)}
        onChanged={() => {
          setDraft(null)
          setReloadKey((key) => key + 1)
        }}
      />
    </div>
  )
}
