import { useRef, useState } from 'react'
import {
  applyHeroImport,
  parseHeroSpreadsheet,
  previewHeroImport,
  type HeroRow,
  type ImportBatchResult,
  type ImportPreview,
} from '../lib/productImport'
import { ApiError } from '../lib/api'
import { formatCurrency } from '../lib/format'
import { AlertTriangleIcon, CheckCircleIcon, CloseIcon, PaperclipIcon } from './icons'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface ProductHeroImportModalProps {
  open: boolean
  session: AuthSession
  company: AuthCompany
  onClose: () => void
  onImported: () => void
}

type Step = 'select' | 'preview' | 'importing' | 'done'

const BATCH_SIZE = 100

function Stat({ label, value, tone }: { label: string; value: string | number; tone?: 'green' | 'blue' }) {
  const colors =
    tone === 'green'
      ? 'bg-[var(--green-100)] text-[var(--green-600)]'
      : tone === 'blue'
        ? 'bg-[var(--blue-100)] text-[var(--blue-500)]'
        : 'bg-[var(--page)] text-[var(--ink)]'
  return (
    <div className={`rounded-xl px-3.5 py-3 ${colors}`}>
      <p className="text-[20px] font-bold">{value}</p>
      <p className="text-[11.5px] font-semibold opacity-80">{label}</p>
    </div>
  )
}

