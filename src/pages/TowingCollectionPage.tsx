import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type TouchEvent as ReactTouchEvent } from 'react'
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
import { fetchConfig } from '../lib/config'
import { ApiError } from '../lib/api'
import { formatCurrency, formatDateTime } from '../lib/format'
import { formatPhone } from '../lib/formatPhone'
import { SearchIcon, RouteIcon, CameraIcon, PaperclipIcon, AlertTriangleIcon, CheckCircleIcon, CloseIcon, TrashIcon } from '../components/icons'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useMyCompanyPerson } from '../hooks/useMyCompanyPerson'
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

type SignatureTarget = 'customer' | 'driver'

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
  detailedRequired: boolean
  onClose: () => void
  onCompleted: (inspectionId: string) => void
}

function InspectionCaptureModal({ session, company, sale, detailedRequired, onClose, onCompleted }: InspectionModalProps) {
  const myCompanyPerson = useMyCompanyPerson(session, company)
  const [slots, setSlots] = useState<PhotoSlot[]>(() => (detailedRequired ? buildInitialSlots() : []))
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [cameraSlotIndex, setCameraSlotIndex] = useState<number | null>(null)
  const [videoStream, setVideoStream] = useState<MediaStream | null>(null)
  const [locationLines, setLocationLines] = useState<string[]>([])
  const [isLocating, setIsLocating] = useState(false)
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    if (videoRef.current && videoStream) {
      videoRef.current.srcObject = videoStream
    }
  }, [videoStream])

  useEffect(() => {
    return () => {
      videoStream?.getTracks().forEach((track) => track.stop())
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function dataURLtoFile(dataUrl: string, filename: string): File {
    const [meta, base64] = dataUrl.split(',')
    const mime = meta.match(/:(.*?);/)?.[1] ?? 'image/jpeg'
    const binary = atob(base64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
    return new File([bytes], filename, { type: mime })
  }

  const customerSignatureCanvasRef = useRef<HTMLCanvasElement>(null)
  const driverSignatureCanvasRef = useRef<HTMLCanvasElement>(null)
  const drawingSignatureRef = useRef<SignatureTarget | null>(null)
  const [customerSignerName, setCustomerSignerName] = useState('')
  const [driverSignerName, setDriverSignerName] = useState('')
  const [hasCustomerSignature, setHasCustomerSignature] = useState(false)
  const [hasDriverSignature, setHasDriverSignature] = useState(false)

  function getSignatureCanvas(target: SignatureTarget) {
    return target === 'driver' ? driverSignatureCanvasRef.current : customerSignatureCanvasRef.current
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
    if (target === 'driver') setHasDriverSignature(true)
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
    if (target === 'driver') setHasDriverSignature(false)
    else setHasCustomerSignature(false)
  }

  async function fetchAddressFromCoords(lat: number, lng: number) {
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`
      )
      const data = await response.json()

      if (data?.address) {
        const addr = data.address
        const dateStr = new Intl.DateTimeFormat('pt-BR', {
          day: 'numeric',
          month: 'short',
          year: 'numeric',
          hour: '2-digit',
          minute: '2-digit',
          second: '2-digit',
        }).format(new Date())

        setLocationLines(
          [
            dateStr,
            `${addr.road || ''}, ${addr.house_number || 'S/N'}`,
            addr.suburb || addr.neighbourhood || '',
            `${addr.city || addr.town || addr.village || ''} ${addr.state || ''}`,
            addr.postcode || '',
            addr.country || 'Brasil',
          ].filter((line) => line && line.trim() !== '' && line !== ', S/N')
        )
      } else {
        setLocationLines(['Endereço não encontrado para as coordenadas.'])
      }
    } catch {
      setLocationLines([`Lat: ${lat.toFixed(5)}, Lng: ${lng.toFixed(5)}`])
    } finally {
      setIsLocating(false)
    }
  }

  async function openCamera(index: number) {
    setCameraSlotIndex(index)
    setLocationLines(['Aguardando GPS...'])
    setIsLocating(true)

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1920 }, height: { ideal: 1080 } },
        audio: false,
      })
      setVideoStream(stream)
    } catch {
      setError('Não foi possível acessar a câmera. Verifique as permissões.')
      closeCamera()
      return
    }

    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          fetchAddressFromCoords(position.coords.latitude, position.coords.longitude)
        },
        () => {
          setLocationLines(['Localização não permitida ou falhou.'])
          setIsLocating(false)
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
      )
    } else {
      setLocationLines(['GPS não suportado pelo navegador.'])
      setIsLocating(false)
    }
  }

  function closeCamera() {
    videoStream?.getTracks().forEach((track) => track.stop())
    setVideoStream(null)
    setCameraSlotIndex(null)
  }

  function capturePhoto() {
    if (cameraSlotIndex === null || !videoRef.current || !canvasRef.current) return

    const video = videoRef.current
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)

    const fontSize = Math.max(Math.floor(canvas.height * 0.03), 24)
    ctx.font = `${fontSize}px sans-serif`
    ctx.fillStyle = 'white'
    ctx.textAlign = 'right'
    ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
    ctx.shadowBlur = 6
    ctx.shadowOffsetX = 2
    ctx.shadowOffsetY = 2

    let yPosition = fontSize + 20
    const xPosition = canvas.width - 20
    locationLines.forEach((line) => {
      ctx.fillText(line, xPosition, yPosition)
      yPosition += fontSize * 1.3
    })

    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    const file = dataURLtoFile(dataUrl, `${slots[cameraSlotIndex].id}_${Date.now()}.jpg`)
    updateSlotFile(cameraSlotIndex, file)
    closeCamera()
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

  function addExtraSlot() {
    setSlots((prev) => [
      ...prev,
      {
        id: `detalhe_${Date.now()}`,
        label: `Foto de detalhe ${prev.filter((s) => !s.required).length + 1}`,
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

  const missingRequired = detailedRequired
    ? slots.some((slot) => slot.required && !slot.file)
    : !slots.some((slot) => slot.file)

  async function handleSubmit() {
    if (missingRequired || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const photos = slots
        .filter((slot) => slot.file)
        .map((slot) => ({ file: slot.file as File, label: slot.label, observation: slot.observation }))

      const customerSignature =
        hasCustomerSignature && customerSignatureCanvasRef.current
          ? dataURLtoFile(customerSignatureCanvasRef.current.toDataURL('image/png'), `assinatura_cliente_${Date.now()}.png`)
          : undefined
      const driverSignature =
        hasDriverSignature && driverSignatureCanvasRef.current
          ? dataURLtoFile(driverSignatureCanvasRef.current.toDataURL('image/png'), `assinatura_motorista_${Date.now()}.png`)
          : undefined

      const result = await createVehicleInspection(session.token.token, {
        company_id: company.id,
        vehicle_id: sale.vehicle_id || sale.vehicle?.id || '',
        people_id: sale.people_id,
        user_id: myCompanyPerson?.id,
        towing_sale_id: sale.id,
        photos,
        customer_signature: customerSignature,
        customer_signer_name: customerSignerName || undefined,
        driver_signature: driverSignature,
        driver_signer_name: driverSignerName || undefined,
      })
      onCompleted(result.data.id)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível registrar a vistoria.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--surface)]">
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
          <CloseIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="mx-auto flex w-full max-w-[900px] flex-1 flex-col overflow-y-auto px-6 py-6">
        <p className="text-[13px] text-[var(--muted)]">
          {detailedRequired
            ? 'Registre as fotos obrigatórias do veículo antes de marcar a coleta. Você pode adicionar fotos extras para avarias ou detalhes específicos.'
            : 'Adicione as fotos de detalhe do veículo antes de marcar a coleta.'}
        </p>

        {slots.length === 0 ? (
          <p className="mt-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--page)] px-4 py-6 text-center text-[12.5px] text-[var(--muted)]">
            Nenhuma foto adicionada ainda.
          </p>
        ) : (
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
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
                  <div className="mt-2 flex h-28 w-full flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-[var(--border)] bg-[var(--page)] p-2">
                    <button
                      type="button"
                      onClick={() => openCamera(index)}
                      className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-[var(--blue-500)] px-3 py-2 text-[11.5px] font-semibold text-white hover:bg-[var(--blue-700)]"
                    >
                      <CameraIcon className="h-3.5 w-3.5" />
                      Tirar foto
                    </button>
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
                {slot.previewUrl && (
                  <div className="mt-2 flex items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => openCamera(index)}
                      className="text-[11.5px] font-semibold text-[var(--blue-700)] hover:underline"
                    >
                      Tirar foto
                    </button>
                    <label className="cursor-pointer text-[11.5px] font-semibold text-[var(--blue-700)] hover:underline">
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
                  placeholder="Adicionar observação (ex: trincado, arranhado...)"
                  className="mt-2 w-full resize-none rounded-lg bg-[var(--page)] px-3 py-2 text-[12.5px] text-[var(--ink)] ring-1 ring-transparent placeholder:text-[var(--muted)] focus:outline-none focus:ring-[var(--blue-300)]"
                />
              </div>
            ))}
          </div>
        )}

        <button
          type="button"
          onClick={addExtraSlot}
          className="mt-4 w-fit rounded-xl border border-dashed border-[var(--border)] px-4 py-2 text-[12.5px] font-semibold text-[var(--ink-soft)] hover:border-[var(--blue-500)] hover:text-[var(--blue-700)]"
        >
          {detailedRequired ? '+ Adicionar foto extra' : '+ Adicionar foto de detalhe'}
        </button>

        <div className="mt-8 border-t border-[var(--border)] pt-6">
          <h3 className="text-[14px] font-bold text-[var(--ink)]">Assinaturas</h3>
          <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">
            Colete a assinatura do cliente e do motorista para confirmar a retirada.
          </p>

          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                Assinatura do cliente
              </p>
              <input
                type="text"
                value={customerSignerName}
                onChange={(event) => setCustomerSignerName(event.target.value)}
                placeholder="Nome completo do cliente"
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

            <div>
              <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                Assinatura do motorista
              </p>
              <input
                type="text"
                value={driverSignerName}
                onChange={(event) => setDriverSignerName(event.target.value)}
                placeholder="Nome completo do motorista"
                className="mb-2 w-full rounded-lg bg-[var(--page)] px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] ring-1 ring-transparent placeholder:text-[var(--muted)] focus:outline-none focus:ring-[var(--blue-300)]"
              />
              <div className="relative overflow-hidden rounded-lg border-2 border-dashed border-[var(--border)] bg-white">
                <canvas
                  ref={driverSignatureCanvasRef}
                  width={600}
                  height={220}
                  className="h-40 w-full touch-none"
                  onMouseDown={(event) => startSignature(event, 'driver')}
                  onMouseMove={(event) => drawSignature(event, 'driver')}
                  onMouseUp={() => endSignature('driver')}
                  onMouseLeave={() => endSignature('driver')}
                  onTouchStart={(event) => startSignature(event, 'driver')}
                  onTouchMove={(event) => drawSignature(event, 'driver')}
                  onTouchEnd={() => endSignature('driver')}
                />
                {!hasDriverSignature && (
                  <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-[12.5px] font-medium text-[var(--muted)]">
                    Assine aqui
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={() => clearSignature('driver')}
                className="mt-2 text-[11.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
              >
                Limpar assinatura
              </button>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 rounded-xl bg-[var(--red-100)] p-3 text-[13px] font-medium text-[var(--red-500)]">
            {error}
          </div>
        )}
      </div>

      <div className="mx-auto flex w-full max-w-[900px] items-center justify-end gap-3 border-t border-[var(--border)] px-6 py-4">
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

    {cameraSlotIndex !== null && (
      <div className="fixed inset-0 z-[100] flex flex-col justify-between bg-black">
        <video ref={videoRef} autoPlay playsInline muted className="absolute inset-0 h-full w-full object-cover" />

        <div className="relative z-10 flex items-start justify-between bg-gradient-to-b from-black/80 to-transparent p-3 md:p-4">
          <button
            type="button"
            onClick={closeCamera}
            className="rounded-full bg-black/50 p-2 text-white transition-colors hover:bg-white/20"
          >
            <CloseIcon className="h-6 w-6" />
          </button>

          <div className="text-right text-white drop-shadow-md">
            {isLocating && (
              <div className="mb-1 flex items-center justify-end gap-2 text-[13px] text-yellow-400">
                <span className="h-3 w-3 animate-spin rounded-full border-2 border-yellow-400 border-t-transparent" />
                Buscando GPS...
              </div>
            )}
            {locationLines.map((line, index) => (
              <p key={index} className="text-[11px] font-medium leading-tight opacity-90 md:text-[13px]">
                {line}
              </p>
            ))}
          </div>
        </div>

        <div className="relative z-10 flex min-h-0 flex-1 items-center justify-center p-4 md:p-4">
          <div className="flex aspect-[4/3] w-full max-w-lg items-center justify-center rounded-2xl border border-white/30 md:rounded-3xl">
            <div className="px-4 text-center text-[13px] font-bold tracking-widest text-white/50 uppercase md:text-[15px]">
              {slots[cameraSlotIndex]?.label}
            </div>
          </div>
        </div>

        <div className="relative z-10 flex items-center justify-center bg-gradient-to-t from-black/90 to-transparent py-6 md:py-8">
          <button
            type="button"
            onClick={capturePhoto}
            disabled={isLocating}
            className={`flex h-16 w-16 items-center justify-center rounded-full border-4 border-slate-300 bg-white shadow-2xl transition-all md:h-20 md:w-20 ${
              isLocating ? 'scale-90 cursor-not-allowed opacity-50' : 'hover:scale-105 active:scale-95'
            }`}
          >
            <div className="h-12 w-12 rounded-full border border-slate-200 md:h-16 md:w-16" />
          </button>
        </div>
      </div>
    )}

    <canvas ref={canvasRef} className="hidden" />
    </>
  )
}

export function TowingCollectionPage({ session, company }: TowingCollectionPageProps) {
  const myCompanyPerson = useMyCompanyPerson(session, company)
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
  const [detailedInspectionRequired, setDetailedInspectionRequired] = useState(false)

  useEffect(() => {
    let cancelled = false
    fetchConfig(session.token.token, company.id)
      .then((config) => {
        if (!cancelled) setDetailedInspectionRequired(Boolean(config.vehicle_inspection_detailed_required))
      })
      .catch(() => {
        if (!cancelled) setDetailedInspectionRequired(false)
      })
    return () => {
      cancelled = true
    }
  }, [session.token.token, company.id])

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
        userId: myCompanyPerson?.id,
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
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
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
          detailedRequired={detailedInspectionRequired}
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
