import { useCallback, useEffect, useState } from 'react'
import { deletePlan, fetchPlans, priceWithDiscount, updatePlan, type PlanPayload, type PlanRecord } from '../lib/plans'
import { ApiError } from '../lib/api'
import { formatCurrency, formatDate } from '../lib/format'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { PencilIcon, PlusIcon, TrashIcon } from '../components/icons'
import type { AuthSession } from '../lib/auth'

interface PlansPageProps {
  session: AuthSession
  onCreate: () => void
  onEdit: (plan: PlanRecord) => void
}

function toPayload(plan: PlanRecord, patch: Partial<PlanPayload>): PlanPayload {
  return {
    name: plan.name,
    slug: plan.slug,
    tagline: plan.tagline ?? null,
    description: plan.description ?? null,
    price_monthly: Number(plan.price_monthly),
    price_yearly: plan.price_yearly === null || plan.price_yearly === undefined ? null : Number(plan.price_yearly),
    discount_percent: Number(plan.discount_percent || 0),
    discount_label: plan.discount_label ?? null,
    discount_ends_at: plan.discount_ends_at ?? null,
    highlighted: plan.highlighted,
    active: plan.active,
    position: plan.position,
    features: plan.features,
    highlights: plan.highlights,
    ...patch,
  }
}

// Planos de assinatura vendidos no site e no painel: a matriz define preços, desconto e o que cada plano libera.
export function PlansPage({ session, onCreate, onEdit }: PlansPageProps) {
  const token = session.token.token
  const [plans, setPlans] = useState<PlanRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<PlanRecord | null>(null)
  const [busyId, setBusyId] = useState<string | null>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetchPlans(token)
      .then((result) => {
        setPlans(result)
        setError(null)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os planos.'))
      .finally(() => setLoading(false))
  }, [token])

  useEffect(load, [load])

  async function toggleActive(plan: PlanRecord) {
    setBusyId(plan.id)
    try {
      await updatePlan(token, plan.id, toPayload(plan, { active: !plan.active }))
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível alterar o plano.')
    } finally {
      setBusyId(null)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deletePlan(token, deleteTarget.id)
      setDeleteTarget(null)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível excluir o plano.')
      setDeleteTarget(null)
    }
  }

  const anyActive = plans.some((plan) => plan.active)

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Matriz</p>
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Planos</h1>
          <p className="mt-1 text-[12.5px] text-[var(--muted)]">
            Aparecem no site e no painel dos clientes só os planos ativos. Alterar preço ou recursos vale na hora.
          </p>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="flex items-center gap-2 rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)]"
        >
          <PlusIcon className="h-4 w-4" />
          Novo plano
        </button>
      </div>

      {!loading && plans.length > 0 && !anyActive && (
        <div className="rounded-2xl bg-[var(--amber-100)] p-4 text-[13.5px] font-medium text-[var(--amber-500)]">
          Nenhum plano está ativo, então o site e o painel não mostram planos para compra. Revise os valores e os recursos e ative os que quiser vender.
        </div>
      )}
      {error && <div className="rounded-2xl bg-[var(--red-100)] p-4 text-[13.5px] font-medium text-[var(--red-500)]">{error}</div>}

      {loading ? (
        <div className="grid gap-4 md:grid-cols-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-56 animate-pulse rounded-2xl bg-[var(--surface)]" />
          ))}
        </div>
      ) : plans.length === 0 ? (
        <p className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center text-[13.5px] text-[var(--muted)]">
          Nenhum plano cadastrado. Clique em "Novo plano" para criar o primeiro.
        </p>
      ) : (
        <div className="grid gap-4 md:grid-cols-3">
          {plans.map((plan) => {
            const discounted =
              plan.discount_percent > 0 && (!plan.discount_ends_at || new Date(plan.discount_ends_at) > new Date())
            return (
              <div key={plan.id} className="flex flex-col rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 className="text-[17px] font-bold text-[var(--ink)]">{plan.name}</h2>
                    <p className="text-[12px] text-[var(--muted)]">/{plan.slug}</p>
                  </div>
                  <div className="flex flex-wrap justify-end gap-1.5">
                    {plan.highlighted && (
                      <span className="rounded-full bg-[var(--blue-100)] px-2.5 py-1 text-[11px] font-bold text-[var(--blue-700)]">Mais popular</span>
                    )}
                    <span
                      className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                        plan.active ? 'bg-[var(--green-100)] text-[var(--green-600)]' : 'bg-[var(--amber-100)] text-[var(--amber-500)]'
                      }`}
                    >
                      {plan.active ? 'Ativo' : 'Inativo'}
                    </span>
                  </div>
                </div>

                <div className="mt-3">
                  <p className="text-[24px] font-bold tracking-tight text-[var(--ink)]">
                    {formatCurrency(discounted ? priceWithDiscount(Number(plan.price_monthly), plan.discount_percent) : Number(plan.price_monthly))}
                    <span className="text-[13px] font-medium text-[var(--ink-soft)]"> /mês</span>
                  </p>
                  {discounted && (
                    <p className="text-[12px] text-[var(--green-600)]">
                      {plan.discount_label || 'Desconto'}: {plan.discount_percent}% de {formatCurrency(Number(plan.price_monthly))}
                      {plan.discount_ends_at ? ` até ${formatDate(plan.discount_ends_at)}` : ''}
                    </p>
                  )}
                  <p className="mt-0.5 text-[12px] text-[var(--ink-soft)]">
                    {plan.price_yearly !== null && plan.price_yearly !== undefined ? `Anual: ${formatCurrency(Number(plan.price_yearly))}` : 'Sem venda anual'}
                  </p>
                </div>

                <p className="mt-3 text-[12px] text-[var(--muted)]">
                  {plan.companies ? `${plan.companies} empresa(s) neste plano` : 'Nenhuma empresa neste plano'}
                </p>

                <div className="mt-auto flex items-center gap-2 pt-4">
                  <button
                    type="button"
                    onClick={() => onEdit(plan)}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-[var(--border)] py-2 text-[13px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]"
                  >
                    <PencilIcon className="h-3.5 w-3.5" /> Editar
                  </button>
                  <button
                    type="button"
                    disabled={busyId === plan.id}
                    onClick={() => void toggleActive(plan)}
                    className="flex-1 rounded-xl bg-[var(--page)] py-2 text-[13px] font-bold text-[var(--blue-700)] hover:bg-[var(--blue-100)] disabled:opacity-60"
                  >
                    {plan.active ? 'Desativar' : 'Ativar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(plan)}
                    title="Excluir"
                    className="flex h-9 w-9 items-center justify-center rounded-lg text-[var(--red-500)] hover:bg-[var(--red-100)]"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Excluir plano"
        message={`Excluir o plano "${deleteTarget?.name}"? Se houver empresas nele, o sistema não deixa excluir: desative-o em vez disso.`}
        confirmLabel="Excluir"
        onConfirm={() => void handleDelete()}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
