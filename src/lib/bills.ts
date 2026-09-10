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
  sale?: { id: string; vehicleRentalContract?: { id: string } | null } | null
  createdAt?: string
  created_at?: string
  // Campos calculados a cada fetch (hook @afterFind/@afterFetch do model) —
  // não existem como coluna, só aparecem na resposta.
  days_late?: number
  fine_calculated?: number
  fees_calculated?: number
  discount_calculated?: number
  total_updated?: number
  groupeds?: { id: string; name: string; amount: number }[]
  // Campos do Sicredi (PIX/boleto), preenchidos após gerar cobrança
  tx_id?: string | null
  pix_copia_e_cola?: string | null
  pix_status?: string | null
  boleto_linha_digital?: string | null
  boleto_codigo_barras?: string | null
  boleto_cooperativa?: string | null
  boleto_posto?: string | null
  boleto_nosso_numero?: string | null
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

export type BillsOrderByField = 'code' | 'name' | 'date_due' | 'date_received' | 'status' | 'amount' | 'created_at'

interface BillsFilterOptions {
  search?: string
  page?: number
  limit?: number
  role: number
  statusType?: number
  dateStart?: string
  dateEnd?: string
  dateType?: 'date_due' | 'date_received' | 'created_at'
  towingSaleId?: string
  saleId?: string
  peopleId?: string
  categoryId?: string
  bankAccountId?: string
  formPaymentType?: number
  orderBy?: BillsOrderByField
  sortedBy?: 'asc' | 'desc'
}

function billsFilterParams(companyId: string, options: BillsFilterOptions) {
  return {
    companyId,
    search: options.search,
    role: String(options.role),
    statusType: options.statusType !== undefined ? String(options.statusType) : undefined,
    dateStart: options.dateStart,
    dateEnd: options.dateEnd,
    dateType: options.dateType,
    towingSaleId: options.towingSaleId,
    saleId: options.saleId,
    peopleId: options.peopleId,
    categoryId: options.categoryId,
    bankAccountId: options.bankAccountId,
    formPaymentType: options.formPaymentType !== undefined ? String(options.formPaymentType) : undefined,
  }
}

export function fetchBills(token: string, companyId: string, options: BillsFilterOptions) {
  return apiGet<Paginated<BillRecord>>(
    '/bill',
    {
      ...billsFilterParams(companyId, options),
      page: options.page ? String(options.page) : '1',
      limit: options.limit ? String(options.limit) : '10',
      orderBy: options.orderBy || 'date_due',
      sortedBy: options.sortedBy || 'asc',
    },
    token
  )
}

export interface BillsSummaryBucket {
  count: number
  total: number
}

export interface BillsSummary {
  pending: BillsSummaryBucket
  paid: BillsSummaryBucket
  overdue: BillsSummaryBucket
  total: BillsSummaryBucket
}

export function fetchBillsSummary(token: string, companyId: string, options: BillsFilterOptions) {
  return apiGet<BillsSummary>('/bill/summary', billsFilterParams(companyId, options), token)
}

export interface BatchReceiveBillsPayload {
  ids: string[]
  interest?: number
  discount?: number
  amountPaid: number
  date_received: string
  bank_account_id: string
  category_id: string
  cost_center_id?: string
  form_payment: number
  nextDueDate?: string
}

export function batchReceiveBills(token: string, payload: BatchReceiveBillsPayload) {
  return apiPost<{ message: string; paymentId: string }>('/bill/batch-receive', payload, token)
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

export function printBillReceipt(token: string, id: string) {
  return apiPost<{ url: string; html: string }>(`/bill/print-receipt/${id}`, {}, token)
}

export function generateBillPix(token: string, companyId: string, id: string) {
  return apiPost<{ message: string; pix: { txid: string; copiaECola: string } }>(
    `/bill/generate-pix/${id}`,
    {},
    token,
    { companyId }
  )
}

export function cancelBillPix(token: string, companyId: string, id: string) {
  return apiPost<{ message: string }>(`/bill/cancel-pix/${id}`, {}, token, { companyId })
}

export interface BillsBatchResult {
  message: string
  total: number
  results: {
    sucesso: string[]
    erros: { id: string; error: string }[]
  }
}

export function generateBillsPixLote(token: string, companyId: string, ids: string[]) {
  return apiPost<BillsBatchResult>('/bill/generate-pix-lote', { ids }, token, { companyId })
}

export function cancelBillsPixLote(token: string, companyId: string, ids: string[]) {
  return apiPost<{ message: string }>('/bill/cancel-pix-lote', { ids }, token, { companyId })
}

export function generateBillBoleto(token: string, companyId: string, id: string) {
  return apiPost<{ message: string; data: { nossoNumero: string; linhaDigitavel: string; pixCopiaECola: string | null } }>(
    `/bill/generate-boleto/${id}`,
    {},
    token,
    { companyId }
  )
}

export function printBillBoleto(token: string, companyId: string, id: string) {
  return apiPost<{ url: string }>(`/bill/print-boleto/${id}`, {}, token, { companyId })
}

export function sendBillWhatsapp(token: string, billId: string, whatsappId: string) {
  return apiPost<{ message: string; postId: string; postMessageId: string }>(
    '/uazapi/send-bill-charge',
    { billId, whatsappId },
    token
  )
}

export function groupBillsSelected(token: string, payload: { ids: string[]; name?: string; people_id: string }) {
  return apiPost<{ message: string; data: BillRecord }>('/bill/grouped-selected', payload, token)
}

export function ungroupBill(token: string, id: string) {
  return apiPost<{ message: string }>(`/bill/ungroup/${id}`, {}, token)
}
