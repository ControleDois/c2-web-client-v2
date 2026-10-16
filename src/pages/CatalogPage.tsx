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
import { Select } from '../components/form/Select'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { GuideSteps, type GuideStep } from '../components/GuideSteps'
import { OwnMenuTab } from './catalog/OwnMenuTab'
import { BoxIcon, CameraIcon, CloseIcon, DollarSignIcon, SearchIcon, TrashIcon } from '../components/icons'
import {
  PageHeader,
  Panel,
  Pill,
  Tip,
  buttonPrimary,
  buttonSecondary,
  friendlyIfoodMessage,
  inputClass,
} from '../components/ifood/ui'

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

const PRICE_SOURCE_TEXT = {
  override: 'Preço definido por você para este canal',
  rule: 'Preço do cardápio com a regra do canal',
  same: 'Mesmo preço do cardápio',
} as const

// Mesma conta que o servidor faz para o preço do canal (só para mostrar o exemplo na tela).
function exampleChannelPrice(base: number, percent: number, rounding: PriceRounding) {
  const raised = Math.round(base * (1 + percent / 100) * 100) / 100
  if (raised <= 0) return 0
  if (rounding === 'ceil_int') return Math.ceil(raised - 1e-9)
  if (rounding === 'ceil_90' || rounding === 'ceil_99') {
    const cents = rounding === 'ceil_90' ? 0.9 : 0.99
    const whole = Math.floor(raised + 1e-9)
    const candidate = whole + cents
    return Math.round((candidate < raised - 1e-9 ? whole + 1 + cents : candidate) * 100) / 100
  }
  return raised
}

