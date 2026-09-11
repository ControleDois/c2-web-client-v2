import { apiGet, apiPost, apiFetchBlob, ApiError } from './api'
import { formatNfeProviderError } from './nfes'

interface Paginated<T> {
  data: T[]
  meta?: {
    total: number
    per_page: number
    current_page: number
    last_page: number
  }
}

export type NfeManifestTipo = 'ciencia' | 'confirmacao' | 'desconhecimento' | 'nao_realizada'

export const NFE_MANIFEST_TIPO_OPTIONS: { value: NfeManifestTipo; label: string; hint: string }[] = [
  { value: 'ciencia', label: 'Ciência', hint: 'registra conhecimento sem confirmar a operação' },
  { value: 'confirmacao', label: 'Confirmar', hint: 'confirma que a operação foi realizada' },
  { value: 'desconhecimento', label: 'Desconhecer', hint: 'declara que a empresa não reconhece a nota' },
  { value: 'nao_realizada', label: 'Operação não realizada', hint: 'exige justificativa de 15 a 255 caracteres' },
]

export interface NfeReceivedManifestRecord {
  id: string
  code?: number
  provider?: string | null
  nome_emitente?: string | null
  documento_emitente?: string | null
  chave_nfe: string
  valor_total?: number
  data_emissao?: string | null
  situacao?: string | null
  manifestacao_destinatario?: string | null
  nfe_completa?: boolean
  xml_path?: string | null
  danfe_path?: string | null
  imported_at?: string | null
  purchase_note_id?: string | null
  people?: { id: string; name: string; document?: string } | null
  purchaseNote?: { id: string } | null
}

export interface NfeManifestSummaryBucket {
  count: number
  sum: number
}

export interface NfeManifestSummary {
  pending: NfeManifestSummaryBucket
  manifested: NfeManifestSummaryBucket
  imported: NfeManifestSummaryBucket
  all: NfeManifestSummaryBucket
}

export type NfeManifestStatusKey = 'pending' | 'ciencia' | 'confirmed' | 'unknown' | 'not_done' | 'imported'

export interface NfeManifestDerivedStatus {
  key: NfeManifestStatusKey
  label: string
  tone: string
}

// Única fonte de verdade pra derivar o status de um manifesto — não existe
// um campo de status único vindo da API. Usada pela badge da tabela, pelo
// agrupamento das tiles e pelo gate do botão "Importar entrada".
export function deriveManifestStatus(manifest: NfeReceivedManifestRecord): NfeManifestDerivedStatus {
  if (manifest.purchase_note_id || manifest.imported_at) {
    return { key: 'imported', label: 'Importada', tone: 'bg-[var(--green-100)] text-[var(--green-600)]' }
  }

  const tipo = manifest.manifestacao_destinatario
  if (tipo === 'confirmacao') {
    return { key: 'confirmed', label: 'Confirmada', tone: 'bg-[var(--blue-100)] text-[var(--blue-700)]' }
  }
  if (tipo === 'desconhecimento') {
    return { key: 'unknown', label: 'Desconhecida', tone: 'bg-[var(--red-100)] text-[var(--red-500)]' }
  }
  if (tipo === 'nao_realizada') {
    return { key: 'not_done', label: 'Não realizada', tone: 'bg-[var(--red-100)] text-[var(--red-500)]' }
  }
  if (tipo === 'ciencia') {
    return { key: 'ciencia', label: 'Ciência', tone: 'bg-[var(--amber-100)] text-[var(--amber-500)]' }
  }
  return { key: 'pending', label: 'Pendente', tone: 'bg-[var(--amber-100)] text-[var(--amber-500)]' }
}

export function fetchNfeManifests(
  token: string,
  companyId: string,
  options: { search?: string; page?: number; limit?: number; date?: string; status?: string } = {}
) {
  return apiGet<Paginated<NfeReceivedManifestRecord>>(
    '/nfe-manifest',
    {
      companyId,
      search: options.search,
      page: options.page ? String(options.page) : '1',
      limit: options.limit ? String(options.limit) : '10',
      date: options.date,
      status: options.status && options.status !== 'all' ? options.status : undefined,
    },
    token
  )
}

export function fetchNfeManifestSummary(token: string, companyId: string, date?: string) {
  return apiGet<NfeManifestSummary>('/nfe-manifest/summary', { companyId, date }, token)
}

