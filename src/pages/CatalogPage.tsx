import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ApiError } from '../lib/api'
import type { AuthCompany, AuthSession } from '../lib/auth'
import {
  PRICE_ROUNDING_LABELS,
  createIfoodCategory,
  deleteCatalogImage,
  fetchCatalogChannels,
  fetchIfoodCategories,
  setIfoodDefaultCategory,
  fetchCatalogItems,
  saveCatalogChannel,
  saveCatalogItem,
  syncCatalogChannel,
  uploadCatalogImage,
  type CatalogChannel,
  type CatalogChannelsResponse,
  type CatalogItem,
  type IfoodCategory,
  type PriceRounding,
} from '../lib/catalog'
import { formatCurrency, formatDateTime } from '../lib/format'
import { parseMoney } from '../lib/money'
import { MoneyField } from '../components/form/MoneyField'
import { TextField } from '../components/form/TextField'
import { OwnMenuTab } from './catalog/OwnMenuTab'
import { BoxIcon, CameraIcon, CloseIcon, DollarSignIcon, PencilIcon, RefreshIcon, SearchIcon, TagIcon, TrashIcon } from '../components/icons'

interface CatalogPageProps {
  session: AuthSession
  company: AuthCompany
}

interface EditForm {
  item: CatalogItem
  active: 'inherit' | 'on' | 'off'
  name: string
  description: string
  price: string
  categoryId: string
}

const PRICE_SOURCE_LABELS = { override: 'Preço próprio', rule: 'Pela regra do canal', same: 'Igual ao cardápio' } as const

function Notice({ tone, children }: { tone: 'error' | 'ok'; children: React.ReactNode }) {
  const style =
    tone === 'error'
      ? 'bg-[var(--red-100)] text-[var(--red-500)]'
      : 'bg-[var(--green-100)] text-[var(--green-600)]'
  return <p className={`rounded-xl px-4 py-3 text-[13px] font-medium ${style}`}>{children}</p>
}

function SyncChip({ item }: { item: CatalogItem }) {
  if (item.sync.status === 'error') {
    return (
      <span title={item.sync.error ?? ''} className="rounded-full bg-[var(--red-100)] px-2.5 py-1 text-[11px] font-bold text-[var(--red-500)]">
        Erro no envio
      </span>
    )
  }
  if (item.sync.pending) {
    return (
      <span className="rounded-full bg-[var(--amber-100,#fef3c7)] px-2.5 py-1 text-[11px] font-bold text-[var(--amber-700,#b45309)]">
        {item.external ? 'Alteração a enviar' : 'Não enviado'}
      </span>
    )
  }
  return (
    <span
      title={item.sync.at ? `Enviado em ${formatDateTime(item.sync.at)}` : ''}
      className="rounded-full bg-[var(--green-100)] px-2.5 py-1 text-[11px] font-bold text-[var(--green-600)]"
    >
      Em dia
    </span>
  )
}

