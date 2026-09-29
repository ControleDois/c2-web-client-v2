import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type TouchEvent as ReactTouchEvent } from 'react'
import {
  fetchSupportVisits,
  fetchSupportVisit,
  createSupportVisit,
  VISIT_TYPE_LABELS,
  VISIT_STATUS_LABELS,
  type SupportVisitRecord,
  type CreateVisitPhoto,
} from '../lib/supportVisits'
import { fetchSupportContracts, type SupportContractRecord } from '../lib/supportContracts'
import { fetchPeople, type PersonRecord } from '../lib/people'
import { ApiError } from '../lib/api'
import { formatDateTime } from '../lib/format'
import { SearchSelectField } from '../components/form/SearchSelectField'
import { SelectField } from '../components/form/SelectField'
import { Select } from '../components/form/Select'
import { useMyCompanyPerson } from '../hooks/useMyCompanyPerson'
import {
  PlusIcon,
  SearchIcon,
  CameraIcon,
  PaperclipIcon,
  CheckCircleIcon,
  CloseIcon,
  TrashIcon,
  ChevronLeftIcon,
  ClipboardCheckIcon,
  EyeIcon,
  UserIcon,
} from '../components/icons'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface SupportVisitsPageProps {
  session: AuthSession
  company: AuthCompany
}

interface PhotoSlot {
  id: string
  label: string
  file: File | null
  previewUrl: string | null
  observation: string
}

function dataURLtoFile(dataUrl: string, filename: string): File {
  const [meta, base64] = dataUrl.split(',')
  const mime = meta.match(/:(.*?);/)?.[1] ?? 'image/png'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new File([bytes], filename, { type: mime })
}

function statusTone(status: number) {
  return status === 1 ? 'bg-[var(--green-100)] text-[var(--green-600)]' : 'bg-[var(--blue-100)] text-[var(--blue-700)]'
}

