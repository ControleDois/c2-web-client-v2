import { Fragment, useCallback, useEffect, useState } from 'react'
import {
  fetchBillingRuns,
  fetchSendHistory,
  fetchSendHistoryDetail,
  SEND_STATUS_LABELS,
  type BillingRunsResponse,
  type SendHistoryDetail,
  type SendHistoryItem,
  type SendHistoryResponse,
} from '../lib/whatsappHistory'
import type { CompanyWhatsappRecord } from '../lib/companyWhatsapp'
import { ApiError } from '../lib/api'
import { formatPhone } from '../lib/formatPhone'
import { formatDate, formatDateTime } from '../lib/format'
import { SelectField } from '../components/form/SelectField'
import { ChevronLeftIcon, ChevronDownIcon, RefreshIcon, SearchIcon } from '../components/icons'
import type { AuthSession } from '../lib/auth'

interface WhatsappSendHistoryPageProps {
  session: AuthSession
  whatsapp: CompanyWhatsappRecord
  onBack: () => void
}

type Tab = 'messages' | 'billing'

const STATUS_STYLES: Record<number, string> = {
  0: 'bg-[var(--amber-100)] text-[var(--amber-500)]',
  1: 'bg-[var(--blue-100)] text-[var(--blue-700)]',
  2: 'bg-[var(--blue-100)] text-[var(--blue-700)]',
  3: 'bg-[var(--green-100)] text-[var(--green-600)]',
  4: 'bg-[var(--green-100)] text-[var(--green-600)]',
  5: 'bg-[var(--red-100)] text-[var(--red-500)]',
  6: 'bg-[var(--page)] text-[var(--ink-soft)]',
  7: 'bg-[var(--page)] text-[var(--ink-soft)]',
}

const TONE_STYLES = {
  ok: 'bg-[var(--green-600)]',
  info: 'bg-[var(--blue-500)]',
  warn: 'bg-[var(--amber-500)]',
  error: 'bg-[var(--red-500)]',
} as const

const MESSAGE_TYPE_LABELS: Record<string, string> = {
  pix_button: 'Botão PIX',
  boleto_document: 'Boleto (PDF)',
  document: 'Documento',
  image: 'Imagem',
}

function todayIso(): string {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${now.getFullYear()}-${month}-${day}`
}

function StatusBadge({ status }: { status: number }) {
  return (
    <span className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${STATUS_STYLES[status] ?? STATUS_STYLES[6]}`}>
      {SEND_STATUS_LABELS[status] ?? `Status ${status}`}
    </span>
  )
}

