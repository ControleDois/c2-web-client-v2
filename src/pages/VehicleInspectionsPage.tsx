import { useEffect, useRef, useState } from 'react'
import {
  fetchVehicleInspections,
  fetchVehicleInspection,
  updateVehicleInspectionStatus,
  deleteVehicleInspection,
  downloadInspectionPhotosPdf,
  sendInspectionPhotosPdfWhatsapp,
  INSPECTION_STATUS_LABELS,
  INSPECTION_STATUS_ANALYSIS,
  INSPECTION_STATUS_APPROVED,
  INSPECTION_STATUS_REJECTED,
  type VehicleInspectionRecord,
} from '../lib/vehicleInspections'
import { fetchCompanyWhatsapps, WHATSAPP_STATUS_CONNECTED, type CompanyWhatsappRecord } from '../lib/companyWhatsapp'
import { fetchPeople, type PersonRecord } from '../lib/people'
import { ApiError } from '../lib/api'
import { formatDateTime } from '../lib/format'
import { formatPhone } from '../lib/formatPhone'
import {
  SearchIcon,
  ChevronDownIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClipboardCheckIcon,
  DownloadIcon,
  TrashIcon,
  EyeIcon,
  CheckCircleIcon,
  XCircleIcon,
  CloseIcon,
  WhatsappIcon,
} from '../components/icons'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { RowActionsMenu, type RowAction } from '../components/RowActionsMenu'
import { SearchSelectField } from '../components/form/SearchSelectField'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface VehicleInspectionsPageProps {
  session: AuthSession
  company: AuthCompany
}

const STATUS_FILTERS: { value: string; label: string }[] = [
  { value: '', label: 'Todos' },
  ...Object.entries(INSPECTION_STATUS_LABELS).map(([value, label]) => ({ value, label })),
]

function statusBadgeClass(status: number) {
  if (status === INSPECTION_STATUS_APPROVED) return 'bg-[var(--green-100)] text-[var(--green-600)]'
  if (status === INSPECTION_STATUS_REJECTED) return 'bg-[var(--red-100)] text-[var(--red-500)]'
  return 'bg-[var(--blue-100)] text-[var(--blue-700)]'
}

function vehicleLabel(item: VehicleInspectionRecord) {
  const vehicle = item.vehicle
  if (!vehicle) return '—'
  const name = [vehicle.brand, vehicle.model].filter(Boolean).join(' ')
  return [vehicle.license_plate, name].filter(Boolean).join(' · ') || '—'
}

function resolveClientPeople(item: VehicleInspectionRecord) {
  return item.people || item.towingSale?.people || null
}

function customerName(item: VehicleInspectionRecord) {
  const people = resolveClientPeople(item)
  return people?.name || people?.social_name || '—'
}

interface PhoneOption {
  label: string
  value: string
}

function buildPhoneOptions(item: VehicleInspectionRecord): PhoneOption[] {
  const options: PhoneOption[] = []
  const people = resolveClientPeople(item)

  if (people?.phone) {
    const clientName = people.name || people.social_name || 'Cliente'
    options.push({ label: `Cliente: ${clientName} · ${formatPhone(people.phone)}`, value: people.phone })
  }

  for (const contact of people?.contacts || []) {
    if (contact.phone) {
      options.push({ label: `Contato: ${contact.name} · ${formatPhone(contact.phone)}`, value: contact.phone })
    }
  }

  return options
}

interface SendWhatsappModalProps {
  session: AuthSession
  company: AuthCompany
  inspection: VehicleInspectionRecord
  onClose: () => void
  onSent: () => void
}