function SyncPill({ item }: { item: CatalogItem }) {
  if (item.sync.status === 'error') return <Pill tone="bad">Não deu certo</Pill>
  if (item.sync.pending) {
    return <Pill tone="warn">{item.external ? 'Mudou: falta enviar' : 'Ainda não está no iFood'}</Pill>
  }
  return (
    <Pill tone="good" title={item.sync.at ? `Enviado em ${formatDateTime(item.sync.at)}` : undefined}>
      Já está no iFood
    </Pill>
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
  const [confirmSync, setConfirmSync] = useState<null | 'pending' | 'all'>(null)
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
      setError(err instanceof ApiError ? friendlyIfoodMessage(err.message) : 'Não foi possível carregar os canais.')
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
      setError(err instanceof ApiError ? friendlyIfoodMessage(err.message) : 'Não foi possível carregar os produtos.')
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
      setError(err instanceof ApiError ? friendlyIfoodMessage(err.message) : 'Não foi possível carregar as categorias do iFood.')
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
      setError(err instanceof ApiError ? friendlyIfoodMessage(err.message) : 'Não foi possível concluir. Tente de novo.')
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
      return `Pronto! A categoria "${created.name}" foi criada no iFood. Os produtos novos vão para ela.`
    })
  }

  async function handleDefaultCategory(categoryId: string) {
    if (!channel) return
    await run(async () => {
      await setIfoodDefaultCategory(token, channel.id, categoryId || null)
      setDefaultCategoryId(categoryId || null)
      return 'Pronto! Os produtos novos vão para essa categoria no iFood.'
    })
  }

  function describeSync(result: Awaited<ReturnType<typeof syncCatalogChannel>>) {
    const sent = result.synced === 1 ? '1 produto foi enviado' : `${result.synced} produtos foram enviados`
    const parts = [result.synced > 0 ? `Pronto! ${sent} ao iFood.` : 'Nada novo para enviar: tudo já estava em dia.']
    if (result.failed.length) {
      const first = result.failed[0]
      parts.push(
        `${result.failed.length === 1 ? '1 produto não foi enviado' : `${result.failed.length} produtos não foram enviados`}: ${first.name} (${friendlyIfoodMessage(first.error)})`
      )
    }
    return parts.join(' ')
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
      return 'Pronto! A regra de preço foi salva. Agora toque em "Enviar" para os preços novos irem ao iFood.'
    })
  }

  function handleSync(force: boolean) {
    if (!channel) return
    setConfirmSync(null)
    run(async () => describeSync(await syncCatalogChannel(token, channel.id, { force })))
  }

  function retryItem(item: CatalogItem) {
    if (!channel) return
    run(async () => describeSync(await syncCatalogChannel(token, channel.id, { product_id: item.product_id, force: true })))
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
      setFormError(err instanceof ApiError ? friendlyIfoodMessage(err.message) : 'Não foi possível salvar o produto.')
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
      setFormError(err instanceof ApiError ? friendlyIfoodMessage(err.message) : 'Não foi possível enviar a foto. Use JPG ou PNG de até 5 MB.')
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

  const ifoodTab = channel !== null
  const sentCount = Math.max(items.length - pendingCount, 0)
  const exampleNow = exampleChannelPrice(10, parseMoney(rule.percent) ?? 0, rule.rounding)

  const steps: GuideStep[] = [
    {
      key: 'channel',
      title: 'Escolha onde vender',
      description: 'Aqui em cima você escolhe o cardápio próprio ou a sua loja do iFood.',
      status: 'done',
    },
    {
      key: 'products',
      title: 'Confira os seus produtos',
      description: 'Veja o preço, a foto e se cada produto está disponível. Toque em "Editar" para mudar.',
      status: items.length > 0 ? 'info' : 'current',
      details: 'O produto é um só, e o estoque também. O que você deixar em branco usa o mesmo do cardápio próprio.',
    },
    {
      key: 'send',
      title: 'Envie para o iFood',
      description: 'Quando aparecer "falta enviar", toque no botão azul "Enviar para o iFood".',
      status: pendingCount > 0 ? 'current' : items.length > 0 ? 'done' : 'pending',
    },
  ]

  if (loading) {
    return <p className="p-8 text-[14px] text-[var(--muted)]">Carregando…</p>
  }

  const tabs = [{ id: 'own', name: 'Cardápio próprio', hint: 'A sua loja online' }, ...(overview?.channels ?? []).map((entry) => ({ id: entry.id, name: entry.name, hint: 'Vendas pelo iFood' }))]

  return (
    <div className="flex w-full flex-col gap-5 p-4 sm:p-6 lg:p-8">
      <PageHeader eyebrow="Delivery" title="Cardápio nos canais de venda">
        Aqui você escolhe o que aparece, e por quanto, em cada lugar onde vende: o seu cardápio online e o iFood. O produto
        e o estoque são um só: vendeu em qualquer lugar, o estoque baixa sozinho.
      </PageHeader>

      <div>
        <p className="mb-2 text-[13px] font-semibold text-[var(--ink-soft)]">Onde você quer mexer?</p>
        <div className="grid gap-2 sm:grid-cols-2">
          {tabs.map((entry) => (
            <button
              key={entry.id}
              type="button"
              onClick={() => {
                setChannelId(entry.id)
                setItems([])
                setMessage(null)
                setError(null)
              }}
              className={`rounded-2xl px-4 py-3.5 text-left transition ${
                entry.id === channelId
                  ? 'bg-[var(--blue-500)] text-white shadow-[var(--card-shadow)]'
                  : 'bg-[var(--surface)] text-[var(--ink)] ring-1 ring-[var(--border)] hover:ring-[var(--blue-300)]'
              }`}
            >
              <span className="block text-[15px] font-bold">{entry.name}</span>
              <span className={`block text-[12.5px] ${entry.id === channelId ? 'text-white/80' : 'text-[var(--muted)]'}`}>{entry.hint}</span>
            </button>
          ))}
        </div>
      </div>

      {channelId === 'own' ? (
        <>
          <OwnMenuTab session={session} company={company} />
          {overview && overview.channels.length === 0 && (
            <Tip title="Quer vender também pelo iFood?">
              Conecte a sua loja em <strong>Configurações → Integrações</strong>. Depois de conectada, ela aparece aqui em cima,
              ao lado do cardápio próprio.
            </Tip>
          )}
        </>
      ) : (
        ifoodTab && (
          <>
            <GuideSteps title="Passo a passo" subtitle="São só três passos" steps={steps} />

            {error && <Tip tone="bad" title="Não deu certo">{error}</Tip>}
            {message && <Tip tone="good">{message}</Tip>}

            <div className="grid gap-5 xl:grid-cols-2">
            <Panel
              title="Enviar para o iFood"
              help="O que você muda aqui só chega ao iFood quando você toca no botão azul abaixo."
            >
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-[14px] text-[var(--ink-soft)]">
                <span><strong className="text-[var(--ink)]">{items.length}</strong> produtos no cardápio</span>
                <span><strong className="text-[var(--green-600)]">{sentCount}</strong> já estão no iFood</span>
                <span><strong className={pendingCount > 0 ? 'text-[var(--amber-500)]' : 'text-[var(--ink)]'}>{pendingCount}</strong> faltam enviar</span>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => setConfirmSync('pending')} disabled={busy || pendingCount === 0} className={buttonPrimary}>
                  {busy ? 'Enviando…' : pendingCount > 0 ? `Enviar ${pendingCount} ${pendingCount === 1 ? 'produto' : 'produtos'} para o iFood` : 'Tudo em dia no iFood'}
                </button>
                <button type="button" onClick={() => setConfirmSync('all')} disabled={busy} className="text-[13px] font-bold text-[var(--blue-700)] hover:underline disabled:opacity-50">
                  Enviar todos de novo
                </button>
              </div>
              <p className="mt-2 text-[12.5px] text-[var(--muted)]">
                Use "Enviar todos de novo" só se algo no iFood estiver diferente do que você vê aqui.
              </p>
            </Panel>

            <Panel
              title="Categoria no iFood"
              help='No aplicativo do iFood, os produtos ficam dentro de categorias, como "Bebidas" ou "Pizzas". Escolha em qual categoria os produtos novos vão aparecer.'
            >
              <div className="grid gap-4 lg:grid-cols-2">
                <div className="flex flex-col gap-1.5">
<span className="text-[13px] font-semibold text-[var(--ink-soft)]">Categoria dos produtos novos</span>
<Select variant="page" value={defaultCategoryId ?? ''} onChange={(value) => handleDefaultCategory(value)} disabled={busy}>
                    <option value="">Criar sozinho (Cardápio Controle Dois)</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </Select>
</div>
                <div className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-semibold text-[var(--ink-soft)]">Ou crie uma categoria nova</span>
                  <div className="flex gap-2">
                    <input
                      value={newCategory}
                      maxLength={100}
                      onChange={(event) => setNewCategory(event.target.value)}
                      placeholder="Ex.: Bebidas"
                      className={inputClass}
                    />
                    <button type="button" onClick={handleCreateCategory} disabled={busy || !newCategory.trim()} className={buttonSecondary + ' flex-none'}>
                      Criar
                    </button>
                  </div>
                </div>
              </div>
            </Panel>
            </div>

            <details className="group rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--card-shadow)] sm:p-6">
              <summary className="flex cursor-pointer list-none items-start justify-between gap-3">
                <div>
                  <h2 className="text-[16px] font-bold text-[var(--ink)]">Preço no iFood</h2>
                  <p className="mt-1 text-[13.5px] text-[var(--ink-soft)]">
                    Quer cobrar um valor diferente no iFood? Toque aqui para ajustar.
                  </p>
                </div>
                <span className="text-[13px] font-bold text-[var(--blue-700)] group-open:hidden">Abrir</span>
              </summary>
              <div className="mt-4 flex flex-col gap-4">
                <div className="grid gap-4 lg:grid-cols-2">
                  <MoneyField
                    label="Aumentar (ou diminuir) o preço em %"
                    icon={<DollarSignIcon className="h-4 w-4" />}
                    value={rule.percent}
                    allowNegative
                    onChange={(event) => setRule({ ...rule, percent: event.target.value })}
                    placeholder="0,00"
                  />
                  <div className="flex flex-col gap-1.5">
<span className="text-[12px] font-semibold text-[var(--ink-soft)]">Arredondar o preço</span>
<Select variant="page" value={rule.rounding} onChange={(value) => setRule({ ...rule, rounding: value as PriceRounding })}>
                      {Object.entries(PRICE_ROUNDING_LABELS).map(([value, label]) => (
                        <option key={value} value={value}>
                          {label}
                        </option>
                      ))}
                    </Select>
</div>
                </div>
                <Tip>
                  Exemplo: um produto de <strong>R$ 10,00</strong> no cardápio vai custar <strong>{formatCurrency(exampleNow)}</strong> no
                  iFood. O preço que você definir direto no produto sempre vale mais que esta regra.
                </Tip>
                <div>
                  <button type="button" onClick={handleSaveRule} disabled={busy} className={buttonPrimary}>
                    Salvar regra de preço
                  </button>
                </div>
              </div>
            </details>

            <section className="flex flex-col gap-3">
              <div className="flex items-center gap-2 rounded-xl bg-[var(--surface)] px-4 py-3 ring-1 ring-[var(--border)]">
                <SearchIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
                <input
                  type="text"
                  placeholder="Procurar um produto pelo nome"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="w-full bg-transparent text-[14.5px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
                />
              </div>

              {items.length === 0 ? (
                <Panel title="Ainda não tem produtos aqui">
                  <Tip title="Como colocar produtos no iFood">
                    1) Abra <strong>Cardápio próprio</strong> aqui em cima. 2) Toque em "Editar" no produto e marque "Mostrar no
                    cardápio". 3) Volte para esta aba e envie para o iFood.
                  </Tip>
                </Panel>
              ) : (
                <ul className="grid gap-3 xl:grid-cols-2">
                  {items.map((item) => {
                    const cover = item.effective.images[0]?.url
                    return (
                      <li key={item.product_id} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 shadow-[var(--card-shadow)]">
                        <div className="flex flex-wrap items-center gap-4">
                          {cover ? (
                            <img src={cover} alt="" className="h-16 w-16 flex-none rounded-xl object-cover" />
                          ) : (
                            <span className="flex h-16 w-16 flex-none items-center justify-center rounded-xl bg-[var(--page)] text-[var(--muted)]">
                              <BoxIcon className="h-6 w-6" />
                            </span>
                          )}
                          <div className="min-w-0 flex-1 basis-[220px]">
                            <p className="text-[15.5px] font-bold text-[var(--ink)]">{item.effective.name}</p>
                            <p className="mt-0.5 text-[13px] text-[var(--ink-soft)]">
                              <strong className="text-[var(--ink)]">{formatCurrency(item.effective.price)}</strong> no iFood ·{' '}
                              {PRICE_SOURCE_TEXT[item.effective.price_source]}
                              {item.effective.price_source !== 'same' && <> (no cardápio: {formatCurrency(item.own.price)})</>}
                            </p>
                            <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">
                              {item.complement_groups ? `${item.complement_groups} grupo(s) de complemento · ` : ''}
                              Estoque: {item.stock.toLocaleString('pt-BR')}
                              {item.stock <= 0 && <span className="font-bold text-[var(--red-500)]"> (zerado)</span>}
                            </p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Pill tone={item.effective.active ? 'good' : 'neutral'}>
                              {item.effective.active ? 'Disponível' : 'Pausado'}
                            </Pill>
                            <SyncPill item={item} />
                            <button type="button" onClick={() => openEdit(item)} className={buttonSecondary + ' !px-4 !py-2'}>
                              Editar
                            </button>
                          </div>
                        </div>
                        {item.sync.status === 'error' && (
                          <div className="mt-3">
                            <Tip tone="bad" title="Este produto não foi enviado">
                              {friendlyIfoodMessage(item.sync.error || 'O iFood recusou o envio.')}{' '}
                              <button type="button" onClick={() => retryItem(item)} disabled={busy} className="font-bold underline">
                                Tentar de novo
                              </button>
                            </Tip>
                          </div>
                        )}
                      </li>
                    )
                  })}
                </ul>
              )}
            </section>
          </>
        )
      )}

      <ConfirmDialog
        open={confirmSync !== null}
        title={confirmSync === 'all' ? 'Enviar todos os produtos de novo?' : 'Enviar para o iFood?'}
        message={
          confirmSync === 'all'
            ? 'Todos os produtos serão enviados outra vez ao iFood, mesmo os que já estão lá.'
            : `${pendingCount} ${pendingCount === 1 ? 'produto será enviado' : 'produtos serão enviados'} ao iFood agora.`
        }
        confirmLabel="Sim, enviar"
        cancelLabel="Agora não"
        danger={false}
        loading={busy}
        onConfirm={() => handleSync(confirmSync === 'all')}
        onCancel={() => setConfirmSync(null)}
      />

      {form && channel && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-4" onClick={saving ? undefined : () => setForm(null)}>
          <div
            className="max-h-[94vh] w-full max-w-[600px] overflow-y-auto rounded-t-3xl bg-[var(--surface)] p-5 shadow-[var(--card-shadow)] sm:rounded-3xl sm:p-7"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-[18px] font-bold text-[var(--ink)]">{form.item.own.name}</h2>
            <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--ink-soft)]">
              Aqui você muda como este produto aparece no <strong>{channel.name}</strong>. Deixe em branco o que quiser manter igual
              ao cardápio.
            </p>

            <div className="mt-5 flex flex-col gap-5">
              <div className="flex flex-col gap-1.5">
