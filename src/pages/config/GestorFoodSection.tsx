import { useState } from 'react'
import { ApiError } from '../../lib/api'
import type { ConfigRecord } from '../../lib/config'
import { importGestorFood, previewGestorFood, type GestorFoodImportResult, type GestorFoodPreview } from '../../lib/gestorfood'
import { SectionCard } from '../../components/SectionCard'
import { TextField } from '../../components/form/TextField'
import { LinkIcon } from '../../components/icons'
import type { AuthCompany, AuthSession } from '../../lib/auth'

interface GestorFoodSectionProps {
  config: ConfigRecord | null
  session: AuthSession
  company: AuthCompany
}

export function GestorFoodSection({ config, session, company }: GestorFoodSectionProps) {
  const saved = (config as { gestorfood_link?: string | null } | null)?.gestorfood_link ?? ''
  const [link, setLink] = useState(saved)
  const [preview, setPreview] = useState<GestorFoodPreview | null>(null)
  const [result, setResult] = useState<GestorFoodImportResult | null>(null)
  const [busy, setBusy] = useState<'preview' | 'import' | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function check() {
    setBusy('preview')
    setError(null)
    setResult(null)
    try {
      setPreview(await previewGestorFood(session.token.token, company.id, link))
    } catch (err) {
      setPreview(null)
      setError(err instanceof ApiError ? err.message : 'Não foi possível consultar o Gestor Food.')
    } finally {
      setBusy(null)
    }
  }

  async function runImport() {
    setBusy('import')
    setError(null)
    try {
      const imported = await importGestorFood(session.token.token, company.id, link)
      setResult(imported)
      setLink(imported.link)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível importar o cardápio.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title="Gestor Food" subtitle="Cardápio importado do Gestor Food e pedidos do totem enviados para lá">
        <div className="flex flex-col gap-4">
          <p className="text-[12.5px] text-[var(--ink-soft)]">
            Informe o link da loja no Gestor Food: o nome que aparece depois de <b>shop.gestorfood.com/</b> (ex.: grand-bar). A
            importação traz as categorias, os produtos com preço e foto e os complementos para o cadastro desta empresa e os
            publica na Loja Online. Importar de novo atualiza os mesmos produtos (não duplica). Depois de importado, o totem
            envia cada pedido pago para o Gestor Food.
          </p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="min-w-[260px] flex-1">
              <TextField
                label="Link da loja no Gestor Food"
                icon={<LinkIcon className="h-4 w-4" />}
                placeholder="grand-bar"
                value={link}
                onChange={(event) => {
                  setLink(event.target.value)
                  setPreview(null)
                }}
              />
            </div>
            <button
              type="button"
              onClick={check}
              disabled={!link.trim() || busy !== null}
              className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-[13.5px] font-semibold text-[var(--ink)] disabled:opacity-50"
            >
              {busy === 'preview' ? 'Verificando…' : 'Verificar'}
            </button>
            <button
              type="button"
              onClick={runImport}
              disabled={!link.trim() || busy !== null}
              className="rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white disabled:opacity-50"
            >
              {busy === 'import' ? 'Importando…' : 'Importar cardápio'}
            </button>
          </div>

          {saved && <p className="text-[12px] text-[var(--muted)]">Integração ativa com a loja “{saved}”.</p>}

          {preview && (
            <div className="rounded-xl bg-[var(--page)] p-4 text-[13.5px] text-[var(--ink)]">
              <b>{preview.name}</b>
              <span className="block text-[12.5px] text-[var(--ink-soft)]">
                CNPJ {preview.document || '—'} · {preview.categories} categorias · {preview.products} produtos
              </span>
            </div>
          )}

          {result && (
            <div className="rounded-xl bg-[var(--green-100)] p-4 text-[13.5px] text-[var(--ink)]">
              <b>Cardápio de “{result.store}” importado.</b>
              <span className="block">
                {result.products} produtos ({result.created} novos, {result.updated} atualizados) em {result.categories} categorias, com{' '}
                {result.complements} grupos de complementos.
                {result.deactivated > 0 ? ` ${result.deactivated} produto(s) que saíram do Gestor Food foram tirados da loja.` : ''}
              </span>
              {result.withoutNcm.length > 0 && (
                <span className="mt-2 block text-[var(--amber-500)]">
                  <b>{result.withoutNcm.length} produto(s) sem NCM</b>: complete o cadastro fiscal deles para a NFC-e ser autorizada
                  ({result.withoutNcm.slice(0, 8).join(', ')}
                  {result.withoutNcm.length > 8 ? '…' : ''}).
                </span>
              )}
            </div>
          )}

          {error && <p className="rounded-xl bg-[var(--red-100)] p-3 text-[13px] font-medium text-[var(--red-500)]">{error}</p>}
        </div>
      </SectionCard>
    </div>
  )
}
