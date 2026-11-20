import { apiGet } from './api'

export type MerceariaPeriod = 'today' | '7d' | 'month' | 'custom'

// Canal da venda: mesa, delivery (PDV, cardápio/app próprio), iFood ou balcão (venda rápida).
export type SaleChannel = 'table' | 'delivery' | 'ifood' | 'counter'

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
  chartGranularity?: 'hour' | 'day'
  channels?: { key: SaleChannel; label: string; total: number; count: number; averageTicket: number; percent: number }[]
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

// period 'custom' usa dateStart e dateEnd (AAAA-MM-DD).
export function fetchMerceariaDashboard(
  token: string,
  companyId: string,
  period: MerceariaPeriod,
  range?: { dateStart: string; dateEnd: string }
) {
  return apiGet<MerceariaDashboard>(
    '/merceariaDashboard',
    { companyId, period, ...(period === 'custom' && range ? range : {}) },
    token
  )
}
