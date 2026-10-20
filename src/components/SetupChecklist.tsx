import { isNoVehicleNiche } from '../lib/systemTypes'
import { useCallback, useEffect, useState } from 'react'
import { apiGet, apiPost } from '../lib/api'
import { CheckCircleIcon, ChevronRightIcon } from './icons'
import type { AppPage } from './layout/AppShell'
import type { AuthCompany, AuthSession } from '../lib/auth'

interface ChecklistItem {
  key: string
  title: string
  text: string
  done: boolean
}

interface ChecklistResponse {
  visible: boolean
  done: number
  total: number
  items: ChecklistItem[]
}

const PDV_URL = (import.meta.env.VITE_PDV_URL ?? 'https://pdv.controledois.com.br').replace(/\/+$/, '')
const PDV_NICHES = [21, 22, 14, 15, 16, 17, 8, 12, 10]

interface SetupChecklistProps {
  session: AuthSession
  company: AuthCompany
  onNavigate: (page: AppPage) => void
}

// Primeiros passos que continuam no painel depois do assistente: cada item se marca sozinho quando a empresa faz a coisa.
export function SetupChecklist({ session, company, onNavigate }: SetupChecklistProps) {
  const token = session.token.token
  const [data, setData] = useState<ChecklistResponse | null>(null)
  const [collapsed, setCollapsed] = useState(false)

  const load = useCallback(() => {
    apiGet<ChecklistResponse>('/onboarding/checklist', { companyId: company.id }, token)
      .then(setData)
      .catch(() => setData(null))
  }, [token, company.id])

  useEffect(load, [load])

  if (!data?.visible) return null

  function open(key: string) {
    const type = Number(company.system_type ?? 0)
    switch (key) {
      case 'company_data':
        return onNavigate('companies')
      case 'products':
        return onNavigate('products')
      case 'customers':
        return onNavigate('people')
      case 'vehicles':
        return onNavigate('vehicles')
      case 'glass_order':
        return onNavigate('glass-orders')
      case 'plan':
        return onNavigate('subscription')
      case 'first_sale':
        if (PDV_NICHES.includes(type)) window.open(PDV_URL, '_blank', 'noreferrer')
        else if (type === 6) onNavigate('vehicle-rentals')
        else if (type === 20) onNavigate('glass-orders')
        else if (isNoVehicleNiche(type)) onNavigate('sales')
        else onNavigate('towing-sales')
        return
    }
  }

  async function dismiss() {
    setData(null)
    await apiPost('/onboarding/checklist/dismiss', { company_id: company.id }, token).catch(() => undefined)
  }

  const progress = Math.round((data.done / data.total) * 100)

  return (
    <div className="mx-4 mt-4 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 sm:mx-6 lg:mx-8">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[14px] font-bold text-[var(--ink)]">Primeiros passos</p>
          <p className="text-[12.5px] text-[var(--ink-soft)]">
            {data.done} de {data.total} concluídos. Cada item é marcado sozinho quando você faz.
          </p>
        </div>
        <div className="flex items-center gap-3 text-[12.5px] font-semibold">
          <button type="button" onClick={() => setCollapsed((value) => !value)} className="text-[var(--ink-soft)] hover:text-[var(--ink)]">
            {collapsed ? 'Mostrar' : 'Recolher'}
          </button>
          <button type="button" onClick={() => void dismiss()} className="text-[var(--ink-soft)] hover:text-[var(--red-500)]">
            Não mostrar mais
          </button>
        </div>
      </div>
      <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-[var(--page)]">
        <div className="h-full rounded-full bg-[var(--blue-500)] transition-all" style={{ width: `${progress}%` }} />
      </div>

      {!collapsed && (
        <div className="mt-4 grid gap-2.5 sm:grid-cols-2">
          {data.items.map((item) => (
            <button
              key={item.key}
              type="button"
              disabled={item.done}
              onClick={() => open(item.key)}
              className={`flex items-center justify-between gap-3 rounded-xl border p-3.5 text-left transition ${
                item.done ? 'border-transparent bg-[var(--green-100)]/60' : 'border-[var(--border)] hover:border-[var(--blue-300)]'
              }`}
            >
              <span className="flex items-start gap-3">
                <CheckCircleIcon className={`mt-0.5 h-5 w-5 flex-none ${item.done ? 'text-[var(--green-600)]' : 'text-[var(--border)]'}`} />
                <span>
                  <span className={`block text-[13.5px] font-bold ${item.done ? 'text-[var(--ink-soft)] line-through' : 'text-[var(--ink)]'}`}>{item.title}</span>
                  {!item.done && <span className="mt-0.5 block text-[12px] leading-snug text-[var(--ink-soft)]">{item.text}</span>}
                </span>
              </span>
              {!item.done && <ChevronRightIcon className="h-4 w-4 flex-none text-[var(--muted)]" />}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
