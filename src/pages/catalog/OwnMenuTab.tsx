import { useCallback, useEffect, useRef, useState } from 'react'
import { ApiError } from '../../lib/api'
import type { AuthCompany, AuthSession } from '../../lib/auth'
import {
  deleteOwnMenuImage,
  fetchOwnMenuItems,
  saveOwnMenuItem,
  uploadOwnMenuImage,
  type OwnMenuItem,
} from '../../lib/catalog'
import { formatCurrency } from '../../lib/format'
import { parseMoney } from '../../lib/money'
import { MoneyField } from '../../components/form/MoneyField'
import { TextField } from '../../components/form/TextField'
import { BoxIcon, CameraIcon, CloseIcon, DollarSignIcon, PencilIcon, SearchIcon, TagIcon, TrashIcon } from '../../components/icons'

interface OwnMenuTabProps {
  session: AuthSession
  company: AuthCompany
}

interface Form {
  item: OwnMenuItem
  active: boolean
  name: string
  description: string
  price: string
}

export function OwnMenuTab({ session, company }: OwnMenuTabProps) {
  const token = session.token.token
  const [items, setItems] = useState<OwnMenuItem[]>([])
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<'all' | 'menu' | 'out'>('all')
  const [error, setError] = useState<string | null>(null)
  const [form, setForm] = useState<Form | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const load = useCallback(async () => {
    try {
      setItems(await fetchOwnMenuItems(token, company.id, search.trim()))
      setError(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os produtos.')
    }
  }, [token, company.id, search])

  useEffect(() => {
    const timer = setTimeout(load, search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [load, search])

  const visible = items.filter((item) =>
    filter === 'all' ? true : filter === 'menu' ? item.shop.active : !item.shop.active
  )

  function openEdit(item: OwnMenuItem) {
    setFormError(null)
    setForm({
      item,
      active: item.shop.active,
      name: item.shop.name || item.name,
      description: item.shop.description,
      price: String(item.shop.price ?? item.product_price ?? ''),
    })
  }

  async function persist(current: Form) {
    const price = parseMoney(current.price)
    await saveOwnMenuItem(token, company.id, current.item.product_id, {
      active: current.active,
      name: current.name,
      description: current.description,
      price: price !== null && price > 0 ? price : null,
    })
  }

  async function refresh(productId: string) {
    const fresh = (await fetchOwnMenuItems(token, company.id, '')).find((entry) => entry.product_id === productId)
    await load()
    if (fresh) setForm((current) => (current ? { ...current, item: fresh } : current))
  }

  async function handleSave() {
    if (!form) return
    setSaving(true)
    setFormError(null)
    try {
      await persist(form)
      setForm(null)
      await load()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível salvar o produto.')
    } finally {
      setSaving(false)
    }
  }

  async function handleUpload(files: FileList | null) {
    if (!files?.length || !form) return
    setSaving(true)
    setFormError(null)
    try {
      for (const file of Array.from(files)) {
        await uploadOwnMenuImage(token, company.id, form.item.product_id, file)
      }
      await refresh(form.item.product_id)
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível enviar a foto.')
    } finally {
      setSaving(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function handleDeleteImage(imageId: string) {
    if (!form) return
    setSaving(true)
    try {
      await deleteOwnMenuImage(token, company.id, form.item.product_id, imageId)
      await refresh(form.item.product_id)
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível remover a foto.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <p className="text-[13px] text-[var(--ink-soft)]">
        É o cardápio da sua loja online e a base dos outros canais: o iFood herda daqui o que você não mudar nele.
      </p>

      <div className="flex flex-wrap items-center gap-3">
        <div className="flex min-w-[240px] flex-1 items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
          <SearchIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
          <input
            type="text"
            placeholder="Buscar produto"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            className="w-full bg-transparent text-[13.5px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
          />
        </div>
        {([['all', 'Todos'], ['menu', 'No cardápio'], ['out', 'Fora do cardápio']] as const).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded-xl px-3.5 py-2 text-[12.5px] font-bold ${
              filter === value
                ? 'bg-[var(--blue-500)] text-white'
                : 'bg-[var(--surface)] text-[var(--ink-soft)] ring-1 ring-[var(--border)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && <p className="rounded-xl bg-[var(--red-100)] px-4 py-3 text-[13px] font-medium text-[var(--red-500)]">{error}</p>}

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--card-shadow)]">
        {visible.length === 0 ? (
          <p className="py-12 text-center text-[13.5px] text-[var(--muted)]">Nenhum produto encontrado.</p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {visible.map((item) => {
              const cover = item.shop.images[0]?.url
              return (
                <li key={item.product_id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                  {cover ? (
                    <img src={cover} alt="" className="h-12 w-12 flex-none rounded-lg object-cover" />
                  ) : (
                    <span className="flex h-12 w-12 flex-none items-center justify-center rounded-lg bg-[var(--page)] text-[var(--muted)]">
                      <BoxIcon className="h-5 w-5" />
                    </span>
                  )}
                  <div className="min-w-0 flex-1 basis-[200px]">
                    <p className="truncate text-[14px] font-bold text-[var(--ink)]">{item.shop.name || item.name}</p>
                    <p className="mt-0.5 text-[12px] text-[var(--ink-soft)]">
                      Estoque: {item.stock.toLocaleString('pt-BR')}
                      {item.stock <= 0 && <span className="font-bold text-[var(--red-500)]"> (zerado)</span>}
                      {item.shop.active && item.shop.images.length === 0 && (
                        <span className="font-bold text-[var(--amber-700,#b45309)]"> · sem foto</span>
                      )}
                    </p>
                  </div>
                  <p className="w-[100px] text-right text-[14px] font-bold text-[var(--ink)]">
                    {formatCurrency(item.shop.price ?? item.product_price)}
                  </p>
                  <span
                    className={`rounded-full px-3 py-1 text-[11.5px] font-bold ${
                      item.shop.active
                        ? 'bg-[var(--green-100)] text-[var(--green-600)]'
                        : 'bg-[var(--page)] text-[var(--muted)]'
                    }`}
                  >
                    {item.shop.active ? 'No cardápio' : 'Fora do cardápio'}
                  </span>
                  <button
                    type="button"
                    onClick={() => openEdit(item)}
                    aria-label="Editar no cardápio"
                    className="rounded-lg p-2 text-[var(--ink-soft)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
                  >
                    <PencilIcon className="h-4 w-4" />
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      {form && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={saving ? undefined : () => setForm(null)}>
          <div
            className="max-h-[92vh] w-full max-w-[560px] overflow-y-auto rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-[15px] font-bold text-[var(--ink)]">{form.item.name}</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--ink-soft)]">Como o produto aparece no cardápio próprio.</p>

            <div className="mt-4 flex flex-col gap-4">
              <label className="flex items-center gap-2.5 text-[13px] text-[var(--ink)]">
                <input
                  type="checkbox"
                  checked={form.active}
                  onChange={(event) => setForm({ ...form, active: event.target.checked })}
                  className="h-4 w-4 accent-[var(--blue-500)]"
                />
                Mostrar no cardápio
              </label>
              <TextField
                label="Nome no cardápio"
                icon={<TagIcon className="h-4 w-4" />}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder={form.item.name}
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold text-[var(--ink-soft)]">Descrição</label>
                <textarea
                  value={form.description}
                  rows={3}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  className="rounded-xl bg-[var(--page)] px-3.5 py-3 text-[14px] text-[var(--ink)] focus:outline-none"
                />
              </div>
              <MoneyField
                label={`Preço no cardápio (cadastro: ${formatCurrency(form.item.product_price)})`}
                icon={<DollarSignIcon className="h-4 w-4" />}
                value={form.price}
                onChange={(event) => setForm({ ...form, price: event.target.value })}
              />
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-[12px] font-semibold text-[var(--ink-soft)]">Fotos (até 8)</label>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => fileInput.current?.click()}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-bold text-[var(--blue-500)] hover:bg-[var(--page)] disabled:opacity-60"
                  >
                    <CameraIcon className="h-4 w-4" />
                    Adicionar foto
                  </button>
                  <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" multiple hidden onChange={(event) => handleUpload(event.target.files)} />
                </div>
                {form.item.shop.images.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {form.item.shop.images.map((image) => (
                      <div key={image.id} className="relative">
                        <img src={image.url} alt="" className="h-20 w-20 rounded-lg object-cover" />
                        <button
                          type="button"
                          onClick={() => handleDeleteImage(image.id)}
                          aria-label="Remover foto"
                          className="absolute -right-1.5 -top-1.5 rounded-full bg-[var(--surface)] p-1 text-[var(--red-500)] shadow ring-1 ring-[var(--border)]"
                        >
                          <TrashIcon className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-[12px] text-[var(--muted)]">Sem fotos ainda.</p>
                )}
              </div>
            </div>

            {formError && <p className="mt-3 text-[13px] font-medium text-[var(--red-500)]">{formError}</p>}
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setForm(null)}
                disabled={saving}
                className="flex items-center gap-1.5 rounded-xl px-4 py-2 text-[13.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-60"
              >
                <CloseIcon className="h-4 w-4" />
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl bg-[var(--blue-500)] px-4 py-2 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
              >
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
