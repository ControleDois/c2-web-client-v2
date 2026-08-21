import { apiGet, apiPost, apiPut, apiDelete } from './api'

export interface TowingPerson {
  id: string
  name: string
  document?: string | null
  phone?: string | null
}

export interface TowingVehicle {
  id: string
  brand?: string | null
  model?: string | null
  license_plate?: string | null
}

export interface TowingSaleAddress {
  zip_code?: string
  address?: string
  number?: string
  state?: string
  city?: string
  district?: string
  complement?: string
}

export interface TowingSaleCollectionStatusHistory {
  id: string
  code?: number
  towing_sale_id?: string
  user_id?: string | null
  previous_status?: number | null
  new_status: number
  observation?: string
  changed_at?: string
  user?: TowingPerson | null
}

export interface TowingSaleRecord {
  id: string
  code: number
  status: number
  collection_status?: number
  collection_driver_id?: string | null
  vehicle_inspection_id?: string | null
  type?: string
  transport_value: number
  deadline_days?: number
  notes?: string | null
  createdAt?: string
  created_at?: string
  driver_started_at?: string | null
  collection_failed_at?: string | null
  collected_at?: string | null
  delivered_at?: string | null
  people?: TowingPerson | null
  people_id?: string
  vehicle?: TowingVehicle | null
  vehicle_id?: string
  user?: TowingPerson | null
  user_id?: string
  collectionDriver?: TowingPerson | null
  vehicleInspection?: { id: string; code?: number; status?: number; customer_signature_url?: string | null } | null
  collectionStatusHistories?: TowingSaleCollectionStatusHistory[]
  origin_zip_code?: string
  origin_address?: string
  origin_number?: string
  origin_state?: string
  origin_city?: string
  origin_district?: string
  origin_complement?: string
  destination_zip_code?: string
  destination_address?: string
  destination_number?: string
  destination_state?: string
  destination_city?: string
  destination_district?: string
  destination_complement?: string
  autentique_short_link?: string | null
  autentiqueShortLink?: string | null
}

export interface TowingSalePayload {
  companyId: string
  people_id?: string
  vehicle_id?: string
  user_id?: string
  status: number
  type: string
  transport_value: number
  deadline_days: number
  origin_zip_code?: string
  origin_address?: string
  origin_number?: string
  origin_state?: string
  origin_city?: string
  origin_district?: string
  origin_complement?: string
  destination_zip_code?: string
  destination_address?: string
  destination_number?: string
  destination_state?: string
  destination_city?: string
  destination_district?: string
  destination_complement?: string
  notes?: string
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

export const TOWING_TYPE_LABELS: Record<string, string> = {
  retirada: 'Entrega na base',
  coleta: 'Coleta / Guincho',
}

export const TOWING_SALE_SIGNED_STATUS = 3
export const TOWING_SALE_CANCELED_STATUS = 4
export const TOWING_SALE_COMPLETED_STATUS = 5

export const COLLECTION_STATUS_WAITING_PICKUP = 0
export const COLLECTION_STATUS_GOING_TO_PICKUP = 1
export const COLLECTION_STATUS_PICKUP_FAILED = 2
export const COLLECTION_STATUS_COLLECTED = 3
export const COLLECTION_STATUS_DELIVERED = 4

export const COLLECTION_STATUS_LABELS: Record<number, string> = {
  0: 'Aguardando retirada',
  1: 'Indo retirar',
  2: 'Retirada não efetuada',
  3: 'Veículo coletado',
  4: 'Veículo entregue',
}

export function getContractLink(sale: TowingSaleRecord): string {
  return sale.autentique_short_link || sale.autentiqueShortLink || ''
}

export function fetchTowingSales(
  token: string,
  companyId: string,
  options: { search?: string; dateStart?: string; dateEnd?: string } = {}
) {
  return apiGet<Paginated<TowingSaleRecord>>(
    '/towing-sale',
    {
      companyId,
      search: options.search,
      dateStart: options.dateStart,
      dateEnd: options.dateEnd,
      page: '1',
      limit: '500',
      orderBy: 'created_at',
      sortedBy: 'desc',
    },
    token
  )
}

export function fetchTowingDriverQueue(
  token: string,
  companyId: string,
  options: { search?: string; driverId?: string } = {}
) {
  return apiGet<Paginated<TowingSaleRecord>>(
    '/towing-sale/driver-queue',
    { companyId, search: options.search, driverId: options.driverId, page: '1', limit: '500' },
    token
  )
}

export function updateTowingCollectionStatus(
  token: string,
  id: string,
  payload: { status: number; userId?: string; observation?: string; vehicleInspectionId?: string }
) {
  return apiPost<TowingSaleRecord>(`/towing-sale/update-collection-status/${id}`, payload, token)
}

export function fetchTowingSale(token: string, id: string) {
  return apiGet<TowingSaleRecord>(`/towing-sale/${id}`, {}, token)
}

export function createTowingSale(token: string, payload: TowingSalePayload) {
  return apiPost<TowingSaleRecord>('/towing-sale', payload, token)
}

export function updateTowingSale(token: string, id: string, payload: TowingSalePayload) {
  return apiPut<TowingSaleRecord>(`/towing-sale/${id}`, payload, token)
}

export function deleteTowingSale(token: string, id: string) {
  return apiDelete<void>(`/towing-sale/${id}`, token)
}

// O backend não tem endpoint de exclusão em lote para vendas de guincho —
// removemos uma por uma para manter a mesma experiência das outras listagens.
export function deleteTowingSalesSelected(token: string, ids: string[]) {
  return Promise.all(ids.map((id) => deleteTowingSale(token, id)))
}

// O backend recebe o novo status via query string (?status=N), não no corpo.
export function updateTowingSaleStatus(token: string, id: string, status: number) {
  return apiPost<TowingSaleRecord>(`/towing-sale/update-status/${id}?status=${status}`, {}, token)
}

export function printTowingSaleContract(token: string, id: string) {
  return apiPost<{ url: string; html: string }>(`/towing-sale/print-contract/${id}`, {}, token)
}

export function sendTowingSaleContract(
  token: string,
  id: string,
  payload: { contractTemplateId: string; whatsappId?: string }
) {
  return apiPost<{
    fileUrl: string
    contractLink: string
    whatsappQueued: boolean
    whatsappError: string | null
  }>(`/towing-sale/send-contract/${id}`, payload, token)
}

export function sendTowingSaleContractLink(token: string, id: string, whatsappId: string) {
  return apiPost<{ message: string; whatsappQueued: boolean }>(
    `/towing-sale/send-contract-link/${id}`,
    { whatsappId },
    token
  )
}
