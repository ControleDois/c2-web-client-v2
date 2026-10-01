import { apiGet, apiPost, apiPut, apiDelete } from './api'

export interface InvestmentInstallmentRecord {
  id: string
  code?: number
  investment_id: string
  number: number
  due_date: string
  amount: number
  paid: boolean
  paid_at?: string | null
}

export interface InvestmentEntryRecord {
  id: string
  code?: number
  investment_id: string
  entry_date: string
  type: 'aporte' | 'custo' | 'retorno'
  description?: string | null
  amount: number
}

export interface InvestmentRecord {
  id: string
  code?: number
  company_id?: string
  name: string
  type: string
  status: 'ativo' | 'encerrado'
  start_date: string
  invested_amount: number
  current_amount?: number | null
  counterparty?: string | null
  expected_return?: string | null
  due_date?: string | null
  end_date?: string | null
  redemption_amount?: number | null
  notes?: string | null

  registration_number?: string | null
  notary_office?: string | null
  iptu_registration?: string | null
  property_type?: string | null
  address?: string | null
  neighborhood?: string | null
  city?: string | null
  zip_code?: string | null
  area?: number | null

  installment_count?: number | null
  interest_rate?: number | null
  interest_period?: 'mes' | 'ano' | null
  interest_system?: 'price' | 'simples' | null
  first_due_date?: string | null

  installments?: InvestmentInstallmentRecord[]
  entries?: InvestmentEntryRecord[]
  created_at?: string
}

export const INVESTMENT_TYPE_LABELS: Record<string, string> = {
  imovel: 'Imóvel',
  terreno: 'Terreno',
  emprestimo: 'Empréstimo a terceiros',
  aplicacao_financeira: 'Aplicação financeira',
  acoes_fundos: 'Ações / fundos',
  participacao_empresa: 'Participação em empresa',
  maquinas_equipamentos: 'Máquinas / equipamentos',
  consorcio: 'Consórcio',
  criptoativos: 'Criptoativos',
  outro: 'Outro',
}

export const PROPERTY_TYPES = ['imovel', 'terreno']

interface Paginated<T> {
  data: T[]
  meta?: { total: number; per_page: number; current_page: number; last_page: number }
}

export function fetchInvestments(
  token: string,
  companyId: string,
  options: { status?: string; search?: string; page?: number; limit?: number } = {}
) {
  return apiGet<Paginated<InvestmentRecord>>(
    '/investment',
    {
      companyId,
      status: options.status,
      search: options.search,
      page: options.page ? String(options.page) : '1',
      limit: options.limit ? String(options.limit) : '20',
    },
    token
  )
}

export function fetchInvestment(token: string, id: string) {
  return apiGet<InvestmentRecord>(`/investment/${id}`, {}, token)
}

export type InvestmentPayload = Omit<
  InvestmentRecord,
  'id' | 'code' | 'created_at' | 'installments' | 'entries' | 'company_id'
> & { company_id: string }

export function createInvestment(token: string, payload: InvestmentPayload) {
  return apiPost<InvestmentRecord>('/investment', payload, token)
}

export function updateInvestment(token: string, id: string, payload: Partial<InvestmentPayload>) {
  return apiPut<InvestmentRecord>(`/investment/${id}`, payload, token)
}

export function deleteInvestment(token: string, id: string) {
  return apiDelete<void>(`/investment/${id}`, token)
}

export function markInvestmentInstallment(token: string, installmentId: string, paid: boolean) {
  return apiPut<InvestmentInstallmentRecord>(`/investment-installment/${installmentId}`, { paid }, token)
}

export function addInvestmentEntry(
  token: string,
  payload: { company_id: string; investment_id: string; entry_date: string; type: string; description?: string; amount: number }
) {
  return apiPost<InvestmentEntryRecord>('/investment-entry', payload, token)
}

export function deleteInvestmentEntry(token: string, id: string) {
  return apiDelete<void>(`/investment-entry/${id}`, token)
}
