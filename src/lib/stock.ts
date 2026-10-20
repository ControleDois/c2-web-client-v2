import { apiGet, apiPost, apiPut, apiDelete } from './api'

interface Paginated<T> {
  data: T[]
  meta?: { total: number; per_page: number; current_page: number; last_page: number }
}

export type StockStatus = 'ok' | 'low' | 'empty' | 'negative'

export interface StockSituationRow {
  id: string
  code?: number
  name: string
  unit?: string | null
  barcode?: string | null
  role: number
  is_ingredient: boolean
  controls_stock: boolean
  min_stock: number | null
  available_stock: number
  reserved_stock: number
  average_cost: number
  stock_value: number
  stock_status: StockStatus
  has_recipe: boolean
  // Só para produto com ficha técnica: quantas unidades dá para fazer com os insumos que tem.
  producible: number | null
}

export interface StockSummary {
  items: number
  ingredients: number
  negative: number
  empty: number
  low: number
  stock_value: number
}

export type StockMovementType = 'entry' | 'exit' | 'transfer_in' | 'transfer_out' | 'manual' | 'inventory' | 'cost_adjustment' | 'reservation' | 'reservation_release'

export type StockReason = 'purchase' | 'loss' | 'expired' | 'internal_use' | 'adjustment' | 'other'

export interface StockMovementRecord {
  id: string
  code?: number
  movement_type: StockMovementType
  origin_type: string
  origin_id?: string | null
  quantity: number
  unit_cost: number
  total_cost: number
  balance_after: number
  movement_at: string
  description?: string | null
  reason?: StockReason | null
  product?: { id: string; name: string; unit?: string | null } | null
}

export interface StockInventoryItemRecord {
  id: string
  product_id: string
  system_quantity: number
  counted_quantity: number
  difference_quantity: number
  unit_cost: number
  note?: string | null
  product?: { id: string; name: string; unit?: string | null } | null
}

export interface StockInventoryRecord {
  id: string
  code?: number
  status: number
  inventory_at: string
  closed_at?: string | null
  description?: string | null
  items?: StockInventoryItemRecord[]
}

export interface RecipeItemRecord {
  id: string
  ingredient_id: string
  name: string
  unit: string | null
  quantity: number
  loss_percent: number
  unit_cost: number
  line_cost: number
  available: number
}

export interface RecipeRecord {
  items: RecipeItemRecord[]
  cost: number
  sale_value: number
  margin: number
  margin_percent: number | null
  producible: number
}

export const STOCK_STATUS_LABELS: Record<StockStatus, string> = {
  ok: 'Em dia',
  low: 'Baixo',
  empty: 'Zerado',
  negative: 'Negativo',
}

export const MOVEMENT_TYPE_LABELS: Record<string, string> = {
  entry: 'Entrada',
  exit: 'Saída',
  transfer_in: 'Transferência (entrada)',
  transfer_out: 'Transferência (saída)',
  manual: 'Ajuste',
  inventory: 'Inventário',
  cost_adjustment: 'Ajuste de custo',
  reservation: 'Reserva',
  reservation_release: 'Reserva liberada',
}

export const REASON_LABELS: Record<StockReason, string> = {
  purchase: 'Compra',
  loss: 'Perda ou quebra',
  expired: 'Vencimento',
  internal_use: 'Consumo interno',
  adjustment: 'Ajuste',
  other: 'Outro motivo',
}

export const ORIGIN_LABELS: Record<string, string> = {
  sale: 'Venda',
  delivery_order: 'Pedido de delivery',
  purchase_note: 'Nota de compra',
  inventory: 'Inventário',
  manual: 'Lançamento manual',
  order_service: 'Ordem de serviço',
}

export function fetchStockSituation(
  token: string,
  companyId: string,
  options: { search?: string; status?: string; type?: string; page?: number; limit?: number } = {}
) {
  return apiGet<Paginated<StockSituationRow>>(
    '/stock/situation',
    {
      companyId,
      search: options.search || undefined,
      status: options.status || undefined,
      type: options.type || undefined,
      page: options.page ? String(options.page) : '1',
      limit: options.limit ? String(options.limit) : '20',
    },
    token
  )
}

export function fetchStockSummary(token: string, companyId: string) {
  return apiGet<StockSummary>('/stock/summary', { companyId }, token)
}

export function fetchStockMovements(
  token: string,
  companyId: string,
  options: {
    search?: string
    movementType?: string
    productId?: string
    reason?: string
    dateStart?: string
    dateEnd?: string
    page?: number
    limit?: number
  } = {}
) {
  return apiGet<Paginated<StockMovementRecord>>(
    '/stock/movements',
    {
      companyId,
      search: options.search || undefined,
      movementType: options.movementType || undefined,
      productId: options.productId || undefined,
      reason: options.reason || undefined,
      dateStart: options.dateStart || undefined,
      dateEnd: options.dateEnd || undefined,
      page: options.page ? String(options.page) : '1',
      limit: options.limit ? String(options.limit) : '20',
    },
    token
  )
}

export interface StockMovementPayload {
  companyId: string
  movementType: 'entry' | 'exit' | 'manual'
  reason?: StockReason
  description?: string
  items: { productId: string; quantity: number; unitCost?: number }[]
}

export function createStockMovement(token: string, payload: StockMovementPayload) {
  return apiPost<{ message: string }>('/stock/manual-movements', payload, token)
}

export function fetchStockInventories(token: string, companyId: string, options: { page?: number; limit?: number } = {}) {
  return apiGet<Paginated<StockInventoryRecord>>(
    '/stock/inventories',
    { companyId, page: options.page ? String(options.page) : '1', limit: options.limit ? String(options.limit) : '20' },
    token
  )
}

export function fetchStockInventory(token: string, id: string) {
  return apiGet<StockInventoryRecord>(`/stock/inventories/${id}`, {}, token)
}

export function createStockInventory(
  token: string,
  payload: {
    companyId: string
    description?: string
    close: boolean
    items: { productId: string; countedQuantity: number; note?: string }[]
  }
) {
  return apiPost<{ message: string; data: StockInventoryRecord }>('/stock/inventories', payload, token)
}

export function closeStockInventory(token: string, id: string) {
  return apiPost<StockInventoryRecord>(`/stock/inventories/${id}/close`, {}, token)
}

export function deleteStockInventory(token: string, id: string) {
  return apiDelete<StockInventoryRecord>(`/stock/inventories/${id}`, token)
}

export function fetchRecipe(token: string, productId: string) {
  return apiGet<RecipeRecord>(`/product-recipe/${productId}`, {}, token)
}

export function saveRecipe(token: string, productId: string, items: { ingredient_id: string; quantity: number; loss_percent: number }[]) {
  return apiPut<RecipeRecord>(`/product-recipe/${productId}`, { items }, token)
}

// 1 → "1", 1.5 → "1,5", 0.165 → "0,165" (até 3 casas, sem zeros sobrando).
export function formatStockQuantity(value: number): string {
  return Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 3 })
}
