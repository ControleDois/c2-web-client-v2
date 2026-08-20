import { apiGet, apiPost, apiPut, apiDelete, apiPostForm, apiDownload } from './api'

export interface VehicleInspectionPhoto {
  id: string
  file_name?: string
  file_url: string
  file_size?: number
  name?: string | null
  description?: string | null
  check_number?: number
}

export interface VehicleInspectionRecord {
  id: string
  code?: number
  company_id?: string
  vehicle_id: string
  user_id?: string | null
  people_id?: string | null
  status: number
  customer_signature_url?: string | null
  customer_signer_name?: string | null
  customer_signed_at?: string | null
  driver_signature_url?: string | null
  driver_signer_name?: string | null
  driver_signed_at?: string | null
  created_at?: string
  photos?: VehicleInspectionPhoto[]
  vehicle?: { id: string; brand?: string | null; model?: string | null; license_plate?: string | null } | null
  people?: VehicleInspectionContactPerson | null
  user?: { id: string; name: string } | null
  towingSale?: { id: string; code?: number; people?: VehicleInspectionContactPerson | null } | null
}

export interface VehicleInspectionContactPerson {
  id: string
  name: string
  social_name?: string | null
  phone?: string | null
  contacts?: { id: string; name: string; phone?: string | null }[]
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

export const INSPECTION_STATUS_LABELS: Record<number, string> = {
  0: 'Em análise',
  1: 'Aprovada',
  2: 'Reprovada',
}

export const INSPECTION_STATUS_ANALYSIS = 0
export const INSPECTION_STATUS_APPROVED = 1
export const INSPECTION_STATUS_REJECTED = 2

export function fetchVehicleInspections(
  token: string,
  companyId: string,
  options: {
    search?: string
    status?: number
    dateStart?: string
    dateEnd?: string
    vehicle?: string
    user?: string
    page?: number
    limit?: number
  } = {}
) {
  return apiGet<Paginated<VehicleInspectionRecord>>(
    '/vehicle-inspection',
    {
      companyId,
      search: options.search,
      status: options.status !== undefined ? String(options.status) : undefined,
      dateStart: options.dateStart,
      dateEnd: options.dateEnd,
      vehicle: options.vehicle,
      user: options.user,
      page: options.page ? String(options.page) : '1',
      limit: options.limit ? String(options.limit) : '10',
    },
    token
  )
}

export function fetchVehicleInspection(token: string, id: string) {
  return apiGet<VehicleInspectionRecord>(`/vehicle-inspection/${id}`, {}, token)
}

export function updateVehicleInspectionStatus(token: string, id: string, status: number) {
  return apiPut<VehicleInspectionRecord>(`/vehicle-inspection/${id}`, { status }, token)
}

export function deleteVehicleInspection(token: string, id: string) {
  return apiDelete<void>(`/vehicle-inspection/${id}`, token)
}

export function downloadInspectionPhotosPdf(token: string, id: string, code?: number) {
  return apiDownload(`/vehicle-inspection/${id}/photos-pdf`, token, `vistoria-${code ?? id}-fotos.pdf`)
}

export interface CreateInspectionPhoto {
  file: File
  label: string
  observation?: string
}

export interface CreateInspectionPayload {
  company_id: string
  vehicle_id: string
  people_id?: string
  user_id?: string
  towing_sale_id?: string
  photos: CreateInspectionPhoto[]
}

export function createVehicleInspection(token: string, payload: CreateInspectionPayload) {
  const form = new FormData()
  form.append('company_id', payload.company_id)
  form.append('vehicle_id', payload.vehicle_id)
  if (payload.people_id) form.append('people_id', payload.people_id)
  if (payload.user_id) form.append('user_id', payload.user_id)
  if (payload.towing_sale_id) form.append('towing_sale_id', payload.towing_sale_id)

  const metadata = payload.photos.map((photo, index) => ({
    id_referencia: `photo_${index}`,
    tag: 'foto',
    label: photo.label,
    observation: photo.observation ?? '',
    noNumber: false,
  }))
  form.append('photos_metadata', JSON.stringify(metadata))
  payload.photos.forEach((photo, index) => {
    form.append(`photo_${index}`, photo.file)
  })

  return apiPostForm<{ message: string; data: VehicleInspectionRecord }>('/vehicle-inspection', form, token)
}

export function sendInspectionPhotosPdfWhatsapp(
  token: string,
  id: string,
  payload: { whatsappId: string; phone: string }
) {
  return apiPost<{ message: string }>(`/vehicle-inspection/${id}/send-photos-pdf`, payload, token)
}
