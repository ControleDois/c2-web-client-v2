// Matemática de período/parcela de aluguel de veículo, compartilhada entre
// VehicleRentalFormPage.tsx (criar/editar) e RenewRentalModal.tsx (renovar).

export function computeRentalUnits(frequency: string, startDateStr: string, endDateStr: string): number {
  const start = new Date(startDateStr)
  const end = new Date(endDateStr)
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) return 1

  const diffDays = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24))

  if (frequency === 'daily') return Math.max(1, diffDays)
  if (frequency === 'weekly') return Math.max(1, Math.ceil(diffDays / 7))
  let months = (end.getFullYear() - start.getFullYear()) * 12 + (end.getMonth() - start.getMonth())
  if (end.getDate() < start.getDate()) months -= 1
  return Math.max(1, months)
}

export function rentalUnitsLabel(frequency: string, units: number): string {
  if (frequency === 'daily') return `${units} ${units === 1 ? 'diária' : 'diárias'}`
  if (frequency === 'weekly') return `${units} ${units === 1 ? 'semana' : 'semanas'}`
  return `${units} ${units === 1 ? 'mês' : 'meses'}`
}

export function addDaysToDate(dateStr: string, days: number): string {
  const date = new Date(dateStr)
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

export function addMonthsToDate(dateStr: string, months: number): string {
  const date = new Date(dateStr)
  date.setMonth(date.getMonth() + months)
  return date.toISOString().slice(0, 10)
}

export function nextDueDate(frequency: string, baseDate: string, index: number): string {
  if (frequency === 'daily') return addDaysToDate(baseDate, index)
  if (frequency === 'weekly') return addDaysToDate(baseDate, index * 7)
  return addMonthsToDate(baseDate, index)
}

// Avança `units` períodos (diárias/semanas/meses, conforme frequency) a
// partir de uma data — usado pra calcular o fim de um período de renovação.
export function addPeriodsToDate(frequency: string, dateStr: string, units: number): string {
  if (frequency === 'daily') return addDaysToDate(dateStr, units)
  if (frequency === 'weekly') return addDaysToDate(dateStr, units * 7)
  return addMonthsToDate(dateStr, units)
}

export interface RentalPeriodPlot {
  portion: number
  dateDue: string
  amount: number
}

// Uma conta por período (diária/semanal/mensal) — a 1ª vence na própria data
// de início (índice 0-based).
export function buildPeriodPlots(
  frequency: string,
  startDate: string,
  endDate: string,
  ratePerPeriod: number
): RentalPeriodPlot[] {
  const units = computeRentalUnits(frequency, startDate, endDate)
  return Array.from({ length: units }).map((_, index) => ({
    portion: index + 1,
    dateDue: nextDueDate(frequency, startDate, index),
    amount: ratePerPeriod,
  }))
}
