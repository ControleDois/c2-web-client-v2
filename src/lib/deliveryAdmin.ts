import { apiGet, apiPost, apiPut, apiDelete } from './api'

export interface DeliveryCourierRecord {
  id: string
  code?: number
  name: string
  phone: string | null
  vehicle: string | null
  vehicle_id: string | null
  linkedVehicle?: {
    id: string
    license_plate: string
    brand?: string | null
    model?: string | null
    color?: string | null
  } | null
  is_active: boolean
}

// "Honda CG 160 · ABC1D23" da moto cadastrada; sem moto vinculada usa o texto livre.
export function courierVehicleLabel(courier: Pick<DeliveryCourierRecord, 'vehicle' | 'linkedVehicle'>): string {
  const linked = courier.linkedVehicle
  if (linked) {
    const label = [[linked.brand, linked.model].filter(Boolean).join(' '), linked.license_plate]
      .filter(Boolean)
      .join(' · ')
    if (label) return label
  }
  return courier.vehicle || ''
}

export interface DeliveryNeighborhoodRecord {
  id: string
  code?: number
  name: string
  delivery_fee: number | string
  estimated_minutes: number | null
  is_active: boolean
}

interface Paginated<T> {
  data: T[]
}

export function fetchDeliveryCouriers(token: string, companyId: string) {
  return apiGet<Paginated<DeliveryCourierRecord>>('/delivery-courier', { companyId, limit: '200' }, token)
}

export function saveDeliveryCourier(
  token: string,
  companyId: string,
  payload: { id?: string; name: string; phone: string; vehicle: string; vehicle_id: string | null; is_active: boolean }
) {
  const { id, ...body } = payload
  return id
    ? apiPut<DeliveryCourierRecord>(`/delivery-courier/${id}`, body, token)
    : apiPost<DeliveryCourierRecord>('/delivery-courier', { company_id: companyId, ...body }, token)
}

export function deleteDeliveryCourier(token: string, id: string) {
  return apiDelete<void>(`/delivery-courier/${id}`, token)
}

export function fetchDeliveryNeighborhoods(token: string, companyId: string) {
  return apiGet<Paginated<DeliveryNeighborhoodRecord>>('/delivery-neighborhood', { companyId, limit: '500' }, token)
}

export function saveDeliveryNeighborhood(
  token: string,
  companyId: string,
  payload: { id?: string; name: string; delivery_fee: number; estimated_minutes: number | null; is_active: boolean }
) {
  const { id, ...body } = payload
  return id
    ? apiPut<DeliveryNeighborhoodRecord>(`/delivery-neighborhood/${id}`, body, token)
    : apiPost<DeliveryNeighborhoodRecord>('/delivery-neighborhood', { company_id: companyId, ...body }, token)
}

export function deleteDeliveryNeighborhood(token: string, id: string) {
  return apiDelete<void>(`/delivery-neighborhood/${id}`, token)
}
