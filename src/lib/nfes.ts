import { apiGet, apiPost, apiPut, apiDelete, apiFetchBlob } from './api'

interface Paginated<T> {
  data: T[]
  meta?: {
    total: number
    per_page: number
    current_page: number
    last_page: number
  }
}

export const NFE_STATUS_LABELS: Record<number, string> = {
  0: 'Aguardando envio',
  1: 'Em processamento',
  2: 'Emitida',
  3: 'Erro',
  4: 'Cancelada',
}

export const NFE_PRESENCA_COMPRADOR_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'Não se aplica' },
  { value: 1, label: 'Operação presencial' },
  { value: 2, label: 'Internet' },
  { value: 3, label: 'Teleatendimento' },
  { value: 4, label: 'Entrega em domicílio' },
  { value: 5, label: 'Fora do estabelecimento' },
  { value: 9, label: 'Outros' },
]

export const NFE_INDICADOR_PAGAMENTO_OPTIONS: { value: number; label: string }[] = [
  { value: 0, label: 'À vista' },
  { value: 1, label: 'A prazo' },
]

export const NFE_FORMA_PAGAMENTO_OPTIONS: { value: string; label: string }[] = [
  { value: '01', label: '01 - Dinheiro' },
  { value: '02', label: '02 - Cheque' },
  { value: '03', label: '03 - Cartão de Crédito' },
  { value: '04', label: '04 - Cartão de Débito' },
  { value: '15', label: '15 - Boleto Bancário' },
  { value: '17', label: '17 - PIX Dinâmico' },
  { value: '20', label: '20 - PIX Estático' },
  { value: '90', label: '90 - Sem pagamento' },
  { value: '99', label: '99 - Outros' },
]

export interface NfeItemRecord {
  id?: number
  product_id: string
  descricao?: string
  codigo_produto?: string
  quantidade_comercial: number
  valor_unitario_comercial: number
  valor_bruto?: number
  product?: { id: string; name: string; code?: number }
}

export interface NfePaymentRecord {
  id?: number
  indicador_pagamento: number
  forma_pagamento: string
  descricao_pagamento?: string | null
  valor_pagamento: number
  data_pagamento: string
}

export interface NfeRecord {
  id: string
  code?: number
  company_id?: string
  people_id: string
  nfe_nature_operation_id: string
  natureza_operacao?: string
  serie?: number
  numero?: number
  modelo: number
  data_emissao?: string | null
  status: number
  status_sefaz?: number | null
  mensagem_sefaz?: string | number | null
  chave_nfe?: string | null
  protocolo?: string | null
  protocolo_cancelamento?: string | null
  justificativa_cancelamento?: string | null
  valor_produtos?: number
  valor_frete?: number
  valor_seguro?: number
  valor_desconto?: number
  valor_outras_despesas?: number
  valor_total?: number
  presenca_comprador?: number
  indicador_intermediario?: number
  people?: { id: string; name: string; document?: string }
  nature_operation?: { id: string; description: string }
  itens?: NfeItemRecord[]
  pagamentos?: NfePaymentRecord[]
}

export interface NfeProductInput {
  product_id: string
  amount: number
  cost_value: number
  description?: string
}

export interface NfePaymentInput {
  indicador_pagamento: number
  forma_pagamento: string
  valor_pagamento: number
  data_pagamento: string
  descricao_pagamento?: string
}

export interface NfeDraftPayload {
  peopleId: string
  nfeNatureOperationId: string
  modelo?: number
  presenca_comprador?: number
  indicador_intermediario?: number
  valor_frete?: number
  valor_seguro?: number
  valor_desconto?: number
  valor_outras_despesas?: number
  products: NfeProductInput[]
  payments: NfePaymentInput[]
}

export interface NfeApiValidationError {
  message: string
  errors?: { message: string }[]
}

export function fetchNfes(
  token: string,
  companyId: string,
  options: {
    search?: string
    page?: number
    limit?: number
    orderBy?: string
    sortedBy?: 'asc' | 'desc'
    dateStart?: string
    dateEnd?: string
    peopleId?: string
    modelo?: number
  } = {}
) {
  return apiGet<Paginated<NfeRecord>>(
    '/nfe',
    {
      companyId,
      search: options.search,
      page: options.page ? String(options.page) : '1',
      limit: options.limit ? String(options.limit) : '10',
      orderBy: options.orderBy,
      sortedBy: options.sortedBy,
      dateStart: options.dateStart,
      dateEnd: options.dateEnd,
      peopleId: options.peopleId,
      modelo: options.modelo !== undefined ? String(options.modelo) : undefined,
    },
    token
  )
}

export function fetchNfe(token: string, id: string) {
  return apiGet<NfeRecord>(`/nfe/${id}`, {}, token)
}

export function createNfe(token: string, payload: NfeDraftPayload) {
  return apiPost<NfeRecord>('/nfe', payload, token)
}

export function updateNfe(token: string, id: string, payload: NfeDraftPayload) {
  return apiPut<NfeRecord>(`/nfe/${id}`, payload, token)
}

export function deleteNfe(token: string, id: string) {
  return apiDelete<void>(`/nfe/${id}`, token)
}

export function sendNfe(token: string, id: string) {
  return apiPost<{ status: number; mensagem: string }>(`/nfe/send/${id}`, {}, token)
}

export function forceSendNfe(token: string, id: string) {
  return apiPost<{ status: number; mensagem: string }>(`/nfe/force-send/${id}`, {}, token)
}

export function cancelNfe(token: string, id: string, justificativa: string) {
  return apiPost<{ mensagem: string; protocolo_cancelamento: string }>(
    `/nfe/cancel/${id}`,
    { justificativa },
    token
  )
}

export function skipNfeNumber(token: string, id: string) {
  return apiPost<NfeRecord>(`/nfe/skip-number/${id}`, {}, token)
}

export interface NfeSendLogRecord {
  id: string
  code?: number
  created_at?: string
  phase?: string
  action?: string
  status?: number | null
  http_status?: number | null
  error_message?: string | null
  response_payload?: string | null
}

export function fetchNfeLogs(token: string, id: string) {
  return apiGet<NfeSendLogRecord[]>(`/nfe/${id}/logs`, {}, token)
}

export async function fetchNfeFileUrl(token: string, id: string, type: 'xml' | 'danfe'): Promise<string> {
  const blob = await apiFetchBlob(`/nfe/${id}/file/${type}`, {}, token)
  return URL.createObjectURL(blob)
}
