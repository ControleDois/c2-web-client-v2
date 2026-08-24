import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type TouchEvent as ReactTouchEvent } from 'react'
import {
  fetchSales,
  updateVehicleRentalOperation,
  RENTAL_FREQUENCY_LABELS,
  VEHICLE_RENTAL_STATUS_LABELS,
  FUEL_LEVEL_OPTIONS,
  type SaleRecord,
} from '../lib/sales'
import { createVehicleInspection } from '../lib/vehicleInspections'
import { fetchConfig } from '../lib/config'
import { ApiError } from '../lib/api'
import { formatCurrency } from '../lib/format'
import { formatDocument } from '../lib/formatDocument'
import { SearchIcon, RouteIcon, CameraIcon, PaperclipIcon, CheckCircleIcon, CloseIcon, TrashIcon } from '../components/icons'
import { useMyCompanyPerson } from '../hooks/useMyCompanyPerson'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface VehicleRentalOperationsPageProps {
  session: AuthSession
  company: AuthCompany
}

type OperationMode = 'pickup' | 'return'

function vehicleLabel(sale: SaleRecord) {
  const vehicle = sale.vehicle
  if (!vehicle) return '—'
  return [vehicle.brand, vehicle.model, vehicle.license_plate].filter(Boolean).join(' · ') || '—'
}

function frequencyLabel(frequency?: string | null): string {
  if (!frequency) return '—'
  return RENTAL_FREQUENCY_LABELS[frequency] ?? frequency
}

