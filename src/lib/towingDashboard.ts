import type { TowingSaleRecord } from './towingSale'

export const SALE_STATUS_LABELS: Record<number, string> = {
  0: 'Em orçamento',
  1: 'Contrato gerado',
  2: 'Aguardando assinatura',
  3: 'Assinado',
  4: 'Cancelado',
  5: 'Concluído',
}

export const COLLECTION_STATUS_LABELS: Record<number, string> = {
  0: 'Aguardando retirada',
  1: 'Indo retirar',
  2: 'Retirada não efetuada',
  3: 'Veículo coletado',
  4: 'Veículo entregue',
}

export interface DailyRevenuePoint {
  label: string
  total: number
  count: number
}

export interface StatusBreakdownItem {
  status: number
  label: string
  total: number
}

export interface DriverStat {
  id: string
  name: string
  total: number
  delivered: number
  inProgress: number
}

export interface TowingDashboardSummary {
  totalSales: number
  totalRevenue: number
  averageTicket: number
  signedSales: number
  waitingSignature: number
  canceledSales: number
  waitingPickup: number
  inTransit: number
  collected: number
  delivered: number
  failedPickup: number
  activeQueue: number
  conversionRate: number
  deliveryRate: number
  dailyRevenue: DailyRevenuePoint[]
  salesStatus: StatusBreakdownItem[]
  collectionStatus: StatusBreakdownItem[]
  topDrivers: DriverStat[]
  recentSales: TowingSaleRecord[]
  routeHighlights: TowingSaleRecord[]
}

export function getCollectionStatus(sale: TowingSaleRecord): number {
  return Number(sale.collection_status ?? 0)
}

export function getSaleValue(sale: TowingSaleRecord): number {
  return Number(sale.transport_value || 0)
}

function getSaleDate(sale: TowingSaleRecord): Date | null {
  const raw = sale.createdAt ?? sale.created_at
  if (!raw) return null
  const date = new Date(raw)
  return Number.isNaN(date.getTime()) ? null : date
}

function mergeById(primary: TowingSaleRecord[], secondary: TowingSaleRecord[]): TowingSaleRecord[] {
  const map = new Map<string, TowingSaleRecord>()
  for (const item of [...primary, ...secondary]) {
    if (item?.id) map.set(item.id, { ...map.get(item.id), ...item })
  }
  return Array.from(map.values())
}

function buildDailyRevenue(sales: TowingSaleRecord[]): DailyRevenuePoint[] {
  const days = new Map<string, DailyRevenuePoint>()

  for (const sale of sales) {
    const date = getSaleDate(sale)
    if (!date) continue

    const key = date.toISOString().slice(0, 10)
    const label = date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit' })
    const current = days.get(key) ?? { label, total: 0, count: 0 }
    current.total += getSaleValue(sale)
    current.count += 1
    days.set(key, current)
  }

  return Array.from(days.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([, point]) => point)
}

function buildTopDrivers(sales: TowingSaleRecord[]): DriverStat[] {
  const drivers = new Map<string, DriverStat>()

  for (const sale of sales) {
    const driver = sale.collectionDriver ?? sale.user
    const id = driver?.id ?? 'sem-motorista'
    const current = drivers.get(id) ?? {
      id,
      name: driver?.name ?? 'Sem motorista definido',
      total: 0,
      delivered: 0,
      inProgress: 0,
    }

    current.total += 1
    if (getCollectionStatus(sale) === 4) current.delivered += 1
    if ([0, 1, 3].includes(getCollectionStatus(sale))) current.inProgress += 1
    drivers.set(id, current)
  }

  return Array.from(drivers.values())
    .sort((a, b) => b.total - a.total)
    .slice(0, 6)
}

export function buildTowingDashboard(sales: TowingSaleRecord[], queue: TowingSaleRecord[]): TowingDashboardSummary {
  const signedSalesList = sales.filter((sale) => Number(sale.status || 0) === 3)
  const allOperational = mergeById(signedSalesList, queue)

  const totalRevenue = sales.reduce((sum, sale) => sum + getSaleValue(sale), 0)
  const signedSales = signedSalesList.length
  const delivered = allOperational.filter((sale) => getCollectionStatus(sale) === 4).length
  const failedPickup = allOperational.filter((sale) => getCollectionStatus(sale) === 2).length
  const activeQueue = allOperational.filter((sale) => [0, 1, 3].includes(getCollectionStatus(sale))).length

  return {
    totalSales: sales.length,
    totalRevenue,
    averageTicket: sales.length ? totalRevenue / sales.length : 0,
    signedSales,
    waitingSignature: sales.filter((sale) => Number(sale.status || 0) === 2).length,
    canceledSales: sales.filter((sale) => Number(sale.status || 0) === 4).length,
    waitingPickup: allOperational.filter((sale) => getCollectionStatus(sale) === 0).length,
    inTransit: allOperational.filter((sale) => getCollectionStatus(sale) === 1).length,
    collected: allOperational.filter((sale) => getCollectionStatus(sale) === 3).length,
    delivered,
    failedPickup,
    activeQueue,
    conversionRate: sales.length ? (signedSales / sales.length) * 100 : 0,
    deliveryRate: signedSales ? (delivered / signedSales) * 100 : 0,
    dailyRevenue: buildDailyRevenue(sales),
    salesStatus: [0, 1, 2, 3, 4, 5].map((status) => ({
      status,
      label: SALE_STATUS_LABELS[status],
      total: sales.filter((sale) => Number(sale.status || 0) === status).length,
    })),
    collectionStatus: [0, 1, 2, 3, 4].map((status) => ({
      status,
      label: COLLECTION_STATUS_LABELS[status],
      total: allOperational.filter((sale) => getCollectionStatus(sale) === status).length,
    })),
    topDrivers: buildTopDrivers(allOperational),
    recentSales: sales.slice(0, 8),
    routeHighlights: [...sales].sort((a, b) => getSaleValue(b) - getSaleValue(a)).slice(0, 6),
  }
}
