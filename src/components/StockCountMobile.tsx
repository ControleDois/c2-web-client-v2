import { useEffect, useMemo, useRef, useState } from 'react'
import { BarcodeScanner, scanFeedback } from './BarcodeScanner'
import { fetchProducts } from '../lib/products'
import { formatStockQuantity, trackProductStock, type StockSituationRow } from '../lib/stock'
import { parseMoney } from '../lib/money'
import { ApiError } from '../lib/api'
import { SearchIcon } from './icons'

export type CountMode = 'unit' | 'qty'

interface StockCountMobileProps {
  token: string
  companyId: string
  rows: StockSituationRow[]
  counted: Record<string, string>
  setCounted: (update: (current: Record<string, string>) => Record<string, string>) => void
  // Produto bipado que ainda não controlava estoque e passou a controlar
  onRowAdded: (row: StockSituationRow) => void
}

const MODE_KEY = 'c2_stock_count_mode'
const normalize = (code: string) => code.replace(/\s/g, '').replace(/^0+(?=\d)/, '')

function readMode(): CountMode {
  try {
    return localStorage.getItem(MODE_KEY) === 'unit' ? 'unit' : 'qty'
  } catch {
    return 'qty'
  }
}

const valueOf = (raw: string | undefined) => (raw === undefined || raw === '' ? null : parseMoney(raw))
const fmt = (n: number) => String(Math.round(n * 1000) / 1000).replace('.', ',')

