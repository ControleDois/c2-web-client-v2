import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type TouchEvent as ReactTouchEvent } from 'react'
import { createSupportVisit, VISIT_TYPE_LABELS, type CreateVisitPhoto } from '../lib/supportVisits'
import { fetchSupportContracts, type SupportContractRecord } from '../lib/supportContracts'
import { fetchPeople, type PersonRecord } from '../lib/people'
import { ApiError } from '../lib/api'
import { SearchSelectField } from '../components/form/SearchSelectField'
import { SelectField } from '../components/form/SelectField'
import { useMyCompanyPerson } from '../hooks/useMyCompanyPerson'
import { CameraIcon, PaperclipIcon, ChevronLeftIcon, TrashIcon, PlusIcon } from '../components/icons'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface SupportVisitFormPageProps {
  session: AuthSession
  company: AuthCompany
  onBack: () => void
  onSaved: () => void
}

interface PhotoSlot {
  id: string
  label: string
  file: File | null
  previewUrl: string | null
  observation: string
}

type SignatureTarget = 'customer' | 'technician'

function dataURLtoFile(dataUrl: string, filename: string): File {
  const [meta, base64] = dataUrl.split(',')
  const mime = meta.match(/:(.*?);/)?.[1] ?? 'image/png'
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
  return new File([bytes], filename, { type: mime })
}

// Carimba data/hora no canto da foto tirada pela câmera - a mesma ideia da
// vistoria de veículo (que carimba data + GPS), só que sem geolocalização
// aqui (a visita de suporte não pede localização, só o "quando").
function stampPhotoTimestamp(file: File): Promise<File> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')

      if (!ctx) {
        resolve(file)
        return
      }

      ctx.drawImage(img, 0, 0)

      const timestamp = new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit',
      }).format(new Date())

      const fontSize = Math.max(Math.floor(canvas.height * 0.028), 22)
      ctx.font = `${fontSize}px sans-serif`
      ctx.fillStyle = 'white'
      ctx.textAlign = 'right'
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
      ctx.shadowBlur = 6
      ctx.shadowOffsetX = 2
      ctx.shadowOffsetY = 2
      ctx.fillText(timestamp, canvas.width - 20, canvas.height - 20)

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve(file)
            return
          }
          resolve(new File([blob], file.name, { type: 'image/jpeg' }))
        },
        'image/jpeg',
        0.9
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(file)
    }

    img.src = objectUrl
  })
}

