import { useEffect, useRef, useState } from 'react'
import {
  fetchTowingDriverQueue,
  updateTowingCollectionStatus,
  COLLECTION_STATUS_LABELS,
  COLLECTION_STATUS_WAITING_PICKUP,
  COLLECTION_STATUS_GOING_TO_PICKUP,
  COLLECTION_STATUS_PICKUP_FAILED,
  COLLECTION_STATUS_COLLECTED,
  COLLECTION_STATUS_DELIVERED,
  type TowingSaleRecord,
} from '../lib/towingSale'
import { createVehicleInspection } from '../lib/vehicleInspections'
import { ApiError } from '../lib/api'
import { formatCurrency, formatDateTime } from '../lib/format'
import { formatPhone } from '../lib/formatPhone'
import { SearchIcon, RouteIcon, CameraIcon, AlertTriangleIcon, CheckCircleIcon, CloseIcon, TrashIcon } from '../components/icons'
import { ConfirmDialog } from '../components/ConfirmDialog'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface TowingCollectionPageProps {
  session: AuthSession
  company: AuthCompany
}

function statusStyles(status: number) {
  switch (status) {
    case COLLECTION_STATUS_GOING_TO_PICKUP:
      return 'bg-[var(--blue-100)] text-[var(--blue-700)]'
    case COLLECTION_STATUS_PICKUP_FAILED:
      return 'bg-[var(--red-100)] text-[var(--red-500)]'
    case COLLECTION_STATUS_COLLECTED:
      return 'bg-amber-100 text-amber-700'
    case COLLECTION_STATUS_DELIVERED:
      return 'bg-[var(--green-100)] text-[var(--green-600)]'
    default:
      return 'bg-[var(--page)] text-[var(--ink-soft)]'
  }
}

function vehicleLabel(item: TowingSaleRecord) {
  const vehicle = item.vehicle
  if (!vehicle) return '—'
  return [vehicle.brand, vehicle.model, vehicle.license_plate].filter(Boolean).join(' · ') || '—'
}

function addressLabel(item: TowingSaleRecord, prefix: 'origin' | 'destination') {
  const record = item as unknown as Record<string, string | undefined>
  return [
    record[`${prefix}_address`],
    record[`${prefix}_number`],
    record[`${prefix}_district`],
    record[`${prefix}_city`],
    record[`${prefix}_state`],
  ]
    .filter(Boolean)
    .join(', ')
}

interface PhotoSlot {
  id: string
  label: string
  required: boolean
  file: File | null
  previewUrl: string | null
  observation: string
}

const REQUIRED_PHOTO_SLOTS: { id: string; label: string }[] = [
  { id: 'frente', label: 'Dianteira' },
  { id: 'lateral_dir', label: 'Lateral direita' },
  { id: 'lateral_esq', label: 'Lateral esquerda' },
  { id: 'traseira', label: 'Traseira' },
  { id: 'painel', label: 'Painel ligado' },
  { id: 'chassi', label: 'Chassi (VIN)' },
]

function buildInitialSlots(): PhotoSlot[] {
  return REQUIRED_PHOTO_SLOTS.map((slot) => ({ ...slot, required: true, file: null, previewUrl: null, observation: '' }))
}

interface InspectionModalProps {
  session: AuthSession
  company: AuthCompany
  sale: TowingSaleRecord
  onClose: () => void
  onCompleted: (inspectionId: string) => void
}

