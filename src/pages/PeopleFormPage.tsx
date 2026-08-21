import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  createPerson,
  fetchPerson,
  updatePerson,
  ROLE_LABELS,
  STATUS_LABELS,
  type PersonRecord,
  type PersonDocumentInput,
} from '../lib/people'
import { formatDocument } from '../lib/formatDocument'
import { formatPhone } from '../lib/formatPhone'
import { formatCep } from '../lib/formatCep'
import { BRAZIL_STATES } from '../lib/brazilStates'
import { fetchCnpjData } from '../lib/cnpjLookup'
import { fetchCepData } from '../lib/cepLookup'
import { ApiError } from '../lib/api'
import { TextField } from '../components/form/TextField'
import { SelectField } from '../components/form/SelectField'
import { DocumentViewerModal } from '../components/DocumentViewerModal'
import {
  UserIcon,
  BadgeIcon,
  MailIcon,
  ChevronLeftIcon,
  PlusIcon,
  TrashIcon,
  PaperclipIcon,
  EyeIcon,
} from '../components/icons'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface PeopleFormPageProps {
  session: AuthSession
  company: AuthCompany
  personId?: string
  onBack: () => void
  onSaved: () => void
}

interface DocEntry {
  id?: string
  title: string
  description: string
  file?: File
  existingFileUrl?: string
  existingFileName?: string
}

