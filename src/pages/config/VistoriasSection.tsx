import { useState } from 'react'
import type { ConfigPayload } from '../../lib/config'
import { PlusIcon, TrashIcon } from '../../components/icons'

interface VistoriasSectionProps {
  value: ConfigPayload
  onChange: (patch: Partial<ConfigPayload>) => void
}

// Sugestão ao ligar a conferência pela primeira vez (o operador edita à vontade).
const SUGGESTED_ITEMS = ['Chave principal', 'Chave reserva', 'Antena', 'Estepe', 'Km', 'Observação']

export function VistoriasSection({ value, onChange }: VistoriasSectionProps) {
  const [draft, setDraft] = useState('')
  const items = value.vehicle_inspection_checklist_items ?? []
  const enabled = Boolean(value.vehicle_inspection_checklist_enabled)

  function setItems(next: string[]) {
    onChange({ vehicle_inspection_checklist_items: next })
  }

  function addItem() {
    const name = draft.trim()
    if (!name || items.some((item) => item.toLowerCase() === name.toLowerCase())) return
    setItems([...items, name])
    setDraft('')
  }

  function move(index: number, delta: number) {
    const target = index + delta
    if (target < 0 || target >= items.length) return
    const next = [...items]
    ;[next[index], next[target]] = [next[target], next[index]]
    setItems(next)
  }

  return (
    <div className="flex flex-col gap-5">
      <label className="flex items-center gap-2.5">
        <input
          type="checkbox"
          checked={Boolean(value.vehicle_inspection_detailed_required)}
          onChange={(event) => onChange({ vehicle_inspection_detailed_required: event.target.checked })}
          className="h-4 w-4 accent-[var(--blue-500)]"
        />
        <span className="text-[13.5px] font-semibold text-[var(--ink)]">Exigir checklist detalhado nas vistorias</span>
      </label>

      <div className="flex flex-col gap-3 rounded-xl border border-[var(--border)] p-4">
        <label className="flex items-start gap-2.5">
          <input
            type="checkbox"
            checked={enabled}
            onChange={(event) => {
              const checked = event.target.checked
              onChange({
                vehicle_inspection_checklist_enabled: checked,
                ...(checked && items.length === 0 ? { vehicle_inspection_checklist_items: SUGGESTED_ITEMS } : {}),
              })
            }}
            className="mt-0.5 h-4 w-4 accent-[var(--blue-500)]"
          />
          <span>
            <span className="block text-[13.5px] font-semibold text-[var(--ink)]">Conferência de itens na vistoria (sim / não)</span>
            <span className="block text-[12.5px] text-[var(--ink-soft)]">
              Na hora da vistoria, cada item abaixo é marcado como Sim ou Não. As respostas saem no PDF da vistoria.
            </span>
          </span>
        </label>

        {enabled && (
          <>
            <div className="flex flex-col gap-1.5">
              {items.length === 0 && <p className="text-[12.5px] text-[var(--muted)]">Nenhum item cadastrado.</p>}
              {items.map((item, index) => (
                <div key={item} className="flex items-center gap-2 rounded-lg bg-[var(--page)] px-3 py-1.5">
                  <span className="min-w-0 flex-1 truncate text-[13.5px] text-[var(--ink)]">{item}</span>
                  <button
                    type="button"
                    onClick={() => move(index, -1)}
                    disabled={index === 0}
                    aria-label="Subir"
                    className="h-7 w-7 rounded-md text-[var(--ink-soft)] hover:bg-[var(--surface)] disabled:opacity-30"
                  >
                    ↑
                  </button>
                  <button
                    type="button"
                    onClick={() => move(index, 1)}
                    disabled={index === items.length - 1}
                    aria-label="Descer"
                    className="h-7 w-7 rounded-md text-[var(--ink-soft)] hover:bg-[var(--surface)] disabled:opacity-30"
                  >
                    ↓
                  </button>
                  <button
                    type="button"
                    onClick={() => setItems(items.filter((_, i) => i !== index))}
                    aria-label={`Remover ${item}`}
                    className="flex h-7 w-7 items-center justify-center rounded-md text-[var(--red-500)] hover:bg-[var(--surface)]"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex gap-2">
              <input
                type="text"
                value={draft}
                onChange={(event) => setDraft(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    event.preventDefault()
                    addItem()
                  }
                }}
                placeholder="Novo item (ex.: Macaco e chave de roda)"
                className="h-10 min-w-0 flex-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 text-[13.5px] text-[var(--ink)] focus:outline-none"
              />
              <button
                type="button"
                onClick={addItem}
                disabled={!draft.trim()}
                className="flex h-10 items-center gap-1.5 rounded-xl bg-[var(--blue-500)] px-4 text-[13px] font-bold text-white disabled:opacity-40"
              >
                <PlusIcon className="h-4 w-4" />
                Adicionar
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
