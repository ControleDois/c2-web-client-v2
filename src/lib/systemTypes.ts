export const SYSTEM_TYPE_LABELS: Record<number, string> = {
  0: 'Padrão Geral',
  1: 'Proteção Veicular',
  2: 'Financeiro',
  3: 'Fácil Juros / Empréstimo',
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
}

export const SYSTEM_TYPE_PROTECAO_VEICULAR = 1
export const SYSTEM_TYPE_EMPRESTIMO = 3
export const SYSTEM_TYPE_LOCACAO_VEICULOS = 6
export const SYSTEM_TYPES_LOJA_ONLINE = [10, 12]
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

export function isLojaOnline(systemType?: number): boolean {
  return systemType !== undefined && SYSTEM_TYPES_LOJA_ONLINE.includes(systemType)
}

export function isVistoriasNiche(systemType?: number): boolean {
  return systemType !== undefined && SYSTEM_TYPES_VISTORIAS.includes(systemType)
}
