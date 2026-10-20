import { useEffect, useState } from 'react'
import {
  createStockMovement,
  fetchStockSituation,
  formatStockQuantity,
  REASON_LABELS,
  type StockReason,
  type StockSituationRow,
} from '../../lib/stock'
import { parseMoney } from '../../lib/money'
import { formatCurrency } from '../../lib/format'
import { ApiError } from '../../lib/api'
import { SearchSelectField } from '../form/SearchSelectField'
import { Select } from '../form/Select'
import { MoneyField } from '../form/MoneyField'
import { TextField } from '../form/TextField'
import { CloseIcon, DollarSignIcon, FileTextIcon, PlusIcon, TagIcon } from '../icons'
import type { AuthCompany, AuthSession } from '../../lib/auth'

export type StockMovementMode = 'entry' | 'exit'

interface Line {
  key: string
  item: StockSituationRow | null
  quantity: string
  unitCost: string
}

interface StockMovementModalProps {
  open: boolean
  mode: StockMovementMode
  // Item já escolhido (quando o botão vem da linha do item).
  initialItem?: StockSituationRow | null
  session: AuthSession
  company: AuthCompany
  onClose: () => void
  onSaved: (message: string) => void
}

const ENTRY_REASONS: StockReason[] = ['purchase', 'adjustment', 'other']
const EXIT_REASONS: StockReason[] = ['loss', 'expired', 'internal_use', 'adjustment', 'other']

let keySeed = 0
const newLine = (item: StockSituationRow | null = null): Line => ({
  key: `line${Date.now().toString(36)}${++keySeed}`,
  item,
  quantity: '',
  unitCost: item && item.average_cost > 0 ? String(item.average_cost) : '',
})

