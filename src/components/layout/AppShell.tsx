import { useState, type ReactNode } from 'react'
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
  CloseIcon,
  BoxIcon,
  KeyIcon,
  CoinIcon as SaleIcon,
  WrenchIcon,
  FileTextIcon,
  MailIcon,
  ClockIcon,
  ArrowUpRightIcon,
} from '../icons'
import { getCompanyName, type AuthCompany, type AuthSession } from '../../lib/auth'
import {
  isLocacaoVeiculos,
  isEmprestimo,
  isPadaria,
  isNoVehicleNiche,
  isSoftwareHouse,
  isGaragemInvestidor,
  isDistribuidoraBebidas,
} from '../../lib/systemTypes'

export type AppPage =
  | 'dashboard'
  | 'people'
  | 'vehicles'
  | 'products'
  | 'vehicle-rentals'
  | 'vehicle-sales'
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
  | 'rental-types'
  | 'roles'
  | 'permissions'
  | 'company-groups'
  | 'audit-logs'
  | 'vehicle-inspections'
  | 'towing-collection'
  | 'vehicle-rental-operations'
  | 'towing-billing-report'
  | 'order-services'
  | 'standalone-inspection'
  | 'loan-customer-verifications'
  | 'financing-sales'
  | 'purchase-management'
  | 'purchase-requests'
  | 'nfes'
  | 'nfe-manifests'
  | 'nfe-nature-operations'
  | 'nfe-taxations'
  | 'nfses'
  | 'licenses'
  | 'time-clock'
  | 'support-contracts'
  | 'support-visits'
  | 'investments'
  | 'delivery-couriers'
  | 'delivery-neighborhoods'

interface AppShellProps {
  session: AuthSession
  company: AuthCompany
  activePage: AppPage
  onNavigate: (page: AppPage) => void
  onSwitchCompany: () => void
  onGoToMatrixCompany: () => void
  onLogout: () => void
  purchaseManagementEnabled?: boolean
  nfeModuleEnabled?: boolean
  nfseModuleEnabled?: boolean
  timeClockEnabled?: boolean
  children: ReactNode
}

// Item do menu: tela interna do painel (page) ou link externo que abre em outra
// aba (href) - o quadro de pedidos do delivery é um projeto separado.
type NavItem = { page: AppPage; label: string; icon: typeof GridIcon } | { href: string; label: string; icon: typeof GridIcon }
type NavGroup = { title: string; items: NavItem[] }

const DELIVERY_BOARD_URL = import.meta.env.VITE_DELIVERY_URL ?? 'https://delivery.controledois.com.br'

