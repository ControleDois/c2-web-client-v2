import { useState } from 'react'
import { formatCurrency } from '../lib/format'
import { planFeatureLines, type PlanCycle, type PlanFeatureDef, type PublicPlan } from '../lib/subscription'
import { CheckCircleIcon } from './icons'

interface PlanCardsProps {
  plans: PublicPlan[]
  catalog: PlanFeatureDef[]
  currentPlanId?: string | null
  currentCycle?: PlanCycle | null
  ctaLabel?: (plan: PublicPlan, isCurrent: boolean) => string
  onChoose: (plan: PublicPlan, cycle: PlanCycle) => void
  initialCycle?: PlanCycle
}

export function PlanCards({ plans, catalog, currentPlanId, currentCycle, ctaLabel, onChoose, initialCycle = 'monthly' }: PlanCardsProps) {
  const hasYearly = plans.some((plan) => plan.yearly)
  const [cycle, setCycle] = useState<PlanCycle>(hasYearly ? initialCycle : 'monthly')

  return (
    <div className="flex flex-col gap-5">
      {hasYearly && (
        <div className="mx-auto flex rounded-xl bg-[var(--page)] p-1">
          {(
            [
              { value: 'monthly', label: 'Mensal' },
              { value: 'yearly', label: 'Anual' },
            ] as { value: PlanCycle; label: string }[]
          ).map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setCycle(option.value)}
              className={`rounded-lg px-5 py-2 text-[13px] font-bold transition ${
                cycle === option.value ? 'bg-[var(--surface)] text-[var(--ink)] shadow-sm' : 'text-[var(--ink-soft)]'
              }`}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}

      <div className="grid gap-4 md:grid-cols-3">
        {plans.map((plan) => {
          const price = cycle === 'yearly' ? plan.yearly : plan.monthly
          const unavailable = !price || price.price === null
          const isCurrent = plan.id === currentPlanId && currentCycle === cycle
          const perMonth = cycle === 'yearly' && price?.price ? price.price / 12 : null
          return (
            <div
              key={plan.id}
              className={`relative flex flex-col rounded-2xl border bg-[var(--surface)] p-6 ${
                plan.highlighted ? 'border-[var(--blue-500)] shadow-[var(--card-shadow)]' : 'border-[var(--border)]'
              }`}
            >
              {plan.highlighted && (
                <span className="absolute -top-3 left-6 rounded-full bg-[var(--blue-500)] px-3 py-1 text-[11px] font-bold tracking-wide text-white uppercase">
                  Mais popular
                </span>
              )}
              <h3 className="text-[18px] font-bold text-[var(--ink)]">{plan.name}</h3>
              {plan.tagline && <p className="mt-1 text-[12.5px] leading-snug text-[var(--ink-soft)]">{plan.tagline}</p>}

              <div className="mt-4">
                {plan.discount && price?.base !== null && price?.base !== undefined && (
                  <p className="flex items-center gap-2 text-[12.5px] text-[var(--muted)]">
                    <span className="line-through">{formatCurrency(price.base)}</span>
                    <span className="rounded-md bg-[var(--green-100)] px-1.5 py-0.5 text-[11px] font-bold text-[var(--green-600)]">
                      {plan.discount.label || `-${plan.discount.percent}%`}
                    </span>
                  </p>
                )}
                {unavailable ? (
                  <p className="text-[14px] font-semibold text-[var(--muted)]">Indisponível neste ciclo</p>
                ) : (
                  <p className="flex items-baseline gap-1">
                    <span className="text-[30px] font-bold tracking-tight text-[var(--ink)]">{formatCurrency(price!.price!)}</span>
                    <span className="text-[13px] text-[var(--ink-soft)]">/{cycle === 'yearly' ? 'ano' : 'mês'}</span>
                  </p>
                )}
                {perMonth && <p className="text-[12px] text-[var(--ink-soft)]">equivale a {formatCurrency(perMonth)} por mês</p>}
              </div>

              <button
                type="button"
                disabled={unavailable || isCurrent}
                onClick={() => onChoose(plan, cycle)}
                className={`mt-5 rounded-xl py-2.5 text-[13.5px] font-bold transition disabled:opacity-60 ${
                  plan.highlighted
                    ? 'bg-[var(--blue-500)] text-white hover:bg-[var(--blue-700)]'
                    : 'border border-[var(--border)] text-[var(--blue-700)] hover:bg-[var(--blue-100)]'
                }`}
              >
                {ctaLabel ? ctaLabel(plan, isCurrent) : isCurrent ? 'Plano atual' : 'Assinar'}
              </button>

              <ul className="mt-5 flex flex-col gap-2">
                {plan.highlights.map((item) => (
                  <li key={item} className="flex items-start gap-2 text-[13px] text-[var(--ink)]">
                    <CheckCircleIcon className="mt-0.5 h-4 w-4 flex-none text-[var(--green-600)]" />
                    {item}
                  </li>
                ))}
              </ul>

              <div className="mt-4 border-t border-[var(--border)] pt-4">
                <p className="mb-2 text-[11px] font-bold tracking-wide text-[var(--muted)] uppercase">O que inclui</p>
                <ul className="flex flex-col gap-1.5">
                  {planFeatureLines(plan, catalog).map((line) => (
                    <li
                      key={line.text}
                      className={`flex items-start gap-2 text-[12.5px] ${line.included ? 'text-[var(--ink)]' : 'text-[var(--muted)] line-through'}`}
                    >
                      <span aria-hidden="true" className="mt-px w-4 flex-none text-center">
                        {line.included ? '✓' : '–'}
                      </span>
                      {line.text}
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
