import { apiGet, apiPost } from './api'

export type MealAllowanceStatus = 'pending' | 'approved' | 'rejected' | 'paid' | 'cancelled'

export interface MealAllowanceDay {
  day: string
  status: 'pending' | 'approved' | 'rejected' | 'paid' | 'cancelled'
  value: number
}

export interface MealAllowanceRequest {
  id: string
  code: number
  people_id: string
  people_name: string | null
  status: MealAllowanceStatus
  daily_value: number
  total: number
  note: string | null
  decision_note: string | null
  decided_by_name: string | null
  decided_at: string | null
  paid_by_name: string | null
  paid_at: string | null
  bill_id: string | null
  created_at: string
  days: MealAllowanceDay[]
}

export interface MealAllowanceBalance {
  people_id: string
  name: string
  days: number
  total: number
}

export interface MealAllowanceIndex {
  enabled: boolean
  daily_value: number
  requests: MealAllowanceRequest[]
  balances: MealAllowanceBalance[]
}

export const MEAL_STATUS_LABELS: Record<MealAllowanceStatus, string> = {
  pending: 'Aguardando',
  approved: 'Aprovado',
  rejected: 'Recusado',
  paid: 'Pago',
  cancelled: 'Cancelado',
}

export function fetchMealAllowances(token: string, companyId: string, status?: string) {
  return apiGet<MealAllowanceIndex>('/meal-allowance/requests', { company_id: companyId, status }, token)
}

export function approveMealAllowance(token: string, companyId: string, id: string, days?: string[], note?: string) {
  return apiPost<MealAllowanceRequest>(`/meal-allowance/requests/${id}/approve`, { company_id: companyId, days, note }, token)
}

export function rejectMealAllowance(token: string, companyId: string, id: string, note?: string) {
  return apiPost<MealAllowanceRequest>(`/meal-allowance/requests/${id}/reject`, { company_id: companyId, note }, token)
}

export function payMealAllowance(token: string, companyId: string, id: string, bankAccountId?: string | null) {
  return apiPost<MealAllowanceRequest>(`/meal-allowance/requests/${id}/pay`, { company_id: companyId, bank_account_id: bankAccountId || null }, token)
}

// "2026-11-06" -> "sex 06/11", sem passar por Date (evita o desvio de fuso).
export function dayLabel(iso: string) {
  const [year, month, day] = iso.split('-').map(Number)
  const weekday = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'][new Date(year, month - 1, day).getDay()]
  return `${weekday} ${String(day).padStart(2, '0')}/${String(month).padStart(2, '0')}`
}