function buildNavGroups(
  systemType?: number,
  purchaseManagementEnabled?: boolean,
  nfeModuleEnabled?: boolean,
  timeClockEnabled?: boolean,
  nfseModuleEnabled?: boolean
): NavGroup[] {
  const emprestimo = isEmprestimo(systemType)
  const padaria = isPadaria(systemType)
  const garagemInvestidor = isGaragemInvestidor(systemType)
  // Cobre Pizzaria/Lanchonete/Hamburgeria/Padaria - todo nicho "sem veículo"
  // (sem grupo Operação, sem relatório de faturamento do guincho). Padaria
  // ainda tem um menu Principal próprio (sem Vendas), tratado à parte abaixo.
  const noVehicleNiche = isNoVehicleNiche(systemType)

  const principalItems = emprestimo
    ? [
        { page: 'dashboard' as const, label: 'Dashboard', icon: GridIcon },
        { page: 'people' as const, label: 'Pessoas', icon: UserIcon },
        { page: 'financing-sales' as const, label: 'Venda', icon: SaleIcon },
      ]
    : isLocacaoVeiculos(systemType)
      ? [
          { page: 'dashboard' as const, label: 'Dashboard', icon: GridIcon },
          { page: 'people' as const, label: 'Pessoas', icon: UserIcon },
          { page: 'vehicles' as const, label: 'Veículos', icon: TruckIcon },
          { page: 'products' as const, label: 'Produtos e Serviços', icon: BoxIcon },
          { page: 'vehicle-rentals' as const, label: 'Aluguel', icon: KeyIcon },
          { page: 'vehicle-sales' as const, label: 'Venda', icon: SaleIcon },
          { page: 'order-services' as const, label: 'Ordens de Serviço', icon: WrenchIcon },
        ]
      : garagemInvestidor
        ? [
            { page: 'dashboard' as const, label: 'Dashboard', icon: GridIcon },
            { page: 'people' as const, label: 'Pessoas', icon: UserIcon },
            { page: 'vehicles' as const, label: 'Veículos', icon: TruckIcon },
            { page: 'vehicle-sales' as const, label: 'Venda', icon: SaleIcon },
            { page: 'investments' as const, label: 'Investimentos', icon: TrendUpIcon },
          ]
      : padaria
        ? [
            { page: 'dashboard' as const, label: 'Dashboard', icon: GridIcon },
            { page: 'people' as const, label: 'Pessoas', icon: UserIcon },
            { page: 'products' as const, label: 'Produtos', icon: BoxIcon },
          ]
        : noVehicleNiche
          ? [
              { page: 'dashboard' as const, label: 'Dashboard', icon: GridIcon },
              { page: 'people' as const, label: 'Pessoas', icon: UserIcon },
              { page: 'products' as const, label: 'Produtos e Serviços', icon: BoxIcon },
              { page: 'towing-sales' as const, label: 'Vendas', icon: CoinIcon },
            ]
          : [
              { page: 'dashboard' as const, label: 'Dashboard', icon: GridIcon },
              { page: 'people' as const, label: 'Pessoas', icon: UserIcon },
              { page: 'vehicles' as const, label: 'Veículos', icon: TruckIcon },
              { page: 'towing-sales' as const, label: 'Vendas', icon: CoinIcon },
            ]

  const groups: NavGroup[] = [
    { title: 'Principal', items: principalItems },
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
  ]

  // Distribuidora de bebidas: pedidos de delivery (iFood, Zé Delivery e
  // cardápio próprio) acompanhados no quadro do projeto c2-web-delivery.
  if (isDistribuidoraBebidas(systemType)) {
    groups.splice(1, 0, {
      title: 'Delivery',
      items: [
        { href: DELIVERY_BOARD_URL, label: 'Pedidos de Delivery', icon: TruckIcon },
        { page: 'delivery-couriers' as const, label: 'Entregadores', icon: UserIcon },
        { page: 'delivery-neighborhoods' as const, label: 'Bairros e taxas', icon: RouteIcon },
      ],
    })
  }

  // Grupo exclusivo do nicho SoftwareHouse/TI - contratos de suporte
  // recorrente e visitas técnicas (coleta de equipamento/atendimento no
  // local), o equivalente de vistoria só que vinculado à pessoa, não ao
  // veículo. Gate específico (não usa noVehicleNiche) pra não vazar pra
  // Pizzaria/Lanchonete/Hamburgeria/Padaria.
  if (isSoftwareHouse(systemType)) {
    groups.push({
      title: 'Suporte Técnico',
      items: [
        { page: 'support-contracts', label: 'Contratos de Suporte', icon: FileTextIcon },
        { page: 'support-visits', label: 'Visitas Técnicas', icon: ClipboardCheckIcon },
      ],
    })
  }

  // Empréstimo, os nichos sem veículo (Pizzaria/Lanchonete/Hamburgeria/
  // Padaria) e Garagem do Investidor não usam o grupo "Operação" (vistoria/
  // busca/entrega de veículo é fluxo de locadora/guincho, não de compra e
  // revenda) — empréstimo não tem nenhum grupo extra próprio.
  if (!emprestimo && !noVehicleNiche && !garagemInvestidor) {
    groups.push({
      title: 'Operação',
      items: [
        { page: 'vehicle-inspections', label: 'Aprovação de Vistorias', icon: ClipboardCheckIcon },
        isLocacaoVeiculos(systemType)
          ? { page: 'vehicle-rental-operations', label: 'Entrega e Devoluções', icon: RouteIcon }
          : { page: 'towing-collection', label: 'Busca de Veículos', icon: RouteIcon },
      ],
    })
  }

  if (purchaseManagementEnabled) {
    groups.push({
      title: 'Compras',
      items: [{ page: 'purchase-management', label: 'Gestão de Compras', icon: BoxIcon }],
    })
  }

  if (timeClockEnabled) {
    groups.push({
      title: 'Ponto',
      items: [{ page: 'time-clock', label: 'Controle de Ponto', icon: ClockIcon }],
    })
  }

  if (nfeModuleEnabled || nfseModuleEnabled) {
    groups.push({
      title: 'Fiscal',
      items: [
        ...(nfeModuleEnabled
          ? [
              { page: 'nfes' as const, label: 'Notas Fiscais', icon: FileTextIcon },
              { page: 'nfe-manifests' as const, label: 'Manifesto NF-e', icon: MailIcon },
              { page: 'nfe-nature-operations' as const, label: 'Natureza de Operação', icon: TagIcon },
              { page: 'nfe-taxations' as const, label: 'Tributação', icon: TargetIcon },
            ]
          : []),
        ...(nfseModuleEnabled
          ? [{ page: 'nfses' as const, label: 'Notas de Serviço', icon: FileTextIcon }]
          : []),
      ],
    })
  }

  // O relatório de faturamento é específico do fluxo de guincho (TowingSale)
  // — não se aplica a nichos sem veículo (Pizzaria/Lanchonete/Hamburgeria/
  // Padaria), ao Empréstimo (venda financiada, sem TowingSale nenhum) nem à
  // Garagem do Investidor (usa VehicleSaleContract, não TowingSale).
  if (!noVehicleNiche && !emprestimo && !garagemInvestidor) {
    groups.push({
      title: 'Relatórios',
      items: [{ page: 'towing-billing-report', label: 'Faturamento', icon: TrendUpIcon }],
    })
  }

  return groups
}

