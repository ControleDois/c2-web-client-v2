import { useEffect, useState } from 'react'
import { fetchPerson, PERSON_IE_INDICATOR_LABELS, type PersonRecord } from '../lib/people'
import { formatDocument } from '../lib/formatDocument'
import { AlertTriangleIcon, CheckCircleIcon } from './icons'

interface NfeCustomerSummaryProps {
  token: string
  personId: string
}

// O que a SEFAZ exige do destinatário: aponta já no passo do cliente o que
// falta no cadastro, em vez de só aparecer como pendência na hora de salvar.
function findMissing(person: PersonRecord): string[] {
  const missing: string[] = []
  const address = person.address
  const indicator = person.state_registration_indicator
  const isContributor = indicator === 1 || (!indicator && Boolean(person.state_registration))

  if (!person.document) missing.push('CPF/CNPJ')
  if (isContributor && !person.state_registration) missing.push('inscrição estadual')
  if (!address?.address) missing.push('logradouro')
  if (!address?.number) missing.push('número do endereço')
  if (!address?.district) missing.push('bairro')
  if (!address?.city) missing.push('município')
  if (!address?.state) missing.push('UF')
  if (!address?.code_ibge) missing.push('código IBGE do município')
  if (!address?.zip_code) missing.push('CEP')
  return missing
}

function describeContributor(person: PersonRecord): string {
  const indicator = person.state_registration_indicator
  if (indicator === 1 || indicator === 2 || indicator === 9) return PERSON_IE_INDICATOR_LABELS[indicator]
  return person.state_registration ? PERSON_IE_INDICATOR_LABELS[1] : PERSON_IE_INDICATOR_LABELS[9]
}

export function NfeCustomerSummary({ token, personId }: NfeCustomerSummaryProps) {
  const [person, setPerson] = useState<PersonRecord | null>(null)
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    let cancelled = false
    setPerson(null)
    setFailed(false)
    fetchPerson(token, personId)
      .then((res) => {
        if (!cancelled) setPerson(res)
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => {
      cancelled = true
    }
  }, [token, personId])

  if (failed) return null
  if (!person) return <div className="h-24 animate-pulse rounded-xl bg-[var(--page)]" />

  const missing = findMissing(person)
  const address = person.address
  const line = [address?.address, address?.number, address?.district].filter(Boolean).join(', ')
  const city = [address?.city, address?.state].filter(Boolean).join(' - ')

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-x-6 gap-y-3 rounded-xl bg-[var(--page)] p-4 sm:grid-cols-2 xl:grid-cols-3">
        <Info label="Nome / razão social" value={person.name} />
        <Info label="CPF / CNPJ" value={person.document ? formatDocument(person.document) : undefined} />
        <Info label="Contribuinte de ICMS" value={describeContributor(person)} />
        <Info label="Inscrição estadual" value={person.state_registration || undefined} />
        <Info label="Endereço" value={line || undefined} />
        <Info
          label="Cidade / CEP"
          value={[city, address?.zip_code].filter(Boolean).join(' · ') || undefined}
        />
        <Info label="Código IBGE" value={address?.code_ibge || undefined} />
        <Info label="E-mail" value={person.email || undefined} />
      </div>

      {missing.length > 0 ? (
        <p className="flex items-start gap-2 rounded-xl bg-[var(--amber-100)] px-3.5 py-2.5 text-[12.5px] font-medium text-[var(--amber-500)]">
          <AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5 flex-none" />
          <span>
            Faltam no cadastro do cliente: {missing.join(', ')}. A SEFAZ exige esses dados — complete em Pessoas antes
            de emitir.
          </span>
        </p>
      ) : (
        <p className="flex items-center gap-2 text-[12.5px] font-medium text-[var(--green-600)]">
          <CheckCircleIcon className="h-3.5 w-3.5 flex-none" />
          Cadastro do cliente completo para a NF-e.
        </p>
      )}
    </div>
  )
}

function Info({ label, value }: { label: string; value?: string }) {
  return (
    <div className="min-w-0">
      <p className="text-[11.5px] font-semibold text-[var(--muted)]">{label}</p>
      <p className="truncate text-[13.5px] font-medium text-[var(--ink)]" title={value}>
        {value || '—'}
      </p>
    </div>
  )
}
