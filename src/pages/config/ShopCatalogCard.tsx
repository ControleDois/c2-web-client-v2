import { useEffect, useState } from 'react'
import { ApiError } from '../../lib/api'
import type { AuthCompany, AuthSession } from '../../lib/auth'
import { ProductHeroImagesModal } from '../../components/ProductHeroImagesModal'
import {
  fetchShopCatalogSummary,
  publishShopCatalog,
  unpublishShopCatalog,
  type ShopCatalogSummary,
} from '../../lib/shopCatalog'

interface ShopCatalogCardProps {
  session: AuthSession
  company: AuthCompany
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-[var(--page)] px-4 py-3">
      <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <p className="mt-0.5 text-[20px] font-bold text-[var(--ink)]">{value.toLocaleString('pt-BR')}</p>
    </div>
  )
}

export function ShopCatalogCard({ session, company }: ShopCatalogCardProps) {
  const token = session.token.token
  const [summary, setSummary] = useState<ShopCatalogSummary | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [imagesOpen, setImagesOpen] = useState(false)
  const [onlyWithImage, setOnlyWithImage] = useState(true)

  function load() {
    fetchShopCatalogSummary(token, company.id)
      .then(setSummary)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível carregar o cardápio.'))
  }

  useEffect(load, [company.id, token])

  async function run(action: () => Promise<string>) {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      setMessage(await action())
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível concluir a ação.')
    } finally {
      setBusy(false)
    }
  }

  const publishCount = summary ? (onlyWithImage ? summary.publishable_with_image : summary.publishable) : 0

  function handlePublish() {
    if (!publishCount) return
    if (!window.confirm(`Publicar ${publishCount} produto(s) no cardápio online?`)) return
    run(async () => {
      const result = await publishShopCatalog(token, company.id, onlyWithImage)
      return `${result.published} produto(s) publicados no cardápio.`
    })
  }

  function handleUnpublish() {
    if (!summary?.published) return
    if (!window.confirm(`Tirar ${summary.published} produto(s) do cardápio online?`)) return
    run(async () => {
      const result = await unpublishShopCatalog(token, company.id)
      return `${result.unpublished} produto(s) saíram do cardápio.`
    })
  }

  return (
    <div className="flex flex-col gap-4">
      {summary ? (
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Stat label="Produtos" value={summary.total} />
          <Stat label="No cardápio" value={summary.published} />
          <Stat label="Prontos para publicar" value={summary.publishable} />
          <Stat label="Sem preço de delivery" value={summary.total - summary.with_price} />
        </div>
      ) : (
        !error && <p className="text-[13px] text-[var(--muted)]">Carregando…</p>
      )}

      {summary && summary.published > summary.published_with_image && (
        <p className="text-[12.5px] text-[var(--ink-soft)]">
          {summary.published - summary.published_with_image} produto(s) publicado(s) ainda estão sem foto e aparecem com
          um ícone no lugar.
        </p>
      )}

      <label className="flex items-center gap-2 text-[13px] text-[var(--ink-soft)]">
        <input
          type="checkbox"
          checked={onlyWithImage}
          onChange={(event) => setOnlyWithImage(event.target.checked)}
          className="h-4 w-4 accent-[var(--blue-500)]"
        />
        Publicar só produtos com foto
      </label>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={busy || !publishCount}
          onClick={handlePublish}
          className="rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13px] font-bold text-white hover:bg-[var(--blue-700)] disabled:opacity-50"
        >
          Publicar {publishCount ? `${publishCount} produtos` : 'produtos'}
        </button>
        <button
          type="button"
          disabled={busy || !summary?.published}
          onClick={handleUnpublish}
          className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-[13px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-50"
        >
          Tirar todos do cardápio
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => setImagesOpen(true)}
          className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-[13px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-50"
        >
          Importar fotos do Hero
        </button>
      </div>

      <ProductHeroImagesModal
        open={imagesOpen}
        session={session}
        company={company}
        onClose={() => setImagesOpen(false)}
        onImported={load}
      />

      {message && <p className="text-[12.5px] font-medium text-[var(--green-600,#16a34a)]">{message}</p>}
      {error && <p className="text-[12.5px] font-medium text-[var(--red-500)]">{error}</p>}
    </div>
  )
}
