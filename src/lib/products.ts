import { apiGet, apiPost, apiPut, apiDelete } from './api'

export interface ProductCategoryRef {
  id: string
  name: string
  code?: number
}

export interface ProductRecord {
  id: string
  code?: number
  internal_code?: number | null
  company_id?: string
  role: number
  name: string
  sale_value?: number | null
  description?: string | null
  barcode?: string | null
  unit?: string | null
  categories?: ProductCategoryRef[]
}

export interface ProductPayload {
  company_id: string
  role: number
  name: string
  internal_code?: number
  sale_value?: number
  description?: string
  barcode?: string
  unit?: string
  categories?: { id?: string; name?: string }[]
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

export const PRODUCT_ROLE_LABELS: Record<number, string> = {
  0: 'Produto',
  1: 'Serviço',
}

export const PRODUCT_UNIT_OPTIONS: { value: string; label: string }[] = [
  { value: 'CA', label: 'CA - Caixa' },
  { value: 'CX', label: 'CX - Caixa Grande' },
  { value: 'UN', label: 'UN - Unidade' },
  { value: 'KG', label: 'KG - Quilograma' },
  { value: 'LT', label: 'LT - Litro' },
  { value: 'ML', label: 'ML - Mililitro' },
  { value: 'MT', label: 'MT - Metro' },
  { value: 'M2', label: 'M2 - Metro Quadrado' },
  { value: 'M3', label: 'M3 - Metro Cúbico' },
  { value: 'PC', label: 'PC - Peça' },
  { value: 'PT', label: 'PT - Pacote' },
  { value: 'CXA', label: 'CXA - Caixa com 10 unidades' },
  { value: 'DZ', label: 'DZ - Dúzia' },
  { value: 'GR', label: 'GR - Grama' },
  { value: 'CM', label: 'CM - Centímetro' },
  { value: 'MM', label: 'MM - Milímetro' },
  { value: 'PAR', label: 'PAR - Par' },
  { value: 'MIL', label: 'MIL - Milheiro' },
  { value: 'TON', label: 'TON - Tonelada' },
  { value: 'GAL', label: 'GAL - Galão' },
  { value: 'BD', label: 'BD - Barril' },
  { value: 'AM', label: 'AM - Ampola' },
  { value: 'FR', label: 'FR - Frasco' },
  { value: 'BL', label: 'BL - Bloco' },
  { value: 'SC', label: 'SC - Saco' },
  { value: 'RL', label: 'RL - Rolo' },
  { value: 'FT', label: 'FT - Fardo' },
  { value: 'CP', label: 'CP - Copo' },
  { value: 'PF', label: 'PF - Pacote Fechado' },
  { value: 'TM', label: 'TM - Tambor' },
  { value: 'HB', label: 'HB - Hábito' },
  { value: 'CJ', label: 'CJ - Conjunto' },
  { value: 'CD', label: 'CD - Cento' },
  { value: 'TP', label: 'TP - Tipo' },
  { value: 'TO', label: 'TO - Toalha' },
  { value: 'ES', label: 'ES - Estojo' },
  { value: 'PE', label: 'PE - Pente' },
]

export function fetchProducts(
  token: string,
  companyId: string,
  options: { search?: string; page?: number; limit?: number; role?: number } = {}
) {
  return apiGet<Paginated<ProductRecord>>(
    '/product',
    {
      companyId,
      search: options.search,
      page: options.page ? String(options.page) : '1',
      limit: options.limit ? String(options.limit) : '10',
      role: options.role !== undefined ? String(options.role) : undefined,
    },
    token
  )
}

export function fetchProduct(token: string, id: string) {
  return apiGet<ProductRecord>(`/product/${id}`, {}, token)
}

export function createProduct(token: string, payload: ProductPayload) {
  return apiPost<ProductRecord>('/product', payload, token)
}

export function updateProduct(token: string, id: string, payload: ProductPayload) {
  return apiPut<ProductRecord>(`/product/${id}`, payload, token)
}

export function deleteProduct(token: string, id: string) {
  return apiDelete<void>(`/product/${id}`, token)
}

// O backend não tem endpoint de exclusão em lote para produtos/serviços —
// removemos um por um para manter a mesma experiência das outras listagens.
export function deleteProductsSelected(token: string, ids: string[]) {
  return Promise.all(ids.map((id) => deleteProduct(token, id)))
}
