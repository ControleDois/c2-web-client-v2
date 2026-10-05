export const API_BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3333'

export class ApiError extends Error {
  status: number
  // Corpo bruto (já parseado) da resposta de erro, quando veio JSON — usado
  // por telas que precisam de mais detalhe do que a mensagem genérica, como
  // os erros estruturados que a Focus/SEFAZ devolvem no envio de NFe.
  body?: unknown

  constructor(message: string, status: number, body?: unknown) {
    super(message)
    this.status = status
    this.body = body
  }
}

function extractMessage(raw: unknown): string | null {
  if (typeof raw !== 'object' || raw === null) return null
  if ('message' in raw && typeof raw.message === 'string') return raw.message
  if ('errors' in raw && Array.isArray(raw.errors) && raw.errors[0]?.message) {
    return String(raw.errors[0].message)
  }
  return null
}

function fallbackMessage(status: number): string {
  if (status === 0) return 'Não foi possível conectar ao servidor. Verifique sua conexão.'
  if (status === 401) return 'Sua sessão expirou. Entre novamente.'
  if (status === 429) return 'Muitas tentativas. Aguarde um instante e tente novamente.'
  if (status >= 500) return 'O servidor teve um problema ao processar sua solicitação. Tente novamente em instantes.'
  return 'Não foi possível completar a requisição. Tente novamente.'
}

function resolveErrorMessage(status: number, raw: unknown): string {
  // Erros 5xx costumam trazer detalhes técnicos internos (SQL, stack) — não é
  // seguro nem útil mostrar isso ao usuário, então sempre usamos a mensagem genérica.
  if (status >= 500) return fallbackMessage(status)
  return extractMessage(raw) ?? fallbackMessage(status)
}

const NUMBER_FIELD_LABELS: Record<string, string> = {
  amount: 'Valor',
  bill_value: 'Valor pago',
  discount: 'Desconto',
  fees: 'Juros',
  sale_value: 'Valor de venda',
  cost_value: 'Valor de custo',
  purchase_cost: 'Custo de compra',
  monthlyValue: 'Valor',
  securityDeposit: 'Caução',
  limit_credit: 'Limite de crédito',
  delivery_fee: 'Taxa de entrega',
  minimum_order_value: 'Pedido mínimo',
  net_total: 'Total',
  quantity: 'Quantidade',
}

function numberFieldLabel(key: string): string {
  if (NUMBER_FIELD_LABELS[key]) return NUMBER_FIELD_LABELS[key]
  const spaced = key.replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').trim()
  return spaced ? spaced.charAt(0).toUpperCase() + spaced.slice(1) : 'numérico'
}

// Escudo contra "NaN": se algum campo numérico chegou inválido (ex.: valor
// digitado com vírgula num campo sem máscara), avisa qual campo é em vez de
// mandar null e receber um erro técnico do servidor.
function serializeBody(body: unknown): string {
  return JSON.stringify(body, (key, value) => {
    if (typeof value === 'number' && !Number.isFinite(value)) {
      throw new ApiError(`O campo "${numberFieldLabel(key)}" está com um número inválido. Confira o valor digitado.`, 422)
    }
    return value
  })
}

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  token?: string
  body?: unknown
  form?: FormData
  params?: Record<string, string | undefined>
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', token, body, form, params } = options

  const url = new URL(`${API_BASE_URL}${path}`)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') url.searchParams.set(key, value)
    }
  }

  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (!form) headers['Content-Type'] = 'application/json'

  const requestBody = form ?? (body !== undefined ? serializeBody(body) : undefined)

  let response: Response
  try {
    response = await fetch(url.toString(), {
      method,
      headers,
      body: requestBody,
    })
  } catch {
    throw new ApiError(fallbackMessage(0), 0)
  }

  const data = await response.json().catch(() => null)

  if (!response.ok) {
    throw new ApiError(resolveErrorMessage(response.status, data), response.status, data)
  }

  return data as T
}

export function apiGet<T>(path: string, params?: Record<string, string | undefined>, token?: string): Promise<T> {
  return request<T>(path, { method: 'GET', params, token })
}

export function apiPost<T>(
  path: string,
  body: unknown,
  token?: string,
  params?: Record<string, string | undefined>
): Promise<T> {
  return request<T>(path, { method: 'POST', body, params, token })
}

export function apiPut<T>(path: string, body: unknown, token?: string): Promise<T> {
  return request<T>(path, { method: 'PUT', body, token })
}

export function apiDelete<T>(path: string, token?: string, body?: unknown): Promise<T> {
  return request<T>(path, { method: 'DELETE', token, body })
}

export function apiPatch<T>(path: string, body: unknown, token?: string): Promise<T> {
  return request<T>(path, { method: 'PATCH', body, token })
}

export function apiPostForm<T>(path: string, form: FormData, token?: string): Promise<T> {
  return request<T>(path, { method: 'POST', form, token })
}

export function apiPutForm<T>(path: string, form: FormData, token?: string): Promise<T> {
  return request<T>(path, { method: 'PUT', form, token })
}

export async function apiFetchBlob(
  path: string,
  params: Record<string, string | undefined> | undefined,
  token: string
): Promise<Blob> {
  const url = new URL(`${API_BASE_URL}${path}`)
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      if (value !== undefined && value !== '') url.searchParams.set(key, value)
    }
  }

  let response: Response
  try {
    response = await fetch(url.toString(), { headers: { Authorization: `Bearer ${token}` } })
  } catch {
    throw new ApiError(fallbackMessage(0), 0)
  }

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new ApiError(resolveErrorMessage(response.status, data), response.status, data)
  }

  return response.blob()
}

export async function apiDownload(path: string, token: string, filename: string): Promise<void> {
  let response: Response
  try {
    response = await fetch(`${API_BASE_URL}${path}`, { headers: { Authorization: `Bearer ${token}` } })
  } catch {
    throw new ApiError(fallbackMessage(0), 0)
  }

  if (!response.ok) {
    const data = await response.json().catch(() => null)
    throw new ApiError(resolveErrorMessage(response.status, data), response.status)
  }

  const blob = await response.blob()
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(url)
}
