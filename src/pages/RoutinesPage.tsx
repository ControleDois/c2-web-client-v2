import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { ApiError } from '../lib/api'
import type { AuthCompany, AuthSession } from '../lib/auth'
import { ClockIcon, CloseIcon as XIcon, PencilIcon, PlusIcon, SearchIcon, TrashIcon } from '../components/icons'
import {
  ROUTINE_TEMPLATES,
  RUN_STATUS,
  WEEKDAYS,
  createRoutine,
  deleteRoutine,
  fetchRoutineRuns,
  fetchRoutineSettings,
  fetchRoutines,
  runRoutineNow,
  saveRoutineSettings,
  scheduleText,
  searchRoutinePeople,
  updateRoutine,
  type Routine,
  type RoutineContact,
  type RoutineInput,
  type RoutinePerson,
  type RoutineRun,
  type RoutineSettings,
} from '../lib/routines'

interface RoutinesPageProps {
  session: AuthSession
  company: AuthCompany
}

const message = (error: unknown, fallback: string) => (error instanceof ApiError ? error.message : fallback)

const dateTime = (iso: string | null) =>
  iso ? new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : '—'

const inputCls =
  'w-full rounded-md bg-[var(--page)] px-3 py-2 text-[14px] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--blue-500)]'
const labelCls = 'mb-1 block text-[12px] font-semibold text-[var(--ink-soft)]'
const primaryBtn =
  'rounded-md bg-[var(--blue-500)] px-4 py-2 text-[13.5px] font-semibold text-white hover:bg-[var(--blue-700)] disabled:opacity-50'
const ghostBtn = 'rounded-md px-3 py-2 text-[13px] font-medium text-[var(--ink-soft)] hover:bg-[var(--page)] hover:text-[var(--ink)]'

const EMPTY: RoutineInput = {
  title: '',
  description: '',
  ai_enabled: false,
  ai_instructions: '',
  weekdays: [1, 2, 3, 4, 5],
  times: ['09:00'],
  whatsapp_id: null,
  list_id: null,
  done_list_id: null,
  retry_minutes: 120,
  max_retries: 2,
  active: true,
  contacts: [],
}

