import { apiGet, apiPost, apiPut, apiDelete } from './api'
import type { SalePerson, SaleVehicleRef } from './sales'

export interface OrderServiceItemRecord {
  id?: string
  productId: string
  item: number
  description?: string | null
  amount: number
  cost_value: number
  discount?: number | null
  subtotal: number
  total: number
  purchase_cost?: number | null
  supplier_people_id?: string | null
  note?: string | null
  product?: { id: string; name: string; role?: number } | null
  supplier?: { id: string; name: string } | null
}

export interface OrderServiceItemPayload {
  productId: string
  item: number
  description?: string
  amount: number
  cost_value: number
  discount?: number
  subtotal: number
  total: number
  purchase_cost?: number
  supplier_people_id?: string
  note?: string
}

export interface OrderServiceEventRecord {
  id: string
  status: number
  title: string
  description?: string | null
  eventAt: string
  user?: { id: string; name: string } | null
}

export interface OrderServiceRecord {
  id: string
  code?: number
  status: number
  date_start?: string | null
  date_finish?: string | null
  entryMileage?: number | null
  entryFuelLevel?: string | null
  note_service?: string | null
  reportedProblem?: string | null
  diagnosis?: string | null
  saleId?: string | null
  sale?: { id: string; code?: number } | null
  people?: SalePerson | null
  user?: SalePerson | null
  vehicle?: SaleVehicleRef | null
  items?: OrderServiceItemRecord[]
  events?: OrderServiceEventRecord[]
}

export interface OrderServicePayload {
  companyId: string
  peopleId?: string
  userId: string
  vehicleId?: string
  status: number
  date_start?: string
  date_finish?: string
  entryMileage?: number
  entryFuelLevel?: string
  note_service?: string
  items?: OrderServiceItemPayload[]
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

export const ORDER_SERVICE_STATUS_LABELS: Record<number, string> = {
  0: 'Veículo recebido',
  1: 'Início do diagnóstico',
  2: 'Diagnóstico concluído',
  3: 'Orçamento enviado',
  4: 'Orçamento aprovado',
  5: 'Início da execução',
  6: 'Serviço finalizado',
}

export function fetchOrderServices(
  token: string,
  companyId: string,
  options: {
    search?: string
    page?: number
    limit?: number
    date?: string
    dateStart?: string
    dateEnd?: string
    peopleId?: string
    vehicleId?: string
  } = {}
) {
  return apiGet<Paginated<OrderServiceRecord>>(
    '/orderService',
    {
      companyId,
      search: options.search,
      page: options.page ? String(options.page) : '1',
      limit: options.limit ? String(options.limit) : '500',
      date: options.dateStart || options.dateEnd ? undefined : options.date ?? new Date().toISOString().slice(0, 10),
      dateStart: options.dateStart,
      dateEnd: options.dateEnd,
      peopleId: options.peopleId,
      vehicleId: options.vehicleId,
    },
    token
  )
}

export function fetchOrderService(token: string, id: string) {
  return apiGet<OrderServiceRecord>(`/orderService/${id}`, {}, token)
}

export function createOrderService(token: string, payload: OrderServicePayload) {
  return apiPost<OrderServiceRecord>('/orderService', payload, token)
}

export function updateOrderService(token: string, id: string, payload: OrderServicePayload) {
  return apiPut<OrderServiceRecord>(`/orderService/${id}`, payload, token)
}

export function deleteOrderService(token: string, id: string) {
  return apiDelete<void>(`/orderService/${id}`, token)
}

export function updateOrderServiceStatus(token: string, id: string, status: number, description?: string) {
  return apiPut<OrderServiceRecord>(`/orderService/${id}/status`, { status, description }, token)
}

export function billOrderService(token: string, id: string) {
  return apiPost<{ sale: { id: string; code?: number } }>(`/orderService/${id}/bill`, {}, token)
}
