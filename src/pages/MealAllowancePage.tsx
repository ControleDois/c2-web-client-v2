import { useCallback, useEffect, useMemo, useState } from 'react'
import type { AuthCompany, AuthSession } from '../lib/auth'
import { ApiError } from '../lib/api'
import { formatCurrency, formatDateTime } from '../lib/format'
import { fetchBankAccounts, type BankAccountRecord } from '../lib/bankAccounts'
import {
  approveMealAllowance,
  dayLabel,
  fetchMealAllowances,
  MEAL_STATUS_LABELS,
  payMealAllowance,
  rejectMealAllowance,
  type MealAllowanceIndex,
  type MealAllowanceRequest,
} from '../lib/mealAllowance'
import { ConfirmDialog } from '../components/ConfirmDialog'

interface MealAllowancePageProps {
  session: AuthSession
  company: AuthCompany
}

type Filter = 'pending' | 'approved' | 'paid' | 'all'

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'pending', label: 'Aguardando' },
  { key: 'approved', label: 'A pagar' },
  { key: 'paid', label: 'Pagos' },
  { key: 'all', label: 'Todos' },
]

function statusTone(status: MealAllowanceRequest['status']) {
  if (status === 'paid') return 'bg-[var(--green-100)] text-[var(--green-600)]'
  if (status === 'approved') return 'bg-[var(--blue-100)] text-[var(--blue-700)]'
  if (status === 'pending') return 'bg-[var(--amber-100)] text-[var(--amber-500)]'
  return 'bg-[var(--page)] text-[var(--muted)]'
}

