import { fetchStockSituation, formatStockQuantity, saveRecipe, type RecipeRecord, type StockSituationRow } from '../../lib/stock'
import { parseMoney } from '../../lib/money'
import { formatCurrency } from '../../lib/format'
import { SearchSelectField } from '../form/SearchSelectField'
import { TextField } from '../form/TextField'
import { PlusIcon, TagIcon, TrashIcon } from '../icons'

// Ficha técnica (receita): quanto de cada insumo vai em 1 unidade do produto. A venda desconta esses insumos do estoque.

export interface RecipeLineDraft {
  key: string
  ingredientId: string | null
  name: string
  unit: string | null
  quantity: string
  lossPercent: string
  unitCost: number
  available: number
}

let keySeed = 0
const nextKey = () => `r${Date.now().toString(36)}${++keySeed}`

export const newRecipeLine = (): RecipeLineDraft => ({
  key: nextKey(),
  ingredientId: null,
  name: '',
  unit: null,
  quantity: '',
  lossPercent: '',
  unitCost: 0,
  available: 0,
})

export function draftsFromRecipe(recipe: RecipeRecord | null | undefined): RecipeLineDraft[] {
  return (recipe?.items ?? []).map((item) => ({
    key: nextKey(),
    ingredientId: item.ingredient_id,
    name: item.name,
    unit: item.unit,
    quantity: String(item.quantity),
    lossPercent: item.loss_percent ? String(item.loss_percent) : '',
    unitCost: item.unit_cost,
    available: item.available,
  }))
}

export function recipeCost(lines: RecipeLineDraft[]): number {
  return lines.reduce((sum, line) => {
    const quantity = parseMoney(line.quantity) ?? 0
    const loss = parseMoney(line.lossPercent) ?? 0
    return sum + quantity * (1 + loss / 100) * line.unitCost
  }, 0)
}

// Mensagem do primeiro problema que impede de salvar (ou null).
export function recipeError(lines: RecipeLineDraft[]): string | null {
  for (const line of lines) {
    if (!line.ingredientId) return 'Escolha o insumo de cada linha da ficha técnica (ou tire a linha vazia).'
    if ((parseMoney(line.quantity) ?? 0) <= 0) return `Informe a quantidade de "${line.name}" na ficha técnica.`
    const loss = parseMoney(line.lossPercent) ?? 0
    if (loss < 0 || loss > 100) return `A perda de "${line.name}" deve ficar entre 0% e 100%.`
  }
  return null
}

export function saveRecipeDrafts(token: string, productId: string, lines: RecipeLineDraft[]) {
  return saveRecipe(
    token,
    productId,
    lines.map((line) => ({
      ingredient_id: line.ingredientId as string,
      quantity: parseMoney(line.quantity) as number,
      loss_percent: parseMoney(line.lossPercent) ?? 0,
    }))
  )
}

interface RecipeEditorProps {
  value: RecipeLineDraft[]
  onChange: (next: RecipeLineDraft[]) => void
  token: string
  companyId: string
  productId?: string
  salePrice: number
  // Quantas unidades dá para fazer com o estoque de hoje (vem da ficha já salva).
  producible?: number | null
}

