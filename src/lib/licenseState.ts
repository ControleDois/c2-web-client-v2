import type { AuthCompany } from './auth'

// Mesma regra do servidor (LicenseCheckService): a empresa matriz nunca bloqueia; as demais bloqueiam
// quando a licença está marcada como bloqueada ou a data de validade já passou.
export function isLicenseBlocked(company: AuthCompany | null | undefined): boolean {
  if (!company || company.is_master) return false
  const expired = Boolean(company.license_expires_at) && new Date(company.license_expires_at as string) < new Date()
  return company.license_status === 'blocked' || expired
}

export function isTrial(company: AuthCompany | null | undefined): boolean {
  return Boolean(company) && !company?.is_master && company?.license_status === 'trial'
}

// Dias que ainda restam do teste grátis (0 no último dia, negativo depois de vencer).
export function trialDaysLeft(company: AuthCompany | null | undefined): number | null {
  if (!isTrial(company) || !company?.license_expires_at) return null
  const end = new Date(company.license_expires_at)
  if (Number.isNaN(end.getTime())) return null
  return Math.ceil((end.getTime() - Date.now()) / 86_400_000)
}

// WhatsApp do suporte (o mesmo do rodapé do login); VITE_CONTACT_URL troca por outro endereço.
export const CONTACT_URL =
  import.meta.env.VITE_CONTACT_URL ??
  'https://wa.me/5565992819663?text=Ol%C3%A1%2C%20quero%20ativar%20a%20assinatura%20do%20Controle%20Dois'
