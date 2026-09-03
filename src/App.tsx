import { useState, type ReactNode } from 'react'
import { LoginPage } from './pages/LoginPage'
import { ForgotPasswordPage } from './pages/ForgotPasswordPage'
import { SignupPage } from './pages/SignupPage'
import { CompanySelectionPage } from './pages/CompanySelectionPage'
import { DashboardPage } from './pages/DashboardPage'
import { RentalDashboardPage } from './pages/RentalDashboardPage'
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
import { TowingSaleFormPage } from './pages/TowingSaleFormPage'
import { BankAccountsPage } from './pages/BankAccountsPage'
import { BankAccountFormPage } from './pages/BankAccountFormPage'
import { CategoriesPage } from './pages/CategoriesPage'
import { CategoryFormPage } from './pages/CategoryFormPage'
import { CostCentersPage } from './pages/CostCentersPage'
import { CostCenterFormPage } from './pages/CostCenterFormPage'
import { BillsPage } from './pages/BillsPage'
import { BillFormPage } from './pages/BillFormPage'
import { UsersPage } from './pages/UsersPage'
import { UserFormPage } from './pages/UserFormPage'
import { CompaniesPage } from './pages/CompaniesPage'
import { CompanyFormPage } from './pages/CompanyFormPage'
import { WhatsappApiPage } from './pages/WhatsappApiPage'
import { ConfigPage } from './pages/ConfigPage'
import { ContractTemplatesPage } from './pages/ContractTemplatesPage'
import { ContractTemplateFormPage } from './pages/ContractTemplateFormPage'
import { RentalTypesPage } from './pages/RentalTypesPage'
import { RentalTypeFormPage } from './pages/RentalTypeFormPage'
import { RolesPage } from './pages/RolesPage'
import { RoleFormPage } from './pages/RoleFormPage'
import { PermissionsPage } from './pages/PermissionsPage'
import { PermissionFormPage } from './pages/PermissionFormPage'
import { CompanyGroupsPage } from './pages/CompanyGroupsPage'
import { CompanyGroupFormPage } from './pages/CompanyGroupFormPage'
import { AuditLogsPage } from './pages/AuditLogsPage'
import { VehicleInspectionsPage } from './pages/VehicleInspectionsPage'
import { LoanCustomerVerificationsPage } from './pages/LoanCustomerVerificationsPage'
import { TowingCollectionPage } from './pages/TowingCollectionPage'
import { VehicleRentalOperationsPage } from './pages/VehicleRentalOperationsPage'
import { TowingBillingReportPage } from './pages/TowingBillingReportPage'
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
import { isLocacaoVeiculos } from './lib/systemTypes'

type Screen = 'login' | 'forgot-password' | 'signup'

function App() {
  const [session, setSession] = useState<AuthSession | null>(() => loadSession())
  const [activeCompany, setActiveCompany] = useState<AuthCompany | null>(() => loadActiveCompany())
  const [screen, setScreen] = useState<Screen>('login')
  const [page, setPage] = useState<AppPage>('dashboard')
  const [switchingCompany, setSwitchingCompany] = useState(false)
  const [operationsInitialSaleId, setOperationsInitialSaleId] = useState<string | null>(null)

  const peopleView = useEntityView()
  const vehiclesView = useEntityView()
  const productsView = useEntityView()
  const vehicleRentalsView = useEntityView()
  const vehicleSalesView = useEntityView()
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

  const entityViews = {
    people: peopleView,
    vehicles: vehiclesView,
    products: productsView,
    'vehicle-rentals': vehicleRentalsView,
    'vehicle-sales': vehicleSalesView,
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
  } else if (session && activeCompany) {
    let pageContent: ReactNode

    if (page === 'people') {
      pageContent =
        peopleView.view.mode === 'form' ? (
          <PeopleFormPage
            session={session}
            company={activeCompany}
            personId={peopleView.view.id}
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
            onBack={productsView.reset}
            onSaved={productsView.reset}
          />
        ) : (
          <ProductsPage
            session={session}
            company={activeCompany}
            onCreate={productsView.create}
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
            onManageOperation={(saleId) => {
              setOperationsInitialSaleId(saleId)
              handleNavigate('vehicle-rental-operations')
            }}
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
      pageContent = <ConfigPage session={session} company={activeCompany} />
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
    } else if (page === 'audit-logs') {
      pageContent = <AuditLogsPage session={session} company={activeCompany} />
    } else if (page === 'vehicle-inspections') {
      pageContent = <VehicleInspectionsPage session={session} company={activeCompany} />
    } else if (page === 'loan-customer-verifications') {
      pageContent = <LoanCustomerVerificationsPage session={session} company={activeCompany} />
    } else if (page === 'towing-collection') {
      pageContent = <TowingCollectionPage session={session} company={activeCompany} />
    } else if (page === 'vehicle-rental-operations') {
      pageContent = (
        <VehicleRentalOperationsPage
          session={session}
          company={activeCompany}
          initialSaleId={operationsInitialSaleId}
          onInitialSaleConsumed={() => setOperationsInitialSaleId(null)}
        />
      )
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
    } else if (isLocacaoVeiculos(activeCompany.system_type)) {
      pageContent = (
        <RentalDashboardPage
          session={session}
          company={activeCompany}
          onNewInspection={() => handleNavigate('standalone-inspection')}
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
        onLogout={handleLogout}
      >
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
    content = <SignupPage onBackToLogin={() => setScreen('login')} />
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
      {showFloatingThemeToggle && <ThemeToggle />}
    </>
  )
}

export default App