<span className="text-[14px] font-bold text-[var(--ink)]">O produto aparece para venda?</span>
<Select variant="page" value={form.active} onChange={(value) => setForm({ ...form, active: value as EditForm['active'] })}>
                  <option value="inherit">Seguir o cardápio ({form.item.own.active ? 'está disponível' : 'está pausado'})</option>
                  <option value="on">Sim, vender neste canal</option>
                  <option value="off">Não, pausar só neste canal</option>
                </Select>
</div>

              {channel.type === 'ifood' && (
                <div className="flex flex-col gap-1.5">
<span className="text-[14px] font-bold text-[var(--ink)]">Em qual categoria do iFood?</span>
<Select variant="page" value={form.categoryId} onChange={(value) => setForm({ ...form, categoryId: value })}>
                    <option value="">A categoria padrão da loja</option>
                    {categories.map((category) => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </Select>
</div>
              )}

              <label className="flex flex-col gap-1.5">
                <span className="text-[14px] font-bold text-[var(--ink)]">Nome</span>
                <input value={form.name} maxLength={100} onChange={(event) => setForm({ ...form, name: event.target.value })} placeholder={form.item.own.name} className={inputClass} />
                <span className="text-[12.5px] text-[var(--muted)]">Em branco: usa "{form.item.own.name}".</span>
              </label>

              <label className="flex flex-col gap-1.5">
                <span className="text-[14px] font-bold text-[var(--ink)]">Descrição</span>
                <textarea
                  value={form.description}
                  maxLength={500}
                  rows={3}
                  onChange={(event) => setForm({ ...form, description: event.target.value })}
                  placeholder={form.item.own.description || 'Igual ao cardápio'}
                  className={inputClass}
                />
              </label>

              <div className="flex flex-col gap-1.5">
                <MoneyField
                  label={`Preço neste canal (no cardápio: ${formatCurrency(form.item.own.price)})`}
                  icon={<DollarSignIcon className="h-4 w-4" />}
                  value={form.price}
                  onChange={(event) => setForm({ ...form, price: event.target.value })}
                  placeholder="Em branco: usa a regra de preço do canal"
                />
                <span className="text-[12.5px] text-[var(--muted)]">Em branco: o sistema calcula pelo preço do cardápio e pela regra do canal.</span>
              </div>

              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <span className="text-[14px] font-bold text-[var(--ink)]">Fotos</span>
                    <p className="text-[12.5px] text-[var(--muted)]">JPG ou PNG, até 5 MB. De preferência quadrada e bem iluminada.</p>
                  </div>
                  <button type="button" disabled={saving} onClick={() => fileInput.current?.click()} className={buttonSecondary + ' flex-none !px-4 !py-2'}>
                    <CameraIcon className="h-4 w-4" />
                    Adicionar foto
                  </button>
                  <input ref={fileInput} type="file" accept="image/jpeg,image/png" multiple hidden onChange={(event) => handleUpload(event.target.files)} />
                </div>
                {form.item.images.length > 0 ? (
                  <div className="flex flex-wrap gap-2">
                    {form.item.images.map((image) => (
                      <div key={image.id} className="relative">
                        <img src={image.url} alt="" className="h-24 w-24 rounded-xl object-cover" />
                        <button
                          type="button"
                          onClick={() => handleDeleteImage(image.id)}
                          aria-label="Tirar esta foto"
                          className="absolute -right-2 -top-2 rounded-full bg-[var(--surface)] p-1.5 text-[var(--red-500)] shadow ring-1 ring-[var(--border)]"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                ) : form.item.own.images.length > 0 ? (
                  <div>
                    <p className="mb-1.5 text-[12.5px] text-[var(--muted)]">Sem foto própria: usando as fotos do cardápio.</p>
                    <div className="flex flex-wrap gap-2">
                      {form.item.own.images.map((image, index) => (
                        <img key={index} src={image.url} alt="" className="h-20 w-20 rounded-xl object-cover opacity-80" />
                      ))}
                    </div>
                  </div>
                ) : (
                  <Tip tone="warn">Este produto ainda não tem foto. No iFood, produtos com foto vendem mais.</Tip>
                )}
              </div>
            </div>

            {form.item.sync.status === 'ok' && form.item.sync.error && (
              <div className="mt-4"><Tip>Aviso do último envio: {friendlyIfoodMessage(form.item.sync.error)}</Tip></div>
            )}
            {form.item.sync.status === 'error' && form.item.sync.error && (
              <div className="mt-4"><Tip tone="bad" title="O último envio não deu certo">{friendlyIfoodMessage(form.item.sync.error)}</Tip></div>
            )}
            {formError && <div className="mt-4"><Tip tone="bad">{formError}</Tip></div>}

            <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:flex-wrap sm:justify-end">
              <button type="button" onClick={() => setForm(null)} disabled={saving} className="inline-flex items-center justify-center gap-1.5 rounded-xl px-5 py-3 text-[14px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-60">
                <CloseIcon className="h-4 w-4" />
                Cancelar
              </button>
              <button type="button" onClick={() => handleSaveItem(false)} disabled={saving} className={buttonSecondary}>
                Só salvar
              </button>
              <button type="button" onClick={() => handleSaveItem(true)} disabled={saving} className={buttonPrimary}>
                {saving ? 'Salvando…' : 'Salvar e enviar ao iFood'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