export function PeopleFormPage({ session, company, personId, onBack, onSaved }: PeopleFormPageProps) {
  const [loading, setLoading] = useState(Boolean(personId))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [name, setName] = useState('')
  const [socialName, setSocialName] = useState('')
  const [document, setDocument] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [internalCode, setInternalCode] = useState('')
  const [role, setRole] = useState(2)
  const [status, setStatus] = useState(0)
  const [birth, setBirth] = useState('')

  const [zipCode, setZipCode] = useState('')
  const [street, setStreet] = useState('')
  const [number, setNumber] = useState('')
  const [district, setDistrict] = useState('')
  const [city, setCity] = useState('')
  const [state, setState] = useState('')
  const [complement, setComplement] = useState('')

  const [documents, setDocuments] = useState<DocEntry[]>([])
  const [viewerIndex, setViewerIndex] = useState<number | null>(null)

  const viewableDocuments = useMemo(
    () =>
      documents
        .map((doc, docIndex) => ({ doc, docIndex }))
        .filter(({ doc }) => doc.existingFileUrl && !doc.file),
    [documents]
  )

  const [existingAvatarUrl, setExistingAvatarUrl] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | undefined>(undefined)

  const avatarPreviewUrl = useMemo(() => (avatarFile ? URL.createObjectURL(avatarFile) : existingAvatarUrl), [
    avatarFile,
    existingAvatarUrl,
  ])

  useEffect(() => {
    return () => {
      if (avatarFile) URL.revokeObjectURL(avatarPreviewUrl!)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarFile])

  const [cnpjLoading, setCnpjLoading] = useState(false)
  const [cnpjMessage, setCnpjMessage] = useState<string | null>(null)
  const [cepLoading, setCepLoading] = useState(false)
  const [cepMessage, setCepMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!personId) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    fetchPerson(session.token.token, personId)
      .then((person: PersonRecord) => {
        if (cancelled) return
        setName(person.name ?? '')
        setSocialName(person.social_name ?? '')
        setDocument(person.document ? formatDocument(person.document) : '')
        setPhone(person.phone ? formatPhone(person.phone) : '')
        setEmail(person.email ?? '')
        setInternalCode(person.internal_code ? String(person.internal_code) : '')
        setExistingAvatarUrl(person.file_url ?? null)
        setAvatarFile(undefined)
        setRole(person.roles?.[0] ?? 2)
        setStatus(person.status?.[0] ?? 0)
        setBirth(person.birth ? person.birth.slice(0, 10) : '')
        setZipCode(person.address?.zip_code ? formatCep(person.address.zip_code) : '')
        setStreet(person.address?.address ?? '')
        setNumber(person.address?.number ?? '')
        setDistrict(person.address?.district ?? '')
        setCity(person.address?.city ?? '')
        setState(person.address?.state ?? '')
        setComplement(person.address?.complement ?? '')
        setDocuments(
          (person.documents ?? []).map((doc) => ({
            id: doc.id,
            title: doc.title ?? '',
            description: doc.description ?? '',
            existingFileUrl: doc.file_url ?? undefined,
            existingFileName: doc.file_name ?? undefined,
          }))
        )
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err instanceof ApiError ? err.message : 'Não foi possível carregar o cadastro.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [personId, session.token.token, reloadKey])

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
      if (result.birth) setBirth(result.birth)
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

  function addDocument() {
    setDocuments((docs) => [...docs, { title: '', description: '' }])
  }

  function updateDocument(index: number, patch: Partial<DocEntry>) {
    setDocuments((docs) => docs.map((doc, i) => (i === index ? { ...doc, ...patch } : doc)))
  }

  function removeDocument(index: number) {
    setDocuments((docs) => docs.filter((_, i) => i !== index))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    const documentDigits = document.replace(/\D/g, '')
    if (!name || !documentDigits) {
      setError('Preencha nome e CPF/CNPJ para continuar.')
      return
    }

    const address = {
      zip_code: zipCode || undefined,
      address: street || undefined,
      number: number || undefined,
      district: district || undefined,
      city: city || undefined,
      state: state || undefined,
      complement: complement || undefined,
    }
    const hasAddress = Object.values(address).some(Boolean)

    const documentEntries: PersonDocumentInput[] = documents
      .filter((doc) => doc.title.trim() || doc.file)
      .map((doc) => ({
        id: doc.id,
        title: doc.title.trim() || 'Documento',
        description: doc.description,
        file: doc.file,
      }))

    const payload = {
      company_id: company.id,
      name,
      document: documentDigits,
      social_name: socialName || undefined,
      people_type: documentDigits.length > 11 ? 1 : 0,
      roles: [role],
      status: [status],
      phone: phone || undefined,
      email: email || undefined,
      internal_code: internalCode ? Number(internalCode) : undefined,
      birth: birth || undefined,
      address: hasAddress ? address : undefined,
      documents: documentEntries,
      file: avatarFile,
    }

    setSubmitting(true)
    try {
      if (personId) {
        await updatePerson(session.token.token, personId, payload)
      } else {
        await createPerson(session.token.token, payload)
      }
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o cadastro.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="mb-3 flex items-center gap-1 text-[12.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
          Voltar para pessoas
        </button>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Cadastros</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">
          {personId ? 'Editar cadastro' : 'Novo cadastro'}
        </h1>
      </div>

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
          <div className="grid gap-6 xl:grid-cols-2">
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <h2 className="mb-4 text-[14px] font-bold text-[var(--ink)]">Dados da pessoa</h2>

              <div className="mb-5 flex items-center gap-4">
                <span className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-full bg-[var(--blue-100)] text-[var(--blue-700)]">
                  {avatarPreviewUrl ? (
                    <img src={avatarPreviewUrl} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <UserIcon className="h-7 w-7" />
                  )}
                </span>
                <div className="flex flex-col gap-1.5">
                  <label className="flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]">
                    <PaperclipIcon className="h-3.5 w-3.5 flex-none" />
                    {avatarFile ? avatarFile.name : 'Alterar foto'}
                    <input
                      type="file"
                      accept=".jpg,.jpeg,.png,.webp"
                      className="hidden"
                      onChange={(event) => setAvatarFile(event.target.files?.[0])}
                    />
                  </label>
                  {avatarFile && (
                    <button
                      type="button"
                      onClick={() => setAvatarFile(undefined)}
                      className="w-fit text-[12px] font-semibold text-[var(--red-500)] hover:underline"
                    >
                      Cancelar nova foto
                    </button>
                  )}
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Nome"
                  icon={<UserIcon className="h-4 w-4" />}
                  placeholder="Nome completo"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
                <TextField
                  label="Nome social / fantasia"
                  icon={<UserIcon className="h-4 w-4" />}
                  placeholder="Opcional"
                  value={socialName}
                  onChange={(event) => setSocialName(event.target.value)}
                />
                <div className="sm:col-span-2">
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
                  label="Código interno"
                  icon={<BadgeIcon className="h-4 w-4" />}
                  placeholder="Opcional"
                  inputMode="numeric"
                  value={internalCode}
                  onChange={(event) => setInternalCode(event.target.value.replace(/\D/g, ''))}
                />
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
                <SelectField label="Papel" value={role} onChange={(event) => setRole(Number(event.target.value))}>
                  {Object.entries(ROLE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </SelectField>
                <SelectField label="Status" value={status} onChange={(event) => setStatus(Number(event.target.value))}>
                  {Object.entries(STATUS_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </SelectField>
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Nascimento</span>
                  <input
                    type="date"
                    value={birth}
                    onChange={(event) => setBirth(event.target.value)}
                    className="min-w-0 w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                  />
                </label>
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
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-[14px] font-bold text-[var(--ink)]">Anexos</h2>
                <p className="mt-0.5 text-[12px] text-[var(--muted)]">
                  Documentos, fotos ou contratos relacionados a essa pessoa
                </p>
              </div>
              <button
                type="button"
                onClick={addDocument}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-2 text-[12.5px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Adicionar anexo
              </button>
            </div>

            {documents.length === 0 ? (
              <p className="py-4 text-center text-[13px] text-[var(--muted)]">Nenhum anexo adicionado ainda.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {documents.map((doc, index) => (
                  <div
                    key={index}
                    className="flex flex-col gap-3 rounded-xl bg-[var(--page)] p-4 sm:flex-row sm:items-start"
                  >
                    <div className="grid flex-1 gap-3 sm:grid-cols-2">
                      <input
                        type="text"
                        placeholder="Título (ex: RG, CNH, contrato)"
                        value={doc.title}
                        onChange={(event) => updateDocument(index, { title: event.target.value })}
                        className="rounded-lg bg-[var(--surface)] px-3 py-2 text-[13.5px] text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)]"
                      />
                      <input
                        type="text"
                        placeholder="Descrição (opcional)"
                        value={doc.description}
                        onChange={(event) => updateDocument(index, { description: event.target.value })}
                        className="rounded-lg bg-[var(--surface)] px-3 py-2 text-[13.5px] text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)]"
                      />
                      <label className="flex min-w-0 cursor-pointer items-center gap-2 rounded-lg bg-[var(--surface)] px-3 py-2 text-[12.5px] font-semibold text-[var(--blue-700)]">
                        <PaperclipIcon className="h-3.5 w-3.5 flex-none" />
                        <span className="min-w-0 truncate">
                          {doc.file?.name ?? doc.existingFileName ?? 'Escolher arquivo'}
                        </span>
                        <input
                          type="file"
                          accept=".jpg,.jpeg,.png,.webp,.pdf"
                          className="hidden"
                          onChange={(event) => updateDocument(index, { file: event.target.files?.[0] })}
                        />
                      </label>
                      {doc.existingFileUrl && !doc.file && (
                        <button
                          type="button"
                          onClick={() =>
                            setViewerIndex(viewableDocuments.findIndex((entry) => entry.docIndex === index))
                          }
                          className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--blue-700)] hover:underline"
                        >
                          <EyeIcon className="h-3.5 w-3.5" />
                          Ver arquivo atual
                        </button>
                      )}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeDocument(index)}
                      aria-label="Remover anexo"
                      className="flex-none self-start rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--red-100)] hover:text-[var(--red-500)]"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

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
              {submitting ? 'Salvando…' : 'Salvar cadastro'}
            </button>
            <button
              type="button"
              onClick={onBack}
              className="rounded-xl px-5 py-2.5 text-[14px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {viewerIndex !== null && viewableDocuments[viewerIndex] && (
        <DocumentViewerModal
          documents={viewableDocuments.map(({ doc }) => ({
            title: doc.title,
            description: doc.description,
            url: doc.existingFileUrl as string,
            fileName: doc.existingFileName,
          }))}
          index={viewerIndex}
          onClose={() => setViewerIndex(null)}
          onIndexChange={setViewerIndex}
        />
      )}
    </div>
  )
}
