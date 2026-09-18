import { useEffect, useMemo, useRef, useState } from 'react'
import {
  fetchTimeClockDevices,
  createTimeClockDevice,
  updateTimeClockDevice,
  deleteTimeClockDevice,
  fetchTimeClockEnrollments,
  createTimeClockEnrollment,
  deleteTimeClockEnrollment,
  fetchTimeClockEvents,
  fetchTimeClockStatus,
  type TimeClockDeviceRecord,
  type TimeClockEnrollmentRecord,
  type TimeClockEventRecord,
  type TimeClockStatusResult,
} from '../lib/timeClock'
import { fetchPeople, type PersonRecord } from '../lib/people'
import { useTimeClockUpdates } from '../hooks/useTimeClockUpdates'
import { ApiError } from '../lib/api'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { TextField } from '../components/form/TextField'
import {
  ClockIcon,
  ArrowDownCircleIcon,
  ArrowUpCircleIcon,
  UserIcon,
  PlusIcon,
  TrashIcon,
  CopyIcon,
  BadgeIcon,
  CheckCircleIcon,
  SearchIcon,
} from '../components/icons'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface TimeClockPageProps {
  session: AuthSession
  company: AuthCompany
  onBack: () => void
}

type Tab = 'painel' | 'dispositivos'

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' })
}

