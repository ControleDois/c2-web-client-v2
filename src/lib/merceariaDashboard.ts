import { apiGet } from './api'

export type MerceariaPeriod = 'today' | '7d' | 'month'

export interface MerceariaDashboard {
  period: MerceariaPeriod
  range: { start: string; end: string }
  summary: {
    revenue: number
    salesCount: number
    averageTicket: number
    itemsSold: number
    revenueChange: number
    salesCountChange: number
    averageTicketChange: number
    itemsSoldChange: number
  }
  chart: { label: string; total: number }[]
  payments: { formPayment: number; label: string; total: number; count: number; percent: number }[]
  topProducts: { name: string; quantity: number; total: number }[]
  categories: { name: string; total: number }[]
  recentSales: { id: string; code?: number; date: string; itemsCount: number; formPaymentLabel: string; total: number }[]
  attention: {
    productsWithoutPrice: number
    payables: {
      overdueCount: number
      overdueTotal: number
      todayCount: number
      todayTotal: number
      weekCount: number
      weekTotal: number
    }
    receivablesOverdue: { count: number; total: number }
    stock?: { items: number; ingredients: number; negative: number; empty: number; low: number; stock_value: number }
  }
}

export function fetchMerceariaDashboard(token: string, companyId: string, period: MerceariaPeriod) {
  return apiGet<MerceariaDashboard>('/merceariaDashboard', { companyId, period }, token)
}
