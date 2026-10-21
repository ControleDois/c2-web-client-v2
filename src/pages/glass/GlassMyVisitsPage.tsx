import { useEffect, useMemo, useState } from 'react'
import {
  addDaysToKey,
  agendaDateKey,
  agendaTime,
  agendaToday,
  fetchMyGlassVisits,
  GLASS_APPOINTMENT_TYPES,
  type GlassAppointmentRecord,
} from '../../lib/glass'
import { ApiError } from '../../lib/api'
import { ChevronRightIcon, ClockIcon, MapPinIcon } from '../../components/icons'
import type { AuthCompany, AuthSession } from '../../lib/auth'

interface GlassMyVisitsPageProps {
  session: AuthSession
  company: AuthCompany
  onOpenVisit: (id: string) => void
}

const TYPE_TONES: Record<string, string> = {
  medicao: 'border-l-[var(--blue-500)]',
  instalacao: 'border-l-[var(--green-600)]',
  entrega: 'border-l-[var(--amber-500)]',
  assistencia: 'border-l-[var(--red-500)]',
}

const WEEKDAYS = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

function dayTitle(key: string, today: string) {
  if (key < today) return 'Atrasadas'
  if (key === today) return 'Hoje'
  if (key === addDaysToKey(today, 1)) return 'Amanhã'
  const [, month, day] = key.split('-')
  const weekday = WEEKDAYS[new Date(`${key}T12:00:00Z`).getUTCDay()]
  return `${weekday}, ${day}/${month}`
}

// Tela do técnico no celular: as visitas que o escritório marcou para ele.
export function GlassMyVisitsPage({ session, company, onOpenVisit }: GlassMyVisitsPageProps) {
  const token = session.token.token
  const [scope, setScope] = useState<'open' | 'done'>('open')
  const [visits, setVisits] = useState<GlassAppointmentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchMyGlassVisits(token, company.id, scope)
      .then((res) => {
        if (!cancelled) setVisits(res)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as suas visitas.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, company.id, scope, reloadKey])

  const today = agendaToday()
  const groups = useMemo(() => {
    const map = new Map<string, GlassAppointmentRecord[]>()
    for (const visit of visits) {
      const day = agendaDateKey(visit.scheduled_at)
      const key = scope === 'open' && day < today ? '0000-00-00' : day
      map.set(key, [...(map.get(key) ?? []), visit])
    }
    return Array.from(map.entries()).sort(([a], [b]) => (scope === 'done' ? b.localeCompare(a) : a.localeCompare(b)))
  }, [visits, scope, today])

  const typeLabel = (value: string) => GLASS_APPOINTMENT_TYPES.find((item) => item.value === value)?.label ?? value

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-5 p-4 sm:p-6 lg:p-8">
      <div>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Vidraçaria</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Minhas visitas</h1>
        <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
          As medições, instalações e entregas que o escritório marcou para você. Toque numa visita para atender: chegar, anotar
          medidas, tirar fotos, pegar a assinatura e concluir.
        </p>
      </div>

      <div className="flex items-center gap-2">
        <div className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
          {(
            [
              ['open', 'Para fazer'],
              ['done', 'Concluídas'],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setScope(value)}
              className={`rounded-lg px-3.5 py-1.5 text-[13px] font-bold transition ${
                scope === value ? 'bg-[var(--blue-500)] text-white' : 'text-[var(--ink-soft)] hover:bg-[var(--page)]'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setReloadKey((key) => key + 1)}
          className="ml-auto rounded-xl bg-[var(--page)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--blue-700)] hover:bg-[var(--blue-100)]"
        >
          Atualizar
        </button>
      </div>

      {error && <div className="rounded-2xl bg-[var(--red-100)] p-4 text-[13.5px] font-medium text-[var(--red-500)]">{error}</div>}

      {!loading && !error && visits.length === 0 && (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-center">
          <p className="text-[14px] font-bold text-[var(--ink)]">
            {scope === 'open' ? 'Você não tem visitas para fazer' : 'Nenhuma visita concluída ainda'}
          </p>
          <p className="mx-auto mt-1 max-w-[460px] text-[13px] leading-relaxed text-[var(--ink-soft)]">
            {scope === 'open'
              ? 'Quando o escritório marcar uma visita na Agenda e escolher você como responsável, ela aparece aqui.'
              : 'As visitas que você concluir ficam guardadas aqui com anotações, fotos e assinatura.'}
          </p>
        </div>
      )}

      <div className={`flex flex-col gap-5 ${loading ? 'opacity-60' : ''}`}>
        {groups.map(([key, list]) => (
          <section key={key}>
            <h2
              className={`mb-2 text-[12.5px] font-bold tracking-wide uppercase ${
                key === '0000-00-00' ? 'text-[var(--red-500)]' : 'text-[var(--muted)]'
              }`}
            >
              {key === '0000-00-00' ? 'Atrasadas' : dayTitle(key, today)}
            </h2>
            <div className="flex flex-col gap-2.5">
              {list.map((visit) => {
                const person = visit.people?.name ?? visit.order?.people?.name ?? 'Sem cliente'
                return (
                  <button
                    key={visit.id}
                    type="button"
                    onClick={() => onOpenVisit(visit.id)}
                    className={`flex w-full items-center gap-3 rounded-2xl border border-[var(--border)] border-l-4 bg-[var(--surface)] p-4 text-left transition hover:bg-[var(--page)] ${
                      TYPE_TONES[visit.type] ?? ''
                    }`}
                  >
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1.5 text-[13px] font-bold text-[var(--ink)]">
                        <ClockIcon className="h-3.5 w-3.5 text-[var(--muted)]" />
                        {agendaTime(visit.scheduled_at)} · {typeLabel(visit.type)}
                        {visit.started_at && visit.status === 0 && (
                          <span className="rounded-full bg-[var(--green-100)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--green-600)]">
                            em atendimento
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 truncate text-[15px] font-semibold text-[var(--ink)]">{person}</p>
                      {visit.address && (
                        <p className="mt-0.5 flex items-center gap-1 truncate text-[12.5px] text-[var(--ink-soft)]">
                          <MapPinIcon className="h-3.5 w-3.5 flex-none" />
                          <span className="truncate">{visit.address}</span>
                        </p>
                      )}
                    </div>
                    <ChevronRightIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </div>
  )
}
