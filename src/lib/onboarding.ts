import { apiGet, apiPost, apiPut } from './api'
import type { AuthPeople } from './auth'

export interface OnboardingAddressInput {
  zip_code?: string | null
  address?: string | null
  number?: string | null
  district?: string | null
  city?: string | null
  state?: string | null
  complement?: string | null
  code_ibge?: string | null
}

export interface OnboardingPayload {
  company_id: string
  system_type?: number
  name?: string
  social_name?: string | null
  document?: string | null
  phone?: string | null
  email?: string | null
  address?: OnboardingAddressInput
}

export interface OnboardingResult {
  completed: boolean
  onboarding_completed_at: string | null
  system_type: number
  license_status?: string
  license_expires_at?: string | null
  people: AuthPeople & { address?: Record<string, string | null> | null }
}

export const fetchOnboarding = (token: string, companyId: string) =>
  apiGet<OnboardingResult>('/onboarding', { companyId }, token)

export const saveOnboarding = (token: string, payload: OnboardingPayload) =>
  apiPut<OnboardingResult>('/onboarding', payload, token)

export const completeOnboarding = (token: string, companyId: string) =>
  apiPost<OnboardingResult>('/onboarding/complete', { company_id: companyId }, token)

// Segmentos que o cliente escolhe sozinho (mesmos valores aceitos pelo servidor).
export interface NicheOption {
  type: number
  name: string
  text: string
}

export const NICHE_OPTIONS: NicheOption[] = [
  { type: 21, name: 'Mercearia e varejo', text: 'Venda no balcão com leitor de código de barras, balança e catálogo pronto.' },
  { type: 14, name: 'Pizzaria', text: 'Mesas, comandas, cardápio digital e delivery.' },
  { type: 15, name: 'Lanchonete', text: 'Pedidos no balcão, mesas e delivery.' },
  { type: 16, name: 'Hamburgueria', text: 'Comandas, cardápio digital e delivery.' },
  { type: 17, name: 'Padaria', text: 'Venda rápida, produtos pesados e encomendas.' },
  { type: 8, name: 'Distribuidora de bebidas', text: 'Atacado e varejo, estoque e delivery.' },
  { type: 12, name: 'Sorveteria', text: 'Venda rápida, comandas e delivery.' },
  { type: 6, name: 'Locação de veículos', text: 'Contratos de aluguel, entrega, devolução e cobrança.' },
  { type: 7, name: 'Oficina de motos', text: 'Ordens de serviço, mecânicos e peças.' },
  { type: 9, name: 'Guincho e cegonha', text: 'Atendimentos, vistorias e contratos de transporte.' },
  { type: 1, name: 'Proteção veicular', text: 'Associados, planos, cotações e eventos.' },
  { type: 3, name: 'Empréstimos e financeiras', text: 'Crédito, análise de cadastro e parcelas.' },
  { type: 20, name: 'Vidraçaria', text: 'Orçamentos por medida, produção e agenda.' },
  { type: 10, name: 'Vestuário e acessórios', text: 'Grade de tamanho e cor e estoque por variação.' },
  { type: 18, name: 'TI e software house', text: 'Clientes, acesso remoto, ordens de serviço e contratos.' },
  { type: 0, name: 'Outro segmento', text: 'Modelo geral: vendas, financeiro, estoque e notas fiscais.' },
]
