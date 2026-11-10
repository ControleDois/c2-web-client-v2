import { useEffect, useState } from 'react'
import { fetchConfig } from '../lib/config'
import type { InspectionChecklistAnswer } from '../lib/vehicleInspections'

export interface InspectionChecklistState {
  enabled: boolean
  items: string[]
  answers: Record<string, boolean | undefined>
  setAnswer: (item: string, checked: boolean) => void
  // Itens ainda sem resposta (a vistoria só salva com todos respondidos)
  missing: string[]
  payload: InspectionChecklistAnswer[] | undefined
}

// Conferência de itens da vistoria (sim/não), ligada em Configurações > Vistorias.
export function useInspectionChecklist(token: string, companyId: string): InspectionChecklistState {
  const [items, setItems] = useState<string[]>([])
  const [enabled, setEnabled] = useState(false)
  const [answers, setAnswers] = useState<Record<string, boolean | undefined>>({})

  useEffect(() => {
    let cancelled = false
    fetchConfig(token, companyId)
      .then((config) => {
        if (cancelled) return
        const list = (config.vehicle_inspection_checklist_items ?? []).filter((item) => item.trim())
        const on = Boolean(config.vehicle_inspection_checklist_enabled) && list.length > 0
        setEnabled(on)
        setItems(on ? list : [])
      })
      .catch(() => {
        if (cancelled) return
        setEnabled(false)
        setItems([])
      })
    return () => {
      cancelled = true
    }
  }, [token, companyId])

  const missing = items.filter((item) => answers[item] === undefined)
  return {
    enabled,
    items,
    answers,
    setAnswer: (item, checked) => setAnswers((current) => ({ ...current, [item]: checked })),
    missing,
    payload: enabled ? items.map((name) => ({ name, checked: answers[name] === true })) : undefined,
  }
}

export function InspectionChecklist({ checklist }: { checklist: InspectionChecklistState }) {
  if (!checklist.enabled) return null
  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-[14px] font-bold text-[var(--ink)]">Conferência</p>
        {checklist.missing.length > 0 && (
          <span className="text-[12px] text-[var(--muted)]">
            {checklist.missing.length} {checklist.missing.length === 1 ? 'item sem resposta' : 'itens sem resposta'}
          </span>
        )}
      </div>
      <div className="flex flex-col divide-y divide-[var(--border)] rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        {checklist.items.map((item) => {
          const answer = checklist.answers[item]
          return (
            <div key={item} className="flex items-center justify-between gap-3 px-3 py-2">
              <span className="min-w-0 flex-1 text-[13.5px] text-[var(--ink)]">{item}</span>
              <div className="flex flex-none gap-1.5">
                <button
                  type="button"
                  onClick={() => checklist.setAnswer(item, true)}
                  aria-pressed={answer === true}
                  className={`h-9 w-14 rounded-lg border text-[13px] font-bold transition ${
                    answer === true
                      ? 'border-[var(--green-600)] bg-[var(--green-600)] text-white'
                      : 'border-[var(--border)] text-[var(--ink-soft)]'
                  }`}
                >
                  Sim
                </button>
                <button
                  type="button"
                  onClick={() => checklist.setAnswer(item, false)}
                  aria-pressed={answer === false}
                  className={`h-9 w-14 rounded-lg border text-[13px] font-bold transition ${
                    answer === false
                      ? 'border-[var(--red-500)] bg-[var(--red-500)] text-white'
                      : 'border-[var(--border)] text-[var(--ink-soft)]'
                  }`}
                >
                  Não
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
