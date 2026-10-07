import { useCallback, useEffect, useState } from 'react'
import {
  agendaDateKey,
  agendaTime,
  changeGlassAppointmentStatus,
  createGlassAppointment,
  deleteGlassAppointment,
  fetchGlassOrders,
  GLASS_APPOINTMENT_STATUS_LABELS,
  GLASS_APPOINTMENT_TYPES,
  updateGlassAppointment,
  type GlassAppointmentRecord,
  type GlassAppointmentType,
  type GlassOrderRecord,
} from '../../lib/glass'
import { fetchPeople, type PersonRecord } from '../../lib/people'
import { formatDocument } from '../../lib/formatDocument'
import { ApiError } from '../../lib/api'
import { TextField } from '../../components/form/TextField'
import { SelectField } from '../../components/form/SelectField'
import { SearchSelectField } from '../../components/form/SearchSelectField'
import { CalendarIcon, ClockIcon, FileTextIcon, TagIcon, UserIcon } from '../../components/icons'
import type { AuthCompany, AuthSession } from '../../lib/auth'

export interface GlassAppointmentDraft {
  appointment?: GlassAppointmentRecord
  date?: string
  type?: GlassAppointmentType
  order?: Pick<GlassOrderRecord, 'id' | 'code' | 'reference' | 'people' | 'work_address'>
}

interface GlassAppointmentModalProps {
  open: boolean
  session: AuthSession
  company: AuthCompany
  draft: GlassAppointmentDraft | null
  onClose: () => void
  onChanged: () => void
}

interface Link {
  id: string
  label: string
  sub?: string
}

