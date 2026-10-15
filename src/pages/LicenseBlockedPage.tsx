import { useEffect, useState } from 'react'
import { Logo } from '../components/Logo'
import { PlanCards } from '../components/PlanCards'
import { CheckoutModal } from '../components/CheckoutModal'
import { CONTACT_URL, isTrial } from '../lib/licenseState'
import { fetchSubscription, type PlanCycle, type PublicPlan, type SubscriptionInfo, type SubscriptionSummary } from '../lib/subscription'
import { formatDate } from '../lib/format'
import type { AuthCompany, AuthSession } from '../lib/auth'

interface LicenseBlockedPageProps {
  session: AuthSession
  company: AuthCompany
  onSwitchCompany: () => void
  onLogout: () => void
  onActivated: (summary: SubscriptionSummary) => void
  // Plano escolhido no site: abre direto a compra dele.
  initialPlan?: { slug: string; cycle: PlanCycle } | null
  onPlanConsumed?: () => void
}

// Teste grátis acabou ou assinatura venceu: em vez de um beco sem saída, a pessoa escolhe o plano e paga aqui mesmo.
export function LicenseBlockedPage({ session, company, onSwitchCompany, onLogout, onActivated, initialPlan, onPlanConsumed }: LicenseBlockedPageProps) {
  const trial = isTrial(company)
  const [info, setInfo] = useState<SubscriptionInfo | null>(null)
  const [loaded, setLoaded] = useState(false)
  const [checkout, setCheckout] = useState<{ plan: PublicPlan; cycle: PlanCycle } | null>(null)

  useEffect(() => {
    fetchSubscription(session.token.token, company.id)
      .then(setInfo)
      .catch(() => setInfo(null))
      .finally(() => setLoaded(true))
  }, [session.token.token, company.id])

  useEffect(() => {
    if (!info || !initialPlan) return
    const plan = info.plans.find((item) => item.slug === initialPlan.slug)
    if (plan && (info.summary.restricted_trial || info.summary.plan)) setCheckout({ plan, cycle: initialPlan.cycle })
    onPlanConsumed?.()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [info])

  // Cliente antigo bloqueado (sem plano e fora do teste do site) volta a falar com a equipe.
  const canBuy = Boolean(info && (info.summary.restricted_trial || info.summary.plan) && info.plans.length > 0)

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-5xl flex-col items-center px-4 py-10 text-center">
      <Logo className="h-14 w-14" />
      <h1 className="mt-5 text-[22px] font-bold tracking-tight text-[var(--ink)]">
        {trial ? 'Seu teste grátis terminou' : 'Seu plano venceu'}
      </h1>
      <p className="mt-2 max-w-lg text-[14px] leading-relaxed text-[var(--ink-soft)]">
        {canBuy
          ? `${trial ? 'Os 7 dias de teste acabaram' : 'O acesso foi bloqueado'}${
              company.license_expires_at ? ` em ${formatDate(company.license_expires_at)}` : ''
            }. Escolha um plano para continuar: o pagamento é por PIX e o acesso volta na hora. Seus dados continuam guardados.`
          : 'O acesso desta empresa está bloqueado. Fale com a gente para regularizar e liberar o acesso. Seus dados continuam guardados.'}
      </p>

      {!loaded && <div className="mt-8 h-8 w-8 animate-spin rounded-full border-2 border-[var(--blue-300)] border-t-[var(--blue-500)]" />}

      {canBuy && info && (
        <div className="mt-8 w-full text-left">
          <PlanCards
            plans={info.plans}
            catalog={info.catalog}
            currentPlanId={null}
            ctaLabel={() => (trial ? 'Assinar e continuar' : 'Renovar')}
            onChoose={(plan, cycle) => setCheckout({ plan, cycle })}
          />
        </div>
      )}

      <div className="mt-8 flex flex-wrap justify-center gap-3">
        {!canBuy && loaded && (
          <a
            href={CONTACT_URL}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl bg-[var(--blue-500)] px-5 py-3 text-[14px] font-bold text-white transition hover:bg-[var(--blue-700)]"
          >
            Falar com a gente
          </a>
        )}
        <button
          type="button"
          onClick={onSwitchCompany}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-3 text-[14px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          Trocar de empresa
        </button>
        <button type="button" onClick={onLogout} className="rounded-xl px-5 py-3 text-[14px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]">
          Sair
        </button>
      </div>
      {canBuy && (
        <p className="mt-3 text-[12.5px] text-[var(--muted)]">
          Dúvidas?{' '}
          <a href={CONTACT_URL} target="_blank" rel="noreferrer" className="font-semibold text-[var(--blue-700)] hover:underline">
            Fale com a gente
          </a>
        </p>
      )}

      {checkout && (
        <CheckoutModal
          session={session}
          company={company}
          plan={checkout.plan}
          cycle={checkout.cycle}
          onClose={() => setCheckout(null)}
          onActivated={onActivated}
        />
      )}
    </div>
  )
}
