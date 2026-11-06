import { apiGet } from './api'

interface CountTotal {
  count: number
  total: number
}

export interface FinancialGoalSummary {
  month: string
  today: string
  goal: number
  payable: { total: CountTotal; paid: CountTotal; pending: CountTotal }
  received: CountTotal
  receivable: { pending: CountTotal; overdueInMonth: CountTotal; overdueBefore: CountTotal }
  forecast: number
  gap: number
  gapCash: number
  daily: { day: string; received: number; expected: number; payable: number }[]
  history: { month: string; received: number; paid: number }[]
}

export function fetchFinancialGoalSummary(token: string, month: string) {
  return apiGet<FinancialGoalSummary>('/financial-goals/summary', { month }, token)
}
