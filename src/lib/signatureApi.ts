import { API_BASE_URL } from './api'

export interface SignatureInfo {
  status: number
  signerName: string
  companyName: string
  documentUrl?: string
  alreadySigned: boolean
  verified: boolean
  requireCode: boolean
  requireSelfie: boolean
  allowEmail: boolean
  allowWhatsapp: boolean
  maskedEmail: string
  maskedPhone: string
}

async function parseJson(res: Response) {
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    throw new Error(data?.message || 'Não foi possível completar a ação.')
  }
  return data
}

export function signatureDownloadUrl(token: string) {
  return `${API_BASE_URL}/connect/signature/${token}/download`
}

export function signatureDocumentUrl(token: string) {
  return `${API_BASE_URL}/connect/signature/${token}/document`
}

export function fetchSignatureInfo(token: string): Promise<SignatureInfo> {
  return fetch(`${API_BASE_URL}/connect/signature/${token}`).then(parseJson)
}

export function requestSignatureCode(token: string, channel: 'email' | 'whatsapp') {
  return fetch(`${API_BASE_URL}/connect/signature/${token}/request-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ channel }),
  }).then(parseJson) as Promise<{ sent: boolean; destination: string }>
}

export function verifySignatureCode(token: string, code: string) {
  return fetch(`${API_BASE_URL}/connect/signature/${token}/verify-code`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code }),
  }).then(parseJson) as Promise<{ verified: boolean }>
}

export function submitSignature(
  token: string,
  selfie: Blob | null,
  signature: Blob,
  location: { latitude: number; longitude: number; accuracy: number } | null
) {
  const form = new FormData()
  if (location) {
    form.append('latitude', String(location.latitude))
    form.append('longitude', String(location.longitude))
    form.append('accuracy', String(location.accuracy))
  }
  if (selfie) form.append('selfie', selfie, 'selfie.jpg')
  form.append('signature', signature, 'rubrica.png')

  return fetch(`${API_BASE_URL}/connect/signature/${token}/submit`, {
    method: 'POST',
    body: form,
  }).then(parseJson) as Promise<{ signed: boolean; fileUrl: string }>
}
