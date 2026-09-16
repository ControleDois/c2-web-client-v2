export type Modality = 'price' | 'sac' | 'per_installment' | 'custom' | 'dinheiro_alugado' | 'sobre_total' | 'cheque'

export const MODALITY_LABELS: Record<Modality, string> = {
  price: 'Tabela Price',
  sac: 'SAC',
  per_installment: 'Por Parcela',
  custom: 'Personalizada',
  dinheiro_alugado: 'Dinheiro Alugado',
  sobre_total: 'Sobre o Total',
  cheque: 'Cheque',
}

export const MODALITY_DESCRIPTIONS: Record<Modality, string> = {
  dinheiro_alugado: 'Juros mensais fixos até devolver o montante',
  per_installment: 'Valor fixo por parcela, juros calculados',
  custom: 'Você define cada valor e vencimento',
  sobre_total: 'Juros sobre o valor total, de uma só vez',
  sac: 'Amortização constante, parcelas decrescentes',
  price: 'Parcelas fixas, juros sobre o saldo devedor',
  cheque: 'Antecipe um cheque e receba no vencimento',
}

// Ordem de exibição no seletor "Novo Empréstimo" - segue a mesma ordem usada
// como referência (JuristaPro), não a ordem alfabética.
export const MODALITY_ORDER: Modality[] = [
  'dinheiro_alugado',
  'per_installment',
  'custom',
  'sobre_total',
  'sac',
  'price',
  'cheque',
]

// A modalidade não tem coluna própria no backend - fica marcada como um
// prefixo "[SAC] ..." na observação da venda (Tabela Price não leva prefixo,
// é o padrão). Usado tanto pro formulário de edição quanto pra listagem/
// detalhes, pra sempre extrair a mesma coisa a partir da mesma venda.
export function parseModalityFromNote(note: string | null | undefined): { modality: Modality; cleanNote: string } {
  const raw = note || ''
  const match = raw.match(/^\[(.+?)\]\s*/)
  if (match) {
    const found = (Object.entries(MODALITY_LABELS) as [Modality, string][]).find(([, label]) => label === match[1])
    if (found) {
      return { modality: found[0], cleanNote: raw.slice(match[0].length) }
    }
  }
  return { modality: 'price', cleanNote: raw }
}

// Filtro de status usado tanto pelos cards clicáveis do dashboard quanto
// pelos chips de filtro da listagem de vendas - os dois lêem o mesmo
// computeNextDue, então sempre concordam sobre o que é "aberto"/"atrasado".
export type SalesStatusFilter = 'all' | 'aberto' | 'atrasado'

export interface NextDueInfo {
  status: 'quitado' | 'em_dia' | 'atrasado'
  dueDate: string | null
  daysLate: number
}

// Próxima parcela em aberto (menor vencimento com status pendente) e, se já
// vencida, há quantos dias - mesma lógica visual do JuristaPro (vencimento
// em vermelho com "X dias" quando atrasado).
export function computeNextDue(
  bills: { date_due?: string | null; status?: number }[] | null | undefined
): NextDueInfo {
  const pending = (bills || []).filter((b) => Number(b.status) === 0 && b.date_due)
  if (pending.length === 0) return { status: 'quitado', dueDate: null, daysLate: 0 }

  const sorted = [...pending].sort((a, b) => (a.date_due! < b.date_due! ? -1 : a.date_due! > b.date_due! ? 1 : 0))
  const dueDate = sorted[0].date_due as string

  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const due = new Date(`${dueDate.slice(0, 10)}T00:00:00`)
  const daysLate = Math.round((today.getTime() - due.getTime()) / 86400000)

  if (daysLate > 0) return { status: 'atrasado', dueDate, daysLate }
  return { status: 'em_dia', dueDate, daysLate: 0 }
}

const AVATAR_PALETTE = ['#3b82f6', '#22c55e', '#f97316', '#a855f7', '#ec4899', '#14b8a6', '#eab308', '#ef4444']

export function avatarColorFor(name: string): string {
  let hash = 0
  for (let i = 0; i < name.length; i++) hash = (hash * 31 + name.charCodeAt(i)) >>> 0
  return AVATAR_PALETTE[hash % AVATAR_PALETTE.length]
}

export function initialsFor(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 0) return '?'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}
