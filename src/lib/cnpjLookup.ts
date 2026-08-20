export interface CnpjLookupResult {
  name: string
  socialName: string
  phone: string
  email: string
  zipCode: string
  street: string
  number: string
  complement: string
  district: string
  city: string
  state: string
  codeIbge: string
  birth: string
}

export async function fetchCnpjData(cnpj: string): Promise<CnpjLookupResult> {
  const digits = cnpj.replace(/\D/g, '')
  const response = await fetch(`https://publica.cnpj.ws/cnpj/${digits}`)

  if (!response.ok) {
    throw new Error('CNPJ não encontrado.')
  }

  const data = await response.json()
  const est = data.estabelecimento ?? {}
  const activityStart = String(est.data_inicio_atividade ?? '').replace(/\D/g, '')

  return {
    name: est.nome_fantasia || data.razao_social || '',
    socialName: data.razao_social || '',
    phone: est.ddd1 && est.telefone1 ? `${est.ddd1}${est.telefone1}` : '',
    email: est.email || '',
    zipCode: est.cep || '',
    street: est.logradouro || '',
    number: est.numero || '',
    complement: est.complemento || '',
    district: est.bairro || '',
    city: est.cidade?.nome || '',
    state: est.estado?.sigla || '',
    codeIbge: est.cidade?.ibge_id ? String(est.cidade.ibge_id) : '',
    birth:
      activityStart.length === 8
        ? `${activityStart.slice(0, 4)}-${activityStart.slice(4, 6)}-${activityStart.slice(6, 8)}`
        : '',
  }
}
