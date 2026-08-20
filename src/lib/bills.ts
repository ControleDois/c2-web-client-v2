import { apiGet, apiPost, apiPut, apiDelete } from './api'

export interface BillRecord {
  id: string
  code?: number
  name: string
  role: number
  status: number
  date_competence?: string
  date_due?: string
  date_received?: string | null
  amount: number
  bill_value?: number | null
  discount?: number | null
  fees?: number | null
  form_payment: number
  note?: string | null
  categoryId?: string
  bankAccountId?: string | null
  costCenterId?: string | null
  peopleId?: string | null
  creditCardId?: string | null
  repeat_period?: number | null
  repeat_occurrences?: number | null
  installments?: number
  installment_number?: number
  people?: { id: string; name: string } | null
  category?: { id: string; name: string } | null
  bank?: { id: string; name: string } | null
  credit_card?: { id: string; name: string } | null
  createdAt?: string
  created_at?: string
}

export interface BillPayload {
  company_id: string
  category_id: string
  role: number
  name: string
  date_competence: string
  date_due: string
  amount: number
  repeat: boolean
  form_payment: number
  status: number
  bank_account_id?: string
  people_id?: string
  cost_center_id?: string
  credit_card_id?: string
  towing_sale_id?: string
  repeat_period?: number
  repeat_occurrences?: number
  installments?: number
  installment_number?: number
  note?: string
  date_received?: string
  discount?: number
  fees?: number
  bill_value?: number
}

interface Paginated<T> {
  data: T[]
  meta?: {
    total: number
    per_page: number
    current_page: number
    last_page: number
  }
}

export const FORM_PAYMENT_LABELS: Record<number, string> = {
  0: 'Boleto Bancário',
  1: 'Cartão de Crédito',
  2: 'Cartão de Débito',
  3: 'Carteira Digital',
  4: 'Cashback',
  5: 'Cheque',
  6: 'Crédito da Loja',
  7: 'Crédito Virtual',
  8: 'Depósito Bancário',
  9: 'Dinheiro',
  10: 'PIX',
  11: 'Programa de Fidelidade',
  12: 'Transferência Bancária',
  13: 'Vale Alimentação',
  14: 'Vale Combustível',
  15: 'Vale Presente',
  16: 'Vale Refeição',
}

export const REPEAT_PERIOD_LABELS: Record<number, string> = {
  0: 'Diariamente',
  1: 'Semanalmente',
  2: 'Mensalmente',
  3: 'Bimestralmente',
  4: 'Trimestralmente',
  5: 'Semestralmente',
  6: 'Anualmente',
}

export function billStatusLabel(status: number, role: number): string {
  if (status === 2) return 'Agrupado'
  if (status === 1) return role === 1 ? 'Recebido' : 'Pago'
  return 'Pendente'
}

export function fetchBills(
  token: string,
  companyId: string,
  options: {
    search?: string
    page?: number
    limit?: number
    role: number
    statusType?: number
    dateStart?: string
    dateEnd?: string
    towingSaleId?: string
  }
) {
  return apiGet<Paginated<BillRecord>>(
    '/bill',
    {
      companyId,
      search: options.search,
      page: options.page ? String(options.page) : '1',
      limit: options.limit ? String(options.limit) : '10',
      role: String(options.role),
      statusType: options.statusType !== undefined ? String(options.statusType) : undefined,
      dateStart: options.dateStart,
      dateEnd: options.dateEnd,
      towingSaleId: options.towingSaleId,
      orderBy: 'date_due',
      sortedBy: 'asc',
    },
    token
  )
}

export function fetchBill(token: string, id: string) {
  return apiGet<BillRecord>(`/bill/${id}`, {}, token)
}

export function createBill(token: string, payload: BillPayload) {
  return apiPost<BillRecord>('/bill', payload, token)
}

export function updateBill(token: string, id: string, payload: BillPayload) {
  return apiPut<BillRecord>(`/bill/${id}`, payload, token)
}

export function deleteBill(token: string, id: string) {
  return apiDelete<void>(`/bill/${id}`, token)
}

export function deleteBillsSelected(token: string, ids: string[]) {
  return apiPost<void>('/bill/destroy-selected', { ids }, token)
}
