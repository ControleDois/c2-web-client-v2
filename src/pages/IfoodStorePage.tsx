import { useCallback, useEffect, useState } from 'react'
import { ApiError } from '../lib/api'
import type { AuthCompany, AuthSession } from '../lib/auth'
import {
  createIfoodInterruption,
  deleteIfoodInterruption,
  fetchIfoodInterruptions,
  fetchIfoodMerchantAvailability,
  fetchIfoodMerchantDetails,
  fetchIfoodMerchants,
  fetchIfoodOpeningHours,
  saveIfoodOpeningHours,
  type IfoodInterruption,
  type IfoodMerchantRecord,
  type IfoodOpeningDay,
} from '../lib/ifood'
import { formatDateTime } from '../lib/format'
import { PlusIcon, TrashIcon } from '../components/icons'

interface IfoodStorePageProps {
  session: AuthSession
  company: AuthCompany
}

type Tab = 'info' | 'pauses' | 'hours'

const DAY_LABELS: Record<string, string> = {
  MONDAY: 'Segunda',
  TUESDAY: 'Terça',
  WEDNESDAY: 'Quarta',
  THURSDAY: 'Quinta',
  FRIDAY: 'Sexta',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
}
const DAY_ORDER = Object.keys(DAY_LABELS)
const EMPTY_DAYS: IfoodOpeningDay[] = DAY_ORDER.map((day) => ({ day, periods: [] }))

function Notice({ tone, children }: { tone: 'error' | 'ok'; children: React.ReactNode }) {
  const style = tone === 'error' ? 'bg-[var(--red-100)] text-[var(--red-500)]' : 'bg-[var(--green-100)] text-[var(--green-600)]'
  return <p className={`rounded-xl px-4 py-3 text-[13px] font-medium ${style}`}>{children}</p>
}

// Mostra qualquer resposta do iFood como "campo: valor", inclusive os níveis de dentro (endereço, operações...).
function Fields({ value, depth = 0 }: { value: unknown; depth?: number }) {
  if (value === null || value === undefined || value === '') return <span className="text-[var(--muted)]">—</span>
  if (typeof value !== 'object') return <span className="break-words text-[var(--ink)]">{String(value)}</span>
  const entries = Array.isArray(value) ? value.map((entry, index) => [String(index + 1), entry] as const) : Object.entries(value)
  return (
    <div className={`flex flex-col gap-1.5 ${depth ? 'border-l border-[var(--border)] pl-3' : ''}`}>
      {entries.map(([key, entry]) => (
        <div key={key} className="text-[13px]">
          <span className="font-semibold text-[var(--ink-soft)]">{key}: </span>
          <Fields value={entry} depth={depth + 1} />
        </div>
      ))}
    </div>
  )
}

