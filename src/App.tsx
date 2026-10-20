import { useEffect, useState, type ReactNode } from 'react'
import { LoginPage } from './pages/LoginPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { SignupPage } from './pages/SignupPage'
import { CompanySelectionPage } from './pages/CompanySelectionPage'
import { DashboardPage } from './pages/DashboardPage'
import { RentalDashboardPage } from './pages/RentalDashboardPage'
import { LoanDashboardPage } from './pages/LoanDashboardPage'
import { GaragemDashboardPage } from './pages/GaragemDashboardPage'
import { StandaloneInspectionPage } from './pages/StandaloneInspectionPage'
import { PeoplePage } from './pages/PeoplePage'
import { PeopleFormPage } from './pages/PeopleFormPage'
import { VehiclesPage } from './pages/VehiclesPage'
import { VehicleFormPage } from './pages/VehicleFormPage'
import { ProductsPage } from './pages/ProductsPage'
import { ProductFormPage } from './pages/ProductFormPage'
import { VehicleRentalsPage } from './pages/VehicleRentalsPage'
import { VehicleRentalFormPage } from './pages/VehicleRentalFormPage'
import { VehicleSalesPage } from './pages/VehicleSalesPage'
import { VehicleSaleFormPage } from './pages/VehicleSaleFormPage'
import { OrderServicesPage } from './pages/OrderServicesPage'
import { OrderServiceFormPage } from './pages/OrderServiceFormPage'
import { TowingSalesPage } from './pages/TowingSalesPage'
import { SalesPage } from './pages/SalesPage'
import { StockPage } from './pages/StockPage'
import { StockMovementsPage } from './pages/StockMovementsPage'
import { StockInventoriesPage } from './pages/StockInventoriesPage'
import { StockInventoryFormPage } from './pages/StockInventoryFormPage'
import { SaleFormPage } from './pages/SaleFormPage'
import { PDV_URL } from './lib/pdv'
import { TowingSaleFormPage } from './pages/TowingSaleFormPage'
import { BankAccountsPage } from './pages/BankAccountsPage'
import { BankAccountFormPage } from './pages/BankAccountFormPage'
import { CategoriesPage } from './pages/CategoriesPage'
import { CategoryFormPage } from './pages/CategoryFormPage'
import { CostCentersPage } from './pages/CostCentersPage'
import { CostCenterFormPage } from './pages/CostCenterFormPage'
import { DeliveryCouriersPage } from './pages/DeliveryCouriersPage'
import { CatalogPage } from './pages/CatalogPage'
import { IfoodStorePage } from './pages/IfoodStorePage'
import { DeliveryNeighborhoodsPage } from './pages/DeliveryNeighborhoodsPage'
import { BillsPage } from './pages/BillsPage'
import { BillFormPage } from './pages/BillFormPage'
import { UsersPage } from './pages/UsersPage'
import { UserFormPage } from './pages/UserFormPage'
import { CompaniesPage } from './pages/CompaniesPage'
import { CompanyFormPage } from './pages/CompanyFormPage'
import { WhatsappApiPage } from './pages/WhatsappApiPage'
import { ConfigPage } from './pages/ConfigPage'
import { fetchConfig } from './lib/config'
import { ContractTemplatesPage } from './pages/ContractTemplatesPage'
import { ContractTemplateFormPage } from './pages/ContractTemplateFormPage'
import { RentalTypesPage } from './pages/RentalTypesPage'
import { GlassTypesPage } from './pages/glass/GlassTypesPage'
import { GlassTypeFormPage } from './pages/glass/GlassTypeFormPage'
import { GlassModelsPage } from './pages/glass/GlassModelsPage'
import { GlassModelFormPage } from './pages/glass/GlassModelFormPage'
import { GlassProfilesPage } from './pages/glass/GlassProfilesPage'
import { GlassProfileFormPage } from './pages/glass/GlassProfileFormPage'
import { GlassAccessoriesPage } from './pages/glass/GlassAccessoriesPage'
import { GlassAccessoryFormPage } from './pages/glass/GlassAccessoryFormPage'
import { GlassColorsPage } from './pages/glass/GlassColorsPage'
import { GlassColorFormPage } from './pages/glass/GlassColorFormPage'
import { GlassOrdersPage } from './pages/glass/GlassOrdersPage'
import { GlassOrderFormPage } from './pages/glass/GlassOrderFormPage'
import { GlassProductionPage } from './pages/glass/GlassProductionPage'
import { GlassDashboardPage } from './pages/glass/GlassDashboardPage'
import { MerceariaDashboardPage } from './pages/MerceariaDashboardPage'
import { PrintersPage } from './pages/PrintersPage'
import { AppReleasesPage } from './pages/AppReleasesPage'
import { BlogPostsPage } from './pages/BlogPostsPage'
import { OnboardingPage } from './pages/OnboardingPage'
import { LicenseBlockedPage } from './pages/LicenseBlockedPage'
import { TrialBanner } from './components/TrialBanner'
import { UpgradeModal } from './components/UpgradeModal'
import { SetupChecklist } from './components/SetupChecklist'
import { SubscriptionPage } from './pages/SubscriptionPage'
import { PlansPage } from './pages/PlansPage'
import { PlanFormPage } from './pages/PlanFormPage'
import { peekPendingPlan, rememberPendingPlan, takePendingPlan, type SubscriptionSummary } from './lib/subscription'
import { isLicenseBlocked } from './lib/licenseState'
import type { OnboardingResult } from './lib/onboarding'
import { BlogPostFormPage } from './pages/BlogPostFormPage'
import { SaleTokensPage } from './pages/SaleTokensPage'
import { PrinterFormPage } from './pages/PrinterFormPage'
import { GlassSchedulePage } from './pages/glass/GlassSchedulePage'
import { RentalTypeFormPage } from './pages/RentalTypeFormPage'
import { NfesPage } from './pages/NfesPage'
import { NfeFormPage } from './pages/NfeFormPage'
import { TasksPage } from './pages/TasksPage'
import { NfsesPage } from './pages/NfsesPage'
import { NfseFormPage } from './pages/NfseFormPage'
import { InvestmentsPage } from './pages/InvestmentsPage'
import { InvestmentFormPage } from './pages/InvestmentFormPage'
import { NfeManifestsPage } from './pages/NfeManifestsPage'
import { NfeNatureOperationsPage } from './pages/NfeNatureOperationsPage'
import { NfeNatureOperationFormPage } from './pages/NfeNatureOperationFormPage'
import { NfeTaxationsPage } from './pages/NfeTaxationsPage'
import { NfeTaxationFormPage } from './pages/NfeTaxationFormPage'
import { RolesPage } from './pages/RolesPage'
import { RoleFormPage } from './pages/RoleFormPage'
import { PermissionsPage } from './pages/PermissionsPage'
import { PermissionFormPage } from './pages/PermissionFormPage'
import { CompanyGroupsPage } from './pages/CompanyGroupsPage'
import { CompanyGroupFormPage } from './pages/CompanyGroupFormPage'
import { LicensesPage } from './pages/LicensesPage'
import { LicenseNotice } from './components/LicenseNotice'
import { LicenseFormPage } from './pages/LicenseFormPage'
import { AuditLogsPage } from './pages/AuditLogsPage'
import { VehicleInspectionsPage } from './pages/VehicleInspectionsPage'
import { SupportContractsPage } from './pages/SupportContractsPage'
import { SupportContractFormPage } from './pages/SupportContractFormPage'
import { SupportVisitsPage } from './pages/SupportVisitsPage'
import { SupportVisitFormPage } from './pages/SupportVisitFormPage'
import { LoanCustomerVerificationsPage } from './pages/LoanCustomerVerificationsPage'
import { FinancingSalesPage } from './pages/FinancingSalesPage'
import { FinancingFormPage } from './pages/FinancingFormPage'
import type { Modality, SalesStatusFilter } from './lib/loanModalities'
import { TowingCollectionPage } from './pages/TowingCollectionPage'
import { VehicleRentalOperationsPage } from './pages/VehicleRentalOperationsPage'
import { PurchaseManagementPage } from './pages/PurchaseManagementPage'
import { PurchaseRequestsPage } from './pages/PurchaseRequestsPage'
import { TowingBillingReportPage } from './pages/TowingBillingReportPage'
import { TimeClockPage } from './pages/TimeClockPage'
import { AppShell, type AppPage } from './components/layout/AppShell'
import { ThemeToggle } from './components/ThemeToggle'
import { useEntityView } from './hooks/useEntityView'
import {
  loadSession,
  saveSession,
  clearSession,
  loadActiveCompany,
  saveActiveCompany,
  clearActiveCompany,
  getUserCompanies,
  fetchMyCompanies,
  type AuthSession,
  type AuthCompany,
} from './lib/auth'
import { isLocacaoVeiculos, isEmprestimo, isGaragemInvestidor, isVidracaria, isNoVehicleNiche, hasStockControl, SYSTEM_TYPE_LABELS } from './lib/systemTypes'

