import { apiGet, apiPost, apiPostForm, apiPut, apiDelete } from './api'

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
  // Presentes só em parcelas de venda financiada (nicho Empréstimo) -
  // separam quanto da parcela é capital emprestado vs. juros contratado.
  principal_amount?: number | null
  interest_amount?: number | null
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
  // Banco que emitiu o boleto ('sicredi' | 'cora'); na Cora guarda também a cobrança e o PDF
  boleto_provider?: string | null
  cora_invoice_id?: string | null
  boleto_pdf_url?: string | null
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

export function generateBillPix(token: string, companyId: string, id: string, bank?: BoletoBank['id']) {
  return apiPost<{ message: string; pix: { txid?: string; copiaECola: string } }>(
    `/bill/generate-pix/${id}`,
    bank ? { bank } : {},
    token,
    { companyId }
  )
}

// Bancos habilitados para gerar PIX (o painel pergunta por qual gerar quando houver mais de um).
export function fetchPixBanks(token: string, companyId: string) {
  return apiGet<{ banks: BoletoBank[] }>('/bill/pix-banks', { companyId }, token)
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

export function generateBillsPixLote(token: string, companyId: string, ids: string[], bank?: BoletoBank['id']) {
  return apiPost<BillsBatchResult>('/bill/generate-pix-lote', bank ? { ids, bank } : { ids }, token, { companyId })
}

export function cancelBillsPixLote(token: string, companyId: string, ids: string[]) {
  return apiPost<{ message: string }>('/bill/cancel-pix-lote', { ids }, token, { companyId })
}

export interface BoletoBank {
  id: 'sicredi' | 'cora'
  name: string
}

export function fetchBoletoBanks(token: string, companyId: string) {
  return apiGet<{ banks: BoletoBank[] }>('/bill/boleto-banks', { companyId }, token)
}

export function generateBillBoleto(token: string, companyId: string, id: string, bank?: BoletoBank['id']) {
  return apiPost<{ message: string; data: { nossoNumero: string; linhaDigitavel: string; pixCopiaECola: string | null } }>(
    `/bill/generate-boleto/${id}`,
    bank ? { bank } : {},
    token,
    { companyId }
  )
}

export function cancelBillBoleto(token: string, companyId: string, id: string) {
  return apiPost<{ message: string }>(`/bill/cancel-boleto/${id}`, {}, token, { companyId })
}

export function printBillBoleto(token: string, companyId: string, id: string) {
  return apiPost<{ url: string }>(`/bill/print-boleto/${id}`, {}, token, { companyId })
}

export interface SendBillWhatsappOptions {
  sendMessage: boolean
  sendPixButton: boolean
  sendBoleto: boolean
}

export function sendBillWhatsapp(
  token: string,
  billId: string,
  whatsappId: string,
  options: SendBillWhatsappOptions
) {
  return apiPost<{ message: string; postId: string; postMessageId: string; postMessageIds: string[] }>(
    '/uazapi/send-bill-charge',
    { billId, whatsappId, ...options },
    token
  )
}

export function fetchBillWhatsappPreview(token: string, billId: string) {
  return apiGet<{ message: string; ruleType: 'before' | 'overdue' }>(
    `/uazapi/send-bill-charge/${billId}/preview`,
    undefined,
    token
  )
}

export function groupBillsSelected(token: string, payload: { ids: string[]; name?: string; people_id: string }) {
  return apiPost<{ message: string; data: BillRecord }>('/bill/grouped-selected', payload, token)
}

export function ungroupBill(token: string, id: string) {
  return apiPost<{ message: string }>(`/bill/ungroup/${id}`, {}, token)
}

// Boleto emitido fora do sistema (ex.: no app do banco): PDF, linha digitável e PIX copia e cola.
export function attachManualBoleto(
  token: string,
  companyId: string,
  billId: string,
  payload: { file?: File | null; boleto_linha_digital?: string; pix_copia_e_cola?: string }
) {
  const form = new FormData()
  if (payload.file) form.append('file', payload.file)
  form.append('boleto_linha_digital', payload.boleto_linha_digital ?? '')
  form.append('pix_copia_e_cola', payload.pix_copia_e_cola ?? '')
  return apiPostForm<{ message: string; bill: BillRecord }>(
    `/bill/manual-boleto/${billId}?companyId=${encodeURIComponent(companyId)}`,
    form,
    token
  )
}

export function removeManualBoleto(token: string, companyId: string, billId: string) {
  return apiDelete<{ message: string }>(`/bill/manual-boleto/${billId}?companyId=${encodeURIComponent(companyId)}`, token)
}

export interface BillTimelineItem {
  at: string
  kind: 'created' | 'edited' | 'paid' | 'reopened' | 'charge' | 'document' | 'deleted' | 'other' | 'error'
  title: string
  detail: string | null
  by: string | null
  automatic: boolean
}

export interface BillCharge {
  id: string
  type: string
  status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed'
  automated: boolean
  ai_generated: boolean
  whatsapp_name: string | null
  text: string | null
  attempts: number
  last_error: string | null
  scheduled_at: string | null
  sent_at: string | null
  delivered_at: string | null
  read_at: string | null
  failed_at: string | null
}

export interface BillDetails {
  bill: {
    id: string
    code: number
    name: string
    role: number
    status: number
    amount: number
    bill_value: number
    fees: number
    discount: number
    date_due: string | null
    date_received: string | null
    date_competence: string | null
    form_payment: number
    installment_number: number | null
    installments: number | null
    note: string | null
    people_name: string | null
    category_name: string | null
    bank_name: string | null
    created_at: string | null
    updated_at: string | null
    boleto_provider: string | null
    has_pix: boolean
    has_boleto: boolean
  }
  origin: { type: string; label: string }
  created: { at: string; by: string | null; source: 'user' | 'sale' | 'unknown' }
  settlement: {
    at: string | null
    date_received: string | null
    amount: number
    fees: number
    discount: number
    via: 'user' | 'automatic' | 'import' | 'unknown'
    by: string | null
    detail: string | null
    grouped: boolean
  } | null
  charges: BillCharge[]
  timeline: BillTimelineItem[]
}

export function fetchBillDetails(token: string, id: string) {
  return apiGet<BillDetails>(`/bill/${id}/details`, {}, token)
}

export interface RentalDetails {
  sale: { id: string; code: number; status: number; created_at: string | null; created_by: string | null; deleted: boolean; note: string | null }
  contract: {
    status: number
    vehicle: string | null
    renter: string | null
    owner: string | null
    driver: string | null
    rental_type: string | null
    start_date: string | null
    end_date: string | null
    billing_day: number | null
    frequency: string | null
    monthly_value: number
    security_deposit: number
    pickup_date: string | null
    return_date: string | null
    notes: string | null
  } | null
  totals: {
    bills: number
    bills_total: number
    received_count: number
    received_total: number
    open_count: number
    open_total: number
    deleted_count: number
    deleted_total: number
  }
  bills: {
    id: string
    code: number
    name: string
    status: number
    amount: number
    bill_value: number
    date_due: string | null
    date_received: string | null
    created_at: string | null
    deleted: boolean
    deleted_at: string | null
    deleted_by: string | null
    paid_via: 'user' | 'automatic' | 'import' | 'unknown' | null
    paid_by: string | null
    paid_detail: string | null
  }[]
  charges: {
    id: string
    subject: string
    kind: 'bill' | 'contract'
    status: 'queued' | 'sent' | 'delivered' | 'read' | 'failed'
    automated: boolean
    whatsapp_name: string | null
    text: string | null
    last_error: string | null
    at: string | null
  }[]
  signatures: {
    id: string
    signer_name: string | null
    provider: string | null
    status: number
    sent_at: string | null
    signed_at: string | null
    error: string | null
  }[]
  timeline: BillTimelineItem[]
}

export function fetchRentalDetails(token: string, saleId: string) {
  return apiGet<RentalDetails>(`/sale/${saleId}/rental-details`, {}, token)
}
