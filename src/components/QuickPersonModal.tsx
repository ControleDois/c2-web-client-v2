import { useEffect, useState, type FormEvent } from 'react'
import { createPerson, fetchPeople, PERSON_IE_INDICATOR_LABELS, type PersonPayload, type PersonRecord } from '../lib/people'
import { fetchCnpjData } from '../lib/cnpjLookup'
import { formatDocument } from '../lib/formatDocument'
import { formatPhone } from '../lib/formatPhone'
import { ApiError } from '../lib/api'
import { TextField } from './form/TextField'
import { SelectField } from './form/SelectField'
import { CloseIcon, FileTextIcon, MailIcon, UserIcon, WhatsappIcon } from './icons'
import type { AuthCompany, AuthSession } from '../lib/auth'

export interface QuickPersonRequest {
  // Papel do novo cadastro (2 = Cliente, 3 = Fornecedor).
  role: number
  // Texto que a pessoa já tinha digitado na busca (vira o nome).
  name: string
  onCreated: (person: PersonRecord) => void
}

interface QuickPersonModalProps {
  request: QuickPersonRequest | null
  session: AuthSession
  company: AuthCompany
  onClose: () => void
}

const ROLE_TITLES: Record<number, string> = { 2: 'Cadastrar cliente', 3: 'Cadastrar fornecedor' }

// Cadastro rápido de pessoa: abre por cima da tela em que a pessoa estava
// sendo escolhida, grava e já devolve o cadastro para ficar vinculado — sem
// sair do formulário. O cadastro completo continua na tela de Pessoas.
export function QuickPersonModal({ request, session, company, onClose }: QuickPersonModalProps) {
  const [name, setName] = useState('')
  const [document, setDocument] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [ieIndicator, setIeIndicator] = useState(9)
  const [stateRegistration, setStateRegistration] = useState('')
  const [address, setAddress] = useState<PersonPayload['address']>(undefined)
  const [lookingUp, setLookingUp] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [existing, setExisting] = useState<PersonRecord | null>(null)

  useEffect(() => {
    if (!request) return
    setName(request.name)
    setDocument('')
    setPhone('')
    setEmail('')
    setIeIndicator(9)
    setStateRegistration('')
    setAddress(undefined)
    setError(null)
    setExisting(null)
  }, [request])

  if (!request) return null

  const digits = document.replace(/\D/g, '')

  async function handleDocumentChange(value: string) {
    const formatted = formatDocument(value)
    setDocument(formatted)
    setExisting(null)
    setError(null)

    // CNPJ completo: preenche nome, contato e endereço pela consulta pública.
    if (formatted.replace(/\D/g, '').length === 14) {
      setLookingUp(true)
      try {
        const data = await fetchCnpjData(formatted)
        setName((current) => current.trim() || data.name)
        setPhone((current) => current || (data.phone ? formatPhone(data.phone) : ''))
        setEmail((current) => current || data.email)
        setAddress({
          zip_code: data.zipCode,
          address: data.street,
          number: data.number,
          complement: data.complement,
          district: data.district,
          city: data.city,
          state: data.state,
          code_ibge: data.codeIbge,
        })
      } catch {
        // consulta é só uma ajuda: o cadastro segue com o que foi digitado
      } finally {
        setLookingUp(false)
      }
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!request) return
    setError(null)

    if (!name.trim()) {
      setError('Informe o nome.')
      return
    }
    if (digits.length !== 11 && digits.length !== 14) {
      setError('Informe um CPF (11 dígitos) ou CNPJ (14 dígitos) válido.')
      return
    }

    if (ieIndicator === 1 && !stateRegistration.trim()) {
      setError('Informe a inscrição estadual ou marque o cliente como "Não contribuinte".')
      return
    }

    setSaving(true)
    try {
      const created = await createPerson(session.token.token, {
        company_id: company.id,
        name: name.trim(),
        document: digits,
        people_type: digits.length > 11 ? 1 : 0,
        roles: [request.role],
        status: [0],
        phone: phone.replace(/\D/g, '') || undefined,
        email: email.trim() || undefined,
        state_registration_indicator: ieIndicator,
        state_registration: ieIndicator === 1 ? stateRegistration.trim() : undefined,
        address,
      })
      request.onCreated(created)
      onClose()
    } catch (err) {
      const message = err instanceof ApiError ? err.message : 'Não foi possível cadastrar.'
      setError(message)
      // Documento já cadastrado: oferece usar o cadastro que já existe.
      try {
        const found = await fetchPeople(session.token.token, company.id, { search: digits, limit: 5 })
        setExisting(found.data.find((person) => person.document?.replace(/\D/g, '') === digits) ?? null)
      } catch {
        setExisting(null)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[90svh] w-full max-w-[460px] overflow-y-auto rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[15px] font-bold text-[var(--ink)]">{ROLE_TITLES[request.role] ?? 'Cadastrar pessoa'}</h2>
            <p className="mt-1 text-[12.5px] text-[var(--ink-soft)]">
              Cadastro rápido: ao salvar, já fica vinculado aqui. O cadastro completo continua em Pessoas.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)]"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-4">
          <TextField
            label="CPF ou CNPJ"
            icon={<FileTextIcon className="h-4 w-4" />}
            placeholder="Só números"
            inputMode="numeric"
            autoFocus
            value={document}
            onChange={(event) => handleDocumentChange(event.target.value)}
            trailing={lookingUp ? <span className="text-[11px] text-[var(--muted)]">Consultando…</span> : undefined}
          />
          <TextField
            label="Nome"
            icon={<UserIcon className="h-4 w-4" />}
            placeholder="Nome completo ou razão social"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Telefone / WhatsApp"
              icon={<WhatsappIcon className="h-4 w-4" />}
              placeholder="(65) 90000-0000"
              inputMode="tel"
              value={phone}
              onChange={(event) => setPhone(formatPhone(event.target.value))}
            />
            <TextField
              label="E-mail"
              icon={<MailIcon className="h-4 w-4" />}
              placeholder="Opcional"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <SelectField
              label="Contribuinte de ICMS"
              value={ieIndicator}
              onChange={(event) => setIeIndicator(Number(event.target.value))}
            >
              {Object.entries(PERSON_IE_INDICATOR_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
            {ieIndicator === 1 && (
              <TextField
                label="Inscrição estadual"
                icon={<FileTextIcon className="h-4 w-4" />}
                placeholder="Número da IE"
                value={stateRegistration}
                onChange={(event) => setStateRegistration(event.target.value)}
              />
            )}
          </div>
        </div>

        {error && <p className="mt-4 text-[13px] font-medium text-[var(--red-500)]">{error}</p>}
        {existing && (
          <button
            type="button"
            onClick={() => {
              request.onCreated(existing)
              onClose()
            }}
            className="mt-2 w-full rounded-xl bg-[var(--blue-100)] px-4 py-2.5 text-left text-[13px] font-semibold text-[var(--blue-700)] hover:bg-[var(--blue-300)]/30"
          >
            Usar o cadastro existente: {existing.name}
          </button>
        )}

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-xl border border-[var(--border)] text-[13px] font-bold text-[var(--ink-soft)]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || lookingUp}
            className="h-11 flex-1 rounded-xl bg-[var(--blue-500)] text-[13px] font-bold text-white hover:bg-[var(--blue-700)] disabled:opacity-60"
          >
            {saving ? 'Salvando…' : 'Cadastrar e vincular'}
          </button>
        </div>
      </form>
    </div>
  )
}
