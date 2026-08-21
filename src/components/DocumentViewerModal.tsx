import { useEffect, useState } from 'react'
import { downloadFromUrl, isImageUrl, isPdfUrl } from '../lib/download'
import { CloseIcon, ChevronLeftIcon, ChevronRightIcon, DownloadIcon, FileTextIcon } from './icons'

export interface DocumentViewerItem {
  title: string
  description?: string | null
  url: string
  fileName?: string | null
  type?: 'pdf' | 'image'
}

interface DocumentViewerModalProps {
  documents: DocumentViewerItem[]
  index: number
  onClose: () => void
  onIndexChange: (index: number) => void
}

export function DocumentViewerModal({ documents, index, onClose, onIndexChange }: DocumentViewerModalProps) {
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)

  const doc = documents[index]

  useEffect(() => {
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
      if (event.key === 'ArrowRight') onIndexChange((index + 1) % documents.length)
      if (event.key === 'ArrowLeft') onIndexChange((index - 1 + documents.length) % documents.length)
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [index, documents.length, onClose, onIndexChange])

  if (!doc) return null

  async function handleDownload() {
    setDownloading(true)
    setDownloadError(null)
    try {
      await downloadFromUrl(doc.url, doc.fileName || `${doc.title || 'documento'}`)
    } catch {
      setDownloadError('Não foi possível baixar o arquivo.')
    } finally {
      setDownloading(false)
    }
  }

  const isPdf = doc.type === 'pdf' || (!doc.type && isPdfUrl(doc.url))
  const isImage = doc.type === 'image' || (!doc.type && isImageUrl(doc.url))

  return (
    <div className="fixed inset-0 z-[60] flex flex-col bg-black/95">
      <div className="flex items-center justify-between px-5 py-4">
        <div className="min-w-0">
          <p className="truncate text-[14px] font-bold text-white">{doc.title || 'Documento'}</p>
          {doc.description && <p className="truncate text-[12px] text-white/60">{doc.description}</p>}
        </div>
        <div className="flex flex-none items-center gap-2">
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-2 text-[12.5px] font-semibold text-white transition hover:bg-white/20 disabled:opacity-60"
          >
            <DownloadIcon className="h-4 w-4" />
            {downloading ? 'Baixando…' : 'Baixar'}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-white/10 p-2 text-white hover:bg-white/20"
            aria-label="Fechar"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>
      </div>

      <div className="relative flex flex-1 items-center justify-center overflow-hidden px-4 pb-6">
        {documents.length > 1 && (
          <button
            type="button"
            onClick={() => onIndexChange((index - 1 + documents.length) % documents.length)}
            className="absolute left-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20 sm:left-6"
          >
            <ChevronLeftIcon className="h-5 w-5" />
          </button>
        )}

        {isImage ? (
          <img src={doc.url} alt={doc.title} className="max-h-full max-w-full rounded-lg object-contain" />
        ) : isPdf ? (
          <iframe title={doc.title} src={doc.url} className="h-full w-full max-w-4xl rounded-lg bg-white" />
        ) : (
          <div className="flex flex-col items-center gap-3 text-white/70">
            <FileTextIcon className="h-12 w-12" />
            <p className="text-[13.5px]">Não é possível pré-visualizar este arquivo.</p>
            <button
              type="button"
              onClick={handleDownload}
              className="flex items-center gap-2 rounded-xl bg-white/10 px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-white/20"
            >
              <DownloadIcon className="h-4 w-4" />
              Baixar arquivo
            </button>
          </div>
        )}

        {documents.length > 1 && (
          <button
            type="button"
            onClick={() => onIndexChange((index + 1) % documents.length)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-full bg-white/10 p-2.5 text-white hover:bg-white/20 sm:right-6"
          >
            <ChevronRightIcon className="h-5 w-5" />
          </button>
        )}
      </div>

      {documents.length > 1 && (
        <p className="pb-4 text-center text-[12px] text-white/60">
          {index + 1} / {documents.length}
        </p>
      )}

      {downloadError && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 rounded-xl bg-[var(--red-500)] px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg">
          {downloadError}
        </div>
      )}
    </div>
  )
}