function InspectionCaptureModal({ session, company, sale, onClose, onCompleted }: InspectionModalProps) {
  const [slots, setSlots] = useState<PhotoSlot[]>(buildInitialSlots)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function updateSlotFile(index: number, file: File | null) {
    setSlots((prev) =>
      prev.map((slot, i) => {
        if (i !== index) return slot
        if (slot.previewUrl) URL.revokeObjectURL(slot.previewUrl)
        return { ...slot, file, previewUrl: file ? URL.createObjectURL(file) : null }
      })
    )
  }

  function addExtraSlot() {
    setSlots((prev) => [
      ...prev,
      {
        id: `detalhe_${Date.now()}`,
        label: `Detalhe adicional ${prev.filter((s) => !s.required).length + 1}`,
        required: false,
        file: null,
        previewUrl: null,
        observation: '',
      },
    ])
  }

  function removeSlot(index: number) {
    setSlots((prev) => {
      const slot = prev[index]
      if (slot?.previewUrl) URL.revokeObjectURL(slot.previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }

  const missingRequired = slots.some((slot) => slot.required && !slot.file)

  async function handleSubmit() {
    if (missingRequired || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const photos = slots
        .filter((slot) => slot.file)
        .map((slot) => ({ file: slot.file as File, label: slot.label, observation: slot.observation }))

      const result = await createVehicleInspection(session.token.token, {
        company_id: company.id,
        vehicle_id: sale.vehicle_id || sale.vehicle?.id || '',
        people_id: sale.people_id,
        user_id: session.user.people?.id,
        towing_sale_id: sale.id,
        photos,
      })
      onCompleted(result.data.id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível registrar a vistoria.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
      <div className="flex max-h-[85vh] w-full max-w-[640px] flex-col rounded-2xl bg-[var(--surface)] shadow-[var(--card-shadow)]">
        <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
          <div>
            <h2 className="text-[15px] font-bold text-[var(--ink)]">Vistoria de retirada</h2>
            <p className="text-[12px] text-[var(--muted)]">
              {vehicleLabel(sale)} · Venda #{sale.code}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)] disabled:opacity-60"
          >
            <CloseIcon className="h-4.5 w-4.5" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">
          <p className="text-[13px] text-[var(--muted)]">
            Registre as fotos obrigatórias do veículo antes de marcar a coleta. Você pode adicionar fotos extras para
            avarias ou detalhes específicos.
          </p>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {slots.map((slot, index) => (
              <div key={slot.id} className="rounded-xl border border-[var(--border)] p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[12.5px] font-semibold text-[var(--ink)]">
                    {slot.label}
                    {slot.required && <span className="text-[var(--red-500)]"> *</span>}
                  </p>
                  {!slot.required && (
                    <button
                      type="button"
                      onClick={() => removeSlot(index)}
                      className="rounded-lg p-1 text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--red-500)]"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                {slot.previewUrl ? (
                  <img src={slot.previewUrl} alt={slot.label} className="mt-2 h-28 w-full rounded-lg object-cover" />
                ) : (
                  <label className="mt-2 flex h-28 w-full cursor-pointer flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] bg-[var(--page)] text-[var(--muted)] hover:border-[var(--blue-500)] hover:text-[var(--blue-700)]">
                    <CameraIcon className="h-5 w-5" />
                    <span className="text-[11.5px] font-semibold">Tirar/anexar foto</span>
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(event) => updateSlotFile(index, event.target.files?.[0] ?? null)}
                    />
                  </label>
                )}
                {slot.previewUrl && (
                  <label className="mt-2 block cursor-pointer text-center text-[11.5px] font-semibold text-[var(--blue-700)] hover:underline">
                    Trocar foto
                    <input
                      type="file"
                      accept="image/*"
                      capture="environment"
                      className="hidden"
                      onChange={(event) => updateSlotFile(index, event.target.files?.[0] ?? null)}
                    />
                  </label>
                )}
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addExtraSlot}
            className="mt-4 rounded-xl border border-dashed border-[var(--border)] px-4 py-2 text-[12.5px] font-semibold text-[var(--ink-soft)] hover:border-[var(--blue-500)] hover:text-[var(--blue-700)]"
          >
            + Adicionar foto extra
          </button>

          {error && (
            <div className="mt-4 rounded-xl bg-[var(--red-100)] p-3 text-[13px] font-medium text-[var(--red-500)]">
              {error}
            </div>
          )}
        </div>

        <div className="flex items-center justify-end gap-3 border-t border-[var(--border)] px-6 py-4">
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            className="rounded-xl px-4 py-2.5 text-[13.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={missingRequired || submitting}
            className="flex items-center gap-2 rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
          >
            <CheckCircleIcon className="h-4 w-4" />
            {submitting ? 'Enviando…' : 'Concluir vistoria e coletar'}
          </button>
        </div>
      </div>
    </div>
  )
}

export function TowingCollectionPage({ session, company }: TowingCollectionPageProps) {
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<TowingSaleRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const skipDebounce = useRef(false)

  const [savingId, setSavingId] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [failureTarget, setFailureTarget] = useState<TowingSaleRecord | null>(null)
  const [failureObservation, setFailureObservation] = useState('')
  const [deliverTarget, setDeliverTarget] = useState<TowingSaleRecord | null>(null)
  const [inspectionTarget, setInspectionTarget] = useState<TowingSaleRecord | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    const timeout = setTimeout(
      () => {
        fetchTowingDriverQueue(session.token.token, company.id, { search })
          .then((res) => {
            if (cancelled) return
            setItems(res.data || [])
          })
          .catch((err) => {
            if (cancelled) return
            setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as buscas de veículos.')
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
  }, [search, company.id, session.token.token, refreshKey])

  function reload() {
    skipDebounce.current = true
    setRefreshKey((key) => key + 1)
  }

  async function moveStatus(sale: TowingSaleRecord, status: number, observation: string, vehicleInspectionId?: string) {
    setSavingId(sale.id)
    setActionError(null)
    try {
      await updateTowingCollectionStatus(session.token.token, sale.id, {
        status,
        observation,
        userId: session.user.people?.id,
        vehicleInspectionId,
      })
      reload()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Não foi possível atualizar a busca.')
    } finally {
      setSavingId(null)
    }
  }

  async function handleConfirmFailure() {
    if (!failureTarget) return
    await moveStatus(failureTarget, COLLECTION_STATUS_PICKUP_FAILED, failureObservation || 'Retirada não efetuada.')
    setFailureTarget(null)
    setFailureObservation('')
  }

  async function handleConfirmDeliver() {
    if (!deliverTarget) return
    await moveStatus(deliverTarget, COLLECTION_STATUS_DELIVERED, 'Veículo entregue na empresa.')
    setDeliverTarget(null)
  }

  async function handleInspectionCompleted(inspectionId: string) {
    if (!inspectionTarget) return
    await moveStatus(inspectionTarget, COLLECTION_STATUS_COLLECTED, 'Vistoria concluída na retirada do veículo.', inspectionId)
    setInspectionTarget(null)
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <div>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Operação</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Busca de Veículos</h1>
        <p className="mt-1 text-[13px] text-[var(--muted)]">
          Contratos assinados liberados para retirada, vistoria e entrega na empresa.
        </p>
      </div>

      <div className="flex min-w-[240px] max-w-md items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
        <SearchIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
        <input
          type="text"
          placeholder="Buscar por cliente, placa ou código"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full bg-transparent text-[13.5px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
        />
      </div>

      {error && (
        <div className="rounded-2xl bg-[var(--red-100)] p-4 text-[13.5px] font-medium text-[var(--red-500)]">{error}</div>
      )}

      {loading ? (
        <div className="grid gap-4 xl:grid-cols-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-48 animate-pulse rounded-2xl bg-[var(--page)]" />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-10 text-center">
          <RouteIcon className="mx-auto h-8 w-8 text-[var(--muted)]" />
          <p className="mt-3 text-[13.5px] text-[var(--muted)]">Nenhum veículo liberado para busca no momento.</p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {items.map((item) => {
            const status = item.collection_status ?? COLLECTION_STATUS_WAITING_PICKUP
            const saving = savingId === item.id
            const canStart = status === COLLECTION_STATUS_WAITING_PICKUP || status === COLLECTION_STATUS_PICKUP_FAILED
            const canResolvePickup = status === COLLECTION_STATUS_GOING_TO_PICKUP
            const canDeliver = status === COLLECTION_STATUS_COLLECTED

            return (
              <article key={item.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--card-shadow)]">
                <div className="border-b border-[var(--border)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[13px] font-black text-[var(--ink)]">#{item.code}</p>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusStyles(status)}`}>
                          {COLLECTION_STATUS_LABELS[status] ?? status}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[15px] font-bold text-[var(--ink)]">{vehicleLabel(item)}</p>
                      <p className="text-[13px] text-[var(--muted)]">
                        {item.people?.name || '—'} · {item.people?.phone ? formatPhone(item.people.phone) : item.people?.document || '—'}
                      </p>
                    </div>
                    <p className="text-[13.5px] font-bold text-[var(--ink)]">{formatCurrency(item.transport_value)}</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
                  <div className="rounded-xl bg-[var(--page)] p-3">
                    <p className="text-[10.5px] font-bold tracking-wide text-[var(--muted)] uppercase">Origem</p>
                    <p className="mt-1 text-[12.5px] font-semibold text-[var(--ink)]">{addressLabel(item, 'origin') || '—'}</p>
                  </div>
                  <div className="rounded-xl bg-[var(--page)] p-3">
                    <p className="text-[10.5px] font-bold tracking-wide text-[var(--muted)] uppercase">Destino</p>
                    <p className="mt-1 text-[12.5px] font-semibold text-[var(--ink)]">{addressLabel(item, 'destination') || '—'}</p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 px-4 pb-4 sm:flex-row">
                  {canStart && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => moveStatus(item, COLLECTION_STATUS_GOING_TO_PICKUP, 'Motorista iniciou deslocamento para retirada.')}
                      className="min-h-11 flex-1 rounded-xl bg-[var(--blue-500)] px-4 py-2 text-[13px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
                    >
                      Estou indo retirar
                    </button>
                  )}
                  {canResolvePickup && (
                    <>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => setInspectionTarget(item)}
                        className="min-h-11 flex-1 rounded-xl bg-[var(--green-100)] px-4 py-2 text-[13px] font-bold text-[var(--green-600)] transition hover:bg-green-200 disabled:opacity-60"
                      >
                        Retirar e fazer vistoria
                      </button>
                      <button
                        type="button"
                        disabled={saving}
                        onClick={() => setFailureTarget(item)}
                        className="min-h-11 flex-1 rounded-xl bg-[var(--red-100)] px-4 py-2 text-[13px] font-bold text-[var(--red-500)] transition hover:bg-red-200 disabled:opacity-60"
                      >
                        Retirada não efetuada
                      </button>
                    </>
                  )}
                  {canDeliver && (
                    <button
                      type="button"
                      disabled={saving}
                      onClick={() => setDeliverTarget(item)}
                      className="min-h-11 flex-1 rounded-xl bg-[var(--blue-500)] px-4 py-2 text-[13px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
                    >
                      Veículo entregue
                    </button>
                  )}
                </div>

                {item.collectionStatusHistories && item.collectionStatusHistories.length > 0 && (
                  <div className="border-t border-[var(--border)] p-4">
                    <h3 className="text-[12.5px] font-bold text-[var(--ink)]">Histórico</h3>
                    <div className="mt-3 flex flex-col gap-3 border-l-2 border-[var(--blue-100)] pl-4">
                      {item.collectionStatusHistories.map((event) => (
                        <div key={event.id}>
                          <p className="text-[12.5px] font-bold text-[var(--ink)]">
                            {event.previous_status === null || event.previous_status === undefined
                              ? 'Início'
                              : COLLECTION_STATUS_LABELS[event.previous_status] ?? event.previous_status}{' '}
                            → {COLLECTION_STATUS_LABELS[event.new_status] ?? event.new_status}
                          </p>
                          {event.observation && <p className="mt-0.5 text-[12px] text-[var(--muted)]">{event.observation}</p>}
                          <p className="mt-0.5 text-[11px] font-semibold text-[var(--muted)]">
                            {formatDateTime(event.changed_at)} · {event.user?.name || 'Sistema'}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            )
          })}
        </div>
      )}

      {failureTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setFailureTarget(null)}>
          <div
            className="w-full max-w-[480px] rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[var(--red-100)] text-[var(--red-500)]">
                <AlertTriangleIcon className="h-5 w-5" />
              </span>
              <div>
                <h2 className="text-[15px] font-bold text-[var(--ink)]">Retirada não efetuada</h2>
                <p className="mt-1 text-[13px] text-[var(--muted)]">Registre o motivo para aparecer no histórico da venda.</p>
              </div>
            </div>
            <textarea
              value={failureObservation}
              onChange={(event) => setFailureObservation(event.target.value)}
              rows={4}
              placeholder="Cliente ausente, endereço incorreto, etc."
              className="mt-4 w-full resize-none rounded-xl border border-[var(--border)] bg-[var(--page)] px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
            />
            <div className="mt-5 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setFailureTarget(null)}
                className="rounded-xl px-4 py-2 text-[13.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleConfirmFailure}
                disabled={savingId === failureTarget.id}
                className="rounded-xl bg-[var(--red-500)] px-4 py-2 text-[13.5px] font-bold text-white transition hover:bg-red-600 disabled:opacity-60"
              >
                {savingId === failureTarget.id ? 'Salvando…' : 'Confirmar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deliverTarget)}
        title="Veículo entregue"
        message={`Confirmar que o veículo #${deliverTarget?.code ?? ''} foi entregue na empresa?`}
        confirmLabel="Confirmar"
        danger={false}
        loading={savingId === deliverTarget?.id}
        onConfirm={handleConfirmDeliver}
        onCancel={() => setDeliverTarget(null)}
      />

      {inspectionTarget && (
        <InspectionCaptureModal
          session={session}
          company={company}
          sale={inspectionTarget}
          onClose={() => setInspectionTarget(null)}
          onCompleted={handleInspectionCompleted}
        />
      )}

      {actionError && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-[var(--red-500)] px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg">
          {actionError}
        </div>
      )}
    </div>
  )
}
