import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  createVehicle,
  fetchVehicle,
  updateVehicle,
  VEHICLE_ROLE_LABELS,
  VEHICLE_STATUS_LABELS,
  VEHICLE_COLORS,
  TRANSMISSION_TYPES,
  FUEL_TYPES,
  type VehicleRecord,
  type VehicleDocumentInput,
} from '../lib/vehicles'
import { ApiError } from '../lib/api'
import { TextField } from '../components/form/TextField'
import { SelectField } from '../components/form/SelectField'
import { DocumentViewerModal } from '../components/DocumentViewerModal'
import {
  BadgeIcon,
  TruckIcon,
  ClockIcon,
  ChevronLeftIcon,
  PlusIcon,
  TrashIcon,
  PaperclipIcon,
  EyeIcon,
} from '../components/icons'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface VehicleFormPageProps {
  session: AuthSession
  company: AuthCompany
  vehicleId?: string
  onBack: () => void
  onSaved: () => void
}

interface DocEntry {
  id?: string
  title: string
  description: string
  file?: File
  existingFileUrl?: string
  existingFileName?: string
}

export function VehicleFormPage({ session, company, vehicleId, onBack, onSaved }: VehicleFormPageProps) {
  const [loading, setLoading] = useState(Boolean(vehicleId))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [role, setRole] = useState(1)
  const [internalCode, setInternalCode] = useState('')
  const [brand, setBrand] = useState('')
  const [model, setModel] = useState('')
  const [licensePlate, setLicensePlate] = useState('')
  const [color, setColor] = useState('')
  const [fabricationYear, setFabricationYear] = useState('')
  const [modelYear, setModelYear] = useState('')
  const [fuel, setFuel] = useState('')
  const [transmission, setTransmission] = useState('')
  const [mileage, setMileage] = useState('')
  const [status, setStatus] = useState(0)
  const [note, setNote] = useState('')

  const [documents, setDocuments] = useState<DocEntry[]>([])
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)

  const viewableDocuments = useMemo(
    () =>
      documents
        .map((doc, docIndex) => ({ doc, docIndex }))
        .filter(({ doc }) => doc.existingFileUrl && !doc.file),
    [documents]
  )

  useEffect(() => {
    if (!vehicleId) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    fetchVehicle(session.token.token, vehicleId)
      .then((vehicle: VehicleRecord) => {
        if (cancelled) return
        setRole(vehicle.role ?? 1)
        setInternalCode(vehicle.internal_code != null ? String(vehicle.internal_code) : '')
        setBrand(vehicle.brand ?? '')
        setModel(vehicle.model ?? '')
        setLicensePlate(vehicle.license_plate ?? '')
        setColor(vehicle.color ?? '')
        setFabricationYear(vehicle.fabrication_year ?? '')
        setModelYear(vehicle.model_year ?? '')
        setFuel(vehicle.fuel ?? '')
        setTransmission(vehicle.transmission ?? '')
        setMileage(vehicle.mileage ? String(vehicle.mileage) : '')
        setStatus(vehicle.status?.[0] ?? 0)
        setNote(vehicle.note ?? '')
        setDocuments(
          (vehicle.documents ?? []).map((doc) => ({
            id: doc.id,
            title: doc.title ?? '',
            description: doc.description ?? '',
            existingFileUrl: doc.file_url ?? undefined,
            existingFileName: doc.file_name ?? undefined,
          }))
        )
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err instanceof ApiError ? err.message : 'Não foi possível carregar o veículo.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [vehicleId, session.token.token, reloadKey])

  function addDocument() {
    setDocuments((docs) => [...docs, { title: '', description: '' }])
  }

  function updateDocument(index: number, patch: Partial<DocEntry>) {
    setDocuments((docs) => docs.map((doc, i) => (i === index ? { ...doc, ...patch } : doc)))
  }

  function removeDocument(index: number) {
    setDocuments((docs) => docs.filter((_, i) => i !== index))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!licensePlate.trim()) {
      setError('Preencha a placa para continuar.')
      return
    }

    const documentEntries: VehicleDocumentInput[] = documents
      .filter((doc) => doc.title.trim() || doc.file)
      .map((doc) => ({
        id: doc.id,
        title: doc.title.trim() || 'Documento',
        description: doc.description,
        file: doc.file,
      }))

    const payload = {
      company_id: company.id,
      internal_code: internalCode.trim() ? Number(internalCode.trim()) : undefined,
      role,
      brand: brand || undefined,
      model: model || undefined,
      license_plate: licensePlate.trim().toUpperCase(),
      color: color || undefined,
      fabrication_year: fabricationYear || undefined,
      model_year: modelYear || undefined,
      fuel: fuel || undefined,
      transmission: transmission || undefined,
      mileage: mileage ? Number(mileage) : undefined,
      status: [status],
      note: note || undefined,
      documents: documentEntries,
    }

    setSubmitting(true)
    try {
      if (vehicleId) {
        await updateVehicle(session.token.token, vehicleId, payload)
      } else {
        await createVehicle(session.token.token, payload)
      }
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o veículo.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-8">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="mb-3 flex items-center gap-1 text-[12.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
          Voltar para veículos
        </button>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Cadastros</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">
          {vehicleId ? 'Editar veículo' : 'Novo veículo'}
        </h1>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-11 animate-pulse rounded-xl bg-[var(--surface)]" />
          ))}
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl bg-[var(--red-100)] p-5">
          <p className="text-[13.5px] font-medium text-[var(--red-500)]">{loadError}</p>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="rounded-xl bg-[var(--surface)] px-4 py-2 text-[13px] font-bold text-[var(--red-500)] hover:bg-white"
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="mb-4 text-[14px] font-bold text-[var(--ink)]">Dados do veículo</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <TextField
                label="Placa"
                icon={<BadgeIcon className="h-4 w-4" />}
                placeholder="ABC1D23"
                value={licensePlate}
                onChange={(event) => setLicensePlate(event.target.value.toUpperCase())}
              />
              <TextField
                label="Código interno"
                icon={<BadgeIcon className="h-4 w-4" />}
                placeholder="Gerado automaticamente se deixado em branco"
                inputMode="numeric"
                value={internalCode}
                onChange={(event) => setInternalCode(event.target.value.replace(/\D/g, ''))}
              />
              <SelectField label="Tipo" value={role} onChange={(event) => setRole(Number(event.target.value))}>
                {Object.entries(VEHICLE_ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
              <SelectField label="Status" value={status} onChange={(event) => setStatus(Number(event.target.value))}>
                {Object.entries(VEHICLE_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
              <TextField
                label="Marca"
                icon={<TruckIcon className="h-4 w-4" />}
                placeholder="Fiat"
                value={brand}
                onChange={(event) => setBrand(event.target.value)}
              />
              <TextField
                label="Modelo"
                icon={<TruckIcon className="h-4 w-4" />}
                placeholder="Uno"
                value={model}
                onChange={(event) => setModel(event.target.value)}
              />
              <SelectField label="Cor" value={color} onChange={(event) => setColor(event.target.value)}>
                <option value="">—</option>
                {VEHICLE_COLORS.map((option) => (
                  <option key={option} value={option}>
                    {option.charAt(0) + option.slice(1).toLowerCase()}
                  </option>
                ))}
              </SelectField>
              <TextField
                label="Ano de fabricação"
                icon={<ClockIcon className="h-4 w-4" />}
                placeholder="2020"
                inputMode="numeric"
                value={fabricationYear}
                onChange={(event) => setFabricationYear(event.target.value.replace(/\D/g, '').slice(0, 4))}
              />
              <TextField
                label="Ano do modelo"
                icon={<ClockIcon className="h-4 w-4" />}
                placeholder="2021"
                inputMode="numeric"
                value={modelYear}
                onChange={(event) => setModelYear(event.target.value.replace(/\D/g, '').slice(0, 4))}
              />
              <TextField
                label="Quilometragem"
                icon={<ClockIcon className="h-4 w-4" />}
                placeholder="Opcional"
                inputMode="numeric"
                value={mileage}
                onChange={(event) => setMileage(event.target.value.replace(/\D/g, ''))}
              />
              <SelectField label="Combustível" value={fuel} onChange={(event) => setFuel(event.target.value)}>
                <option value="">—</option>
                {FUEL_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {option.charAt(0) + option.slice(1).toLowerCase()}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Câmbio"
                value={transmission}
                onChange={(event) => setTransmission(event.target.value)}
              >
                <option value="">—</option>
                {TRANSMISSION_TYPES.map((option) => (
                  <option key={option} value={option}>
                    {option
                      .replaceAll('_', ' ')
                      .toLowerCase()
                      .replace(/(^|\s)\S/g, (letter) => letter.toUpperCase())}
                  </option>
                ))}
              </SelectField>
              <div className="sm:col-span-2 xl:col-span-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Observações</span>
                  <textarea
                    value={note}
                    onChange={(event) => setNote(event.target.value)}
                    placeholder="Opcional"
                    rows={2}
                    className="w-full resize-none rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition placeholder:text-[var(--muted)] focus:outline-none focus:ring-[var(--blue-300)]"
                  />
                </label>
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-[14px] font-bold text-[var(--ink)]">Anexos</h2>
                <p className="mt-0.5 text-[12px] text-[var(--muted)]">
                  Fotos, laudos ou documentos relacionados a esse veículo
                </p>
              </div>
              <button
                type="button"
                onClick={addDocument}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-2 text-[12.5px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Adicionar anexo
              </button>
            </div>

            {documents.length === 0 ? (
              <p className="py-4 text-center text-[13px] text-[var(--muted)]">Nenhum anexo adicionado ainda.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {documents.map((doc, index) => (
                  <div
                    key={index}
                    className="flex flex-col gap-3 rounded-xl bg-[var(--page)] p-4 sm:flex-row sm:items-start"
                  >
                    <div className="grid flex-1 gap-3 sm:grid-cols-2">
                      <input
                        type="text"
                        placeholder="Título (ex: foto, laudo, CRLV)"
                        value={doc.title}
                        onChange={(event) => updateDocument(index, { title: event.target.value })}
                        className="rounded-lg bg-[var(--surface)] px-3 py-2 text-[13.5px] text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)]"
                      />
                      <input
                        type="text"
                        placeholder="Descrição (opcional)"
                        value={doc.description}
                        onChange={(event) => updateDocument(index, { description: event.target.value })}
                        className="rounded-lg bg-[var(--surface)] px-3 py-2 text-[13.5px] text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)]"
                      />
                      <label className="flex cursor-pointer items-center gap-2 rounded-lg bg-[var(--surface)] px-3 py-2 text-[12.5px] font-semibold text-[var(--blue-700)]">
                        <PaperclipIcon className="h-3.5 w-3.5 flex-none" />
                        <span className="truncate">
                          {doc.file?.name ?? doc.existingFileName ?? 'Escolher arquivo'}
                        </span>
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png,.webp,.pdf"
                          className="hidden"
                          onChange={(event) => updateDocument(index, { file: event.target.files?.[0] })}
                        />
                      </label>
                      {doc.existingFileUrl && !doc.file && (
                        <button
                          type="button"
                          onClick={() =>
                            setViewerIndex(viewableDocuments.findIndex((entry) => entry.docIndex === index))
                          }
                          className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--blue-700)] hover:underline"
                        >
                          <EyeIcon className="h-3.5 w-3.5" />
                          Ver arquivo atual
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeDocument(index)}
                      aria-label="Remover anexo"
                      className="flex-none self-start rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--red-100)] hover:text-[var(--red-500)]"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <p className="rounded-xl bg-[var(--red-100)] px-4 py-3 text-[13.5px] font-medium text-[var(--red-500)]">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-[var(--blue-500)] px-6 py-2.5 text-[14px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
            >
              {submitting ? 'Salvando…' : 'Salvar veículo'}
            </button>
            <button
              type="button"
              onClick={onBack}
              className="rounded-xl px-5 py-2.5 text-[14px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {viewerIndex !== null && viewableDocuments[viewerIndex] && (
        <DocumentViewerModal
          documents={viewableDocuments.map(({ doc }) => ({
            title: doc.title,
            description: doc.description,
            url: doc.existingFileUrl as string,
            fileName: doc.existingFileName,
          }))}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onIndexChange={setViewerIndex}
        />
      )}
    </div>
  )
}