export function SupportVisitFormPage({ session, company, onBack, onSaved }: SupportVisitFormPageProps) {
  const myCompanyPerson = useMyCompanyPerson(session, company)

  const [person, setPerson] = useState<PersonRecord | null>(null)
  const [visitType, setVisitType] = useState(0)
  const [contracts, setContracts] = useState<SupportContractRecord[]>([])
  const [contractId, setContractId] = useState('')
  const [description, setDescription] = useState('')
  const [slots, setSlots] = useState<PhotoSlot[]>([])
  const photoCounterRef = useRef(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const customerSignatureCanvasRef = useRef<HTMLCanvasElement>(null)
  const technicianSignatureCanvasRef = useRef<HTMLCanvasElement>(null)
  const drawingSignatureRef = useRef<SignatureTarget | null>(null)
  const [customerSignerName, setCustomerSignerName] = useState('')
  const [technicianSignerName, setTechnicianSignerName] = useState('')
  const [hasCustomerSignature, setHasCustomerSignature] = useState(false)
  const [hasTechnicianSignature, setHasTechnicianSignature] = useState(false)

  useEffect(() => {
    if (myCompanyPerson) setTechnicianSignerName((current) => current || myCompanyPerson.name)
  }, [myCompanyPerson])

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

  function getSignatureCanvas(target: SignatureTarget) {
    return target === 'technician' ? technicianSignatureCanvasRef.current : customerSignatureCanvasRef.current
  }

  function getSignatureContext(target: SignatureTarget) {
    const canvas = getSignatureCanvas(target)
    const ctx = canvas?.getContext('2d')
    if (!ctx) return null
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#111827'
    return ctx
  }

  function getSignaturePoint(event: ReactMouseEvent | ReactTouchEvent, target: SignatureTarget) {
    const canvas = getSignatureCanvas(target)
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

  function startSignature(event: ReactMouseEvent | ReactTouchEvent, target: SignatureTarget) {
    event.preventDefault()
    drawingSignatureRef.current = target
    const { x, y } = getSignaturePoint(event, target)
    const ctx = getSignatureContext(target)
    if (!ctx) return
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function drawSignature(event: ReactMouseEvent | ReactTouchEvent, target: SignatureTarget) {
    if (drawingSignatureRef.current !== target) return
    event.preventDefault()
    const { x, y } = getSignaturePoint(event, target)
    const ctx = getSignatureContext(target)
    if (!ctx) return
    ctx.lineTo(x, y)
    ctx.stroke()
    if (target === 'technician') setHasTechnicianSignature(true)
    else setHasCustomerSignature(true)
  }

  function endSignature(target: SignatureTarget) {
    if (drawingSignatureRef.current !== target) return
    drawingSignatureRef.current = null
  }

  function clearSignature(target: SignatureTarget) {
    const canvas = getSignatureCanvas(target)
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (target === 'technician') setHasTechnicianSignature(false)
    else setHasCustomerSignature(false)
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

  // Nova foto entra no topo da lista (não no fim) - quem está fazendo a
  // visita no celular quer tocar em "Adicionar foto" e já ter o slot novo
  // na mão, sem precisar rolar a tela até o final toda vez.
  function addSlot() {
    photoCounterRef.current += 1
    const label = `Foto ${photoCounterRef.current}`
    setSlots((prev) => [{ id: `foto_${Date.now()}`, label, file: null, previewUrl: null, observation: '' }, ...prev])
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

      const customerSignature =
        hasCustomerSignature && customerSignatureCanvasRef.current
          ? dataURLtoFile(customerSignatureCanvasRef.current.toDataURL('image/png'), `assinatura_cliente_${Date.now()}.png`)
          : undefined
      const technicianSignature =
        hasTechnicianSignature && technicianSignatureCanvasRef.current
          ? dataURLtoFile(technicianSignatureCanvasRef.current.toDataURL('image/png'), `assinatura_tecnico_${Date.now()}.png`)
          : undefined

      await createSupportVisit(session.token.token, {
        company_id: company.id,
        people_id: person.id,
        user_id: myCompanyPerson?.id,
        support_contract_id: contractId || undefined,
        visit_type: visitType,
        description: description.trim() || undefined,
        photos,
        customer_signature: customerSignature,
        customer_signer_name: customerSignerName || undefined,
        technician_signature: technicianSignature,
        technician_signer_name: technicianSignerName || undefined,
      })
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível registrar a visita.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="mb-3 flex items-center gap-1 text-[12.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
          Voltar para visitas técnicas
        </button>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Suporte Técnico</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Nova visita técnica</h1>
      </div>

      <div className="flex flex-col gap-6">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="mb-4 text-[14px] font-bold text-[var(--ink)]">Cliente e visita</h2>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <div className="sm:col-span-2 xl:col-span-1">
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
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <div className="mb-4 flex items-center justify-between">
            <div>
              <h2 className="text-[14px] font-bold text-[var(--ink)]">Fotos</h2>
              <p className="mt-0.5 text-[12px] text-[var(--muted)]">Fotos do que foi feito ou do equipamento recolhido.</p>
            </div>
            <button
              type="button"
              onClick={addSlot}
              className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-2 text-[12.5px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]"
            >
              <PlusIcon className="h-3.5 w-3.5" />
              Adicionar foto
            </button>
          </div>

          {slots.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-[var(--muted)]">Nenhuma foto adicionada ainda.</p>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {slots.map((slot, index) => (
                <div key={slot.id} className="rounded-xl bg-[var(--page)] p-3">
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
                      className="rounded-lg p-1 text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--red-500)]"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>

                  {slot.previewUrl ? (
                    <img src={slot.previewUrl} alt={slot.label} className="mt-2 h-28 w-full rounded-lg object-cover" />
                  ) : (
                    <div className="mt-2 flex h-28 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border)] bg-[var(--surface)] p-2">
                      <label className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[var(--blue-500)] px-3 py-2 text-[11.5px] font-semibold text-white hover:bg-[var(--blue-700)]">
                        <CameraIcon className="h-3.5 w-3.5" />
                        Tirar foto
                        <input
                          type="file"
                          accept="image/*"
                          capture="environment"
                          className="hidden"
                          onChange={async (event) => {
                            const file = event.target.files?.[0] ?? null
                            updateSlotFile(index, file ? await stampPhotoTimestamp(file) : null)
                          }}
                        />
                      </label>
                      <label className="flex w-full cursor-pointer items-center justify-center gap-1.5 rounded-lg bg-[var(--page)] px-3 py-2 text-[11.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]">
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
                    className="mt-2 w-full resize-none rounded-lg bg-[var(--surface)] px-3 py-2 text-[12.5px] text-[var(--ink)] ring-1 ring-transparent placeholder:text-[var(--muted)] focus:outline-none focus:ring-[var(--blue-300)]"
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
          <h2 className="text-[14px] font-bold text-[var(--ink)]">Assinaturas</h2>
          <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">
            Colete a assinatura do técnico que atendeu e do cliente ou responsável.
          </p>

          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                Assinatura do técnico
              </p>
              <input
                type="text"
                value={technicianSignerName}
                onChange={(event) => setTechnicianSignerName(event.target.value)}
                placeholder="Nome completo do técnico"
                className="mb-2 w-full rounded-lg bg-[var(--page)] px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] ring-1 ring-transparent placeholder:text-[var(--muted)] focus:outline-none focus:ring-[var(--blue-300)]"
              />
              <div className="relative overflow-hidden rounded-lg border-2 border-dashed border-[var(--border)] bg-white">
                <canvas
                  ref={technicianSignatureCanvasRef}
                  width={600}
                  height={220}
                  className="h-40 w-full touch-none"
                  onMouseDown={(event) => startSignature(event, 'technician')}
                  onMouseMove={(event) => drawSignature(event, 'technician')}
                  onMouseUp={() => endSignature('technician')}
                  onMouseLeave={() => endSignature('technician')}
                  onTouchStart={(event) => startSignature(event, 'technician')}
                  onTouchMove={(event) => drawSignature(event, 'technician')}
                  onTouchEnd={() => endSignature('technician')}
                />
                {!hasTechnicianSignature && (
                  <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-[12.5px] font-medium text-[var(--muted)]">
                    Assine aqui
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => clearSignature('technician')}
                className="mt-2 text-[11.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
              >
                Limpar assinatura
              </button>
            </div>

            <div>
              <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                Assinatura do cliente
              </p>
              <input
                type="text"
                value={customerSignerName}
                onChange={(event) => setCustomerSignerName(event.target.value)}
                placeholder="Nome de quem está assinando"
                className="mb-2 w-full rounded-lg bg-[var(--page)] px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] ring-1 ring-transparent placeholder:text-[var(--muted)] focus:outline-none focus:ring-[var(--blue-300)]"
              />
              <div className="relative overflow-hidden rounded-lg border-2 border-dashed border-[var(--border)] bg-white">
                <canvas
                  ref={customerSignatureCanvasRef}
                  width={600}
                  height={220}
                  className="h-40 w-full touch-none"
                  onMouseDown={(event) => startSignature(event, 'customer')}
                  onMouseMove={(event) => drawSignature(event, 'customer')}
                  onMouseUp={() => endSignature('customer')}
                  onMouseLeave={() => endSignature('customer')}
                  onTouchStart={(event) => startSignature(event, 'customer')}
                  onTouchMove={(event) => drawSignature(event, 'customer')}
                  onTouchEnd={() => endSignature('customer')}
                />
                {!hasCustomerSignature && (
                  <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-[12.5px] font-medium text-[var(--muted)]">
                    Assine aqui
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => clearSignature('customer')}
                className="mt-2 text-[11.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
              >
                Limpar assinatura
              </button>
            </div>
          </div>
        </div>

        {error && (
          <p className="rounded-xl bg-[var(--red-100)] px-4 py-3 text-[13.5px] font-medium text-[var(--red-500)]">
            {error}
          </p>
        )}

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleSubmit}
            disabled={!person || submitting}
            className="rounded-xl bg-[var(--blue-500)] px-6 py-2.5 text-[14px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
          >
            {submitting ? 'Salvando…' : 'Salvar visita'}
          </button>
          <button
            type="button"
            onClick={onBack}
            className="rounded-xl px-5 py-2.5 text-[14px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
          >
            Cancelar
          </button>
        </div>
      </div>
    </div>
  )
}