// Contagem de estoque pelo celular: bipa o código de barras com a câmera (ou digita/busca) e
//  - "Bipar cada unidade": cada leitura soma 1 ao produto;
//  - "Bipar e digitar": uma leitura abre o produto para digitar a quantidade contada.
export function StockCountMobile({ token, companyId, rows, counted, setCounted, onRowAdded }: StockCountMobileProps) {
  const [mode, setMode] = useState<CountMode>(readMode)
  const [camera, setCamera] = useState(true)
  const [sheet, setSheet] = useState<{ row: StockSituationRow; value: string } | null>(null)
  const [choose, setChoose] = useState<StockSituationRow[] | null>(null)
  const [enable, setEnable] = useState<{ id: string; name: string; unit?: string | null; barcode?: string | null } | null>(null)
  const [last, setLast] = useState<{ row: StockSituationRow; at: number } | null>(null)
  const [notice, setNotice] = useState<{ tone: 'error' | 'ok'; text: string } | null>(null)
  const [typed, setTyped] = useState('')
  const [busy, setBusy] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  // Depois de fechar a quantidade, o produto ainda está na frente da câmera: ignora o mesmo
  // código por alguns segundos para não reabrir sozinho.
  const ignore = useRef<{ code: string; until: number }>({ code: '', until: 0 })

  function closeSheet() {
    if (sheet?.row.barcode) ignore.current = { code: normalize(sheet.row.barcode), until: Date.now() + 4000 }
    setSheet(null)
  }

  useEffect(() => {
    try {
      localStorage.setItem(MODE_KEY, mode)
    } catch {
      // sem armazenamento
    }
  }, [mode])

  useEffect(() => {
    if (!notice) return
    const timer = setTimeout(() => setNotice(null), 3500)
    return () => clearTimeout(timer)
  }, [notice])

  useEffect(() => {
    if (sheet) setTimeout(() => inputRef.current?.select(), 60)
  }, [sheet])

  const byBarcode = useMemo(() => {
    const map = new Map<string, StockSituationRow[]>()
    for (const row of rows) {
      if (!row.barcode) continue
      const key = normalize(row.barcode)
      map.set(key, [...(map.get(key) ?? []), row])
    }
    return map
  }, [rows])

  const countedRows = useMemo(
    () =>
      rows
        .filter((row) => valueOf(counted[row.id]) !== null)
        .map((row) => ({ row, value: valueOf(counted[row.id]) as number })),
    [rows, counted]
  )

  const matches = useMemo(() => {
    const term = typed.trim().toLowerCase()
    if (term.length < 2) return []
    return rows
      .filter((row) => row.name.toLowerCase().includes(term) || (row.barcode ?? '').includes(term) || String(row.code ?? '') === term)
      .slice(0, 8)
  }, [rows, typed])

  function addOne(row: StockSituationRow) {
    setCounted((current) => ({ ...current, [row.id]: fmt((valueOf(current[row.id]) ?? 0) + 1) }))
    setLast({ row, at: Date.now() })
  }

  function pick(row: StockSituationRow) {
    setChoose(null)
    scanFeedback(true)
    if (mode === 'unit') addOne(row)
    else setSheet({ row, value: '' })
  }

  async function handleCode(raw: string) {
    const code = normalize(raw)
    if (!code || sheet || choose || enable || busy) return
    if (mode === 'qty' && code === ignore.current.code && Date.now() < ignore.current.until) return
    const found = byBarcode.get(code)
    if (found?.length === 1) return pick(found[0])
    if (found && found.length > 1) {
      scanFeedback(true)
      return setChoose(found)
    }
    // Não está entre os produtos que controlam estoque: procura no cadastro.
    setBusy(true)
    try {
      const result = await fetchProducts(token, companyId, { search: raw.trim(), limit: 10 })
      const product = result.data.find((item) => item.barcode && normalize(item.barcode) === code)
      if (product) {
        scanFeedback(true)
        setEnable({ id: product.id, name: product.name, unit: product.unit, barcode: product.barcode })
      } else {
        scanFeedback(false)
        setNotice({ tone: 'error', text: `Nenhum produto com o código ${raw.trim()}. Busque pelo nome abaixo.` })
      }
    } catch {
      scanFeedback(false)
      setNotice({ tone: 'error', text: 'Sem conexão para buscar o produto. Tente de novo.' })
    } finally {
      setBusy(false)
    }
  }

  async function enableAndCount() {
    if (!enable) return
    setBusy(true)
    try {
      await trackProductStock(token, enable.id)
      const row: StockSituationRow = {
        id: enable.id,
        name: enable.name,
        unit: enable.unit,
        barcode: enable.barcode,
        role: 0,
        is_ingredient: false,
        controls_stock: true,
        min_stock: null,
        available_stock: 0,
        reserved_stock: 0,
        average_cost: 0,
        stock_value: 0,
        stock_status: 'empty',
        has_recipe: false,
        producible: null,
      }
      onRowAdded(row)
      setEnable(null)
      if (mode === 'unit') addOne(row)
      else setSheet({ row, value: '' })
    } catch (err) {
      setNotice({ tone: 'error', text: err instanceof ApiError ? err.message : 'Não foi possível ativar o estoque do produto.' })
    } finally {
      setBusy(false)
    }
  }

  function confirmSheet(sum: boolean) {
    if (!sheet) return
    const value = parseMoney(sheet.value)
    if (value === null || value < 0) return
    const previous = valueOf(counted[sheet.row.id]) ?? 0
    const next = sum ? previous + value : value
    setCounted((current) => ({ ...current, [sheet.row.id]: fmt(next) }))
    setNotice({ tone: 'ok', text: `${sheet.row.name}: ${fmt(next)} ${sheet.row.unit || 'un'}` })
    closeSheet()
  }

  function submitTyped() {
    const term = typed.trim()
    if (!term) return
    if (/^\d{6,}$/.test(term)) {
      void handleCode(term)
      setTyped('')
      return
    }
    if (matches.length === 1) {
      pick(matches[0])
      setTyped('')
    }
  }

  const scannerPaused = Boolean(sheet || choose || enable || busy)
  const recentFlash = last && Date.now() - last.at < 1500

  return (
    <div className="flex flex-col gap-3 pb-28">
      {/* Câmera em destaque, com o modo e o liga/desliga por cima */}
      {camera ? (
        <BarcodeScanner
          onScan={(code) => void handleCode(code)}
          paused={scannerPaused}
          // Cada unidade: o mesmo código conta de novo depois que sai da câmera por 0,7 s.
          repeatAfterMs={mode === 'unit' ? 700 : 1500}
          className="h-[44vh] max-h-[420px] min-h-[240px] w-full"
        >
          <div className="absolute inset-x-2 top-2 flex items-center gap-2">
            <div className="flex flex-1 rounded-full bg-black/55 p-1 backdrop-blur">
              {(
                [
                  ['qty', 'Digitar quantidade'],
                  ['unit', 'Cada bipe = 1'],
                ] as const
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setMode(value)}
                  className={`flex-1 rounded-full px-2 py-1.5 text-[12.5px] font-bold transition ${
                    mode === value ? 'bg-white text-[var(--ink)]' : 'text-white/85'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <button
              type="button"
              onClick={() => setCamera(false)}
              className="flex-none rounded-full bg-black/55 px-3 py-2 text-[12px] font-bold text-white backdrop-blur"
            >
              Fechar
            </button>
          </div>
          <p className="pointer-events-none absolute inset-x-0 bottom-2 text-center text-[12px] font-semibold text-white drop-shadow">
            {mode === 'unit' ? 'Uma unidade por vez' : 'Aponte para o código de barras'}
          </p>
        </BarcodeScanner>
      ) : (
        <button
          type="button"
          onClick={() => setCamera(true)}
          className="flex h-14 items-center justify-center rounded-2xl bg-[var(--ink)] text-[15px] font-bold text-white"
        >
          Abrir a câmera para bipar
        </button>
      )}

      {/* Última leitura (modo unidade) */}
      {mode === 'unit' && last && (
        <div
          className={`flex items-center gap-3 rounded-2xl border p-3 transition ${
            recentFlash ? 'border-[var(--green-600)] bg-[var(--green-100)]' : 'border-[var(--border)] bg-[var(--surface)]'
          }`}
        >
          <div className="min-w-0 flex-1">
            <p className="truncate text-[15px] font-bold text-[var(--ink)]">{last.row.name}</p>
            <p className="text-[12px] text-[var(--muted)]">Última leitura · cada bipe soma 1</p>
          </div>
          <button
            type="button"
            onClick={() =>
              setCounted((current) => ({ ...current, [last.row.id]: fmt(Math.max((valueOf(current[last.row.id]) ?? 0) - 1, 0)) }))
            }
            className="h-11 w-11 rounded-xl bg-[var(--page)] text-[22px] font-bold text-[var(--ink)]"
            aria-label="Tirar 1"
          >
            −
          </button>
          <span className="min-w-[3ch] text-center text-[24px] font-black tabular-nums text-[var(--ink)]">
            {fmt(valueOf(counted[last.row.id]) ?? 0)}
          </span>
          <button type="button" onClick={() => addOne(last.row)} className="h-11 w-11 rounded-xl bg-[var(--blue-500)] text-[22px] font-bold text-white" aria-label="Somar 1">
            +
          </button>
        </div>
      )}

      {notice && (
        <p
          className={`rounded-xl px-4 py-2.5 text-[13.5px] font-semibold ${
            notice.tone === 'error' ? 'bg-[var(--red-100)] text-[var(--red-500)]' : 'bg-[var(--green-100)] text-[var(--green-600)]'
          }`}
        >
          {notice.text}
        </p>
      )}

      {/* Digitar código ou buscar pelo nome (também serve para leitor bluetooth) */}
      <div className="relative">
        <form
          onSubmit={(event) => {
            event.preventDefault()
            submitTyped()
          }}
          className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-3"
        >
          <SearchIcon className="h-5 w-5 flex-none text-[var(--muted)]" />
          <input
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
            placeholder="Código de barras ou nome do produto"
            enterKeyHint="search"
            className="w-full bg-transparent text-[15px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
          />
        </form>
        {matches.length > 0 && (
          <div className="mt-1 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-lg">
            {matches.map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => {
                  setTyped('')
                  setSheet({ row, value: counted[row.id] ?? '' })
                }}
                className="flex w-full items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3 text-left last:border-none active:bg-[var(--page)]"
              >
                <span className="min-w-0">
                  <span className="block truncate text-[14px] font-semibold text-[var(--ink)]">{row.name}</span>
                  <span className="block text-[11.5px] text-[var(--muted)]">{row.barcode || 'sem código de barras'}</span>
                </span>
                <span className="flex-none text-[12px] text-[var(--ink-soft)]">Sistema: {formatStockQuantity(row.available_stock)}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Itens contados */}
      <div className="flex items-center justify-between pt-1">
        <p className="text-[13px] font-bold tracking-wide text-[var(--ink-soft)] uppercase">Contados ({countedRows.length})</p>
      </div>
      {countedRows.length === 0 ? (
        <p className="rounded-2xl border border-dashed border-[var(--border)] p-6 text-center text-[13.5px] text-[var(--muted)]">
          Nenhum item contado ainda. Bipe o primeiro produto.
        </p>
      ) : (
        <div className="flex flex-col gap-2">
          {countedRows
            .slice()
            .reverse()
            .map(({ row, value }) => {
              const diff = Math.round((value - row.available_stock) * 1000) / 1000
              return (
                <button
                  key={row.id}
                  type="button"
                  onClick={() => setSheet({ row, value: counted[row.id] ?? '' })}
                  className="flex items-center gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3 text-left active:bg-[var(--page)]"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-[14.5px] font-semibold text-[var(--ink)]">{row.name}</span>
                    <span className="block text-[12px] text-[var(--muted)]">
                      No sistema {formatStockQuantity(row.available_stock)}
                      {diff !== 0 && (
                        <b className={diff > 0 ? 'text-[var(--green-600)]' : 'text-[var(--red-500)]'}>
                          {' '}
                          · {diff > 0 ? '+' : ''}
                          {fmt(diff)}
                        </b>
                      )}
                    </span>
                  </span>
                  <span className="flex-none text-right">
                    <span className="block text-[22px] leading-none font-black tabular-nums text-[var(--ink)]">{fmt(value)}</span>
                    <span className="text-[11px] text-[var(--muted)]">{row.unit || 'un'}</span>
                  </span>
                </button>
              )
            })}
        </div>
      )}

      {/* Quantidade do produto */}
      {sheet && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/45" onClick={closeSheet}>
          <div className="w-full rounded-t-3xl bg-[var(--surface)] p-5 pb-[max(1.25rem,env(safe-area-inset-bottom))]" onClick={(event) => event.stopPropagation()}>
            <p className="text-[18px] leading-tight font-bold text-[var(--ink)]">{sheet.row.name}</p>
            <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">
              {sheet.row.barcode ? `${sheet.row.barcode} · ` : ''}No sistema: {formatStockQuantity(sheet.row.available_stock)} {sheet.row.unit || 'un'}
              {valueOf(counted[sheet.row.id]) !== null ? ` · já contado: ${counted[sheet.row.id]}` : ''}
            </p>
            <p className="mt-4 text-[13px] font-semibold text-[var(--ink-soft)]">Quantos você contou?</p>
            <div className="mt-2 flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSheet({ ...sheet, value: fmt(Math.max((parseMoney(sheet.value) ?? 0) - 1, 0)) })}
                className="h-14 w-14 flex-none rounded-2xl bg-[var(--page)] text-[26px] font-bold text-[var(--ink)]"
              >
                −
              </button>
              <input
                ref={inputRef}
                inputMode="decimal"
                value={sheet.value}
                onChange={(event) => setSheet({ ...sheet, value: event.target.value.replace(/[^\d.,]/g, '') })}
                onKeyDown={(event) => event.key === 'Enter' && confirmSheet(false)}
                placeholder="0"
                className="h-14 min-w-0 flex-1 rounded-2xl bg-[var(--page)] text-center text-[28px] font-black text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--blue-300)]"
              />
              <button
                type="button"
                onClick={() => setSheet({ ...sheet, value: fmt((parseMoney(sheet.value) ?? 0) + 1) })}
                className="h-14 w-14 flex-none rounded-2xl bg-[var(--page)] text-[26px] font-bold text-[var(--ink)]"
              >
                +
              </button>
            </div>
            <div className="mt-4 flex flex-col gap-2">
              <button
                type="button"
                disabled={parseMoney(sheet.value) === null}
                onClick={() => confirmSheet(false)}
                className="h-13 rounded-2xl bg-[var(--blue-500)] text-[16px] font-bold text-white disabled:opacity-40"
              >
                Confirmar {sheet.value ? `${sheet.value} ${sheet.row.unit || 'un'}` : ''}
              </button>
              {valueOf(counted[sheet.row.id]) !== null && parseMoney(sheet.value) !== null && (
                <button type="button" onClick={() => confirmSheet(true)} className="h-12 rounded-2xl text-[14px] font-bold text-[var(--blue-700)] ring-1 ring-[var(--blue-300)]">
                  Somar ao já contado ({counted[sheet.row.id]} + {sheet.value} = {fmt((valueOf(counted[sheet.row.id]) ?? 0) + (parseMoney(sheet.value) ?? 0))})
                </button>
              )}
              <div className="flex gap-2">
                {valueOf(counted[sheet.row.id]) !== null && (
                  <button
                    type="button"
                    onClick={() => {
                      setCounted((current) => {
                        const next = { ...current }
                        delete next[sheet.row.id]
                        return next
                      })
                      closeSheet()
                    }}
                    className="h-12 flex-1 rounded-2xl text-[14px] font-semibold text-[var(--red-500)]"
                  >
                    Tirar da contagem
                  </button>
                )}
                <button type="button" onClick={closeSheet} className="h-12 flex-1 rounded-2xl text-[14px] font-semibold text-[var(--ink-soft)]">
                  Cancelar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Mesmo código em mais de um produto */}
      {choose && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/45" onClick={() => setChoose(null)}>
          <div className="w-full rounded-t-3xl bg-[var(--surface)] p-5" onClick={(event) => event.stopPropagation()}>
            <p className="text-[16px] font-bold text-[var(--ink)]">Este código está em mais de um produto</p>
            <div className="mt-3 flex flex-col gap-2">
              {choose.map((row) => (
                <button key={row.id} type="button" onClick={() => pick(row)} className="rounded-2xl border border-[var(--border)] px-4 py-3 text-left text-[14.5px] font-semibold text-[var(--ink)]">
                  {row.name}
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Produto que ainda não controla estoque */}
      {enable && (
        <div className="fixed inset-0 z-50 flex items-end bg-black/45" onClick={() => setEnable(null)}>
          <div className="w-full rounded-t-3xl bg-[var(--surface)] p-5" onClick={(event) => event.stopPropagation()}>
            <p className="text-[17px] font-bold text-[var(--ink)]">{enable.name}</p>
            <p className="mt-1 text-[13.5px] text-[var(--ink-soft)]">
              Este produto ainda não controla estoque. Ativar o controle de estoque dele e contar agora?
            </p>
            <div className="mt-4 flex flex-col gap-2">
              <button type="button" disabled={busy} onClick={() => void enableAndCount()} className="h-13 rounded-2xl bg-[var(--blue-500)] text-[16px] font-bold text-white disabled:opacity-50">
                {busy ? 'Ativando…' : 'Ativar e contar'}
              </button>
              <button type="button" onClick={() => setEnable(null)} className="h-12 rounded-2xl text-[14px] font-semibold text-[var(--ink-soft)]">
                Agora não
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
