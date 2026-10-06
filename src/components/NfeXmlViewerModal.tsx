import { useMemo, useState } from 'react'
import { CloseIcon, CopyIcon, DownloadIcon } from './icons'

interface NfeXmlViewerModalProps {
  title: string
  xml: string
  onDownload: () => void
  onClose: () => void
}

// Indenta o XML (a SEFAZ devolve numa linha só) para ficar legível na tela.
function formatXml(xml: string): string {
  const parts = xml.replace(/>\s*</g, '>\n<').split('\n')
  let depth = 0
  return parts
    .map((line) => {
      const trimmed = line.trim()
      if (/^<\//.test(trimmed)) depth = Math.max(depth - 1, 0)
      const indented = `${'  '.repeat(depth)}${trimmed}`
      const opensOnly = /^<[^!?/][^>]*[^/]>$/.test(trimmed) && !/<\/[^>]+>$/.test(trimmed)
      if (opensOnly) depth += 1
      return indented
    })
    .join('\n')
}

export function NfeXmlViewerModal({ title, xml, onDownload, onClose }: NfeXmlViewerModalProps) {
  const [copied, setCopied] = useState(false)
  const formatted = useMemo(() => formatXml(xml), [xml])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(xml)
      setCopied(true)
      setTimeout(() => setCopied(false), 1600)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[88vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-[var(--surface)] shadow-[var(--card-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <h2 className="text-[15px] font-bold text-[var(--ink)]">{title}</h2>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCopy}
              className="flex items-center gap-1.5 rounded-xl bg-[var(--page)] px-3 py-2 text-[12.5px] font-bold text-[var(--blue-700)] hover:bg-[var(--blue-100)]"
            >
              <CopyIcon className="h-3.5 w-3.5" />
              {copied ? 'Copiado!' : 'Copiar'}
            </button>
            <button
              type="button"
              onClick={onDownload}
              className="flex items-center gap-1.5 rounded-xl bg-[var(--page)] px-3 py-2 text-[12.5px] font-bold text-[var(--blue-700)] hover:bg-[var(--blue-100)]"
            >
              <DownloadIcon className="h-3.5 w-3.5" />
              Baixar
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Fechar"
              className="rounded-xl p-2 text-[var(--ink-soft)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
            >
              <CloseIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
        <pre className="m-0 flex-1 overflow-auto bg-[var(--page)] p-5 text-[12px] leading-relaxed text-[var(--ink)]">
          {formatted}
        </pre>
      </div>
    </div>
  )
}
