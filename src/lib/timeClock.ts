import { apiGet, apiPost, apiPut, apiDelete } from './api'

export interface TimeClockDeviceRecord {
  id: string
  name: string
  brand: string
  status: 'active' | 'inactive'
  ip_address?: string | null
  last_event_at?: string | null
  webhook_token: string
  webhook_url: string
}

export interface TimeClockEnrollmentRecord {
  id: string
  time_clock_device_id: string
  people_id: string
  people_name: string | null
  external_user_id: string
}

export interface TimeClockEventRecord {
  id: string
  people_id: string | null
  people_name: string | null
  device_id: string
  device_name: string | null
  direction: 'in' | 'out' | 'unknown'
  occurred_at: string
}

export interface TimeClockStatusPerson {
  people_id: string
  people_name: string
  direction: 'in' | 'out' | 'unknown'
  occurred_at: string
}

export interface TimeClockStatusResult {
  inside_count: number
  people: TimeClockStatusPerson[]
}

interface Paginated<T> {
  data: T[]
  meta: { total: number; per_page: number; current_page: number; last_page: number }
}

export function fetchTimeClockDevices(token: string, companyId: string) {
  return apiGet<TimeClockDeviceRecord[]>('/time-clock/devices', { companyId }, token)
}

export function createTimeClockDevice(token: string, companyId: string, name: string) {
  return apiPost<TimeClockDeviceRecord>('/time-clock/devices', { companyId, name }, token)
}

export function updateTimeClockDevice(
  token: string,
  id: string,
  payload: { name?: string; status?: 'active' | 'inactive' }
) {
  return apiPut<TimeClockDeviceRecord>(`/time-clock/devices/${id}`, payload, token)
}

export function deleteTimeClockDevice(token: string, id: string) {
  return apiDelete<{ id: string }>(`/time-clock/devices/${id}`, token)
}

export function fetchTimeClockEnrollments(token: string, companyId: string) {
  return apiGet<TimeClockEnrollmentRecord[]>('/time-clock/enrollments', { companyId }, token)
}

export function createTimeClockEnrollment(
  token: string,
  companyId: string,
  payload: { time_clock_device_id: string; people_id: string; external_user_id: string }
) {
  return apiPost<TimeClockEnrollmentRecord>('/time-clock/enrollments', { companyId, ...payload }, token)
}

export function deleteTimeClockEnrollment(token: string, id: string) {
  return apiDelete<{ id: string }>(`/time-clock/enrollments/${id}`, token)
}

export function fetchTimeClockEvents(
  token: string,
  companyId: string,
  options: { peopleId?: string; page?: number; limit?: number } = {}
) {
  return apiGet<Paginated<TimeClockEventRecord>>(
    '/time-clock/events',
    {
      companyId,
      peopleId: options.peopleId,
      page: options.page ? String(options.page) : '1',
      limit: options.limit ? String(options.limit) : '20',
    },
    token
  )
}

export function fetchTimeClockStatus(token: string, companyId: string) {
  return apiGet<TimeClockStatusResult>('/time-clock/events/status', { companyId }, token)
}
