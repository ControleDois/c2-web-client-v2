import { useEffect, useMemo, useState } from 'react'
import { ApiError } from '../lib/api'
import { fetchConfig } from '../lib/config'
import {
  createShelfLifeLabels,
  fetchShelfLifeLabels,
  fetchShelfLifeProducts,
  printShelfLifeLabels,
  shelfLifeText,
  type ShelfLifeLabelRecord,
  type ShelfLifeProduct,
} from '../lib/shelfLife'
import { PrinterIcon, SearchIcon, TrashIcon } from '../components/icons'
import type { AuthCompany, AuthSession } from '../lib/auth'

interface ShelfLifeLabelsPageProps {
  session: AuthSession
  company: AuthCompany
  onOpenProducts: () => void
}

const pad = (n: number) => String(n).padStart(2, '0')
const localInput = (date: Date) =>
  `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
const dateTime = (value: string | Date) =>
  new Date(value).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

function expiresAt(product: ShelfLifeProduct, opened: Date) {
  const ms = product.opened_shelf_life * (product.opened_shelf_life_unit === 'hours' ? 3_600_000 : 86_400_000)
  return new Date(opened.getTime() + ms)
}

function status(expires: string) {
  const end = new Date(expires).getTime()
  const now = Date.now()
  if (end < now) return { label: 'Vencido', tone: 'bg-[var(--red-100)] text-[var(--red-500)]' }
  if (end - now < 24 * 3_600_000) return { label: 'Vence em menos de 24 h', tone: 'bg-[var(--amber-100)] text-[var(--amber-500)]' }
  return { label: 'Dentro da validade', tone: 'bg-[var(--green-100)] text-[var(--green-600)]' }
}

// Etiquetas de validade de produtos abertos: escolhe o que abriu, imprime a etiqueta com a data de
// abertura e a de vencimento (pela validade depois de aberto do cadastro) e guarda o histórico.
export function ShelfLifeLabelsPage({ session, company, onOpenProducts }: ShelfLifeLabelsPageProps) {
  const token = session.token.token
  const [tab, setTab] = useState<'print' | 'history'>('print')
  const [products, setProducts] = useState<ShelfLifeProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<{ product: ShelfLifeProduct; quantity: number }[]>([])
  const [responsible, setResponsible] = useState(session.user.people?.name ?? '')
  const [opened, setOpened] = useState(() => localInput(new Date()))
  const [size, setSize] = useState({ w: 60, h: 40 })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ tone: 'ok' | 'error'; text: string } | null>(null)
  const [history, setHistory] = useState<ShelfLifeLabelRecord[]>([])
  const [historyLoading, setHistoryLoading] = useState(false)

  const companyName = company.people?.name ?? ''

  useEffect(() => {
    setLoading(true)
    Promise.all([fetchShelfLifeProducts(token, company.id), fetchConfig(token, company.id).catch(() => null)])
      .then(([list, config]) => {
        setProducts(list)
        if (config?.shelf_label_width_mm && config.shelf_label_height_mm) {
          setSize({ w: config.shelf_label_width_mm, h: config.shelf_label_height_mm })
        }
      })
      .catch((err) => setMessage({ tone: 'error', text: err instanceof ApiError ? err.message : 'Não foi possível carregar os produtos.' }))
      .finally(() => setLoading(false))
  }, [token, company.id])

  useEffect(() => {
    if (tab !== 'history') return
    setHistoryLoading(true)
    fetchShelfLifeLabels(token, company.id)
      .then((result) => setHistory(result.data))
      .catch(() => setHistory([]))
      .finally(() => setHistoryLoading(false))
  }, [tab, token, company.id])

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase()
    return products.filter((product) => !term || product.name.toLowerCase().includes(term) || (product.barcode ?? '').includes(term))
  }, [products, search])

  const totalLabels = selected.reduce((sum, item) => sum + item.quantity, 0)
  const openedDate = new Date(opened)

  function toggle(product: ShelfLifeProduct) {
    setMessage(null)
    setSelected((current) =>
      current.some((item) => item.product.id === product.id)
        ? current.filter((item) => item.product.id !== product.id)
        : [...current, { product, quantity: 1 }]
    )
  }

  function changeQuantity(id: string, delta: number) {
    setSelected((current) =>
      current.map((item) => (item.product.id === id ? { ...item, quantity: Math.min(Math.max(item.quantity + delta, 1), 50) } : item))
    )
  }

  async function printSelected() {
    if (!selected.length) return
    setBusy(true)
    setMessage(null)
    try {
      const labels = await createShelfLifeLabels(token, {
        companyId: company.id,
        responsible: responsible.trim() || undefined,
        openedAt: Number.isNaN(openedDate.getTime()) ? undefined : openedDate.toISOString(),
        items: selected.map((item) => ({ productId: item.product.id, quantity: item.quantity })),
      })
      printShelfLifeLabels(labels, { widthMm: size.w, heightMm: size.h, companyName })
      setMessage({ tone: 'ok', text: `${totalLabels} etiqueta(s) enviada(s) para impressão.` })
      setSelected([])
      setOpened(localInput(new Date()))
    } catch (err) {
      setMessage({ tone: 'error', text: err instanceof ApiError ? err.message : 'Não foi possível gerar as etiquetas.' })
    } finally {
      setBusy(false)
    }
  }

  const preview = selected[0]

  return (
    <div className="flex w-full flex-col gap-5 p-4 pb-32 sm:p-6 sm:pb-8 lg:p-8">
      <div>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Validade</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Etiquetas de validade</h1>
        <p className="mt-1 max-w-[760px] text-[13px] text-[var(--ink-soft)]">
          Abriu um produto? Escolha aqui e imprima a etiqueta com a data de abertura e até quando ele pode ser usado.
        </p>
      </div>

      <div className="flex gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1 sm:w-fit">
        {(
          [
            ['print', 'Imprimir etiquetas'],
            ['history', 'Etiquetas impressas'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setTab(value)}
            className={`flex-1 rounded-lg px-4 py-2 text-[13px] font-semibold sm:flex-none ${
              tab === value ? 'bg-[var(--blue-500)] text-white' : 'text-[var(--ink-soft)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {message && (
        <p
          className={`rounded-xl px-4 py-3 text-[13.5px] font-semibold ${
            message.tone === 'ok' ? 'bg-[var(--green-100)] text-[var(--green-600)]' : 'bg-[var(--red-100)] text-[var(--red-500)]'
          }`}
        >
          {message.text}
        </p>
      )}

      {tab === 'print' ? (
        <div className="grid min-w-0 gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="flex min-w-0 flex-col gap-3">
            <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
              <SearchIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Buscar produto aberto"
                className="w-full bg-transparent text-[14px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
              />
            </div>
            {loading ? (
              <div className="h-24 animate-pulse rounded-2xl bg-[var(--surface)]" />
            ) : products.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-[var(--border)] p-6 text-center">
                <p className="text-[14px] font-semibold text-[var(--ink)]">Nenhum produto com validade depois de aberto</p>
                <p className="mt-1 text-[13px] text-[var(--muted)]">
                  No cadastro do produto, preencha “Validade depois de aberto” (ex.: molho de tomate, 2 dias).
                </p>
                <button type="button" onClick={onOpenProducts} className="mt-3 text-[13px] font-bold text-[var(--blue-700)]">
                  Ir para os produtos →
                </button>
              </div>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {visible.map((product) => {
                  const on = selected.some((item) => item.product.id === product.id)
                  return (
                    <button
                      key={product.id}
                      type="button"
                      onClick={() => toggle(product)}
                      className={`flex items-center gap-3 rounded-2xl border p-3.5 text-left transition ${
                        on ? 'border-[var(--blue-500)] bg-[var(--blue-100)]' : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--blue-300)]'
                      }`}
                    >
                      <span
                        className={`flex h-6 w-6 flex-none items-center justify-center rounded-md border-2 text-[13px] font-black ${
                          on ? 'border-[var(--blue-500)] bg-[var(--blue-500)] text-white' : 'border-[var(--border)]'
                        }`}
                      >
                        {on ? '✓' : ''}
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[14px] font-semibold text-[var(--ink)]">{product.name}</span>
                        <span className="block text-[12px] text-[var(--muted)]">
                          Dura {shelfLifeText(product)} depois de aberto
                          {product.storage_condition ? ` · ${product.storage_condition}` : ''}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            )}
          </div>

          <div className="flex min-w-0 flex-col gap-3 lg:sticky lg:top-4 lg:self-start">
            <div className="flex flex-col gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <p className="text-[14px] font-bold text-[var(--ink)]">Produtos abertos ({selected.length})</p>
              {selected.length === 0 ? (
                <p className="text-[13px] text-[var(--muted)]">Toque nos produtos que você abriu.</p>
              ) : (
                <div className="flex flex-col gap-2">
                  {selected.map((item) => (
                    <div key={item.product.id} className="flex items-center gap-2 rounded-xl bg-[var(--page)] px-3 py-2">
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-[13.5px] font-semibold text-[var(--ink)]">{item.product.name}</span>
                        <span className="block text-[11.5px] text-[var(--muted)]">
                          Vence {dateTime(expiresAt(item.product, Number.isNaN(openedDate.getTime()) ? new Date() : openedDate))}
                        </span>
                      </span>
                      <button type="button" onClick={() => changeQuantity(item.product.id, -1)} className="h-8 w-8 rounded-lg bg-[var(--surface)] font-bold">
                        −
                      </button>
                      <span className="w-6 text-center text-[14px] font-bold tabular-nums">{item.quantity}</span>
                      <button type="button" onClick={() => changeQuantity(item.product.id, 1)} className="h-8 w-8 rounded-lg bg-[var(--surface)] font-bold">
                        +
                      </button>
                      <button type="button" onClick={() => toggle(item.product)} aria-label="Tirar" className="p-1 text-[var(--muted)] hover:text-[var(--red-500)]">
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
              <label className="flex flex-col gap-1">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Aberto em</span>
                <div className="flex gap-2">
                  <input
                    type="datetime-local"
                    value={opened}
                    onChange={(event) => setOpened(event.target.value)}
                    className="min-w-0 flex-1 rounded-xl bg-[var(--page)] px-3 py-2 text-[14px] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--blue-300)]"
                  />
                  <button type="button" onClick={() => setOpened(localInput(new Date()))} className="rounded-xl px-3 text-[12.5px] font-bold text-[var(--blue-700)] ring-1 ring-[var(--blue-300)]">
                    Agora
                  </button>
                </div>
              </label>
              <label className="flex flex-col gap-1">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Responsável</span>
                <input
                  value={responsible}
                  onChange={(event) => setResponsible(event.target.value.slice(0, 120))}
                  placeholder="Quem abriu"
                  className="rounded-xl bg-[var(--page)] px-3 py-2 text-[14px] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--blue-300)]"
                />
              </label>
            </div>

            {preview && (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
                <p className="mb-2 text-[12px] font-semibold text-[var(--ink-soft)]">
                  Prévia da etiqueta ({size.w} × {size.h} mm)
                </p>
                <div
                  className="mx-auto flex flex-col justify-between rounded border border-[var(--border)] bg-white p-2 text-black shadow-sm"
                  style={{ width: `${size.w * 4}px`, height: `${size.h * 4}px`, maxWidth: '100%' }}
                >
                  <p className="border-b border-black pb-0.5 text-[13px] leading-tight font-extrabold uppercase">{preview.product.name}</p>
                  <p className="flex justify-between text-[11px]">
                    <b>ABERTO EM</b> <b>{dateTime(Number.isNaN(openedDate.getTime()) ? new Date() : openedDate)}</b>
                  </p>
                  <p className="flex justify-between rounded border-2 border-black px-1 text-[12.5px] font-black">
                    <b>VALIDADE</b> <b>{dateTime(expiresAt(preview.product, Number.isNaN(openedDate.getTime()) ? new Date() : openedDate))}</b>
                  </p>
                  {preview.product.storage_condition && <p className="text-[10px]">{preview.product.storage_condition}</p>}
                  <p className="truncate text-[9.5px] text-neutral-700">
                    {responsible ? `Resp.: ${responsible} · ` : ''}
                    {companyName}
                  </p>
                </div>
              </div>
            )}

            <div className="fixed inset-x-0 bottom-0 z-40 border-t border-[var(--border)] bg-[var(--surface)] p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] lg:static lg:border-none lg:bg-transparent lg:p-0">
              <button
                type="button"
                disabled={!selected.length || busy}
                onClick={() => void printSelected()}
                className="flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-[var(--blue-500)] text-[15px] font-bold text-white hover:bg-[var(--blue-700)] disabled:opacity-50"
              >
                <PrinterIcon className="h-5 w-5" />
                {busy ? 'Gerando…' : totalLabels ? `Imprimir ${totalLabels} etiqueta${totalLabels > 1 ? 's' : ''}` : 'Imprimir etiquetas'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2 sm:p-4">
          {historyLoading ? (
            <div className="h-24 animate-pulse rounded-xl bg-[var(--page)]" />
          ) : history.length === 0 ? (
            <p className="py-8 text-center text-[13.5px] text-[var(--muted)]">Nenhuma etiqueta impressa ainda.</p>
          ) : (
            <div className="flex flex-col divide-y divide-[var(--border)]">
              {history.map((label) => {
                const state = status(label.expires_at)
                return (
                  <div key={label.id} className="flex flex-wrap items-center gap-3 px-2 py-3">
                    <div className="min-w-[180px] flex-1">
                      <p className="text-[14px] font-semibold text-[var(--ink)]">
                        {label.product_name}
                        {label.quantity > 1 ? <span className="text-[var(--muted)]"> · {label.quantity} etiquetas</span> : null}
                      </p>
                      <p className="text-[12px] text-[var(--muted)]">
                        Aberto {dateTime(label.opened_at)} · vence <b className="text-[var(--ink)]">{dateTime(label.expires_at)}</b>
                        {label.responsible ? ` · ${label.responsible}` : ''}
                      </p>
                    </div>
                    <span className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${state.tone}`}>{state.label}</span>
                    <button
                      type="button"
                      onClick={() => printShelfLifeLabels([{ ...label, quantity: 1 }], { widthMm: size.w, heightMm: size.h, companyName })}
                      className="rounded-lg px-3 py-1.5 text-[12.5px] font-bold text-[var(--blue-700)] ring-1 ring-[var(--blue-300)]"
                    >
                      Reimprimir
                    </button>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
