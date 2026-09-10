import { apiGet } from './api'

export interface NcmRecord {
  id: string
  code: string
  description: string
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

// Catálogo global (não é por empresa) — só busca, sem cadastro no app.
export function fetchNcms(token: string, options: { search?: string; page?: number; limit?: number } = {}) {
  return apiGet<Paginated<NcmRecord>>(
    '/ncm',
    {
      search: options.search,
      page: options.page ? String(options.page) : '1',
      limit: options.limit ? String(options.limit) : '10',
    },
    token
  )
}