function statusStyles(status: number) {
  if (status === 2) return 'bg-[var(--green-100)] text-[var(--green-600)]'
  if (status === 1) return 'bg-[var(--blue-100)] text-[var(--blue-700)]'
  return 'bg-[var(--amber-100)] text-[var(--amber-500)]'
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

interface OperationModalProps {
  session: AuthSession
  company: AuthCompany
  sale: SaleRecord
  mode: OperationMode
  detailedRequired: boolean
  onClose: () => void
  onCompleted: () => void
}

function RentalOperationModal({ session, company, sale, mode, detailedRequired, onClose, onCompleted }: OperationModalProps) {
  const myCompanyPerson = useMyCompanyPerson(session, company)
  const contract = sale.vehicleRentalContract!
  const isPickup = mode === 'pickup'

  const [odometer, setOdometer] = useState('')
  const [fuelLevel, setFuelLevel] = useState('')
  const [location, setLocation] = useState('')

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

        const line = [addr.road || '', addr.house_number || 'S/N'].join(', ')
        setLocationLines(
          [
            dateStr,
            line,
            addr.suburb || addr.neighbourhood || '',
            `${addr.city || addr.town || addr.village || ''} ${addr.state || ''}`,
            addr.postcode || '',
            addr.country || 'Brasil',
          ].filter((entry) => entry && entry.trim() !== '' && entry !== ', S/N')
        )
        setLocation((current) => current || [addr.road, addr.suburb || addr.neighbourhood, addr.city || addr.town].filter(Boolean).join(', '))
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
    : false

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
          ? dataURLtoFile(customerSignatureCanvasRef.current.toDataURL('image/png'), `assinatura_locatario_${Date.now()}.png`)
          : undefined
      const driverSignature =
        hasDriverSignature && driverSignatureCanvasRef.current
          ? dataURLtoFile(driverSignatureCanvasRef.current.toDataURL('image/png'), `assinatura_condutor_${Date.now()}.png`)
          : undefined

      let inspectionId: string | undefined
      if (photos.length > 0 || customerSignature || driverSignature) {
        const result = await createVehicleInspection(session.token.token, {
          company_id: company.id,
          vehicle_id: sale.vehicle?.id || '',
          people_id: contract.renterPeopleId,
          user_id: myCompanyPerson?.id,
          photos,
          customer_signature: customerSignature,
          customer_signer_name: customerSignerName || undefined,
          driver_signature: driverSignature,
          driver_signer_name: driverSignerName || undefined,
        })
        inspectionId = result.data.id
      }

      const nowISO = new Date().toISOString()
      if (isPickup) {
        await updateVehicleRentalOperation(session.token.token, sale.id, {
          pickupDate: nowISO,
          pickupOdometer: odometer ? Number(odometer) : undefined,
          pickupFuelLevel: fuelLevel || undefined,
          pickupLocation: location || undefined,
          pickupInspectionId: inspectionId,
          status: 1,
        })
      } else {
        await updateVehicleRentalOperation(session.token.token, sale.id, {
          returnDate: nowISO,
          returnOdometer: odometer ? Number(odometer) : undefined,
          returnFuelLevel: fuelLevel || undefined,
          returnLocation: location || undefined,
          returnInspectionId: inspectionId,
          status: 2,
        })
      }

      onCompleted()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível registrar a operação.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
    <div className="fixed inset-0 z-50 flex flex-col bg-[var(--surface)]">
      <div className="flex items-center justify-between border-b border-[var(--border)] px-6 py-4">
        <div>
          <h2 className="text-[15px] font-bold text-[var(--ink)]">{isPickup ? 'Registrar entrega' : 'Registrar devolução'}</h2>
          <p className="text-[12px] text-[var(--muted)]">
            {vehicleLabel(sale)} · Aluguel #{sale.internal_code ?? sale.code}
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

      <div className="mx-auto flex w-full min-h-0 max-w-[900px] flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-3">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Quilometragem</span>
            <input
              type="text"
              inputMode="numeric"
              value={odometer}
              onChange={(event) => setOdometer(event.target.value.replace(/\D/g, ''))}
              placeholder="Ex: 45000"
              className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
            />
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Nível de combustível</span>
            <select
              value={fuelLevel}
              onChange={(event) => setFuelLevel(event.target.value)}
              className="w-full appearance-none rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
            >
              <option value="">Selecione</option>
              {FUEL_LEVEL_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Local</span>
            <input
              type="text"
              value={location}
              onChange={(event) => setLocation(event.target.value)}
              placeholder="Endereço do local"
              className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
            />
          </label>
        </div>

        <p className="mt-6 text-[13px] text-[var(--muted)]">
          {detailedRequired
            ? 'Registre as fotos obrigatórias do veículo. Você pode adicionar fotos extras para avarias ou detalhes específicos.'
            : 'Adicione fotos do veículo, se necessário.'}
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
          + Adicionar foto
        </button>

        <div className="mt-8 border-t border-[var(--border)] pt-6">
          <h3 className="text-[14px] font-bold text-[var(--ink)]">Assinaturas</h3>
          <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">
            Colete a assinatura do locatário e do condutor para confirmar {isPickup ? 'a entrega' : 'a devolução'}.
          </p>

          <div className="mt-4 grid gap-5 sm:grid-cols-2">
            <div>
              <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                Assinatura do locatário
              </p>
              <input
                type="text"
                value={customerSignerName}
                onChange={(event) => setCustomerSignerName(event.target.value)}
                placeholder="Nome completo do locatário"
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
                Assinatura do condutor
              </p>
              <input
                type="text"
                value={driverSignerName}
                onChange={(event) => setDriverSignerName(event.target.value)}
                placeholder="Nome completo do condutor"
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
          {submitting ? 'Enviando…' : isPickup ? 'Confirmar entrega' : 'Confirmar devolução'}
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

export function VehicleRentalOperationsPage({ session, company }: VehicleRentalOperationsPageProps) {
  const [search, setSearch] = useState('')
  const [items, setItems] = useState<SaleRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  const [detailedInspectionRequired, setDetailedInspectionRequired] = useState(false)
  const [operationTarget, setOperationTarget] = useState<{ sale: SaleRecord; mode: OperationMode } | null>(null)

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

    fetchSales(session.token.token, company.id, { limit: 500 })
      .then((res) => {
        if (cancelled) return
        const rentals = (res.data || []).filter((sale) => sale.vehicleRentalContract)
        setItems(rentals)
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os aluguéis.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [company.id, session.token.token, refreshKey])

  function reload() {
    setRefreshKey((key) => key + 1)
  }

  const term = search.trim().toLowerCase()
  const filtered = items.filter((sale) => {
    if (!term) return true
    const contract = sale.vehicleRentalContract
    return (
      String(sale.internal_code ?? sale.code).includes(term) ||
      (contract?.renter?.name ?? '').toLowerCase().includes(term) ||
      (sale.vehicle?.license_plate ?? '').toLowerCase().includes(term)
    )
  })

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Operação</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Entrega e Devoluções</h1>
        <p className="mt-1 text-[13px] text-[var(--muted)]">
          Registre a entrega do veículo ao locatário e a devolução ao final do aluguel, com vistoria e assinaturas.
        </p>
      </div>

      <div className="flex min-w-[240px] max-w-md items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
        <SearchIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
        <input
          type="text"
          placeholder="Buscar por locatário, placa ou código"
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
            <div key={index} className="h-40 animate-pulse rounded-2xl bg-[var(--page)]" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] p-10 text-center">
          <RouteIcon className="mx-auto h-8 w-8 text-[var(--muted)]" />
          <p className="mt-3 text-[13.5px] text-[var(--muted)]">Nenhum aluguel encontrado no momento.</p>
        </div>
      ) : (
        <div className="grid gap-4 xl:grid-cols-2">
          {filtered.map((sale) => {
            const contract = sale.vehicleRentalContract!
            const status = contract.status ?? 0

            return (
              <article key={sale.id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--card-shadow)]">
                <div className="border-b border-[var(--border)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-[13px] font-black text-[var(--ink)]">#{sale.internal_code ?? sale.code}</p>
                        <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusStyles(status)}`}>
                          {VEHICLE_RENTAL_STATUS_LABELS[status] ?? status}
                        </span>
                      </div>
                      <p className="mt-1.5 text-[15px] font-bold text-[var(--ink)]">{vehicleLabel(sale)}</p>
                      <p className="text-[13px] text-[var(--muted)]">
                        {contract.renter?.name || '—'}
                        {contract.renter && ' · '}
                        {contract.driver?.name ? `Condutor: ${contract.driver.name}` : ''}
                      </p>
                    </div>
                    <p className="text-[13.5px] font-bold text-[var(--ink)]">
                      {formatCurrency(contract.monthlyValue ?? 0)}
                      <span className="ml-1 text-[11px] font-normal text-[var(--muted)]">
                        /{frequencyLabel(contract.rentalFrequency).toLowerCase()}
                      </span>
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
                  <div className="rounded-xl bg-[var(--page)] p-3">
                    <p className="text-[10.5px] font-bold tracking-wide text-[var(--muted)] uppercase">Documento do locatário</p>
                    <p className="mt-1 text-[12.5px] font-semibold text-[var(--ink)]">
                      {contract.renter?.document ? formatDocument(contract.renter.document) : '—'}
                    </p>
                  </div>
                  <div className="rounded-xl bg-[var(--page)] p-3">
                    <p className="text-[10.5px] font-bold tracking-wide text-[var(--muted)] uppercase">Entrega / Devolução</p>
                    <p className="mt-1 text-[12.5px] font-semibold text-[var(--ink)]">
                      {contract.pickupDate ? 'Entregue' : 'Aguardando entrega'}
                      {contract.returnDate ? ' · Devolvido' : ''}
                    </p>
                  </div>
                </div>

                <div className="flex flex-col gap-2 px-4 pb-4 sm:flex-row">
                  {status === 0 && (
                    <button
                      type="button"
                      onClick={() => setOperationTarget({ sale, mode: 'pickup' })}
                      className="min-h-11 flex-1 rounded-xl bg-[var(--blue-500)] px-4 py-2 text-[13px] font-bold text-white transition hover:bg-[var(--blue-700)]"
                    >
                      Registrar entrega
                    </button>
                  )}
                  {status === 1 && (
                    <button
                      type="button"
                      onClick={() => setOperationTarget({ sale, mode: 'return' })}
                      className="min-h-11 flex-1 rounded-xl bg-[var(--green-100)] px-4 py-2 text-[13px] font-bold text-[var(--green-600)] transition hover:bg-green-200"
                    >
                      Registrar devolução
                    </button>
                  )}
                  {status === 2 && (
                    <p className="min-h-11 flex-1 rounded-xl bg-[var(--page)] px-4 py-2 text-center text-[13px] font-bold text-[var(--muted)]">
                      Ciclo concluído
                    </p>
                  )}
                </div>
              </article>
            )
          })}
        </div>
      )}

      {operationTarget && (
        <RentalOperationModal
          session={session}
          company={company}
          sale={operationTarget.sale}
          mode={operationTarget.mode}
          detailedRequired={detailedInspectionRequired}
          onClose={() => setOperationTarget(null)}
          onCompleted={() => {
            setOperationTarget(null)
            reload()
          }}
        />
      )}
    </div>
  )
}
