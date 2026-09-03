import { apiGet, apiPut } from './api'

export type LoanCustomerVerificationStatus = 'pending_documents' | 'pending_review' | 'approved' | 'rejected'

export interface PeopleDocumentRef {
  id: string
  title: string
  description?: string | null
  file_name?: string | null
  file_url?: string | null
  file_size?: number | null
}

export interface LoanReference {
  name: string
  phone: string
}

export interface LoanCustomerVerificationRecord {
  id: string
  companyId: string
  peopleId: string
  addressProofDocumentId: string | null
  identityDocumentId: string | null
  identityDocumentBackId: string | null
  documentType: 'rg' | 'cnh' | null
  selfieDocumentId: string | null
  employmentProofDocumentId: string | null
  references: LoanReference[] | null
  housingType: 'own' | 'rented' | null
  rentalContractDocumentId: string | null
  status: LoanCustomerVerificationStatus
  notes: string | null
  reviewedBy: string | null
  reviewedAt: string | null
  createdAt: string
  updatedAt: string
  people?: {
    id: string
    name: string
    document: string
    phone: string | null
    fatherName?: string | null
    motherName?: string | null
    occupation?: string | null
    employerName?: string | null
    monthlyIncome?: number | null
  } | null
  addressProofDocument?: PeopleDocumentRef | null
  identityDocument?: PeopleDocumentRef | null
  identityDocumentBack?: PeopleDocumentRef | null
  selfieDocument?: PeopleDocumentRef | null
  employmentProofDocument?: PeopleDocumentRef | null
  rentalContractDocument?: PeopleDocumentRef | null
}

interface Paginated<T> {
  data: T[]
  meta?: { total: number; per_page: number; current_page: number; last_page: number }
}

export function fetchLoanCustomerVerifications(
  token: string,
  companyId: string,
  options: { search?: string; status?: LoanCustomerVerificationStatus | ''; page?: number; limit?: number } = {},
) {
  return apiGet<Paginated<LoanCustomerVerificationRecord>>(
    '/loan-customer-verification',
    {
      companyId,
      search: options.search || undefined,
      status: options.status || undefined,
      page: options.page ? String(options.page) : '1',
      limit: options.limit ? String(options.limit) : '10',
    },
    token,
  )
}

export function reviewLoanCustomerVerification(
  token: string,
  companyId: string,
  id: string,
  payload: { status: 'approved' | 'rejected'; notes?: string },
) {
  return apiPut<LoanCustomerVerificationRecord>(
    `/loan-customer-verification/${id}/review?companyId=${encodeURIComponent(companyId)}`,
    payload,
    token,
  )
}
