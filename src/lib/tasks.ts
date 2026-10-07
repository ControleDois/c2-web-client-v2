import { apiGet, apiPost, apiPut, apiDelete, apiPostForm, apiPutForm } from './api'

export interface TaskCardRecord {
  id: string
  title: string
  priority?: number | null
  status?: number | null
  date_expected_finish?: string | null
  remind_whatsapp?: boolean
  remind_at?: string | null
  remind_sent_at?: string | null
  people?: { id: string; name: string } | null
}

export interface TaskBoardRecord {
  id: string
  title: string
  position?: number | null
  outcome?: string | null
  tasks: TaskCardRecord[]
}

export interface TaskFileRecord {
  id: string
  title?: string | null
  description?: string | null
  file_name?: string | null
  file_url?: string | null
  file_size?: number | null
}

export interface TaskRecord extends TaskCardRecord {
  description?: string | null
  task_board_id: string
  people_id?: string | null
  whatsapp_id?: string | null
  date_finish?: string | null
  files?: TaskFileRecord[]
  whatsapp?: { id: string; name: string } | null
}

export const TASK_STATUS_LABELS: Record<number, string> = {
  0: 'A fazer',
  1: 'Em progresso',
  2: 'Em avaliação',
  3: 'Finalizada',
  4: 'Cancelada',
}

export const TASK_PRIORITY_LABELS: Record<number, string> = {
  0: 'Baixa',
  1: 'Média',
  2: 'Alta',
}

interface Paginated<T> {
  data: T[]
}

export function fetchTaskBoards(token: string, companyId: string) {
  return apiGet<Paginated<TaskBoardRecord>>('/task-board', { companyId, page: '1', limit: '100' }, token)
}

export function createTaskBoard(token: string, payload: { companyId: string; title: string; position: number }) {
  return apiPost<TaskBoardRecord>('/task-board', payload, token)
}

export function updateTaskBoard(
  token: string,
  id: string,
  payload: { companyId: string; title: string; position?: number }
) {
  return apiPut<TaskBoardRecord>(`/task-board/${id}`, payload, token)
}

export function deleteTaskBoard(token: string, id: string) {
  return apiDelete<void>(`/task-board/${id}`, token)
}

export function moveTask(token: string, taskId: string, boardId: string) {
  return apiPost<unknown>(`/task/update-board/${taskId}`, { boardId }, token)
}

export function fetchTask(token: string, id: string) {
  return apiGet<TaskRecord>(`/task/${id}`, {}, token)
}

export function createTask(token: string, form: FormData) {
  return apiPostForm<TaskRecord>('/task', form, token)
}

export function updateTask(token: string, id: string, form: FormData) {
  return apiPutForm<TaskRecord>(`/task/${id}`, form, token)
}

export function deleteTask(token: string, id: string) {
  return apiDelete<void>(`/task/${id}`, token)
}
