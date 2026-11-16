import { apiDelete, apiGet, apiPost, apiPut } from './api'

// Rotinas com assistente: tarefas que se repetem e são avisadas/respondidas pelo WhatsApp.

export interface RoutinePerson {
  id: string
  name: string
  phone: string | null
}

export interface RoutineContact {
  people_id: string
  receives: boolean
  can_reply: boolean
  people?: RoutinePerson
}

export interface RoutineRun {
  id: string
  scheduled_for: string
  status: number
  content: string | null
  sent_at: string | null
  reminders: number
  answered_at: string | null
  answer: string | null
  answeredBy?: { id: string; name: string } | null
}

export interface Routine {
  id: string
  title: string
  description: string | null
  ai_enabled: boolean
  ai_instructions: string | null
  weekdays: number[]
  times: string[]
  whatsapp_id: string | null
  list_id: string | null
  done_list_id: string | null
  retry_minutes: number
  max_retries: number
  active: boolean
  contacts: RoutineContact[]
  last_run: RoutineRun | null
}

export type RoutineInput = Omit<Routine, 'id' | 'contacts' | 'last_run'> & {
  contacts: { people_id: string; receives: boolean; can_reply: boolean }[]
}

export interface RoutineSettings {
  whatsapp_id: string | null
  summary_time: string | null
  timezone: string
  ai_profile: string
  assistant_name: string
  whatsapps: { id: string; name: string; phone: string; connected: boolean; official: boolean }[]
  boards: { id: string; title: string; lists: { id: string; title: string }[] }[]
}

export const RUN_STATUS: Record<number, { label: string; tone: string }> = {
  0: { label: 'Aguardando resposta', tone: 'bg-[var(--amber-100)] text-[var(--amber-500)]' },
  1: { label: 'Feito', tone: 'bg-[var(--green-100)] text-[var(--green-600)]' },
  2: { label: 'Pulado', tone: 'bg-[var(--page)] text-[var(--ink-soft)]' },
  3: { label: 'Sem resposta', tone: 'bg-[var(--red-100)] text-[var(--red-500)]' },
}

export const WEEKDAYS = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb']

export const fetchRoutines = (token: string, companyId: string) => apiGet<Routine[]>('/task-routines', { companyId }, token)
export const createRoutine = (token: string, companyId: string, data: RoutineInput) =>
  apiPost<Routine>('/task-routines', { ...data, companyId }, token)
export const updateRoutine = (token: string, id: string, data: RoutineInput) => apiPut<Routine>(`/task-routines/${id}`, data, token)
export const deleteRoutine = (token: string, id: string) => apiDelete<unknown>(`/task-routines/${id}`, token)
export const runRoutineNow = (token: string, id: string) =>
  apiPost<{ delivered: number; recipients: number; whatsapp: string | null; content: string | null }>(`/task-routines/${id}/run-now`, {}, token)
export const fetchRoutineRuns = (token: string, id: string, page = 1) =>
  apiGet<{ data: RoutineRun[]; meta: { last_page: number } }>(`/task-routines/${id}/runs`, { page: String(page), limit: '30' }, token)
export const searchRoutinePeople = (token: string, companyId: string, search: string) =>
  apiGet<RoutinePerson[]>('/task-routines/people', { companyId, search }, token)
export const fetchRoutineSettings = (token: string, companyId: string) =>
  apiGet<RoutineSettings>('/task-routines/settings', { companyId }, token)
export const saveRoutineSettings = (
  token: string,
  companyId: string,
  data: Pick<RoutineSettings, 'whatsapp_id' | 'summary_time' | 'timezone' | 'ai_profile' | 'assistant_name'>
) => apiPut<RoutineSettings>('/task-routines/settings', { ...data, companyId }, token)

export function scheduleText(routine: Pick<Routine, 'weekdays' | 'times'>) {
  const days = [...routine.weekdays].sort()
  const dayText =
    days.length === 7 ? 'Todo dia' : days.join(',') === '1,2,3,4,5' ? 'Seg a sex' : days.map((day) => WEEKDAYS[day]).join(', ')
  return `${dayText} · ${routine.times.join(', ')}`
}

// Modelos prontos para começar rápido (o cliente ajusta depois).
export const ROUTINE_TEMPLATES: { group: string; items: (Partial<RoutineInput> & { title: string })[] }[] = [
  {
    group: 'Marketing e Instagram',
    items: [
      {
        title: 'Postar Reels',
        description: 'Gravar e postar um Reels no Instagram.',
        weekdays: [1, 3, 5],
        times: ['09:00'],
        ai_enabled: true,
        ai_instructions:
          'Traga 1 ideia de Reels de 15 a 40 segundos: gancho dos 3 primeiros segundos, roteiro falado em 3 a 5 frases, legenda curta e a chamada para comentar ou chamar no WhatsApp.',
      },
      {
        title: 'Stories do dia',
        description: 'Postar de 3 a 5 stories (bastidores, enquete, caixinha de perguntas).',
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        times: ['12:00'],
        ai_enabled: true,
        ai_instructions: 'Sugira 3 stories para hoje: um de bastidor, uma enquete com a pergunta e opções, e uma caixinha de perguntas.',
      },
      {
        title: 'Carrossel educativo',
        description: 'Post em carrossel ensinando algo útil para o cliente.',
        weekdays: [2],
        times: ['10:00'],
        ai_enabled: true,
        ai_instructions: 'Traga o tema e o texto de cada slide (de 5 a 7 slides) e a legenda com chamada para ação.',
      },
      {
        title: 'Responder comentários e mensagens',
        description: 'Responder todos os comentários e directs do dia.',
        weekdays: [0, 1, 2, 3, 4, 5, 6],
        times: ['18:00'],
        ai_enabled: false,
      },
    ],
  },
  {
    group: 'Operação',
    items: [
      { title: 'Abrir o caixa', description: 'Conferir o troco e abrir o caixa no sistema.', weekdays: [1, 2, 3, 4, 5, 6], times: ['08:00'], ai_enabled: false },
      { title: 'Contagem de estoque', description: 'Contar o estoque pelo celular no sistema.', weekdays: [5], times: ['17:00'], ai_enabled: false },
      { title: 'Cobrar clientes em atraso', description: 'Conferir as contas vencidas e cobrar.', weekdays: [1, 4], times: ['10:00'], ai_enabled: false },
    ],
  },
]
