import { apiPost, ApiError } from './api'

export interface AuthPeople {
  id: string
  name: string
  document?: string | null
  file_url?: string | null
  role?: { id: string; name: string } | null
  [key: string]: unknown
}

export interface AuthToken {
  type: string
  token: string
}

export interface AuthCompany {
  id: string
  system_type?: number
  license_status?: string
  license_expires_at?: string | null
  people?: AuthPeople | null
  [key: string]: unknown
}

export interface AuthUser {
  id: string
  email: string
  people?: AuthPeople | null
  companies?: AuthCompany[]
  [key: string]: unknown
}

export interface AuthSession {
  token: AuthToken
  user: AuthUser
  company: AuthCompany
}

const SESSION_KEY = 'c2_auth'
const ACTIVE_COMPANY_KEY = 'c2_active_company'

export async function signin(email: string, password: string) {
  try {
    return await apiPost<AuthSession>('/auth/signin', { email, password })
  } catch (err) {
    if (err instanceof ApiError && (err.status === 400 || err.status === 401)) {
      throw new ApiError('E-mail ou senha inválidos.', err.status)
    }
    throw err
  }
}

export function saveSession(session: AuthSession) {
  localStorage.setItem(SESSION_KEY, JSON.stringify(session))
}

export function loadSession(): AuthSession | null {
  const raw = localStorage.getItem(SESSION_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthSession
  } catch {
    return null
  }
}

export function clearSession() {
  localStorage.removeItem(SESSION_KEY)
  clearActiveCompany()
}

export function saveActiveCompany(company: AuthCompany) {
  localStorage.setItem(ACTIVE_COMPANY_KEY, JSON.stringify(company))
}

export function loadActiveCompany(): AuthCompany | null {
  const raw = localStorage.getItem(ACTIVE_COMPANY_KEY)
  if (!raw) return null
  try {
    return JSON.parse(raw) as AuthCompany
  } catch {
    return null
  }
}

export function clearActiveCompany() {
  localStorage.removeItem(ACTIVE_COMPANY_KEY)
}

export function getUserCompanies(session: AuthSession): AuthCompany[] {
  if (session.user.companies && session.user.companies.length > 0) {
    return session.user.companies
  }
  return session.company ? [session.company] : []
}

export function getPersonName(user: AuthUser): string {
  return user.people?.name ?? user.email
}

export function getUserRoleName(user: AuthUser): string | null {
  return user.people?.role?.name ?? null
}

export function getCompanyName(company: AuthCompany): string {
  return company.people?.name ?? 'Empresa sem nome'
}
