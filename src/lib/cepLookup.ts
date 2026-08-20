export interface CepLookupResult {
  street: string
  district: string
  city: string
  state: string
  codeIbge: string
}

export async function fetchCepData(cep: string): Promise<CepLookupResult> {
  const digits = cep.replace(/\D/g, '')
  const response = await fetch(`https://viacep.com.br/ws/${digits}/json/`)

  if (!response.ok) {
    throw new Error('CEP não encontrado.')
  }

  const data = await response.json()
  if (data.erro) {
    throw new Error('CEP não encontrado.')
  }

  return {
    street: data.logradouro || '',
    district: data.bairro || '',
    city: data.localidade || '',
    state: data.uf || '',
    codeIbge: data.ibge || '',
  }
}
