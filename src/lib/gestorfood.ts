import { apiGet, apiPost, apiPut } from './api'

// Integração com o Gestor Food (shop.gestorfood.com/<link>): o cardápio é importado para o
// cadastro da empresa e o totem envia os pedidos para lá.

export interface GestorFoodPreview {
  link: string
  name: string
  document: string
  phone: string
  categories: number
  products: number
}

export interface GestorFoodImportResult {
  link: string
  store: string
  categories: number
  products: number
  created: number
  updated: number
  deactivated: number
  complements: number
  withoutNcm: string[]
}

export function previewGestorFood(token: string, companyId: string, link: string) {
  return apiGet<GestorFoodPreview>('/integrations/gestorfood/preview', { companyId, link }, token)
}

export function importGestorFood(token: string, companyId: string, link: string) {
  return apiPost<GestorFoodImportResult>('/integrations/gestorfood/import', { company_id: companyId, link }, token)
}

// Integração ativa: só assim o totem envia os pedidos para o Gestor Food.
export interface GestorFoodSettings {
  link: string | null
  enabled: boolean
}

export function fetchGestorFoodSettings(token: string, companyId: string) {
  return apiGet<GestorFoodSettings>('/integrations/gestorfood/settings', { companyId }, token)
}

export function saveGestorFoodSettings(token: string, companyId: string, enabled: boolean) {
  return apiPut<GestorFoodSettings>('/integrations/gestorfood/settings', { company_id: companyId, enabled }, token)
}