function NewVisitForm({
  session,
  company,
  onBack,
  onSaved,
}: {
  session: AuthSession
  company: AuthCompany
  onBack: () => void
  onSaved: () => void
}) {
  const myCompanyPerson = useMyCompanyPerson(session, company)

  const [person, setPerson] = useState<PersonRecord | null>(null)
  const [visitType, setVisitType] = useState(0)
  const [contracts, setContracts] = useState<SupportContractRecord[]>([])
  const [contractId, setContractId] = useState('')
  const [description, setDescription] = useState('')
  const [slots, setSlots] = useState<PhotoSlot[]>([])
  const [signerName, setSignerName] = useState('')
  const [hasSignature, setHasSignature] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const signatureCanvasRef = useRef<HTMLCanvasElement>(null)
  const drawingRef = useRef(false)

  useEffect(() => {
    if (!person) {
      setContracts([])
      setContractId('')
      return
    }
    fetchSupportContracts(session.token.token, company.id, { peopleId: person.id, status: 0, limit: 20 })
      .then((res) => setContracts(res.data))
      .catch(() => setContracts([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [person])

  function getContext() {
    const canvas = signatureCanvasRef.current
    const ctx = canvas?.getContext('2d')
    if (!ctx) return null
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#111827'
    return ctx
  }

  function getPoint(event: ReactMouseEvent | ReactTouchEvent) {
    const canvas = signatureCanvasRef.current
    if (!canvas) return { x: 0, y: 0 }
    const rect = canvas.getBoundingClientRect()
    const touch = 'touches' in event ? event.touches[0] ?? event.changedTouches[0] : null
    const clientX = touch ? touch.clientX : (event as ReactMouseEvent).clientX
    const clientY = touch ? touch.clientY : (event as ReactMouseEvent).clientY
    return {
      x: (clientX - rect.left) * (canvas.width / rect.width),
      y: (clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  function startSignature(event: ReactMouseEvent | ReactTouchEvent) {
    event.preventDefault()
    drawingRef.current = true
    const { x, y } = getPoint(event)
    const ctx = getContext()
    if (!ctx) return
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function drawSignatureLine(event: ReactMouseEvent | ReactTouchEvent) {
    if (!drawingRef.current) return
    event.preventDefault()
    const { x, y } = getPoint(event)
    const ctx = getContext()
    if (!ctx) return
    ctx.lineTo(x, y)
    ctx.stroke()
    setHasSignature(true)
  }

  function endSignature() {
    drawingRef.current = false
  }

  function clearSignature() {
    const canvas = signatureCanvasRef.current
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    setHasSignature(false)
  }

  function updateSlotFile(index: number, file: File | null) {
    setSlots((prev) =>
      prev.map((slot, i) => {
        if (i !== index) return slot
        if (slot.previewUrl) URL.revokeObjectURL(slot.previewUrl)
        return { ...slot, file, previewUrl: file ? URL.createObjectURL(file) : null }
      })
    )
  }

  function updateSlotObservation(index: number, observation: string) {
    setSlots((prev) => prev.map((slot, i) => (i === index ? { ...slot, observation } : slot)))
  }

  function updateSlotLabel(index: number, label: string) {
    setSlots((prev) => prev.map((slot, i) => (i === index ? { ...slot, label } : slot)))
  }

  function addSlot() {
    setSlots((prev) => [
      ...prev,
      { id: `foto_${Date.now()}`, label: `Foto ${prev.length + 1}`, file: null, previewUrl: null, observation: '' },
    ])
  }

  function removeSlot(index: number) {
    setSlots((prev) => {
      const slot = prev[index]
      if (slot?.previewUrl) URL.revokeObjectURL(slot.previewUrl)
      return prev.filter((_, i) => i !== index)
    })
  }

  async function handleSubmit() {
    if (!person || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const photos: CreateVisitPhoto[] = slots
        .filter((slot) => slot.file)
        .map((slot) => ({ file: slot.file as File, label: slot.label, observation: slot.observation }))

      const signature =
        hasSignature && signatureCanvasRef.current
          ? dataURLtoFile(signatureCanvasRef.current.toDataURL('image/png'), `assinatura_${Date.now()}.png`)
          : undefined

      await createSupportVisit(session.token.token, {
        company_id: company.id,
        people_id: person.id,
        user_id: myCompanyPerson?.id,
        support_contract_id: contractId || undefined,
        visit_type: visitType,
        description: description.trim() || undefined,
        photos,
        customer_signature: signature,
        customer_signer_name: signerName || undefined,
      })
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível registrar a visita.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--surface)]">
      <div className="flex flex-none items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3.5 pt-[max(0.875rem,env(safe-area-inset-top))] sm:px-6">
        <div className="flex min-w-0 items-center gap-2.5">
          <button
            type="button"
            onClick={onBack}
            disabled={submitting}
            className="flex flex-none items-center gap-1 rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)] disabled:opacity-60"
          >
            <ChevronLeftIcon className="h-4.5 w-4.5" />
          </button>
          <div className="min-w-0">
            <h2 className="truncate text-[14px] font-bold text-[var(--ink)] sm:text-[15px]">Nova visita técnica</h2>
            <p className="truncate text-[11px] text-[var(--muted)] sm:text-[12px]">Fotos + assinatura do cliente</p>
          </div>
        </div>
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="flex-none rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)] disabled:opacity-60"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="mx-auto flex w-full min-h-0 max-w-[900px] flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <SearchSelectField
              label="Cliente"
              placeholder="Buscar por nome…"
              selectedLabel={person?.name ?? null}
              selectedSubLabel={person?.document ?? undefined}
              onSearch={(query) =>
                fetchPeople(session.token.token, company.id, { search: query, role: 2, limit: 8 }).then(
                  (res) => res.data
                )
              }
              getOptionLabel={(item: PersonRecord) => item.name}
              getOptionSubLabel={(item: PersonRecord) => item.document ?? undefined}
              onSelect={(item: PersonRecord) => setPerson(item)}
              onClear={() => setPerson(null)}
            />
          </div>

          <SelectField label="Tipo de visita" value={visitType} onChange={(event) => setVisitType(Number(event.target.value))}>
            {Object.entries(VISIT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </SelectField>

          <SelectField
            label="Contrato de suporte (opcional)"
            value={contractId}
            onChange={(event) => setContractId(event.target.value)}
            disabled={!person || contracts.length === 0}
          >
            <option value="">Visita avulsa, sem contrato</option>
            {contracts.map((contract) => (
              <option key={contract.id} value={contract.id}>
                {contract.title}
              </option>
            ))}
          </SelectField>
        </div>

        <label className="mt-4 flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-[var(--ink-soft)]">O que foi feito</span>
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={3}
            placeholder="Descreva o atendimento ou o equipamento recolhido…"
            className="w-full resize-none rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
          />
        </label>

        <div className="mt-6 flex items-center justify-between">
          <p className="text-[13px] text-[var(--muted)]">Fotos do que foi feito ou do equipamento recolhido.</p>
        </div>

        {slots.length === 0 ? (
          <p className="mt-3 rounded-xl border border-dashed border-[var(--border)] bg-[var(--page)] px-4 py-6 text-center text-[12.5px] text-[var(--muted)]">
            Nenhuma foto adicionada ainda.
          </p>
        ) : (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {slots.map((slot, index) => (
              <div key={slot.id} className="rounded-xl border border-[var(--border)] p-3">
                <div className="flex items-center justify-between gap-2">
                  <input
                    type="text"
                    value={slot.label}
                    onChange={(event) => updateSlotLabel(index, event.target.value)}
                    className="min-w-0 flex-1 bg-transparent text-[12.5px] font-semibold text-[var(--ink)] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => removeSlot(index)}
                    className="rounded-lg p-1 text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--red-500)]"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </div>

                {slot.previewUrl ? (
                  <img src={slot.previewUrl} alt={slot.label} className="mt-2 h-28 w-full rounded-lg object-cover" />
                ) : (
                  <div className="mt-2 flex h-28 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border)] bg-[var(--page)] p-2">
                    <label className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[var(--blue-500)] px-3 py-2 text-[11.5px] font-semibold text-white hover:bg-[var(--blue-700)]">
                      <CameraIcon className="h-3.5 w-3.5" />
                      Tirar foto
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={(event) => updateSlotFile(index, event.target.files?.[0] ?? null)}
                      />
                    </label>
                    <label className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[var(--surface)] px-3 py-2 text-[11.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]">
                      <PaperclipIcon className="h-3.5 w-3.5" />
                      Anexar arquivo
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => updateSlotFile(index, event.target.files?.[0] ?? null)}
                      />
                    </label>
                  </div>
                )}

                <textarea
                  value={slot.observation}
                  onChange={(event) => updateSlotObservation(index, event.target.value)}
                  rows={2}
                  placeholder="Observação (opcional)"
                  className="mt-2 w-full resize-none rounded-lg bg-[var(--page)] px-3 py-2 text-[12.5px] text-[var(--ink)] ring-1 ring-transparent placeholder:text-[var(--muted)] focus:outline-none focus:ring-[var(--blue-300)]"
                />
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={addSlot}
          className="mt-4 w-fit rounded-xl border border-dashed border-[var(--border)] px-4 py-2 text-[12.5px] font-semibold text-[var(--ink-soft)] hover:border-[var(--blue-500)] hover:text-[var(--blue-700)]"
        >
          + Adicionar foto
        </button>

        <div className="mt-8 border-t border-[var(--border)] pt-6">
          <h3 className="text-[14px] font-bold text-[var(--ink)]">Assinatura do cliente</h3>
          <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">
            Colete a assinatura do cliente ou responsável confirmando o atendimento.
          </p>

          <input
            type="text"
            value={signerName}
            onChange={(event) => setSignerName(event.target.value)}
            placeholder="Nome de quem está assinando"
            className="mt-4 mb-2 w-full max-w-md rounded-lg bg-[var(--page)] px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] ring-1 ring-transparent placeholder:text-[var(--muted)] focus:outline-none focus:ring-[var(--blue-300)]"
          />
          <div className="relative max-w-md overflow-hidden rounded-lg border-2 border-dashed border-[var(--border)] bg-white">
            <canvas
              ref={signatureCanvasRef}
              width={600}
              height={220}
              className="h-40 w-full touch-none"
              onMouseDown={startSignature}
              onMouseMove={drawSignatureLine}
              onMouseUp={endSignature}
              onMouseLeave={endSignature}
              onTouchStart={startSignature}
              onTouchMove={drawSignatureLine}
              onTouchEnd={endSignature}
            />
            {!hasSignature && (
              <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-[12.5px] font-medium text-[var(--muted)]">
                Assine aqui
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={clearSignature}
            className="mt-2 text-[11.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
          >
            Limpar assinatura
          </button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-[var(--red-100)] p-3 text-[13px] font-medium text-[var(--red-500)]">
            {error}
          </div>
        )}
      </div>

      <div className="mx-auto flex w-full max-w-[900px] flex-none items-center justify-end gap-2.5 border-t border-[var(--border)] px-4 py-3.5 pb-[max(0.875rem,env(safe-area-inset-bottom))] sm:gap-3 sm:px-6">
        <button
          type="button"
          onClick={onBack}
          disabled={submitting}
          className="rounded-xl px-3.5 py-2.5 text-[13px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-60 sm:px-4 sm:text-[13.5px]"
        >
          Cancelar
        </button>
        <button
          type="button"
          onClick={handleSubmit}
          disabled={!person || submitting}
          className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60 sm:flex-none sm:text-[13.5px]"
        >
          <CheckCircleIcon className="h-4 w-4" />
          {submitting ? 'Salvando…' : 'Salvar visita'}
        </button>
      </div>
    </div>
  )
}

export function SupportVisitsPage({ session, company }: SupportVisitsPageProps) {
  const token = session.token.token
  const [search, setSearch] = useState('')
  const [visitType, setVisitType] = useState('')
  const [visits, setVisits] = useState<SupportVisitRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showForm, setShowForm] = useState(false)
  const [detailItem, setDetailItem] = useState<SupportVisitRecord | null>(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  function load() {
    setLoading(true)
    setError(null)
    fetchSupportVisits(token, company.id, {
      search: search || undefined,
      visitType: visitType === '' ? undefined : Number(visitType),
      limit: 30,
    })
      .then((res) => setVisits(res.data))
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as visitas.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [token, company.id, search, visitType])

  function openDetail(item: SupportVisitRecord) {
    setDetailItem(item)
    setLoadingDetail(true)
    fetchSupportVisit(token, item.id)
      .then((full) => setDetailItem(full))
      .catch(() => {})
      .finally(() => setLoadingDetail(false))
  }

  const photos = detailItem?.photos ?? []

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-[20px] font-bold text-[var(--ink)]">Visitas Técnicas</h1>
          <p className="mt-1 text-[13px] text-[var(--muted)]">
            Coleta de equipamento e atendimentos no local, com fotos e assinatura do cliente.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-[var(--blue-700)]"
        >
          <PlusIcon className="h-4 w-4" />
          Nova Visita
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
          <SearchIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
          <input
            type="text"
            placeholder="Buscar por cliente…"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full bg-transparent text-[13.5px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
          />
        </div>
        <div className="w-full sm:w-56">
          <Select value={visitType} onChange={setVisitType}>
            <option value="">Todos os tipos</option>
            {Object.entries(VISIT_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {error && (
        <p className="rounded-xl bg-[var(--red-100)] px-3.5 py-2.5 text-[13px] font-medium text-[var(--red-500)]">
          {error}
        </p>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-16 animate-pulse rounded-2xl bg-[var(--surface)]" />
          ))}
        </div>
      ) : visits.length === 0 ? (
        <p className="py-10 text-center text-[13px] text-[var(--muted)]">Nenhuma visita técnica registrada.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {visits.map((visit) => (
            <button
              key={visit.id}
              type="button"
              onClick={() => openDetail(visit)}
              className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 text-left transition hover:bg-[var(--blue-100)]/30"
            >
              <div className="flex min-w-0 items-start gap-3">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[var(--blue-100)] text-[var(--blue-700)]">
                  <UserIcon className="h-4.5 w-4.5" />
                </span>
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-bold text-[var(--ink)]">{visit.people?.name ?? '—'}</p>
                  <p className="truncate text-[12px] text-[var(--muted)]">
                    {VISIT_TYPE_LABELS[visit.visit_type] ?? '—'} · {formatDateTime(visit.created_at)}
                  </p>
                </div>
              </div>
              <div className="flex flex-none items-center gap-2">
                <span className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold ${statusTone(visit.status)}`}>
                  {VISIT_STATUS_LABELS[visit.status] ?? '—'}
                </span>
                <EyeIcon className="h-4 w-4 text-[var(--muted)]" />
              </div>
            </button>
          ))}
        </div>
      )}

      {showForm && (
        <NewVisitForm
          session={session}
          company={company}
          onBack={() => setShowForm(false)}
          onSaved={() => {
            setShowForm(false)
            load()
          }}
        />
      )}

      {detailItem && (
        <div className="fixed inset-0 z-50 flex flex-col bg-[var(--surface)]">
          <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
            <div className="flex items-center gap-3">
              <span className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--blue-100)] text-[var(--blue-700)]">
                <ClipboardCheckIcon className="h-4.5 w-4.5" />
              </span>
              <div>
                <h2 className="text-[15px] font-bold text-[var(--ink)]">
                  Visita {detailItem.code ? `#${detailItem.code}` : ''}
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

          <div className="mx-auto flex w-full min-h-0 max-w-[900px] flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-6">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">Cliente</p>
                <p className="mt-0.5 text-[13.5px] font-medium text-[var(--ink)]">{detailItem.people?.name || '—'}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">Tipo</p>
                <p className="mt-0.5 text-[13.5px] font-medium text-[var(--ink)]">
                  {VISIT_TYPE_LABELS[detailItem.visit_type] ?? '—'}
                </p>
              </div>
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">Responsável</p>
                <p className="mt-0.5 text-[13.5px] font-medium text-[var(--ink)]">{detailItem.user?.name || '—'}</p>
              </div>
              <div>
                <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">Status</p>
                <span className={`mt-1 inline-block rounded-full px-2.5 py-1 text-[11px] font-bold ${statusTone(detailItem.status)}`}>
                  {VISIT_STATUS_LABELS[detailItem.status] ?? '—'}
                </span>
              </div>
            </div>

            {detailItem.description && (
              <div className="mt-6">
                <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">O que foi feito</p>
                <p className="mt-1 whitespace-pre-line text-[13.5px] text-[var(--ink)]">{detailItem.description}</p>
              </div>
            )}

            <div className="mt-6">
              <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                Fotos ({loadingDetail ? '…' : photos.length})
              </p>
              {photos.length > 0 ? (
                <div className="mt-2 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {photos.map((photo) => (
                    <div key={photo.id} className="overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--page)]">
                      <img src={photo.file_url} alt={photo.name || ''} className="h-32 w-full object-cover" />
                      {photo.name && (
                        <p className="truncate px-2 py-1.5 text-[11.5px] font-medium text-[var(--ink-soft)]">{photo.name}</p>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                !loadingDetail && <p className="mt-2 text-[13px] text-[var(--muted)]">Nenhuma foto registrada.</p>
              )}
            </div>

            {detailItem.customer_signature_url && (
              <div className="mt-6">
                <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                  Assinatura {detailItem.customer_signer_name ? `de ${detailItem.customer_signer_name}` : 'do cliente'}
                </p>
                <img
                  src={detailItem.customer_signature_url}
                  alt="Assinatura do cliente"
                  className="mt-1 h-16 rounded-lg border border-[var(--border)] bg-white object-contain p-1"
                />
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
