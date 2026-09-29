import { apiGet, apiPut, apiPostForm } from './api'

export interface SupportVisitPhoto {
  id: string
  file_url: string
  name?: string | null
  description?: string | null
}

export interface SupportVisitPerson {
  id: string
  name: string
  social_name?: string | null
  phone?: string | null
  contacts?: { id: string; name: string; phone?: string | null }[]
}

export interface SupportVisitRecord {
  id: string
  code?: number
  people_id: string
  support_contract_id?: string | null
  user_id?: string | null
  visit_type: number
  description?: string | null
  status: number
  customer_signature_url?: string | null
  customer_signer_name?: string | null
  customer_signed_at?: string | null
  created_at?: string
  people?: SupportVisitPerson | null
  user?: { id: string; name: string } | null
  photos?: SupportVisitPhoto[]
}

interface Paginated<T> {
  data: T[]
  meta?: { total: number; per_page: number; current_page: number; last_page: number }
}

export const VISIT_TYPE_LABELS: Record<number, string> = {
  0: 'Coleta de equipamento',
  1: 'Atendimento no local',
}

export const VISIT_STATUS_LABELS: Record<number, string> = {
  0: 'Aberta',
  1: 'Concluída',
}

export function fetchSupportVisits(
  token: string,
  companyId: string,
  options: {
    search?: string
    peopleId?: string
    visitType?: number
    status?: number
    dateStart?: string
    dateEnd?: string
    page?: number
    limit?: number
  } = {}
) {
  return apiGet<Paginated<SupportVisitRecord>>(
    '/support-visit',
    {
      companyId,
      search: options.search,
      peopleId: options.peopleId,
      visitType: options.visitType !== undefined ? String(options.visitType) : undefined,
      status: options.status !== undefined ? String(options.status) : undefined,
      dateStart: options.dateStart,
      dateEnd: options.dateEnd,
      page: options.page ? String(options.page) : '1',
      limit: options.limit ? String(options.limit) : '20',
    },
    token
  )
}

export function fetchSupportVisit(token: string, id: string) {
  return apiGet<SupportVisitRecord>(`/support-visit/${id}`, {}, token)
}

export function updateSupportVisitStatus(token: string, id: string, status: number) {
  return apiPut<SupportVisitRecord>(`/support-visit/${id}`, { status }, token)
}

export interface CreateVisitPhoto {
  file: File
  label: string
  observation?: string
}

export interface CreateSupportVisitPayload {
  company_id: string
  people_id: string
  user_id?: string
  support_contract_id?: string
  visit_type: number
  description?: string
  photos: CreateVisitPhoto[]
  customer_signature?: File
  customer_signer_name?: string
}

export function createSupportVisit(token: string, payload: CreateSupportVisitPayload) {
  const form = new FormData()
  form.append('company_id', payload.company_id)
  form.append('people_id', payload.people_id)
  if (payload.user_id) form.append('user_id', payload.user_id)
  if (payload.support_contract_id) form.append('support_contract_id', payload.support_contract_id)
  form.append('visit_type', String(payload.visit_type))
  if (payload.description) form.append('description', payload.description)

  const metadata = payload.photos.map((photo, index) => ({
    id_referencia: `photo_${index}`,
    tag: 'foto',
    label: photo.label,
    observation: photo.observation ?? '',
  }))
  form.append('photos_metadata', JSON.stringify(metadata))
  payload.photos.forEach((photo, index) => {
    form.append(`photo_${index}`, photo.file)
  })

  if (payload.customer_signature) {
    form.append('customer_signature', payload.customer_signature)
    if (payload.customer_signer_name) form.append('customer_signer_name', payload.customer_signer_name)
  }

  return apiPostForm<{ message: string; data: SupportVisitRecord }>('/support-visit', form, token)
}
