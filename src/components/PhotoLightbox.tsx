import { useCallback, useEffect, useRef } from 'react'
import { ChevronLeftIcon, ChevronRightIcon, CloseIcon } from './icons'

export interface LightboxPhoto {
  url: string
  title?: string | null
  subtitle?: string | null
  // Link para abrir a localização da foto no mapa, quando existir.
  mapUrl?: string | null
}

interface PhotoLightboxProps {
  photos: LightboxPhoto[]
  index: number | null
  onIndexChange: (index: number) => void
  onClose: () => void
}

const SWIPE_MIN_PX = 50

// Slide de fotos em tela cheia: setas (e teclado ←/→) para ir e voltar,
// deslizar o dedo no celular, e a legenda de cada foto embaixo.
export function PhotoLightbox({ photos, index, onIndexChange, onClose }: PhotoLightboxProps) {
  const touchStartX = useRef<number | null>(null)
  const open = index !== null && photos.length > 0

  const go = useCallback(
    (delta: number) => {
      if (index === null || photos.length === 0) return
      onIndexChange((index + delta + photos.length) % photos.length)
    },
    [index, photos.length, onIndexChange]
  )

  useEffect(() => {
    if (!open) return
    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
      else if (event.key === 'ArrowLeft') go(-1)
      else if (event.key === 'ArrowRight') go(1)
    }
    window.addEventListener('keydown', onKey)
    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', onKey)
    }
  }, [open, go, onClose])

  if (!open || index === null) return null
  const photo = photos[index]
  if (!photo) return null

  return (
    <div
      className="fixed inset-0 z-[70] flex flex-col bg-black/95"
      onClick={onClose}
      onTouchStart={(event) => {
        touchStartX.current = event.touches[0]?.clientX ?? null
      }}
      onTouchEnd={(event) => {
        const start = touchStartX.current
        touchStartX.current = null
        const end = event.changedTouches[0]?.clientX
        if (start === null || end === undefined) return
        if (end - start > SWIPE_MIN_PX) go(-1)
        else if (start - end > SWIPE_MIN_PX) go(1)
      }}
    >
      <div className="flex flex-none items-center justify-between px-4 py-3 text-white">
        <span className="text-[13px] font-semibold opacity-80">
          {index + 1} / {photos.length}
        </span>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onClose()
          }}
          aria-label="Fechar"
          className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 hover:bg-white/20"
        >
          <CloseIcon className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex min-h-0 flex-1 items-center justify-center px-2 sm:px-14">
        <img
          key={photo.url}
          src={photo.url}
          alt={photo.title ?? ''}
          onClick={(event) => event.stopPropagation()}
          className="max-h-full max-w-full rounded-lg object-contain"
        />
        {photos.length > 1 && (
          <>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                go(-1)
              }}
              aria-label="Foto anterior"
              className="absolute top-1/2 left-2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30 sm:left-3"
            >
              <ChevronLeftIcon className="h-6 w-6" />
            </button>
            <button
              type="button"
              onClick={(event) => {
                event.stopPropagation()
                go(1)
              }}
              aria-label="Próxima foto"
              className="absolute top-1/2 right-2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/15 text-white hover:bg-white/30 sm:right-3"
            >
              <ChevronRightIcon className="h-6 w-6" />
            </button>
          </>
        )}
      </div>

      <div className="flex-none px-5 py-4 text-center text-white" onClick={(event) => event.stopPropagation()}>
        {photo.title ? (
          <p className="text-[15px] font-bold">{photo.title}</p>
        ) : (
          <p className="text-[13px] opacity-60">Sem legenda</p>
        )}
        {photo.subtitle && <p className="mt-1 text-[13px] whitespace-pre-line opacity-80">{photo.subtitle}</p>}
        {photo.mapUrl && (
          <a
            href={photo.mapUrl}
            target="_blank"
            rel="noreferrer"
            className="mt-1.5 inline-block text-[12.5px] font-semibold text-[var(--blue-300)] hover:underline"
          >
            Ver local no mapa
          </a>
        )}
      </div>
    </div>
  )
}
