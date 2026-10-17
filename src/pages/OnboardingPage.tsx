import { useEffect, useState } from 'react'
import { Logo } from '../components/Logo'
import { TextField } from '../components/form/TextField'
import { SelectField } from '../components/form/SelectField'
import { BuildingIcon, CheckCircleIcon, ChevronLeftIcon, ChevronRightIcon, MailIcon, UserIcon } from '../components/icons'
import {
  NICHE_OPTIONS,
  completeOnboarding,
  saveOnboarding,
  type OnboardingResult,
} from '../lib/onboarding'
import { fetchCnpjData } from '../lib/cnpjLookup'
import { fetchCepData } from '../lib/cepLookup'
import { isValidCnpj, isValidCpf } from '../lib/document'
import { formatDocument } from '../lib/formatDocument'
import { formatPhone } from '../lib/formatPhone'
import { formatCep } from '../lib/formatCep'
import { BRAZIL_STATES } from '../lib/brazilStates'
import { trialDaysLeft, CONTACT_URL } from '../lib/licenseState'
import { formatDate } from '../lib/format'
import { ApiError } from '../lib/api'
import type { AppPage } from '../components/layout/AppShell'
import type { AuthCompany, AuthSession } from '../lib/auth'

const PDV_URL = (import.meta.env.VITE_PDV_URL ?? 'https://pdv.controledois.com.br').replace(/\/+$/, '')

type Destination = { page: AppPage } | { href: string }

interface FirstStep {
  title: string
  text: string
  to: Destination
}

interface OnboardingPageProps {
  session: AuthSession
  company: AuthCompany
  // Junta no cadastro da empresa em uso o que o servidor devolveu (segmento, nome, documento, conclusão).
  onCompanyChange: (result: OnboardingResult) => void
  onFinish: (page?: AppPage) => void
  onLogout: () => void
}

const STEPS = ['Seu negócio', 'Sua empresa', 'Tudo pronto']

// Primeiros passos sugeridos depois da configuração, de acordo com o segmento escolhido.
function firstSteps(systemType: number): FirstStep[] {
  const pdv: FirstStep = {
    title: 'Abrir o PDV',
    text: 'Venda rápida no balcão, com leitor de código de barras.',
    to: { href: PDV_URL },
  }
  const products: FirstStep = { title: 'Cadastrar produtos', text: 'Comece pelo que você vende.', to: { page: 'products' } }
  const people: FirstStep = { title: 'Cadastrar o primeiro cliente', text: 'Clientes, fornecedores e contatos.', to: { page: 'people' } }

  if (systemType === 21) {
    return [
      { title: 'Cadastrar produtos de mercearia', text: 'Em Produtos, o botão "Cadastrar produtos de mercearia" traz o catálogo pronto.', to: { page: 'products' } },
      pdv,
      people,
    ]
  }
  if ([14, 15, 16, 17, 12, 8, 10, 22].includes(systemType)) return [products, pdv, people]
  if (systemType === 6) {
    return [
      { title: 'Cadastrar veículos', text: 'Placa, modelo e dados da frota.', to: { page: 'vehicles' } },
      { title: 'Criar o primeiro aluguel', text: 'Contrato, valores e cobrança.', to: { page: 'vehicle-rentals' } },
      people,
    ]
  }
  if (systemType === 7) {
    return [{ title: 'Abrir uma ordem de serviço', text: 'Registre o serviço e o cliente.', to: { page: 'order-services' } }, people, products]
  }
  if (systemType === 20) {
    return [{ title: 'Fazer o primeiro orçamento', text: 'Orçamento por medida, com cálculo do vidro.', to: { page: 'glass-orders' } }, people, products]
  }
  return [people, products]
}

const plansStep: FirstStep = {
  title: 'Conhecer os planos',
  text: 'Libera notas fiscais, assinatura digital e WhatsApp, e continua depois do teste.',
  to: { page: 'subscription' },
}

const nicheName = (type: number) => NICHE_OPTIONS.find((item) => item.type === type)?.name ?? 'Outro segmento'

