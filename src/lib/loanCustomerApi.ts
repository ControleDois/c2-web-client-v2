import { apiPost, apiPostForm } from './api'

export type LoanCustomerVerificationStatus = 'pending_documents' | 'pending_review' | 'approved' | 'rejected'

export type LoanClient = {
  id: string
  name: string
  document: string
  phone: string
  email: string | null
  limit_credit: number
  available_limit: number
}

export type LoanVerification = {
  id: string
  status: LoanCustomerVerificationStatus
  notes: string | null
  documentType?: 'rg' | 'cnh' | null
}

export type LoanSessionData = {
  message?: string
  session_token?: string
  expires_at?: string
  client: LoanClient
  verification: LoanVerification
}

export function registerCustomer(
  companyToken: string,
  input: { name: string; email: string; document: string; phone: string },
): Promise<LoanSessionData> {
  return apiPost('/connect/loan/customer/register', {
    ...input,
    company_token: companyToken,
    initial_credit: 50,
  })
}

export function requestAccessCode(companyToken: string, document: string): Promise<{ message: string }> {
  return apiPost('/connect/loan/customer/request-code', { document, company_token: companyToken })
}

export function verifyAccessCode(document: string, code: string): Promise<LoanSessionData> {
  return apiPost('/connect/loan/customer/verify-code', { document, code })
}

export function getLoanSession(sessionToken: string): Promise<LoanSessionData> {
  return apiPost('/connect/loan/customer/session', { session_token: sessionToken })
}

export type LoanReference = { name: string; phone: string }

export function submitLoanVerification(params: {
  sessionToken: string
  addressProof: File
  documentType: 'rg' | 'cnh'
  identityFront: File
  identityBack?: File
  selfie: File
  fatherName: string
  motherName: string
  occupation: string
  employerName: string
  monthlyIncome: number
  employmentProof?: File
  references: LoanReference[]
}): Promise<{ message: string; verification: LoanVerification }> {
  const form = new FormData()
  form.append('session_token', params.sessionToken)
  form.append('address_proof', params.addressProof)
  form.append('document_type', params.documentType)
  form.append('identity_document_front', params.identityFront)
  if (params.identityBack) form.append('identity_document_back', params.identityBack)
  form.append('selfie', params.selfie)
  form.append('father_name', params.fatherName)
  form.append('mother_name', params.motherName)
  form.append('occupation', params.occupation)
  form.append('employer_name', params.employerName)
  form.append('monthly_income', String(params.monthlyIncome))
  if (params.employmentProof) form.append('employment_proof', params.employmentProof)
  form.append('references', JSON.stringify(params.references))

  return apiPostForm('/connect/loan/customer/submit-verification', form)
}

const SESSION_KEY_PREFIX = 'loan-customer-session:'

export function saveLoanSession(companyToken: string, sessionToken: string, expiresAt: string): void {
  try {
    localStorage.setItem(
      `${SESSION_KEY_PREFIX}${companyToken}`,
      JSON.stringify({ sessionToken, expiresAt }),
    )
  } catch {
    // Sem localStorage (modo privado, etc.) — a sessão só dura a visita atual.
  }
}

export function loadLoanSession(companyToken: string): string | null {
  try {
    const raw = localStorage.getItem(`${SESSION_KEY_PREFIX}${companyToken}`)
    if (!raw) return null
    const { sessionToken, expiresAt } = JSON.parse(raw) as { sessionToken: string; expiresAt: string }
    if (new Date(expiresAt).getTime() <= Date.now()) return null
    return sessionToken
  } catch {
    return null
  }
}

export function clearLoanSession(companyToken: string): void {
  try {
    localStorage.removeItem(`${SESSION_KEY_PREFIX}${companyToken}`)
  } catch {
    // Ignora — nada crítico se não conseguir limpar.
  }
}