export function RecipeEditor({ value, onChange, token, companyId, productId, salePrice, producible }: RecipeEditorProps) {
  const cost = recipeCost(value)
  const margin = salePrice - cost
  const marginPercent = salePrice > 0 ? (margin / salePrice) * 100 : null
  const update = (key: string, patch: Partial<RecipeLineDraft>) =>
    onChange(value.map((line) => (line.key === key ? { ...line, ...patch } : line)))

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-xl bg-[var(--blue-100)] px-4 py-3 text-[13px] leading-relaxed text-[var(--blue-700)]">
        A ficha técnica diz <strong>quanto de cada insumo vai em 1 unidade</strong> deste produto (por exemplo, 1 pão e 0,15 kg de carne no hambúrguer). Quando você vender, o sistema <strong>desconta os insumos do estoque</strong> em vez do produto pronto, e mostra quanto custa fazer cada um.
      </p>

      {value.length === 0 && (
        <p className="rounded-xl border border-dashed border-[var(--border)] px-4 py-6 text-center text-[13px] text-[var(--muted)]">
          Este produto ainda não tem ficha técnica. Sem ela, a venda desconta o próprio produto do estoque. Toque em "Adicionar insumo" para montar a receita.
        </p>
      )}

      {value.map((line) => {
        const quantity = parseMoney(line.quantity) ?? 0
        const loss = parseMoney(line.lossPercent) ?? 0
        const lineCost = quantity * (1 + loss / 100) * line.unitCost
        return (
          <div key={line.key} className="rounded-xl bg-[var(--page)] p-3.5">
            <div className="flex flex-wrap items-end gap-3">
              <div className="min-w-[220px] flex-1 basis-[240px]">
                <SearchSelectField
                  label="Insumo"
                  placeholder="Buscar insumo ou produto…"
                  selectedLabel={line.ingredientId ? line.name : null}
                  selectedSubLabel={
                    line.ingredientId
                      ? `Em estoque: ${formatStockQuantity(line.available)} ${line.unit ?? ''}`.trim()
                      : undefined
                  }
                  onSearch={(query) =>
                    fetchStockSituation(token, companyId, { search: query, limit: 8 }).then((res) =>
                      res.data.filter((item) => item.id !== productId && !item.has_recipe)
                    )
                  }
                  getOptionLabel={(item: StockSituationRow) => item.name}
                  getOptionSubLabel={(item: StockSituationRow) =>
                    `${item.is_ingredient ? 'Insumo' : 'Produto'} · saldo ${formatStockQuantity(item.available_stock)} ${item.unit ?? ''}`.trim()
                  }
                  onSelect={(item: StockSituationRow) =>
                    update(line.key, {
                      ingredientId: item.id,
                      name: item.name,
                      unit: item.unit ?? null,
                      unitCost: item.average_cost,
                      available: item.available_stock,
                    })
                  }
                  onClear={() => update(line.key, { ingredientId: null, name: '', unit: null, unitCost: 0, available: 0 })}
                />
              </div>
              <div className="w-32">
                <TextField
                  label={`Quantidade${line.unit ? ` (${line.unit})` : ''}`}
                  icon={<TagIcon className="h-4 w-4" />}
                  inputMode="decimal"
                  placeholder="0"
                  value={line.quantity}
                  onChange={(event) => update(line.key, { quantity: event.target.value.replace(/[^\d.,]/g, '') })}
                />
              </div>
              <div className="w-28">
                <TextField
                  label="Perda (%)"
                  icon={<TagIcon className="h-4 w-4" />}
                  inputMode="decimal"
                  placeholder="0"
                  value={line.lossPercent}
                  onChange={(event) => update(line.key, { lossPercent: event.target.value.replace(/[^\d.,]/g, '') })}
                />
              </div>
              <div className="w-24 pb-2.5 text-right">
                <span className="block text-[11px] font-semibold text-[var(--muted)]">Custo</span>
                <span className="text-[14px] font-bold text-[var(--ink)]">{line.unitCost > 0 ? formatCurrency(lineCost) : '—'}</span>
              </div>
              <button
                type="button"
                aria-label="Tirar este insumo"
                onClick={() => onChange(value.filter((entry) => entry.key !== line.key))}
                className="mb-1 flex h-9 w-9 flex-none items-center justify-center rounded-lg text-[var(--red-500)] hover:bg-[var(--red-100)]"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
            {line.ingredientId && line.unitCost <= 0 && (
              <p className="mt-2 text-[11.5px] text-[var(--amber-500)]">
                Este insumo ainda não tem custo. Dê uma entrada de mercadoria com o preço pago para calcular o custo da ficha.
              </p>
            )}
          </div>
        )
      })}

      <button
        type="button"
        onClick={() => onChange([...value, newRecipeLine()])}
        className="flex w-fit items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-bold text-[var(--blue-700)] ring-1 ring-[var(--blue-300)] hover:bg-[var(--blue-100)]"
      >
        <PlusIcon className="h-4 w-4" />
        Adicionar insumo
      </button>

      {value.length > 0 && (
        <div className="grid gap-3 rounded-xl border border-[var(--border)] p-4 sm:grid-cols-2 xl:grid-cols-4">
          <div>
            <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">Custo de produção</p>
            <p className="mt-0.5 text-[18px] font-bold text-[var(--ink)]">{formatCurrency(cost)}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">Preço de venda</p>
            <p className="mt-0.5 text-[18px] font-bold text-[var(--ink)]">{salePrice > 0 ? formatCurrency(salePrice) : '—'}</p>
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">Margem</p>
            <p className={`mt-0.5 text-[18px] font-bold ${salePrice > 0 && margin < 0 ? 'text-[var(--red-500)]' : 'text-[var(--green-600)]'}`}>
              {salePrice > 0 ? `${formatCurrency(margin)}${marginPercent !== null ? ` (${marginPercent.toFixed(1).replace('.', ',')}%)` : ''}` : '—'}
            </p>
          </div>
          <div>
            <p className="text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">Dá para fazer</p>
            <p className="mt-0.5 text-[18px] font-bold text-[var(--ink)]">
              {producible === null || producible === undefined ? '—' : `${producible} un.`}
            </p>
            <p className="text-[11px] text-[var(--muted)]">com o estoque de hoje</p>
          </div>
        </div>
      )}
    </div>
  )
}