export function OnboardingPage({ session, company, onCompanyChange, onFinish, onLogout }: OnboardingPageProps) {
  const token = session.token.token
  const address = (company.people?.address ?? {}) as Record<string, string | null | undefined>

  const [step, setStep] = useState(0)
  const [systemType, setSystemType] = useState<number | null>(null)
  const [name, setName] = useState(company.people?.name ?? '')
  const [socialName, setSocialName] = useState('')
  const [document, setDocument] = useState(company.people?.document ? formatDocument(company.people.document) : '')
  const [phone, setPhone] = useState(typeof company.people?.phone === 'string' ? formatPhone(company.people.phone) : '')
  const [email, setEmail] = useState(typeof company.people?.email === 'string' ? company.people.email : session.user.email)
  const [zipCode, setZipCode] = useState(address.zip_code ? formatCep(address.zip_code) : '')
  const [street, setStreet] = useState(address.address ?? '')
  const [number, setNumber] = useState(address.number ?? '')
  const [district, setDistrict] = useState(address.district ?? '')
  const [city, setCity] = useState(address.city ?? '')
  const [state, setState] = useState(address.state ?? '')
  const [complement, setComplement] = useState(address.complement ?? '')
  const [codeIbge, setCodeIbge] = useState(address.code_ibge ?? '')
  const [lookupMessage, setLookupMessage] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const documentDigits = document.replace(/\D/g, '')

  // Com o CNPJ completo e válido, preenche sozinho o que ainda estiver vazio.
  useEffect(() => {
    if (documentDigits.length !== 14 || !isValidCnpj(documentDigits)) return
    let cancelled = false
    setLookupMessage('Buscando os dados do CNPJ…')
    fetchCnpjData(documentDigits)
      .then((result) => {
        if (cancelled) return
        setSocialName(result.socialName)
        setPhone((current) => current || (result.phone ? formatPhone(result.phone) : ''))
        setEmail((current) => current || result.email)
        setZipCode((current) => current || (result.zipCode ? formatCep(result.zipCode) : ''))
        setStreet((current) => current || result.street)
        setNumber((current) => current || result.number)
        setComplement((current) => current || result.complement)
        setDistrict((current) => current || result.district)
        setCity((current) => current || result.city)
        setState((current) => current || result.state)
        setCodeIbge((current) => current || result.codeIbge)
        setLookupMessage(`Dados encontrados: ${result.socialName || result.name}`)
      })
      .catch(() => {
        if (!cancelled) setLookupMessage('Não encontramos esse CNPJ; preencha os dados à mão.')
      })
    return () => {
      cancelled = true
    }
  }, [documentDigits])

  async function handleCep(value: string) {
    setZipCode(formatCep(value))
    const digits = value.replace(/\D/g, '')
    if (digits.length !== 8) return
    try {
      const result = await fetchCepData(digits)
      setStreet((current) => result.street || current)
      setDistrict((current) => result.district || current)
      setCity((current) => result.city || current)
      setState((current) => result.state || current)
      setCodeIbge(result.codeIbge || '')
    } catch {
      // CEP não encontrado: o endereço continua editável à mão
    }
  }

  async function saveNiche() {
    if (systemType === null) {
      setError('Escolha o tipo do seu negócio para continuar.')
      return
    }
    setSaving(true)
    setError(null)
    try {
      onCompanyChange(await saveOnboarding(token, { company_id: company.id, system_type: systemType }))
      setStep(1)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o segmento. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  async function saveCompanyData() {
    setError(null)
    if (!name.trim()) {
      setError('Informe o nome da empresa.')
      return
    }
    if (documentDigits && !isValidCpf(documentDigits) && !isValidCnpj(documentDigits)) {
      setError('CPF ou CNPJ inválido. Confira os números ou deixe em branco para preencher depois.')
      return
    }
    setSaving(true)
    try {
      onCompanyChange(
        await saveOnboarding(token, {
          company_id: company.id,
          name: name.trim(),
          social_name: socialName || null,
          document: documentDigits || null,
          phone: phone.replace(/\D/g, '') || null,
          email: email.trim() || null,
          address: {
            zip_code: zipCode.replace(/\D/g, '') || null,
            address: street || null,
            number: number || null,
            district: district || null,
            city: city || null,
            state: state || null,
            complement: complement || null,
            code_ibge: codeIbge || null,
          },
        })
      )
      setStep(2)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar os dados. Tente novamente.')
    } finally {
      setSaving(false)
    }
  }

  async function finish(page?: AppPage) {
    setSaving(true)
    setError(null)
    try {
      onCompanyChange(await completeOnboarding(token, company.id))
      onFinish(page)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível concluir. Tente novamente.')
      setSaving(false)
    }
  }

  const chosenType = systemType ?? Number(company.system_type ?? 0)
  const days = trialDaysLeft(company)

  return (
    <div className="flex min-h-svh flex-col items-center bg-[var(--page)] px-4 py-8 sm:py-12">
      <div className="flex w-full max-w-3xl flex-col gap-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Logo className="h-10 w-10" />
            <div>
              <p className="text-[15px] font-bold text-[var(--ink)]">Vamos configurar sua empresa</p>
              <p className="text-[12px] text-[var(--muted)]">Leva menos de 2 minutos</p>
            </div>
          </div>
          <button type="button" onClick={onLogout} className="text-[12.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]">
            Sair
          </button>
        </div>

        <ol className="grid grid-cols-3 gap-2">
          {STEPS.map((label, index) => (
            <li key={label} className="flex flex-col gap-1.5">
              <span className={`h-1.5 rounded-full ${index <= step ? 'bg-[var(--blue-500)]' : 'bg-[var(--border)]'}`} />
              <span className={`text-[12px] font-semibold ${index === step ? 'text-[var(--blue-700)]' : 'text-[var(--muted)]'}`}>
                {index + 1}. {label}
              </span>
            </li>
          ))}
        </ol>

        <div className="rounded-[28px] bg-[var(--surface)] p-6 shadow-[var(--card-shadow)] sm:p-8">
          {step === 0 && (
            <>
              <h1 className="text-[20px] font-bold tracking-tight text-[var(--ink)]">Qual é o seu tipo de negócio?</h1>
              <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
                O sistema abre com os menus e as telas certas para o seu segmento.
              </p>
              <div className="mt-5 grid gap-2.5 sm:grid-cols-2">
                {NICHE_OPTIONS.map((option) => {
                  const selected = systemType === option.type
                  return (
                    <button
                      key={option.type}
                      type="button"
                      onClick={() => setSystemType(option.type)}
                      className={`flex items-start gap-3 rounded-2xl border p-4 text-left transition ${
                        selected
                          ? 'border-[var(--blue-500)] bg-[var(--blue-100)]'
                          : 'border-[var(--border)] hover:border-[var(--blue-300)]'
                      }`}
                    >
                      <span
                        className={`mt-0.5 flex h-5 w-5 flex-none items-center justify-center rounded-full border-2 ${
                          selected ? 'border-[var(--blue-500)] bg-[var(--blue-500)]' : 'border-[var(--border)]'
                        }`}
                      >
                        {selected && <span className="h-1.5 w-1.5 rounded-full bg-white" />}
                      </span>
                      <span>
                        <span className="block text-[14px] font-bold text-[var(--ink)]">{option.name}</span>
                        <span className="mt-0.5 block text-[12.5px] leading-snug text-[var(--ink-soft)]">{option.text}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </>
          )}

          {step === 1 && (
            <>
              <h1 className="text-[20px] font-bold tracking-tight text-[var(--ink)]">Dados da sua empresa</h1>
              <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
                Se tiver CNPJ, digite primeiro: preenchemos o restante sozinhos. Dá para ajustar depois.
              </p>
              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <TextField
                    label="CNPJ ou CPF"
                    icon={<BuildingIcon className="h-4 w-4" />}
                    inputMode="numeric"
                    placeholder="00.000.000/0000-00"
                    value={document}
                    onChange={(event) => {
                      setLookupMessage(null)
                      setDocument(formatDocument(event.target.value))
                    }}
                  />
                  {lookupMessage && <p className="mt-1.5 text-[12px] font-medium text-[var(--blue-700)]">{lookupMessage}</p>}
                </div>
                <div className="sm:col-span-2">
                  <TextField
                    label="Nome da empresa"
                    icon={<BuildingIcon className="h-4 w-4" />}
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                  />
                </div>
                <TextField
                  label="WhatsApp ou telefone"
                  icon={<UserIcon className="h-4 w-4" />}
                  inputMode="tel"
                  placeholder="(65) 99999-9999"
                  value={phone}
                  onChange={(event) => setPhone(formatPhone(event.target.value))}
                />
                <TextField
                  label="E-mail da empresa"
                  icon={<MailIcon className="h-4 w-4" />}
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                />
                <TextField
                  label="CEP"
                  icon={<BuildingIcon className="h-4 w-4" />}
                  inputMode="numeric"
                  placeholder="00000-000"
                  value={zipCode}
                  onChange={(event) => void handleCep(event.target.value)}
                />
                <TextField label="Número" icon={<BuildingIcon className="h-4 w-4" />} value={number} onChange={(event) => setNumber(event.target.value)} />
                <div className="sm:col-span-2">
                  <TextField label="Rua" icon={<BuildingIcon className="h-4 w-4" />} value={street} onChange={(event) => setStreet(event.target.value)} />
                </div>
                <TextField label="Bairro" icon={<BuildingIcon className="h-4 w-4" />} value={district} onChange={(event) => setDistrict(event.target.value)} />
                <TextField label="Cidade" icon={<BuildingIcon className="h-4 w-4" />} value={city} onChange={(event) => setCity(event.target.value)} />
                <SelectField label="Estado" value={state} onChange={(event) => setState(event.target.value)}>
                  <option value="">Selecione</option>
                  {BRAZIL_STATES.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </SelectField>
                <TextField label="Complemento" icon={<BuildingIcon className="h-4 w-4" />} value={complement} onChange={(event) => setComplement(event.target.value)} />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              <div className="flex items-center gap-3">
                <span className="flex h-11 w-11 flex-none items-center justify-center rounded-full bg-[var(--green-100)] text-[var(--green-600)]">
                  <CheckCircleIcon className="h-6 w-6" />
                </span>
                <div>
                  <h1 className="text-[20px] font-bold tracking-tight text-[var(--ink)]">Tudo pronto!</h1>
                  <p className="text-[13px] text-[var(--ink-soft)]">
                    {name || company.people?.name} · {nicheName(chosenType)}
                  </p>
                </div>
              </div>

              {days !== null && days >= 0 && (
                <p className="mt-4 rounded-xl bg-[var(--blue-100)] px-4 py-3 text-[13px] font-medium text-[var(--blue-700)]">
                  Seu teste grátis vai até {formatDate(company.license_expires_at)} ({days === 0 ? 'último dia' : `${days} dias`}). Depois disso o acesso
                  é bloqueado até a assinatura ser ativada.{' '}
                  <a href={CONTACT_URL} target="_blank" rel="noreferrer" className="font-bold underline underline-offset-2">
                    Fale com a gente
                  </a>{' '}
                  quando quiser continuar.
                </p>
              )}

              <p className="mt-5 text-[13px] font-bold text-[var(--ink)]">Por onde começar?</p>
              <div className="mt-2.5 flex flex-col gap-2.5">
                {[...firstSteps(chosenType), plansStep].map((item) => (
                  <button
                    key={item.title}
                    type="button"
                    disabled={saving}
                    onClick={() => {
                      if ('href' in item.to) {
                        window.open(item.to.href, '_blank', 'noreferrer')
                        void finish()
                      } else {
                        void finish(item.to.page)
                      }
                    }}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] p-4 text-left transition hover:border-[var(--blue-300)] disabled:opacity-60"
                  >
                    <span>
                      <span className="block text-[14px] font-bold text-[var(--ink)]">{item.title}</span>
                      <span className="mt-0.5 block text-[12.5px] text-[var(--ink-soft)]">{item.text}</span>
                    </span>
                    <ChevronRightIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
                  </button>
                ))}
              </div>
            </>
          )}

          {error && (
            <p className="mt-5 rounded-lg bg-[var(--red-100)] px-3 py-2 text-[13px] font-medium text-[var(--red-500)]">{error}</p>
          )}

          <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
            {step === 1 ? (
              <button
                type="button"
                onClick={() => setStep(0)}
                className="flex items-center gap-1 text-[13px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
              >
                <ChevronLeftIcon className="h-3.5 w-3.5" /> Voltar
              </button>
            ) : (
              <span />
            )}

            {step === 0 && (
              <button
                type="button"
                onClick={() => void saveNiche()}
                disabled={saving}
                className="rounded-xl bg-[var(--blue-500)] px-6 py-3 text-[14px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
              >
                {saving ? 'Salvando…' : 'Continuar'}
              </button>
            )}
            {step === 1 && (
              <div className="flex flex-wrap items-center gap-3">
                <button type="button" onClick={() => setStep(2)} className="text-[13px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]">
                  Preencher depois
                </button>
                <button
                  type="button"
                  onClick={() => void saveCompanyData()}
                  disabled={saving}
                  className="rounded-xl bg-[var(--blue-500)] px-6 py-3 text-[14px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
                >
                  {saving ? 'Salvando…' : 'Continuar'}
                </button>
              </div>
            )}
            {step === 2 && (
              <button
                type="button"
                onClick={() => void finish()}
                disabled={saving}
                className="rounded-xl border border-[var(--border)] px-5 py-3 text-[13.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-60"
              >
                {saving ? 'Concluindo…' : 'Ir para o painel'}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
