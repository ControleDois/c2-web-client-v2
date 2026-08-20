import { apiGet, apiPost, apiPut, apiDelete } from './api'

export interface BankCreditCard {
  id?: string
  name: string
  brand?: string | null
  last_digits?: string | null
  limit_value?: number | null
  closing_day: number
  due_day: number
  status?: number
}

export interface BankAccountRecord {
  id: string
  code?: number
  name: string
  balance?: number
  current_balance?: number
  date_balance?: string | null
  credit_cards?: BankCreditCard[]
}

export interface BankAccountPayload {
  company_id: string
  name: string
  balance?: number
  date_balance?: string
  credit_cards?: BankCreditCard[]
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

export function fetchBankAccounts(
  token: string,
  companyId: string,
  options: { search?: string; page?: number; limit?: number } = {}
) {
  return apiGet<Paginated<BankAccountRecord>>(
    '/bank',
    {
      companyId,
      search: options.search,
      page: options.page ? String(options.page) : '1',
      limit: options.limit ? String(options.limit) : '10',
    },
    token
  )
}

export function fetchBankAccount(token: string, id: string) {
  return apiGet<BankAccountRecord>(`/bank/${id}`, {}, token)
}

export function createBankAccount(token: string, payload: BankAccountPayload) {
  return apiPost<BankAccountRecord>('/bank', payload, token)
}

export function updateBankAccount(token: string, id: string, payload: BankAccountPayload) {
  return apiPut<BankAccountRecord>(`/bank/${id}`, payload, token)
}

export function deleteBankAccount(token: string, id: string) {
  return apiDelete<void>(`/bank/${id}`, token)
}

// O backend não tem endpoint de exclusão em lote para contas bancárias —
// removemos uma por uma para manter a mesma experiência das outras listagens.
export function deleteBankAccountsSelected(token: string, ids: string[]) {
  return Promise.all(ids.map((id) => deleteBankAccount(token, id)))
}
