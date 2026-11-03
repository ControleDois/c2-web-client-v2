import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  AI_SOURCE_LABELS,
  createAiCredit,
  deleteAiCredit,
  fetchAiCompanyUsage,
  fetchAiCredits,
  fetchAiUsageSummary,
  formatUsd,
  type AiCompanyDetail,
  type AiCompanyUsage,
  type AiCredit,
  type AiUsageSummary,
} from '../lib/aiUsage'
import { ApiError } from '../lib/api'
import { formatCurrency, formatDate, formatDateTime } from '../lib/format'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { PlusIcon, RefreshIcon, TrashIcon } from '../components/icons'
import type { AuthSession } from '../lib/auth'

interface AiUsagePageProps {
  session: AuthSession
}

function isoDay(date: Date) {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function formatTokens(value: number) {
  return new Intl.NumberFormat('pt-BR', { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

const inputClass =
  'w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)]'

function StatCard({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: 'danger' | 'warning' }) {
  const toneClass =
    tone === 'danger' ? 'text-[var(--red-500)]' : tone === 'warning' ? 'text-[var(--amber-500)]' : 'text-[var(--ink)]'
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-[12px] font-semibold text-[var(--muted)]">{label}</p>
      <p className={`mt-1 text-[22px] font-bold tracking-tight tabular-nums ${toneClass}`}>{value}</p>
      {hint && <p className="mt-0.5 text-[12px] text-[var(--ink-soft)]">{hint}</p>}
    </div>
  )
}

// Saldo central de IA da matriz: o que foi comprado na Anthropic, quanto os agentes de todas
// as empresas já gastaram e quem está gastando (empresa, agente e número de WhatsApp).
export function AiUsagePage({ session }: AiUsagePageProps) {
  const token = session.token.token
  const [start, setStart] = useState(() => {
    const now = new Date()
    return isoDay(new Date(now.getFullYear(), now.getMonth(), 1))
  })
  const [end, setEnd] = useState(() => isoDay(new Date()))
  const [summary, setSummary] = useState<AiUsageSummary | null>(null)
  const [credits, setCredits] = useState<AiCredit[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [creditFormOpen, setCreditFormOpen] = useState(false)
  const [creditAmount, setCreditAmount] = useState('')
  const [creditDate, setCreditDate] = useState(() => isoDay(new Date()))
  const [creditNote, setCreditNote] = useState('')
  const [creditSaving, setCreditSaving] = useState(false)
  const [creditError, setCreditError] = useState<string | null>(null)
  const [creditToDelete, setCreditToDelete] = useState<AiCredit | null>(null)
  const [deleting, setDeleting] = useState(false)

  const [openCompanyId, setOpenCompanyId] = useState<string | null>(null)
  const [detail, setDetail] = useState<AiCompanyDetail | null>(null)
  const [detailPage, setDetailPage] = useState(1)
  const [detailLoading, setDetailLoading] = useState(false)

  const load = useCallback(() => {
    setLoading(true)
    setError(null)
    Promise.all([fetchAiUsageSummary(token, start, end), fetchAiCredits(token)])
      .then(([summaryResult, creditsResult]) => {
        setSummary(summaryResult)
        setCredits(creditsResult)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível carregar o consumo de IA.'))
      .finally(() => setLoading(false))
  }, [token, start, end])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!openCompanyId) return
    let cancelled = false
    setDetailLoading(true)
    fetchAiCompanyUsage(token, openCompanyId, start, end, detailPage)
      .then((result) => !cancelled && setDetail(result))
      .catch(() => !cancelled && setDetail(null))
      .finally(() => !cancelled && setDetailLoading(false))
    return () => {
      cancelled = true
    }
  }, [token, openCompanyId, start, end, detailPage])

  function toggleCompany(company: AiCompanyUsage) {
    setDetail(null)
    setDetailPage(1)
    setOpenCompanyId(openCompanyId === company.company_id ? null : company.company_id)
  }

  async function handleCreditSubmit(event: FormEvent) {
    event.preventDefault()
    const amount = Number(creditAmount.replace(',', '.'))
    if (!Number.isFinite(amount) || amount === 0) {
      setCreditError('Informe o valor em dólares (negativo para ajuste).')
      return
    }
    if (amount < 0 && creditNote.trim().length < 5) {
      setCreditError('Para um ajuste negativo, escreva o motivo.')
      return
    }
    setCreditSaving(true)
    setCreditError(null)
    try {
      await createAiCredit(token, { amount_usd: amount, credited_at: creditDate, note: creditNote.trim() || undefined })
      setCreditFormOpen(false)
      setCreditAmount('')
      setCreditNote('')
      load()
    } catch (err) {
      setCreditError(err instanceof ApiError ? err.message : 'Não foi possível lançar a recarga.')
    } finally {
      setCreditSaving(false)
    }
  }

  async function handleDeleteCredit() {
    if (!creditToDelete) return
    setDeleting(true)
    try {
      await deleteAiCredit(token, creditToDelete.id)
      setCreditToDelete(null)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível excluir a recarga.')
      setCreditToDelete(null)
    } finally {
      setDeleting(false)
    }
  }

  const balance = summary?.balance
  const rate = balance?.usd_brl_rate ?? 0
  const brl = (usd: number) => formatCurrency(usd * rate)
  const balanceTone =
    balance && credits.length > 0
      ? balance.balance_usd <= 0
        ? 'danger'
        : balance.days_left !== null && balance.days_left < 7
          ? 'warning'
          : undefined
      : undefined
  const periodTotal = summary?.period.total_usd ?? 0

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Matriz</p>
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Consumo de IA</h1>
          <p className="mt-1 max-w-3xl text-[13px] text-[var(--ink-soft)]">
            Saldo comprado na Anthropic e o custo real das respostas dos agentes de WhatsApp de todas as empresas. Valores em
            dólar, como a Anthropic cobra; o valor em reais usa o câmbio de {formatCurrency(rate || 0)}.
          </p>
        </div>
        <button
          type="button"
          onClick={load}
          className="flex items-center gap-2 rounded-xl border border-[var(--border)] px-3.5 py-2.5 text-[13px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          <RefreshIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {error && <p className="rounded-xl bg-[var(--red-100)] px-3.5 py-2.5 text-[13px] font-medium text-[var(--red-500)]">{error}</p>}

      {balance && credits.length === 0 && (
        <p className="rounded-2xl border border-[var(--amber-500)] bg-[var(--surface)] px-4 py-3 text-[13px] text-[var(--ink)]">
          Nenhuma recarga lançada ainda. Lance o saldo que está hoje na conta da Anthropic como primeira recarga: o controle começa
          a contar o consumo a partir da data dela.
        </p>
      )}

      {balance && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Saldo"
            value={formatUsd(balance.balance_usd)}
            hint={`≈ ${brl(balance.balance_usd)}${balanceTone === 'danger' ? ' · esgotado' : ''}`}
            tone={balanceTone}
          />
          <StatCard
            label="Recargas lançadas"
            value={formatUsd(balance.credits_total_usd)}
            hint={balance.counting_since ? `Controle desde ${formatDate(balance.counting_since)}` : 'Sem recargas'}
          />
          <StatCard label="Consumido desde a 1ª recarga" value={formatUsd(balance.used_usd)} hint={`≈ ${brl(balance.used_usd)}`} />
          <StatCard
            label="Média diária (30 dias)"
            value={formatUsd(balance.daily_average_usd)}
            hint={balance.days_left !== null ? `Saldo dura ~${balance.days_left} dia${balance.days_left === 1 ? '' : 's'}` : undefined}
            tone={balanceTone === 'warning' ? 'warning' : undefined}
          />
        </div>
      )}

      <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-[15px] font-bold text-[var(--ink)]">Recargas</h2>
          <button
            type="button"
            onClick={() => {
              setCreditError(null)
              setCreditFormOpen(!creditFormOpen)
            }}
            className="flex items-center gap-1.5 rounded-xl bg-[var(--blue-500)] px-3.5 py-2 text-[13px] font-bold text-white hover:bg-[var(--blue-700)]"
          >
            <PlusIcon className="h-4 w-4" /> Lançar recarga
          </button>
        </div>

        {creditFormOpen && (
          <form onSubmit={handleCreditSubmit} className="mt-3 grid gap-3 rounded-xl bg-[var(--page)] p-3 sm:grid-cols-[160px_170px_1fr_auto] sm:items-end">
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Valor (US$)</span>
              <input
                inputMode="decimal"
                autoFocus
                placeholder="100.00"
                value={creditAmount}
                onChange={(e) => setCreditAmount(e.target.value)}
                className={`${inputClass} bg-[var(--surface)]`}
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Data</span>
              <input type="date" value={creditDate} onChange={(e) => setCreditDate(e.target.value)} className={`${inputClass} bg-[var(--surface)]`} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Observação</span>
              <input
                placeholder="Ex: recarga cartão final 1234 / ajuste com o saldo da Anthropic"
                value={creditNote}
                onChange={(e) => setCreditNote(e.target.value)}
                className={`${inputClass} bg-[var(--surface)]`}
              />
            </label>
            <button
              type="submit"
              disabled={creditSaving}
              className="rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13px] font-bold text-white hover:bg-[var(--blue-700)] disabled:opacity-60"
            >
              {creditSaving ? 'Salvando…' : 'Salvar'}
            </button>
            {creditError && <p className="text-[12.5px] font-medium text-[var(--red-500)] sm:col-span-4">{creditError}</p>}
            <p className="text-[11.5px] text-[var(--muted)] sm:col-span-4">
              Valor negativo lança um ajuste (por exemplo, para igualar ao saldo que a Anthropic mostra).
            </p>
          </form>
        )}

        {credits.length > 0 && (
          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[560px] text-[13px]">
              <thead>
                <tr className="text-left text-[11.5px] font-semibold text-[var(--muted)] uppercase">
                  <th className="py-2 pr-3">Data</th>
                  <th className="py-2 pr-3 text-right">Valor</th>
                  <th className="py-2 pr-3">Observação</th>
                  <th className="py-2 pr-3">Lançado por</th>
                  <th className="py-2" />
                </tr>
              </thead>
              <tbody>
                {credits.map((credit) => (
                  <tr key={credit.id} className="border-t border-[var(--border)]">
                    <td className="py-2 pr-3 text-[var(--ink)]">{formatDate(credit.credited_at)}</td>
                    <td className={`py-2 pr-3 text-right font-semibold tabular-nums ${Number(credit.amount_usd) < 0 ? 'text-[var(--red-500)]' : 'text-[var(--ink)]'}`}>
                      {formatUsd(credit.amount_usd)}
                    </td>
                    <td className="py-2 pr-3 text-[var(--ink-soft)]">{credit.note || '—'}</td>
                    <td className="py-2 pr-3 text-[var(--ink-soft)]">{credit.created_by_name || '—'}</td>
                    <td className="py-2 text-right">
                      <button
                        type="button"
                        onClick={() => setCreditToDelete(credit)}
                        className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--red-500)]"
                        aria-label="Excluir recarga"
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="flex flex-col gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-bold text-[var(--ink)]">Quem está usando</h2>
            <p className="text-[12.5px] text-[var(--ink-soft)]">
              Total no período: <strong className="text-[var(--ink)]">{formatUsd(periodTotal)}</strong> (≈ {brl(periodTotal)})
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-semibold text-[var(--ink-soft)]">De</span>
              <input type="date" value={start} onChange={(e) => setStart(e.target.value)} className={inputClass} />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Até</span>
              <input type="date" value={end} onChange={(e) => setEnd(e.target.value)} className={inputClass} />
            </label>
          </div>
        </div>

        {summary && summary.period.sources.length > 0 && (
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="rounded-xl bg-[var(--page)] p-3">
              <p className="mb-2 text-[12px] font-bold text-[var(--ink-soft)]">Por agente</p>
              {summary.period.sources.map((source) => (
                <div key={source.source} className="flex items-center justify-between gap-3 py-1 text-[13px]">
                  <span className="text-[var(--ink)]">{AI_SOURCE_LABELS[source.source] || source.source}</span>
                  <span className="tabular-nums text-[var(--ink-soft)]">
                    {source.calls} resp. · <strong className="text-[var(--ink)]">{formatUsd(source.cost_usd)}</strong>
                  </span>
                </div>
              ))}
            </div>
            <div className="rounded-xl bg-[var(--page)] p-3">
              <p className="mb-2 text-[12px] font-bold text-[var(--ink-soft)]">Por modelo</p>
              {summary.period.models.map((model) => (
                <div key={model.model} className="flex items-center justify-between gap-3 py-1 text-[13px]">
                  <span className="font-mono text-[12px] text-[var(--ink)]">{model.model}</span>
                  <span className="tabular-nums text-[var(--ink-soft)]">
                    {formatTokens(model.input_tokens)} entrada · {formatTokens(model.output_tokens)} saída ·{' '}
                    <strong className="text-[var(--ink)]">{formatUsd(model.cost_usd)}</strong>
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {loading && !summary ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-10 animate-pulse rounded-xl bg-[var(--page)]" />
            ))}
          </div>
        ) : !summary || summary.period.companies.length === 0 ? (
          <p className="py-8 text-center text-[13.5px] text-[var(--muted)]">Nenhum uso de IA neste período.</p>
        ) : (
          <div className="flex flex-col">
            {summary.period.companies.map((company) => {
              const share = periodTotal > 0 ? (company.cost_usd / periodTotal) * 100 : 0
              const open = openCompanyId === company.company_id
              return (
                <div key={company.company_id} className="border-t border-[var(--border)] first:border-none">
                  <button type="button" onClick={() => toggleCompany(company)} className="flex w-full flex-col gap-1.5 py-3 text-left">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5">
                      <span className="text-[13.5px] font-bold text-[var(--ink)]">{company.name}</span>
                      <span className="text-[13px] tabular-nums text-[var(--ink-soft)]">
                        {company.calls} resp. · {formatTokens(company.input_tokens + company.output_tokens)} tokens ·{' '}
                        <strong className="text-[var(--ink)]">{formatUsd(company.cost_usd)}</strong> (≈ {brl(company.cost_usd)}) ·{' '}
                        {share.toFixed(1)}%
                      </span>
                    </div>
                    <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--page)]">
                      <div className="h-full rounded-full bg-[var(--blue-500)]" style={{ width: `${Math.max(share, 0.5)}%` }} />
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-[11.5px] text-[var(--muted)]">
                      {Object.entries(company.by_source).map(([source, cost]) => (
                        <span key={source}>
                          {AI_SOURCE_LABELS[source] || source}: {formatUsd(cost)}
                        </span>
                      ))}
                    </div>
                  </button>

                  {open && (
                    <div className="mb-3 grid gap-3 rounded-xl bg-[var(--page)] p-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)]">
                      {detailLoading && !detail ? (
                        <p className="text-[12.5px] text-[var(--muted)]">Carregando…</p>
                      ) : detail ? (
                        <>
                          <div>
                            <p className="mb-2 text-[12px] font-bold text-[var(--ink-soft)]">Números de WhatsApp que mais gastam</p>
                            {detail.phones.map((phone) => (
                              <div key={`${phone.phone}-${phone.source}`} className="flex items-center justify-between gap-2 py-1 text-[12.5px]">
                                <span className="min-w-0">
                                  <span className="font-mono text-[var(--ink)]">{phone.phone}</span>{' '}
                                  <span className="text-[var(--muted)]">· {AI_SOURCE_LABELS[phone.source] || phone.source}</span>
                                </span>
                                <span className="flex-none tabular-nums text-[var(--ink-soft)]">
                                  {phone.calls} · <strong className="text-[var(--ink)]">{formatUsd(phone.cost_usd, 3)}</strong>
                                </span>
                              </div>
                            ))}
                          </div>
                          <div>
                            <p className="mb-2 text-[12px] font-bold text-[var(--ink-soft)]">Últimas respostas</p>
                            {detail.conversations.data.map((row) => (
                              <div key={row.id} className="border-b border-[var(--border)] py-1.5 text-[12.5px] last:border-none">
                                <div className="flex justify-between gap-2 text-[11.5px] text-[var(--muted)]">
                                  <span>
                                    {formatDateTime(row.created_at)} · <span className="font-mono">{row.phone}</span> ·{' '}
                                    {AI_SOURCE_LABELS[row.source] || row.source}
                                  </span>
                                  <span className="flex-none tabular-nums">{formatUsd(row.cost_usd, 4)}</span>
                                </div>
                                <p className="truncate text-[var(--ink)]">{row.question}</p>
                              </div>
                            ))}
                            {detail.conversations.meta.last_page > 1 && (
                              <div className="mt-2 flex items-center justify-end gap-2 text-[12px]">
                                <button
                                  type="button"
                                  disabled={detailPage <= 1 || detailLoading}
                                  onClick={() => setDetailPage(detailPage - 1)}
                                  className="rounded-lg border border-[var(--border)] px-2.5 py-1 font-semibold text-[var(--ink-soft)] disabled:opacity-50"
                                >
                                  Anterior
                                </button>
                                <span className="text-[var(--muted)]">
                                  {detailPage} / {detail.conversations.meta.last_page}
                                </span>
                                <button
                                  type="button"
                                  disabled={detailPage >= detail.conversations.meta.last_page || detailLoading}
                                  onClick={() => setDetailPage(detailPage + 1)}
                                  className="rounded-lg border border-[var(--border)] px-2.5 py-1 font-semibold text-[var(--ink-soft)] disabled:opacity-50"
                                >
                                  Próxima
                                </button>
                              </div>
                            )}
                          </div>
                        </>
                      ) : (
                        <p className="text-[12.5px] text-[var(--red-500)]">Não foi possível carregar o detalhe.</p>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
      </section>

      <ConfirmDialog
        open={Boolean(creditToDelete)}
        title="Excluir recarga"
        message={
          creditToDelete
            ? `Excluir a recarga de ${formatUsd(creditToDelete.amount_usd)} de ${formatDate(creditToDelete.credited_at)}? O saldo será recalculado.`
            : ''
        }
        confirmLabel={deleting ? 'Excluindo…' : 'Excluir'}
        loading={deleting}
        onConfirm={handleDeleteCredit}
        onCancel={() => setCreditToDelete(null)}
      />
    </div>
  )
}
