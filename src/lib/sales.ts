import { apiGet, apiPost, apiPut, apiDelete } from './api'

export const FUEL_LEVEL_OPTIONS = ['Vazio', 'Reserva', '1/4', '1/2', '3/4', 'Cheio']

export interface SalePerson {
  id: string
  name: string
  document?: string | null
}

export interface SaleVehicleRef {
  id: string
  brand?: string | null
  model?: string | null
  license_plate?: string | null
}

export interface VehicleRentalContractRecord {
  id: string
  saleId?: string
  vehicleId?: string
  renterPeopleId?: string
  ownerPeopleId?: string | null
  driverPeopleId?: string | null
  vehicleOwnerType: number
  startDate?: string | null
  endDate?: string | null
  billingDay?: number | null
  rentalFrequency: string
  monthlyValue: number
  securityDeposit?: number | null
  purchaseOption: boolean
  installmentCount?: number | null
  vehicleTotalValue?: number | null
  status: number
  notes?: string | null
  pickupDate?: string | null
  pickupOdometer?: number | null
  pickupFuelLevel?: string | null
  pickupLocation?: string | null
  pickupInspectionId?: string | null
  returnDate?: string | null
  returnOdometer?: number | null
  returnFuelLevel?: string | null
  returnLocation?: string | null
  returnInspectionId?: string | null
  renter?: SalePerson | null
  owner?: SalePerson | null
  driver?: SalePerson | null
  vehicle?: SaleVehicleRef | null
}

export interface VehicleSaleContractRecord {
  id: string
  saleId?: string
  vehicleId?: string
  buyerPeopleId?: string
  witnessOnePeopleId?: string | null
  witnessTwoPeopleId?: string | null
  guarantorPeopleId?: string | null
  saleValue: number
  downPayment?: number | null
  installmentValue?: number | null
  firstDueDate?: string | null
  installmentCount?: number | null
  notes?: string | null
  deliveryDate?: string | null
  deliveryOdometer?: number | null
  deliveryFuelLevel?: string | null
  deliveryLocation?: string | null
  vehicleInspectionId?: string | null
  status: number
  buyer?: SalePerson | null
  witnessOne?: SalePerson | null
  witnessTwo?: SalePerson | null
  guarantor?: SalePerson | null
  vehicle?: SaleVehicleRef | null
}

export interface SaleRecord {
  id: string
  code?: number
  internal_code?: number | null
  status: number
  role: number
  operationType?: string | null
  date_sale?: string | null
  net_total?: number | null
  note?: string | null
  people?: SalePerson | null
  people_id?: string
  vehicle?: SaleVehicleRef | null
  vehicle_id?: string
  user?: SalePerson | null
  user_id?: string
  category_id?: string | null
  vehicleRentalContract?: VehicleRentalContractRecord | null
  vehicleSaleContract?: VehicleSaleContractRecord | null
  created_at?: string
  autentique_id?: string | null
  autentique_public_id?: string | null
  autentique_short_link?: string | null
}

export interface VehicleRentalContractPayload {
  vehicleId?: string
  renterPeopleId?: string
  ownerPeopleId?: string
  driverPeopleId?: string
  vehicleOwnerType?: number
  startDate?: string
  endDate?: string
  billingDay?: number
  rentalFrequency?: string
  monthlyValue?: number
  securityDeposit?: number
  purchaseOption?: boolean
  installmentCount?: number
  vehicleTotalValue?: number
  notes?: string
}

export interface VehicleSaleContractPayload {
  vehicleId?: string
  buyerPeopleId?: string
  witnessOnePeopleId?: string
  witnessTwoPeopleId?: string
  guarantorPeopleId?: string
  saleValue?: number
  downPayment?: number
  installmentValue?: number
  firstDueDate?: string
  installmentCount?: number
  notes?: string
}

export interface SalePlotPayload {
  portion: number
  form_payment: number
  date_due: string
  amount: number
  status?: number
  note?: string
}

