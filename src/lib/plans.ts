import { apiGet, apiPost, apiPut, apiDelete } from './api'
import type { PlanFeatureDef } from './subscription'

export interface PlanRecord {
  id: string
  name: string
  slug: string
  tagline?: string | null
  description?: string | null
  price_monthly: number
  price_yearly?: number | null
  discount_percent: number
  discount_label?: string | null
  discount_ends_at?: string | null
  highlighted: boolean
  active: boolean
  position: number
  features: Record<string, boolean | number | null>
  highlights: string[]
  // Quantas empresas usam o plano hoje (só na listagem).
  companies?: number
}

export interface PlanPayload {
  name: string
  slug?: string
  tagline: string | null
  description: string | null
  price_monthly: number
  price_yearly: number | null
  discount_percent: number
  discount_label: string | null
  discount_ends_at: string | null
  highlighted: boolean
  active: boolean
  position: number
  features: Record<string, boolean | number | null>
  highlights: string[]
}

export const fetchPlans = (token: string) => apiGet<PlanRecord[]>('/plan', {}, token)
export const fetchPlanCatalog = (token: string) => apiGet<PlanFeatureDef[]>('/plan/catalog', {}, token)
export const fetchPlan = (token: string, id: string) => apiGet<PlanRecord>(`/plan/${id}`, {}, token)
export const createPlan = (token: string, payload: PlanPayload) => apiPost<PlanRecord>('/plan', payload, token)
export const updatePlan = (token: string, id: string, payload: PlanPayload) => apiPut<PlanRecord>(`/plan/${id}`, payload, token)
export const deletePlan = (token: string, id: string) => apiDelete<void>(`/plan/${id}`, token)

// Preço final de um plano com o desconto (mesma conta do servidor).
export function priceWithDiscount(base: number, percent: number): number {
  const value = base * (1 - Math.min(100, Math.max(0, percent)) / 100)
  return Math.round((value + Number.EPSILON) * 100) / 100
}