function SendWhatsappModal({ session, company, inspection, onClose, onSent }: SendWhatsappModalProps) {
  const [target, setTarget] = useState(inspection)
  const [loadingDetail, setLoadingDetail] = useState(true)
  const [whatsapps, setWhatsapps] = useState<CompanyWhatsappRecord[]>([])
  const [loadingWhatsapps, setLoadingWhatsapps] = useState(true)
  const [whatsappId, setWhatsappId] = useState('')
  const [phoneMode, setPhoneMode] = useState<'linked' | 'manual' | 'other'>('linked')
  const [selectedPhone, setSelectedPhone] = useState('')
  const [manualPhone, setManualPhone] = useState('')
  const [otherPerson, setOtherPerson] = useState<PersonRecord | null>(null)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchVehicleInspection(session.token.token, inspection.id)
      .then((res) => {
        if (cancelled) return
        setTarget(res)
        const options = buildPhoneOptions(res)
        if (options.length) {
          setSelectedPhone(options[0].value)
          setPhoneMode('linked')
        } else {
          setPhoneMode('manual')
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingDetail(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspection.id])

  useEffect(() => {
    let cancelled = false
    fetchCompanyWhatsapps(session.token.token, company.id, { limit: 100 })
      .then((res) => {
        if (cancelled) return
        const list = res.data || []
        setWhatsapps(list)
        const connected = list.find((w) => w.status === WHATSAPP_STATUS_CONNECTED)
        setWhatsappId(connected?.id || list[0]?.id || '')
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoadingWhatsapps(false)
      })
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id])

  const phoneOptions = buildPhoneOptions(target)

  function resolvePhone(): string {
    if (phoneMode === 'manual') return manualPhone
    if (phoneMode === 'other') return otherPerson?.phone || ''
    return selectedPhone
  }

  async function handleSend() {
    if (!whatsappId) {
      setError('Selecione um WhatsApp para enviar.')
      return
    }
    const phone = resolvePhone()
    if (!phone) {
      setError('Selecione ou informe um número de telefone.')
      return
    }

    setSending(true)
    setError(null)
    try {
      await sendInspectionPhotosPdfWhatsapp(session.token.token, target.id, { whatsappId, phone })
      onSent()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar o PDF pelo WhatsApp.')
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-[480px] rounded-2xl bg-[var(--surface)] shadow-[var(--card-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <div className="flex items-center gap-3">
            <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--green-100)] text-[var(--green-600)]">
              <WhatsappIcon className="h-4.5 w-4.5" />
            </span>
            <h2 className="text-[15px] font-bold text-[var(--ink)]">Enviar fotos por WhatsApp</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
          >
            <CloseIcon className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="flex flex-col gap-4 px-6 py-5">
          <div>
            <label className="text-[12px] font-semibold text-[var(--ink-soft)]">Enviar pelo WhatsApp</label>
            <div className="relative mt-1.5 flex items-center rounded-xl border border-[var(--border)] bg-[var(--page)] px-3.5 py-2.5">
              <select
                value={whatsappId}
                onChange={(event) => setWhatsappId(event.target.value)}
                disabled={loadingWhatsapps}
                className="w-full appearance-none bg-transparent text-[13.5px] font-semibold text-[var(--ink)] focus:outline-none"
              >
                {whatsapps.length === 0 && <option value="">Nenhum WhatsApp cadastrado</option>}
                {whatsapps.map((w) => (
                  <option key={w.id} value={w.id}>
                    {w.name} · {formatPhone(w.phone)} {w.status === WHATSAPP_STATUS_CONNECTED ? '(conectado)' : '(desconectado)'}
                  </option>
                ))}
              </select>
              <ChevronDownIcon className="pointer-events-none h-3.5 w-3.5 flex-none text-[var(--muted)]" />
            </div>
          </div>

          <div>
            <label className="text-[12px] font-semibold text-[var(--ink-soft)]">Enviar para</label>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {(
                [
                  { value: 'linked', label: 'Cliente vinculado', disabled: phoneOptions.length === 0 },
                  { value: 'manual', label: 'Número manual', disabled: false },
                  { value: 'other', label: 'Outra pessoa', disabled: false },
                ] as const
              ).map((option) => (
                <button
                  key={option.value}
                  type="button"
                  disabled={option.disabled}
                  onClick={() => setPhoneMode(option.value)}
                  className={`rounded-xl px-3.5 py-2 text-[12.5px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-40 ${
                    phoneMode === option.value
                      ? 'bg-[var(--blue-500)] text-white'
                      : 'bg-[var(--page)] text-[var(--ink-soft)] hover:bg-[var(--blue-100)]'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <div className="mt-3">
              {phoneMode === 'linked' &&
                (loadingDetail ? (
                  <p className="text-[12.5px] text-[var(--muted)]">Carregando contatos…</p>
                ) : phoneOptions.length === 0 ? (
                  <p className="text-[12.5px] text-[var(--muted)]">Nenhum telefone vinculado ao cliente.</p>
                ) : (
                  <div className="relative flex items-center rounded-xl border border-[var(--border)] bg-[var(--page)] px-3.5 py-2.5">
                    <select
                      value={selectedPhone}
                      onChange={(event) => setSelectedPhone(event.target.value)}
                      className="w-full appearance-none bg-transparent text-[13.5px] text-[var(--ink)] focus:outline-none"
                    >
                      {phoneOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <ChevronDownIcon className="pointer-events-none h-3.5 w-3.5 flex-none text-[var(--muted)]" />
                  </div>
                ))}

              {phoneMode === 'manual' && (
                <input
                  type="text"
                  value={manualPhone}
                  onChange={(event) => setManualPhone(event.target.value)}
                  placeholder="(11) 99999-9999"
                  className="w-full rounded-xl border border-[var(--border)] bg-[var(--page)] px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
                />
              )}

              {phoneMode === 'other' && (
                <SearchSelectField<PersonRecord>
                  label=""
                  placeholder="Buscar pessoa por nome, documento ou telefone"
                  selectedLabel={otherPerson ? otherPerson.name : null}
                  selectedSubLabel={otherPerson?.phone ? formatPhone(otherPerson.phone) : undefined}
                  onSearch={(query) =>
                    fetchPeople(session.token.token, company.id, { search: query, limit: 8 }).then((res) => res.data || [])
                  }
                  getOptionLabel={(person) => person.name}
                  getOptionSubLabel={(person) => (person.phone ? formatPhone(person.phone) : undefined)}
                  onSelect={setOtherPerson}
                  onClear={() => setOtherPerson(null)}
                />
              )}
            </div>
          </div>

          {error && (
            <div className="rounded-xl bg-[var(--red-100)] p-3 text-[13px] font-medium text-[var(--red-500)]">{error}</div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="rounded-xl px-4 py-2.5 text-[13.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={sending}
            className="flex items-center gap-2 rounded-xl bg-[var(--green-600)] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:opacity-90 disabled:opacity-60"
          >
            <WhatsappIcon className="h-4 w-4" />
            {sending ? 'Enviando…' : 'Enviar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function VehicleInspectionsPage({ session, company }: VehicleInspectionsPageProps) {
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<VehicleInspectionRecord[]>([])
  const [meta, setMeta] = useState({ total: 0, lastPage: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)

  const [detailItem, setDetailItem] = useState<VehicleInspectionRecord | null>(null)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<VehicleInspectionRecord | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null)
  const [sendWhatsappTarget, setSendWhatsappTarget] = useState<VehicleInspectionRecord | null>(null)
  const [sendWhatsappSuccess, setSendWhatsappSuccess] = useState(false)

  const skipDebounce = useRef(false)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const timeout = setTimeout(
      () => {
        fetchVehicleInspections(session.token.token, company.id, {
          search,
          status: status === '' ? undefined : Number(status),
          page,
          limit: 10,
        })
          .then((res) => {
            if (cancelled) return
            setItems(res.data || [])
            setMeta({ total: res.meta?.total ?? res.data?.length ?? 0, lastPage: res.meta?.last_page ?? 1 })
          })
          .catch((err) => {
            if (cancelled) return
            setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as vistorias.')
          })
          .finally(() => {
            if (!cancelled) setLoading(false)
          })
      },
      skipDebounce.current ? 0 : 350
    )
    skipDebounce.current = false

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, status, page, company.id, session.token.token, refreshKey])

  useEffect(() => {
    if (lightboxIndex === null) return
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setLightboxIndex(null)
      if (event.key === 'ArrowRight') setLightboxIndex((i) => movePhotoIndex(i, 1))
      if (event.key === 'ArrowLeft') setLightboxIndex((i) => movePhotoIndex(i, -1))
    }
    function movePhotoIndex(current: number | null, delta: number) {
      const total = detailItem?.photos?.length ?? 0
      if (current === null || total === 0) return current
      return (current + delta + total) % total
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [lightboxIndex, detailItem])

  function reload() {
    skipDebounce.current = true
    setRefreshKey((key) => key + 1)
  }

  function silentReload() {
    fetchVehicleInspections(session.token.token, company.id, {
      search,
      status: status === '' ? undefined : Number(status),
      page,
      limit: 10,
    })
      .then((res) => {
        setItems(res.data || [])
        setMeta((prev) => ({ ...prev, total: res.meta?.total ?? res.data?.length ?? prev.total, lastPage: res.meta?.last_page ?? prev.lastPage }))
      })
      .catch(() => {})
  }

  async function handleUpdateStatus(nextStatus: number) {
    if (!detailItem) return
    setStatusUpdating(true)
    setActionError(null)
    try {
      const updated = await updateVehicleInspectionStatus(session.token.token, detailItem.id, nextStatus)
      setDetailItem(updated)
      reload()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Não foi possível atualizar o status da vistoria.')
    } finally {
      setStatusUpdating(false)
    }
  }

  async function handleDownloadPdf(item: VehicleInspectionRecord) {
    setDownloadingId(item.id)
    setActionError(null)
    try {
      await downloadInspectionPhotosPdf(session.token.token, item.id, item.code)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Não foi possível baixar o PDF da vistoria.')
    } finally {
      setDownloadingId(null)
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    const deletedId = deleteTarget.id
    setDeleting(true)
    setActionError(null)
    try {
      await deleteVehicleInspection(session.token.token, deletedId)
      setDeleteTarget(null)
      if (detailItem?.id === deletedId) setDetailItem(null)
      setItems((prev) => prev.filter((item) => item.id !== deletedId))
      setMeta((prev) => ({ ...prev, total: Math.max(0, prev.total - 1) }))
      silentReload()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Não foi possível excluir a vistoria.')
    } finally {
      setDeleting(false)
    }
  }

  const photos = detailItem?.photos ?? []

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Operação</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Aprovação de Vistorias</h1>
        <p className="mt-1 text-[13px] text-[var(--muted)]">
          Revise as vistorias registradas e aprove ou reprove antes da liberação do veículo.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
          <SearchIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
          <input
            type="text"
            placeholder="Buscar por código, placa ou cliente"
            value={search}
            onChange={(event) => {
              setPage(1)
              setSearch(event.target.value)
            }}
            className="w-full bg-transparent text-[13.5px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
          />
        </div>

        <div className="relative flex w-full items-center rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 sm:w-56">
          <select
            value={status}
            onChange={(event) => {
              setPage(1)
              setStatus(event.target.value)
            }}
            className="w-full appearance-none bg-transparent text-[13.5px] font-semibold text-[var(--ink-soft)] focus:outline-none"
          >
            {STATUS_FILTERS.map((option) => (
              <option key={option.label} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
          <ChevronDownIcon className="pointer-events-none h-3.5 w-3.5 flex-none text-[var(--muted)]" />
        </div>
      </div>

      {error && (
        <div className="rounded-2xl bg-[var(--red-100)] p-4 text-[13.5px] font-medium text-[var(--red-500)]">{error}</div>
      )}

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        {loading ? (
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-11 animate-pulse rounded-xl bg-[var(--page)]" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-[13.5px] text-[var(--muted)]">
            Nenhuma vistoria encontrada{search ? ` para "${search}"` : ''}.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2.5 sm:hidden">
              {items.map((item) => {
                const actions: RowAction[] = [
                  { key: 'view', label: 'Ver detalhes', icon: <EyeIcon className="h-4 w-4" />, onClick: () => setDetailItem(item) },
                  {
                    key: 'pdf',
                    label: downloadingId === item.id ? 'Baixando…' : 'Baixar PDF',
                    icon: <DownloadIcon className="h-4 w-4" />,
                    onClick: () => handleDownloadPdf(item),
                  },
                  {
                    key: 'whatsapp',
                    label: 'Enviar por WhatsApp',
                    icon: <WhatsappIcon className="h-4 w-4" />,
                    onClick: () => setSendWhatsappTarget(item),
                  },
                  {
                    key: 'delete',
                    label: 'Excluir',
                    icon: <TrashIcon className="h-4 w-4" />,
                    tone: 'danger',
                    dividerBefore: true,
                    onClick: () => setDeleteTarget(item),
                  },
                ]

                return (
                  <div
                    key={item.id}
                    onClick={() => setDetailItem(item)}
                    className="cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="min-w-0 truncate text-[13.5px] font-bold text-[var(--ink)]">{vehicleLabel(item)}</p>
                        <p className="mt-0.5 text-[12px] text-[var(--muted)]">
                          {item.code ? `#${item.code}` : '—'} · {customerName(item)}
                        </p>
                        <p className="text-[12px] text-[var(--ink-soft)]">{formatDateTime(item.created_at)}</p>
                      </div>
                      <div className="flex flex-none items-center gap-2" onClick={(event) => event.stopPropagation()}>
                        <span className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold ${statusBadgeClass(item.status)}`}>
                          {INSPECTION_STATUS_LABELS[item.status] ?? item.status}
                        </span>
                        <RowActionsMenu actions={actions} />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                    <th className="pb-2.5 pl-3">Código</th>
                    <th className="pb-2.5">Veículo</th>
                    <th className="pb-2.5">Cliente</th>
                    <th className="pb-2.5">Data</th>
                    <th className="pb-2.5">Status</th>
                    <th className="pb-2.5 pr-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => {
                    const actions: RowAction[] = [
                      { key: 'view', label: 'Ver detalhes', icon: <EyeIcon className="h-4 w-4" />, onClick: () => setDetailItem(item) },
                      {
                        key: 'pdf',
                        label: downloadingId === item.id ? 'Baixando…' : 'Baixar PDF',
                        icon: <DownloadIcon className="h-4 w-4" />,
                        onClick: () => handleDownloadPdf(item),
                      },
                      {
                        key: 'whatsapp',
                        label: 'Enviar por WhatsApp',
                        icon: <WhatsappIcon className="h-4 w-4" />,
                        onClick: () => setSendWhatsappTarget(item),
                      },
                      {
                        key: 'delete',
                        label: 'Excluir',
                        icon: <TrashIcon className="h-4 w-4" />,
                        tone: 'danger',
                        dividerBefore: true,
                        onClick: () => setDeleteTarget(item),
                      },
                    ]

                    return (
                      <tr
                        key={item.id}
                        onClick={() => setDetailItem(item)}
                        className={`cursor-pointer border-b border-[var(--border)] transition-colors last:border-none hover:bg-[var(--blue-100)] ${
                          index % 2 === 1 ? 'bg-[var(--page)]' : ''
                        }`}
                      >
                        <td className="py-2.5 pl-3 font-mono text-[var(--ink-soft)]">{item.code ? `#${item.code}` : '—'}</td>
                        <td className="py-2.5 font-medium text-[var(--ink)]">{vehicleLabel(item)}</td>
                        <td className="py-2.5 text-[var(--ink-soft)]">{customerName(item)}</td>
                        <td className="py-2.5 whitespace-nowrap text-[var(--ink-soft)]">{formatDateTime(item.created_at)}</td>
                        <td className="py-2.5">
                          <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusBadgeClass(item.status)}`}>
                            {INSPECTION_STATUS_LABELS[item.status] ?? item.status}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3 text-right" onClick={(event) => event.stopPropagation()}>
                          <RowActionsMenu actions={actions} />
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!loading && meta.lastPage > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-[12px] text-[var(--muted)]">{meta.total} vistorias no total</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--ink-soft)] disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="text-[12.5px] text-[var(--ink-soft)]">
                {page} / {meta.lastPage}
              </span>
              <button
                type="button"
                disabled={page >= meta.lastPage}
                onClick={() => setPage((p) => Math.min(meta.lastPage, p + 1))}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--ink-soft)] disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {detailItem && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[var(--surface)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--blue-100)] text-[var(--blue-700)]">
                <ClipboardCheckIcon className="h-4.5 w-4.5" />
              </span>
              <div>
                <h2 className="text-[15px] font-bold text-[var(--ink)]">
                  Vistoria {detailItem.code ? `#${detailItem.code}` : ''}
                </h2>
                <p className="text-[12px] text-[var(--muted)]">{formatDateTime(detailItem.created_at)}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setDetailItem(null)}
              className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
            >
              <CloseIcon className="h-5 w-5" />
            </button>
          </div>

          <div className="mx-auto flex w-full max-w-[900px] flex-1 flex-col overflow-y-auto px-6 py-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">Veículo</p>
                <p className="mt-0.5 text-[13.5px] font-medium text-[var(--ink)]">{vehicleLabel(detailItem)}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">Cliente</p>
                <p className="mt-0.5 text-[13.5px] font-medium text-[var(--ink)]">{customerName(detailItem)}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">Responsável</p>
                <p className="mt-0.5 text-[13.5px] font-medium text-[var(--ink)]">{detailItem.user?.name || '—'}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">Status</p>
                <span
                  className={`mt-1 inline-block rounded-full px-2.5 py-1 text-[11px] font-bold ${statusBadgeClass(detailItem.status)}`}
                >
                  {INSPECTION_STATUS_LABELS[detailItem.status] ?? detailItem.status}
                </span>
              </div>
            </div>

            <div className="mt-6">
              <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                Fotos ({photos.length})
              </p>
              {photos.length > 0 ? (
                <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {photos.map((photo, index) => (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() => setLightboxIndex(index)}
                      className="group overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--page)] text-left"
                    >
                      <img src={photo.file_url} alt={photo.name || ''} className="h-32 w-full object-cover transition group-hover:opacity-90" />
                      {photo.name && (
                        <p className="truncate px-2 py-1.5 text-[11.5px] font-medium text-[var(--ink-soft)]">{photo.name}</p>
                      )}
                    </button>
                  ))}
                </div>
              ) : (
                <p className="mt-2 text-[13px] text-[var(--muted)]">Nenhuma foto registrada.</p>
              )}
            </div>

            {(detailItem.customer_signature_url || detailItem.driver_signature_url) && (
              <div className="mt-6 grid gap-4 sm:grid-cols-2">
                {detailItem.customer_signature_url && (
                  <div>
                    <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">Assinatura do cliente</p>
                    <img
                      src={detailItem.customer_signature_url}
                      alt="Assinatura do cliente"
                      className="mt-1 h-16 rounded-lg border border-[var(--border)] bg-white object-contain p-1"
                    />
                  </div>
                )}
                {detailItem.driver_signature_url && (
                  <div>
                    <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">Assinatura do motorista</p>
                    <img
                      src={detailItem.driver_signature_url}
                      alt="Assinatura do motorista"
                      className="mt-1 h-16 rounded-lg border border-[var(--border)] bg-white object-contain p-1"
                    />
                  </div>
                )}
              </div>
            )}

            {actionError && (
              <div className="mt-4 rounded-xl bg-[var(--red-100)] p-3 text-[13px] font-medium text-[var(--red-500)]">
                {actionError}
              </div>
            )}
          </div>

          <div className="mx-auto flex w-full max-w-[900px] flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-6 py-4">
            <div className="flex items-center gap-2.5">
              <button
                type="button"
                onClick={() => handleDownloadPdf(detailItem)}
                disabled={downloadingId === detailItem.id}
                className="flex items-center gap-2 rounded-xl border border-[var(--border)] px-4 py-2.5 text-[13px] font-semibold text-[var(--ink-soft)] transition hover:bg-[var(--page)] disabled:opacity-60"
              >
                <DownloadIcon className="h-4 w-4" />
                {downloadingId === detailItem.id ? 'Baixando…' : 'Baixar PDF'}
              </button>
              <button
                type="button"
                onClick={() => setSendWhatsappTarget(detailItem)}
                className="flex items-center gap-2 rounded-xl bg-[var(--green-100)] px-4 py-2.5 text-[13px] font-bold text-[var(--green-600)] transition hover:bg-green-200"
              >
                <WhatsappIcon className="h-4 w-4" />
                Enviar por WhatsApp
              </button>
            </div>

            <div className="flex items-center gap-2.5">
              {detailItem.status !== INSPECTION_STATUS_REJECTED && (
                <button
                  type="button"
                  onClick={() => handleUpdateStatus(INSPECTION_STATUS_REJECTED)}
                  disabled={statusUpdating}
                  className="flex items-center gap-2 rounded-xl bg-[var(--red-100)] px-4 py-2.5 text-[13px] font-bold text-[var(--red-500)] transition hover:bg-red-200 disabled:opacity-60"
                >
                  <XCircleIcon className="h-4 w-4" />
                  Reprovar
                </button>
              )}
              {detailItem.status !== INSPECTION_STATUS_APPROVED && (
                <button
                  type="button"
                  onClick={() => handleUpdateStatus(INSPECTION_STATUS_APPROVED)}
                  disabled={statusUpdating}
                  className="flex items-center gap-2 rounded-xl bg-[var(--green-100)] px-4 py-2.5 text-[13px] font-bold text-[var(--green-600)] transition hover:bg-green-200 disabled:opacity-60"
                >
                  <CheckCircleIcon className="h-4 w-4" />
                  Aprovar
                </button>
              )}
              {detailItem.status !== INSPECTION_STATUS_ANALYSIS && (
                <button
                  type="button"
                  onClick={() => handleUpdateStatus(INSPECTION_STATUS_ANALYSIS)}
                  disabled={statusUpdating}
                  className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-[13px] font-semibold text-[var(--ink-soft)] transition hover:bg-[var(--page)] disabled:opacity-60"
                >
                  Voltar para análise
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {detailItem && lightboxIndex !== null && photos[lightboxIndex] && (
        <div className="fixed inset-0 z-[60] flex flex-col items-center justify-center bg-black/90 p-4">
          <button
            type="button"
            onClick={() => setLightboxIndex(null)}
            className="absolute right-5 top-5 rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
          >
            <CloseIcon className="h-5 w-5" />
          </button>

          {photos.length > 1 && (
            <button
              type="button"
              onClick={() => setLightboxIndex((i) => (i === null ? i : (i - 1 + photos.length) % photos.length))}
              className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20 sm:left-6"
            >
              <ChevronLeftIcon className="h-5 w-5" />
            </button>
          )}

          <img
            src={photos[lightboxIndex].file_url}
            alt={photos[lightboxIndex].name || ''}
            className="max-h-[80vh] max-w-full rounded-lg object-contain"
          />

          <div className="mt-4 text-center text-white">
            {photos[lightboxIndex].name && <p className="text-[14px] font-semibold">{photos[lightboxIndex].name}</p>}
            <p className="mt-0.5 text-[12px] opacity-70">
              {lightboxIndex + 1} / {photos.length}
            </p>
          </div>

          {photos.length > 1 && (
            <button
              type="button"
              onClick={() => setLightboxIndex((i) => (i === null ? i : (i + 1) % photos.length))}
              className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20 sm:right-6"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
          )}
        </div>
      )}

      {sendWhatsappTarget && (
        <SendWhatsappModal
          session={session}
          company={company}
          inspection={sendWhatsappTarget}
          onClose={() => setSendWhatsappTarget(null)}
          onSent={() => {
            setSendWhatsappTarget(null)
            setSendWhatsappSuccess(true)
            setTimeout(() => setSendWhatsappSuccess(false), 3000)
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Excluir vistoria"
        message={`Tem certeza que deseja excluir a vistoria ${deleteTarget?.code ? `#${deleteTarget.code}` : ''}? Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      {actionError && !detailItem && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-[var(--red-500)] px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg">
          {actionError}
        </div>
      )}

      {sendWhatsappSuccess && (
        <div className="fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 rounded-xl bg-[var(--green-600)] px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg">
          PDF enviado pelo WhatsApp com sucesso.
        </div>
      )}
    </div>
  )
}