// Entrada (compra) ou saída (perda, vencimento, consumo) de vários itens de uma vez.
export function StockMovementModal({ open, mode, initialItem, session, company, onClose, onSaved }: StockMovementModalProps) {
  const token = session.token.token
  const [reason, setReason] = useState<StockReason>('purchase')
  const [description, setDescription] = useState('')
  const [lines, setLines] = useState<Line[]>([])
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setReason(mode === 'entry' ? 'purchase' : 'loss')
    setDescription('')
    setLines([newLine(initialItem ?? null)])
    setError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, mode, initialItem?.id])

  if (!open) return null

  const isEntry = mode === 'entry'
  const reasons = isEntry ? ENTRY_REASONS : EXIT_REASONS

  function update(key: string, patch: Partial<Line>) {
    setLines((current) => current.map((line) => (line.key === key ? { ...line, ...patch } : line)))
  }

  async function handleSave() {
    setError(null)
    const filled = lines.filter((line) => line.item || line.quantity)
    if (filled.length === 0) {
      setError('Escolha pelo menos um item.')
      return
    }
    for (const line of filled) {
      if (!line.item) {
        setError('Escolha o item de cada linha.')
        return
      }
      if ((parseMoney(line.quantity) ?? 0) <= 0) {
        setError(`Informe a quantidade de "${line.item.name}".`)
        return
      }
    }

    setSaving(true)
    try {
      await createStockMovement(token, {
        companyId: company.id,
        movementType: isEntry ? 'entry' : 'exit',
        reason,
        description: description.trim() || undefined,
        items: filled.map((line) => ({
          productId: (line.item as StockSituationRow).id,
          quantity: parseMoney(line.quantity) as number,
          unitCost: isEntry && parseMoney(line.unitCost) !== null ? (parseMoney(line.unitCost) as number) : undefined,
        })),
      })
      onSaved(isEntry ? 'Entrada registrada. O estoque já foi atualizado.' : 'Saída registrada. O estoque já foi atualizado.')
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível registrar a movimentação.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 p-4" onClick={saving ? undefined : onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-[720px] flex-col overflow-hidden rounded-2xl bg-[var(--surface)] shadow-[var(--card-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4 p-6 pb-3">
          <div>
            <h2 className="text-[15px] font-bold text-[var(--ink)]">{isEntry ? 'Entrada de estoque' : 'Saída, perda ou consumo'}</h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--ink-soft)]">
              {isEntry
                ? 'Use quando chegar mercadoria (compra). Informe o que chegou, a quantidade e quanto custou cada unidade, para o sistema calcular o custo médio.'
                : 'Use para tirar do estoque o que não foi vendido: perda, quebra, vencimento ou consumo da casa.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            aria-label="Fechar"
            className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)] disabled:opacity-60"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 pb-2">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Motivo</span>
              <Select variant="page" value={reason} onChange={(value) => setReason(value as StockReason)}>
                {reasons.map((value) => (
                  <option key={value} value={value}>
                    {REASON_LABELS[value]}
                  </option>
                ))}
              </Select>
            </div>
            <TextField
              label="Observação (opcional)"
              icon={<FileTextIcon className="h-4 w-4" />}
              placeholder={isEntry ? 'Ex.: Nota 1234 do fornecedor' : 'Ex.: Caiu no chão'}
              value={description}
              onChange={(event) => setDescription(event.target.value)}
            />
          </div>

          <div className="mt-5 flex flex-col gap-3">
            {lines.map((line) => (
              <div key={line.key} className="rounded-xl bg-[var(--page)] p-3.5">
                <div className="flex flex-wrap items-end gap-3">
                  <div className="min-w-[220px] flex-1 basis-[240px]">
                    <SearchSelectField
                      label="Item"
                      placeholder="Buscar produto ou insumo…"
                      selectedLabel={line.item?.name ?? null}
                      selectedSubLabel={
                        line.item
                          ? `Saldo: ${formatStockQuantity(line.item.available_stock)} ${line.item.unit ?? ''}`.trim()
                          : undefined
                      }
                      onSearch={(query) => fetchStockSituation(token, company.id, { search: query, limit: 8 }).then((res) => res.data)}
                      getOptionLabel={(item: StockSituationRow) => item.name}
                      getOptionSubLabel={(item: StockSituationRow) =>
                        `${item.is_ingredient ? 'Insumo' : 'Produto'} · saldo ${formatStockQuantity(item.available_stock)} ${item.unit ?? ''}`.trim()
                      }
                      onSelect={(item: StockSituationRow) =>
                        update(line.key, { item, unitCost: item.average_cost > 0 ? String(item.average_cost) : line.unitCost })
                      }
                      onClear={() => update(line.key, { item: null })}
                    />
                  </div>
                  <div className="w-28">
                    <TextField
                      label={`Qtd${line.item?.unit ? ` (${line.item.unit})` : ''}`}
                      icon={<TagIcon className="h-4 w-4" />}
                      inputMode="decimal"
                      placeholder="0"
                      value={line.quantity}
                      onChange={(event) => update(line.key, { quantity: event.target.value.replace(/[^\d.,]/g, '') })}
                    />
                  </div>
                  {isEntry && (
                    <div className="w-36">
                      <MoneyField
                        label="Custo unitário"
                        icon={<DollarSignIcon className="h-4 w-4" />}
                        value={line.unitCost}
                        onChange={(event) => update(line.key, { unitCost: event.target.value })}
                      />
                    </div>
                  )}
                  {lines.length > 1 && (
                    <button
                      type="button"
                      aria-label="Tirar esta linha"
                      onClick={() => setLines((current) => current.filter((entry) => entry.key !== line.key))}
                      className="mb-1 flex h-9 w-9 flex-none items-center justify-center rounded-lg text-[var(--red-500)] hover:bg-[var(--red-100)]"
                    >
                      <CloseIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
                {isEntry && line.item && line.item.average_cost > 0 && (
                  <p className="mt-2 text-[11.5px] text-[var(--muted)]">Custo médio atual: {formatCurrency(line.item.average_cost)} por {line.item.unit || 'unidade'}.</p>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => setLines((current) => [...current, newLine()])}
              className="flex w-fit items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-bold text-[var(--blue-700)] ring-1 ring-[var(--blue-300)] hover:bg-[var(--blue-100)]"
            >
              <PlusIcon className="h-4 w-4" />
              Adicionar outro item
            </button>
          </div>

          {error && <p className="mt-3 text-[13px] font-medium text-[var(--red-500)]">{error}</p>}
        </div>

        <div className="flex gap-2 p-6 pt-4">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="h-11 flex-1 rounded-xl border border-[var(--border)] text-[13px] font-bold text-[var(--ink-soft)] disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleSave()}
            disabled={saving}
            className="h-11 flex-1 rounded-xl bg-[var(--blue-500)] text-[13px] font-bold text-white hover:bg-[var(--blue-700)] disabled:opacity-60"
          >
            {saving ? 'Salvando…' : isEntry ? 'Registrar entrada' : 'Registrar saída'}
          </button>
        </div>
      </div>
    </div>
  )
}
