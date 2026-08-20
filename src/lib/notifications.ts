import { apiGet, apiPatch } from './api'

export interface NotificationRecord {
  id: string
  type: string
  title: string
  body?: string | null
  data?: Record<string, unknown> | null
  readAt?: string | null
  createdAt?: string
  created_at?: string
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

export function fetchUnreadNotificationCount(token: string) {
  return apiGet<{ count: number }>('/notifications/unread-count', {}, token)
}

export function fetchNotifications(token: string, options: { page?: number; limit?: number } = {}) {
  return apiGet<Paginated<NotificationRecord>>(
    '/notifications',
    {
      page: options.page ? String(options.page) : '1',
      limit: options.limit ? String(options.limit) : '10',
    },
    token
  )
}

export function markNotificationRead(token: string, id: string) {
  return apiPatch<NotificationRecord>(`/notifications/${id}/read`, {}, token)
}
