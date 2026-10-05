import { useRef, useState } from 'react'
import {
  applyHeroImages,
  parseHeroImagesFile,
  previewHeroImages,
  type HeroImagePreview,
  type HeroImageRow,
} from '../lib/productImport'
import { ApiError } from '../lib/api'
import { CheckCircleIcon, CloseIcon, PaperclipIcon } from './icons'
import type { AuthCompany, AuthSession } from '../lib/auth'

interface ProductHeroImagesModalProps {
  open: boolean
  session: AuthSession
  company: AuthCompany
  onClose: () => void
  onImported: () => void
}

type Step = 'select' | 'preview' | 'importing' | 'done'

const BATCH_SIZE = 40

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-[var(--page)] px-3.5 py-3">
      <p className="text-[20px] font-bold text-[var(--ink)]">{value.toLocaleString('pt-BR')}</p>
      <p className="text-[11.5px] font-semibold text-[var(--ink-soft)]">{label}</p>
    </div>
  )
}

export function ProductHeroImagesModal({ open, session, company, onClose, onImported }: ProductHeroImagesModalProps) {
  const token = session.token.token
  const fileInput = useRef<HTMLInputElement | null>(null)
  const [step, setStep] = useState<Step>('select')
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<HeroImageRow[]>([])
  const [preview, setPreview] = useState<HeroImagePreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [imported, setImported] = useState(0)
  const [failed, setFailed] = useState<{ name: string; reason: string }[]>([])

  if (!open) return null

  function reset() {
    setStep('select')
    setFileName('')
    setRows([])
    setPreview(null)
    setError(null)
    setProgress({ done: 0, total: 0 })
    setImported(0)
    setFailed([])
    if (fileInput.current) fileInput.current.value = ''
  }

  function handleClose() {
    if (step === 'importing') return
    if (step === 'done') onImported()
    reset()
    onClose()
  }

  async function handleFile(file: File | undefined) {
    if (!file) return
    setError(null)
    setLoading(true)
    try {
      const parsed = await parseHeroImagesFile(file)
      if (!parsed.length) throw new Error('O arquivo não tem nenhuma foto.')
      setRows(parsed)
      setFileName(file.name)
      setPreview(await previewHeroImages(token, company.id, parsed))
      setStep('preview')
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Não foi possível ler o arquivo de fotos.'
      )
    } finally {
      setLoading(false)
    }
  }

  async function handleImport() {
    setStep('importing')
    setError(null)
    setProgress({ done: 0, total: rows.length })
    let importedTotal = 0
    const failures: { name: string; reason: string }[] = []

    try {
      for (let start = 0; start < rows.length; start += BATCH_SIZE) {
        const result = await applyHeroImages(token, company.id, rows.slice(start, start + BATCH_SIZE))
        importedTotal += result.imported
        failures.push(...result.failed)
        setImported(importedTotal)
        setFailed([...failures])
        setProgress({ done: Math.min(start + BATCH_SIZE, rows.length), total: rows.length })
      }
      setStep('done')
    } catch (err) {
      setError(
        `${err instanceof ApiError ? err.message : 'A importação foi interrompida.'} Você pode reabrir e continuar: o que já foi importado não é repetido.`
      )
      setStep('preview')
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={handleClose}>
      <div
        className="max-h-[90svh] w-full max-w-[520px] overflow-y-auto rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[15px] font-bold text-[var(--ink)]">Importar fotos do Hero</h2>
            <p className="mt-1 text-[12.5px] text-[var(--ink-soft)]">
              Baixa as fotos do Hero e liga cada uma ao produto de mesmo nome ou código de barras.
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            aria-label="Fechar"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)]"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {step === 'select' && (
          <div className="mt-5">
            <label className="flex cursor-pointer items-center gap-2 rounded-xl border border-dashed border-[var(--border)] px-4 py-5 text-[13px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]">
              <PaperclipIcon className="h-4 w-4 flex-none" />
              {loading ? 'Lendo arquivo…' : 'Selecionar o arquivo de fotos (.json)'}
              <input
                ref={fileInput}
                type="file"
                accept=".json,application/json"
                className="hidden"
                disabled={loading}
                onChange={(event) => handleFile(event.target.files?.[0])}
              />
            </label>
          </div>
        )}

        {step === 'preview' && preview && (
          <div className="mt-5 flex flex-col gap-4">
            <p className="text-[12.5px] text-[var(--ink-soft)]">Arquivo: {fileName}</p>
            <div className="grid grid-cols-2 gap-3">
              <Stat label="Fotos que serão importadas" value={preview.willImport} />
              <Stat label="Produtos que já têm foto" value={preview.alreadyHasImage} />
              <Stat label="Sem produto correspondente" value={preview.noMatch} />
              <Stat label="Fotos no arquivo" value={preview.total} />
            </div>
            {preview.noShop > 0 && (
              <p className="text-[12.5px] text-[var(--ink-soft)]">
                {preview.noShop} produto(s) não têm cadastro de loja online e ficam de fora.
              </p>
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={reset}
                className="h-11 flex-1 rounded-xl border border-[var(--border)] text-[13px] font-bold text-[var(--ink-soft)]"
              >
                Trocar arquivo
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={preview.willImport === 0}
                className="h-11 flex-1 rounded-xl bg-[var(--blue-500)] text-[13px] font-bold text-white hover:bg-[var(--blue-700)] disabled:opacity-50"
              >
                Importar {preview.willImport} foto(s)
              </button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="mt-6 flex flex-col gap-3">
            <p className="text-[13px] font-semibold text-[var(--ink)]">
              Baixando fotos… {progress.done} de {progress.total}
            </p>
            <div className="h-2 overflow-hidden rounded-full bg-[var(--page)]">
              <div
                className="h-full bg-[var(--blue-500)] transition-all"
                style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
              />
            </div>
            <p className="text-[12px] text-[var(--muted)]">Não feche esta janela até terminar.</p>
          </div>
        )}

        {step === 'done' && (
          <div className="mt-6 flex flex-col gap-3">
            <p className="flex items-center gap-2 text-[14px] font-bold text-[var(--green-600)]">
              <CheckCircleIcon className="h-5 w-5" />
              {imported} foto(s) importada(s)
            </p>
            {failed.length > 0 && (
              <div className="rounded-xl bg-[var(--red-100)] px-4 py-3 text-[12.5px] text-[var(--red-500)]">
                <p className="font-bold">{failed.length} não puderam ser baixadas:</p>
                <ul className="mt-1 max-h-32 list-disc overflow-y-auto pl-4">
                  {failed.slice(0, 20).map((item, index) => (
                    <li key={index}>
                      {item.name} — {item.reason}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            <button
              type="button"
              onClick={handleClose}
              className="h-11 rounded-xl bg-[var(--blue-500)] text-[13px] font-bold text-white hover:bg-[var(--blue-700)]"
            >
              Concluir
            </button>
          </div>
        )}

        {error && <p className="mt-4 text-[13px] font-medium text-[var(--red-500)]">{error}</p>}
      </div>
    </div>
  )
}
