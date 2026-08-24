import { useEffect, useRef, useState, type MouseEvent as ReactMouseEvent, type TouchEvent as ReactTouchEvent } from 'react'
import { createVehicleInspection } from '../lib/vehicleInspections'
import { fetchVehicles, type VehicleRecord } from '../lib/vehicles'
import { fetchConfig } from '../lib/config'
import { FUEL_LEVEL_OPTIONS } from '../lib/sales'
import { ApiError } from '../lib/api'
import { SearchSelectField } from '../components/form/SearchSelectField'
import {
  CameraIcon,
  PaperclipIcon,
  CheckCircleIcon,
  CloseIcon,
  TrashIcon,
  ChevronLeftIcon,
} from '../components/icons'
import { useMyCompanyPerson } from '../hooks/useMyCompanyPerson'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface StandaloneInspectionPageProps {
  session: AuthSession
  company: AuthCompany
  onBack: () => void
  onSaved: () => void
}

interface PhotoSlot {
  id: string
  label: string
  required: boolean
  file: File | null
  previewUrl: string | null
  observation: string
}

type SignatureTarget = 'user' | 'owner'

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

interface VehiclePick {
  id: string
  label: string
  sub?: string
}

export function StandaloneInspectionPage({ session, company, onBack, onSaved }: StandaloneInspectionPageProps) {
  const myCompanyPerson = useMyCompanyPerson(session, company)

  const [vehicle, setVehicle] = useState<VehiclePick | null>(null)
  const [odometer, setOdometer] = useState('')
  const [fuelLevel, setFuelLevel] = useState('')
  const [location, setLocation] = useState('')

  const [detailedRequired, setDetailedRequired] = useState<boolean | null>(null)
  const [slots, setSlots] = useState<PhotoSlot[]>([])
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    fetchConfig(session.token.token, company.id)
      .then((config) => {
        if (cancelled) return
        const required = Boolean(config.vehicle_inspection_detailed_required)
        setDetailedRequired(required)
        setSlots(required ? buildInitialSlots() : [])
      })
      .catch(() => {
        if (cancelled) return
        setDetailedRequired(false)
        setSlots([])
      })
    return () => {
      cancelled = true
    }
  }, [session.token.token, company.id])

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

  const userSignatureCanvasRef = useRef<HTMLCanvasElement>(null)
  const ownerSignatureCanvasRef = useRef<HTMLCanvasElement>(null)
  const drawingSignatureRef = useRef<SignatureTarget | null>(null)
  const [userSignerName, setUserSignerName] = useState('')
  const [ownerSignerName, setOwnerSignerName] = useState('')
  const [hasUserSignature, setHasUserSignature] = useState(false)
  const [hasOwnerSignature, setHasOwnerSignature] = useState(false)

  useEffect(() => {
    if (myCompanyPerson) setUserSignerName((current) => current || myCompanyPerson.name)
  }, [myCompanyPerson])

  function getSignatureCanvas(target: SignatureTarget) {
    return target === 'owner' ? ownerSignatureCanvasRef.current : userSignatureCanvasRef.current
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
    if (target === 'owner') setHasOwnerSignature(true)
    else setHasUserSignature(true)
  }

  function endSignature(target: SignatureTarget) {
    if (drawingSignatureRef.current !== target) return
    drawingSignatureRef.current = null
  }

  function clearSignature(target: SignatureTarget) {
    const canvas = getSignatureCanvas(target)
    const ctx = canvas?.getContext('2d')
    if (canvas && ctx) ctx.clearRect(0, 0, canvas.width, canvas.height)
    if (target === 'owner') setHasOwnerSignature(false)
    else setHasUserSignature(false)
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

  const searchVehicles = (query: string) =>
    fetchVehicles(session.token.token, company.id, { search: query, limit: 8 }).then((res) => res.data)

  const missingRequired = !vehicle || detailedRequired === null || slots.some((slot) => slot.required && !slot.file)

  async function handleSubmit() {
    if (missingRequired || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const photos = slots
        .filter((slot) => slot.file)
        .map((slot) => ({ file: slot.file as File, label: slot.label, observation: slot.observation }))

      const userSignature =
        hasUserSignature && userSignatureCanvasRef.current
          ? dataURLtoFile(userSignatureCanvasRef.current.toDataURL('image/png'), `assinatura_usuario_${Date.now()}.png`)
          : undefined
      const ownerSignature =
        hasOwnerSignature && ownerSignatureCanvasRef.current
          ? dataURLtoFile(ownerSignatureCanvasRef.current.toDataURL('image/png'), `assinatura_proprietario_${Date.now()}.png`)
          : undefined

      await createVehicleInspection(session.token.token, {
        company_id: company.id,
        vehicle_id: vehicle!.id,
        user_id: myCompanyPerson?.id,
        photos,
        customer_signature: ownerSignature,
        customer_signer_name: ownerSignerName || undefined,
        driver_signature: userSignature,
        driver_signer_name: userSignerName || undefined,
      })

      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível registrar a vistoria.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <>
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
              <h2 className="truncate text-[14px] font-bold text-[var(--ink)] sm:text-[15px]">Vistoria avulsa</h2>
              <p className="truncate text-[11px] text-[var(--muted)] sm:text-[12px]">Vistoria independente, sem vínculo</p>
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
                label="Veículo"
                placeholder="Buscar por placa, marca ou modelo"
                selectedLabel={vehicle?.label ?? null}
                selectedSubLabel={vehicle?.sub}
                onSearch={searchVehicles}
                getOptionLabel={(item: VehicleRecord) => [item.brand, item.model].filter(Boolean).join(' ') || item.license_plate}
                getOptionSubLabel={(item: VehicleRecord) => item.license_plate}
                onSelect={(item: VehicleRecord) =>
                  setVehicle({ id: item.id, label: [item.brand, item.model].filter(Boolean).join(' ') || item.license_plate, sub: item.license_plate })
                }
                onClear={() => setVehicle(null)}
              />
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-3">
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
              Colete a assinatura de quem realizou a vistoria e do dono do veículo.
            </p>

            <div className="mt-4 grid gap-5 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                  Assinatura do usuário
                </p>
                <input
                  type="text"
                  value={userSignerName}
                  onChange={(event) => setUserSignerName(event.target.value)}
                  placeholder="Nome completo do usuário"
                  className="mb-2 w-full rounded-lg bg-[var(--page)] px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] ring-1 ring-transparent placeholder:text-[var(--muted)] focus:outline-none focus:ring-[var(--blue-300)]"
                />
                <div className="relative overflow-hidden rounded-lg border-2 border-dashed border-[var(--border)] bg-white">
                  <canvas
                    ref={userSignatureCanvasRef}
                    width={600}
                    height={220}
                    className="h-40 w-full touch-none"
                    onMouseDown={(event) => startSignature(event, 'user')}
                    onMouseMove={(event) => drawSignature(event, 'user')}
                    onMouseUp={() => endSignature('user')}
                    onMouseLeave={() => endSignature('user')}
                    onTouchStart={(event) => startSignature(event, 'user')}
                    onTouchMove={(event) => drawSignature(event, 'user')}
                    onTouchEnd={() => endSignature('user')}
                  />
                  {!hasUserSignature && (
                    <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-[12.5px] font-medium text-[var(--muted)]">
                      Assine aqui
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => clearSignature('user')}
                  className="mt-2 text-[11.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
                >
                  Limpar assinatura
                </button>
              </div>

              <div>
                <p className="mb-1.5 text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                  Assinatura do dono do veículo
                </p>
                <input
                  type="text"
                  value={ownerSignerName}
                  onChange={(event) => setOwnerSignerName(event.target.value)}
                  placeholder="Nome completo do proprietário"
                  className="mb-2 w-full rounded-lg bg-[var(--page)] px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] ring-1 ring-transparent placeholder:text-[var(--muted)] focus:outline-none focus:ring-[var(--blue-300)]"
                />
                <div className="relative overflow-hidden rounded-lg border-2 border-dashed border-[var(--border)] bg-white">
                  <canvas
                    ref={ownerSignatureCanvasRef}
                    width={600}
                    height={220}
                    className="h-40 w-full touch-none"
                    onMouseDown={(event) => startSignature(event, 'owner')}
                    onMouseMove={(event) => drawSignature(event, 'owner')}
                    onMouseUp={() => endSignature('owner')}
                    onMouseLeave={() => endSignature('owner')}
                    onTouchStart={(event) => startSignature(event, 'owner')}
                    onTouchMove={(event) => drawSignature(event, 'owner')}
                    onTouchEnd={() => endSignature('owner')}
                  />
                  {!hasOwnerSignature && (
                    <p className="pointer-events-none absolute inset-0 flex items-center justify-center text-[12.5px] font-medium text-[var(--muted)]">
                      Assine aqui
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => clearSignature('owner')}
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
            disabled={missingRequired || submitting}
            className="flex flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60 sm:flex-none sm:text-[13.5px]"
          >
            <CheckCircleIcon className="h-4 w-4" />
            {submitting ? 'Enviando…' : 'Salvar vistoria'}
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