function timeAgo(iso: string | null | undefined): string {
  if (!iso) return 'nunca'
  const diffMs = Date.now() - new Date(iso).getTime()
  const minutes = Math.floor(diffMs / 60000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `há ${minutes} min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `há ${hours}h`
  return `há ${Math.floor(hours / 24)}d`
}

function PeopleSearchPicker({
  token,
  companyId,
  onSelect,
}: {
  token: string
  companyId: string
  onSelect: (person: PersonRecord) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PersonRecord[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!query.trim()) {
      setResults([])
      return
    }
    let cancelled = false
    setLoading(true)
    const timeout = setTimeout(() => {
      fetchPeople(token, companyId, { search: query.trim(), limit: 8 })
        .then((res) => {
          if (!cancelled) setResults(res.data)
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [query, token, companyId])

  return (
    <div className="relative">
      <TextField
        label="Funcionário"
        icon={<SearchIcon className="h-4 w-4" />}
        placeholder="Busque pelo nome"
        value={query}
        onChange={(event) => {
          setQuery(event.target.value)
          setOpen(true)
        }}
        onFocus={() => setOpen(true)}
      />
      {open && query.trim() && (
        <div className="absolute z-10 mt-1 w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--card-shadow)]">
          {loading ? (
            <p className="px-3.5 py-2.5 text-[12.5px] text-[var(--muted)]">Buscando…</p>
          ) : results.length === 0 ? (
            <p className="px-3.5 py-2.5 text-[12.5px] text-[var(--muted)]">Nenhum funcionário encontrado.</p>
          ) : (
            results.map((person) => (
              <button
                key={person.id}
                type="button"
                onClick={() => {
                  onSelect(person)
                  setQuery(person.name)
                  setOpen(false)
                }}
                className="block w-full px-3.5 py-2.5 text-left text-[13px] text-[var(--ink)] hover:bg-[var(--page)]"
              >
                {person.name}
              </button>
            ))
          )}
        </div>
      )}
    </div>
  )
}

function DeviceCard({
  session,
  company,
  device,
  enrollments,
  onChanged,
}: {
  session: AuthSession
  company: AuthCompany
  device: TimeClockDeviceRecord
  enrollments: TimeClockEnrollmentRecord[]
  onChanged: () => void
}) {
  const token = session.token.token
  const [copied, setCopied] = useState<'agent' | 'monitor' | null>(null)
  const [showEnrollForm, setShowEnrollForm] = useState(false)
  const [selectedPerson, setSelectedPerson] = useState<PersonRecord | null>(null)
  const [externalUserId, setExternalUserId] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<TimeClockDeviceRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  function copyUrl(url: string) {
    navigator.clipboard?.writeText(url)
    setCopied(url === device.agent_url ? 'agent' : 'monitor')
    setTimeout(() => setCopied(null), 2000)
  }

  async function handleAddEnrollment() {
    if (!selectedPerson || !externalUserId.trim()) {
      setError('Escolha o funcionário e informe o ID gerado no aparelho.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      await createTimeClockEnrollment(token, company.id, {
        time_clock_device_id: device.id,
        people_id: selectedPerson.id,
        external_user_id: externalUserId.trim(),
      })
      setShowEnrollForm(false)
      setSelectedPerson(null)
      setExternalUserId('')
      onChanged()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível vincular o funcionário.')
    } finally {
      setSaving(false)
    }
  }

  async function handleRemoveEnrollment(id: string) {
    await deleteTimeClockEnrollment(token, id)
    onChanged()
  }

  async function handleToggleStatus() {
    await updateTimeClockDevice(token, device.id, {
      status: device.status === 'active' ? 'inactive' : 'active',
    })
    onChanged()
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteTimeClockDevice(token, deleteTarget.id)
      setDeleteTarget(null)
      onChanged()
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="flex items-center gap-1.5 text-[13.5px] font-bold text-[var(--ink)]">
            <BadgeIcon className="h-4 w-4 flex-none text-[var(--blue-700)]" />
            {device.name}
          </p>
          <p className="mt-0.5 text-[11.5px] text-[var(--muted)]">
            Última batida: {timeAgo(device.last_event_at)}
          </p>
        </div>
        <div className="flex flex-none items-center gap-2">
          <span
            className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold ${
              device.status === 'active'
                ? 'bg-[var(--green-100)] text-[var(--green-600)]'
                : 'bg-[var(--page)] text-[var(--ink-soft)]'
            }`}
          >
            {device.status === 'active' ? 'Ativo' : 'Inativo'}
          </span>
          <button
            type="button"
            onClick={handleToggleStatus}
            className="rounded-lg border border-[var(--border)] px-2.5 py-1 text-[11px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]"
          >
            {device.status === 'active' ? 'Desativar' : 'Ativar'}
          </button>
          <button
            type="button"
            onClick={() => setDeleteTarget(device)}
            className="flex h-7 w-7 flex-none items-center justify-center rounded-lg text-[var(--red-500)] hover:bg-[var(--red-100)]"
            title="Remover dispositivo"
          >
            <TrashIcon className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="mt-3 rounded-lg bg-[var(--page)] p-3">
        <p className="text-[11px] font-semibold text-[var(--ink-soft)]">
          URL do agente — configure no agente local (console Delphi) instalado no servidor do cliente
        </p>
        <div className="mt-1.5 flex items-center gap-2">
          <code className="flex-1 truncate rounded-lg bg-[var(--surface)] px-3 py-2 text-[12px] text-[var(--ink)]">
            {device.agent_url}
          </code>
          <button
            type="button"
            onClick={() => copyUrl(device.agent_url)}
            className="flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-[var(--border)] text-[var(--ink-soft)] hover:text-[var(--ink)]"
            title="Copiar URL"
          >
            {copied === 'agent' ? <CheckCircleIcon className="h-3.5 w-3.5 text-[var(--green-600)]" /> : <CopyIcon className="h-3.5 w-3.5" />}
          </button>
        </div>
        <p className="mt-1.5 text-[11px] text-[var(--muted)]">
          O agente manda um POST com <code>{'{ events: [{ external_user_id, occurred_at }] }'}</code> pra essa URL.
        </p>
      </div>

      <details className="mt-2 rounded-lg bg-[var(--page)] p-3">
        <summary className="cursor-pointer text-[11px] font-semibold text-[var(--ink-soft)]">
          URL do Monitor (só pra equipamentos da linha de Controle de Acesso, não o REP iDClass)
        </summary>
        <div className="mt-1.5 flex items-center gap-2">
          <code className="flex-1 truncate rounded-lg bg-[var(--surface)] px-3 py-2 text-[12px] text-[var(--ink)]">
            {device.webhook_url}
          </code>
          <button
            type="button"
            onClick={() => copyUrl(device.webhook_url)}
            className="flex h-8 w-8 flex-none items-center justify-center rounded-lg border border-[var(--border)] text-[var(--ink-soft)] hover:text-[var(--ink)]"
            title="Copiar URL"
          >
            {copied === 'monitor' ? <CheckCircleIcon className="h-3.5 w-3.5 text-[var(--green-600)]" /> : <CopyIcon className="h-3.5 w-3.5" />}
          </button>
        </div>
      </details>

      <div className="mt-3">
        <div className="mb-2 flex items-center justify-between">
          <h5 className="text-[12px] font-bold text-[var(--ink)]">Funcionários vinculados</h5>
          <button
            type="button"
            onClick={() => setShowEnrollForm((current) => !current)}
            className="flex items-center gap-1 text-[11.5px] font-bold text-[var(--blue-700)] hover:underline"
          >
            <PlusIcon className="h-3.5 w-3.5" /> Vincular
          </button>
        </div>

        {enrollments.length === 0 ? (
          <p className="text-[12px] text-[var(--muted)]">Nenhum funcionário vinculado ainda.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {enrollments.map((enrollment) => (
              <div
                key={enrollment.id}
                className="flex items-center justify-between gap-2 rounded-lg bg-[var(--page)] px-3 py-2"
              >
                <span className="flex min-w-0 items-center gap-1.5 truncate text-[12.5px] text-[var(--ink)]">
                  <UserIcon className="h-3.5 w-3.5 flex-none text-[var(--muted)]" />
                  {enrollment.people_name || 'Funcionário'}
                  <span className="text-[var(--muted)]">· ID {enrollment.external_user_id}</span>
                </span>
                <button
                  type="button"
                  onClick={() => handleRemoveEnrollment(enrollment.id)}
                  className="flex h-6 w-6 flex-none items-center justify-center rounded-lg text-[var(--red-500)] hover:bg-[var(--red-100)]"
                >
                  <TrashIcon className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {showEnrollForm && (
          <div className="mt-2.5 rounded-lg bg-[var(--page)] p-3">
            <div className="grid gap-2.5 sm:grid-cols-2">
              <PeopleSearchPicker token={token} companyId={company.id} onSelect={setSelectedPerson} />
              <TextField
                label="ID gerado no aparelho"
                icon={<BadgeIcon className="h-4 w-4" />}
                placeholder="Ex: 101"
                value={externalUserId}
                onChange={(event) => setExternalUserId(event.target.value)}
              />
            </div>
            {error && <p className="mt-2 text-[11.5px] font-medium text-[var(--red-500)]">{error}</p>}
            <button
              type="button"
              onClick={handleAddEnrollment}
              disabled={saving}
              className="mt-2.5 rounded-lg bg-[var(--blue-500)] px-3 py-1.5 text-[11.5px] font-bold text-white hover:bg-[var(--blue-700)] disabled:opacity-60"
            >
              {saving ? 'Vinculando…' : 'Vincular'}
            </button>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Remover dispositivo"
        message={`Tem certeza que deseja remover "${deleteTarget?.name}"? O relógio vai parar de mandar batidas pro sistema.`}
        confirmLabel="Remover"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}

function DispositivosTab({ session, company }: { session: AuthSession; company: AuthCompany }) {
  const token = session.token.token
  const [devices, setDevices] = useState<TimeClockDeviceRecord[]>([])
  const [enrollments, setEnrollments] = useState<TimeClockEnrollmentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [newDeviceName, setNewDeviceName] = useState('')
  const [creating, setCreating] = useState(false)

  function load() {
    setLoading(true)
    setError(null)
    Promise.all([fetchTimeClockDevices(token, company.id), fetchTimeClockEnrollments(token, company.id)])
      .then(([deviceList, enrollmentList]) => {
        setDevices(deviceList)
        setEnrollments(enrollmentList)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os dispositivos.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [token, company.id])

  async function handleCreateDevice() {
    if (!newDeviceName.trim()) {
      setError('Dê um nome pro dispositivo (ex: "Portaria principal").')
      return
    }
    setCreating(true)
    setError(null)
    try {
      await createTimeClockDevice(token, company.id, newDeviceName.trim())
      setNewDeviceName('')
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível cadastrar o dispositivo.')
    } finally {
      setCreating(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <h4 className="mb-2 text-[13px] font-bold text-[var(--ink)]">Novo dispositivo</h4>
        <div className="flex flex-wrap items-end gap-2.5">
          <div className="min-w-[220px] flex-1">
            <TextField
              label="Nome"
              icon={<BadgeIcon className="h-4 w-4" />}
              placeholder="Ex: Portaria principal"
              value={newDeviceName}
              onChange={(event) => setNewDeviceName(event.target.value)}
            />
          </div>
          <button
            type="button"
            onClick={handleCreateDevice}
            disabled={creating}
            className="flex items-center gap-1.5 rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13px] font-bold text-white hover:bg-[var(--blue-700)] disabled:opacity-60"
          >
            <PlusIcon className="h-4 w-4" />
            {creating ? 'Criando…' : 'Cadastrar'}
          </button>
        </div>
      </div>

      {error && <p className="text-[12.5px] font-medium text-[var(--red-500)]">{error}</p>}

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-xl bg-[var(--surface)]" />
          ))}
        </div>
      ) : devices.length === 0 ? (
        <p className="text-[13px] text-[var(--muted)]">Nenhum dispositivo cadastrado ainda.</p>
      ) : (
        <div className="flex flex-col gap-3">
          {devices.map((device) => (
            <DeviceCard
              key={device.id}
              session={session}
              company={company}
              device={device}
              enrollments={enrollments.filter((e) => e.time_clock_device_id === device.id)}
              onChanged={load}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function PainelTab({ session, company }: { session: AuthSession; company: AuthCompany }) {
  const token = session.token.token
  const [status, setStatus] = useState<TimeClockStatusResult | null>(null)
  const [events, setEvents] = useState<TimeClockEventRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const flashIds = useRef<Set<string>>(new Set())

  function load() {
    setLoading(true)
    setError(null)
    Promise.all([fetchTimeClockStatus(token, company.id), fetchTimeClockEvents(token, company.id, { limit: 25 })])
      .then(([statusResult, eventsResult]) => {
        setStatus(statusResult)
        setEvents(eventsResult.data)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível carregar o painel.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [token, company.id])

  useTimeClockUpdates(company.id, (event) => {
    flashIds.current.add(event.id)
    setEvents((current) => [event, ...current].slice(0, 25))
    setStatus((current) => {
      if (!current || !event.people_id) return current
      const others = current.people.filter((p) => p.people_id !== event.people_id)
      const updated = [
        ...others,
        {
          people_id: event.people_id,
          people_name: event.people_name || 'Funcionário',
          direction: event.direction,
          occurred_at: event.occurred_at,
        },
      ].sort((a, b) => a.people_name.localeCompare(b.people_name))
      return { inside_count: updated.filter((p) => p.direction === 'in').length, people: updated }
    })
  })

  const insideCount = status?.inside_count ?? 0

  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-[12px] font-semibold text-[var(--muted)]">Na empresa agora</p>
          <p className="mt-1 flex items-center gap-2 text-[28px] font-bold text-[var(--ink)]">
            <ArrowDownCircleIcon className="h-7 w-7 text-[var(--green-600)]" />
            {insideCount}
          </p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <p className="text-[12px] font-semibold text-[var(--muted)]">Funcionários vinculados</p>
          <p className="mt-1 text-[28px] font-bold text-[var(--ink)]">{status?.people.length ?? 0}</p>
        </div>
      </div>

      {error && <p className="text-[12.5px] font-medium text-[var(--red-500)]">{error}</p>}

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h4 className="mb-3 text-[13px] font-bold text-[var(--ink)]">Quem está onde</h4>
        {loading ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-10 animate-pulse rounded-xl bg-[var(--page)]" />
            ))}
          </div>
        ) : !status || status.people.length === 0 ? (
          <p className="text-[12.5px] text-[var(--muted)]">
            Nenhuma batida registrada ainda. Vincule funcionários na aba "Dispositivos".
          </p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {status.people.map((person) => (
              <div
                key={person.people_id}
                className="flex items-center justify-between gap-2 rounded-xl bg-[var(--page)] px-3.5 py-2.5"
              >
                <span className="flex items-center gap-2 text-[13px] font-semibold text-[var(--ink)]">
                  <UserIcon className="h-4 w-4 text-[var(--muted)]" />
                  {person.people_name}
                </span>
                <span className="flex items-center gap-2 text-[12px] text-[var(--muted)]">
                  {timeAgo(person.occurred_at)}
                  <span
                    className={`flex items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-bold ${
                      person.direction === 'in'
                        ? 'bg-[var(--green-100)] text-[var(--green-600)]'
                        : 'bg-[var(--page)] text-[var(--ink-soft)]'
                    }`}
                  >
                    {person.direction === 'in' ? (
                      <ArrowDownCircleIcon className="h-3 w-3" />
                    ) : (
                      <ArrowUpCircleIcon className="h-3 w-3" />
                    )}
                    {person.direction === 'in' ? 'Dentro' : 'Fora'}
                  </span>
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h4 className="mb-3 text-[13px] font-bold text-[var(--ink)]">Últimas batidas</h4>
        {events.length === 0 ? (
          <p className="text-[12.5px] text-[var(--muted)]">Nenhuma batida registrada ainda.</p>
        ) : (
          <div className="flex flex-col gap-1.5">
            {events.map((event) => (
              <div
                key={event.id}
                className="flex items-center justify-between gap-2 rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[12.5px]"
              >
                <span className="flex items-center gap-2 text-[var(--ink)]">
                  {event.direction === 'in' ? (
                    <ArrowDownCircleIcon className="h-4 w-4 flex-none text-[var(--green-600)]" />
                  ) : (
                    <ArrowUpCircleIcon className="h-4 w-4 flex-none text-[var(--ink-soft)]" />
                  )}
                  {event.people_name || 'Não identificado'}
                  <span className="text-[var(--muted)]">· {event.device_name || 'Dispositivo'}</span>
                </span>
                <span className="flex-none text-[var(--muted)]">{formatDateTime(event.occurred_at)}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export function TimeClockPage({ session, company, onBack }: TimeClockPageProps) {
  const [tab, setTab] = useState<Tab>('painel')

  const tabs = useMemo<{ key: Tab; label: string }[]>(
    () => [
      { key: 'painel', label: 'Painel' },
      { key: 'dispositivos', label: 'Dispositivos' },
    ],
    []
  )

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Ponto</p>
          <h1 className="mt-0.5 flex items-center gap-2 text-[22px] font-bold tracking-tight text-[var(--ink)]">
            <ClockIcon className="h-6 w-6 text-[var(--blue-700)]" />
            Controle de Ponto
          </h1>
          <p className="mt-1 text-[13px] text-[var(--muted)]">
            Acompanhe em tempo real quem entrou e saiu, e gerencie os relógios de ponto.
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
        >
          Voltar
        </button>
      </div>

      <div className="flex w-fit gap-1 rounded-xl bg-[var(--page)] p-1">
        {tabs.map((item) => (
          <button
            key={item.key}
            type="button"
            onClick={() => setTab(item.key)}
            className={`rounded-lg px-4 py-2 text-[12.5px] font-bold transition ${
              tab === item.key
                ? 'bg-[var(--surface)] text-[var(--blue-700)] shadow-sm'
                : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
            }`}
          >
            {item.label}
          </button>
        ))}
      </div>

      {tab === 'painel' ? (
        <PainelTab session={session} company={company} />
      ) : (
        <DispositivosTab session={session} company={company} />
      )}
    </div>
  )
}
