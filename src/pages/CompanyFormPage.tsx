import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  createCompany,
  fetchCompany,
  updateCompany,
  fetchCertificateStatus,
  STATE_REGISTRATION_INDICATOR_LABELS,
  CRT_LABELS,
  SPECIAL_REGIME_LABELS,
  type CompanyRecord,
  type CertificateStatus,
} from '../lib/companies'
import { SYSTEM_TYPE_LABELS } from '../lib/systemTypes'
import { formatDocument } from '../lib/formatDocument'
import { formatPhone } from '../lib/formatPhone'
import { formatCep } from '../lib/formatCep'
import { BRAZIL_STATES } from '../lib/brazilStates'
import { fetchCnpjData } from '../lib/cnpjLookup'
import { fetchCepData } from '../lib/cepLookup'
import { ApiError } from '../lib/api'
import { getCached, setCached, clearCached } from '../lib/cache'
import { TextField } from '../components/form/TextField'
import { SelectField } from '../components/form/SelectField'
import { SectionCard } from '../components/SectionCard'
import {
  UserIcon,
  BadgeIcon,
  MailIcon,
  ChevronLeftIcon,
  PaperclipIcon,
  DownloadIcon,
  ShieldIcon,
  LockIcon,
  CheckCircleIcon,
  AlertTriangleIcon,
  BuildingIcon,
} from '../components/icons'
import { isMasterOfCompany, type AuthSession } from '../lib/auth'

interface CompanyFormPageProps {
  session: AuthSession
  companyId?: string
  onBack?: () => void
  onSaved: () => void
  embedded?: boolean
}