type Screen = 'login' | 'forgot-password' | 'signup'

function App() {
  const [session, setSession] = useState<AuthSession | null>(() => loadSession())
  const [activeCompany, setActiveCompany] = useState<AuthCompany | null>(() => loadActiveCompany())
  // O site leva quem quer testar para ?cadastro=1: abre direto na criação de conta.
  const [screen, setScreen] = useState<Screen>(() =>
    new URLSearchParams(window.location.search).has('cadastro') ? 'signup' : 'login'
  )
  const [page, setPage] = useState<AppPage>('dashboard')
  // Plano escolhido no site (?plano=...&ciclo=...): guardado até a pessoa criar a conta e chegar na compra.
  const [pendingPlan, setPendingPlan] = useState(() => {
    const params = new URLSearchParams(window.location.search)
    const slug = params.get('plano')
    if (slug) rememberPendingPlan(slug, ['anual', 'yearly'].includes(params.get('ciclo') ?? '') ? 'yearly' : 'monthly')
    return peekPendingPlan()
  })
  const [switchingCompany, setSwitchingCompany] = useState(false)
  const [purchaseManagementEnabled, setPurchaseManagementEnabled] = useState(false)
  const [nfeModuleEnabled, setNfeModuleEnabled] = useState(false)
  const [nfseModuleEnabled, setNfseModuleEnabled] = useState(false)
  const [timeClockEnabled, setTimeClockEnabled] = useState(false)
  const [configVersion, setConfigVersion] = useState(0)

  useEffect(() => {
    if (!session || !activeCompany) {
      setPurchaseManagementEnabled(false)
      setNfeModuleEnabled(false)
      setNfseModuleEnabled(false)
      setTimeClockEnabled(false)
      return
    }
    let cancelled = false
    fetchConfig(session.token.token, activeCompany.id)
      .then((config) => {
        if (!cancelled) {
          setPurchaseManagementEnabled(Boolean(config.purchase_management_enabled))
          setNfeModuleEnabled(Boolean(config.nfe_module_enabled))
          setNfseModuleEnabled(Boolean(config.nfse_module_enabled))
          setTimeClockEnabled(Boolean(config.time_clock_enabled))
        }
      })
      .catch(() => {
        if (!cancelled) {
          setPurchaseManagementEnabled(false)
          setNfeModuleEnabled(false)
          setNfseModuleEnabled(false)
          setTimeClockEnabled(false)
        }
      })
    return () => {
      cancelled = true
    }
  }, [session, activeCompany, configVersion])

  const peopleView = useEntityView()
  const vehiclesView = useEntityView()
  const productsView = useEntityView()
  const vehicleRentalsView = useEntityView()
  const vehicleSalesView = useEntityView()
  const financingSalesView = useEntityView()
  const [financingInitialModality, setFinancingInitialModality] = useState<Modality>('price')
  const [financingSalesFilter, setFinancingSalesFilter] = useState<SalesStatusFilter>('all')
  const orderServicesView = useEntityView()
  const towingSalesView = useEntityView()
  const bankAccountsView = useEntityView()
  const categoriesView = useEntityView()
  const costCentersView = useEntityView()
  const billsPayableView = useEntityView()
  const billsReceivableView = useEntityView()
  const usersView = useEntityView()
  const companiesView = useEntityView()
  const contractTemplatesView = useEntityView()
  const rentalTypesView = useEntityView()
  const rolesView = useEntityView()
  const permissionsView = useEntityView()
  const companyGroupsView = useEntityView()
  const licensesView = useEntityView()
  const nfesView = useEntityView()
  const nfeNatureOperationsView = useEntityView()
  const nfeTaxationsView = useEntityView()
  const nfsesView = useEntityView()
  const supportContractsView = useEntityView()
  const supportVisitsView = useEntityView()
  const investmentsView = useEntityView()
  const printersView = useEntityView()
  const blogPostsView = useEntityView()
  const plansView = useEntityView()
  const glassTypesView = useEntityView()
  const glassModelsView = useEntityView()
  const glassProfilesView = useEntityView()
  const glassAccessoriesView = useEntityView()
  const glassColorsView = useEntityView()
  const glassOrdersView = useEntityView()
  const salesView = useEntityView()
  const stockInventoriesView = useEntityView()
  const [newIngredient, setNewIngredient] = useState(false)
  const [stockProduct, setStockProduct] = useState<{ id: string; name: string } | null>(null)

  const entityViews = {
    people: peopleView,
    vehicles: vehiclesView,
    products: productsView,
    'vehicle-rentals': vehicleRentalsView,
    'vehicle-sales': vehicleSalesView,
    'financing-sales': financingSalesView,
    'order-services': orderServicesView,
    'towing-sales': towingSalesView,
    'bank-accounts': bankAccountsView,
    categories: categoriesView,
    'cost-centers': costCentersView,
    'bills-payable': billsPayableView,
    'bills-receivable': billsReceivableView,
    users: usersView,
    companies: companiesView,
    'contract-templates': contractTemplatesView,
    'rental-types': rentalTypesView,
    roles: rolesView,
    permissions: permissionsView,
    'company-groups': companyGroupsView,
    licenses: licensesView,
    nfes: nfesView,
    'nfe-nature-operations': nfeNatureOperationsView,
    'nfe-taxations': nfeTaxationsView,
    nfses: nfsesView,
    'support-contracts': supportContractsView,
    'support-visits': supportVisitsView,
    investments: investmentsView,
    printers: printersView,
    'blog-posts': blogPostsView,
    plans: plansView,
    'glass-types': glassTypesView,
    'glass-models': glassModelsView,
    'glass-profiles': glassProfilesView,
    'glass-accessories': glassAccessoriesView,
    'glass-colors': glassColorsView,
    'glass-orders': glassOrdersView,
    sales: salesView,
    'stock-inventories': stockInventoriesView,
  } as const

  function handleLoginSuccess(newSession: AuthSession) {
    saveSession(newSession)
    setSession(newSession)

    const companies = getUserCompanies(newSession)
    if (companies.length === 1) {
      saveActiveCompany(companies[0])
      setActiveCompany(companies[0])
    }
  }

  function handleSelectCompany(company: AuthCompany) {
    saveActiveCompany(company)
    setActiveCompany(company)
  }

  // Atalho da Header pra usuário Master pular direto pra empresa matriz
  // (Controle Dois), sem passar pela tela de seleção de empresas.
  function handleGoToMatrixCompany() {
    if (!session) return
    const matrixCompany = getUserCompanies(session).find((c) => c.is_master)
    if (!matrixCompany) return

    setPage('dashboard')
    resetAllViews()
    handleSelectCompany(matrixCompany)
  }

  function resetAllViews() {
    Object.values(entityViews).forEach((view) => view.reset())
  }

  async function handleSwitchCompany() {
    clearActiveCompany()
    setActiveCompany(null)
    setPage('dashboard')
    resetAllViews()

    if (!session) return

    // Recarrega as empresas vinculadas ao usuário (podem ter mudado desde o
    // login) e, se sobrar só uma, entra direto nela em vez de mostrar a
    // tela de seleção pra uma escolha óbvia.
    setSwitchingCompany(true)
    try {
      const { companies } = await fetchMyCompanies(session.token.token)
      const updatedSession: AuthSession = { ...session, user: { ...session.user, companies } }
      saveSession(updatedSession)
      setSession(updatedSession)

      if (companies.length === 1) {
        handleSelectCompany(companies[0])
      }
    } catch {
      // Se a atualização falhar, segue com a lista antiga (já em sessão)
      // em vez de travar a troca de empresa.
    } finally {
      setSwitchingCompany(false)
    }
  }

  // Junta mudanças na empresa em uso (passo a passo, plano contratado) e também na sessão.
  function patchActiveCompany(patch: Partial<AuthCompany>) {
    if (!session || !activeCompany) return
    const nextCompany = { ...activeCompany, ...patch } as AuthCompany
    saveActiveCompany(nextCompany)
    setActiveCompany(nextCompany)

    const nextSession = {
      ...session,
      user: {
        ...session.user,
        companies: getUserCompanies(session).map((item) => (item.id === nextCompany.id ? { ...item, ...patch } : item)),
      },
    } as AuthSession
    saveSession(nextSession)
    setSession(nextSession)
  }

  function handleOnboardingResult(result: OnboardingResult) {
    if (!activeCompany) return
    patchActiveCompany({
      system_type: result.system_type,
      onboarding_completed_at: result.onboarding_completed_at,
      people: { ...(activeCompany.people ?? {}), ...result.people },
    })
  }

  // Pagamento do plano confirmado: libera a empresa na hora, sem precisar sair e entrar de novo.
  function handleSubscriptionActivated(summary: SubscriptionSummary) {
    patchActiveCompany({
      license_status: summary.status,
      license_expires_at: summary.expires_at,
      plan_id: summary.plan?.id ?? null,
      plan_cycle: summary.cycle,
    })
  }

  // Quem já tem conta e chegou do site escolhendo um plano vai direto para a compra (depois do assistente, se ainda faltar).
  useEffect(() => {
    if (!session || !activeCompany || !pendingPlan) return
    if (activeCompany.onboarding_completed_at === null && !activeCompany.is_master) return
    setPage('subscription')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session, activeCompany?.id, pendingPlan])

  function handleLogout() {
    clearSession()
    setSession(null)
    setActiveCompany(null)
    setScreen('login')
    setPage('dashboard')
    resetAllViews()
  }

  function handleNavigate(nextPage: AppPage) {
    setPage(nextPage)
    if (nextPage in entityViews) {
      entityViews[nextPage as keyof typeof entityViews].reset()
    }
  }

  let content: ReactNode

  if (session && switchingCompany) {
    content = (
      <div className="flex h-svh items-center justify-center bg-[var(--page)]">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--blue-300)] border-t-[var(--blue-500)]" />
      </div>
    )
  } else if (session && activeCompany && isLicenseBlocked(activeCompany)) {
    // Teste grátis acabou ou assinatura bloqueada: o servidor também barra as chamadas.
    content = (
      <div className="min-h-svh bg-[var(--page)]">
        <LicenseNotice session={session} company={activeCompany} />
        <LicenseBlockedPage
          session={session}
          company={activeCompany}
          onSwitchCompany={handleSwitchCompany}
          onLogout={handleLogout}
          onActivated={handleSubscriptionActivated}
          initialPlan={pendingPlan}
          onPlanConsumed={() => {
            takePendingPlan()
            setPendingPlan(null)
          }}
        />
      </div>
    )
  } else if (session && activeCompany && activeCompany.onboarding_completed_at === null && !activeCompany.is_master) {
    // Só empresa recém-criada (null); empresas antigas não têm o campo ou já estão concluídas.
    content = (
      <OnboardingPage
        session={session}
        company={activeCompany}
        onCompanyChange={handleOnboardingResult}
        onFinish={(destination) => handleNavigate(pendingPlan ? 'subscription' : (destination ?? 'dashboard'))}
        onLogout={handleLogout}
      />
    )
  } else if (session && activeCompany) {
    let pageContent: ReactNode

    if (page === 'people') {
      pageContent =
        peopleView.view.mode === 'form' ? (
          <PeopleFormPage
            session={session}
            company={activeCompany}
            personId={peopleView.view.id}
            timeClockEnabled={timeClockEnabled}
            onBack={peopleView.reset}
            onSaved={peopleView.reset}
          />
        ) : (
          <PeoplePage session={session} company={activeCompany} onCreate={peopleView.create} onEdit={(p) => peopleView.edit(p.id)} />
        )
    } else if (page === 'vehicles') {
      pageContent =
        vehiclesView.view.mode === 'form' ? (
          <VehicleFormPage
            session={session}
            company={activeCompany}
            vehicleId={vehiclesView.view.id}
            onBack={vehiclesView.reset}
            onSaved={vehiclesView.reset}
          />
        ) : (
          <VehiclesPage
            session={session}
            company={activeCompany}
            onCreate={vehiclesView.create}
            onEdit={(v) => vehiclesView.edit(v.id)}
          />
        )
    } else if (page === 'products') {
      pageContent =
        productsView.view.mode === 'form' ? (
          <ProductFormPage
            session={session}
            company={activeCompany}
            productId={productsView.view.id}
            defaultIngredient={newIngredient}
            onBack={productsView.reset}
            onSaved={productsView.reset}
          />
        ) : (
          <ProductsPage
            session={session}
            company={activeCompany}
            onCreate={(options) => {
              setNewIngredient(Boolean(options?.ingredient))
              productsView.create()
            }}
            onEdit={(p) => productsView.edit(p.id)}
          />
        )
    } else if (page === 'vehicle-rentals') {
      pageContent =
        vehicleRentalsView.view.mode === 'form' ? (
          <VehicleRentalFormPage
            session={session}
            company={activeCompany}
            saleId={vehicleRentalsView.view.id}
            onBack={vehicleRentalsView.reset}
            onSaved={vehicleRentalsView.reset}
          />
        ) : (
          <VehicleRentalsPage
            session={session}
            company={activeCompany}
            onCreate={vehicleRentalsView.create}
            onEdit={(sale) => vehicleRentalsView.edit(sale.id)}
          />
        )
    } else if (page === 'vehicle-sales') {
      pageContent =
        vehicleSalesView.view.mode === 'form' ? (
          <VehicleSaleFormPage
            session={session}
            company={activeCompany}
            saleId={vehicleSalesView.view.id}
            onBack={vehicleSalesView.reset}
            onSaved={vehicleSalesView.reset}
          />
        ) : (
          <VehicleSalesPage
            session={session}
            company={activeCompany}
            onCreate={vehicleSalesView.create}
            onEdit={(sale) => vehicleSalesView.edit(sale.id)}
          />
        )
    } else if (page === 'financing-sales') {
      pageContent =
        financingSalesView.view.mode === 'form' ? (
          <FinancingFormPage
            session={session}
            company={activeCompany}
            saleId={financingSalesView.view.id}
            initialModality={financingInitialModality}
            onBack={financingSalesView.reset}
            onSaved={financingSalesView.reset}
          />
        ) : (
          <FinancingSalesPage
            session={session}
            company={activeCompany}
            initialStatusFilter={financingSalesFilter}
            onCreate={(modality) => {
              setFinancingInitialModality(modality)
              financingSalesView.create()
            }}
            onEdit={(sale) => financingSalesView.edit(sale.id)}
          />
        )
    } else if (page === 'order-services') {
      pageContent =
        orderServicesView.view.mode === 'form' ? (
          <OrderServiceFormPage
            session={session}
            company={activeCompany}
            orderServiceId={orderServicesView.view.id}
            onBack={orderServicesView.reset}
            onSaved={orderServicesView.reset}
          />
        ) : (
          <OrderServicesPage
            session={session}
            company={activeCompany}
            onCreate={orderServicesView.create}
            onEdit={(orderService) => orderServicesView.edit(orderService.id)}
          />
        )
    } else if (page === 'towing-sales') {
      pageContent =
        towingSalesView.view.mode === 'form' ? (
          <TowingSaleFormPage
            session={session}
            company={activeCompany}
            saleId={towingSalesView.view.id}
            onBack={towingSalesView.reset}
            onSaved={towingSalesView.reset}
          />
        ) : (
          <TowingSalesPage
            session={session}
            company={activeCompany}
            onCreate={towingSalesView.create}
            onEdit={(sale) => towingSalesView.edit(sale.id)}
          />
        )
    } else if (page === 'sales') {
      pageContent =
        salesView.view.mode === 'form' ? (
          <SaleFormPage
            session={session}
            company={activeCompany}
            saleId={salesView.view.id}
            onBack={salesView.reset}
            onSaved={salesView.reset}
          />
        ) : (
          <SalesPage
            session={session}
            company={activeCompany}
            pdvUrl={PDV_URL}
            onCreate={salesView.create}
            onEdit={(sale) => salesView.edit(sale.id)}
          />
        )
    } else if (page === 'stock') {
      pageContent = (
        <StockPage
          session={session}
          company={activeCompany}
          onOpenInventory={() => {
            setPage('stock-inventories')
            stockInventoriesView.create()
          }}
          onOpenMovements={(product) => {
            setStockProduct(product ?? null)
            setPage('stock-movements')
          }}
          onEditProduct={(id) => {
            setPage('products')
            productsView.edit(id)
          }}
        />
      )
    } else if (page === 'stock-movements') {
      pageContent = (
        <StockMovementsPage
          session={session}
          company={activeCompany}
          product={stockProduct}
          onClearProduct={() => setStockProduct(null)}
          onBack={() => handleNavigate('stock')}
        />
      )
    } else if (page === 'stock-inventories') {
      pageContent =
        stockInventoriesView.view.mode === 'form' ? (
          <StockInventoryFormPage
            session={session}
            company={activeCompany}
            inventoryId={stockInventoriesView.view.id}
            onBack={stockInventoriesView.reset}
            onSaved={stockInventoriesView.reset}
          />
        ) : (
          <StockInventoriesPage
            session={session}
            company={activeCompany}
            onCreate={stockInventoriesView.create}
            onOpen={(inventory) => stockInventoriesView.edit(inventory.id)}
            onBack={() => handleNavigate('stock')}
          />
        )
    } else if (page === 'bank-accounts') {
      pageContent =
        bankAccountsView.view.mode === 'form' ? (
          <BankAccountFormPage
            session={session}
            company={activeCompany}
            accountId={bankAccountsView.view.id}
            onBack={bankAccountsView.reset}
            onSaved={bankAccountsView.reset}
          />
        ) : (
          <BankAccountsPage
            session={session}
            company={activeCompany}
            onCreate={bankAccountsView.create}
            onEdit={(account) => bankAccountsView.edit(account.id)}
          />
        )
    } else if (page === 'categories') {
      pageContent =
        categoriesView.view.mode === 'form' ? (
          <CategoryFormPage
            session={session}
            company={activeCompany}
            categoryId={categoriesView.view.id}
            onBack={categoriesView.reset}
            onSaved={categoriesView.reset}
          />
        ) : (
          <CategoriesPage
            session={session}
            company={activeCompany}
            onCreate={categoriesView.create}
            onEdit={(category) => categoriesView.edit(category.id)}
          />
        )
    } else if (page === 'ifood-store') {
      pageContent = <IfoodStorePage session={session} company={activeCompany} />
    } else if (page === 'catalog') {
      pageContent = <CatalogPage session={session} company={activeCompany} />
    } else if (page === 'delivery-couriers') {
      pageContent = <DeliveryCouriersPage session={session} company={activeCompany} />
    } else if (page === 'delivery-neighborhoods') {
      pageContent = <DeliveryNeighborhoodsPage session={session} company={activeCompany} />
    } else if (page === 'cost-centers') {
      pageContent =
        costCentersView.view.mode === 'form' ? (
          <CostCenterFormPage
            session={session}
            company={activeCompany}
            costCenterId={costCentersView.view.id}
            onBack={costCentersView.reset}
            onSaved={costCentersView.reset}
          />
        ) : (
          <CostCentersPage
            session={session}
            company={activeCompany}
            onCreate={costCentersView.create}
            onEdit={(item) => costCentersView.edit(item.id)}
          />
        )
    } else if (page === 'bills-payable') {
      pageContent =
        billsPayableView.view.mode === 'form' ? (
          <BillFormPage
            session={session}
            company={activeCompany}
            role={0}
            billId={billsPayableView.view.id}
            onBack={billsPayableView.reset}
            onSaved={billsPayableView.reset}
          />
        ) : (
          <BillsPage
            session={session}
            company={activeCompany}
            role={0}
            onCreate={billsPayableView.create}
            onEdit={(bill) => billsPayableView.edit(bill.id)}
          />
        )
    } else if (page === 'bills-receivable') {
      pageContent =
        billsReceivableView.view.mode === 'form' ? (
          <BillFormPage
            session={session}
            company={activeCompany}
            role={1}
            billId={billsReceivableView.view.id}
            onBack={billsReceivableView.reset}
            onSaved={billsReceivableView.reset}
          />
        ) : (
          <BillsPage
            session={session}
            company={activeCompany}
            role={1}
            onCreate={billsReceivableView.create}
            onEdit={(bill) => billsReceivableView.edit(bill.id)}
          />
        )
    } else if (page === 'users') {
      pageContent =
        usersView.view.mode === 'form' ? (
          <UserFormPage
            session={session}
            company={activeCompany}
            userId={usersView.view.id}
            onBack={usersView.reset}
            onSaved={usersView.reset}
          />
        ) : (
          <UsersPage
            session={session}
            company={activeCompany}
            onBack={() => handleNavigate('dashboard')}
            onCreate={usersView.create}
            onEdit={(user) => user.user?.id && usersView.edit(user.user.id)}
          />
        )
    } else if (page === 'companies') {
      pageContent =
        companiesView.view.mode === 'form' ? (
          <CompanyFormPage
            session={session}
            companyId={companiesView.view.id}
            onBack={companiesView.reset}
            onSaved={companiesView.reset}
          />
        ) : (
          <CompaniesPage
            session={session}
            onBack={() => handleNavigate('dashboard')}
            onCreate={companiesView.create}
            onEdit={(company) => companiesView.edit(company.id)}
          />
        )
    } else if (page === 'whatsapp-api') {
      pageContent = <WhatsappApiPage session={session} company={activeCompany} />
    } else if (page === 'config') {
      pageContent = (
        <ConfigPage
          session={session}
          company={activeCompany}
          onNavigate={handleNavigate}
          onSaved={() => setConfigVersion((v) => v + 1)}
        />
      )
    } else if (page === 'contract-templates') {
      pageContent =
        contractTemplatesView.view.mode === 'form' ? (
          <ContractTemplateFormPage
            session={session}
            company={activeCompany}
            templateId={contractTemplatesView.view.id}
            onBack={contractTemplatesView.reset}
            onSaved={contractTemplatesView.reset}
          />
        ) : (
          <ContractTemplatesPage
            session={session}
            company={activeCompany}
            onCreate={contractTemplatesView.create}
            onEdit={(template) => contractTemplatesView.edit(template.id)}
          />
        )
    } else if (page === 'rental-types') {
      pageContent =
        rentalTypesView.view.mode === 'form' ? (
          <RentalTypeFormPage
            session={session}
            company={activeCompany}
            rentalTypeId={rentalTypesView.view.id}
            onBack={rentalTypesView.reset}
            onSaved={rentalTypesView.reset}
          />
        ) : (
          <RentalTypesPage
            session={session}
            company={activeCompany}
            onCreate={rentalTypesView.create}
            onEdit={(rentalType) => rentalTypesView.edit(rentalType.id)}
          />
        )
    } else if (page === 'glass-types') {
      pageContent =
        glassTypesView.view.mode === 'form' ? (
          <GlassTypeFormPage
            session={session}
            company={activeCompany}
            glassTypeId={glassTypesView.view.id}
            onBack={glassTypesView.reset}
            onSaved={glassTypesView.reset}
          />
        ) : (
          <GlassTypesPage
            session={session}
            company={activeCompany}
            onCreate={glassTypesView.create}
            onEdit={(item) => glassTypesView.edit(item.id)}
          />
        )
    } else if (page === 'glass-models') {
      pageContent =
        glassModelsView.view.mode === 'form' ? (
          <GlassModelFormPage
            session={session}
            company={activeCompany}
            glassModelId={glassModelsView.view.id}
            onBack={glassModelsView.reset}
            onSaved={glassModelsView.reset}
          />
        ) : (
          <GlassModelsPage
            session={session}
            company={activeCompany}
            onCreate={glassModelsView.create}
            onEdit={(item) => glassModelsView.edit(item.id)}
          />
        )
    } else if (page === 'glass-profiles') {
      pageContent =
        glassProfilesView.view.mode === 'form' ? (
          <GlassProfileFormPage
            session={session}
            company={activeCompany}
            profileId={glassProfilesView.view.id}
            onBack={glassProfilesView.reset}
            onSaved={glassProfilesView.reset}
          />
        ) : (
          <GlassProfilesPage
            session={session}
            company={activeCompany}
            onCreate={glassProfilesView.create}
            onEdit={(item) => glassProfilesView.edit(item.id)}
          />
        )
    } else if (page === 'glass-accessories') {
      pageContent =
        glassAccessoriesView.view.mode === 'form' ? (
          <GlassAccessoryFormPage
            session={session}
            company={activeCompany}
            accessoryId={glassAccessoriesView.view.id}
            onBack={glassAccessoriesView.reset}
            onSaved={glassAccessoriesView.reset}
          />
        ) : (
          <GlassAccessoriesPage
            session={session}
            company={activeCompany}
            onCreate={glassAccessoriesView.create}
            onEdit={(item) => glassAccessoriesView.edit(item.id)}
          />
        )
    } else if (page === 'glass-colors') {
      pageContent =
        glassColorsView.view.mode === 'form' ? (
          <GlassColorFormPage
            session={session}
            company={activeCompany}
            colorId={glassColorsView.view.id}
            onBack={glassColorsView.reset}
            onSaved={glassColorsView.reset}
          />
        ) : (
          <GlassColorsPage
            session={session}
            company={activeCompany}
            onCreate={glassColorsView.create}
            onEdit={(item) => glassColorsView.edit(item.id)}
          />
        )
    } else if (page === 'glass-orders') {
      pageContent =
        glassOrdersView.view.mode === 'form' ? (
          <GlassOrderFormPage
            session={session}
            company={activeCompany}
            orderId={glassOrdersView.view.id}
            onBack={glassOrdersView.reset}
            onSaved={glassOrdersView.reset}
          />
        ) : (
          <GlassOrdersPage
            session={session}
            company={activeCompany}
            onCreate={glassOrdersView.create}
            onEdit={(item) => glassOrdersView.edit(item.id)}
          />
        )
    } else if (page === 'sale-tokens') {
      pageContent = <SaleTokensPage session={session} company={activeCompany} />
    } else if (page === 'app-releases') {
      pageContent = <AppReleasesPage session={session} />
    } else if (page === 'subscription') {
      pageContent = (
        <SubscriptionPage
          session={session}
          company={activeCompany}
          initialPlan={pendingPlan}
          onPlanConsumed={() => {
            takePendingPlan()
            setPendingPlan(null)
          }}
          onActivated={handleSubscriptionActivated}
        />
      )
    } else if (page === 'plans') {
      pageContent =
        plansView.view.mode === 'form' ? (
          <PlanFormPage session={session} planId={plansView.view.id} onBack={plansView.reset} onSaved={plansView.reset} />
        ) : (
          <PlansPage session={session} onCreate={plansView.create} onEdit={(plan) => plansView.edit(plan.id)} />
        )
    } else if (page === 'blog-posts') {
      pageContent =
        blogPostsView.view.mode === 'form' ? (
          <BlogPostFormPage
            session={session}
            postId={blogPostsView.view.id}
            onBack={blogPostsView.reset}
            onSaved={blogPostsView.reset}
          />
        ) : (
          <BlogPostsPage session={session} onCreate={blogPostsView.create} onEdit={(item) => blogPostsView.edit(item.id)} />
        )
    } else if (page === 'printers') {
      pageContent =
        printersView.view.mode === 'form' ? (
          <PrinterFormPage
            session={session}
            company={activeCompany}
            printerId={printersView.view.id}
            onBack={printersView.reset}
            onSaved={printersView.reset}
          />
        ) : (
          <PrintersPage
            session={session}
            company={activeCompany}
            onCreate={printersView.create}
            onEdit={(item) => printersView.edit(item.id)}
          />
        )
    } else if (page === 'glass-schedule') {
      pageContent = <GlassSchedulePage session={session} company={activeCompany} />
    } else if (page === 'glass-production') {
      pageContent = <GlassProductionPage session={session} company={activeCompany} />
    } else if (page === 'roles') {
      pageContent =
        rolesView.view.mode === 'form' ? (
          <RoleFormPage session={session} roleId={rolesView.view.id} onBack={rolesView.reset} onSaved={rolesView.reset} />
        ) : (
          <RolesPage
            session={session}
            company={activeCompany}
            onCreate={rolesView.create}
            onEdit={(role) => rolesView.edit(role.id)}
          />
        )
    } else if (page === 'permissions') {
      pageContent =
        permissionsView.view.mode === 'form' ? (
          <PermissionFormPage
            session={session}
            permissionId={permissionsView.view.id}
            onBack={permissionsView.reset}
            onSaved={permissionsView.reset}
          />
        ) : (
          <PermissionsPage
            session={session}
            company={activeCompany}
            onCreate={permissionsView.create}
            onEdit={(permission) => permissionsView.edit(permission.id)}
          />
        )
    } else if (page === 'company-groups') {
      pageContent =
        companyGroupsView.view.mode === 'form' ? (
          <CompanyGroupFormPage
            session={session}
            company={activeCompany}
            groupId={companyGroupsView.view.id}
            onBack={companyGroupsView.reset}
            onSaved={companyGroupsView.reset}
          />
        ) : (
          <CompanyGroupsPage
            session={session}
            company={activeCompany}
            onCreate={companyGroupsView.create}
            onEdit={(group) => companyGroupsView.edit(group.id)}
          />
        )
    } else if (page === 'licenses') {
      pageContent =
        licensesView.view.mode === 'form' && licensesView.view.id ? (
          <LicenseFormPage
            session={session}
            company={activeCompany}
            licenseId={licensesView.view.id}
            onBack={licensesView.reset}
            onSaved={licensesView.reset}
          />
        ) : (
          <LicensesPage session={session} company={activeCompany} onEdit={(item) => licensesView.edit(item.id)} />
        )
    } else if (page === 'nfes') {
      pageContent =
        nfesView.view.mode === 'form' ? (
          <NfeFormPage
            session={session}
            company={activeCompany}
            nfeId={nfesView.view.id}
            onBack={nfesView.reset}
            onSaved={nfesView.reset}
          />
        ) : (
          <NfesPage session={session} company={activeCompany} onCreate={nfesView.create} onEdit={(nfe) => nfesView.edit(nfe.id)} />
        )
    } else if (page === 'nfses') {
      pageContent =
        nfsesView.view.mode === 'form' ? (
          <NfseFormPage
            session={session}
            company={activeCompany}
            nfseId={nfsesView.view.id}
            onBack={nfsesView.reset}
            onSaved={nfsesView.reset}
          />
        ) : (
          <NfsesPage
            session={session}
            company={activeCompany}
            onCreate={nfsesView.create}
            onEdit={(nfse) => nfsesView.edit(nfse.id)}
          />
        )
    } else if (page === 'investments') {
      pageContent =
        investmentsView.view.mode === 'form' ? (
          <InvestmentFormPage
            session={session}
            company={activeCompany}
            investmentId={investmentsView.view.id}
            onBack={investmentsView.reset}
            onSaved={investmentsView.reset}
          />
        ) : (
          <InvestmentsPage
            session={session}
            company={activeCompany}
            onCreate={investmentsView.create}
            onEdit={(investment) => investmentsView.edit(investment.id)}
          />
        )
    } else if (page === 'nfe-manifests') {
      pageContent = <NfeManifestsPage session={session} company={activeCompany} />
    } else if (page === 'nfe-nature-operations') {
      pageContent =
        nfeNatureOperationsView.view.mode === 'form' ? (
          <NfeNatureOperationFormPage
            session={session}
            company={activeCompany}
            natureOperationId={nfeNatureOperationsView.view.id}
            onBack={nfeNatureOperationsView.reset}
            onSaved={nfeNatureOperationsView.reset}
          />
        ) : (
          <NfeNatureOperationsPage
            session={session}
            company={activeCompany}
            onCreate={nfeNatureOperationsView.create}
            onEdit={(item) => nfeNatureOperationsView.edit(item.id)}
          />
        )
    } else if (page === 'nfe-taxations') {
      pageContent =
        nfeTaxationsView.view.mode === 'form' ? (
          <NfeTaxationFormPage
            session={session}
            company={activeCompany}
            taxationId={nfeTaxationsView.view.id}
            onBack={nfeTaxationsView.reset}
            onSaved={nfeTaxationsView.reset}
          />
        ) : (
          <NfeTaxationsPage
            session={session}
            company={activeCompany}
            onCreate={nfeTaxationsView.create}
            onEdit={(item) => nfeTaxationsView.edit(item.id)}
          />
        )
    } else if (page === 'audit-logs') {
      pageContent = <AuditLogsPage session={session} company={activeCompany} />
    } else if (page === 'vehicle-inspections') {
      pageContent = <VehicleInspectionsPage session={session} company={activeCompany} />
    } else if (page === 'support-contracts') {
      pageContent =
        supportContractsView.view.mode === 'form' ? (
          <SupportContractFormPage
            session={session}
            company={activeCompany}
            contractId={supportContractsView.view.id}
            onBack={supportContractsView.reset}
            onSaved={supportContractsView.reset}
          />
        ) : (
          <SupportContractsPage
            session={session}
            company={activeCompany}
            onCreate={supportContractsView.create}
            onEdit={(contract) => supportContractsView.edit(contract.id)}
          />
        )
    } else if (page === 'tasks') {
      pageContent = <TasksPage session={session} company={activeCompany} />
    } else if (page === 'support-visits') {
      pageContent =
        supportVisitsView.view.mode === 'form' ? (
          <SupportVisitFormPage
            session={session}
            company={activeCompany}
            onBack={supportVisitsView.reset}
            onSaved={supportVisitsView.reset}
          />
        ) : (
          <SupportVisitsPage session={session} company={activeCompany} onCreate={supportVisitsView.create} />
        )
    } else if (page === 'loan-customer-verifications') {
      pageContent = <LoanCustomerVerificationsPage session={session} company={activeCompany} />
    } else if (page === 'towing-collection') {
      pageContent = <TowingCollectionPage session={session} company={activeCompany} />
    } else if (page === 'vehicle-rental-operations') {
      pageContent = <VehicleRentalOperationsPage session={session} company={activeCompany} />
    } else if (page === 'towing-billing-report') {
      pageContent = <TowingBillingReportPage session={session} company={activeCompany} />
    } else if (page === 'standalone-inspection') {
      pageContent = (
        <StandaloneInspectionPage
          session={session}
          company={activeCompany}
          onBack={() => handleNavigate('dashboard')}
          onSaved={() => handleNavigate('dashboard')}
        />
      )
    } else if (page === 'purchase-management') {
      pageContent = (
        <PurchaseManagementPage
          session={session}
          company={activeCompany}
          onBack={() => handleNavigate('config')}
          onViewHistory={() => handleNavigate('purchase-requests')}
        />
      )
    } else if (page === 'purchase-requests') {
      pageContent = (
        <PurchaseRequestsPage
          session={session}
          company={activeCompany}
          onBack={() => handleNavigate('purchase-management')}
        />
      )
    } else if (page === 'time-clock') {
      pageContent = (
        <TimeClockPage session={session} company={activeCompany} onBack={() => handleNavigate('config')} />
      )
    } else if (isLocacaoVeiculos(activeCompany.system_type)) {
      pageContent = (
        <RentalDashboardPage
          session={session}
          company={activeCompany}
          onNewInspection={() => handleNavigate('standalone-inspection')}
        />
      )
    } else if (isEmprestimo(activeCompany.system_type)) {
      pageContent = (
        <LoanDashboardPage
          session={session}
          company={activeCompany}
          onNavigateToSales={(filter) => {
            setFinancingSalesFilter(filter)
            financingSalesView.reset()
            setPage('financing-sales')
          }}
        />
      )
    } else if (isGaragemInvestidor(activeCompany.system_type)) {
      pageContent = <GaragemDashboardPage session={session} company={activeCompany} />
    } else if (isVidracaria(activeCompany.system_type)) {
      pageContent = (
        <GlassDashboardPage
          session={session}
          company={activeCompany}
          onNewQuote={() => {
            setPage('glass-orders')
            glassOrdersView.create()
          }}
          onNewClient={() => {
            setPage('people')
            peopleView.create()
          }}
          onOpenOrders={() => {
            setPage('glass-orders')
            glassOrdersView.reset()
          }}
          onOpenModels={() => {
            setPage('glass-models')
            glassModelsView.reset()
          }}
          onOpenOrder={(orderId) => {
            setPage('glass-orders')
            glassOrdersView.edit(orderId)
          }}
        />
      )
    } else if (isNoVehicleNiche(activeCompany.system_type)) {
      // Nichos de venda sem veículo (mercearia, chaveiro, lanchonete, pizzaria...): painel de vendas, não o do guincho.
      pageContent = (
        <MerceariaDashboardPage
          niche={SYSTEM_TYPE_LABELS[Number(activeCompany.system_type)] ?? 'Vendas'}
          session={session}
          company={activeCompany}
          onOpenProducts={() => handleNavigate('products')}
          onOpenPayables={() => handleNavigate('bills-payable')}
          onOpenStock={hasStockControl(activeCompany.system_type) ? () => handleNavigate('stock') : undefined}
        />
      )
    } else {
      pageContent = <DashboardPage session={session} company={activeCompany} />
    }

    content = (
      <AppShell
        session={session}
        company={activeCompany}
        activePage={page}
        onNavigate={handleNavigate}
        onSwitchCompany={handleSwitchCompany}
        onGoToMatrixCompany={handleGoToMatrixCompany}
        onLogout={handleLogout}
        purchaseManagementEnabled={purchaseManagementEnabled}
        nfeModuleEnabled={nfeModuleEnabled}
        nfseModuleEnabled={nfseModuleEnabled}
        timeClockEnabled={timeClockEnabled}
      >
        <TrialBanner company={activeCompany} onOpenPlans={() => handleNavigate('subscription')} />
        <LicenseNotice session={session} company={activeCompany} />
        {page === 'dashboard' && <SetupChecklist session={session} company={activeCompany} onNavigate={handleNavigate} />}
        {pageContent}
      </AppShell>
    )
  } else if (session) {
    content = (
      <CompanySelectionPage
        session={session}
        companies={getUserCompanies(session)}
        onSelect={handleSelectCompany}
        onLogout={handleLogout}
      />
    )
  } else if (screen === 'forgot-password') {
    content = <ForgotPasswordPage onBackToLogin={() => setScreen('login')} />
  } else if (screen === 'signup') {
    content = <SignupPage onBackToLogin={() => setScreen('login')} onSignedUp={handleLoginSuccess} />
  } else {
    content = (
      <LoginPage
        onForgotPassword={() => setScreen('forgot-password')}
        onSignup={() => setScreen('signup')}
        onLoginSuccess={handleLoginSuccess}
      />
    )
  }

  const showFloatingThemeToggle = !(session && activeCompany)

  return (
    <>
      {content}
      {session && activeCompany && <UpgradeModal onSeePlans={() => handleNavigate('subscription')} />}
      {showFloatingThemeToggle && <ThemeToggle />}
    </>
  )
}

export default App