export function AppShell({
  session,
  company,
  activePage,
  onNavigate,
  onSwitchCompany,
  onGoToMatrixCompany,
  onLogout,
  purchaseManagementEnabled,
  nfeModuleEnabled,
  nfseModuleEnabled,
  timeClockEnabled,
  children,
}: AppShellProps) {
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const navGroups = buildNavGroups(
    company.system_type,
    purchaseManagementEnabled,
    nfeModuleEnabled,
    timeClockEnabled,
    nfseModuleEnabled
  )

  function handleNavigate(page: AppPage) {
    onNavigate(page)
    setMobileNavOpen(false)
  }

  function handleSwitchCompany() {
    onSwitchCompany()
    setMobileNavOpen(false)
  }

  return (
    <div className="app-shell-root flex h-svh overflow-hidden bg-[var(--page)]">
      {mobileNavOpen && (
        <div
          onClick={() => setMobileNavOpen(false)}
          className="fixed inset-0 z-40 bg-black/40 lg:hidden"
          aria-hidden="true"
        />
      )}

      <aside
        className={`app-shell-sidebar fixed inset-y-0 left-0 z-50 flex h-full w-[248px] flex-none flex-col gap-1 overflow-y-auto border-r border-[var(--border)] bg-[var(--blue-100)] p-4 transition-transform duration-200 ease-out lg:static lg:translate-x-0 ${
          mobileNavOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center gap-2.5 px-2 pb-5 pt-1">
          <Logo className="h-8 w-8" />
          <span className="flex-1 text-[14px] font-bold tracking-tight text-[var(--ink)]">Controle Dois</span>
          <button
            type="button"
            onClick={() => setMobileNavOpen(false)}
            aria-label="Fechar menu"
            className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-[var(--ink-soft)] hover:bg-[var(--surface)] lg:hidden"
          >
            <CloseIcon className="h-4.5 w-4.5" />
          </button>
        </div>

        {navGroups.map((group) => (
          <div key={group.title} className="mt-3 first:mt-0">
            <div className="px-2 pb-2 text-[10.5px] font-bold tracking-[0.09em] text-[var(--ink-soft)] opacity-70 uppercase">
              {group.title}
            </div>
            <div className="flex flex-col gap-1">
              {group.items.map((item) => {
                const Icon = item.icon

                if ('href' in item) {
                  return (
                    <a
                      key={item.href}
                      href={item.href}
                      target="_blank"
                      rel="noreferrer"
                      onClick={() => setMobileNavOpen(false)}
                      className="flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13.5px] font-bold text-[var(--ink-soft)] transition hover:bg-[var(--surface)]"
                    >
                      <Icon className="h-[17px] w-[17px]" />
                      <span className="flex-1">{item.label}</span>
                      <ArrowUpRightIcon className="h-3.5 w-3.5 opacity-60" />
                    </a>
                  )
                }

                return (
                  <button
                    key={item.page}
                    type="button"
                    onClick={() => handleNavigate(item.page)}
                    className={`flex items-center gap-2.5 rounded-xl px-3 py-2.5 text-left text-[13.5px] font-bold transition ${
                      activePage === item.page
                        ? 'bg-[var(--blue-500)] text-white shadow-sm'
                        : 'text-[var(--ink-soft)] hover:bg-[var(--surface)]'
                    }`}
                  >
                    <Icon className="h-[17px] w-[17px]" />
                    {item.label}
                  </button>
                )
              })}
            </div>
          </div>
        ))}

        <div className="mt-auto flex flex-col gap-2 pt-4">
          <button
            type="button"
            onClick={handleSwitchCompany}
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
            onClick={() => handleNavigate('config')}
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
        <Header
          session={session}
          company={company}
          onNavigate={onNavigate}
          onGoToMatrixCompany={onGoToMatrixCompany}
          onOpenMobileNav={() => setMobileNavOpen(true)}
          onLogout={onLogout}
        />
        <main className="app-shell-main min-h-0 flex-1 overflow-y-auto">{children}</main>
      </div>
    </div>
  )
}
