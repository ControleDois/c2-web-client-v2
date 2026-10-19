import { useEffect, useRef, useState } from 'react'
import { addSupportVisitPhotos, type SupportVisitRecord } from '../lib/supportVisits'
import { stampVisitPhoto } from '../lib/photoWatermark'
import { ApiError } from '../lib/api'
import { TextField } from './form/TextField'
import { CameraIcon, CloseIcon, PaperclipIcon, TagIcon, TrashIcon } from './icons'

interface DraftPhoto {
  id: string
  file: File
  previewUrl: string
  label: string
  observation: string
}

interface SupportVisitPhotosModalProps {
  open: boolean
  token: string
  visit: SupportVisitRecord | null
  onClose: () => void
  onSaved: (visit: SupportVisitRecord) => void
}

// Acrescenta fotos a uma visita já registrada: tirar na hora (com data, hora e local) ou escolher da galeria.
export function SupportVisitPhotosModal({ open, token, visit, onClose, onSaved }: SupportVisitPhotosModalProps) {
  const [photos, setPhotos] = useState<DraftPhoto[]>([])
  const [stamping, setStamping] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const counter = useRef(0)

  useEffect(() => {
    if (!open) return
    setPhotos((current) => {
      current.forEach((photo) => URL.revokeObjectURL(photo.previewUrl))
      return []
    })
    setError(null)
    counter.current = visit?.photos?.length ?? 0
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, visit?.id])

  if (!open || !visit) return null

  function addFiles(files: File[]) {
    // Os números das fotos saem fora do setState (o React pode chamar a função do setState duas vezes).
    const drafts = files.map((file) => {
      counter.current += 1
      return {
        id: `${Date.now()}_${counter.current}`,
        file,
        previewUrl: URL.createObjectURL(file),
        label: `Foto ${counter.current}`,
        observation: '',
      }
    })
    setPhotos((current) => [...current, ...drafts])
  }

  async function handleCamera(file: File | undefined) {
    if (!file) return
    setStamping(true)
    try {
      addFiles([await stampVisitPhoto(file)])
    } finally {
      setStamping(false)
    }
  }

  function update(id: string, patch: Partial<DraftPhoto>) {
    setPhotos((current) => current.map((photo) => (photo.id === id ? { ...photo, ...patch } : photo)))
  }

  function remove(id: string) {
    setPhotos((current) => {
      const target = current.find((photo) => photo.id === id)
      if (target) URL.revokeObjectURL(target.previewUrl)
      return current.filter((photo) => photo.id !== id)
    })
  }

  async function handleSave() {
    if (!visit || photos.length === 0) return
    setSaving(true)
    setError(null)
    try {
      const updated = await addSupportVisitPhotos(
        token,
        visit.id,
        photos.map((photo) => ({ file: photo.file, label: photo.label.trim() || 'Foto', observation: photo.observation.trim() }))
      )
      photos.forEach((photo) => URL.revokeObjectURL(photo.previewUrl))
      onSaved(updated)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar as fotos. Tente de novo.')
    } finally {
      setSaving(false)
    }
  }

  const busy = saving || stamping

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={busy ? undefined : onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-[560px] flex-col overflow-hidden rounded-2xl bg-[var(--surface)] shadow-[var(--card-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-6 pb-3">
          <div>
            <h2 className="text-[15px] font-bold text-[var(--ink)]">Adicionar fotos à visita {visit.code ? `#${visit.code}` : ''}</h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--ink-soft)]">
              Tire a foto agora (ela leva data, hora e local) ou escolha da galeria. As fotos que já estão na visita continuam lá.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Fechar"
            className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)] disabled:opacity-60"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-2">
          <div className="grid gap-2 sm:grid-cols-2">
            <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl bg-[var(--blue-500)] px-4 py-3 text-[13.5px] font-bold text-white hover:bg-[var(--blue-700)] ${busy ? 'pointer-events-none opacity-60' : ''}`}>
              <CameraIcon className="h-4 w-4" />
              {stamping ? 'Carimbando a foto…' : 'Tirar foto'}
              <input
                type="file"
                accept="image/*"
                capture="environment"
                className="hidden"
                onChange={(event) => {
                  const file = event.target.files?.[0]
                  event.target.value = ''
                  void handleCamera(file)
                }}
              />
            </label>
            <label className={`flex cursor-pointer items-center justify-center gap-2 rounded-xl px-4 py-3 text-[13.5px] font-bold text-[var(--blue-700)] ring-1 ring-[var(--blue-300)] hover:bg-[var(--blue-100)] ${busy ? 'pointer-events-none opacity-60' : ''}`}>
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
                  if (files.length) addFiles(files)
                }}
              />
            </label>
          </div>

          {photos.length === 0 ? (
            <p className="mt-4 rounded-xl border border-dashed border-[var(--border)] px-4 py-6 text-center text-[13px] text-[var(--muted)]">
              Nenhuma foto nova ainda. Toque em "Tirar foto" ou "Escolher da galeria".
            </p>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              {photos.map((photo) => (
                <div key={photo.id} className="flex items-start gap-3 rounded-xl bg-[var(--page)] p-3">
                  <img src={photo.previewUrl} alt="" className="h-20 w-20 flex-none rounded-lg object-cover" />
                  <div className="flex min-w-0 flex-1 flex-col gap-2">
                    <TextField
                      label="Nome da foto"
                      icon={<TagIcon className="h-4 w-4" />}
                      value={photo.label}
                      onChange={(event) => update(photo.id, { label: event.target.value })}
                    />
                    <TextField
                      label="Observação (opcional)"
                      icon={<TagIcon className="h-4 w-4" />}
                      placeholder="Ex.: Placa-mãe depois da limpeza"
                      value={photo.observation}
                      onChange={(event) => update(photo.id, { observation: event.target.value })}
                    />
                  </div>
                  <button
                    type="button"
                    aria-label="Tirar esta foto da lista"
                    onClick={() => remove(photo.id)}
                    className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-[var(--red-500)] hover:bg-[var(--red-100)]"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
          )}

          {error && <p className="mt-3 text-[13px] font-medium text-[var(--red-500)]">{error}</p>}
        </div>

        <div className="flex gap-2 p-6 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            className="h-11 flex-1 rounded-xl border border-[var(--border)] text-[13px] font-bold text-[var(--ink-soft)] disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={busy || photos.length === 0}
            className="h-11 flex-1 rounded-xl bg-[var(--blue-500)] text-[13px] font-bold text-white hover:bg-[var(--blue-700)] disabled:opacity-50"
          >
            {saving ? 'Enviando…' : photos.length ? `Salvar ${photos.length} ${photos.length === 1 ? 'foto' : 'fotos'}` : 'Salvar fotos'}
          </button>
        </div>
      </div>
    </div>
  )
}