export function RoutinesPage({ session, company }: RoutinesPageProps) {
  const token = session.token.token
  const [routines, setRoutines] = useState<Routine[]>([])
  const [settings, setSettings] = useState<RoutineSettings | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [editing, setEditing] = useState<{ id: string | null; data: RoutineInput; people: Record<string, RoutinePerson> } | null>(null)
  const [history, setHistory] = useState<Routine | null>(null)
  const [showSettings, setShowSettings] = useState(false)
  const [showTemplates, setShowTemplates] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    Promise.all([fetchRoutines(token, company.id), fetchRoutineSettings(token, company.id)])
      .then(([list, config]) => {
        if (cancelled) return
        setRoutines(list)
        setSettings(config)
        setError(null)
      })
      .catch((err) => !cancelled && setError(message(err, 'Não foi possível carregar as rotinas.')))
      .finally(() => !cancelled && setLoading(false))
    return () => {
      cancelled = true
    }
  }, [token, company.id, reload])

  function openEditor(routine?: Routine, template?: Partial<RoutineInput>) {
    if (routine) {
      const people: Record<string, RoutinePerson> = {}
      routine.contacts.forEach((contact) => contact.people && (people[contact.people_id] = contact.people))
      setEditing({
        id: routine.id,
        people,
        data: {
          ...routine,
          description: routine.description ?? '',
          ai_instructions: routine.ai_instructions ?? '',
          contacts: routine.contacts.map(({ people_id, receives, can_reply }) => ({ people_id, receives, can_reply })),
        },
      })
    } else {
      setEditing({ id: null, people: {}, data: { ...EMPTY, ...template } })
    }
    setShowTemplates(false)
  }

  async function runNow(routine: Routine) {
    setBusy(routine.id)
    setNotice(null)
    setError(null)
    try {
      const result = await runRoutineNow(token, routine.id)
      setNotice(
        result.delivered
          ? `“${routine.title}” enviada para ${result.delivered} contato(s) pelo WhatsApp ${result.whatsapp ?? ''}.`
          : 'A rotina disparou, mas nenhuma mensagem saiu: confira se o WhatsApp está conectado e se os contatos têm telefone.'
      )
      setReload((value) => value + 1)
    } catch (err) {
      setError(message(err, 'Não foi possível disparar agora.'))
    } finally {
      setBusy(null)
    }
  }

  async function toggleActive(routine: Routine) {
    setBusy(routine.id)
    try {
      await updateRoutine(token, routine.id, {
        ...routine,
        active: !routine.active,
        contacts: routine.contacts.map(({ people_id, receives, can_reply }) => ({ people_id, receives, can_reply })),
      })
      setReload((value) => value + 1)
    } catch (err) {
      setError(message(err, 'Não foi possível atualizar a rotina.'))
    } finally {
      setBusy(null)
    }
  }

  const noWhatsapp = settings && !settings.whatsapps.some((whatsapp) => whatsapp.connected && !whatsapp.official)

  return (
    <div>
      <div className="max-w-[920px]">
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-[16px] font-bold text-[var(--ink)]">
              <ClockIcon className="h-5 w-5" />
              Rotinas com assistente
            </h1>
            <p className="mt-0.5 text-[13px] text-[var(--ink-soft)]">
              Tarefas que se repetem: o assistente avisa no WhatsApp na hora certa, com o conteúdo pronto, e a pessoa responde FEITO, PULAR ou
              DEPOIS.
            </p>
          </div>
          <div className="flex gap-2">
            <button type="button" onClick={() => setShowSettings(true)} className={ghostBtn}>
              Configurações
            </button>
            <button type="button" onClick={() => setShowTemplates(true)} className={primaryBtn}>
              <span className="flex items-center gap-1.5">
                <PlusIcon className="h-4 w-4" /> Nova rotina
              </span>
            </button>
          </div>
        </div>

        {noWhatsapp && (
          <p className="mb-4 rounded-lg bg-[var(--amber-100)] px-4 py-3 text-[13px] font-medium text-[var(--amber-500)]">
            Nenhum WhatsApp conectado nesta empresa. Conecte um WhatsApp no sistema para as rotinas poderem enviar mensagens.
          </p>
        )}
        {error && <p className="mb-4 rounded-lg bg-[var(--red-100)] px-4 py-3 text-[13px] font-medium text-[var(--red-500)]">{error}</p>}
        {notice && <p className="mb-4 rounded-lg bg-[var(--green-100)] px-4 py-3 text-[13px] font-medium text-[var(--green-600)]">{notice}</p>}

        {loading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((index) => (
              <div key={index} className="h-24 animate-pulse rounded-lg bg-[var(--surface)]" />
            ))}
          </div>
        ) : routines.length === 0 ? (
          <div className="rounded-xl bg-[var(--surface)] px-6 py-12 text-center shadow-sm">
            <p className="text-[15px] font-bold text-[var(--ink)]">Nenhuma rotina ainda</p>
            <p className="mx-auto mt-1 max-w-md text-[13px] text-[var(--ink-soft)]">
              Comece por um modelo pronto (Reels, Stories, abrir o caixa, contagem de estoque…) e ajuste os dias, horários e quem recebe.
            </p>
            <button type="button" onClick={() => setShowTemplates(true)} className={`${primaryBtn} mt-4`}>
              Criar a primeira rotina
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {routines.map((routine) => (
              <RoutineRow
                key={routine.id}
                routine={routine}
                busy={busy === routine.id}
                onEdit={() => openEditor(routine)}
                onRun={() => void runNow(routine)}
                onHistory={() => setHistory(routine)}
                onToggle={() => void toggleActive(routine)}
              />
            ))}
          </div>
        )}
      </div>

      {showTemplates && <TemplatePicker onClose={() => setShowTemplates(false)} onPick={(template) => openEditor(undefined, template)} />}

      {editing && settings && (
        <RoutineEditor
          token={token}
          companyId={company.id}
          settings={settings}
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={(text) => {
            setEditing(null)
            setNotice(text)
            setReload((value) => value + 1)
          }}
        />
      )}

      {history && <HistoryModal token={token} routine={history} onClose={() => setHistory(null)} />}

      {showSettings && settings && (
        <SettingsModal
          token={token}
          companyId={company.id}
          settings={settings}
          onClose={() => setShowSettings(false)}
          onSaved={(next) => {
            setSettings(next)
            setShowSettings(false)
            setNotice('Configurações das rotinas salvas.')
          }}
        />
      )}
    </div>
  )
}

