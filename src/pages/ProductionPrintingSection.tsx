import { useEffect, useState } from 'react'
import { ApiError } from '../lib/api'
import type { AuthCompany, AuthSession } from '../lib/auth'
import {
  fetchProductionPrinting,
  NO_PRINT,
  saveProductionPrinting,
  searchProductionProducts,
  type ProductionPrintingProduct,
  type ProductionPrintingSettings,
} from '../lib/printers'
import { Select } from '../components/form/Select'
import { SearchIcon, TrashIcon } from '../components/icons'

interface Props {
  session: AuthSession
  company: AuthCompany
}

// Pedidos de mesa/delivery saem separados por setor: cada categoria (ou produto) aponta para
// a impressora da cozinha, do bar... O que não tiver vínculo vai para a impressora padrão.
export function ProductionPrintingSection({ session, company }: Props) {
  const token = session.token.token
  const [settings, setSettings] = useState<ProductionPrintingSettings | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [savedAt, setSavedAt] = useState<number | null>(null)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<ProductionPrintingProduct[]>([])

  useEffect(() => {
    fetchProductionPrinting(token, company.id)
      .then(setSettings)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível carregar.'))
  }, [token, company.id])

  useEffect(() => {
    const term = search.trim()
    if (term.length < 2) {
      setResults([])
      return
    }
    const timer = setTimeout(() => {
      searchProductionProducts(token, company.id, term)
        .then(setResults)
        .catch(() => setResults([]))
    }, 250)
    return () => clearTimeout(timer)
  }, [search, token, company.id])

  async function save(payload: Parameters<typeof saveProductionPrinting>[2]) {
    setSaving(true)
    setError(null)
    try {
      setSettings(await saveProductionPrinting(token, company.id, payload))
      setSavedAt(Date.now())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar.')
    } finally {
      setSaving(false)
    }
  }

  if (!settings) {
    return error ? (
      <p className="rounded-xl bg-[var(--red-100)] px-4 py-3 text-[13px] font-medium text-[var(--red-500)]">{error}</p>
    ) : (
      <div className="h-40 animate-pulse rounded-2xl bg-[var(--surface)]" />
    )
  }

  const activePrinters = settings.printers.filter((printer) => printer.active)
  const printerName = (id: string | null) => settings.printers.find((printer) => printer.id === id)?.name
  const defaultName = printerName(settings.default_printer_id)
  const onlyOne = activePrinters.length <= 1

  const routeLabel = (id: string | null) => {
    if (id === NO_PRINT) return 'Não imprime'
    return printerName(id) ?? defaultName ?? 'Sem impressora'
  }

  const printerOptions = (inheritLabel: string) => [
    <option key="inherit" value="">
      {inheritLabel}
    </option>,
    ...activePrinters.map((printer) => (
      <option key={printer.id} value={printer.id}>
        {printer.name}
      </option>
    )),
    <option key="none" value={NO_PRINT}>
      Não imprimir
    </option>,
  ]

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-2xl bg-[var(--surface)] p-5 shadow-[var(--card-shadow)]">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="max-w-[560px]">
            <h2 className="text-[15px] font-bold text-[var(--ink)]">Imprimir os pedidos na produção</h2>
            <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
              Quando o garçom, o PDV, o cardápio ou o iFood lançam um pedido, cada item sai na impressora do seu setor — bebidas no bar,
              lanches na cozinha. Item cancelado depois de impresso sai como <b>CANCELADO</b> no mesmo setor.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={settings.enabled}
            disabled={saving}
            onClick={() => void save({ enabled: !settings.enabled })}
            className={`relative h-7 w-12 flex-none rounded-full transition ${settings.enabled ? 'bg-[var(--green-600)]' : 'bg-[var(--border)]'}`}
          >
            <span className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow transition-all ${settings.enabled ? 'left-6' : 'left-1'}`} />
            <span className="sr-only">Ligar impressão de produção</span>
          </button>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(0,320px)_1fr] sm:items-end">
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Impressora padrão dos pedidos</span>
            <Select
              value={settings.default_printer_id ?? ''}
              variant="page"
              onChange={(value) => void save({ default_printer_id: value || null })}
            >
              <option value="">Nenhuma (só imprime o que tiver vínculo)</option>
              {activePrinters.map((printer) => (
                <option key={printer.id} value={printer.id}>
                  {printer.name}
                </option>
              ))}
            </Select>
          </label>
          <p className="text-[12.5px] text-[var(--muted)]">
            {onlyOne
              ? 'Só tem uma impressora? Escolha ela aqui e pronto: todos os pedidos saem nela. Quando colocar outra (bar, por exemplo), é só vincular as categorias abaixo.'
              : 'Tudo que não tiver vínculo com outra impressora sai aqui.'}
          </p>
        </div>

        {activePrinters.length === 0 && (
          <p className="mt-3 rounded-xl bg-[var(--amber-100)] px-3.5 py-2.5 text-[12.5px] font-medium text-[var(--amber-500)]">
            Cadastre uma impressora na aba “Impressoras” para começar.
          </p>
        )}
        {settings.enabled && !settings.default_printer_id && activePrinters.length > 0 && (
          <p className="mt-3 rounded-xl bg-[var(--amber-100)] px-3.5 py-2.5 text-[12.5px] font-medium text-[var(--amber-500)]">
            Sem impressora padrão: produtos sem vínculo não serão impressos.
          </p>
        )}
        <p className="mt-3 h-4 text-[12px] font-medium text-[var(--muted)]">
          {saving ? 'Salvando…' : error ? <span className="text-[var(--red-500)]">{error}</span> : savedAt ? 'Salvo.' : ''}
        </p>
      </section>

      <section className="rounded-2xl bg-[var(--surface)] p-5 shadow-[var(--card-shadow)]">
        <h2 className="text-[15px] font-bold text-[var(--ink)]">Por categoria</h2>
        <p className="mt-1 text-[13px] text-[var(--ink-soft)]">Ex.: Bebidas → Bar, Lanches e Porções → Cozinha. Vale para todos os produtos da categoria.</p>
        {settings.categories.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-[var(--muted)]">Nenhuma categoria de produto cadastrada.</p>
        ) : (
          <div className="mt-3 divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
            {settings.categories.map((category) => (
              <div key={category.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
                <div className="min-w-0">
                  <p className="truncate text-[13.5px] font-semibold text-[var(--ink)]">{category.name}</p>
                  <p className="text-[11.5px] text-[var(--muted)]">{category.products_count} produto(s)</p>
                </div>
                <div className="w-full sm:w-[240px]">
                  <Select
                    value={category.production_printer_id ?? ''}
                    variant="page"
                    onChange={(value) => void save({ categories: [{ id: category.id, printer_id: value || null }] })}
                  >
                    {printerOptions(`Padrão${defaultName ? ` (${defaultName})` : ''}`)}
                  </Select>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-[var(--surface)] p-5 shadow-[var(--card-shadow)]">
        <h2 className="text-[15px] font-bold text-[var(--ink)]">Exceções por produto</h2>
        <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
          Para um produto sair em outra impressora que a da categoria — ou não sair (ex.: sobremesa pronta no balcão).
        </p>
        <div className="mt-3 flex items-center gap-2 rounded-xl bg-[var(--page)] px-3.5 py-2.5 ring-1 ring-transparent focus-within:ring-[var(--blue-300)]">
          <SearchIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
          <input
            type="text"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar produto pelo nome ou código"
            className="w-full bg-transparent text-[13.5px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
          />
        </div>
        {results.length > 0 && (
          <div className="mt-2 max-h-64 divide-y divide-[var(--border)] overflow-y-auto rounded-xl border border-[var(--border)]">
            {results.map((product) => (
              <ProductRow
                key={product.id}
                product={settings.products.find((item) => item.id === product.id) ?? product}
                options={printerOptions('Igual à categoria')}
                onChange={(value) => void save({ products: [{ id: product.id, printer_id: value || null }] })}
              />
            ))}
          </div>
        )}
        {settings.products.length > 0 && (
          <>
            <p className="mt-4 mb-2 text-[12px] font-bold tracking-wide text-[var(--muted)] uppercase">Produtos com exceção</p>
            <div className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
              {settings.products.map((product) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  hint={routeLabel(product.production_printer_id)}
                  options={printerOptions('Igual à categoria')}
                  onChange={(value) => void save({ products: [{ id: product.id, printer_id: value || null }] })}
                  onRemove={() => void save({ products: [{ id: product.id, printer_id: null }] })}
                />
              ))}
            </div>
          </>
        )}
      </section>
    </div>
  )
}

function ProductRow({
  product,
  options,
  hint,
  onChange,
  onRemove,
}: {
  product: ProductionPrintingProduct
  options: React.ReactNode
  hint?: string
  onChange: (value: string) => void
  onRemove?: () => void
}) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-2.5">
      <div className="min-w-0">
        <p className="truncate text-[13.5px] font-semibold text-[var(--ink)]">
          {product.code ? <span className="mr-1.5 text-[var(--muted)]">#{product.code}</span> : null}
          {product.name}
        </p>
        {hint && <p className="text-[11.5px] text-[var(--muted)]">Sai em: {hint}</p>}
      </div>
      <div className="flex w-full items-center gap-1.5 sm:w-auto">
        <div className="flex-1 sm:w-[240px] sm:flex-none">
          <Select value={product.production_printer_id ?? ''} variant="page" onChange={onChange}>
            {options}
          </Select>
        </div>
        {onRemove && (
          <button
            type="button"
            onClick={onRemove}
            aria-label={`Tirar a exceção de ${product.name}`}
            className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--red-500)]"
          >
            <TrashIcon className="h-4 w-4" />
          </button>
        )}
      </div>
    </div>
  )
}
