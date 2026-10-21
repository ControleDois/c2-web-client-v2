import { useCallback, useEffect, useRef, useState } from 'react'
import {
  addGlassVisitPhotos,
  agendaDateKey,
  agendaTime,
  changeGlassAppointmentStatus,
  createGlassOrderFromVisit,
  fetchGlassVisit,
  GLASS_APPOINTMENT_TYPES,
  removeGlassVisitPhoto,
  rescheduleGlassVisit,
  saveGlassVisitReport,
  saveGlassVisitSignature,
  startGlassVisit,
  type GlassAppointmentRecord,
  type GlassVisitMeasurement,
} from '../../lib/glass'
import { ApiError } from '../../lib/api'
import { stampVisitPhoto } from '../../lib/photoWatermark'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { PhotoLightbox } from '../../components/PhotoLightbox'
import { SignatureModal } from '../../components/SignatureModal'
import { TextField } from '../../components/form/TextField'
import {
  CalendarIcon,
  CameraIcon,
  CheckCircleIcon,
  ChevronLeftIcon,
  ClockIcon,
  FileTextIcon,
  MapPinIcon,
  PaperclipIcon,
  PenIcon,
  PhoneIcon,
  PlusIcon,
  TagIcon,
  TrashIcon,
  WhatsappIcon,
} from '../../components/icons'
import type { AuthSession } from '../../lib/auth'

interface GlassVisitPageProps {
  session: AuthSession
  visitId: string
  onBack: () => void
  onOpenOrder: (orderId: string) => void
}

interface MeasureDraft {
  key: string
  location: string
  description: string
  width: string
  height: string
  quantity: string
  notes: string
}

let measureCounter = 0
const newMeasure = (): MeasureDraft => {
  measureCounter += 1
  return { key: `m${Date.now()}_${measureCounter}_${Math.random().toString(36).slice(2, 7)}`, location: '', description: '', width: '', height: '', quantity: '1', notes: '' }
}

function draftsFrom(measurements?: GlassVisitMeasurement[] | null): MeasureDraft[] {
  return (measurements ?? []).map((row) => ({
    ...newMeasure(),
    location: row.location ?? '',
    description: row.description ?? '',
    width: row.width_mm ? String(row.width_mm) : '',
    height: row.height_mm ? String(row.height_mm) : '',
    quantity: row.quantity ? String(row.quantity) : '1',
    notes: row.notes ?? '',
  }))
}

function measurementsFrom(drafts: MeasureDraft[]): GlassVisitMeasurement[] {
  return drafts
    .map((row) => ({
      location: row.location.trim() || null,
      description: row.description.trim() || null,
      width_mm: Number(row.width.replace(/\D/g, '')) || null,
      height_mm: Number(row.height.replace(/\D/g, '')) || null,
      quantity: Number(row.quantity.replace(/\D/g, '')) || 1,
      notes: row.notes.trim() || null,
    }))
    .filter((row) => row.location || row.description || row.width_mm || row.height_mm || row.notes)
}

const inputClass =
  'w-full rounded-xl bg-[var(--page)] px-3 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent placeholder:text-[var(--muted)] focus:outline-none focus:ring-[var(--blue-300)]'

function Card({ title, subtitle, children }: { title: string; subtitle?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <h2 className="text-[14.5px] font-bold text-[var(--ink)]">{title}</h2>
      {subtitle && <p className="mt-0.5 mb-3 text-[12.5px] leading-relaxed text-[var(--ink-soft)]">{subtitle}</p>}
      {!subtitle && <div className="mb-3" />}
      {children}
    </section>
  )
}

