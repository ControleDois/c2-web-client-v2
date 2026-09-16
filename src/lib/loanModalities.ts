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
