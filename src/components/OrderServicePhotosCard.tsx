import { useRef, useState } from 'react'
import {
  deleteOrderServicePhoto,
  ORDER_SERVICE_PHOTO_STAGES,
  uploadOrderServicePhotos,
  type OrderServicePhotoRecord,
  type OrderServicePhotoStage,
} from '../lib/orderServices'
import { ApiError } from '../lib/api'
import { CameraIcon, TrashIcon } from './icons'
import { SectionCard } from './SectionCard'
import type { AuthSession } from '../lib/auth'

export interface PendingPhoto {
  id: string
  file: File
  stage: OrderServicePhotoStage
  caption: string
  previewUrl: string
}

interface OrderServicePhotosCardProps {
  session: AuthSession
  orderServiceId?: string
  photos: OrderServicePhotoRecord[]
  onPhotosChange: (photos: OrderServicePhotoRecord[]) => void
  pending: PendingPhoto[]
  onPendingChange: (pending: PendingPhoto[]) => void
}

const MAX_SIDE = 1600

// Fotos de celular chegam a vários MB; reduz para até 1600 px (JPEG) antes de
// enviar — mais rápido e ocupa menos espaço, sem perder o que importa numa
// foto de estado do aparelho. Se não der para reduzir, manda a original.
async function shrinkImage(file: File): Promise<File> {
  try {
    const bitmap = await createImageBitmap(file)
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height))
    if (scale === 1 && file.size < 1.5 * 1024 * 1024) return file
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bitmap.width * scale)
    canvas.height = Math.round(bitmap.height * scale)
    canvas.getContext('2d')?.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.82))
    if (!blob || blob.size >= file.size) return file
    return new File([blob], file.name.replace(/\.\w+$/, '') + '.jpg', { type: 'image/jpeg' })
  } catch {
    return file
  }
}

export function OrderServicePhotosCard({
  session,
  orderServiceId,
  photos,
  onPhotosChange,
  pending,
  onPendingChange,
}: OrderServicePhotosCardProps) {
  const token = session.token.token
  const fileInput = useRef<HTMLInputElement | null>(null)
  const [stage, setStage] = useState<OrderServicePhotoStage>('entry')
  const [caption, setCaption] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const savedInStage = photos.filter((photo) => photo.stage === stage)
  const pendingInStage = pending.filter((photo) => photo.stage === stage)
  const countFor = (value: OrderServicePhotoStage) =>
    photos.filter((photo) => photo.stage === value).length + pending.filter((photo) => photo.stage === value).length

  async function handleFiles(fileList: FileList | null) {
    const files = Array.from(fileList ?? []).filter((file) => file.type.startsWith('image/'))
    if (fileInput.current) fileInput.current.value = ''
    if (!files.length) return
    setError(null)
    setBusy(true)
    try {
      const shrunk = await Promise.all(files.map(shrinkImage))
      const note = caption.trim()

      if (orderServiceId) {
        const saved = await uploadOrderServicePhotos(token, orderServiceId, stage, shrunk, note || undefined)
        onPhotosChange([...photos, ...saved])
      } else {
        onPendingChange([
          ...pending,
          ...shrunk.map((file) => ({
            id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
            file,
            stage,
            caption: note,
            previewUrl: URL.createObjectURL(file),
          })),
        ])
      }
      setCaption('')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar as fotos.')
    } finally {
      setBusy(false)
    }
  }

  async function removeSaved(photo: OrderServicePhotoRecord) {
    if (!orderServiceId || !window.confirm('Remover esta foto?')) return
    try {
      await deleteOrderServicePhoto(token, orderServiceId, photo.id)
      onPhotosChange(photos.filter((item) => item.id !== photo.id))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível remover a foto.')
    }
  }

  function removePending(photo: PendingPhoto) {
    URL.revokeObjectURL(photo.previewUrl)
    onPendingChange(pending.filter((item) => item.id !== photo.id))
  }

  return (
    <SectionCard title="Fotos do equipamento" subtitle="Registre o estado na entrada, durante o serviço e na saída">
      <div className="flex flex-wrap gap-2">
        {ORDER_SERVICE_PHOTO_STAGES.map((item) => (
          <button
            key={item.value}
            type="button"
            onClick={() => setStage(item.value)}
            className={`rounded-full px-4 py-1.5 text-[12.5px] font-bold transition ${
              stage === item.value
                ? 'bg-[var(--blue-500)] text-white'
                : 'bg-[var(--page)] text-[var(--ink-soft)] hover:text-[var(--ink)]'
            }`}
          >
            {item.label} ({countFor(item.value)})
          </button>
        ))}
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="flex min-w-[220px] flex-1 flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Legenda (opcional)</span>
          <input
            value={caption}
            onChange={(event) => setCaption(event.target.value)}
            maxLength={150}
            placeholder="Ex.: tela trincada, etiqueta do número de série…"
            className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)]"
          />
        </label>
        <label
          className={`flex cursor-pointer items-center gap-2 rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13px] font-bold text-white hover:bg-[var(--blue-700)] ${
            busy ? 'pointer-events-none opacity-60' : ''
          }`}
        >
          <CameraIcon className="h-4 w-4" />
          {busy ? 'Enviando…' : 'Tirar ou escolher fotos'}
          <input
            ref={fileInput}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => handleFiles(event.target.files)}
          />
        </label>
      </div>

      {!orderServiceId && (
        <p className="mt-2 text-[12px] text-[var(--muted)]">
          As fotos ficam guardadas aqui e são enviadas quando você salvar a OS.
        </p>
      )}
      {error && <p className="mt-2 text-[12.5px] font-medium text-[var(--red-500)]">{error}</p>}

      {savedInStage.length + pendingInStage.length === 0 ? (
        <p className="mt-4 rounded-xl border border-dashed border-[var(--border)] bg-[var(--page)] px-4 py-6 text-center text-[12.5px] text-[var(--muted)]">
          Nenhuma foto de {ORDER_SERVICE_PHOTO_STAGES.find((item) => item.value === stage)?.label.toLowerCase()} ainda.
        </p>
      ) : (
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
          {savedInStage.map((photo) => (
            <figure key={photo.id} className="group relative overflow-hidden rounded-xl bg-[var(--page)]">
              <a href={photo.fileUrl} target="_blank" rel="noreferrer">
                <img src={photo.fileUrl} alt={photo.caption ?? ''} className="aspect-square w-full object-cover" />
              </a>
              {photo.caption && (
                <figcaption className="px-2.5 py-1.5 text-[11.5px] text-[var(--ink-soft)]">{photo.caption}</figcaption>
              )}
              <button
                type="button"
                onClick={() => removeSaved(photo)}
                aria-label="Remover foto"
                className="absolute top-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            </figure>
          ))}
          {pendingInStage.map((photo) => (
            <figure key={photo.id} className="relative overflow-hidden rounded-xl bg-[var(--page)] ring-2 ring-[var(--amber-500)]">
              <img src={photo.previewUrl} alt={photo.caption} className="aspect-square w-full object-cover" />
              <figcaption className="px-2.5 py-1.5 text-[11.5px] text-[var(--amber-500)]">
                {photo.caption || 'Será enviada ao salvar'}
              </figcaption>
              <button
                type="button"
                onClick={() => removePending(photo)}
                aria-label="Remover foto"
                className="absolute top-1.5 right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-black/60 text-white"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            </figure>
          ))}
        </div>
      )}
    </SectionCard>
  )
}
