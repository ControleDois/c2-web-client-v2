import { useEffect, useState } from 'react'
import {
  importIfoodCatalog,
  previewIfoodCatalogImport,
  type IfoodImportPreview,
  type IfoodImportResult,
} from '../lib/ifood'
import { ApiError } from '../lib/api'
import { formatCurrency } from '../lib/format'
import { AlertTriangleIcon, CheckCircleIcon, CloseIcon } from './icons'

interface IfoodCatalogImportModalProps {
  open: boolean
  token: string
  merchantId: string | null
  merchantName: string | null
  onClose: () => void
}

function Stat({ label, value, tone }: { label: string; value: number; tone?: 'green' | 'blue' }) {
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

export function IfoodCatalogImportModal({
  open,
  token,
  merchantId,
  merchantName,
  onClose,
}: IfoodCatalogImportModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [preview, setPreview] = useState<IfoodImportPreview | null>(null)
  const [createMissing, setCreateMissing] = useState(false)
  const [importing, setImporting] = useState(false)
  const [result, setResult] = useState<IfoodImportResult | null>(null)

  useEffect(() => {
    if (!open || !merchantId) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setPreview(null)
    setResult(null)
    setCreateMissing(false)

    previewIfoodCatalogImport(token, merchantId)
      .then((res) => {
        if (!cancelled) setPreview(res)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Não foi possível ler o cardápio do iFood.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, merchantId, token])

  if (!open || !merchantId) return null

  async function handleImport() {
    if (!merchantId) return
    setImporting(true)
    setError(null)
    try {
      setResult(await importIfoodCatalog(token, merchantId, createMissing))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível importar o cardápio.')
    } finally {
      setImporting(false)
    }
  }

  const totals = preview?.totals
  const actionCount = totals ? totals.matched + (createMissing ? totals.new : 0) : 0

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      onClick={importing ? undefined : onClose}
    >
      <div
        className="max-h-[92svh] w-full max-w-[680px] overflow-y-auto rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[16px] font-bold text-[var(--ink)]">Importar cardápio do iFood</h2>
            <p className="mt-1 text-[12.5px] text-[var(--ink-soft)]">{merchantName || 'Loja conectada'}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={importing}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)] disabled:opacity-40"
            aria-label="Fechar"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {loading && <p className="py-12 text-center text-[13.5px] text-[var(--muted)]">Lendo o cardápio no iFood…</p>}

        {error && !result && <p className="mt-5 text-[13px] font-medium text-[var(--red-500)]">{error}</p>}

        {preview && totals && !result && (
          <div className="mt-5 flex flex-col gap-5">
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <Stat label="Itens no iFood" value={totals.items} />
              <Stat label="Vão ser vinculados" value={totals.matched} tone="green" />
              <Stat label="Só existem no iFood" value={totals.new} tone="blue" />
              <Stat label="Já vinculados" value={totals.already} />
            </div>

            <div className="rounded-xl bg-[var(--page)] p-4 text-[12.5px] text-[var(--ink-soft)]">
              <p className="text-[12px] font-bold tracking-wide text-[var(--muted)] uppercase">
                O que a importação faz
              </p>
              <ul className="mt-2 flex flex-col gap-1">
                <li>
                  • <b>Vincula</b> cada item do iFood ao produto do sistema (por código de barras ou nome idêntico).
                  Assim a sincronização atualiza só preço e disponibilidade do item, sem duplicar nem apagar a foto
                  dele.
                </li>
                <li>• Não altera preço, estoque nem nada no iFood. Só grava os vínculos aqui.</li>
                <li>• Fotos do iFood não são copiadas nesta versão.</li>
              </ul>
            </div>

            {totals.matched > 0 && (
              <div>
                <p className="mb-1.5 text-[12px] font-bold tracking-wide text-[var(--muted)] uppercase">
                  Vínculos encontrados ({totals.matched})
                </p>
                <div className="max-h-52 overflow-y-auto rounded-xl border border-[var(--border)]">
                  <table className="w-full text-[12.5px]">
                    <tbody>
                      {preview.matched.map((item, index) => (
                        <tr key={index} className="border-b border-[var(--border)] last:border-0">
                          <td className="px-3 py-2 text-[var(--ink)]">
                            {item.ifoodName}
                            <span className="block text-[11px] text-[var(--muted)]">
                              nosso: {item.ourName} · {item.by === 'barcode' ? 'código de barras' : 'nome'}
                            </span>
                          </td>
                          <td className="px-3 py-2 text-right text-[var(--ink-soft)]">
                            iFood {formatCurrency(item.ifoodPrice)}
                            <span className="block text-[11px] text-[var(--muted)]">
                              nosso {formatCurrency(item.ourPrice)}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {totals.new > 0 && (
              <div className="flex flex-col gap-2">
                <p className="text-[12px] font-bold tracking-wide text-[var(--muted)] uppercase">
                  Itens do iFood sem produto correspondente ({totals.new})
                </p>
                <div className="max-h-44 overflow-y-auto rounded-xl border border-[var(--border)] px-3 py-2 text-[12.5px] text-[var(--ink-soft)]">
                  {preview.unmatched.map((item, index) => (
                    <p key={index}>
                      {item.name}{' '}
                      <span className="text-[var(--muted)]">
                        · {item.category} · {formatCurrency(item.price)}
                      </span>
                    </p>
                  ))}
                </div>
                <label className="flex items-start gap-2.5 text-[13px] text-[var(--ink)]">
                  <input
                    type="checkbox"
                    checked={createMissing}
                    onChange={(event) => setCreateMissing(event.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[var(--blue-500)]"
                  />
                  <span>Criar esses itens como produtos novos (sem publicar no delivery, preço do iFood).</span>
                </label>
              </div>
            )}

            {(totals.noName > 0 || totals.noPrice > 0) && (
              <p className="flex items-start gap-1.5 text-[12.5px] text-[var(--amber-500)]">
                <AlertTriangleIcon className="mt-0.5 h-4 w-4 flex-none" />
                {totals.noName > 0 && `${totals.noName} itens sem nome não serão importados. `}
                {totals.noPrice > 0 && `${totals.noPrice} itens estão sem preço no iFood.`}
              </p>
            )}

            {error && <p className="text-[13px] font-medium text-[var(--red-500)]">{error}</p>}

            <div className="flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl px-4 py-2 text-[13.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleImport}
                disabled={importing || actionCount === 0}
                className="rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
              >
                {importing ? 'Importando…' : actionCount === 0 ? 'Nada para importar' : `Importar ${actionCount} itens`}
              </button>
            </div>
          </div>
        )}

        {result && (
          <div className="mt-5 flex flex-col gap-4">
            <div className="flex items-center gap-2 text-[14px] font-bold text-[var(--ink)]">
              <CheckCircleIcon className="h-5 w-5 text-[var(--green-600)]" /> Importação concluída
            </div>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
              <Stat label="Vinculados" value={result.linked} tone="green" />
              <Stat label="Produtos criados" value={result.created} tone="blue" />
              <Stat label="Ignorados" value={result.skipped} />
              <Stat label="Com erro" value={result.errors.length} />
            </div>
            {result.errors.length > 0 && (
              <ul className="max-h-40 overflow-y-auto rounded-xl bg-[var(--red-100)] p-3 text-[12px] text-[var(--red-500)]">
                {result.errors.slice(0, 30).map((item, index) => (
                  <li key={index}>
                    {item.name}: {item.error}
                  </li>
                ))}
              </ul>
            )}
            <div className="flex justify-end">
              <button
                type="button"
                onClick={onClose}
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
