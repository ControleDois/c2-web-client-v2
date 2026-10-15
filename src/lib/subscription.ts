import { apiGet, apiPost, apiPut } from './api'
import type { AuthPeople } from './auth'

export interface PlanFeatureDef {
  key: string
  label: string
  description: string
  type: 'boolean' | 'limit'
  requires?: string
  unit?: string
}

export type PlanCycle = 'monthly' | 'yearly'

export interface PlanPrice {
  base: number | null
  price: number | null
}

export interface PublicPlan {
  id: string
  name: string
  slug: string
  tagline: string | null
  description: string | null
  highlighted: boolean
  highlights: string[]
  features: Record<string, boolean | number | null>
  discount: { percent: number; label: string | null; ends_at: string | null } | null
  monthly: PlanPrice
  yearly: PlanPrice | null
}

export interface SubscriptionSummary {
  status: string
  restricted_trial: boolean
  expires_at: string | null
  days_left: number | null
  cycle: PlanCycle | null
  plan: PublicPlan | null
  features: Record<string, boolean | number | null>
}

export interface SubscriptionInfo {
  summary: SubscriptionSummary
  catalog: PlanFeatureDef[]
  plans: PublicPlan[]
  missing_billing_data: string[]
}

export interface PlanOrderInfo {
  id: string
  status: 'pending' | 'paid' | 'canceled'
  plan_id: string
  plan_name: string | null
  cycle: PlanCycle
  amount: number
  pix_copy_paste: string | null
  boleto_url: string | null
  boleto_digitable: string | null
  paid_at: string | null
}

export const fetchSubscription = (token: string, companyId: string) =>
  apiGet<SubscriptionInfo>('/subscription', { companyId }, token)

export const fetchPublicPlans = () => apiGet<{ catalog: PlanFeatureDef[]; plans: PublicPlan[] }>('/connect/plans')

export interface BillingDataPayload {
  company_id: string
  document?: string | null
  phone?: string | null
  email?: string | null
  address?: {
    zip_code?: string | null
    address?: string | null
    number?: string | null
    district?: string | null
    city?: string | null
    state?: string | null
    complement?: string | null
    code_ibge?: string | null
  }
}

export const saveBillingData = (token: string, payload: BillingDataPayload) =>
  apiPut<{ people: AuthPeople; missing_billing_data: string[] }>('/subscription/billing-data', payload, token)

export const createCheckout = (token: string, payload: { company_id: string; plan_id: string; cycle: PlanCycle }) =>
  apiPost<PlanOrderInfo>('/subscription/checkout', payload, token)

export const fetchPlanOrder = (token: string, companyId: string, orderId: string) =>
  apiGet<{ order: PlanOrderInfo; summary: SubscriptionSummary }>(`/subscription/orders/${orderId}`, { companyId }, token)

// Plano guardado quando a pessoa chega do site já escolhendo um (?plano=...&ciclo=...).
const PENDING_PLAN_KEY = 'c2_pending_plan'

export function rememberPendingPlan(slug: string, cycle: PlanCycle) {
  try {
    localStorage.setItem(PENDING_PLAN_KEY, JSON.stringify({ slug, cycle }))
  } catch {
    // sem armazenamento: a pessoa escolhe o plano depois
  }
}

export function takePendingPlan(): { slug: string; cycle: PlanCycle } | null {
  try {
    const raw = localStorage.getItem(PENDING_PLAN_KEY)
    if (!raw) return null
    localStorage.removeItem(PENDING_PLAN_KEY)
    const parsed = JSON.parse(raw) as { slug?: string; cycle?: string }
    if (!parsed.slug) return null
    return { slug: parsed.slug, cycle: parsed.cycle === 'yearly' ? 'yearly' : 'monthly' }
  } catch {
    return null
  }
}

export function peekPendingPlan(): { slug: string; cycle: PlanCycle } | null {
  try {
    const raw = localStorage.getItem(PENDING_PLAN_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { slug?: string; cycle?: string }
    return parsed.slug ? { slug: parsed.slug, cycle: parsed.cycle === 'yearly' ? 'yearly' : 'monthly' } : null
  } catch {
    return null
  }
}

// Linhas da lista de recursos do cartão do plano: o que está incluso e o que não está.
export function planFeatureLines(plan: PublicPlan, catalog: PlanFeatureDef[]): { text: string; included: boolean }[] {
  const lines: { text: string; included: boolean }[] = []
  for (const feature of catalog) {
    const value = plan.features[feature.key]
    if (feature.type === 'boolean') {
      lines.push({ text: feature.label, included: value === true })
      continue
    }
    if (feature.requires && plan.features[feature.requires] !== true) continue
    if (value === null || value === undefined) lines.push({ text: `${feature.label}: ilimitado`, included: true })
    else lines.push({ text: `${feature.label}: até ${value}`, included: Number(value) > 0 })
  }
  return lines
}