export function GlassAppointmentModal({ open, session, company, draft, onClose, onChanged }: GlassAppointmentModalProps) {
  const token = session.token.token
  const editing = draft?.appointment
  const [type, setType] = useState<GlassAppointmentType>('medicao')
  const [date, setDate] = useState('')
  const [time, setTime] = useState('08:00')
  const [duration, setDuration] = useState('60')
  const [team, setTeam] = useState('')
  const [address, setAddress] = useState('')
  const [notes, setNotes] = useState('')
  const [order, setOrder] = useState<Link | null>(null)
  const [client, setClient] = useState<Link | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open || !draft) return
    const appointment = draft.appointment
    setError(null)
    if (appointment) {
      setType(appointment.type)
      setDate(agendaDateKey(appointment.scheduled_at))
      setTime(agendaTime(appointment.scheduled_at))
      setDuration(String(appointment.duration_minutes ?? 60))
      setTeam(appointment.team ?? '')
      setAddress(appointment.address ?? '')
      setNotes(appointment.notes ?? '')
      setOrder(
        appointment.order
          ? { id: appointment.order.id, label: `#${appointment.order.code}`, sub: appointment.order.reference ?? undefined }
          : null
      )
      const person = appointment.people ?? appointment.order?.people
      setClient(appointment.people ? { id: appointment.people.id, label: appointment.people.name } : person ? { id: appointment.people_id ?? '', label: person.name } : null)
      return
    }
    setType(draft.type ?? 'medicao')
    setDate(draft.date ?? '')
    setTime('08:00')
    setDuration('60')
    setTeam('')
    setNotes('')
    if (draft.order) {
      setOrder({ id: draft.order.id, label: `#${draft.order.code}`, sub: draft.order.reference ?? undefined })
      setClient(draft.order.people ? { id: draft.order.people.id, label: draft.order.people.name } : null)
      setAddress(draft.order.work_address ?? '')
    } else {
      setOrder(null)
      setClient(null)
      setAddress('')
    }
  }, [open, draft])

  const searchOrders = useCallback(
    (query: string) => fetchGlassOrders(token, company.id, { search: query, limit: 8 }).then((res) => res.data),
    [token, company.id]
  )
  const searchPeople = useCallback(
    (query: string) => fetchPeople(token, company.id, { search: query, limit: 8 }).then((res) => res.data),
    [token, company.id]
  )

  if (!open || !draft) return null

  async function run(action: () => Promise<unknown>, fallback: string) {
    setSaving(true)
    setError(null)
    try {
      await action()
      onChanged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : fallback)
    } finally {
      setSaving(false)
    }
  }

  function handleSave() {
    if (!date || !time) {
      setError('Informe a data e o horário.')
      return
    }
    const payload = {
      company_id: company.id,
      glass_order_id: order?.id || null,
      people_id: client?.id || null,
      type,
      scheduled_at: `${date}T${time}`,
      duration_minutes: Math.max(Number(duration) || 60, 5),
      team: team.trim() || null,
      address: address.trim() || null,
      notes: notes.trim() || null,
    }
    run(
      () => (editing ? updateGlassAppointment(token, editing.id, payload) : createGlassAppointment(token, payload)),
      'Não foi possível salvar o agendamento.'
    )
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-[680px] overflow-y-auto rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-[17px] font-bold text-[var(--ink)]">{editing ? 'Agendamento' : 'Novo agendamento'}</h2>
          {editing && (
            <span className="rounded-full bg-[var(--page)] px-2.5 py-0.5 text-[11.5px] font-bold text-[var(--ink-soft)]">
              {GLASS_APPOINTMENT_STATUS_LABELS[editing.status]}
            </span>
          )}
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <SelectField label="Tipo" variant="surface" value={type} onChange={(event) => setType(event.target.value as GlassAppointmentType)}>
            {GLASS_APPOINTMENT_TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Equipe / responsável"
            icon={<UserIcon className="h-4 w-4" />}
            placeholder="Ex: Equipe 1, João"
            value={team}
            onChange={(event) => setTeam(event.target.value)}
          />
          <TextField label="Data" icon={<CalendarIcon className="h-4 w-4" />} type="date" value={date} onChange={(event) => setDate(event.target.value)} />
          <div className="grid grid-cols-2 gap-4">
            <TextField label="Horário" icon={<ClockIcon className="h-4 w-4" />} type="time" value={time} onChange={(event) => setTime(event.target.value)} />
            <TextField
              label="Duração (min)"
              icon={<ClockIcon className="h-4 w-4" />}
              inputMode="numeric"
              value={duration}
              onChange={(event) => setDuration(event.target.value.replace(/\D/g, ''))}
            />
          </div>
          <SearchSelectField
            label="Pedido (opcional)"
            variant="surface"
            placeholder="Buscar por número, cliente ou obra"
            selectedLabel={order?.label ?? null}
            selectedSubLabel={order?.sub}
            onSearch={searchOrders}
            getOptionLabel={(item: GlassOrderRecord) => `#${item.code} · ${item.people?.name ?? 'Sem cliente'}`}
            getOptionSubLabel={(item: GlassOrderRecord) => item.reference ?? undefined}
            onSelect={(item: GlassOrderRecord) => {
              setOrder({ id: item.id, label: `#${item.code}`, sub: item.reference ?? undefined })
              if (item.people) setClient({ id: item.people.id, label: item.people.name })
              if (!address.trim() && item.work_address) setAddress(item.work_address)
            }}
            onClear={() => setOrder(null)}
          />
          <SearchSelectField
            label="Cliente"
            variant="surface"
            placeholder="Buscar por nome ou documento"
            selectedLabel={client?.label ?? null}
            selectedSubLabel={client?.sub}
            onSearch={searchPeople}
            getOptionLabel={(item: PersonRecord) => item.name}
            getOptionSubLabel={(item: PersonRecord) => (item.document ? formatDocument(item.document) : undefined)}
            onSelect={(item: PersonRecord) => setClient({ id: item.id, label: item.name })}
            onClear={() => setClient(null)}
          />
          <div className="sm:col-span-2">
            <TextField
              label="Endereço"
              icon={<FileTextIcon className="h-4 w-4" />}
              placeholder="Local da medição / instalação"
              value={address}
              onChange={(event) => setAddress(event.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <TextField label="Observações" icon={<TagIcon className="h-4 w-4" />} value={notes} onChange={(event) => setNotes(event.target.value)} />
          </div>
        </div>

        {editing && type === 'instalacao' && editing.glass_order_id && editing.status === 0 && (
          <p className="mt-3 text-[12px] text-[var(--muted)]">
            Ao concluir a instalação, os itens do pedido ficam como instalados.
          </p>
        )}

        {error && <p className="mt-3 rounded-xl bg-[var(--red-100)] px-4 py-2.5 text-[13px] font-medium text-[var(--red-500)]">{error}</p>}

        <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {editing && editing.status === 0 && (
              <>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => run(() => changeGlassAppointmentStatus(token, editing.id, 1), 'Não foi possível concluir.')}
                  className="rounded-xl bg-[var(--green-100)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--green-600)] disabled:opacity-60"
                >
                  Concluir
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => run(() => changeGlassAppointmentStatus(token, editing.id, 2), 'Não foi possível cancelar.')}
                  className="rounded-xl bg-[var(--amber-100)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--amber-500)] disabled:opacity-60"
                >
                  Cancelar visita
                </button>
              </>
            )}
            {editing && editing.status !== 0 && (
              <button
                type="button"
                disabled={saving}
                onClick={() => run(() => changeGlassAppointmentStatus(token, editing.id, 0), 'Não foi possível reabrir.')}
                className="rounded-xl bg-[var(--page)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--ink-soft)] disabled:opacity-60"
              >
                Reabrir
              </button>
            )}
            {editing && (
              <button
                type="button"
                disabled={saving}
                onClick={() => run(() => deleteGlassAppointment(token, editing.id), 'Não foi possível excluir.')}
                className="rounded-xl bg-[var(--red-100)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--red-500)] disabled:opacity-60"
              >
                Excluir
              </button>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-[14px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]">
              Fechar
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="rounded-xl bg-[var(--blue-500)] px-6 py-2.5 text-[14px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
            >
              {saving ? 'Salvando…' : 'Salvar'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
