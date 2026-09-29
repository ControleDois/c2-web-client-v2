export const SYSTEM_TYPE_LABELS: Record<number, string> = {
  0: 'Padrão Geral',
  1: 'Proteção Veicular',
  2: 'Financeiro',
  3: 'Juros / Empréstimos',
  4: 'Controle de Mídia',
  5: 'Sistema ERP',
  6: 'Locação de Veículos',
  7: 'Oficina de Motos',
  8: 'Distribuidora de Bebidas',
  9: 'Guincho / Cegonha',
  10: 'Vestuário e Acessórios',
  11: 'CRM / Gestão de Leads',
  12: 'Sorveteria',
  13: 'Grupo Clube',
  14: 'Pizzaria',
  15: 'Lanchonete',
  16: 'Hamburgeria',
  17: 'Padaria',
}

export const SYSTEM_TYPE_PROTECAO_VEICULAR = 1
export const SYSTEM_TYPE_EMPRESTIMO = 3
export const SYSTEM_TYPE_LOCACAO_VEICULOS = 6
export const SYSTEM_TYPE_PIZZARIA = 14
export const SYSTEM_TYPE_LANCHONETE = 15
export const SYSTEM_TYPE_HAMBURGUERIA = 16
export const SYSTEM_TYPE_PADARIA = 17
// Loja Online cobre qualquer nicho com delivery/cardápio próprio (inclui os
// 4 nichos de comida - Pizzaria/Lanchonete ficavam de fora antes por omissão,
// não por design; corrigido junto da criação de Hamburgeria/Padaria).
export const SYSTEM_TYPES_LOJA_ONLINE = [10, 12, 14, 15, 16, 17]
export const SYSTEM_TYPES_VISTORIAS = [6, 7, 9]

export function isProtecaoVeicular(systemType?: number): boolean {
  return systemType === SYSTEM_TYPE_PROTECAO_VEICULAR
}

export function isLocacaoVeiculos(systemType?: number): boolean {
  return systemType === SYSTEM_TYPE_LOCACAO_VEICULOS
}

export function isEmprestimo(systemType?: number): boolean {
  return systemType === SYSTEM_TYPE_EMPRESTIMO
}

// Nicho sem veículos: não usa vistoria, busca de veículo nem o relatório de
// faturamento do guincho — só Dashboard/Pessoas/Produtos/Vendas + Fiscal.
export function isPizzaria(systemType?: number): boolean {
  return systemType === SYSTEM_TYPE_PIZZARIA
}

export function isLanchonete(systemType?: number): boolean {
  return systemType === SYSTEM_TYPE_LANCHONETE
}

export function isHamburgueria(systemType?: number): boolean {
  return systemType === SYSTEM_TYPE_HAMBURGUERIA
}

// Padaria não tem nem Vendas no menu Principal (vira Dashboard/Pessoas/
// Produtos só) — ver AppShell.tsx, que trata esse caso à parte antes de
// cair no formato genérico "sem veículo" dos outros 3.
export function isPadaria(systemType?: number): boolean {
  return systemType === SYSTEM_TYPE_PADARIA
}

// Pizzaria, Lanchonete, Hamburgeria e Padaria compartilham o traço "sem
// veículo" (sem grupo Operação, sem relatório de faturamento do guincho) —
// ficam como nichos distintos porque o menu Principal de cada um pode
// divergir (ver Padaria acima).
export function isNoVehicleNiche(systemType?: number): boolean {
  return isPizzaria(systemType) || isLanchonete(systemType) || isHamburgueria(systemType) || isPadaria(systemType)
}

export function isLojaOnline(systemType?: number): boolean {
  return systemType !== undefined && SYSTEM_TYPES_LOJA_ONLINE.includes(systemType)
}

export function isVistoriasNiche(systemType?: number): boolean {
  return systemType !== undefined && SYSTEM_TYPES_VISTORIAS.includes(systemType)
}
