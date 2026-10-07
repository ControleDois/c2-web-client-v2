import { useEffect, useMemo, useState } from 'react'
import {
  addDaysToKey,
  agendaDateKey,
  agendaTime,
  agendaToday,
  fetchGlassAppointments,
  GLASS_APPOINTMENT_TYPES,
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

function dayLabel(key: string) {
  const [, month, day] = key.split('-')
  return `${day}/${month}`
}

export function GlassSchedulePage({ session, company }: GlassSchedulePageProps) {
  const token = session.token.token
  const [weekStart, setWeekStart] = useState(() => weekStartKey(agendaToday()))
  const [type, setType] = useState('')
  const [appointments, setAppointments] = useState<GlassAppointmentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [draft, setDraft] = useState<GlassAppointmentDraft | null>(null)

  const days = useMemo(() => Array.from({ length: 7 }, (_, index) => addDaysToKey(weekStart, index)), [weekStart])
  const today = agendaToday()

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchGlassAppointments(token, company.id, { from: days[0], to: days[6], type })
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
  }, [token, company.id, days, type, reloadKey])

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

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Vidraçaria</p>
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Agenda</h1>
        </div>
        <button
          type="button"
          onClick={() => setDraft({ date: days.includes(today) ? today : days[0] })}
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
            onClick={() => setWeekStart((current) => addDaysToKey(current, -7))}
            aria-label="Semana anterior"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--ink-soft)] hover:bg-[var(--page)]"
          >
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => setWeekStart(weekStartKey(today))}
            className="rounded-lg px-3 py-1.5 text-[12.5px] font-bold text-[var(--ink)] hover:bg-[var(--page)]"
          >
            Hoje
          </button>
          <button
            type="button"
            onClick={() => setWeekStart((current) => addDaysToKey(current, 7))}
            aria-label="Próxima semana"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--ink-soft)] hover:bg-[var(--page)]"
          >
            <ChevronRightIcon className="h-4 w-4" />
          </button>
        </div>
        <span className="text-[14px] font-semibold text-[var(--ink)]">
          {dayLabel(days[0])} a {dayLabel(days[6])}
        </span>
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

      <div className={`grid gap-3 md:grid-cols-2 xl:grid-cols-7 ${loading ? 'opacity-60' : ''}`}>
        {days.map((day, index) => {
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
                {list.map((appointment) => (
                  <button
                    key={appointment.id}
                    type="button"
                    onClick={() => setDraft({ appointment })}
                    className={`rounded-lg border-l-4 bg-[var(--page)] px-2.5 py-2 text-left hover:bg-[var(--blue-100)] ${
                      TYPE_TONES[appointment.type] ?? ''
                    } ${appointment.status === 2 ? 'opacity-50' : ''}`}
                  >
                    <p className={`text-[12px] font-bold text-[var(--ink)] ${appointment.status === 2 ? 'line-through' : ''}`}>
                      {agendaTime(appointment.scheduled_at)} · {typeLabel(appointment.type)}
                      {appointment.status === 1 && <span className="ml-1 text-[var(--green-600)]">✓</span>}
                    </p>
                    <p className="truncate text-[12px] text-[var(--ink-soft)]">
                      {appointment.people?.name ?? appointment.order?.people?.name ?? 'Sem cliente'}
                    </p>
                    {(appointment.order || appointment.team) && (
                      <p className="truncate text-[11px] text-[var(--muted)]">
                        {[appointment.order ? `#${appointment.order.code}` : null, appointment.team].filter(Boolean).join(' · ')}
                      </p>
                    )}
                  </button>
                ))}
                {list.length === 0 && <p className="text-[11.5px] text-[var(--muted)]">Livre</p>}
              </div>
            </div>
          )
        })}
      </div>

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
