import { useCallback, useEffect, useMemo, useState } from 'react'
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
import { PlusIcon, RefreshIcon, TrashIcon } from '../components/icons'
import {
  PageHeader,
  Panel,
  Pill,
  Tip,
  buttonDanger,
  buttonPrimary,
  buttonSecondary,
  friendlyIfoodMessage,
  inputClass,
} from '../components/ifood/ui'

interface IfoodStorePageProps {
  session: AuthSession
  company: AuthCompany
}

const DAY_LABELS: Record<string, string> = {
  MONDAY: 'Segunda-feira',
  TUESDAY: 'Terça-feira',
  WEDNESDAY: 'Quarta-feira',
  THURSDAY: 'Quinta-feira',
  FRIDAY: 'Sexta-feira',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
}
const DAY_ORDER = Object.keys(DAY_LABELS)
const EMPTY_DAYS: IfoodOpeningDay[] = DAY_ORDER.map((day) => ({ day, periods: [] }))

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// O iFood devolve as pausas sem fuso ("2026-10-16T13:46:00") e o horário é UTC.
function fromIfoodTime(value: string) {
  return /(Z|[+-]\d{2}:\d{2})$/.test(value) ? value : `${value}Z`
}

function clock(value: string) {
  return new Date(fromIfoodTime(value)).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
}

function dayAndClock(value: string) {
  const date = new Date(fromIfoodTime(value))
  const today = new Date()
  const sameDay = date.toDateString() === today.toDateString()
  const time = date.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
  return sameDay ? `hoje às ${time}` : `${date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })} às ${time}`
}

function toLocalInput(date: Date) {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function tomorrowMorning() {
  const date = new Date()
  date.setDate(date.getDate() + 1)
  date.setHours(6, 0, 0, 0)
  return date
}

const QUICK_PAUSES: { label: string; hint: string; end: () => Date }[] = [
  { label: '30 minutos', hint: 'Um respiro rápido', end: () => new Date(Date.now() + 30 * 60_000) },
  { label: '1 hora', hint: 'Cozinha cheia', end: () => new Date(Date.now() + 60 * 60_000) },
  { label: '2 horas', hint: 'Falta de gente ou insumo', end: () => new Date(Date.now() + 120 * 60_000) },
  { label: 'Até amanhã cedo', hint: 'Fechar por hoje', end: tomorrowMorning },
]

// Resume o que o iFood respondeu sobre a disponibilidade em frases simples.
interface Check {
  id: string
  ok: boolean
  title: string
  hint?: string
}

function summarizeAvailability(raw: unknown): { open: boolean; headline: string; checks: Check[] } | null {
  if (raw === null || raw === undefined) return null
  const list: any[] = Array.isArray(raw) ? raw : [raw]
  const main = list.find((entry) => entry?.operation === 'delivery') ?? list[0]
  if (!main) return null

  const checks: Check[] = (Array.isArray(main.validations) ? main.validations : []).map((validation: any) => {
    const id = String(validation.id || '')
    const ok = String(validation.state || '').toUpperCase() === 'OK'
    const original = String(validation.message?.title || id)

    if (/connected/i.test(id)) {
      return ok
        ? { id, ok, title: 'O sistema está conectado ao iFood' }
        : {
            id,
            ok,
            title: 'O iFood não está recebendo sinal do seu sistema',
            hint: 'Deixe o sistema aberto e com internet. Se continuar assim por bastante tempo, chame o suporte.',
          }
    }
    if (/opening/i.test(id)) {
      return ok
        ? { id, ok, title: 'Dentro do horário de funcionamento' }
        : { id, ok, title: 'Fora do horário de funcionamento', hint: 'Confira os dias e horas no cartão "Horário de funcionamento".' }
    }
    if (/interrupt|pause/i.test(id)) {
      return ok
        ? { id, ok, title: 'Sem pausa ativa' }
        : { id, ok, title: 'A loja está pausada', hint: 'Toque em "Voltar a vender agora" no cartão de pausa.' }
    }
    return { id, ok, title: original, hint: ok ? undefined : String(validation.message?.subtitle || '') || undefined }
  })

  const open = main.available === true
  return {
    open,
    headline: open ? 'Sua loja está aberta para pedidos no iFood' : 'Sua loja está fechada no iFood',
    checks,
  }
}

function addressLine(address: any) {
  if (!address) return null
  return [address.street, address.number, address.district, [address.city, address.state].filter(Boolean).join(' - ')]
    .filter(Boolean)
    .join(', ')
}

// Dados completos da loja, com os nomes em português e o resto (técnico) escondido.
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

function DetailRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-0.5 rounded-xl bg-[var(--page)] px-4 py-3">
      <span className="text-[11.5px] font-bold tracking-wide text-[var(--muted)] uppercase">{label}</span>
      <span className="text-[14px] text-[var(--ink)]">{children}</span>
    </div>
  )
}

