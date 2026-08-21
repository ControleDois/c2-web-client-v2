import { apiGet, apiFetchBlob } from './api'

export interface TowingRevenueExpense {
  id: string
  code?: number
  name?: string | null
  amount: number
  status?: number
  date_competence?: string | null
  date_due?: string | null
  category_name?: string | null
  people_name?: string | null
}

export interface TowingRevenueSale {
  id: string
  code: number
  status: number
  collection_status: number
  transport_value: number
  created_at: string
  people_id?: string | null
  vehicle_id?: string | null
  origin_city?: string | null
  origin_address?: string | null
  destination_city?: string | null
  destination_address?: string | null
  total_expenses: number
  expense_count: number
  expenses: TowingRevenueExpense[]
  net_revenue: number
  people?: { id: string | null; name: string | null; social_name?: string | null } | null
  vehicle?: { id: string | null; brand: string | null; model: string | null; license_plate: string | null } | null
  user?: { id: string | null; name: string | null } | null
}

export interface TowingRevenueReport {
  period: { dateStart: string; dateEnd: string }
  status: string
  summary: {
    gross_revenue: number
    total_expenses: number
    net_revenue: number
    sales_count: number
    expenses_count: number
  }
  sales: TowingRevenueSale[]
}

export type TowingRevenueStatusFilter = 'billable' | 'signed' | 'all' | 'canceled'

export function fetchTowingNetRevenue(
  token: string,
  companyId: string,
  options: { dateStart?: string; dateEnd?: string; status?: TowingRevenueStatusFilter; userId?: string } = {}
) {
  return apiGet<TowingRevenueReport>(
    '/reports/towing-net-revenue',
    { companyId, dateStart: options.dateStart, dateEnd: options.dateEnd, status: options.status, userId: options.userId },
    token
  )
}

export async function generateTowingNetRevenuePdfUrl(
  token: string,
  companyId: string,
  options: {
    dateStart?: string
    dateEnd?: string
    status?: TowingRevenueStatusFilter
    showExpenses?: boolean
    userId?: string
  } = {}
): Promise<string> {
  const blob = await apiFetchBlob(
    '/reports/towing-net-revenue/pdf',
    {
      companyId,
      dateStart: options.dateStart,
      dateEnd: options.dateEnd,
      status: options.status,
      showExpenses: options.showExpenses ? 'true' : undefined,
      userId: options.userId,
    },
    token
  )
  return URL.createObjectURL(blob)
}