// Atendimento da visita no celular do técnico, do "cheguei" ao "concluir".
export function GlassVisitPage({ session, visitId, onBack, onOpenOrder }: GlassVisitPageProps) {
  const token = session.token.token
  const [visit, setVisit] = useState<GlassAppointmentRecord | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState<string | null>(null)

  const [report, setReport] = useState('')
  const [measures, setMeasures] = useState<MeasureDraft[]>([])
  const [dirty, setDirty] = useState(false)

  const [lightbox, setLightbox] = useState<number | null>(null)
  const [photoToRemove, setPhotoToRemove] = useState<string | null>(null)
  const [signatureOpen, setSignatureOpen] = useState(false)
  const [signatureError, setSignatureError] = useState<string | null>(null)
  const [rescheduleOpen, setRescheduleOpen] = useState(false)
  const [newDate, setNewDate] = useState('')
  const [newTime, setNewTime] = useState('08:00')
  const [reason, setReason] = useState('Cliente não estava')
  const [concludeOpen, setConcludeOpen] = useState(false)
  const [askOrder, setAskOrder] = useState(false)
  const loadedFor = useRef<string | null>(null)

  const apply = useCallback((record: GlassAppointmentRecord, resetForm = false) => {
    setVisit(record)
    if (resetForm) {
      setReport(record.report ?? '')
      setMeasures(draftsFrom(record.measurements))
      setDirty(false)
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    fetchGlassVisit(token, visitId)
      .then((record) => {
        if (cancelled) return
        loadedFor.current = visitId
        apply(record, true)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Não foi possível abrir a visita.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [token, visitId, apply])

  async function run<T>(key: string, action: () => Promise<T>, fallback: string): Promise<T | null> {
    setBusy(key)
    setError(null)
    setNotice(null)
    try {
      return await action()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : fallback)
      return null
    } finally {
      setBusy(null)
    }
  }

  async function saveNotes(silent = false) {
    if (!visit) return true
    const result = await run(
      'notes',
      () => saveGlassVisitReport(token, visit.id, { report: report.trim() || null, measurements: measurementsFrom(measures) }),
      'Não foi possível salvar as anotações.'
    )
    if (!result) return false
    apply(result, true)
    if (!silent) setNotice('Anotações salvas.')
    return true
  }

  async function handleStart() {
    if (!visit) return
    const result = await run('start', () => startGlassVisit(token, visit.id), 'Não foi possível registrar a chegada.')
    if (result) {
      setVisit((current) => (current ? { ...current, started_at: result.started_at } : current))
      setNotice('Chegada registrada. Bom atendimento!')
    }
  }

  async function handlePhotos(files: File[], stamp: boolean) {
    if (!visit || files.length === 0) return
    const count = visit.photos?.length ?? 0
    const result = await run(
      'photos',
      async () => {
        const prepared = await Promise.all(files.map((file) => (stamp ? stampVisitPhoto(file) : Promise.resolve(file))))
        return addGlassVisitPhotos(
          token,
          visit.id,
          prepared.map((file, index) => ({ file, label: `Foto ${count + index + 1}` }))
        )
      },
      'Não foi possível enviar as fotos. Tente de novo.'
    )
    if (result) setVisit((current) => (current ? { ...current, photos: result.photos } : current))
  }

  async function confirmRemovePhoto() {
    if (!visit || !photoToRemove) return
    const result = await run('photo-remove', () => removeGlassVisitPhoto(token, visit.id, photoToRemove), 'Não foi possível remover a foto.')
    setPhotoToRemove(null)
    if (result) setVisit((current) => (current ? { ...current, photos: result.photos } : current))
  }

  async function handleSignature(payload: { name: string; image: string }) {
    if (!visit) return
    setSignatureError(null)
    setBusy('signature')
    try {
      const result = await saveGlassVisitSignature(token, visit.id, payload)
      setVisit((current) =>
        current
          ? { ...current, signature_url: result.signature_url, signed_by: result.signed_by, signed_at: result.signed_at }
          : current
      )
      setSignatureOpen(false)
      setNotice('Assinatura do cliente registrada.')
    } catch (err) {
      setSignatureError(err instanceof ApiError ? err.message : 'Não foi possível salvar a assinatura.')
    } finally {
      setBusy(null)
    }
  }

  async function handleReschedule() {
    if (!visit) return
    if (!newDate || !newTime) {
      setError('Informe a nova data e o horário.')
      return
    }
    const result = await run(
      'reschedule',
      () => rescheduleGlassVisit(token, visit.id, { scheduled_at: `${newDate}T${newTime}`, reason: reason.trim() || null }),
      'Não foi possível remarcar a visita.'
    )
    if (result) {
      setRescheduleOpen(false)
      onBack()
    }
  }

  async function handleConclude() {
    if (!visit) return
    setConcludeOpen(false)
    if (!(await saveNotes(true))) return
    const result = await run('conclude', () => changeGlassAppointmentStatus(token, visit.id, 1), 'Não foi possível concluir a visita.')
    if (!result) return
    const fresh = await run('reload', () => fetchGlassVisit(token, visit.id), 'Não foi possível atualizar a visita.')
    if (fresh) apply(fresh)
    if (fresh && !fresh.glass_order_id && (fresh.measurements?.length ?? 0) > 0) setAskOrder(true)
    else setNotice('Visita concluída.')
  }

  async function handleOrder() {
    if (!visit) return
    setAskOrder(false)
    if (visit.status === 0 && !(await saveNotes(true))) return
    const result = await run('order', () => createGlassOrderFromVisit(token, visit.id), 'Não foi possível criar o orçamento.')
    if (result) onOpenOrder(result.order.id)
  }

  const typeLabel = GLASS_APPOINTMENT_TYPES.find((item) => item.value === visit?.type)?.label ?? visit?.type ?? ''
  const open = visit?.status === 0
  const clientName = visit?.people?.name ?? visit?.order?.people?.name ?? 'Sem cliente'
  const phoneDigits = (visit?.people?.phone ?? '').replace(/\D/g, '')
  const mapsUrl = visit?.address ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(visit.address)}` : null
  const installingOrder = visit?.type === 'instalacao' && visit.glass_order_id

  if (loading && !visit) {
    return <div className="p-6 text-[13.5px] text-[var(--muted)]">Carregando a visita…</div>
  }
  if (!visit) {
    return (
      <div className="mx-auto max-w-[760px] p-6">
        <button type="button" onClick={onBack} className="mb-3 flex items-center gap-1 text-[12.5px] font-semibold text-[var(--ink-soft)]">
          <ChevronLeftIcon className="h-3.5 w-3.5" /> Voltar para minhas visitas
        </button>
        <div className="rounded-2xl bg-[var(--red-100)] p-4 text-[13.5px] font-medium text-[var(--red-500)]">{error ?? 'Visita não encontrada.'}</div>
      </div>
    )
  }

  return (
    <div className="mx-auto flex w-full max-w-[760px] flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <div>
        <button type="button" onClick={onBack} className="mb-3 flex items-center gap-1 text-[12.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]">
          <ChevronLeftIcon className="h-3.5 w-3.5" />
          Voltar para minhas visitas
        </button>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">{typeLabel}</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">{clientName}</h1>
        <p className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[var(--ink-soft)]">
          <span className="flex items-center gap-1">
            <CalendarIcon className="h-3.5 w-3.5" />
            {agendaDateKey(visit.scheduled_at).split('-').reverse().join('/')}
          </span>
          <span className="flex items-center gap-1">
            <ClockIcon className="h-3.5 w-3.5" />
            {agendaTime(visit.scheduled_at)}
          </span>
          {visit.status === 1 && <span className="rounded-full bg-[var(--green-100)] px-2.5 py-0.5 text-[11.5px] font-bold text-[var(--green-600)]">Concluída</span>}
          {visit.status === 2 && <span className="rounded-full bg-[var(--amber-100)] px-2.5 py-0.5 text-[11.5px] font-bold text-[var(--amber-500)]">Cancelada</span>}
        </p>
      </div>

      {error && <div className="rounded-2xl bg-[var(--red-100)] p-4 text-[13.5px] font-medium text-[var(--red-500)]">{error}</div>}
      {notice && <div className="rounded-2xl bg-[var(--green-100)] p-4 text-[13.5px] font-medium text-[var(--green-600)]">{notice}</div>}

      <Card title="Cliente e local">
        <div className="flex flex-col gap-3">
          {mapsUrl && (
            <div className="flex items-start gap-2 text-[14px] text-[var(--ink)]">
              <MapPinIcon className="mt-0.5 h-4 w-4 flex-none text-[var(--muted)]" />
              <span>{visit.address}</span>
            </div>
          )}
          <div className="grid gap-2 sm:grid-cols-3">
            {phoneDigits && (
              <a
                href={`tel:${phoneDigits}`}
                className="flex items-center justify-center gap-2 rounded-xl bg-[var(--page)] px-3 py-2.5 text-[13px] font-bold text-[var(--blue-700)] hover:bg-[var(--blue-100)]"
              >
                <PhoneIcon className="h-4 w-4" /> Ligar
              </a>
            )}
            {phoneDigits && (
              <a
                href={`https://wa.me/${phoneDigits.startsWith('55') ? phoneDigits : `55${phoneDigits}`}`}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl bg-[var(--page)] px-3 py-2.5 text-[13px] font-bold text-[var(--green-600)] hover:bg-[var(--green-100)]"
              >
                <WhatsappIcon className="h-4 w-4" /> WhatsApp
              </a>
            )}
            {mapsUrl && (
              <a
                href={mapsUrl}
                target="_blank"
                rel="noreferrer"
                className="flex items-center justify-center gap-2 rounded-xl bg-[var(--page)] px-3 py-2.5 text-[13px] font-bold text-[var(--blue-700)] hover:bg-[var(--blue-100)]"
              >
                <MapPinIcon className="h-4 w-4" /> Abrir no mapa
              </a>
            )}
          </div>
          {!phoneDigits && !mapsUrl && <p className="text-[13px] text-[var(--muted)]">O escritório não informou telefone nem endereço desta visita.</p>}
          {visit.notes && (
            <div className="rounded-xl bg-[var(--page)] p-3">
              <p className="text-[11.5px] font-bold tracking-wide text-[var(--muted)] uppercase">Recado do escritório</p>
              <p className="mt-1 text-[13.5px] whitespace-pre-line text-[var(--ink)]">{visit.notes}</p>
            </div>
          )}
        </div>
      </Card>

      {open && !visit.started_at && (
        <button
          type="button"
          onClick={handleStart}
          disabled={busy === 'start'}
          className="flex items-center justify-center gap-2 rounded-2xl bg-[var(--blue-500)] px-5 py-4 text-[15px] font-bold text-white hover:bg-[var(--blue-700)] disabled:opacity-60"
        >
          <CheckCircleIcon className="h-5 w-5" />
          {busy === 'start' ? 'Registrando…' : 'Cheguei no local — iniciar atendimento'}
        </button>
      )}
      {visit.started_at && (
        <p className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--green-600)]">
          <CheckCircleIcon className="h-4 w-4" /> Chegada registrada às {agendaTime(visit.started_at)}
        </p>
      )}

      <Card
        title="O que foi feito"
        subtitle={
          visit.type === 'medicao'
            ? 'Escreva o que o cliente quer e o que viu no local (desnível, parede, acabamento...).'
            : 'Escreva o que foi feito no atendimento (troca de roldana, limpeza do kit, reinstalação...).'
        }
      >
        <textarea
          value={report}
          disabled={!open}
          rows={4}
          placeholder="Ex.: Porta de correr 2 folhas, parede com desnível de 1 cm, trocar roldanas."
          onChange={(event) => {
            setReport(event.target.value)
            setDirty(true)
          }}
          className={`${inputClass} resize-y`}
        />
      </Card>

      <Card
        title="Medidas"
        subtitle="Anote cada peça em milímetros (ex.: 2100 de largura por 2200 de altura). Ao criar o orçamento, estas medidas viram os itens dele."
      >
        <div className="flex flex-col gap-3">
          {measures.length === 0 && <p className="text-[13px] text-[var(--muted)]">Nenhuma medida anotada.</p>}
          {measures.map((row, index) => {
            const area = (Number(row.width.replace(/\D/g, '')) * Number(row.height.replace(/\D/g, '')) * (Number(row.quantity) || 1)) / 1_000_000
            const update = (patch: Partial<MeasureDraft>) => {
              setMeasures((current) => current.map((item) => (item.key === row.key ? { ...item, ...patch } : item)))
              setDirty(true)
            }
            return (
              <div key={row.key} className="rounded-xl border border-[var(--border)] p-3">
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-[12.5px] font-bold text-[var(--ink)]">Peça {index + 1}</p>
                  {open && (
                    <button
                      type="button"
                      aria-label={`Remover peça ${index + 1}`}
                      onClick={() => {
                        setMeasures((current) => current.filter((item) => item.key !== row.key))
                        setDirty(true)
                      }}
                      className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--red-500)] hover:bg-[var(--red-100)]"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <input className={inputClass} disabled={!open} placeholder="Local (ex.: Sala)" value={row.location} onChange={(event) => update({ location: event.target.value })} />
                  <input className={inputClass} disabled={!open} placeholder="O que é (ex.: Porta 2 folhas)" value={row.description} onChange={(event) => update({ description: event.target.value })} />
                  <input className={inputClass} disabled={!open} inputMode="numeric" placeholder="Largura (mm)" value={row.width} onChange={(event) => update({ width: event.target.value.replace(/\D/g, '') })} />
                  <input className={inputClass} disabled={!open} inputMode="numeric" placeholder="Altura (mm)" value={row.height} onChange={(event) => update({ height: event.target.value.replace(/\D/g, '') })} />
                  <input className={inputClass} disabled={!open} inputMode="numeric" placeholder="Quantidade" value={row.quantity} onChange={(event) => update({ quantity: event.target.value.replace(/\D/g, '') })} />
                  <input className={inputClass} disabled={!open} placeholder="Observação" value={row.notes} onChange={(event) => update({ notes: event.target.value })} />
                </div>
                {area > 0 && <p className="mt-2 text-[11.5px] text-[var(--muted)]">{area.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} m² no total</p>}
              </div>
            )
          })}
          {open && (
            <button
              type="button"
              onClick={() => {
                setMeasures((current) => [...current, newMeasure()])
                setDirty(true)
              }}
              className="flex items-center justify-center gap-2 rounded-xl bg-[var(--page)] px-4 py-2.5 text-[13px] font-bold text-[var(--blue-700)] hover:bg-[var(--blue-100)]"
            >
              <PlusIcon className="h-4 w-4" /> Adicionar peça
            </button>
          )}
        </div>
      </Card>

      {open && (
        <button
          type="button"
          onClick={() => saveNotes()}
          disabled={busy === 'notes' || !dirty}
          className="rounded-xl bg-[var(--blue-500)] px-5 py-3 text-[14px] font-bold text-white hover:bg-[var(--blue-700)] disabled:opacity-50"
        >
          {busy === 'notes' ? 'Salvando…' : dirty ? 'Salvar anotações e medidas' : 'Anotações salvas'}
        </button>
      )}

      <Card title="Fotos" subtitle="Tire a foto agora (ela leva data, hora e local) ou escolha da galeria.">
        {open && (
          <div className="mb-3 grid gap-2 sm:grid-cols-2">
            <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--blue-500)] px-4 py-3 text-[13.5px] font-bold text-white hover:bg-[var(--blue-700)] ${busy === 'photos' ? 'pointer-events-none opacity-60' : ''}`}>
              <CameraIcon className="h-4 w-4" />
              {busy === 'photos' ? 'Enviando…' : 'Tirar foto'}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? [])
                  event.target.value = ''
                  void handlePhotos(files, true)
                }}
              />
            </label>
            <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--page)] px-4 py-3 text-[13.5px] font-bold text-[var(--blue-700)] hover:bg-[var(--blue-100)] ${busy === 'photos' ? 'pointer-events-none opacity-60' : ''}`}>
              <PaperclipIcon className="h-4 w-4" />
              Escolher da galeria
              <input
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => {
                  const files = Array.from(event.target.files ?? [])
                  event.target.value = ''
                  void handlePhotos(files, false)
                }}
              />
            </label>
          </div>
        )}
        {(visit.photos?.length ?? 0) === 0 ? (
          <p className="text-[13px] text-[var(--muted)]">Nenhuma foto ainda.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2">
            {visit.photos!.map((photo, index) => (
              <div key={photo.id} className="relative aspect-square overflow-hidden rounded-xl bg-[var(--page)]">
                <button type="button" onClick={() => setLightbox(index)} className="h-full w-full">
                  <img src={photo.file_url} alt={photo.name ?? `Foto ${index + 1}`} className="h-full w-full object-cover" />
                </button>
                {open && (
                  <button
                    type="button"
                    aria-label="Remover foto"
                    onClick={() => setPhotoToRemove(photo.id)}
                    className="absolute top-1 right-1 flex h-7 w-7 items-center justify-center rounded-lg bg-black/60 text-white hover:bg-black/80"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card title="Assinatura do cliente" subtitle="O cliente assina no celular para confirmar o atendimento.">
        {visit.signature_url ? (
          <div className="flex flex-col gap-2">
            <img src={visit.signature_url} alt="Assinatura do cliente" className="max-h-[140px] w-full rounded-xl bg-white object-contain" />
            <p className="text-[12.5px] text-[var(--ink-soft)]">
              Assinado por <strong>{visit.signed_by}</strong>
              {visit.signed_at ? ` em ${new Date(visit.signed_at).toLocaleString('pt-BR', { timeZone: 'America/Cuiaba', dateStyle: 'short', timeStyle: 'short' })}` : ''}
            </p>
          </div>
        ) : (
          <p className="text-[13px] text-[var(--muted)]">Ainda sem assinatura.</p>
        )}
        {open && (
          <button
            type="button"
            onClick={() => {
              setSignatureError(null)
              setSignatureOpen(true)
            }}
            className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-[var(--page)] px-4 py-2.5 text-[13px] font-bold text-[var(--blue-700)] hover:bg-[var(--blue-100)]"
          >
            <PenIcon className="h-4 w-4" />
            {visit.signature_url ? 'Coletar nova assinatura' : 'Coletar assinatura'}
          </button>
        )}
      </Card>

      <Card
        title="Orçamento"
        subtitle={
          visit.glass_order_id
            ? 'Esta visita está ligada a um orçamento.'
            : 'Crie o orçamento já com o cliente, o endereço, as anotações e as medidas desta visita. Quem vende completa o vidro e o preço.'
        }
      >
        {visit.glass_order_id && visit.order ? (
          <button
            type="button"
            onClick={() => onOpenOrder(visit.glass_order_id!)}
            className="flex items-center gap-2 rounded-xl bg-[var(--page)] px-4 py-2.5 text-[13px] font-bold text-[var(--blue-700)] hover:bg-[var(--blue-100)]"
          >
            <FileTextIcon className="h-4 w-4" /> Abrir orçamento #{visit.order.code}
          </button>
        ) : (
          <button
            type="button"
            onClick={handleOrder}
            disabled={busy === 'order'}
            className="flex items-center gap-2 rounded-xl bg-[var(--page)] px-4 py-2.5 text-[13px] font-bold text-[var(--blue-700)] hover:bg-[var(--blue-100)] disabled:opacity-60"
          >
            <TagIcon className="h-4 w-4" /> {busy === 'order' ? 'Criando…' : 'Criar orçamento desta visita'}
          </button>
        )}
      </Card>

      {open && (
        <div className="sticky bottom-0 z-20 -mx-4 -mb-4 border-t border-[var(--border)] bg-[var(--surface)] p-3 sm:-mx-6 sm:-mb-6 lg:-mx-8 lg:-mb-8">
          <div className="mx-auto flex max-w-[760px] gap-2">
            <button
              type="button"
              onClick={() => {
                setNewDate(agendaDateKey(new Date(Date.now() + 86400000).toISOString()))
                setRescheduleOpen(true)
              }}
              className="flex-1 rounded-xl bg-[var(--amber-100)] px-3 py-3 text-[13px] font-bold text-[var(--amber-500)] hover:opacity-90"
            >
              Cliente ausente — remarcar
            </button>
            <button
              type="button"
              onClick={() => setConcludeOpen(true)}
              disabled={busy === 'conclude'}
              className="flex-1 rounded-xl bg-[var(--green-600)] px-3 py-3 text-[13px] font-bold text-white hover:opacity-90 disabled:opacity-60"
            >
              Concluir visita
            </button>
          </div>
        </div>
      )}

      <PhotoLightbox
        photos={(visit.photos ?? []).map((photo) => ({ url: photo.file_url, title: photo.name }))}
        index={lightbox}
        onIndexChange={setLightbox}
        onClose={() => setLightbox(null)}
      />

      <ConfirmDialog
        open={Boolean(photoToRemove)}
        title="Remover foto"
        message="A foto sai desta visita. Deseja remover?"
        confirmLabel="Remover"
        loading={busy === 'photo-remove'}
        onConfirm={confirmRemovePhoto}
        onCancel={() => setPhotoToRemove(null)}
      />

      <ConfirmDialog
        open={concludeOpen}
        danger={false}
        title="Concluir visita"
        message={
          installingOrder
            ? `Ao concluir, os itens do pedido ficam como instalados.${visit.signature_url ? '' : ' Ainda não há assinatura do cliente — conclua mesmo assim?'}`
            : `Marcar esta visita como concluída?${visit.signature_url ? '' : ' Ainda não há assinatura do cliente.'}`
        }
        confirmLabel="Concluir"
        onConfirm={handleConclude}
        onCancel={() => setConcludeOpen(false)}
      />

      <ConfirmDialog
        open={askOrder}
        danger={false}
        title="Visita concluída"
        message="Quer criar agora o orçamento com as medidas que você anotou? Você pode fazer isso depois pelo botão “Criar orçamento desta visita”."
        confirmLabel="Criar orçamento"
        cancelLabel="Agora não"
        onConfirm={handleOrder}
        onCancel={() => {
          setAskOrder(false)
          setNotice('Visita concluída.')
        }}
      />

      <SignatureModal
        open={signatureOpen}
        saving={busy === 'signature'}
        error={signatureError}
        onClose={() => setSignatureOpen(false)}
        onSave={handleSignature}
      />

      {rescheduleOpen && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={() => setRescheduleOpen(false)}>
          <div className="w-full max-w-[460px] rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]" onClick={(event) => event.stopPropagation()}>
            <h2 className="text-[16px] font-bold text-[var(--ink)]">Remarcar visita</h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--ink-soft)]">
              Escolha o novo dia e horário. O motivo fica registrado no histórico da visita e ela volta para a sua lista.
            </p>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <TextField label="Nova data" icon={<CalendarIcon className="h-4 w-4" />} type="date" value={newDate} onChange={(event) => setNewDate(event.target.value)} />
              <TextField label="Horário" icon={<ClockIcon className="h-4 w-4" />} type="time" value={newTime} onChange={(event) => setNewTime(event.target.value)} />
            </div>
            <div className="mt-3">
              <TextField label="Motivo" icon={<TagIcon className="h-4 w-4" />} value={reason} onChange={(event) => setReason(event.target.value)} />
            </div>
            <div className="mt-5 flex justify-end gap-3">
              <button type="button" onClick={() => setRescheduleOpen(false)} className="rounded-xl px-4 py-2.5 text-[14px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]">
                Voltar
              </button>
              <button
                type="button"
                onClick={handleReschedule}
                disabled={busy === 'reschedule'}
                className="rounded-xl bg-[var(--blue-500)] px-5 py-2.5 text-[14px] font-bold text-white hover:bg-[var(--blue-700)] disabled:opacity-60"
              >
                {busy === 'reschedule' ? 'Remarcando…' : 'Remarcar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
