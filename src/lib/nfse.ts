import { apiGet, apiPost, apiPut, apiDelete } from './api'

export interface NfsePerson {
  id: string
  name: string
  social_name?: string | null
  document?: string | null
}

export interface NfseRecord {
  id: string
  code?: number
  company_id?: string
  sale_id?: string | null
  people_id: string
  status: number
  referencia?: string | null
  chave_nfse?: string | null
  numero_nfse?: string | null
  codigo_verificacao?: string | null
  protocolo?: string | null
  mensagem_sefaz?: string | null
  caminho_xml?: string | null
  caminho_pdf?: string | null
  data_emissao?: string | null
  serie_dps?: number
  numero_dps?: number
  data_competencia?: string | null
  descricao_servico: string
  informacoes_complementares?: string | null
  pedido_compra?: string | null
  valor_servico: number
  desconto_incondicionado?: number
  desconto_condicionado?: number
  codigo_tributacao_nacional_iss?: string | null
  razao_social_tomador?: string | null
  cnpj_tomador?: string | null
  cpf_tomador?: string | null
  created_at?: string
  people?: NfsePerson | null
  sale?: { id: string; code?: number } | null
}

interface Paginated<T> {
  data: T[]
  meta?: { total: number; per_page: number; current_page: number; last_page: number }
}

export const NFSE_STATUS_LABELS: Record<number, string> = {
  0: 'Rascunho',
  1: 'Processando',
  2: 'Autorizada',
  3: 'Erro',
  4: 'Cancelada',
}

export function fetchNfses(
  token: string,
  companyId: string,
  options: {
    search?: string
    status?: number
    peopleId?: string
    dateStart?: string
    dateEnd?: string
    page?: number
    limit?: number
    orderBy?: string
    sortedBy?: string
  } = {}
) {
  return apiGet<Paginated<NfseRecord>>(
    '/nfse',
    {
      companyId,
      search: options.search,
      status: options.status !== undefined ? String(options.status) : undefined,
      peopleId: options.peopleId,
      dateStart: options.dateStart,
      dateEnd: options.dateEnd,
      page: options.page ? String(options.page) : '1',
      limit: options.limit ? String(options.limit) : '20',
      orderBy: options.orderBy,
      sortedBy: options.sortedBy,
    },
    token
  )
}

export function fetchNfse(token: string, id: string) {
  return apiGet<NfseRecord>(`/nfse/${id}`, {}, token)
}

export interface NfsePayload {
  companyId: string
  peopleId: string
  status?: number
  dataEmissao?: string
  dataCompetencia?: string
  serieDps?: number
  numeroDps?: number
  emitenteDps?: number
  codigoMunicipioEmissora?: number
  cnpjPrestador?: string | null
  cpfPrestador?: string | null
  inscricaoMunicipalPrestador?: string | null
  razaoSocialPrestador?: string
  codigoMunicipioPrestador?: number
  cepPrestador?: string | null
  logradouroPrestador?: string | null
  numeroPrestador?: string | null
  complementoPrestador?: string | null
  bairroPrestador?: string | null
  telefonePrestador?: string | null
  emailPrestador?: string | null
  codigoOpcaoSimplesNacional?: number
  regimeTributarioSimplesNacional?: number | null
  regimeEspecialTributacao?: number
  cnpjTomador?: string | null
  cpfTomador?: string | null
  inscricaoMunicipalTomador?: string | null
  razaoSocialTomador: string
  codigoMunicipioTomador?: number
  cepTomador?: string | null
  logradouroTomador?: string | null
  numeroTomador?: string | null
  complementoTomador?: string | null
  bairroTomador?: string | null
  telefoneTomador?: string | null
  emailTomador?: string | null
  codigoMunicipioPrestacao?: number
  codigoTributacaoNacionalIss?: string
  codigoTributacaoMunicipalIss?: string | null
  descricaoServico: string
  pedidoCompra?: string
  informacoesComplementares?: string
  valorServico: number
  descontoIncondicionado?: number
  descontoCondicionado?: number
  valorDeducaoServico?: number
  tributacaoIss?: number
  tipoRetencaoIss?: number
  percentualAliquotaRelativaMunicipio?: number
}

export function createNfse(token: string, payload: NfsePayload) {
  return apiPost<NfseRecord>('/nfse', payload, token)
}

export function updateNfse(token: string, id: string, payload: Partial<NfsePayload>) {
  return apiPut<NfseRecord>(`/nfse/${id}`, payload, token)
}

export function deleteNfse(token: string, id: string) {
  return apiDelete<void>(`/nfse/${id}`, token)
}

export function sendNfse(token: string, id: string) {
  return apiPost<{ status: number; job_id: string; mensagem: string }>(`/nfse/send/${id}`, {}, token)
}

export function forceSendNfse(token: string, id: string) {
  return apiPost<{ status: number; job_id: string; mensagem: string }>(`/nfse/force-send/${id}`, {}, token)
}

export interface NfseSendLogRecord {
  id: string
  code?: number
  created_at?: string
  phase: string
  action: string
  status?: number | null
  http_status?: number | null
  error_message?: string | null
  request_payload?: string | null
  response_payload?: string | null
}

export function fetchNfseLogs(token: string, id: string) {
  return apiGet<NfseSendLogRecord[]>(`/nfse/${id}/logs`, {}, token)
}
