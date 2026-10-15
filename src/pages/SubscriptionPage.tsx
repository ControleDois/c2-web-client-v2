import { useCallback, useEffect, useState } from 'react'
import { PlanCards } from '../components/PlanCards'
import { CheckoutModal } from '../components/CheckoutModal'
import { fetchSubscription, type PlanCycle, type PublicPlan, type SubscriptionInfo, type SubscriptionSummary } from '../lib/subscription'
import { CONTACT_URL } from '../lib/licenseState'
import { formatDate } from '../lib/format'
import { ApiError } from '../lib/api'
import type { AuthCompany, AuthSession } from '../lib/auth'

interface SubscriptionPageProps {
  session: AuthSession
  company: AuthCompany
  // Plano escolhido no site: abre direto a compra dele.
  initialPlan?: { slug: string; cycle: PlanCycle } | null
  onPlanConsumed?: () => void
  onActivated: (summary: SubscriptionSummary) => void
}

// "Planos e assinatura": situação atual da empresa e a compra/troca de plano.
export function SubscriptionPage({ session, company, initialPlan, onPlanConsumed, onActivated }: SubscriptionPageProps) {
  const [info, setInfo] = useState<SubscriptionInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [checkout, setCheckout] = useState<{ plan: PublicPlan; cycle: PlanCycle } | null>(null)

  const load = useCallback(() => {
    fetchSubscription(session.token.token, company.id)
      .then((result) => {
        setInfo(result)
        setError(null)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os planos.'))
  }, [session.token.token, company.id])

  useEffect(load, [load])

  useEffect(() => {
    if (!info || !initialPlan) return
    const plan = info.plans.find((item) => item.slug === initialPlan.slug)
    if (plan) setCheckout({ plan, cycle: initialPlan.cycle })
    onPlanConsumed?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info])

  const summary = info?.summary
  // Cliente antigo (sem plano e sem teste restrito) é atendido direto pela equipe: não vê o checkout.
  const canBuy = Boolean(summary && (summary.restricted_trial || summary.plan))

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Assinatura</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Planos e assinatura</h1>
      </div>

      {error && <div className="rounded-2xl bg-[var(--red-100)] p-4 text-[13.5px] font-medium text-[var(--red-500)]">{error}</div>}
      {!info && !error && <div className="h-40 animate-pulse rounded-2xl bg-[var(--surface)]" />}

      {info && summary && (
        <>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            {summary.plan ? (
              <>
                <p className="text-[12px] font-semibold text-[var(--muted)] uppercase">Seu plano</p>
                <p className="mt-1 text-[20px] font-bold text-[var(--ink)]">
                  {summary.plan.name} <span className="text-[14px] font-medium text-[var(--ink-soft)]">· {summary.cycle === 'yearly' ? 'anual' : 'mensal'}</span>
                </p>
                <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
                  {summary.expires_at
                    ? `${summary.days_left !== null && summary.days_left < 0 ? 'Venceu em' : 'Ativo até'} ${formatDate(summary.expires_at)}${
                        summary.days_left !== null && summary.days_left >= 0 ? ` (${summary.days_left} ${summary.days_left === 1 ? 'dia' : 'dias'})` : ''
                      }.`
                    : 'Ativo.'}{' '}
                  Para renovar, escolha o mesmo plano abaixo e pague: o prazo é somado ao que ainda resta. Ao trocar de plano, o novo plano vale a partir do pagamento.
                </p>
              </>
            ) : summary.restricted_trial ? (
              <>
                <p className="text-[12px] font-semibold text-[var(--muted)] uppercase">Teste grátis</p>
                <p className="mt-1 text-[20px] font-bold text-[var(--ink)]">
                  {summary.days_left !== null && summary.days_left >= 0
                    ? `Restam ${summary.days_left} ${summary.days_left === 1 ? 'dia' : 'dias'}`
                    : 'Seu teste terminou'}
                </p>
                <p className="mt-1 text-[13px] leading-relaxed text-[var(--ink-soft)]">
                  No teste você usa o básico do sistema. Emitir notas fiscais, assinar contratos e usar o WhatsApp fazem parte dos planos. Assine quando quiser: o
                  pagamento é por PIX e o plano é liberado na hora.
                </p>
              </>
            ) : (
              <>
                <p className="text-[12px] font-semibold text-[var(--muted)] uppercase">Sua assinatura</p>
                <p className="mt-1 text-[14px] leading-relaxed text-[var(--ink-soft)]">
                  A assinatura desta empresa é combinada diretamente com a equipe Controle Dois.{' '}
                  <a href={CONTACT_URL} target="_blank" rel="noreferrer" className="font-semibold text-[var(--blue-700)] hover:underline">
                    Fale com a gente
                  </a>{' '}
                  para ver as opções.
                </p>
              </>
            )}
          </div>

          {canBuy && info.plans.length > 0 && (
            <PlanCards
              plans={info.plans}
              catalog={info.catalog}
              currentPlanId={summary.plan?.id}
              currentCycle={summary.cycle}
              initialCycle={initialPlan?.cycle}
              ctaLabel={(plan, isCurrent) => (isCurrent ? 'Plano atual' : summary.plan?.id === plan.id ? 'Renovar' : summary.plan ? 'Trocar para este' : 'Assinar')}
              onChoose={(plan, cycle) => setCheckout({ plan, cycle })}
            />
          )}

          {canBuy && info.plans.length === 0 && (
            <p className="rounded-2xl bg-[var(--surface)] p-5 text-[13.5px] text-[var(--ink-soft)]">
              Os planos ainda não estão disponíveis para compra online.{' '}
              <a href={CONTACT_URL} target="_blank" rel="noreferrer" className="font-semibold text-[var(--blue-700)] hover:underline">
                Fale com a gente
              </a>{' '}
              para contratar.
            </p>
          )}
        </>
      )}

      {checkout && (
        <CheckoutModal
          session={session}
          company={company}
          plan={checkout.plan}
          cycle={checkout.cycle}
          onClose={() => {
            setCheckout(null)
            load()
          }}
          onActivated={onActivated}
        />
      )}
    </div>
  )
}
