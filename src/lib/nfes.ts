import { apiGet, apiPost, apiPut, apiDelete, apiFetchBlob, ApiError } from './api'

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
  cfop?: string
  quantidade_comercial: number
  valor_unitario_comercial: number
  valor_bruto?: number
  product?: { id: string; name: string; code?: number }
  // Override de natureza de operação por item (CFOP diferente por categoria
  // de produto dentro da mesma NF-e — ex: refeição x bebida com ST). Chave em
  // camelCase mesmo com o resto em snake_case — relations do Lucid não são
  // convertidas pela naming strategy, só @column (confirmado direto na API).
  nfe_nature_operation_id?: string | null
  natureOperation?: { id: string; description: string } | null
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
  // Texto livre impresso em "Informações Complementares" no DANFE.
  informacoes_adicionais_contribuinte?: string | null
  people?: { id: string; name: string; document?: string }
  natureOperation?: { id: string; description: string }
  itens?: NfeItemRecord[]
  pagamentos?: NfePaymentRecord[]
}

export interface NfeProductInput {
  product_id: string
  amount: number
  cost_value: number
  description?: string
  // Override de natureza de operação (CFOP) só para este item — quando
  // omitido, usa a natureza principal da NF-e.
  nfe_nature_operation_id?: string
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
  informacoes_complementares?: string
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
  request_payload?: string | null
  response_payload?: string | null
}

export const NFE_LOG_PHASE_LABELS: Record<string, string> = {
  send: 'Envio',
  consult: 'Consulta',
}

export const NFE_LOG_ACTION_LABELS: Record<string, string> = {
  enqueue_created: 'Job criado',
  enqueue_existing: 'Job reaproveitado',
  force_replaced_job: 'Job substituído',
  force_enqueue_created: 'Reenvio forçado',
  job_started: 'Job iniciado',
  focus_request: 'Requisição Focus',
  focus_response: 'Resposta Focus',
  focus_error: 'Erro Focus',
  focus_request_already_processed: 'Requisição Focus (já processada)',
  focus_response_already_processed: 'Resposta Focus (já processada)',
  focus_response_already_processed_without_data: 'Resposta Focus (sem dados)',
  focus_error_already_processed: 'Erro Focus (já processada)',
  delphi_request: 'Requisição servidor próprio',
  delphi_response: 'Resposta servidor próprio',
  delphi_error: 'Erro servidor próprio',
  job_waiting_consult: 'Aguardando consulta',
  job_keep_consulting: 'Continuar consultando',
  job_already_processed: 'Já processada',
  job_error: 'Job com erro',
  job_done: 'Job finalizado',
}

// Tenta extrair uma mensagem de erro estruturada (como a Focus/SEFAZ devolve
// em "erros"/"errors", geralmente com {campo, mensagem} por item) do corpo
// bruto de um ApiError — a mensagem genérica sozinha costuma esconder qual
// campo/item da nota causou a rejeição.
export function formatNfeProviderError(err: unknown, fallback: string): string {
  const body = err instanceof ApiError ? err.body : null
  if (!body || typeof body !== 'object') {
    return err instanceof ApiError ? err.message : fallback
  }

  const record = body as Record<string, unknown>
  const providerErrors = record.erros ?? record.erros_schema ?? record.errors
  if (Array.isArray(providerErrors) && providerErrors.length) {
    const messages = providerErrors.map((item) => formatNfeProviderErrorItem(item)).filter(Boolean)
    const mainMessage = record.mensagem ?? record.message ?? record.mensagem_sefaz
    if (typeof mainMessage === 'string' && mainMessage && !messages.includes(mainMessage)) {
      messages.unshift(mainMessage)
    }
    if (messages.length) return messages.join('\n')
  }

  if (typeof record.mensagem === 'string') return record.mensagem
  if (typeof record.message === 'string') return record.message
  if (typeof record.mensagem_sefaz === 'string') return record.mensagem_sefaz

  return err instanceof ApiError ? err.message : fallback
}

// Formata a mensagem_sefaz já persistida na NF-e (não um erro de requisição
// recém-feita) — mesma lógica de erros estruturados (erros/campo/mensagem),
// mas lendo a string já salva no registro em vez do corpo de um ApiError.
export function formatNfeMensagemSefaz(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return 'Sem mensagem de retorno.'
  if (typeof value !== 'string') return String(value)

  const trimmed = value.trim()
  if (!trimmed) return 'Sem mensagem de retorno.'

  let parsed: unknown
  try {
    parsed = JSON.parse(trimmed)
  } catch {
    return trimmed
  }

  if (parsed && typeof parsed === 'object') {
    const record = parsed as Record<string, unknown>
    const providerErrors = record.erros ?? record.erros_schema ?? record.errors
    if (Array.isArray(providerErrors) && providerErrors.length) {
      const messages = providerErrors.map((item) => formatNfeProviderErrorItem(item)).filter(Boolean)
      const mainMessage = record.mensagem ?? record.message
      if (typeof mainMessage === 'string' && mainMessage && !messages.includes(mainMessage)) {
        messages.unshift(mainMessage)
      }
      if (messages.length) return messages.join('\n')
    }
  }

  try {
    return JSON.stringify(parsed, null, 2)
  } catch {
    return trimmed
  }
}

function formatNfeProviderErrorItem(item: unknown): string {
  if (!item) return ''
  if (typeof item === 'string') return item

  const record = item as Record<string, unknown>
  const field = record.campo ?? record.field
  const message = record.mensagem ?? record.message ?? record.erro ?? record.error

  if (field && message) return `${field}: ${message}`
  if (typeof message === 'string') return message
  if (typeof field === 'string') return field
  try {
    return JSON.stringify(item)
  } catch {
    return ''
  }
}

export function fetchNfeLogs(token: string, id: string) {
  return apiGet<NfeSendLogRecord[]>(`/nfe/${id}/logs`, {}, token)
}

export async function fetchNfeFileUrl(token: string, id: string, type: 'xml' | 'danfe'): Promise<string> {
  const blob = await apiFetchBlob(`/nfe/${id}/file/${type}`, {}, token)
  return URL.createObjectURL(blob)
}

// Prévia do DANFE: assina localmente pra ter chave/QR-code coerentes, mas
// nunca transmite pra SEFAZ (o PDF sai com marca d'água "SEM VALOR FISCAL").
// Só funciona pra empresas com nfe_provider = 'delphi' (nosso servidor
// próprio) — a Focus NFe não expõe geração de DANFE sem autorização.
export async function fetchNfePreviewDanfeUrl(token: string, id: string): Promise<string> {
  const blob = await apiFetchBlob(`/nfe/${id}/preview-danfe`, {}, token)
  return URL.createObjectURL(blob)
}