export interface SalePayload {
  companyId: string
  peopleId: string
  vehicleId?: string
  userId: string
  categoryId?: string
  role: number
  status: number
  date_sale?: string
  net_total?: number
  note?: string
  internal_code?: number
  vehicleRentalContract?: VehicleRentalContractPayload
  vehicleSaleContract?: VehicleSaleContractPayload
  plots?: SalePlotPayload[]
}

export interface VehicleRentalOperationPayload {
  pickupDate?: string
  pickupOdometer?: number
  pickupFuelLevel?: string
  pickupLocation?: string
  pickupInspectionId?: string
  returnDate?: string
  returnOdometer?: number
  returnFuelLevel?: string
  returnLocation?: string
  returnInspectionId?: string
  status: number
  notes?: string
}

export interface VehicleSaleOperationPayload {
  deliveryDate?: string
  deliveryOdometer?: number
  deliveryFuelLevel?: string
  deliveryLocation?: string
  vehicleInspectionId?: string
  status: number
  notes?: string
}

interface Paginated<T> {
  data: T[]
  meta?: {
    total: number
    per_page: number
    current_page: number
    last_page: number
  }
}

export const RENTAL_FREQUENCY_LABELS: Record<string, string> = {
  daily: 'Diária',
  weekly: 'Semanal',
  monthly: 'Mensal',
}

export const VEHICLE_OWNER_TYPE_LABELS: Record<number, string> = {
  0: 'Veículo da empresa',
  1: 'Veículo de terceiro',
}

export const VEHICLE_RENTAL_STATUS_LABELS: Record<number, string> = {
  0: 'Pendente',
  1: 'Retirado',
  2: 'Devolvido',
}

export const VEHICLE_SALE_STATUS_LABELS: Record<number, string> = {
  0: 'Pendente',
  1: 'Entregue',
}

export function fetchSales(
  token: string,
  companyId: string,
  options: { search?: string; page?: number; limit?: number } = {}
) {
  return apiGet<Paginated<SaleRecord>>(
    '/sale',
    {
      companyId,
      search: options.search,
      page: options.page ? String(options.page) : '1',
      limit: options.limit ? String(options.limit) : '5000',
    },
    token
  )
}

export function fetchSale(token: string, id: string) {
  return apiGet<SaleRecord>(`/sale/${id}`, {}, token)
}

export function createSale(token: string, payload: SalePayload) {
  return apiPost<SaleRecord>('/sale', payload, token)
}

export function updateSale(token: string, id: string, payload: SalePayload) {
  return apiPut<SaleRecord>(`/sale/${id}`, payload, token)
}

export function deleteSale(token: string, id: string) {
  return apiDelete<void>(`/sale/${id}`, token)
}

export function printSaleContract(token: string, id: string) {
  return apiPost<{ url: string; html: string }>(`/sale/print-contract/${id}`, {}, token)
}

export function getContractLink(sale: SaleRecord): string {
  return sale.autentique_short_link || ''
}

export function sendSaleContract(
  token: string,
  id: string,
  payload: { contractTemplateId: string; whatsappId?: string; useAutentique?: boolean }
) {
  return apiPost<{
    fileUrl: string
    contractLink: string
    whatsappQueued: boolean
    whatsappError: string | null
  }>(`/sale/send-contract/${id}`, payload, token)
}

export function sendSaleContractLink(token: string, id: string, whatsappId: string) {
  return apiPost<{ message: string; whatsappQueued: boolean }>(
    `/sale/send-contract-link/${id}`,
    { whatsappId },
    token
  )
}

export function updateVehicleRentalOperation(token: string, id: string, payload: VehicleRentalOperationPayload) {
  return apiPut<VehicleRentalContractRecord>(`/sale/${id}/vehicle-rental-operation`, payload, token)
}

export function updateVehicleSaleOperation(token: string, id: string, payload: VehicleSaleOperationPayload) {
  return apiPut<VehicleSaleContractRecord>(`/sale/${id}/vehicle-sale-operation`, payload, token)
}