export interface NfeManifestSyncJob {
  id: string
  status: number
  companyId?: string | null
  finishedAt?: string | null
  nextAttemptAt?: string | null
  last_error?: string | null
}

export function enqueueNfeManifestSync(token: string, companyId: string, date?: string) {
  return apiPost<{ message: string; job: NfeManifestSyncJob }>(
    '/nfe-manifest/sync',
    { date },
    token,
    { companyId }
  )
}

// Valida no cliente pra ambos os tipos que exigem justificativa (o Angular
// legado só valida isso pra "nao_realizada" na tela, mesmo o backend
// exigindo pros dois - aqui replicamos a regra real do backend).
export function manifestNfe(
  token: string,
  id: string,
  companyId: string,
  data: { tipo: NfeManifestTipo; justificativa?: string }
) {
  if (
    (data.tipo === 'desconhecimento' || data.tipo === 'nao_realizada') &&
    (data.justificativa || '').trim().length < 15
  ) {
    return Promise.reject(new ApiError('Informe uma justificativa com pelo menos 15 caracteres.', 400))
  }

  return apiPost<NfeReceivedManifestRecord>(`/nfe-manifest/${id}/manifest`, data, token, { companyId })
}

export interface PurchaseNoteProductRecord {
  id: number
  description?: string | null
  amount?: number
  unit?: string | null
  cost_value?: number
  subtotal?: number
  product?: { id: string; name: string } | null
}

export interface PurchaseNoteRecord {
  id: string
  code?: number
  description?: string | null
  total?: number
  enteredAt?: string | null
  entered_at?: string | null
  products?: PurchaseNoteProductRecord[]
  issuer?: { id: string; name: string } | null
}

export function importNfeManifestPurchaseNote(token: string, id: string, companyId: string) {
  return apiPost<PurchaseNoteRecord>(`/nfe-manifest/${id}/import`, {}, token, { companyId })
}

export function confirmPurchaseNoteEntry(token: string, purchaseNoteId: string) {
  return apiPost<PurchaseNoteRecord>(`/purchase-note/${purchaseNoteId}/confirm-entry`, {}, token)
}

export async function fetchNfeManifestFileUrl(
  token: string,
  id: string,
  companyId: string,
  type: 'xml' | 'danfe'
): Promise<string> {
  const blob = await apiFetchBlob(`/nfe-manifest/${id}/file/${type}`, { companyId }, token)
  return URL.createObjectURL(blob)
}

export interface NfeManifestLogRecord {
  id: string
  code?: number
  created_at?: string
  phase?: string
  action?: string
  provider?: string | null
  status?: number | null
  http_status?: number | null
  error_message?: string | null
  request_payload?: string | null
  response_payload?: string | null
}

export function fetchNfeManifestLogs(token: string, companyId: string, id?: string, limit = 100) {
  const path = id ? `/nfe-manifest/${id}/logs` : '/nfe-manifest/logs'
  return apiGet<NfeManifestLogRecord[]>(path, { companyId, limit: String(limit) }, token)
}

export const NFE_MANIFEST_LOG_PHASE_LABELS: Record<string, string> = {
  sync: 'Consulta',
  manifest: 'Manifesto',
  import: 'Importação',
  file: 'Arquivo',
}

export const NFE_MANIFEST_LOG_ACTION_LABELS: Record<string, string> = {
  enqueue_created: 'Consulta enfileirada',
  enqueue_existing: 'Consulta reaproveitada',
  enqueue_blocked_cooldown: 'Bloqueada (aguardando SEFAZ)',
  enqueue_blocked_min_interval: 'Bloqueada (intervalo mínimo)',
  job_started: 'Consulta iniciada',
  job_stuck_recovered: 'Consulta travada recuperada',
  internal_request_sent: 'Requisição enviada ao servidor próprio',
  provider_response: 'Resposta do provedor',
  job_done: 'Consulta concluída',
  job_error: 'Consulta com erro',
  manifest_upserted: 'Nota recebida/atualizada',
  manifest_done: 'Manifesto registrado',
  manifest_error: 'Erro ao manifestar',
  import_skipped_existing: 'Já importada anteriormente',
  import_linked_existing: 'Vinculada a nota de compra existente',
  import_xml_error: 'Erro ao baixar XML completo',
  import_done: 'Entrada importada',
  file_downloaded: 'Arquivo baixado',
  file_error: 'Erro ao obter arquivo',
}

export { formatNfeProviderError }