export function CompanyFormPage({ session, companyId, onBack, onSaved, embedded = false }: CompanyFormPageProps) {
  const isMaster = isMasterOfCompany(session, companyId)
  const [loading, setLoading] = useState(Boolean(companyId))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const [name, setName] = useState('')
  const [socialName, setSocialName] = useState('')
  const [document, setDocument] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [simple, setSimple] = useState(false)
  const [active, setActive] = useState(true)
  const [systemType, setSystemType] = useState(0)

  const [stateRegistrationIndicator, setStateRegistrationIndicator] = useState(1)
  const [stateRegistration, setStateRegistration] = useState('')
  const [municipalRegistration, setMunicipalRegistration] = useState('')
  const [inscriptionSuframa, setInscriptionSuframa] = useState('')
  const [generalRecord, setGeneralRecord] = useState('')
  const [crt, setCrt] = useState(3)
  const [specialRegime, setSpecialRegime] = useState(0)

  const [zipCode, setZipCode] = useState('')
  const [street, setStreet] = useState('')
  const [number, setNumber] = useState('')
  const [district, setDistrict] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [complement, setComplement] = useState('')

  const [cnpjLoading, setCnpjLoading] = useState(false)
  const [cnpjMessage, setCnpjMessage] = useState<string | null>(null)
  const [cepLoading, setCepLoading] = useState(false)
  const [cepMessage, setCepMessage] = useState<string | null>(null)

  const [existingLogoUrl, setExistingLogoUrl] = useState<string | null>(null)
  const [logoFile, setLogoFile] = useState<File | undefined>(undefined)

  const logoPreviewUrl = useMemo(() => (logoFile ? URL.createObjectURL(logoFile) : existingLogoUrl), [
    logoFile,
    existingLogoUrl,
  ])

  useEffect(() => {
    return () => {
      if (logoFile) URL.revokeObjectURL(logoPreviewUrl!)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logoFile])

  const [certificatePath, setCertificatePath] = useState<string | null>(null)
  const [certificateFile, setCertificateFile] = useState<File | undefined>(undefined)
  const [certificatePassword, setCertificatePassword] = useState('')
  const [certificateStatus, setCertificateStatus] = useState<CertificateStatus | null>(null)
  const [certificateStatusLoading, setCertificateStatusLoading] = useState(false)
  const [certificateReloadKey, setCertificateReloadKey] = useState(0)

  useEffect(() => {
    if (!companyId) return
    let cancelled = false

    function applyCompany(company: CompanyRecord) {
      setName(company.name ?? '')
      setSocialName(company.social_name ?? '')
      setDocument(company.document ? formatDocument(company.document) : '')
      setPhone(company.phone ? formatPhone(company.phone) : '')
      setEmail(company.email ?? '')
      setSimple(Boolean(company.simple))
      setActive(company.company?.active !== false)
      setSystemType(company.company?.system_type ?? 0)
      setStateRegistrationIndicator(company.state_registration_indicator ?? 1)
      setStateRegistration(company.state_registration ?? '')
      setMunicipalRegistration(company.municipal_registration ?? '')
      setInscriptionSuframa(company.inscription_suframa ?? '')
      setGeneralRecord(company.general_record ?? '')
      setCrt(company.crt ?? 3)
      setSpecialRegime(company.special_regime ?? 0)
      setZipCode(company.address?.zip_code ? formatCep(company.address.zip_code) : '')
      setStreet(company.address?.address ?? '')
      setNumber(company.address?.number ?? '')
      setDistrict(company.address?.district ?? '')
      setCity(company.address?.city ?? '')
      setState(company.address?.state ?? '')
      setComplement(company.address?.complement ?? '')
      setCertificatePath(company.certificate_path ?? null)
      setCertificatePassword(company.certificate_password ?? '')
      setExistingLogoUrl(company.file_url ?? null)
    }

    // Cache-first: se já temos os dados dessa empresa em memória, mostramos
    // na hora e atualizamos por baixo, sem piscar o skeleton de carregamento
    // toda vez que a aba é reaberta.
    const cacheKey = `company-form:${companyId}`
    const cached = getCached<CompanyRecord>(cacheKey)

    if (cached) {
      applyCompany(cached)
      setLoading(false)
      setLoadError(null)
    } else {
      setLoading(true)
      setLoadError(null)
    }

    fetchCompany(session.token.token, companyId)
      .then((company: CompanyRecord) => {
        if (cancelled) return
        applyCompany(company)
        setCached(cacheKey, company)
      })
      .catch((err) => {
        if (cancelled) return
        // Se já tínhamos dados em cache exibidos, uma falha na atualização
        // silenciosa não deve derrubar a tela — o usuário já está vendo algo.
        if (!cached) {
          setLoadError(err instanceof ApiError ? err.message : 'Não foi possível carregar a empresa.')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [companyId, session.token.token, reloadKey])

  useEffect(() => {
    if (!companyId) return
    let cancelled = false

    const cacheKey = `certificate-status:${companyId}`
    const cached = getCached<CertificateStatus>(cacheKey)

    if (cached) {
      setCertificateStatus(cached)
      setCertificateStatusLoading(false)
    } else {
      setCertificateStatusLoading(true)
    }

    fetchCertificateStatus(session.token.token, companyId)
      .then((status) => {
        if (cancelled) return
        setCertificateStatus(status)
        setCached(cacheKey, status)
      })
      .catch(() => {
        if (!cancelled && !cached) setCertificateStatus(null)
      })
      .finally(() => {
        if (!cancelled) setCertificateStatusLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [companyId, session.token.token, reloadKey, certificateReloadKey])

  async function handleCnpjLookup() {
    const digits = document.replace(/\D/g, '')
    if (digits.length !== 14) return

    setCnpjLoading(true)
    setCnpjMessage(null)
    try {
      const result = await fetchCnpjData(digits)
      if (result.name) setName(result.name)
      if (result.socialName) setSocialName(result.socialName)
      if (result.phone) setPhone(formatPhone(result.phone))
      if (result.email) setEmail(result.email)
      if (result.zipCode) setZipCode(formatCep(result.zipCode))
      if (result.street) setStreet(result.street)
      if (result.number) setNumber(result.number)
      if (result.complement) setComplement(result.complement)
      if (result.district) setDistrict(result.district)
      if (result.city) setCity(result.city)
      if (result.state) setState(result.state)
    } catch {
      setCnpjMessage('Não foi possível encontrar o CNPJ.')
    } finally {
      setCnpjLoading(false)
    }
  }

  async function handleCepLookup() {
    const digits = zipCode.replace(/\D/g, '')
    if (digits.length !== 8) return

    setCepLoading(true)
    setCepMessage(null)
    try {
      const result = await fetchCepData(digits)
      if (result.street) setStreet(result.street)
      if (result.district) setDistrict(result.district)
      if (result.city) setCity(result.city)
      if (result.state) setState(result.state)
    } catch {
      setCepMessage('Não foi possível encontrar o CEP.')
    } finally {
      setCepLoading(false)
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSaved(false)

    const documentDigits = document.replace(/\D/g, '')
    if (!name || !documentDigits) {
      setError('Preencha nome e CPF/CNPJ para continuar.')
      return
    }

    const address = {
      zip_code: zipCode ? zipCode.replace(/\D/g, '') : undefined,
      address: street || undefined,
      number: number || undefined,
      district: district || undefined,
      city: city || undefined,
      state: state || undefined,
      complement: complement || undefined,
    }
    const hasAddress = Object.values(address).some(Boolean)

    const payload = {
      id: companyId,
      name,
      document: documentDigits,
      social_name: socialName || undefined,
      people_type: documentDigits.length > 11 ? 1 : 0,
      simple,
      phone: phone ? phone.replace(/\D/g, '') : undefined,
      email: email || undefined,
      state_registration_indicator: stateRegistrationIndicator,
      state_registration: stateRegistrationIndicator === 1 ? stateRegistration || undefined : undefined,
      municipal_registration: municipalRegistration || undefined,
      inscription_suframa: inscriptionSuframa || undefined,
      general_record: generalRecord || undefined,
      crt,
      special_regime: specialRegime,
      active: companyId ? active : undefined,
      system_type: companyId && isMaster ? systemType : undefined,
      address: hasAddress ? address : undefined,
      certificate_file: certificateFile,
      certificate_password: certificatePassword || undefined,
      logo_file: logoFile,
    }

    setSubmitting(true)
    try {
      let result: CompanyRecord
      if (companyId) {
        result = await updateCompany(session.token.token, companyId, payload)
        clearCached(`company-form:${companyId}`)
        clearCached(`certificate-status:${companyId}`)
      } else {
        result = await createCompany(session.token.token, payload)
      }
      if (certificateFile) {
        setCertificateFile(undefined)
        setCertificatePassword('')
        setCertificatePath(result.certificate_path ?? null)
        setCertificateReloadKey((key) => key + 1)
      }
      if (logoFile) {
        setLogoFile(undefined)
        setExistingLogoUrl(result.file_url ?? null)
      }
      if (embedded) {
        setSaved(true)
        setTimeout(() => setSaved(false), 3000)
      }
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar a empresa.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className={embedded ? 'flex flex-col gap-6' : 'flex flex-col gap-6 p-8'}>
      {!embedded && (
        <div>
          <button
            type="button"
            onClick={onBack}
            className="mb-3 flex items-center gap-1 text-[12.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
          >
            <ChevronLeftIcon className="h-3.5 w-3.5" />
            Voltar para empresas
          </button>
          <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Conta</p>
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">
            {companyId ? 'Editar empresa' : 'Nova empresa'}
          </h1>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-11 animate-pulse rounded-xl bg-[var(--surface)]" />
          ))}
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl bg-[var(--red-100)] p-5">
          <p className="text-[13.5px] font-medium text-[var(--red-500)]">{loadError}</p>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="rounded-xl bg-[var(--surface)] px-4 py-2 text-[13px] font-bold text-[var(--red-500)] hover:bg-white"
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="mb-4 text-[14px] font-bold text-[var(--ink)]">Dados</h2>

            <div className="mb-5 flex items-center gap-4">
              <span className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-2xl bg-[var(--blue-100)] text-[var(--blue-700)]">
                {logoPreviewUrl ? (
                  <img src={logoPreviewUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <BuildingIcon className="h-7 w-7" />
                )}
              </span>
              <div className="flex flex-col gap-1.5">
                <label className="flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]">
                  <PaperclipIcon className="h-3.5 w-3.5 flex-none" />
                  {logoFile ? logoFile.name : 'Alterar logo'}
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={(event) => setLogoFile(event.target.files?.[0])}
                  />
                </label>
                {logoFile && (
                  <button
                    type="button"
                    onClick={() => setLogoFile(undefined)}
                    className="w-fit text-[12px] font-semibold text-[var(--red-500)] hover:underline"
                  >
                    Cancelar novo logo
                  </button>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <TextField
                label="Nome fantasia"
                icon={<UserIcon className="h-4 w-4" />}
                placeholder="Nome da empresa"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <TextField
                label="Razão social"
                icon={<UserIcon className="h-4 w-4" />}
                placeholder="Opcional"
                value={socialName}
                onChange={(event) => setSocialName(event.target.value)}
              />
              <div>
                <TextField
                  label="CPF / CNPJ"
                  icon={<BadgeIcon className="h-4 w-4" />}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  value={document}
                  onChange={(event) => setDocument(formatDocument(event.target.value))}
                  action={
                    document.replace(/\D/g, '').length === 14 ? (
                      <button
                        type="button"
                        onClick={handleCnpjLookup}
                        disabled={cnpjLoading}
                        className="text-[12px] font-semibold text-[var(--blue-700)] hover:underline disabled:opacity-60"
                      >
                        {cnpjLoading ? 'Consultando…' : 'Consultar CNPJ'}
                      </button>
                    ) : undefined
                  }
                />
                {cnpjMessage && <p className="mt-1.5 text-[12px] text-[var(--red-500)]">{cnpjMessage}</p>}
              </div>
              <TextField
                label="Telefone"
                icon={<UserIcon className="h-4 w-4" />}
                placeholder="(65) 99999-9999"
                value={phone}
                onChange={(event) => setPhone(formatPhone(event.target.value))}
              />
              <TextField
                label="E-mail"
                icon={<MailIcon className="h-4 w-4" />}
                type="email"
                placeholder="opcional@exemplo.com.br"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <label className="flex items-center gap-2.5 self-end pb-2.5">
                <input
                  type="checkbox"
                  checked={simple}
                  onChange={(event) => setSimple(event.target.checked)}
                  className="h-4 w-4 accent-[var(--blue-500)]"
                />
                <span className="text-[13.5px] font-semibold text-[var(--ink)]">Optante pelo Simples Nacional</span>
              </label>
              {companyId && isMaster && (
                <SelectField
                  label="Nicho do sistema"
                  value={systemType}
                  onChange={(event) => setSystemType(Number(event.target.value))}
                >
                  {Object.entries(SYSTEM_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </SelectField>
              )}
              {companyId && !embedded && (
                <label className="flex items-center gap-2.5 self-end pb-2.5">
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={(event) => setActive(event.target.checked)}
                    className="h-4 w-4 accent-[var(--blue-500)]"
                  />
                  <span className="text-[13.5px] font-semibold text-[var(--ink)]">Empresa ativa</span>
                </label>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="mb-4 text-[14px] font-bold text-[var(--ink)]">Endereço</h2>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <TextField
                  label="CEP"
                  icon={<UserIcon className="h-4 w-4" />}
                  placeholder="00000-000"
                  value={zipCode}
                  onChange={(event) => setZipCode(formatCep(event.target.value))}
                  action={
                    zipCode.replace(/\D/g, '').length === 8 ? (
                      <button
                        type="button"
                        onClick={handleCepLookup}
                        disabled={cepLoading}
                        className="text-[12px] font-semibold text-[var(--blue-700)] hover:underline disabled:opacity-60"
                      >
                        {cepLoading ? '…' : 'Buscar'}
                      </button>
                    ) : undefined
                  }
                />
                {cepMessage && <p className="mt-1.5 text-[12px] text-[var(--red-500)]">{cepMessage}</p>}
              </div>
              <div className="sm:col-span-2">
                <TextField
                  label="Endereço"
                  icon={<UserIcon className="h-4 w-4" />}
                  placeholder="Rua, avenida..."
                  value={street}
                  onChange={(event) => setStreet(event.target.value)}
                />
              </div>
              <TextField
                label="Número"
                icon={<UserIcon className="h-4 w-4" />}
                placeholder="s/n"
                value={number}
                onChange={(event) => setNumber(event.target.value)}
              />
              <TextField
                label="Bairro"
                icon={<UserIcon className="h-4 w-4" />}
                placeholder="Bairro"
                value={district}
                onChange={(event) => setDistrict(event.target.value)}
              />
              <TextField
                label="Cidade"
                icon={<UserIcon className="h-4 w-4" />}
                placeholder="Cidade"
                value={city}
                onChange={(event) => setCity(event.target.value)}
              />
              <SelectField label="UF" value={state} onChange={(event) => setState(event.target.value)}>
                <option value="">—</option>
                {BRAZIL_STATES.map((uf) => (
                  <option key={uf} value={uf}>
                    {uf}
                  </option>
                ))}
              </SelectField>
              <div className="sm:col-span-2">
                <TextField
                  label="Complemento"
                  icon={<UserIcon className="h-4 w-4" />}
                  placeholder="Opcional"
                  value={complement}
                  onChange={(event) => setComplement(event.target.value)}
                />
              </div>
            </div>
          </div>

          <SectionCard title="Fiscal" defaultCollapsed>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <SelectField
                label="Inscrição estadual"
                value={stateRegistrationIndicator}
                onChange={(event) => setStateRegistrationIndicator(Number(event.target.value))}
              >
                {Object.entries(STATE_REGISTRATION_INDICATOR_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
              {stateRegistrationIndicator === 1 && (
                <TextField
                  label="Número da inscrição estadual"
                  icon={<BadgeIcon className="h-4 w-4" />}
                  placeholder="Opcional"
                  value={stateRegistration}
                  onChange={(event) => setStateRegistration(event.target.value)}
                />
              )}
              <TextField
                label="Inscrição municipal"
                icon={<BadgeIcon className="h-4 w-4" />}
                placeholder="Opcional"
                value={municipalRegistration}
                onChange={(event) => setMunicipalRegistration(event.target.value)}
              />
              <TextField
                label="Inscrição SUFRAMA"
                icon={<BadgeIcon className="h-4 w-4" />}
                placeholder="Opcional"
                value={inscriptionSuframa}
                onChange={(event) => setInscriptionSuframa(event.target.value)}
              />
              <TextField
                label="RG"
                icon={<BadgeIcon className="h-4 w-4" />}
                placeholder="Opcional"
                value={generalRecord}
                onChange={(event) => setGeneralRecord(event.target.value)}
              />
              <SelectField label="Regime tributário (CRT)" value={crt} onChange={(event) => setCrt(Number(event.target.value))}>
                {Object.entries(CRT_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Regime especial de tributação"
                value={specialRegime}
                onChange={(event) => setSpecialRegime(Number(event.target.value))}
              >
                {Object.entries(SPECIAL_REGIME_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
            </div>
          </SectionCard>

          {companyId && (
            <SectionCard title="Certificado Digital" defaultCollapsed>
              {certificateStatusLoading ? (
                <div className="h-11 animate-pulse rounded-xl bg-[var(--page)]" />
              ) : (
                <div className="mb-5 flex items-start gap-3 rounded-xl bg-[var(--page)] p-4">
                  <span
                    className={`flex h-9 w-9 flex-none items-center justify-center rounded-full ${
                      certificateStatus?.valid
                        ? 'bg-[var(--green-100)] text-[var(--green-600)]'
                        : certificateStatus?.hasCertificate
                          ? 'bg-[var(--red-100)] text-[var(--red-500)]'
                          : 'bg-[var(--blue-100)] text-[var(--blue-700)]'
                    }`}
                  >
                    {certificateStatus?.valid ? (
                      <CheckCircleIcon className="h-4.5 w-4.5" />
                    ) : certificateStatus?.hasCertificate ? (
                      <AlertTriangleIcon className="h-4.5 w-4.5" />
                    ) : (
                      <ShieldIcon className="h-4.5 w-4.5" />
                    )}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-[13.5px] font-bold text-[var(--ink)]">
                      {certificateStatus?.valid
                        ? 'Certificado válido'
                        : certificateStatus?.hasCertificate
                          ? 'Certificado com problema'
                          : 'Nenhum certificado importado'}
                    </p>
                    {certificateStatus?.subject && (
                      <p className="mt-0.5 truncate text-[12px] text-[var(--ink-soft)]">{certificateStatus.subject}</p>
                    )}
                    {certificateStatus?.validUntil && (
                      <p className="mt-0.5 text-[12px] text-[var(--muted)]">
                        Válido até {new Date(certificateStatus.validUntil).toLocaleDateString('pt-BR')}
                        {typeof certificateStatus.daysUntilExpiration === 'number' &&
                          ` (${certificateStatus.daysUntilExpiration >= 0 ? `${certificateStatus.daysUntilExpiration} dias restantes` : 'vencido'})`}
                      </p>
                    )}
                    {certificateStatus?.error && (
                      <p className="mt-0.5 text-[12px] font-medium text-[var(--red-500)]">{certificateStatus.error}</p>
                    )}
                  </div>
                  {certificatePath && (
                    <a
                      href={certificatePath}
                      target="_blank"
                      rel="noreferrer"
                      className="flex flex-none items-center gap-1.5 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]"
                    >
                      <DownloadIcon className="h-3.5 w-3.5" />
                      Baixar atual
                    </a>
                  )}
                </div>
              )}

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Importar novo certificado (.pfx, .p12)</span>
                  <label className="flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]">
                    <PaperclipIcon className="h-3.5 w-3.5 flex-none" />
                    {certificateFile ? certificateFile.name : 'Selecionar arquivo'}
                    <input
                      type="file"
                      accept=".pfx,.p12"
                      className="hidden"
                      onChange={(event) => setCertificateFile(event.target.files?.[0])}
                    />
                  </label>
                </div>
                <TextField
                  label="Senha do certificado"
                  icon={<LockIcon className="h-4 w-4" />}
                  type="password"
                  placeholder="Senha do arquivo .pfx"
                  value={certificatePassword}
                  onChange={(event) => setCertificatePassword(event.target.value)}
                />
              </div>
              <p className="mt-2 text-[12px] text-[var(--muted)]">
                O certificado é usado para emissão fiscal e comunicação com a SEFAZ. Ao salvar a empresa com um novo
                arquivo selecionado, o certificado atual é substituído.
              </p>
            </SectionCard>
          )}

          {error && (
            <p className="rounded-xl bg-[var(--red-100)] px-4 py-3 text-[13.5px] font-medium text-[var(--red-500)]">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-[var(--blue-500)] px-6 py-2.5 text-[14px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
            >
              {submitting ? 'Salvando…' : saved ? 'Salvo' : 'Salvar empresa'}
            </button>
            {!embedded && (
              <button
                type="button"
                onClick={onBack}
                className="rounded-xl px-5 py-2.5 text-[14px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
              >
                Cancelar
              </button>
            )}
          </div>
        </form>
      )}
    </div>
  )
}