export function CatalogPage({ session, company }: CatalogPageProps) {
  const token = session.token.token
  const [overview, setOverview] = useState<CatalogChannelsResponse | null>(null)
  const [channelId, setChannelId] = useState<string>('own')
  const [items, setItems] = useState<CatalogItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [busy, setBusy] = useState(false)
  const [rule, setRule] = useState<{ percent: string; rounding: PriceRounding }>({ percent: '0', rounding: 'none' })
  const [categories, setCategories] = useState<IfoodCategory[]>([])
  const [defaultCategoryId, setDefaultCategoryId] = useState<string | null>(null)
  const [newCategory, setNewCategory] = useState('')
  const [form, setForm] = useState<EditForm | null>(null)
  const [formError, setFormError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const fileInput = useRef<HTMLInputElement>(null)

  const channel: CatalogChannel | null = useMemo(
    () => overview?.channels.find((entry) => entry.id === channelId) ?? null,
    [overview, channelId]
  )

  const loadOverview = useCallback(async () => {
    try {
      const data = await fetchCatalogChannels(token, company.id)
      setOverview(data)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os canais.')
    } finally {
      setLoading(false)
    }
  }, [token, company.id])

  const loadItems = useCallback(async () => {
    if (channelId === 'own') return
    try {
      setItems(await fetchCatalogItems(token, channelId, search.trim()))
      setError(null)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar o catálogo.')
    }
  }, [token, channelId, search])

  useEffect(() => {
    setLoading(true)
    loadOverview()
  }, [loadOverview])

  useEffect(() => {
    if (channel) setRule({ percent: String(channel.price_percent), rounding: channel.price_rounding })
  }, [channel?.id, channel?.price_percent, channel?.price_rounding]) // eslint-disable-line react-hooks/exhaustive-deps

  const loadCategories = useCallback(async () => {
    if (!channelId || channelId === 'own') return
    try {
      const data = await fetchIfoodCategories(token, channelId)
      setCategories(data.categories)
      setDefaultCategoryId(data.default_category_id)
    } catch (err) {
      setCategories([])
      setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as categorias do iFood.')
    }
  }, [token, channelId])

  useEffect(() => {
    setCategories([])
    setDefaultCategoryId(null)
    loadCategories()
  }, [loadCategories])

  useEffect(() => {
    const timer = setTimeout(loadItems, search ? 300 : 0)
    return () => clearTimeout(timer)
  }, [loadItems, search])

  const pendingCount = items.filter((item) => item.sync.pending).length

  async function run(action: () => Promise<string>) {
    setBusy(true)
    setError(null)
    setMessage(null)
    try {
      setMessage(await action())
      await loadItems()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível concluir a ação.')
    } finally {
      setBusy(false)
    }
  }

  async function handleCreateCategory() {
    if (!channel || !newCategory.trim()) return
    await run(async () => {
      const created = await createIfoodCategory(token, channel.id, newCategory.trim(), true)
      setNewCategory('')
      await loadCategories()
      return `Categoria "${created.name}" criada no iFood e definida como padrão.`
    })
  }

  async function handleDefaultCategory(categoryId: string) {
    if (!channel) return
    await run(async () => {
      await setIfoodDefaultCategory(token, channel.id, categoryId || null)
      setDefaultCategoryId(categoryId || null)
      return 'Categoria padrão atualizada. Os produtos novos vão para ela.'
    })
  }

  function describeSync(result: Awaited<ReturnType<typeof syncCatalogChannel>>) {
    const parts = [`${result.synced} enviado(s)`, `${result.unchanged} já estavam em dia`]
    if (result.failed.length) {
      parts.push(`${result.failed.length} com erro (${result.failed[0].name}: ${result.failed[0].error})`)
    }
    return parts.join(', ') + '.'
  }

  async function handleSaveRule() {
    if (!channel) return
    const percent = parseMoney(rule.percent)
    if (percent === null) {
      setError('Informe o percentual do canal.')
      return
    }
    await run(async () => {
      const updated = await saveCatalogChannel(token, channel.id, {
        price_percent: percent,
        price_rounding: rule.rounding,
      })
      setOverview((current) =>
        current ? { ...current, channels: current.channels.map((entry) => (entry.id === updated.id ? updated : entry)) } : current
      )
      return 'Regra de preço salva. Os preços novos aparecem como "Alteração a enviar".'
    })
  }

  function handleSync(force: boolean) {
    if (!channel) return
    if (!window.confirm(force ? 'Reenviar todo o catálogo ao canal?' : 'Enviar as alterações pendentes ao canal?')) return
    run(async () => describeSync(await syncCatalogChannel(token, channel.id, { force })))
  }

  function openEdit(item: CatalogItem) {
    setFormError(null)
    setForm({
      item,
      active: item.override.active === null ? 'inherit' : item.override.active ? 'on' : 'off',
      name: item.override.name ?? '',
      description: item.override.description ?? '',
      price: item.override.price !== null ? String(item.override.price) : '',
      categoryId: item.category_id ?? '',
    })
  }

  async function persistForm(current: EditForm) {
    if (!channel) return
    const price = parseMoney(current.price)
    await saveCatalogItem(token, channel.id, current.item.product_id, {
      active: current.active === 'inherit' ? null : current.active === 'on',
      name: current.name.trim() || null,
      description: current.description.trim() || null,
      price: price !== null && price > 0 ? price : null,
      category_id: current.categoryId || null,
    })
  }

  async function handleSaveItem(andSend: boolean) {
    if (!form || !channel) return
    setSaving(true)
    setFormError(null)
    try {
      await persistForm(form)
      if (andSend) {
        const result = await syncCatalogChannel(token, channel.id, { product_id: form.item.product_id, force: true })
        setMessage(describeSync(result))
      }
      setForm(null)
      await loadItems()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível salvar o produto.')
    } finally {
      setSaving(false)
    }
  }

  async function refreshFormItem(productId: string) {
    if (channelId === 'own') return
    const fresh = (await fetchCatalogItems(token, channelId, '')).find((entry) => entry.product_id === productId)
    setItems((current) => current.map((entry) => (entry.product_id === productId && fresh ? fresh : entry)))
    if (fresh) setForm((current) => (current ? { ...current, item: fresh } : current))
  }

  async function handleUpload(files: FileList | null) {
    if (!files?.length || !form || !channel) return
    setSaving(true)
    setFormError(null)
    try {
      await persistForm(form)
      for (const file of Array.from(files)) {
        await uploadCatalogImage(token, channel.id, form.item.product_id, file)
      }
      await refreshFormItem(form.item.product_id)
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível enviar a foto.')
    } finally {
      setSaving(false)
      if (fileInput.current) fileInput.current.value = ''
    }
  }

  async function handleDeleteImage(imageId: string) {
    if (!form || !channel) return
    setSaving(true)
    try {
      await deleteCatalogImage(token, channel.id, form.item.product_id, imageId)
      await refreshFormItem(form.item.product_id)
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível remover a foto.')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return <p className="p-8 text-[13.5px] text-[var(--muted)]">Carregando…</p>
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-500)] uppercase">Delivery</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Catálogo por canal</h1>
        <p className="mt-1 max-w-[720px] text-[13px] text-[var(--ink-soft)]">
          O produto é um só, com um estoque só. Aqui você define como ele aparece em cada canal: nome, descrição, preço
          e fotos. O que ficar em branco usa o que está no cardápio próprio. Vendeu em qualquer canal, o estoque baixa.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        {[{ id: 'own', name: 'Cardápio próprio' }, ...(overview?.channels ?? [])].map((entry) => (
          <button
            key={entry.id}
            type="button"
            onClick={() => {
              setChannelId(entry.id)
              setItems([])
              setMessage(null)
              setError(null)
            }}
            className={`rounded-xl px-4 py-2 text-[13px] font-bold transition ${
              entry.id === channelId
                ? 'bg-[var(--blue-500)] text-white'
                : 'bg-[var(--surface)] text-[var(--ink-soft)] ring-1 ring-[var(--border)] hover:text-[var(--ink)]'
            }`}
          >
            {entry.name}
          </button>
        ))}
      </div>

      {channelId === 'own' ? (
        <>
          <OwnMenuTab session={session} company={company} />
          {overview && overview.channels.length === 0 && (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 text-[13px] text-[var(--ink-soft)]">
              Para controlar o catálogo do iFood por aqui, conecte a sua loja em Configurações → Integrações. Depois
              de autorizada, ela aparece como uma aba ao lado do cardápio próprio.
            </div>
          )}
        </>
      ) : (
        <>
          {channel && (
            <div className="grid gap-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--card-shadow)] lg:grid-cols-[1fr_1fr_auto] lg:items-end">
              <MoneyField
                label="Preço neste canal (% sobre o cardápio)"
                icon={<DollarSignIcon className="h-4 w-4" />}
                value={rule.percent}
                allowNegative
                onChange={(event) => setRule({ ...rule, percent: event.target.value })}
                placeholder="0,00"
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold text-[var(--ink-soft)]">Arredondamento</label>
                <select
                  value={rule.rounding}
                  onChange={(event) => setRule({ ...rule, rounding: event.target.value as PriceRounding })}
                  className="rounded-xl bg-[var(--page)] px-3.5 py-3 text-[14px] text-[var(--ink)] focus:outline-none"
                >
                  {Object.entries(PRICE_ROUNDING_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
              <button
                type="button"
                onClick={handleSaveRule}
                disabled={busy}
                className="rounded-xl bg-[var(--blue-500)] px-4 py-3 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
              >
                Salvar regra
              </button>
              <p className="text-[12px] text-[var(--muted)] lg:col-span-3">
                Ex.: 15% com arredondamento ",90" transforma R$ 10,00 em R$ 11,90. O preço próprio de um produto sempre
                vale mais que a regra.
              </p>
            </div>
          )}

          {channel && (
            <div className="grid gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 lg:grid-cols-[1fr_1fr] lg:items-end">
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold text-[var(--ink-soft)]">Categoria padrão no iFood</label>
                <select
                  value={defaultCategoryId ?? ''}
                  onChange={(event) => handleDefaultCategory(event.target.value)}
                  disabled={busy}
                  className="rounded-xl bg-[var(--page)] px-3.5 py-3 text-[14px] text-[var(--ink)] focus:outline-none"
                >
                  <option value="">Criar automaticamente (Cardápio Controle Dois)</option>
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex items-end gap-2">
                <div className="flex-1">
                  <TextField
                    label="Nova categoria no iFood"
                    icon={<TagIcon className="h-4 w-4" />}
                    value={newCategory}
                    maxLength={100}
                    onChange={(event) => setNewCategory(event.target.value)}
                    placeholder="Ex.: Bebidas"
                  />
                </div>
                <button
                  type="button"
                  onClick={handleCreateCategory}
                  disabled={busy || !newCategory.trim()}
                  className="rounded-xl bg-[var(--blue-500)] px-4 py-3 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
                >
                  Criar categoria
                </button>
              </div>
            </div>
          )}

          {error && <Notice tone="error">{error}</Notice>}
          {message && <Notice tone="ok">{message}</Notice>}

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
            <button
              type="button"
              onClick={() => handleSync(false)}
              disabled={busy || !pendingCount}
              className="flex items-center gap-2 rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-50"
            >
              <RefreshIcon className="h-4 w-4" />
              {busy ? 'Enviando…' : `Enviar alterações (${pendingCount})`}
            </button>
            <button
              type="button"
              onClick={() => handleSync(true)}
              disabled={busy}
              className="rounded-xl px-3 py-2.5 text-[13px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-50"
            >
              Reenviar tudo
            </button>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--card-shadow)]">
            {items.length === 0 ? (
              <p className="py-12 text-center text-[13.5px] text-[var(--muted)]">
                Nenhum produto no cardápio. Publique produtos na aba Cardápio próprio.
              </p>
            ) : (
              <ul className="divide-y divide-[var(--border)]">
                {items.map((item) => {
                  const cover = item.effective.images[0]?.url
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
                        <p className="truncate text-[14px] font-bold text-[var(--ink)]">{item.effective.name}</p>
                        <p className="mt-0.5 text-[12px] text-[var(--ink-soft)]">
                          {item.effective.name !== item.own.name && <>Cardápio: {item.own.name} · </>}
                          {item.complement_groups ? `${item.complement_groups} grupo(s) de complemento · ` : ''}
                          Estoque: {item.stock.toLocaleString('pt-BR')}
                          {item.stock <= 0 && <span className="font-bold text-[var(--red-500)]"> (zerado)</span>}
                        </p>
                      </div>
                      <div className="w-[140px] text-right">
                        <p className="text-[14px] font-bold text-[var(--ink)]">{formatCurrency(item.effective.price)}</p>
                        <p className="text-[11px] text-[var(--muted)]">
                          {PRICE_SOURCE_LABELS[item.effective.price_source]}
                          {item.effective.price_source !== 'same' && <> · cardápio {formatCurrency(item.own.price)}</>}
                        </p>
                      </div>
                      <span
                        className={`rounded-full px-3 py-1 text-[11.5px] font-bold ${
                          item.effective.active
                            ? 'bg-[var(--green-100)] text-[var(--green-600)]'
                            : 'bg-[var(--page)] text-[var(--muted)]'
                        }`}
                      >
                        {item.effective.active ? 'Ativo' : 'Pausado'}
                      </span>
                      <SyncChip item={item} />
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        aria-label="Editar neste canal"
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
        </>
      )}

      {form && channel && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={saving ? undefined : () => setForm(null)}
        >
          <div
            className="max-h-[92vh] w-full max-w-[560px] overflow-y-auto rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-[15px] font-bold text-[var(--ink)]">{form.item.own.name}</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--ink-soft)]">
              Como este produto aparece em <strong>{channel.name}</strong>. Campo em branco usa o cardápio próprio.
            </p>

            <div className="mt-4 flex flex-col gap-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold text-[var(--ink-soft)]">Disponibilidade</label>
                <select
                  value={form.active}
                  onChange={(event) => setForm({ ...form, active: event.target.value as EditForm['active'] })}
                  className="rounded-xl bg-[var(--page)] px-3.5 py-3 text-[14px] text-[var(--ink)] focus:outline-none"
                >
                  <option value="inherit">Igual ao cardápio ({form.item.own.active ? 'ativo' : 'pausado'})</option>
                  <option value="on">Ativo neste canal</option>
                  <option value="off">Pausado neste canal</option>
                </select>
              </div>
              {channel.type === 'ifood' && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-[12px] font-semibold text-[var(--ink-soft)]">Categoria no iFood</label>
                  <select
                    value={form.categoryId}
                    onChange={(event) => setForm({ ...form, categoryId: event.target.value })}
                    className="rounded-xl bg-[var(--page)] px-3.5 py-3 text-[14px] text-[var(--ink)] focus:outline-none"
                  >
                    <option value="">Categoria padrão da loja</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <TextField
                label="Nome neste canal"
                icon={<TagIcon className="h-4 w-4" />}
                value={form.name}
                maxLength={100}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder={form.item.own.name}
              />
              <div className="flex flex-col gap-1.5">
                <label className="text-[12px] font-semibold text-[var(--ink-soft)]">Descrição neste canal</label>
                <textarea
                  value={form.description}
                  maxLength={500}
                  rows={3}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  placeholder={form.item.own.description || 'Igual ao cardápio'}
                  className="rounded-xl bg-[var(--page)] px-3.5 py-3 text-[14px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
                />
              </div>
              <MoneyField
                label={`Preço próprio (cardápio: ${formatCurrency(form.item.own.price)})`}
                icon={<DollarSignIcon className="h-4 w-4" />}
                value={form.price}
                onChange={(event) => setForm({ ...form, price: event.target.value })}
                placeholder="Em branco: usa a regra do canal"
              />

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between">
                  <label className="text-[12px] font-semibold text-[var(--ink-soft)]">Fotos neste canal (JPG ou PNG, até 5 MB)</label>
                  <button
                    type="button"
                    disabled={saving}
                    onClick={() => fileInput.current?.click()}
                    className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-bold text-[var(--blue-500)] hover:bg-[var(--page)] disabled:opacity-60"
                  >
                    <CameraIcon className="h-4 w-4" />
                    Adicionar foto
                  </button>
                  <input
                    ref={fileInput}
                    type="file"
                    accept="image/jpeg,image/png"
                    multiple
                    hidden
                    onChange={(event) => handleUpload(event.target.files)}
                  />
                </div>
                {form.item.images.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {form.item.images.map((image) => (
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
                ) : form.item.own.images.length > 0 ? (
                  <div>
                    <p className="mb-1.5 text-[12px] text-[var(--muted)]">Usando as fotos do cardápio próprio:</p>
                    <div className="flex flex-wrap gap-2">
                      {form.item.own.images.map((image, index) => (
                        <img key={index} src={image.url} alt="" className="h-16 w-16 rounded-lg object-cover opacity-80" />
                      ))}
                    </div>
                  </div>
                ) : (
                  <p className="text-[12px] text-[var(--muted)]">Sem fotos. Adicione uma para este canal.</p>
                )}
              </div>
            </div>

            {form.item.sync.status === 'error' && form.item.sync.error && (
              <p className="mt-3 text-[12.5px] font-medium text-[var(--red-500)]">Último envio falhou: {form.item.sync.error}</p>
            )}
            {form.item.sync.status === 'ok' && form.item.sync.error && (
              <p className="mt-3 text-[12.5px] text-[var(--ink-soft)]">Aviso do último envio: {form.item.sync.error}</p>
            )}
            {formError && <p className="mt-3 text-[13px] font-medium text-[var(--red-500)]">{formError}</p>}

            <div className="mt-6 flex flex-wrap items-center justify-end gap-3">
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
                onClick={() => handleSaveItem(false)}
                disabled={saving}
                className="rounded-xl px-4 py-2 text-[13.5px] font-bold text-[var(--blue-500)] ring-1 ring-[var(--blue-300)] hover:bg-[var(--page)] disabled:opacity-60"
              >
                Salvar
              </button>
              <button
                type="button"
                onClick={() => handleSaveItem(true)}
                disabled={saving}
                className="rounded-xl bg-[var(--blue-500)] px-4 py-2 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
              >
                {saving ? 'Salvando…' : 'Salvar e enviar'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