export function IfoodStorePage({ session, company }: IfoodStorePageProps) {
  const token = session.token.token
  const [merchants, setMerchants] = useState<IfoodMerchantRecord[]>([])
  const [merchantId, setMerchantId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  const [checking, setChecking] = useState(false)
  const [details, setDetails] = useState<Record<string, any> | null>(null)
  const [availability, setAvailability] = useState<unknown>(null)
  const [availabilityError, setAvailabilityError] = useState<string | null>(null)
  const [showAllDetails, setShowAllDetails] = useState(false)
  const [showDetails, setShowDetails] = useState(false)

  const [pauses, setPauses] = useState<IfoodInterruption[] | null>(null)
  const [reason, setReason] = useState('')
  const [customPause, setCustomPause] = useState(false)
  const [pauseStart, setPauseStart] = useState(() => toLocalInput(new Date()))
  const [pauseEnd, setPauseEnd] = useState(() => toLocalInput(new Date(Date.now() + 60 * 60_000)))

  const [hours, setHours] = useState<IfoodOpeningDay[] | null>(null)
  const [editingHours, setEditingHours] = useState(false)
  const [draft, setDraft] = useState<IfoodOpeningDay[]>(EMPTY_DAYS)

  useEffect(() => {
    fetchIfoodMerchants(token, company.id)
      .then((list) => {
        const authorized = list.filter((merchant) => merchant.status === 'authorized')
        setMerchants(authorized)
        setMerchantId((current) => current ?? authorized[0]?.id ?? null)
      })
      .catch((err) => setError(err instanceof ApiError ? friendlyIfoodMessage(err.message) : 'Não foi possível carregar as lojas.'))
      .finally(() => setLoading(false))
  }, [token, company.id])

  const refreshAll = useCallback(
    async (id: string) => {
      setChecking(true)
      setAvailabilityError(null)
      const [availabilityResult, detailsResult, pausesResult, hoursResult] = await Promise.allSettled([
        fetchIfoodMerchantAvailability(token, id),
        fetchIfoodMerchantDetails(token, id),
        fetchIfoodInterruptions(token, id),
        fetchIfoodOpeningHours(token, id),
      ])
      if (availabilityResult.status === 'fulfilled') setAvailability(availabilityResult.value)
      else setAvailabilityError(friendlyIfoodMessage(availabilityResult.reason?.message))
      if (detailsResult.status === 'fulfilled') setDetails(detailsResult.value)
      if (pausesResult.status === 'fulfilled') setPauses(pausesResult.value)
      if (hoursResult.status === 'fulfilled') {
        setHours(DAY_ORDER.map((day) => hoursResult.value.days.find((entry) => entry.day === day) ?? { day, periods: [] }))
      }
      setChecking(false)
    },
    [token]
  )

  useEffect(() => {
    setDetails(null)
    setAvailability(null)
    setPauses(null)
    setHours(null)
    setEditingHours(false)
    setMessage(null)
    setError(null)
    if (merchantId) void refreshAll(merchantId)
  }, [merchantId, refreshAll])

  const run = useCallback(async (action: () => Promise<string | void>) => {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      const done = await action()
      if (done) setMessage(done)
    } catch (err) {
      setError(err instanceof ApiError ? friendlyIfoodMessage(err.message) : 'Não foi possível concluir. Tente de novo.')
    } finally {
      setBusy(false)
    }
  }, [])

  const summary = useMemo(() => summarizeAvailability(availability), [availability])

  const activePauses = useMemo(
    () => (pauses ?? []).filter((pause) => new Date(fromIfoodTime(pause.end)).getTime() > Date.now()),
    [pauses]
  )

  // O iFood leva alguns segundos para mostrar a pausa nova ou a removida: confere até 5 vezes.
  async function refreshPausesUntil(done: (list: IfoodInterruption[]) => boolean) {
    if (!merchantId) return
    let list: IfoodInterruption[] = []
    for (let attempt = 0; attempt < 5; attempt++) {
      await wait(attempt === 0 ? 1200 : 2000)
      list = await fetchIfoodInterruptions(token, merchantId)
      if (done(list)) break
    }
    setPauses(list)
    setAvailability(await fetchIfoodMerchantAvailability(token, merchantId).catch(() => availability))
  }

  const startPause = (start: Date, end: Date) =>
    run(async () => {
      if (!merchantId) return
      const description = (reason.trim() || 'Pausa pelo sistema').slice(0, 120)
      await createIfoodInterruption(token, merchantId, { description, start: start.toISOString(), end: end.toISOString() })
      setReason('')
      await refreshPausesUntil((list) => list.some((pause) => pause.description === description))
      return `Pronto! As vendas estão pausadas até ${end.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}.`
    })

  const removePause = (id: string) =>
    run(async () => {
      if (!merchantId) return
      await deleteIfoodInterruption(token, merchantId, id)
      await refreshPausesUntil((list) => !list.some((pause) => pause.id === id))
      return 'Pronto! A pausa foi removida e a loja volta a vender.'
    })

  function openHoursEditor() {
    setDraft((hours ?? EMPTY_DAYS).map((entry) => ({ ...entry, periods: entry.periods.map((period) => ({ ...period })) })))
    setEditingHours(true)
    setMessage(null)
  }

  const saveHours = () =>
    run(async () => {
      if (!merchantId) return
      const cleaned = draft.map((entry) => ({ ...entry, periods: entry.periods.filter((period) => period.start && period.end) }))
      await saveIfoodOpeningHours(token, merchantId, cleaned)
      setHours(cleaned)
      setEditingHours(false)
      return 'Pronto! O novo horário já está salvo no iFood.'
    })

  const updatePeriod = (day: string, index: number, patch: Partial<{ start: string; end: string }>) =>
    setDraft((current) =>
      current.map((entry) =>
        entry.day === day
          ? { ...entry, periods: entry.periods.map((period, i) => (i === index ? { ...period, ...patch } : period)) }
          : entry
      )
    )

  const setDayOpen = (day: string, open: boolean) =>
    setDraft((current) =>
      current.map((entry) =>
        entry.day === day ? { ...entry, periods: open ? [{ start: '08:00', end: '18:00' }] : [] } : entry
      )
    )

  const addPeriod = (day: string) =>
    setDraft((current) =>
      current.map((entry) => (entry.day === day ? { ...entry, periods: [...entry.periods, { start: '', end: '' }] } : entry))
    )

  const removePeriod = (day: string, index: number) =>
    setDraft((current) =>
      current.map((entry) => (entry.day === day ? { ...entry, periods: entry.periods.filter((_, i) => i !== index) } : entry))
    )

  const copyToAll = (day: string) =>
    setDraft((current) => {
      const source = current.find((entry) => entry.day === day)
      return current.map((entry) => ({ ...entry, periods: (source?.periods ?? []).map((period) => ({ ...period })) }))
    })

  if (loading) return <p className="p-8 text-[14px] text-[var(--muted)]">Carregando…</p>

  const merchant = merchants.find((entry) => entry.id === merchantId)

  return (
    <div className="mx-auto flex w-full max-w-[1000px] flex-col gap-5 p-4 sm:p-6 lg:p-8">
      <PageHeader eyebrow="Delivery" title="Loja no iFood">
        Aqui você vê se a sua loja está aberta no iFood, pausa as vendas quando precisar e muda o horário de funcionamento.
        O que você fizer aqui vale na hora no aplicativo do iFood.
      </PageHeader>

      {merchants.length === 0 ? (
        <Panel title="Nenhuma loja do iFood conectada ainda" help="Para usar esta tela, primeiro conecte a sua loja ao iFood.">
          <Tip title="Como conectar">
            Vá em <strong>Configurações → Integrações</strong>, informe o código da sua loja e toque em conectar.
          </Tip>
        </Panel>
      ) : (
        <>
          {merchants.length > 1 && (
            <div>
              <p className="mb-2 text-[13px] font-semibold text-[var(--ink-soft)]">Escolha a loja</p>
              <div className="flex flex-wrap gap-2">
                {merchants.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setMerchantId(entry.id)}
                    className={`rounded-xl px-4 py-2.5 text-[14px] font-bold ${
                      entry.id === merchantId
                        ? 'bg-[var(--blue-500)] text-white'
                        : 'bg-[var(--surface)] text-[var(--ink-soft)] ring-1 ring-[var(--border)]'
                    }`}
                  >
                    {entry.merchant_name || entry.merchant_id}
                  </button>
                ))}
              </div>
            </div>
          )}

          {error && <Tip tone="bad" title="Não deu certo">{error}</Tip>}
          {message && <Tip tone="good">{message}</Tip>}

          {/* Situação da loja agora */}
          <section
            className={`rounded-2xl border p-5 sm:p-6 ${
              !summary
                ? 'border-[var(--border)] bg-[var(--surface)]'
                : summary.open
                  ? 'border-[var(--green-600)]/25 bg-[var(--green-100)]'
                  : 'border-[var(--red-500)]/25 bg-[var(--red-100)]'
            }`}
          >
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="flex items-start gap-4">
                <span className="flex h-14 w-14 flex-none items-center justify-center rounded-full bg-[var(--surface)] text-[26px]">
                  {!summary ? '⏳' : summary.open ? '✅' : '⛔'}
                </span>
                <div>
                  <p className="text-[12px] font-bold tracking-wide text-[var(--ink-soft)] uppercase">
                    {merchant?.merchant_name || 'Sua loja'}
                  </p>
                  <h2 className="text-[19px] font-bold text-[var(--ink)]">
                    {summary ? summary.headline : availabilityError ? 'Não foi possível consultar o iFood' : 'Consultando o iFood…'}
                  </h2>
                  {availabilityError && <p className="mt-1 text-[13.5px] text-[var(--red-500)]">{availabilityError}</p>}
                </div>
              </div>
              <button
                type="button"
                onClick={() => merchantId && refreshAll(merchantId)}
                disabled={checking}
                className={buttonSecondary + ' bg-[var(--surface)]'}
              >
                <RefreshIcon className="h-4 w-4" />
                {checking ? 'Atualizando…' : 'Atualizar'}
              </button>
            </div>

            {summary && summary.checks.length > 0 && (
              <ul className="mt-4 flex flex-col gap-2">
                {summary.checks.map((check) => (
                  <li key={check.id} className="rounded-xl bg-[var(--surface)] px-4 py-3">
                    <p className="flex items-center gap-2 text-[14px] font-semibold text-[var(--ink)]">
                      <span>{check.ok ? '✔️' : '❗'}</span>
                      {check.title}
                    </p>
                    {check.hint && <p className="mt-1 pl-7 text-[13px] text-[var(--ink-soft)]">O que fazer: {check.hint}</p>}
                  </li>
                ))}
              </ul>
            )}
          </section>

          <div className="grid gap-5 lg:grid-cols-2">
            {/* Pausa */}
            <Panel
              title="Pausar as vendas por um tempo"
              help="Use quando precisar de um tempo sem receber pedidos. Passado o tempo, a loja volta a vender sozinha."
            >
              {activePauses.length > 0 && (
                <div className="mb-4 flex flex-col gap-2">
                  {activePauses.map((pause) => (
                    <div key={pause.id} className="rounded-xl bg-[var(--amber-100)] px-4 py-3.5">
                      <p className="text-[14px] font-bold text-[var(--amber-500)]">
                        Loja pausada até {clock(pause.end)}
                      </p>
                      <p className="mt-0.5 text-[13px] text-[var(--ink-soft)]">
                        {pause.description || 'Pausa'} · de {dayAndClock(pause.start)} até {dayAndClock(pause.end)}
                      </p>
                      <button type="button" onClick={() => removePause(pause.id)} disabled={busy} className={buttonDanger + ' mt-3 bg-[var(--surface)]'}>
                        <TrashIcon className="h-4 w-4" />
                        Voltar a vender agora
                      </button>
                    </div>
                  ))}
                </div>
              )}

              <label className="mb-3 flex flex-col gap-1.5">
                <span className="text-[13px] font-semibold text-[var(--ink-soft)]">Motivo (opcional)</span>
                <input
                  value={reason}
                  maxLength={120}
                  onChange={(event) => setReason(event.target.value)}
                  placeholder="Ex.: Cozinha cheia"
                  className={inputClass}
                />
              </label>

              <p className="mb-2 text-[13px] font-semibold text-[var(--ink-soft)]">Por quanto tempo?</p>
              <div className="grid grid-cols-2 gap-2">
                {QUICK_PAUSES.map((option) => (
                  <button
                    key={option.label}
                    type="button"
                    disabled={busy}
                    onClick={() => startPause(new Date(), option.end())}
                    className="rounded-xl bg-[var(--page)] px-3 py-3 text-left transition hover:ring-2 hover:ring-[var(--blue-300)] disabled:opacity-50"
                  >
                    <span className="block text-[14.5px] font-bold text-[var(--ink)]">{option.label}</span>
                    <span className="block text-[12px] text-[var(--muted)]">{option.hint}</span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setCustomPause((current) => !current)}
                className="mt-3 text-[13px] font-bold text-[var(--blue-700)] hover:underline"
              >
                {customPause ? 'Esconder' : 'Escolher dia e hora'}
              </button>
              {customPause && (
                <div className="mt-3 grid gap-3 rounded-xl bg-[var(--page)] p-4">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[13px] font-semibold text-[var(--ink-soft)]">Começa em</span>
                    <input type="datetime-local" value={pauseStart} onChange={(event) => setPauseStart(event.target.value)} className={inputClass + ' bg-[var(--surface)]'} />
                  </label>
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[13px] font-semibold text-[var(--ink-soft)]">Termina em</span>
                    <input type="datetime-local" value={pauseEnd} onChange={(event) => setPauseEnd(event.target.value)} className={inputClass + ' bg-[var(--surface)]'} />
                  </label>
                  <button
                    type="button"
                    disabled={busy || !pauseStart || !pauseEnd}
                    onClick={() => startPause(new Date(pauseStart), new Date(pauseEnd))}
                    className={buttonPrimary}
                  >
                    Cadastrar pausa
                  </button>
                </div>
              )}

              {pauses && pauses.length === 0 && (
                <p className="mt-4 text-[13px] text-[var(--muted)]">Nenhuma pausa ativa no momento.</p>
              )}
            </Panel>

            {/* Horário */}
            <div className={editingHours ? 'lg:col-span-2' : ''}>
            <Panel
              title="Horário de funcionamento"
              help="É o horário em que o iFood mostra a sua loja aberta para os clientes."
              action={
                !editingHours && hours ? (
                  <button type="button" onClick={openHoursEditor} className={buttonSecondary}>
                    Alterar horário
                  </button>
                ) : undefined
              }
            >
              {!hours && <p className="text-[13.5px] text-[var(--muted)]">Consultando o horário no iFood…</p>}

              {hours && !editingHours && (
                <ul className="flex flex-col divide-y divide-[var(--border)]">
                  {hours.map((entry) => (
                    <li key={entry.day} className="flex items-start justify-between gap-3 py-2.5 text-[14px]">
                      <span className="font-semibold text-[var(--ink)]">{DAY_LABELS[entry.day]}</span>
                      <span className="text-right text-[var(--ink-soft)]">
                        {entry.periods.length === 0
                          ? 'Fechado'
                          : entry.periods.map((period) => `${period.start} às ${period.end}`).join(' · ')}
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {hours && editingHours && (
                <div className="flex flex-col gap-3">
                  <Tip>
                    Escolha <strong>Aberto</strong> ou <strong>Fechado</strong> em cada dia. Se o dia tem intervalo (por
                    exemplo, almoço), toque em "Adicionar outro horário".
                  </Tip>
                  {draft.map((entry) => {
                    const open = entry.periods.length > 0
                    return (
                      <div key={entry.day} className="rounded-xl bg-[var(--page)] p-3.5">
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <p className="text-[14.5px] font-bold text-[var(--ink)]">{DAY_LABELS[entry.day]}</p>
                          <div className="flex rounded-lg bg-[var(--surface)] p-0.5">
                            <button
                              type="button"
                              onClick={() => !open && setDayOpen(entry.day, true)}
                              className={`rounded-md px-3 py-1.5 text-[13px] font-bold ${open ? 'bg-[var(--green-600)] text-white' : 'text-[var(--ink-soft)]'}`}
                            >
                              Aberto
                            </button>
                            <button
                              type="button"
                              onClick={() => open && setDayOpen(entry.day, false)}
                              className={`rounded-md px-3 py-1.5 text-[13px] font-bold ${!open ? 'bg-[var(--ink-soft)] text-white' : 'text-[var(--ink-soft)]'}`}
                            >
                              Fechado
                            </button>
                          </div>
                        </div>

                        {open && (
                          <div className="mt-3 flex flex-col gap-2">
                            {entry.periods.map((period, index) => (
                              <div key={index} className="flex flex-wrap items-center gap-2">
                                <input type="time" value={period.start} onChange={(event) => updatePeriod(entry.day, index, { start: event.target.value })} className={inputClass + ' !w-auto bg-[var(--surface)]'} />
                                <span className="text-[13px] text-[var(--muted)]">até</span>
                                <input type="time" value={period.end} onChange={(event) => updatePeriod(entry.day, index, { end: event.target.value })} className={inputClass + ' !w-auto bg-[var(--surface)]'} />
                                {entry.periods.length > 1 && (
                                  <button type="button" onClick={() => removePeriod(entry.day, index)} aria-label="Tirar este horário" className="rounded-lg p-2 text-[var(--red-500)] hover:bg-[var(--red-100)]">
                                    <TrashIcon className="h-4 w-4" />
                                  </button>
                                )}
                              </div>
                            ))}
                            <div className="flex flex-wrap gap-4">
                              <button type="button" onClick={() => addPeriod(entry.day)} className="flex items-center gap-1.5 text-[13px] font-bold text-[var(--blue-700)] hover:underline">
                                <PlusIcon className="h-4 w-4" />
                                Adicionar outro horário
                              </button>
                              <button type="button" onClick={() => copyToAll(entry.day)} className="text-[13px] font-bold text-[var(--blue-700)] hover:underline">
                                Usar este horário em todos os dias
                              </button>
                            </div>
                          </div>
                        )}
                      </div>
                    )
                  })}
                  <div className="flex flex-wrap gap-3">
                    <button type="button" onClick={saveHours} disabled={busy} className={buttonPrimary}>
                      {busy ? 'Salvando…' : 'Salvar horário no iFood'}
                    </button>
                    <button type="button" onClick={() => setEditingHours(false)} disabled={busy} className={buttonSecondary}>
                      Cancelar
                    </button>
                  </div>
                </div>
              )}
            </Panel>
            </div>
          </div>

          {/* Dados da loja */}
          <Panel
            title="Dados da loja no iFood"
            help="É o cadastro que o iFood tem da sua loja. Se algo estiver errado aqui, o ajuste é feito no Portal do Parceiro do iFood."
            action={
              <button type="button" onClick={() => setShowDetails((current) => !current)} className={buttonSecondary}>
                {showDetails ? 'Esconder dados' : 'Ver dados da loja'}
              </button>
            }
          >
            {!showDetails && <p className="text-[13.5px] text-[var(--muted)]">Toque em "Ver dados da loja" para conferir o cadastro.</p>}
            {showDetails && !details && <p className="text-[13.5px] text-[var(--muted)]">Consultando o iFood…</p>}
            {showDetails && details && (
              <div className="flex flex-col gap-3">
                <div className="grid gap-2 sm:grid-cols-2">
                  <DetailRow label="Nome da loja">{details.name || '—'}</DetailRow>
                  <DetailRow label="Razão social">{details.corporateName || '—'}</DetailRow>
                  <DetailRow label="Endereço">{addressLine(details.address) || '—'}</DetailRow>
                  <DetailRow label="CEP">{details.address?.postalCode || '—'}</DetailRow>
                  <DetailRow label="Ticket médio">{details.averageTicket ? `R$ ${details.averageTicket}` : '—'}</DetailRow>
                  <DetailRow label="Código da loja no iFood">{details.id || '—'}</DetailRow>
                  <DetailRow label="Situação do cadastro">
                    <Pill tone={String(details.status).toUpperCase() === 'ENABLED' ? 'good' : 'neutral'}>{String(details.status || '—')}</Pill>
                  </DetailRow>
                  <DetailRow label="Loja de teste">{details.test ? 'Sim' : 'Não'}</DetailRow>
                </div>
                <button type="button" onClick={() => setShowAllDetails((current) => !current)} className="self-start text-[13px] font-bold text-[var(--blue-700)] hover:underline">
                  {showAllDetails ? 'Esconder os detalhes completos' : 'Ver detalhes completos da loja'}
                </button>
                {showAllDetails && (
                  <div className="rounded-xl bg-[var(--page)] p-4">
                    <Fields value={details} />
                  </div>
                )}
              </div>
            )}
          </Panel>
        </>
      )}
    </div>
  )
}
