import { apiDelete, apiGet, apiPost } from './api'

export type AiUsageSource = 'owner' | 'customer' | 'proactive' | 'general'

export const AI_SOURCE_LABELS: Record<string, string> = {
  owner: 'Assistente do gestor',
  customer: 'Atendimento a clientes',
  proactive: 'Mensagens iniciadas pela IA (cobrança)',
  general: 'Agente geral',
}

export interface AiBalance {
  credits_total_usd: number
  used_usd: number
  balance_usd: number
  counting_since: string | null
  daily_average_usd: number
  days_left: number | null
  usd_brl_rate: number
}

export interface AiCompanyUsage {
  company_id: string
  name: string
  calls: number
  input_tokens: number
  output_tokens: number
  cost_usd: number
  by_source: Record<string, number>
}

export interface AiUsageSummary {
  start: string
  end: string
  balance: AiBalance
  period: {
    total_usd: number
    companies: AiCompanyUsage[]
    sources: { source: string; calls: number; cost_usd: number }[]
    models: { model: string; calls: number; input_tokens: number; output_tokens: number; cost_usd: number }[]
    days: { day: string; cost_usd: number }[]
  }
}

export interface AiCompanyDetail {
  phones: { phone: string; source: string; calls: number; cost_usd: number; last_at: string }[]
  conversations: {
    meta: { total: number; per_page: number; current_page: number; last_page: number }
    data: {
      id: string
      source: string
      model: string | null
      phone: string
      question: string
      input_tokens: number
      output_tokens: number
      cost_usd: number
      created_at: string
    }[]
  }
}

export interface AiCredit {
  id: string
  amount_usd: string | number
  credited_at: string
  note: string | null
  created_by_name: string | null
  created_at: string
}

export function fetchAiUsageSummary(token: string, start: string, end: string) {
  return apiGet<AiUsageSummary>('/ai-usage/summary', { start, end }, token)
}

export function fetchAiCompanyUsage(token: string, companyId: string, start: string, end: string, page = 1) {
  return apiGet<AiCompanyDetail>(`/ai-usage/companies/${companyId}`, { start, end, page: String(page) }, token)
}

export function fetchAiCredits(token: string) {
  return apiGet<AiCredit[]>('/ai-usage/credits', {}, token)
}

export function createAiCredit(token: string, payload: { amount_usd: number; credited_at: string; note?: string }) {
  return apiPost<{ id: string }>('/ai-usage/credits', payload, token)
}

export function deleteAiCredit(token: string, id: string) {
  return apiDelete<{ ok: boolean }>(`/ai-usage/credits/${id}`, token)
}

export function formatUsd(value: number | string, digits = 2) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(Number(value || 0))
}
