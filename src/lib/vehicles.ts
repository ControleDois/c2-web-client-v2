import { apiGet, apiPostForm, apiPutForm, apiDelete, apiPost } from './api'

export interface VehicleDocument {
  id: string
  title: string
  description?: string | null
  file_url?: string | null
  file_name?: string | null
  file_size?: number | null
}

export interface VehicleDocumentInput {
  id?: string
  title: string
  description?: string
  file?: File
}

export interface VehicleRecord {
  id: string
  code?: number
  internal_code?: number | null
  role?: number
  brand?: string | null
  model?: string | null
  license_plate: string
  color?: string | null
  vin_number?: string | null
  reindeer?: string | null
  fipe_code?: string | null
  fipe_value?: number | null
  fabrication_year?: string | null
  model_year?: string | null
  fuel?: string | null
  transmission?: string | null
  mileage?: number | null
  status?: number[]
  note?: string | null
  documents?: VehicleDocument[]
  createdAt?: string
  created_at?: string
}

export interface VehiclePayload {
  company_id: string
  internal_code?: number
  role: number
  brand?: string
  model?: string
  license_plate: string
  color?: string
  vin_number?: string
  reindeer?: string
  fipe_code?: string
  fipe_value?: number
  fabrication_year?: string
  model_year?: string
  fuel?: string
  transmission?: string
  mileage?: number
  status?: number[]
  note?: string
  documents?: VehicleDocumentInput[]
}

export interface VehicleFipeResult {
  codigo?: number | string
  msg?: string
  fipe?: Array<{
    modelo?: string
    codigo_fipe?: string
    valor?: number
    combustivel?: string
    marca?: string
    cor?: string
    chassi?: string
    ano?: string
    ano_modelo?: string
  }>
}

interface Paginated<T> {
  data: T[]
  meta: {
    total: number
    per_page: number
    current_page: number
    last_page: number
  }
}

export const VEHICLE_ROLE_LABELS: Record<number, string> = {
  0: 'Moto',
  1: 'Carro',
}

export const VEHICLE_STATUS_LABELS: Record<number, string> = {
  0: 'Ativo',
  1: 'Inativo',
}

export const VEHICLE_COLORS = [
  'AMARELO', 'AZUL', 'BEGE', 'BRANCO', 'CINZA', 'DOURADO', 'GRENA', 'LARANJA',
  'MARROM', 'PRATA', 'PRETO', 'ROSA', 'ROXO', 'VERDE', 'VERMELHO', 'FANTASIA',
]

export const TRANSMISSION_TYPES = [
  'MANUAL', 'AUTOMATICO', 'CVT', 'AUTOMATIZADO', 'DUPLA_EMBREAGEM', 'SEMIAUTOMATICO',
]

export const FUEL_TYPES = ['FLEX', 'GASOLINA', 'ALCOOL', 'DIESEL', 'GNV', 'ELETRICO', 'HIBRIDO', 'OUTRO']

export function fetchVehicles(
  token: string,
  companyId: string,
  options: { search?: string; page?: number; limit?: number; role?: number; status?: number } = {}
) {
  return apiGet<Paginated<VehicleRecord>>(
    '/vehicle',
    {
      companyId,
      search: options.search,
      page: options.page ? String(options.page) : '1',
      limit: options.limit ? String(options.limit) : '10',
      role: options.role !== undefined ? String(options.role) : undefined,
      status: options.status !== undefined ? `{${options.status}}` : undefined,
      orderBy: 'license_plate',
      sortedBy: 'asc',
    },
    token
  )
}

export function fetchVehicle(token: string, id: string) {
  return apiGet<VehicleRecord>(`/vehicle/${id}`, {}, token)
}

export function fetchVehicleFipe(token: string, licensePlate: string) {
  return apiGet<VehicleFipeResult>('/search-fipe', { licensePlate }, token)
}

function buildVehicleForm(payload: VehiclePayload): FormData {
  const form = new FormData()

  const plainFields: [string, string | number | undefined][] = [
    ['company_id', payload.company_id],
    ['internal_code', payload.internal_code],
    ['role', payload.role],
    ['brand', payload.brand],
    ['model', payload.model],
    ['license_plate', payload.license_plate],
    ['color', payload.color],
    ['vin_number', payload.vin_number],
    ['reindeer', payload.reindeer],
    ['fipe_code', payload.fipe_code],
    ['fipe_value', payload.fipe_value],
    ['fabrication_year', payload.fabrication_year],
    ['model_year', payload.model_year],
    ['fuel', payload.fuel],
    ['transmission', payload.transmission],
    ['mileage', payload.mileage],
    ['note', payload.note],
  ]
  for (const [key, value] of plainFields) {
    if (value !== undefined && value !== '') form.append(key, String(value))
  }

  for (const statusId of payload.status ?? []) {
    form.append('status[]', String(statusId))
  }

  payload.documents?.forEach((doc, index) => {
    if (doc.id) form.append(`documents[${index}][id]`, doc.id)
    form.append(`documents[${index}][title]`, doc.title)
    form.append(`documents[${index}][description]`, doc.description ?? '')
    if (doc.file) form.append(`documents[${index}][file]`, doc.file)
  })

  return form
}

export function createVehicle(token: string, payload: VehiclePayload) {
  return apiPostForm<VehicleRecord>('/vehicle', buildVehicleForm(payload), token)
}

export function updateVehicle(token: string, id: string, payload: VehiclePayload) {
  return apiPutForm<VehicleRecord>(`/vehicle/${id}`, buildVehicleForm(payload), token)
}

export function deleteVehicle(token: string, id: string) {
  return apiDelete<void>(`/vehicle/${id}`, token)
}

export function deleteVehiclesSelected(token: string, ids: string[]) {
  return apiPost<void>('/vehicle/destroy-selected', { ids }, token)
}