function Timeline({ detail }: { detail: SendHistoryDetail }) {
  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <ol className="flex flex-col">
        {detail.timeline.map((event, index) => (
          <li key={`${event.at}-${index}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <span className={`mt-1 h-2.5 w-2.5 flex-none rounded-full ${TONE_STYLES[event.tone]}`} />
              {index < detail.timeline.length - 1 && <span className="w-px flex-1 bg-[var(--border)]" />}
            </div>
            <div className="pb-4">
              <p className="text-[13px] font-bold text-[var(--ink)]">{event.title}</p>
              <p className="text-[11.5px] text-[var(--muted)]">{formatDateTime(event.at)}</p>
              {event.detail && (
                <p
                  className={`mt-1 whitespace-pre-wrap break-words text-[12.5px] ${
                    event.tone === 'error' ? 'font-medium text-[var(--red-500)]' : 'text-[var(--ink-soft)]'
                  }`}
                >
                  {event.detail}
                </p>
              )}
            </div>
          </li>
        ))}
      </ol>

      <div className="flex flex-col gap-3">
        {detail.message.last_error && (
          <div className="rounded-xl bg-[var(--red-100)] p-3.5">
            <p className="text-[11.5px] font-bold uppercase tracking-wide text-[var(--red-500)]">Último erro</p>
            <p className="mt-1 whitespace-pre-wrap break-words text-[12.5px] font-medium text-[var(--red-500)]">
              {detail.message.last_error}
            </p>
          </div>
        )}
        <div className="rounded-xl bg-[var(--page)] p-3.5">
          <p className="text-[11.5px] font-bold uppercase tracking-wide text-[var(--muted)]">Texto da mensagem</p>
          <p className="mt-1 whitespace-pre-wrap break-words text-[12.5px] text-[var(--ink)]">{detail.message.text}</p>
        </div>
      </div>
    </div>
  )
}

export function WhatsappSendHistoryPage({ session, whatsapp, onBack }: WhatsappSendHistoryPageProps) {
  const token = session.token.token
  const [tab, setTab] = useState<Tab>('messages')

  const [dateStart, setDateStart] = useState(todayIso())
  const [dateEnd, setDateEnd] = useState(todayIso())
  const [status, setStatus] = useState('all')
  const [origin, setOrigin] = useState('all')
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [reloadKey, setReloadKey] = useState(0)

  const [history, setHistory] = useState<SendHistoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [expandedId, setExpandedId] = useState<string | null>(null)
  const [details, setDetails] = useState<Record<string, SendHistoryDetail | 'loading' | 'error'>>({})

  const [runs, setRuns] = useState<BillingRunsResponse | null>(null)
  const [runsLoading, setRunsLoading] = useState(false)
  const [runsError, setRunsError] = useState<string | null>(null)

  useEffect(() => {
    const timeout = setTimeout(() => {
      setSearch(searchInput.trim())
      setPage(1)
    }, 400)
    return () => clearTimeout(timeout)
  }, [searchInput])

  useEffect(() => {
    if (tab !== 'messages') return
    let cancelled = false
    setLoading(true)
    setError(null)

    fetchSendHistory(token, whatsapp.id, { dateStart, dateEnd, status, origin, search, page })
      .then((res) => {
        if (!cancelled) setHistory(res)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Não foi possível carregar o histórico.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [tab, token, whatsapp.id, dateStart, dateEnd, status, origin, search, page, reloadKey])

  useEffect(() => {
    if (tab !== 'billing') return
    let cancelled = false
    setRunsLoading(true)
    setRunsError(null)

    fetchBillingRuns(token, whatsapp.id)
      .then((res) => {
        if (!cancelled) setRuns(res)
      })
      .catch((err) => {
        if (!cancelled) setRunsError(err instanceof ApiError ? err.message : 'Não foi possível carregar as execuções.')
      })
      .finally(() => {
        if (!cancelled) setRunsLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [tab, token, whatsapp.id, reloadKey])

  const toggleRow = useCallback(
    (item: SendHistoryItem) => {
      if (expandedId === item.id) {
        setExpandedId(null)
        return
      }
      setExpandedId(item.id)
      setDetails((current) => ({ ...current, [item.id]: 'loading' }))
      fetchSendHistoryDetail(token, whatsapp.id, item.id)
        .then((res) => setDetails((current) => ({ ...current, [item.id]: res })))
        .catch(() => setDetails((current) => ({ ...current, [item.id]: 'error' })))
    },
    [expandedId, token, whatsapp.id]
  )

  function applyStatus(value: string) {
    setStatus(value)
    setPage(1)
  }

  const summary = history?.summary
  const chips: { label: string; value: string; count: number }[] = summary
    ? [
        { label: 'Todas', value: 'all', count: summary.total },
        { label: 'Aguardando', value: '0', count: summary.pending + summary.processing },
        { label: 'Enviadas', value: '2', count: summary.sent },
        { label: 'Entregues', value: '3', count: summary.delivered },
        { label: 'Visualizadas', value: '4', count: summary.read },
        { label: 'Com erro', value: '5', count: summary.failed },
        { label: 'Canceladas', value: '6', count: summary.cancelled },
      ]
    : []

  // Dia atual sem nenhuma execução do cron de cobrança depois do horário de início.
  const today = todayIso()
  const noRunToday =
    runs?.enabled &&
    !runs.runs.some((run) => run.run_date === today) &&
    new Date().getHours() >= Number((runs.start_time || '08:00').split(':')[0] || 7)

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="mb-3 flex items-center gap-1 text-[12.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
          Voltar para WhatsApp API
        </button>
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">WhatsApp API</p>
            <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Histórico de envios</h1>
            <p className="mt-0.5 text-[13px] text-[var(--ink-soft)]">
              {whatsapp.name} · {formatPhone(whatsapp.phone)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="flex items-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2.5 text-[13px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]"
          >
            <RefreshIcon className="h-4 w-4" />
            Atualizar
          </button>
        </div>
      </div>

      <div className="flex gap-1 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-1.5 sm:w-fit">
        {([
          ['messages', 'Mensagens'],
          ['billing', 'Cobrança automática'],
        ] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`flex-1 rounded-xl px-5 py-2 text-[13.5px] font-bold transition sm:flex-none ${
              tab === value ? 'bg-[var(--blue-500)] text-white' : 'text-[var(--ink-soft)] hover:bg-[var(--page)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'messages' && (
        <>
          <div className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 sm:grid-cols-2 xl:grid-cols-5">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-[var(--ink-soft)]">De</span>
              <input
                type="date"
                value={dateStart}
                onChange={(event) => {
                  setDateStart(event.target.value)
                  setPage(1)
                }}
                className="rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)]"
              />
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Até</span>
              <input
                type="date"
                value={dateEnd}
                onChange={(event) => {
                  setDateEnd(event.target.value)
                  setPage(1)
                }}
                className="rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)]"
              />
            </label>
            <SelectField
              label="Origem"
              value={origin}
              onChange={(event) => {
                setOrigin(event.target.value)
                setPage(1)
              }}
            >
              <option value="all">Todas</option>
              <option value="automated">Automáticas (cobrança)</option>
              <option value="manual">Manuais</option>
            </SelectField>
            <SelectField label="Situação" value={status} onChange={(event) => applyStatus(event.target.value)}>
              <option value="all">Todas</option>
              {Object.entries(SEND_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Contato</span>
              <span className="relative">
                <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
                <input
                  type="text"
                  value={searchInput}
                  onChange={(event) => setSearchInput(event.target.value)}
                  placeholder="Nome ou telefone"
                  className="w-full rounded-xl bg-[var(--page)] py-2.5 pl-9 pr-3.5 text-[13.5px] text-[var(--ink)] ring-1 ring-transparent placeholder:text-[var(--muted)] focus:outline-none focus:ring-[var(--blue-300)]"
                />
              </span>
            </label>
          </div>

          {chips.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {chips.map((chip) => (
                <button
                  key={chip.value}
                  type="button"
                  onClick={() => applyStatus(chip.value)}
                  className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-bold transition ${
                    status === chip.value
                      ? 'bg-[var(--blue-500)] text-white'
                      : 'border border-[var(--border)] bg-[var(--surface)] text-[var(--ink-soft)] hover:text-[var(--ink)]'
                  } ${chip.value === '5' && chip.count > 0 && status !== chip.value ? 'text-[var(--red-500)]' : ''}`}
                >
                  {chip.label} <span className="opacity-80">{chip.count}</span>
                </button>
              ))}
            </div>
          )}

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            {loading && !history ? (
              <div className="flex flex-col gap-3 p-5">
                {Array.from({ length: 5 }).map((_, index) => (
                  <div key={index} className="h-12 animate-pulse rounded-xl bg-[var(--page)]" />
                ))}
              </div>
            ) : error ? (
              <p className="p-6 text-[13.5px] font-medium text-[var(--red-500)]">{error}</p>
            ) : !history || history.data.length === 0 ? (
              <p className="py-12 text-center text-[13.5px] text-[var(--muted)]">
                Nenhuma mensagem encontrada neste período. Se a cobrança automática deveria ter rodado hoje, veja a
                aba “Cobrança automática” para entender o motivo.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[860px] text-left">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-[11.5px] font-bold uppercase tracking-wide text-[var(--muted)]">
                      <th className="px-4 py-3">Contato</th>
                      <th className="px-4 py-3">Mensagem</th>
                      <th className="px-4 py-3">Situação</th>
                      <th className="px-4 py-3">Horários</th>
                      <th className="px-4 py-3" />
                    </tr>
                  </thead>
                  <tbody className={loading ? 'opacity-60' : ''}>
                    {history.data.map((item) => {
                      const expanded = expandedId === item.id
                      const detail = details[item.id]
                      return (
                        <Fragment key={item.id}>
                          <tr
                            onClick={() => toggleRow(item)}
                            className="cursor-pointer border-b border-[var(--border)] align-top transition hover:bg-[var(--page)]"
                          >
                            <td className="px-4 py-3">
                              <p className="text-[13.5px] font-bold text-[var(--ink)]">{item.contact_name || '—'}</p>
                              <p className="text-[12px] text-[var(--ink-soft)]">
                                {item.contact_phone ? formatPhone(item.contact_phone) : ''}
                              </p>
                            </td>
                            <td className="max-w-[320px] px-4 py-3">
                              <p className="truncate text-[12.5px] font-semibold text-[var(--ink)]">
                                {item.post_title || (item.is_automated ? 'Automática' : 'Envio manual')}
                                {item.message_type && MESSAGE_TYPE_LABELS[item.message_type] && (
                                  <span className="ml-2 rounded-full bg-[var(--blue-100)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--blue-700)]">
                                    {MESSAGE_TYPE_LABELS[item.message_type]}
                                  </span>
                                )}
                              </p>
                              <p className="mt-0.5 line-clamp-2 text-[12px] text-[var(--ink-soft)]">{item.text}</p>
                              {item.bill && (
                                <p className="mt-0.5 text-[11.5px] text-[var(--muted)]">
                                  {item.bill.name} · vence {formatDate(item.bill.date_due)}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3">
                              <StatusBadge status={item.status} />
                              {item.attempts > 0 && (
                                <p className="mt-1 text-[11.5px] text-[var(--muted)]">
                                  {item.attempts} tentativa{item.attempts > 1 ? 's' : ''}
                                </p>
                              )}
                              {item.last_error && item.status !== 2 && item.status !== 3 && item.status !== 4 && (
                                <p className="mt-1 max-w-[220px] truncate text-[11.5px] font-medium text-[var(--red-500)]" title={item.last_error}>
                                  {item.last_error}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-[12px] text-[var(--ink-soft)]">
                              <p>Agendada: {formatDateTime(item.scheduled_at || item.created_at)}</p>
                              {item.sent_at && <p>Enviada: {formatDateTime(item.sent_at)}</p>}
                              {item.delivered_at && <p>Entregue: {formatDateTime(item.delivered_at)}</p>}
                              {item.read_at && <p>Visualizada: {formatDateTime(item.read_at)}</p>}
                              {item.failed_at && <p className="text-[var(--red-500)]">Falhou: {formatDateTime(item.failed_at)}</p>}
                              {item.status === 0 && item.next_attempt_at && (
                                <p>Próxima tentativa: {formatDateTime(item.next_attempt_at)}</p>
                              )}
                            </td>
                            <td className="px-4 py-3 text-[var(--muted)]">
                              <ChevronDownIcon className={`h-4 w-4 transition-transform ${expanded ? 'rotate-180' : ''}`} />
                            </td>
                          </tr>
                          {expanded && (
                            <tr className="border-b border-[var(--border)] bg-[var(--page)]">
                              <td colSpan={5} className="px-5 py-5">
                                {detail === 'loading' || !detail ? (
                                  <p className="text-[13px] text-[var(--muted)]">Carregando linha do tempo…</p>
                                ) : detail === 'error' ? (
                                  <p className="text-[13px] font-medium text-[var(--red-500)]">
                                    Não foi possível carregar os detalhes desta mensagem.
                                  </p>
                                ) : (
                                  <Timeline detail={detail} />
                                )}
                              </td>
                            </tr>
                          )}
                        </Fragment>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {history && history.meta.last_page > 1 && (
              <div className="flex items-center justify-between border-t border-[var(--border)] px-4 py-3">
                <span className="text-[12.5px] text-[var(--ink-soft)]">
                  Página {history.meta.current_page} de {history.meta.last_page} · {history.meta.total} mensagens
                </span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={page <= 1}
                    onClick={() => setPage((current) => current - 1)}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12.5px] font-bold text-[var(--ink-soft)] disabled:opacity-40"
                  >
                    Anterior
                  </button>
                  <button
                    type="button"
                    disabled={page >= history.meta.last_page}
                    onClick={() => setPage((current) => current + 1)}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12.5px] font-bold text-[var(--ink-soft)] disabled:opacity-40"
                  >
                    Próxima
                  </button>
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {tab === 'billing' && (
        <div className="flex flex-col gap-4">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <h2 className="text-[14px] font-bold text-[var(--ink)]">Cobrança automática por WhatsApp</h2>
            <p className="mt-1 text-[12.5px] text-[var(--ink-soft)]">
              Todo dia às 07:00 (horário de Cuiabá) o sistema procura os títulos de cada regra e cria as mensagens. Aqui
              fica o resultado de cada regra: quantos títulos achou, quantas mensagens criou e o motivo quando não criou.
            </p>
            {runs && (
              <p className="mt-2 text-[12.5px] font-semibold text-[var(--ink)]">
                {runs.enabled ? `Ligada${runs.start_time ? ` · envios a partir das ${runs.start_time}` : ''}` : 'Desligada nas configurações'}
              </p>
            )}
          </div>

          {noRunToday && (
            <p className="rounded-2xl bg-[var(--amber-100)] px-4 py-3 text-[13px] font-medium text-[var(--amber-500)]">
              Não há nenhuma execução registrada hoje para esta empresa. O cron das 07:00 pode não ter rodado (servidor
              reiniciado ou parado nesse horário) ou parou antes de chegar nesta empresa.
            </p>
          )}

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)]">
            {runsLoading && !runs ? (
              <div className="h-24 animate-pulse rounded-2xl bg-[var(--page)]" />
            ) : runsError ? (
              <p className="p-6 text-[13.5px] font-medium text-[var(--red-500)]">{runsError}</p>
            ) : !runs || runs.runs.length === 0 ? (
              <p className="py-12 text-center text-[13.5px] text-[var(--muted)]">
                Nenhuma execução registrada nos últimos 14 dias. O registro começa a partir da próxima rodada do cron.
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] text-left">
                  <thead>
                    <tr className="border-b border-[var(--border)] text-[11.5px] font-bold uppercase tracking-wide text-[var(--muted)]">
                      <th className="px-4 py-3">Dia</th>
                      <th className="px-4 py-3">Regra</th>
                      <th className="px-4 py-3">Resultado</th>
                      <th className="px-4 py-3 text-right">Títulos</th>
                      <th className="px-4 py-3 text-right">Mensagens</th>
                      <th className="px-4 py-3">Motivo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {runs.runs.map((run) => (
                      <tr key={run.id} className="border-b border-[var(--border)] align-top">
                        <td className="px-4 py-3 text-[13px] text-[var(--ink)]">
                          {formatDate(run.run_date)}
                          <p className="text-[11.5px] text-[var(--muted)]">{formatDateTime(run.created_at)}</p>
                        </td>
                        <td className="px-4 py-3 text-[13px] font-semibold capitalize text-[var(--ink)]">{run.rule_label}</td>
                        <td className="px-4 py-3">
                          <span
                            className={`inline-flex rounded-full px-2.5 py-1 text-[11px] font-bold ${
                              run.status === 'created'
                                ? 'bg-[var(--green-100)] text-[var(--green-600)]'
                                : run.status === 'error'
                                  ? 'bg-[var(--red-100)] text-[var(--red-500)]'
                                  : 'bg-[var(--page)] text-[var(--ink-soft)]'
                            }`}
                          >
                            {run.status === 'created' ? 'Mensagens criadas' : run.status === 'error' ? 'Erro' : 'Não criou'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-right text-[13px] text-[var(--ink)]">{run.bills_found}</td>
                        <td className="px-4 py-3 text-right text-[13px] font-bold text-[var(--ink)]">{run.messages_created}</td>
                        <td
                          className={`max-w-[380px] px-4 py-3 text-[12.5px] ${
                            run.status === 'error' ? 'font-medium text-[var(--red-500)]' : 'text-[var(--ink-soft)]'
                          }`}
                        >
                          {run.reason || '—'}
                          {run.skipped_without_phone > 0 && !run.reason?.includes('telefone') && (
                            <p>{run.skipped_without_phone} sem telefone válido.</p>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
