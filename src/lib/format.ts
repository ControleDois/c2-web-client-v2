const currencyFormatter = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' })
const percentFormatter = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 })

export function formatCurrency(value: number): string {
  return currencyFormatter.format(value || 0)
}

export function formatPercent(value: number): string {
  return `${percentFormatter.format(value || 0)}%`
}

// Data sem intenção de horário - `new Date("2026-09-04")` o JS interpreta
// como meia-noite UTC, e formatar em horário do Brasil (UTC-3) empurra pro
// dia anterior (03/09). O mesmo acontece com colunas `Date` "cruas" do
// backend (ex: Bill.date_due, sem @column.date()) - o Postgres devolve
// "2026-09-04T00:00:00.000Z", que é a mesma meia-noite UTC só que já
// serializada como ISO completo. Nenhum dos dois representa um horário de
// verdade (nada aqui tem hora certa às 00:00:00.000 UTC de propósito), então
// os dois casos são tratados igual: monta a data por ano/mês/dia direto, sem
// passar pelo parser de fuso.
const DATE_ONLY_RE = /^(\d{4})-(\d{2})-(\d{2})(?:T00:00:00(?:\.000)?Z)?$/

export function formatDate(value?: string | null): string {
  if (!value) return '—'
  const dateOnlyMatch = value.match(DATE_ONLY_RE)
  const date = dateOnlyMatch
    ? new Date(Number(dateOnlyMatch[1]), Number(dateOnlyMatch[2]) - 1, Number(dateOnlyMatch[3]))
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