// O iFood devolve as pausas sem fuso ("2026-10-16T13:46:00"), e o horário é UTC: sem isso a tela mostra 4 horas a mais.
function fromIfoodTime(value: string) {
  return /(Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

function toLocalInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function IfoodStorePage({ session, company }: IfoodStorePageProps) {
  const token = session.token.token
  const [merchants, setMerchants] = useState<IfoodMerchantRecord[]>([])
  const [merchantId, setMerchantId] = useState<string | null>(null)
  const [tab, setTab] = useState<Tab>('info')
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const [details, setDetails] = useState<Record<string, unknown> | null>(null)
  const [availability, setAvailability] = useState<unknown>(null)

  const [pauses, setPauses] = useState<IfoodInterruption[] | null>(null)
  const [reason, setReason] = useState('')
  const [pauseStart, setPauseStart] = useState(() => toLocalInput(new Date()))
  const [pauseEnd, setPauseEnd] = useState(() => toLocalInput(new Date(Date.now() + 60 * 60 * 1000)))

  const [days, setDays] = useState<IfoodOpeningDay[]>(EMPTY_DAYS)

  useEffect(() => {
    fetchIfoodMerchants(token, company.id)
      .then((list) => {
        const authorized = list.filter((merchant) => merchant.status === 'authorized')
        setMerchants(authorized)
        setMerchantId((current) => current ?? authorized[0]?.id ?? null)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as lojas.'))
      .finally(() => setLoading(false))
  }, [token, company.id])

  useEffect(() => {
    setDetails(null)
    setAvailability(null)
    setPauses(null)
    setDays(EMPTY_DAYS)
    setMessage(null)
    setError(null)
  }, [merchantId])

  const run = useCallback(async (action: () => Promise<string | void>) => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const done = await action()
      if (done) setMessage(done)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível concluir a ação.')
    } finally {
      setBusy(false)
    }
  }, [])

  const loadDetails = () =>
    run(async () => {
      if (!merchantId) return
      setDetails(await fetchIfoodMerchantDetails(token, merchantId))
      return 'Detalhes da loja consultados no iFood.'
    })

  const loadAvailability = () =>
    run(async () => {
      if (!merchantId) return
      setAvailability(await fetchIfoodMerchantAvailability(token, merchantId))
      return 'Disponibilidade consultada no iFood.'
    })

  const loadPauses = () =>
    run(async () => {
      if (!merchantId) return
      setPauses(await fetchIfoodInterruptions(token, merchantId))
    })

  // O iFood leva alguns segundos para refletir uma pausa nova ou removida na listagem: confere até 5 vezes.
  async function refreshPausesUntil(done: (list: IfoodInterruption[]) => boolean) {
    if (!merchantId) return
    let list: IfoodInterruption[] = []
    for (let attempt = 0; attempt < 5; attempt++) {
      await wait(attempt === 0 ? 1200 : 2000)
      list = await fetchIfoodInterruptions(token, merchantId)
      if (done(list)) break
    }
    setPauses(list)
  }

  const createPause = () =>
    run(async () => {
      if (!merchantId) return
      const description = reason.trim()
      await createIfoodInterruption(token, merchantId, {
        description,
        start: new Date(pauseStart).toISOString(),
        end: new Date(pauseEnd).toISOString(),
      })
      setReason('')
      await refreshPausesUntil((list) => list.some((pause) => pause.description === description))
      return 'Pausa cadastrada no iFood.'
    })

  const removePause = (id: string) =>
    run(async () => {
      if (!merchantId) return
      await deleteIfoodInterruption(token, merchantId, id)
      await refreshPausesUntil((list) => !list.some((pause) => pause.id === id))
      return 'Pausa removida no iFood.'
    })

  const loadHours = () =>
    run(async () => {
      if (!merchantId) return
      const data = await fetchIfoodOpeningHours(token, merchantId)
      setDays(DAY_ORDER.map((day) => data.days.find((entry) => entry.day === day) ?? { day, periods: [] }))
      return 'Horário consultado no iFood.'
    })

  const saveHours = () =>
    run(async () => {
      if (!merchantId) return
      const filled = days.map((entry) => ({
        ...entry,
        periods: entry.periods.filter((period) => period.start && period.end),
      }))
      await saveIfoodOpeningHours(token, merchantId, filled)
      return 'Horário salvo no iFood.'
    })

  function updatePeriod(day: string, index: number, patch: Partial<{ start: string; end: string }>) {
    setDays((current) =>
      current.map((entry) =>
        entry.day === day
          ? { ...entry, periods: entry.periods.map((period, i) => (i === index ? { ...period, ...patch } : period)) }
          : entry
      )
    )
  }

  const addPeriod = (day: string) =>
    setDays((current) =>
      current.map((entry) => (entry.day === day ? { ...entry, periods: [...entry.periods, { start: '', end: '' }] } : entry))
    )

  const removePeriod = (day: string, index: number) =>
    setDays((current) =>
      current.map((entry) => (entry.day === day ? { ...entry, periods: entry.periods.filter((_, i) => i !== index) } : entry))
    )

  if (loading) return <p className="p-8 text-[13.5px] text-[var(--muted)]">Carregando…</p>

  const button =
    'rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60'
  const input = 'rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] focus:outline-none'

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-500)] uppercase">Delivery</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Loja no iFood</h1>
        <p className="mt-1 max-w-[720px] text-[13px] text-[var(--ink-soft)]">
          Veja os dados da loja, a disponibilidade, cadastre pausas e o horário de funcionamento. Tudo o que você faz aqui
          vai direto para o iFood.
        </p>
      </div>

      {merchants.length === 0 ? (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6 text-[13.5px] text-[var(--ink-soft)]">
          Nenhuma loja do iFood vinculada ainda. Conecte a loja em Configurações → Integrações.
        </div>
      ) : (
        <>
          <div className="flex flex-wrap items-center gap-2">
            {merchants.map((merchant) => (
              <button
                key={merchant.id}
                type="button"
                onClick={() => setMerchantId(merchant.id)}
                className={`rounded-xl px-4 py-2 text-[13px] font-bold ${
                  merchant.id === merchantId
                    ? 'bg-[var(--blue-500)] text-white'
                    : 'bg-[var(--surface)] text-[var(--ink-soft)] ring-1 ring-[var(--border)]'
                }`}
              >
                {merchant.merchant_name || merchant.merchant_id}
              </button>
            ))}
          </div>

          <div className="flex gap-1 border-b border-[var(--border)]">
            {([
              ['info', 'Informações'],
              ['pauses', 'Pausas'],
              ['hours', 'Horário de funcionamento'],
            ] as const).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => {
                  setTab(key)
                  setMessage(null)
                  setError(null)
                }}
                className={`rounded-t-xl px-4 py-2.5 text-[13px] font-bold ${
                  tab === key ? 'bg-[var(--blue-500)] text-white' : 'text-[var(--ink-soft)] hover:bg-[var(--surface)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {error && <Notice tone="error">{error}</Notice>}
          {message && <Notice tone="ok">{message}</Notice>}

          {tab === 'info' && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={loadDetails} disabled={busy} className={button}>
                  Ver detalhes completos da loja
                </button>
                <button type="button" onClick={loadAvailability} disabled={busy} className={button}>
                  Consultar disponibilidade
                </button>
              </div>
              {details && (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                  <h2 className="mb-3 text-[14px] font-bold text-[var(--ink)]">Detalhes da loja</h2>
                  <Fields value={details} />
                </div>
              )}
              {availability !== null && (
                <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                  <h2 className="mb-3 text-[14px] font-bold text-[var(--ink)]">Disponibilidade</h2>
                  <Fields value={availability} />
                </div>
              )}
            </div>
          )}

          {tab === 'pauses' && (
            <div className="flex flex-col gap-4">
              <div className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 lg:grid-cols-[1fr_auto_auto_auto] lg:items-end">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Motivo da pausa</span>
                  <input value={reason} maxLength={120} onChange={(event) => setReason(event.target.value)} placeholder="Ex.: Pausa para manutenção" className={input} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Início</span>
                  <input type="datetime-local" value={pauseStart} onChange={(event) => setPauseStart(event.target.value)} className={input} />
                </label>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Fim</span>
                  <input type="datetime-local" value={pauseEnd} onChange={(event) => setPauseEnd(event.target.value)} className={input} />
                </label>
                <button type="button" onClick={createPause} disabled={busy || !reason.trim()} className={button}>
                  Cadastrar pausa
                </button>
              </div>

              <div>
                <button type="button" onClick={loadPauses} disabled={busy} className={button}>
                  Listar pausas ativas
                </button>
              </div>

              {pauses && (
                <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
                  {pauses.length === 0 ? (
                    <p className="py-10 text-center text-[13.5px] text-[var(--muted)]">Nenhuma pausa ativa.</p>
                  ) : (
                    <ul className="divide-y divide-[var(--border)]">
                      {pauses.map((pause) => (
                        <li key={pause.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                          <div className="min-w-0 flex-1">
                            <p className="text-[14px] font-bold text-[var(--ink)]">{pause.description || 'Pausa'}</p>
                            <p className="text-[12.5px] text-[var(--ink-soft)]">
                              {formatDateTime(fromIfoodTime(pause.start))} até {formatDateTime(fromIfoodTime(pause.end))}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => removePause(pause.id)}
                            disabled={busy}
                            className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-bold text-[var(--red-500)] hover:bg-[var(--red-100)] disabled:opacity-60"
                          >
                            <TrashIcon className="h-4 w-4" />
                            Remover pausa
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}
            </div>
          )}

          {tab === 'hours' && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap gap-3">
                <button type="button" onClick={loadHours} disabled={busy} className={button}>
                  Consultar horários
                </button>
                <button type="button" onClick={saveHours} disabled={busy} className={button}>
                  Salvar no iFood
                </button>
              </div>
              <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
                <ul className="divide-y divide-[var(--border)]">
                  {days.map((entry) => (
                    <li key={entry.day} className="flex flex-wrap items-start gap-4 px-4 py-3.5">
                      <p className="w-24 pt-2 text-[14px] font-bold text-[var(--ink)]">{DAY_LABELS[entry.day]}</p>
                      <div className="flex flex-1 flex-col gap-2">
                        {entry.periods.length === 0 && <p className="pt-2 text-[13px] text-[var(--muted)]">Fechado</p>}
                        {entry.periods.map((period, index) => (
                          <div key={index} className="flex items-center gap-2">
                            <input type="time" value={period.start} onChange={(event) => updatePeriod(entry.day, index, { start: event.target.value })} className={input} />
                            <span className="text-[13px] text-[var(--muted)]">às</span>
                            <input type="time" value={period.end} onChange={(event) => updatePeriod(entry.day, index, { end: event.target.value })} className={input} />
                            <button type="button" onClick={() => removePeriod(entry.day, index)} aria-label="Remover período" className="rounded-lg p-2 text-[var(--red-500)] hover:bg-[var(--red-100)]">
                              <TrashIcon className="h-4 w-4" />
                            </button>
                          </div>
                        ))}
                      </div>
                      <button type="button" onClick={() => addPeriod(entry.day)} className="flex items-center gap-1.5 rounded-lg px-3 py-2 text-[12.5px] font-bold text-[var(--blue-500)] hover:bg-[var(--page)]">
                        <PlusIcon className="h-4 w-4" />
                        Período
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
