import { apiGet, apiPostForm, apiPost, apiDelete } from './api'

export interface AppReleaseRecord {
  id: string
  code?: number
  app_key: string
  version: string
  notes?: string | null
  file_name: string
  file_size: number
  sha256?: string | null
  is_current: boolean
  created_at: string
}

export const fetchAppReleases = (token: string) => apiGet<AppReleaseRecord[]>('/app-release', {}, token)

export function uploadAppRelease(token: string, form: FormData) {
  return apiPostForm<AppReleaseRecord>('/app-release', form, token)
}

export const setCurrentAppRelease = (token: string, id: string) =>
  apiPost<AppReleaseRecord>(`/app-release/${id}/current`, {}, token)

export const deleteAppRelease = (token: string, id: string) => apiDelete<void>(`/app-release/${id}`, token)