export function ProductHeroImportModal({ open, session, company, onClose, onImported }: ProductHeroImportModalProps) {
  const fileInput = useRef<HTMLInputElement | null>(null)
  const [step, setStep] = useState<Step>('select')
  const [fileName, setFileName] = useState('')
  const [rows, setRows] = useState<HeroRow[]>([])
  const [preview, setPreview] = useState<ImportPreview | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [importStock, setImportStock] = useState(true)
  const [suspiciousAsZero, setSuspiciousAsZero] = useState(true)
  const [progress, setProgress] = useState({ done: 0, total: 0 })
  const [summary, setSummary] = useState<ImportBatchResult | null>(null)
  const [failedAt, setFailedAt] = useState<number | null>(null)

  if (!open) return null

  function reset() {
    setStep('select')
    setFileName('')
    setRows([])
    setPreview(null)
    setError(null)
    setSummary(null)
    setFailedAt(null)
    setProgress({ done: 0, total: 0 })
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
      const parsed = await parseHeroSpreadsheet(file)
      setFileName(file.name)
      setRows(parsed)
      setPreview(await previewHeroImport(session.token.token, company.id, parsed))
      setStep('preview')
    } catch (err) {
      setError(err instanceof ApiError || err instanceof Error ? err.message : 'Não foi possível ler a planilha.')
    } finally {
      setLoading(false)
    }
  }

  async function handleImport() {
    setError(null)
    setFailedAt(null)
    setStep('importing')
    setProgress({ done: 0, total: rows.length })

    const total: ImportBatchResult = {
      created: 0,
      updated: 0,
      skipped: 0,
      stockEntries: 0,
      forcedZero: 0,
      errors: [],
      stockError: null,
    }

    for (let start = 0; start < rows.length; start += BATCH_SIZE) {
      try {
        const result = await applyHeroImport(session.token.token, company.id, rows.slice(start, start + BATCH_SIZE), {
          importStock,
          suspiciousAsZero,
        })
        total.created += result.created
        total.updated += result.updated
        total.skipped += result.skipped
        total.stockEntries += result.stockEntries
        total.forcedZero += result.forcedZero
        total.errors.push(...result.errors)
        total.stockError = total.stockError || result.stockError
        setProgress({ done: Math.min(start + BATCH_SIZE, rows.length), total: rows.length })
      } catch (err) {
        setSummary(total)
        setFailedAt(start)
        setError(err instanceof ApiError ? err.message : 'A importação foi interrompida por um erro de conexão.')
        setStep('done')
        return
      }
    }

    setSummary(total)
    setStep('done')
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={handleClose}>
      <div
        className="max-h-[92svh] w-full max-w-[640px] overflow-y-auto rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[16px] font-bold text-[var(--ink)]">Importar produtos do Hero Delivery</h2>
            <p className="mt-1 text-[12.5px] text-[var(--ink-soft)]">
              Use a planilha do Hero (Produtos &gt; Exportar Produtos Cadastrados).
            </p>
          </div>
          <button
            type="button"
            onClick={handleClose}
            disabled={step === 'importing'}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)] disabled:opacity-40"
            aria-label="Fechar"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {step === 'select' && (
          <div className="mt-5">
            <label className="flex cursor-pointer flex-col items-center gap-2 rounded-2xl border-2 border-dashed border-[var(--border)] px-4 py-10 text-center hover:bg-[var(--page)]">
              <PaperclipIcon className="h-6 w-6 text-[var(--muted)]" />
              <span className="text-[13.5px] font-semibold text-[var(--ink)]">
                {loading ? 'Lendo a planilha…' : 'Escolher a planilha (.xlsx)'}
              </span>
              <span className="text-[12px] text-[var(--muted)]">
                Nada é gravado até você confirmar na próxima etapa.
              </span>
              <input
                ref={fileInput}
                type="file"
                accept=".xlsx"
                className="hidden"
                disabled={loading}
                onChange={(event) => handleFile(event.target.files?.[0])}
              />
            </label>
            {error && <p className="mt-3 text-[13px] font-medium text-[var(--red-500)]">{error}</p>}
          </div>
        )}

        {step === 'preview' && preview && (
          <div className="mt-5 flex flex-col gap-5">
            <p className="text-[12.5px] text-[var(--ink-soft)]">
              Arquivo: <b>{fileName}</b>
            </p>

            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <Stat label="Linhas lidas" value={preview.totals.valid} />
              <Stat label="Produtos novos" value={preview.totals.create} tone="green" />
              <Stat label="Já existem (atualiza)" value={preview.totals.update} tone="blue" />
              <Stat label="Categorias" value={`${preview.categories.new} novas`} />
            </div>

            <div className="rounded-xl bg-[var(--page)] p-4 text-[12.5px] text-[var(--ink-soft)]">
              <p className="text-[12px] font-bold tracking-wide text-[var(--muted)] uppercase">Como entra no sistema</p>
              <ul className="mt-2 flex flex-col gap-1">
                <li>• Preço de retirada = preço do produto; preço de entrega = preço da loja online.</li>
                <li>
                  • Produtos entram <b>sem publicar no delivery</b> (publicar exige fotos, e a planilha não traz
                  imagens).
                </li>
                <li>
                  • Estoque: {preview.stock.productsWithStock} produtos, {preview.stock.units.toLocaleString('pt-BR')}{' '}
                  unidades, custo {formatCurrency(preview.stock.costValue)}.
                </li>
              </ul>
            </div>

            <div className="flex flex-col gap-2 rounded-xl border border-[var(--amber-500)]/30 bg-[var(--amber-100)] p-4 text-[12.5px] text-[var(--ink)]">
              <p className="flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--amber-500)]">
                <AlertTriangleIcon className="h-4 w-4" /> Pontos de atenção
              </p>
              <ul className="flex flex-col gap-1">
                <li>
                  • <b>{preview.warnings.noPrice}</b> produtos sem preço (entram com preço zero).
                </li>
                <li>
                  • <b>{preview.warnings.noCategory}</b> sem categoria, <b>{preview.warnings.noBarcode}</b> sem código
                  de barras válido.
                </li>
                <li>
                  • <b>{preview.warnings.costAbovePrice}</b> com custo maior que o preço de retirada.
                </li>
                {preview.warnings.suspiciousCount > 0 && (
                  <li>
                    • <b>{preview.warnings.suspiciousCount}</b> com preço acima de R$ 500 (provável erro de digitação):{' '}
                    {preview.warnings.suspiciousPrices
                      .map((item) => `${item.name} (${formatCurrency(item.price)})`)
                      .join(' · ')}
                  </li>
                )}
                {preview.warnings.duplicates.length > 0 && (
                  <li>
                    • {preview.totals.duplicates} nomes repetidos na planilha (viram um produto só):{' '}
                    {preview.warnings.duplicates.slice(0, 6).join(' · ')}
                  </li>
                )}
                {preview.warnings.ncmNotFound.length > 0 && (
                  <li>• NCM não encontrado no cadastro: {preview.warnings.ncmNotFound.join(', ')}</li>
                )}
              </ul>
            </div>

            <div className="flex flex-col gap-2.5">
              <label className="flex items-start gap-2.5 text-[13px] text-[var(--ink)]">
                <input
                  type="checkbox"
                  checked={importStock}
                  onChange={(event) => setImportStock(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[var(--blue-500)]"
                />
                <span>
                  Lançar o estoque atual como saldo inicial (só dos produtos novos; reimportar nunca soma estoque de
                  novo).
                </span>
              </label>
              {preview.warnings.suspiciousCount > 0 && (
                <label className="flex items-start gap-2.5 text-[13px] text-[var(--ink)]">
                  <input
                    type="checkbox"
                    checked={suspiciousAsZero}
                    onChange={(event) => setSuspiciousAsZero(event.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[var(--blue-500)]"
                  />
                  <span>
                    Importar os de preço suspeito com preço zero, para corrigir antes de vender (recomendado).
                  </span>
                </label>
              )}
            </div>

            {error && <p className="text-[13px] font-medium text-[var(--red-500)]">{error}</p>}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={reset}
                className="rounded-xl px-4 py-2 text-[13.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
              >
                Trocar planilha
              </button>
              <button
                type="button"
                onClick={handleImport}
                className="rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)]"
              >
                Importar {preview.totals.valid} produtos
              </button>
            </div>
          </div>
        )}

        {step === 'importing' && (
          <div className="mt-8 mb-4 flex flex-col items-center gap-4">
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-[var(--page)]">
              <div
                className="h-full rounded-full bg-[var(--blue-500)] transition-all"
                style={{ width: `${progress.total ? (progress.done / progress.total) * 100 : 0}%` }}
              />
            </div>
            <p className="text-[13px] font-semibold text-[var(--ink)]">
              Importando… {progress.done} de {progress.total}
            </p>
            <p className="text-[12px] text-[var(--muted)]">Não feche esta janela até terminar.</p>
          </div>
        )}

        {step === 'done' && summary && (
          <div className="mt-5 flex flex-col gap-4">
            <div className="flex items-center gap-2 text-[14px] font-bold text-[var(--ink)]">
              {failedAt === null ? (
                <>
                  <CheckCircleIcon className="h-5 w-5 text-[var(--green-600)]" /> Importação concluída
                </>
              ) : (
                <>
                  <AlertTriangleIcon className="h-5 w-5 text-[var(--amber-500)]" /> Importação interrompida
                </>
              )}
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <Stat label="Criados" value={summary.created} tone="green" />
              <Stat label="Atualizados" value={summary.updated} tone="blue" />
              <Stat label="Com saldo inicial" value={summary.stockEntries} />
              <Stat label="Com erro" value={summary.errors.length} />
            </div>
            {error && (
              <p className="text-[13px] font-medium text-[var(--red-500)]">
                {error} O que já foi importado ficou salvo; é seguro enviar a mesma planilha de novo para continuar.
              </p>
            )}
            {summary.forcedZero > 0 && (
              <p className="text-[12.5px] text-[var(--ink-soft)]">
                {summary.forcedZero} produtos de preço suspeito entraram com preço zero: revise e ajuste os preços.
              </p>
            )}
            {summary.stockError && (
              <p className="text-[12.5px] font-medium text-[var(--red-500)]">
                Os produtos foram criados, mas o saldo de estoque falhou: {summary.stockError}
              </p>
            )}
            {summary.errors.length > 0 && (
              <ul className="max-h-40 overflow-y-auto rounded-xl bg-[var(--red-100)] p-3 text-[12px] text-[var(--red-500)]">
                {summary.errors.slice(0, 30).map((item, index) => (
                  <li key={index}>
                    {item.name}: {item.error}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleClose}
                className="rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)]"
              >
                Fechar
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