function RoutineRow({
  routine,
  busy,
  onEdit,
  onRun,
  onHistory,
  onToggle,
}: {
  routine: Routine
  busy: boolean
  onEdit: () => void
  onRun: () => void
  onHistory: () => void
  onToggle: () => void
}) {
  const last = routine.last_run
  const receivers = routine.contacts.filter((contact) => contact.receives).map((contact) => contact.people?.name?.split(' ')[0] || '—')
  return (
    <div className={`rounded-xl bg-[var(--surface)] p-4 shadow-sm ${routine.active ? '' : 'opacity-60'}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-[15px] font-bold text-[var(--ink)]">{routine.title}</p>
            {routine.ai_enabled && (
              <span className="rounded-full bg-[var(--indigo-100)] px-2 py-0.5 text-[11px] font-bold text-[var(--indigo-500)]">IA</span>
            )}
            {!routine.active && <span className="rounded-full bg-[var(--page)] px-2 py-0.5 text-[11px] font-bold text-[var(--muted)]">Pausada</span>}
          </div>
          <p className="mt-0.5 text-[13px] text-[var(--ink-soft)]">{scheduleText(routine)}</p>
          <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">Recebe: {receivers.length ? receivers.join(', ') : 'ninguém'}</p>
        </div>
        {last && (
          <div className="text-right">
            <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${RUN_STATUS[last.status]?.tone}`}>{RUN_STATUS[last.status]?.label}</span>
            <p className="mt-1 text-[11.5px] text-[var(--muted)]">Último: {dateTime(last.scheduled_for)}</p>
          </div>
        )}
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5 border-t border-[var(--border)] pt-3">
        <button type="button" onClick={onEdit} className={ghostBtn}>
          <span className="flex items-center gap-1.5">
            <PencilIcon className="h-3.5 w-3.5" /> Editar
          </span>
        </button>
        <button type="button" onClick={onRun} disabled={busy || !routine.active} className={`${ghostBtn} disabled:opacity-50`}>
          {busy ? 'Enviando…' : 'Disparar agora (teste)'}
        </button>
        <button type="button" onClick={onHistory} className={ghostBtn}>
          Histórico
        </button>
        <button type="button" onClick={onToggle} disabled={busy} className={`${ghostBtn} ml-auto`}>
          {routine.active ? 'Pausar' : 'Ativar'}
        </button>
      </div>
    </div>
  )
}