function RequestCard({
  request,
  busy,
  bankAccounts,
  onApprove,
  onReject,
  onPay,
}: {
  request: MealAllowanceRequest
  busy: boolean
  bankAccounts: BankAccountRecord[]
  onApprove: (days: string[]) => void
  onReject: () => void
  onPay: (bankAccountId: string | null) => void
}) {
  // Pedido pendente: todos os dias vêm marcados; desmarcar = aprovar só parte.
  const [selected, setSelected] = useState<Set<string>>(() => new Set(request.days.map((day) => day.day)))
  const [bankAccountId, setBankAccountId] = useState('')
  const pending = request.status === 'pending'
  const visibleDays = pending ? request.days : request.days.filter((day) => day.status !== 'rejected' && day.status !== 'cancelled')
  const selectedTotal = selected.size * request.daily_value

  function toggle(day: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(day)) next.delete(day)
      else next.add(day)
      return next
    })
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-[15px] font-bold text-[var(--ink)]">{request.people_name ?? '—'}</p>
          <p className="text-[12px] text-[var(--muted)]">
            Pedido #{request.code} · {formatDateTime(request.created_at)} · {formatCurrency(request.daily_value)}/dia
          </p>
        </div>
        <div className="text-right">
          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold uppercase ${statusTone(request.status)}`}>
            {MEAL_STATUS_LABELS[request.status]}
          </span>
          <p className="mt-1.5 font-mono text-[16px] font-bold text-[var(--ink)]">
            {formatCurrency(pending ? selectedTotal : request.total)}
          </p>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {visibleDays.map((day) =>
          pending ? (
            <button
              key={day.day}
              type="button"
              onClick={() => toggle(day.day)}
              title={selected.has(day.day) ? 'Clique para não aprovar este dia' : 'Clique para aprovar este dia'}
              className={`rounded-lg px-2.5 py-1 text-[12px] font-semibold transition ${
                selected.has(day.day)
                  ? 'bg-[var(--blue-500)] text-white'
                  : 'bg-[var(--page)] text-[var(--muted)] line-through'
              }`}
            >
              {dayLabel(day.day)}
            </button>
          ) : (
            <span key={day.day} className="rounded-lg bg-[var(--page)] px-2.5 py-1 text-[12px] font-semibold text-[var(--ink-soft)]">
              {dayLabel(day.day)}
            </span>
          )
        )}
      </div>

      {request.note && <p className="mt-2 text-[12.5px] text-[var(--ink-soft)]">“{request.note}”</p>}
      {(request.decided_by_name || request.paid_by_name) && (
        <p className="mt-2 text-[11.5px] text-[var(--muted)]">
          {request.decided_by_name && `${request.status === 'rejected' ? 'Recusado' : 'Aprovado'} por ${request.decided_by_name} em ${formatDateTime(request.decided_at)}`}
          {request.paid_by_name && ` · pago por ${request.paid_by_name} em ${formatDateTime(request.paid_at)}`}
          {request.decision_note && ` · ${request.decision_note}`}
        </p>
      )}

      {pending && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={busy || selected.size === 0}
            onClick={() => onApprove([...selected])}
            className="rounded-xl bg-[var(--blue-500)] px-4 py-2 text-[13px] font-bold text-white hover:bg-[var(--blue-700)] disabled:opacity-50"
          >
            {selected.size === request.days.length ? 'Aprovar' : `Aprovar ${selected.size} de ${request.days.length} dias`}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onReject}
            className="rounded-xl px-4 py-2 text-[13px] font-semibold text-[var(--red-500)] ring-1 ring-[var(--border)] hover:bg-[var(--red-100)] disabled:opacity-50"
          >
            Recusar
          </button>
          {selected.size < request.days.length && (
            <span className="text-[12px] text-[var(--muted)]">Os dias desmarcados são recusados e ficam livres para pedir de novo.</span>
          )}
        </div>
      )}

      {request.status === 'approved' && (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={bankAccountId}
            onChange={(event) => setBankAccountId(event.target.value)}
            className="rounded-xl bg-[var(--page)] px-3 py-2 text-[13px] text-[var(--ink)] focus:outline-none"
            aria-label="Conta de onde saiu o dinheiro"
          >
            <option value="">Conta de saída (opcional)</option>
            {bankAccounts.map((account) => (
              <option key={account.id} value={account.id}>
                {account.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            disabled={busy}
            onClick={() => onPay(bankAccountId || null)}
            className="rounded-xl bg-[var(--green-600)] px-4 py-2 text-[13px] font-bold text-white hover:opacity-90 disabled:opacity-50"
          >
            Depositei no iFood · marcar como pago
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onReject}
            className="rounded-xl px-3 py-2 text-[12.5px] font-semibold text-[var(--muted)] hover:text-[var(--red-500)] disabled:opacity-50"
          >
            Recusar
          </button>
        </div>
      )}
    </div>
  )
}

// Financeiro: pedidos de verba de alimentação dos colaboradores (aprovar, recusar, pagar) e o
// saldo de cada um (dias já pagos de hoje em diante, dinheiro que ele já tem em mãos).
export function MealAllowancePage({ session, company }: MealAllowancePageProps) {
  const token = session.token.token
  const [filter, setFilter] = useState<Filter>('pending')
  const [data, setData] = useState<MealAllowanceIndex | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)
  const [rejectTarget, setRejectTarget] = useState<MealAllowanceRequest | null>(null)
  const [bankAccounts, setBankAccounts] = useState<BankAccountRecord[]>([])

  const load = useCallback(() => {
    setLoading(true)
    fetchMealAllowances(token, company.id)
      .then((result) => {
        setData(result)
        setError(null)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os pedidos.'))
      .finally(() => setLoading(false))
  }, [token, company.id])

  useEffect(load, [load])
  useEffect(() => {
    fetchBankAccounts(token, company.id, { limit: 100 })
      .then((res) => setBankAccounts(res.data || []))
      .catch(() => setBankAccounts([]))
  }, [token, company.id])

  async function act(id: string, action: () => Promise<unknown>) {
    setBusyId(id)
    setError(null)
    try {
      await action()
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível concluir.')
    } finally {
      setBusyId(null)
    }
  }

  const requests = useMemo(() => {
    const all = data?.requests ?? []
    return filter === 'all' ? all : all.filter((request) => request.status === filter)
  }, [data, filter])

  const stats = useMemo(() => {
    const all = data?.requests ?? []
    const sum = (status: string) => all.filter((r) => r.status === status).reduce((total, r) => total + r.total, 0)
    const count = (status: string) => all.filter((r) => r.status === status).length
    return { pending: { count: count('pending'), total: sum('pending') }, approved: { count: count('approved'), total: sum('approved') } }
  }, [data])

  const balanceTotal = (data?.balances ?? []).reduce((total, row) => total + row.total, 0)

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 lg:p-8">
      <div>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Colaboradores</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Verba de alimentação</h1>
        <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
          Pedidos feitos pelos colaboradores no app do colaborador. Diária atual: {formatCurrency(data?.daily_value ?? 0)}.
        </p>
      </div>

      {data && !data.enabled && (
        <div className="rounded-2xl bg-[var(--amber-100)] p-4 text-[13px] font-medium text-[var(--amber-500)]">
          A verba de alimentação está desligada. Ative em Configurações → Verba de alimentação.
        </div>
      )}
      {error && <div className="rounded-2xl bg-[var(--red-100)] p-4 text-[13.5px] font-medium text-[var(--red-500)]">{error}</div>}

      <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
        {[
          { label: 'Aguardando aprovação', value: formatCurrency(stats.pending.total), hint: `${stats.pending.count} pedidos` },
          { label: 'Aprovado, falta pagar', value: formatCurrency(stats.approved.total), hint: `${stats.approved.count} pedidos` },
          { label: 'Saldo com os colaboradores', value: formatCurrency(balanceTotal), hint: 'dias já pagos de hoje em diante' },
          { label: 'Colaboradores com saldo', value: String(data?.balances.length ?? 0), hint: 'veja a lista ao lado' },
        ].map((tile) => (
          <div key={tile.label} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
            <p className="text-[11.5px] font-semibold text-[var(--muted)]">{tile.label}</p>
            <p className="mt-0.5 text-[18px] font-bold text-[var(--ink)]">{tile.value}</p>
            <p className="text-[12px] text-[var(--ink-soft)]">{tile.hint}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-5 xl:grid-cols-3">
        <div className="flex min-w-0 flex-col gap-3 xl:col-span-2">
          <div className="flex w-fit gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
            {FILTERS.map((option) => (
              <button
                key={option.key}
                type="button"
                onClick={() => setFilter(option.key)}
                className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold transition ${
                  filter === option.key ? 'bg-[var(--blue-500)] text-white' : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
                }`}
              >
                {option.label}
              </button>
            ))}
          </div>

          {loading && !data ? (
            <div className="h-32 animate-pulse rounded-2xl bg-[var(--surface)]" />
          ) : requests.length === 0 ? (
            <p className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] py-10 text-center text-[13.5px] text-[var(--muted)]">
              Nenhum pedido aqui.
            </p>
          ) : (
            requests.map((request) => (
              <RequestCard
                key={`${request.id}:${request.status}`}
                request={request}
                busy={busyId === request.id}
                bankAccounts={bankAccounts}
                onApprove={(days) => act(request.id, () => approveMealAllowance(token, company.id, request.id, days))}
                onReject={() => setRejectTarget(request)}
                onPay={(bankAccountId) => act(request.id, () => payMealAllowance(token, company.id, request.id, bankAccountId))}
              />
            ))
          )}
        </div>

        <div className="h-fit rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-[14px] font-bold text-[var(--ink)]">Saldo por colaborador</p>
          <p className="text-[12px] text-[var(--muted)]">Dias já pagos de hoje em diante: o dinheiro que cada um já tem.</p>
          {(data?.balances ?? []).length === 0 ? (
            <p className="mt-3 text-[13px] text-[var(--muted)]">Ninguém com saldo agora.</p>
          ) : (
            <ul className="mt-3 flex flex-col divide-y divide-[var(--border)]">
              {data!.balances.map((row) => (
                <li key={row.people_id} className="flex items-center justify-between py-2 text-[13px]">
                  <span className="font-semibold text-[var(--ink)]">{row.name}</span>
                  <span className="text-right">
                    <span className="block font-mono font-bold text-[var(--ink)]">{formatCurrency(row.total)}</span>
                    <span className="block text-[11.5px] text-[var(--muted)]">
                      {row.days} {row.days === 1 ? 'dia' : 'dias'}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(rejectTarget)}
        title="Recusar pedido"
        message={`Recusar o pedido #${rejectTarget?.code} de ${rejectTarget?.people_name}? Os dias ficam livres para ele pedir de novo.`}
        confirmLabel="Recusar"
        loading={Boolean(rejectTarget && busyId === rejectTarget.id)}
        onConfirm={() => {
          const target = rejectTarget
          if (!target) return
          void act(target.id, () => rejectMealAllowance(token, company.id, target.id)).then(() => setRejectTarget(null))
        }}
        onCancel={() => setRejectTarget(null)}
      />
    </div>
  )
}
