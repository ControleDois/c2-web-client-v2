const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const percentFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value || 0)
}

export function formatPercent(value: number): string {
  return `${percentFormatter.format(value || 0)}%`
}

// Data pura "YYYY-MM-DD" (sem hora/fuso) - `new Date("2026-09-04")` o JS
// interpreta como meia-noite UTC, e formatar em horário do Brasil (UTC-3)
// empurra pro dia anterior (03/09). Datas assim têm que ser montadas com
// ano/mês/dia direto, sem passar pelo parser de UTC.
const PLAIN_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/

export function formatDate(value?: string | null): string {
  if (!value) return '—'
  const plainMatch = value.match(PLAIN_DATE_RE)
  const date = plainMatch
    ? new Date(Number(plainMatch[1]), Number(plainMatch[2]) - 1, Number(plainMatch[3]))
    : new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric' })
}

export function formatDateTime(value?: string | null): string {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