function Modal({ title, onClose, children, wide }: { title: string; onClose: () => void; children: ReactNode; wide?: boolean }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-black/60 p-4 sm:py-10" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <div className={`w-full ${wide ? 'max-w-[640px]' : 'max-w-[480px]'} rounded-xl bg-[var(--surface)] p-5 shadow-2xl`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-[15px] font-bold text-[var(--ink)]">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Fechar" className="rounded p-1 text-[var(--muted)] hover:bg-[var(--page)]">
            <XIcon className="h-4 w-4" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function TemplatePicker({ onClose, onPick }: { onClose: () => void; onPick: (template: Partial<RoutineInput>) => void }) {
  return (
    <Modal title="Nova rotina" onClose={onClose} wide>
      <button
        type="button"
        onClick={() => onPick({})}
        className="mb-4 w-full rounded-lg border border-dashed border-[var(--border)] px-4 py-3 text-left text-[13.5px] font-semibold text-[var(--ink)] hover:bg-[var(--page)]"
      >
        Começar do zero
      </button>
      {ROUTINE_TEMPLATES.map((group) => (
        <div key={group.group} className="mb-4">
          <p className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[var(--muted)]">{group.group}</p>
          <div className="grid gap-2 sm:grid-cols-2">
            {group.items.map((item) => (
              <button
                key={item.title}
                type="button"
                onClick={() => onPick(item)}
                className="rounded-lg bg-[var(--page)] px-3 py-2.5 text-left hover:ring-2 hover:ring-[var(--blue-300)]"
              >
                <p className="text-[13.5px] font-semibold text-[var(--ink)]">
                  {item.title} {item.ai_enabled ? <span className="text-[11px] font-bold text-[var(--indigo-500)]">· IA</span> : null}
                </p>
                <p className="text-[12px] text-[var(--ink-soft)]">{scheduleText({ weekdays: item.weekdays ?? [], times: item.times ?? [] })}</p>
              </button>
            ))}
          </div>
        </div>
      ))}
    </Modal>
  )
}

function RoutineEditor({
  token,
  companyId,
  settings,
  initial,
  onClose,
  onSaved,
}: {
  token: string
  companyId: string
  settings: RoutineSettings
  initial: { id: string | null; data: RoutineInput; people: Record<string, RoutinePerson> }
  onClose: () => void
  onSaved: (notice: string) => void
}) {
  const [data, setData] = useState<RoutineInput>(initial.data)
  const [people, setPeople] = useState<Record<string, RoutinePerson>>(initial.people)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<RoutinePerson[]>([])
  const [saving, setSaving] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<RoutineInput>) => setData((current) => ({ ...current, ...patch }))

  useEffect(() => {
    if (search.trim().length < 2) {
      setResults([])
      return
    }
    const timer = window.setTimeout(() => {
      searchRoutinePeople(token, companyId, search.trim())
        .then(setResults)
        .catch(() => setResults([]))
    }, 300)
    return () => window.clearTimeout(timer)
  }, [search, token, companyId])

  const lists = useMemo(() => settings.boards.flatMap((board) => board.lists.map((list) => ({ ...list, board: board.title }))), [settings.boards])

  function addPerson(person: RoutinePerson) {
    setPeople((current) => ({ ...current, [person.id]: person }))
    if (!data.contacts.some((contact) => contact.people_id === person.id))
      set({ contacts: [...data.contacts, { people_id: person.id, receives: true, can_reply: true }] })
    setSearch('')
    setResults([])
  }

  function updateContact(id: string, patch: Partial<RoutineContact>) {
    set({ contacts: data.contacts.map((contact) => (contact.people_id === id ? { ...contact, ...patch } : contact)) })
  }

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const payload = { ...data, times: data.times.filter(Boolean) }
      if (initial.id) await updateRoutine(token, initial.id, payload)
      else await createRoutine(token, companyId, payload)
      onSaved(initial.id ? 'Rotina atualizada.' : 'Rotina criada. Use “Disparar agora (teste)” para ver como chega no WhatsApp.')
    } catch (err) {
      setError(message(err, 'Não foi possível salvar a rotina.'))
    } finally {
      setSaving(false)
    }
  }

  async function remove() {
    if (!initial.id) return
    setSaving(true)
    try {
      await deleteRoutine(token, initial.id)
      onSaved('Rotina excluída.')
    } catch (err) {
      setError(message(err, 'Não foi possível excluir a rotina.'))
      setSaving(false)
    }
  }

  return (
    <Modal title={initial.id ? 'Editar rotina' : 'Nova rotina'} onClose={onClose} wide>
      <div className="flex flex-col gap-4">
        <div>
          <label className={labelCls}>Nome da rotina *</label>
          <input autoFocus value={data.title} onChange={(event) => set({ title: event.target.value })} className={inputCls} placeholder="Ex.: Postar Reels" />
        </div>
        <div>
          <label className={labelCls}>O que precisa ser feito</label>
          <textarea
            value={data.description ?? ''}
            onChange={(event) => set({ description: event.target.value })}
            rows={2}
            className={inputCls}
            placeholder="Aparece na mensagem e no cartão"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Dias da semana *</label>
            <div className="flex flex-wrap gap-1">
              {WEEKDAYS.map((day, index) => {
                const on = data.weekdays.includes(index)
                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => set({ weekdays: on ? data.weekdays.filter((value) => value !== index) : [...data.weekdays, index] })}
                    className={`h-9 w-11 rounded-md text-[12.5px] font-semibold ${on ? 'bg-[var(--blue-500)] text-white' : 'bg-[var(--page)] text-[var(--ink-soft)]'}`}
                  >
                    {day}
                  </button>
                )
              })}
            </div>
          </div>
          <div>
            <label className={labelCls}>Horários *</label>
            <div className="flex flex-wrap items-center gap-2">
              {data.times.map((time, index) => (
                <span key={index} className="flex items-center gap-1">
                  <input
                    type="time"
                    value={time}
                    onChange={(event) => set({ times: data.times.map((value, i) => (i === index ? event.target.value : value)) })}
                    className={`${inputCls} w-[110px]`}
                  />
                  {data.times.length > 1 && (
                    <button type="button" onClick={() => set({ times: data.times.filter((_, i) => i !== index) })} className="rounded p-1 text-[var(--muted)] hover:bg-[var(--page)]" aria-label="Remover horário">
                      <XIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                </span>
              ))}
              <button type="button" onClick={() => set({ times: [...data.times, '18:00'] })} className="text-[12.5px] font-semibold text-[var(--blue-500)]">
                + horário
              </button>
            </div>
          </div>
        </div>

        <div className="rounded-lg border border-[var(--border)] p-3">
          <label className="flex items-start gap-2.5">
            <input type="checkbox" checked={data.ai_enabled} onChange={(event) => set({ ai_enabled: event.target.checked })} className="mt-0.5 h-4 w-4 accent-[var(--blue-500)]" />
            <span>
              <span className="block text-[13.5px] font-semibold text-[var(--ink)]">A IA manda o conteúdo pronto</span>
              <span className="block text-[12.5px] text-[var(--ink-soft)]">Junto com o aviso vai a ideia, o roteiro ou o texto, sem repetir os dos últimos dias.</span>
            </span>
          </label>
          {data.ai_enabled && (
            <textarea
              value={data.ai_instructions ?? ''}
              onChange={(event) => set({ ai_instructions: event.target.value })}
              rows={3}
              className={`${inputCls} mt-3`}
              placeholder="O que a IA deve entregar. Ex.: 1 ideia de Reels com gancho, roteiro de 3 frases, legenda e chamada para o WhatsApp."
            />
          )}
        </div>

        <div>
          <label className={labelCls}>Contatos *</label>
          <p className="mb-2 text-[12px] text-[var(--muted)]">Quem recebe o aviso no WhatsApp e quem pode responder FEITO / PULAR / DEPOIS.</p>
          <div className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <input value={search} onChange={(event) => setSearch(event.target.value)} className={`${inputCls} pl-9`} placeholder="Buscar pessoa pelo nome ou telefone" />
            {results.length > 0 && (
              <div className="absolute z-10 mt-1 max-h-56 w-full overflow-y-auto rounded-md bg-[var(--surface)] shadow-lg ring-1 ring-[var(--border)]">
                {results.map((person) => (
                  <button key={person.id} type="button" onClick={() => addPerson(person)} className="flex w-full justify-between px-3 py-2 text-left text-[13px] hover:bg-[var(--page)]">
                    <span className="font-medium text-[var(--ink)]">{person.name}</span>
                    <span className="text-[var(--muted)]">{person.phone}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
          {data.contacts.length > 0 && (
            <div className="mt-2 flex flex-col divide-y divide-[var(--border)] rounded-md border border-[var(--border)]">
              {data.contacts.map((contact) => {
                const person = people[contact.people_id]
                return (
                  <div key={contact.people_id} className="flex flex-wrap items-center gap-3 px-3 py-2">
                    <div className="min-w-0 flex-1">
                      <p className="text-[13.5px] font-semibold text-[var(--ink)]">{person?.name ?? 'Contato'}</p>
                      <p className="text-[12px] text-[var(--muted)]">{person?.phone ?? ''}</p>
                    </div>
                    <label className="flex items-center gap-1.5 text-[12.5px] text-[var(--ink-soft)]">
                      <input type="checkbox" checked={contact.receives} onChange={(event) => updateContact(contact.people_id, { receives: event.target.checked })} className="h-4 w-4 accent-[var(--blue-500)]" />
                      Recebe
                    </label>
                    <label className="flex items-center gap-1.5 text-[12.5px] text-[var(--ink-soft)]">
                      <input type="checkbox" checked={contact.can_reply} onChange={(event) => updateContact(contact.people_id, { can_reply: event.target.checked })} className="h-4 w-4 accent-[var(--blue-500)]" />
                      Pode responder
                    </label>
                    <button type="button" onClick={() => set({ contacts: data.contacts.filter((item) => item.people_id !== contact.people_id) })} className="rounded p-1 text-[var(--muted)] hover:bg-[var(--page)]" aria-label="Remover contato">
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>WhatsApp que envia</label>
            <select value={data.whatsapp_id ?? ''} onChange={(event) => set({ whatsapp_id: event.target.value || null })} className={inputCls}>
              <option value="">Padrão das rotinas</option>
              {settings.whatsapps
                .filter((whatsapp) => !whatsapp.official)
                .map((whatsapp) => (
                  <option key={whatsapp.id} value={whatsapp.id}>
                    {whatsapp.name} {whatsapp.connected ? '' : '(desconectado)'}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Lembrar quem não respondeu</label>
            <div className="flex items-center gap-2 whitespace-nowrap text-[13px] text-[var(--ink-soft)]">
              a cada
              <select value={data.retry_minutes} onChange={(event) => set({ retry_minutes: Number(event.target.value) })} className={`${inputCls} w-auto`}>
                {[30, 60, 120, 180, 240].map((minutes) => (
                  <option key={minutes} value={minutes}>
                    {minutes < 60 ? `${minutes} min` : `${minutes / 60} h`}
                  </option>
                ))}
              </select>
              até
              <select value={data.max_retries} onChange={(event) => set({ max_retries: Number(event.target.value) })} className={`${inputCls} w-auto`}>
                {[0, 1, 2, 3, 4, 5].map((count) => (
                  <option key={count} value={count}>
                    {count}x
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className={labelCls}>Criar cartão no quadro</label>
            <select value={data.list_id ?? ''} onChange={(event) => set({ list_id: event.target.value || null })} className={inputCls}>
              <option value="">Não criar cartão</option>
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.board} › {list.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Ao concluir, mover o cartão para</label>
            <select value={data.done_list_id ?? ''} onChange={(event) => set({ done_list_id: event.target.value || null })} className={inputCls} disabled={!data.list_id}>
              <option value="">Só marcar como concluído</option>
              {lists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.board} › {list.title}
                </option>
              ))}
            </select>
          </div>
        </div>

        <label className="flex items-center gap-2 text-[13px] font-semibold text-[var(--ink)]">
          <input type="checkbox" checked={data.active} onChange={(event) => set({ active: event.target.checked })} className="h-4 w-4 accent-[var(--blue-500)]" />
          Rotina ativa
        </label>

        {error && <p className="rounded-lg bg-[var(--red-100)] px-3 py-2 text-[13px] font-medium text-[var(--red-500)]">{error}</p>}

        <div className="flex flex-wrap items-center gap-2 border-t border-[var(--border)] pt-4">
          <button type="button" onClick={() => void save()} disabled={saving || !data.title.trim()} className={primaryBtn}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
          <button type="button" onClick={onClose} className={ghostBtn}>
            Cancelar
          </button>
          {initial.id &&
            (confirmDelete ? (
              <button type="button" onClick={() => void remove()} disabled={saving} className="ml-auto rounded-md bg-[var(--red-500)] px-3 py-2 text-[13px] font-semibold text-white">
                Confirmar exclusão
              </button>
            ) : (
              <button type="button" onClick={() => setConfirmDelete(true)} className="ml-auto rounded-md px-3 py-2 text-[13px] font-semibold text-[var(--red-500)] hover:bg-[var(--red-100)]">
                Excluir
              </button>
            ))}
        </div>
      </div>
    </Modal>
  )
}

function HistoryModal({ token, routine, onClose }: { token: string; routine: Routine; onClose: () => void }) {
  const [runs, setRuns] = useState<RoutineRun[] | null>(null)
  const [open, setOpen] = useState<string | null>(null)
  useEffect(() => {
    fetchRoutineRuns(token, routine.id)
      .then((result) => setRuns(result.data))
      .catch(() => setRuns([]))
  }, [token, routine.id])
  const done = runs?.filter((run) => run.status === 1).length ?? 0
  return (
    <Modal title={`Histórico · ${routine.title}`} onClose={onClose} wide>
      {!runs ? (
        <div className="h-24 animate-pulse rounded-lg bg-[var(--page)]" />
      ) : runs.length === 0 ? (
        <p className="py-6 text-center text-[13px] text-[var(--ink-soft)]">Esta rotina ainda não disparou.</p>
      ) : (
        <>
          <p className="mb-3 text-[13px] text-[var(--ink-soft)]">
            Feitas {done} de {runs.length} nos últimos disparos.
          </p>
          <div className="flex flex-col divide-y divide-[var(--border)] rounded-md border border-[var(--border)]">
            {runs.map((run) => (
              <div key={run.id} className="px-3 py-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-[13.5px] font-semibold text-[var(--ink)]">{dateTime(run.scheduled_for)}</span>
                  <span className={`rounded-full px-2 py-0.5 text-[11.5px] font-semibold ${RUN_STATUS[run.status]?.tone}`}>{RUN_STATUS[run.status]?.label}</span>
                </div>
                <p className="text-[12px] text-[var(--muted)]">
                  {run.sent_at ? `Enviada ${dateTime(run.sent_at)}` : 'Não enviada (sem WhatsApp ou contato)'}
                  {run.reminders ? ` · ${run.reminders} lembrete(s)` : ''}
                  {run.answered_at ? ` · respondida ${dateTime(run.answered_at)}${run.answeredBy ? ` por ${run.answeredBy.name}` : ''}` : ''}
                </p>
                {run.content && (
                  <>
                    <button type="button" onClick={() => setOpen(open === run.id ? null : run.id)} className="mt-1 text-[12.5px] font-semibold text-[var(--blue-500)]">
                      {open === run.id ? 'Esconder conteúdo da IA' : 'Ver conteúdo da IA'}
                    </button>
                    {open === run.id && <p className="mt-1 whitespace-pre-wrap rounded-md bg-[var(--page)] p-2.5 text-[12.5px] text-[var(--ink)]">{run.content}</p>}
                  </>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </Modal>
  )
}

const TIMEZONES = [
  ['America/Sao_Paulo', 'Brasília (SP, RJ, MG, GO, DF, Sul, NE)'],
  ['America/Cuiaba', 'Mato Grosso / Mato Grosso do Sul'],
  ['America/Manaus', 'Amazonas, RO, RR'],
  ['America/Rio_Branco', 'Acre'],
  ['America/Belem', 'Pará, Amapá'],
  ['America/Noronha', 'Fernando de Noronha'],
]

function SettingsModal({
  token,
  companyId,
  settings,
  onClose,
  onSaved,
}: {
  token: string
  companyId: string
  settings: RoutineSettings
  onClose: () => void
  onSaved: (settings: RoutineSettings) => void
}) {
  const [form, setForm] = useState({
    assistant_name: settings.assistant_name,
    whatsapp_id: settings.whatsapp_id,
    summary_time: settings.summary_time,
    timezone: settings.timezone,
    ai_profile: settings.ai_profile,
  })
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const set = (patch: Partial<typeof form>) => setForm((current) => ({ ...current, ...patch }))

  async function save() {
    setSaving(true)
    setError(null)
    try {
      onSaved(await saveRoutineSettings(token, companyId, form))
    } catch (err) {
      setError(message(err, 'Não foi possível salvar as configurações.'))
    } finally {
      setSaving(false)
    }
  }

  return (
    <Modal title="Configurações das rotinas" onClose={onClose} wide>
      <div className="flex flex-col gap-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className={labelCls}>Nome da assistente</label>
            <input value={form.assistant_name} onChange={(event) => set({ assistant_name: event.target.value })} className={inputCls} placeholder="Assistente ControleDois" />
          </div>
          <div>
            <label className={labelCls}>WhatsApp que dispara as rotinas</label>
            <select value={form.whatsapp_id ?? ''} onChange={(event) => set({ whatsapp_id: event.target.value || null })} className={inputCls}>
              <option value="">Primeiro WhatsApp conectado</option>
              {settings.whatsapps
                .filter((whatsapp) => !whatsapp.official)
                .map((whatsapp) => (
                  <option key={whatsapp.id} value={whatsapp.id}>
                    {whatsapp.name} {whatsapp.connected ? '' : '(desconectado)'}
                  </option>
                ))}
            </select>
          </div>
          <div>
            <label className={labelCls}>Resumo do dia no WhatsApp</label>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={form.summary_time ?? ''}
                onChange={(event) => set({ summary_time: event.target.value || null })}
                className={`${inputCls} w-[120px]`}
              />
              {form.summary_time && (
                <button type="button" onClick={() => set({ summary_time: null })} className="whitespace-nowrap text-[12.5px] font-semibold text-[var(--muted)]">
                  Não enviar
                </button>
              )}
            </div>
          </div>
          <div>
            <label className={labelCls}>Fuso horário</label>
            <select value={form.timezone} onChange={(event) => set({ timezone: event.target.value })} className={inputCls}>
              {TIMEZONES.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>
        </div>
        <div>
          <label className={labelCls}>Sobre a empresa (para a IA)</label>
          <textarea
            value={form.ai_profile}
            onChange={(event) => set({ ai_profile: event.target.value })}
            rows={6}
            className={inputCls}
            placeholder="O que a empresa faz, para quem vende, produtos e diferenciais, tom de voz. Ex.: A ControleDois faz sistemas para empresas: nota fiscal, PDV, totem de autoatendimento, delivery, app de vistoria… Falamos de forma simples, para o dono do negócio."
          />
          <p className="mt-1 text-[12px] text-[var(--muted)]">Quanto mais completo, melhores as ideias. A IA não inventa nada fora do que estiver aqui.</p>
        </div>
        {error && <p className="rounded-lg bg-[var(--red-100)] px-3 py-2 text-[13px] font-medium text-[var(--red-500)]">{error}</p>}
        <div className="flex gap-2 border-t border-[var(--border)] pt-4">
          <button type="button" onClick={() => void save()} disabled={saving} className={primaryBtn}>
            {saving ? 'Salvando…' : 'Salvar'}
          </button>
          <button type="button" onClick={onClose} className={ghostBtn}>
            Cancelar
          </button>
        </div>
        <div className="rounded-lg bg-[var(--page)] p-3 text-[12.5px] text-[var(--ink-soft)]">
          <p className="font-semibold text-[var(--ink)]">Respostas que a assistente entende no WhatsApp</p>
          <p className="mt-1">
            <b>FEITO</b> conclui · <b>PULAR</b> pula hoje · <b>DEPOIS</b> lembra mais tarde · <b>TAREFAS</b> mostra o que falta · <b>IDEIAS</b> pede novas
            ideias. Com mais de uma pendente, use o número: <b>FEITO 2</b>.
          </p>
        </div>
      </div>
    </Modal>
  )
}
