import type { ReactNode } from 'react'
import { Logo } from '../Logo'
import { Header } from './Header'
import {
  GridIcon,
  TruckIcon,
  RouteIcon,
  CoinIcon,
  WalletIcon,
  TagIcon,
  TargetIcon,
  ArrowDownCircleIcon,
  ArrowUpCircleIcon,
  SettingsIcon,
  ChevronRightIcon,
  UserIcon,
  ClipboardCheckIcon,
  TrendUpIcon,
} from '../icons'
import { getCompanyName, type AuthCompany, type AuthSession } from '../../lib/auth'

export type AppPage =
  | 'dashboard'
  | 'people'
  | 'vehicles'
  | 'towing-sales'
  | 'bank-accounts'
  | 'categories'
  | 'cost-centers'
  | 'bills-payable'
  | 'bills-receivable'
  | 'users'
  | 'companies'
  | 'config'
  | 'whatsapp-api'
  | 'contract-templates'
  | 'roles'
  | 'permissions'
  | 'company-groups'
  | 'audit-logs'
  | 'vehicle-inspections'
  | 'towing-collection'
  | 'towing-billing-report'

interface AppShellProps {
  session: AuthSession
  company: AuthCompany
  activePage: AppPage
  onNavigate: (page: AppPage) => void
  onSwitchCompany: () => void
  onLogout: () => void
  children: ReactNode
}

const NAV_GROUPS: { title: string; items: { page: AppPage; label: string; icon: typeof GridIcon }[] }[] = [
  {
    title: 'Principal',
    items: [
      { page: 'dashboard', label: 'Dashboard', icon: GridIcon },
      { page: 'people', label: 'Pessoas', icon: UserIcon },
      { page: 'vehicles', label: 'Veículos', icon: TruckIcon },
      { page: 'towing-sales', label: 'Vendas', icon: CoinIcon },
    ],
  },
  {
    title: 'Financeiro',
    items: [
      { page: 'bank-accounts', label: 'Contas', icon: WalletIcon },
      { page: 'categories', label: 'Categorias', icon: TagIcon },
      { page: 'cost-centers', label: 'Centro de Custo', icon: TargetIcon },
      { page: 'bills-payable', label: 'Contas a Pagar', icon: ArrowDownCircleIcon },
      { page: 'bills-receivable', label: 'Contas a Receber', icon: ArrowUpCircleIcon },
    ],
  },
  {
    title: 'Operação',
    items: [
      { page: 'vehicle-inspections', label: 'Aprovação de Vistorias', icon: ClipboardCheckIcon },
      { page: 'towing-collection', label: 'Busca de Veículos', icon: RouteIcon },
    ],
  },
  {
    title: 'Relatórios',
    items: [{ page: 'towing-billing-report', label: 'Faturamento', icon: TrendUpIcon }],
  },
]

export function AppShell({ session, company, activePage, onNavigate, onSwitchCompany, onLogout, children }: AppShellProps) {
  return (
    <div className="app-shell-root flex h-svh overflow-hidden bg-[var(--page)]">
      <aside className="app-shell-sidebar flex h-full w-[248px] flex-none flex-col gap-1 overflow-y-auto border-r border-[var(--border)] bg-[var(--blue-100)] p-4">
        <div className="flex items-center gap-2.5 px-2 pb-5 pt-1">
          <Logo className="h-8 w-8" />
          <span className="text-[14px] font-bold tracking-tight text-[var(--ink)]">Controle Dois</span>
        </div>

        {NAV_GROUPS.map((group) => (
          <div key={group.title} className="mt-3 first:mt-0">
            <div className="px-2 pb-2 text-[10.5px] font-bold tracking-[0.09em] text-[var(--ink-soft)] opacity-70 uppercase">
              {group.title}
            </div>
            <div className="flex flex-col gap-1">
              {group.items.map(({ page, label, icon: Icon }) => (
                <button
                  key={page}
                  type="button"
                  onClick={() => onNavigate(page)}
                  className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13.5px] font-bold transition ${
                    activePage === page
                      ? 'bg-[var(--blue-500)] text-white shadow-sm'
                      : 'text-[var(--ink-soft)] hover:bg-[var(--surface)]'
                  }`}
                >
                  <Icon className="h-[17px] w-[17px]" />
                  {label}
                </button>
              ))}
            </div>
          </div>
        ))}

        <div className="mt-auto flex flex-col gap-2 pt-4">
          <button
            type="button"
            onClick={onSwitchCompany}
            className="flex items-center gap-2.5 rounded-xl bg-[var(--surface)] p-2.5 text-left transition hover:bg-white"
          >
            <span className="flex h-8 w-8 flex-none items-center justify-center overflow-hidden rounded-lg bg-[var(--blue-100)] text-[var(--blue-700)]">
              {company.people?.file_url ? (
                <img src={company.people.file_url} alt="" className="h-full w-full object-cover" />
              ) : (
                <span className="text-[12px] font-bold">{getCompanyName(company).charAt(0).toUpperCase()}</span>
              )}
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[12.5px] font-bold text-[var(--ink)]">
                {getCompanyName(company)}
              </span>
              <span className="block text-[10.5px] text-[var(--muted)]">Trocar empresa</span>
            </span>
            <ChevronRightIcon className="h-3.5 w-3.5 flex-none text-[var(--muted)]" />
          </button>

          <button
            type="button"
            onClick={() => onNavigate('config')}
            className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left text-[12.5px] font-semibold transition ${
              activePage === 'config' ? 'bg-[var(--blue-500)] text-white shadow-sm' : 'text-[var(--ink-soft)] hover:bg-[var(--surface)]'
            }`}
          >
            <SettingsIcon className="h-3.5 w-3.5" />
            <span className="flex-1 text-left">Configurações</span>
          </button>
        </div>
      </aside>

      <div className="app-shell-content flex h-full min-w-0 flex-1 flex-col overflow-hidden">
        <Header session={session} onNavigate={onNavigate} onLogout={onLogout} />
        <main className="app-shell-main min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
