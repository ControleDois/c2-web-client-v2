import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { Logo } from '../../components/Logo'
import { LegalFooter } from '../../components/LegalFooter'
import { TextField } from '../../components/form/TextField'
import { SelectField } from '../../components/form/SelectField'
import { MailIcon, UserIcon, BadgeIcon, KeyIcon, CheckCircleIcon, ClockIcon, AlertCircleIcon } from '../../components/icons'
import { ApiError } from '../../lib/api'
import {
  registerCustomer,
  requestAccessCode,
  verifyAccessCode,
  getLoanSession,
  submitLoanVerification,
  saveLoanSession,
  loadLoanSession,
  clearLoanSession,
  type LoanSessionData,
  type LoanCustomerVerificationStatus,
} from '../../lib/loanCustomerApi'

type Step = 'loading' | 'welcome' | 'register' | 'login' | 'code' | 'documents'

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '')
}

function maskDocument(value: string): string {
  const digits = onlyDigits(value).slice(0, 14)
  if (digits.length <= 11) {
    return digits
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d)/, '$1.$2')
      .replace(/(\d{3})(\d{1,2})$/, '$1-$2')
  }
  return digits
    .replace(/(\d{2})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1.$2')
    .replace(/(\d{3})(\d)/, '$1/$2')
    .replace(/(\d{4})(\d{1,2})$/, '$1-$2')
}

function maskPhone(value: string): string {
  const digits = onlyDigits(value).slice(0, 11)
  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{0,4})/, (_, a, b, c) => (c ? `(${a}) ${b}-${c}` : `(${a}) ${b}`))
  }
  return digits.replace(/(\d{2})(\d{5})(\d{0,4})/, (_, a, b, c) => (c ? `(${a}) ${b}-${c}` : `(${a}) ${b}`))
}

function PageShell({ children }: { children: ReactNode }) {
  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-[var(--page)] px-4 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -left-24 h-96 w-96 rounded-full opacity-40 blur-3xl"
        style={{ background: 'radial-gradient(circle, var(--blue-100), transparent 70%)' }}
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 -right-16 h-96 w-96 rounded-full opacity-40 blur-3xl"
        style={{ background: 'radial-gradient(circle, var(--green-100), transparent 70%)' }}
      />
      <div className="relative w-full max-w-[420px]">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo className="h-16 w-16" />
        </div>
        <div className="flex flex-col gap-5 rounded-[28px] bg-[var(--surface)] p-8 shadow-[var(--card-shadow)]">
          {children}
        </div>
        <LegalFooter />
      </div>
    </div>
  )
}

function ErrorBanner({ message }: { message: string }) {
  return (
    <p className="rounded-lg bg-[var(--red-100)] px-3 py-2 text-[13px] font-medium text-[var(--red-500)]">
      {message}
    </p>
  )
}

function PrimaryButton({
  children,
  disabled,
  type = 'submit',
  onClick,
}: {
  children: ReactNode
  disabled?: boolean
  type?: 'submit' | 'button'
  onClick?: () => void
}) {
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className="mt-1 rounded-xl bg-[var(--blue-500)] py-3 text-[14px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
    >
      {children}
    </button>
  )
}

function FileField({
  label,
  file,
  onChange,
  required,
}: {
  label: string
  file: File | null
  onChange: (file: File | null) => void
  required?: boolean
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
        {label}
        {required && <span className="text-[var(--red-500)]"> *</span>}
      </span>
      <div className="flex items-center gap-2 rounded-xl bg-[var(--page)] px-3.5 py-2.5 ring-1 ring-transparent transition focus-within:ring-[var(--blue-300)]">
        <input
          type="file"
          accept="image/*,application/pdf"
          onChange={(e) => onChange(e.target.files?.[0] ?? null)}
          className="w-full min-w-0 text-[13px] text-[var(--ink)] file:mr-3 file:rounded-lg file:border-0 file:bg-[var(--blue-100)] file:px-3 file:py-1.5 file:text-[12px] file:font-semibold file:text-[var(--blue-700)]"
        />
      </div>
      {file && <span className="text-[11px] text-[var(--green-600)]">Selecionado: {file.name}</span>}
    </label>
  )
}

export function LoanCustomerPage({ companyToken }: { companyToken: string }) {
  const [step, setStep] = useState<Step>('loading')
  const [sessionToken, setSessionToken] = useState<string | null>(null)
  const [data, setData] = useState<LoanSessionData | null>(null)
  const [pendingDocument, setPendingDocument] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const prefillDocument = useMemo(() => {
    const params = new URLSearchParams(window.location.search)
    return maskDocument(params.get('document') || '')
  }, [])

  useEffect(() => {
    const existing = loadLoanSession(companyToken)
    if (!existing) {
      setStep('welcome')
      return
    }

    getLoanSession(existing)
      .then((res) => {
        setSessionToken(existing)
        setData(res)
        setStep('documents')
      })
      .catch(() => {
        clearLoanSession(companyToken)
        setStep('welcome')
      })
  }, [companyToken])

  function enterWithSession(token: string, expiresAt: string, res: LoanSessionData) {
    saveLoanSession(companyToken, token, expiresAt)
    setSessionToken(token)
    setData(res)
    setStep('documents')
  }

  async function handleRegister(input: { name: string; email: string; document: string; phone: string }) {
    setSubmitting(true)
    setError(null)
    try {
      const res = await registerCustomer(companyToken, input)
      if (res.session_token && res.expires_at) {
        enterWithSession(res.session_token, res.expires_at, res)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível concluir o cadastro.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRequestCode(document: string) {
    setSubmitting(true)
    setError(null)
    try {
      await requestAccessCode(companyToken, document)
      setPendingDocument(document)
      setStep('code')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar o código.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleVerifyCode(code: string) {
    setSubmitting(true)
    setError(null)
    try {
      const res = await verifyAccessCode(pendingDocument, code)
      if (res.session_token && res.expires_at) {
        enterWithSession(res.session_token, res.expires_at, res)
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Código inválido ou expirado.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleSubmitVerification(params: {
    addressProof: File
    documentType: 'rg' | 'cnh'
    identityFront: File
    identityBack?: File
    selfie: File
  }) {
    if (!sessionToken) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await submitLoanVerification({ sessionToken, ...params })
      setData((current) => (current ? { ...current, verification: res.verification } : current))
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar os documentos.')
    } finally {
      setSubmitting(false)
    }
  }

  if (step === 'loading') {
    return (
      <PageShell>
        <p className="text-center text-[13px] text-[var(--muted)]">Carregando…</p>
      </PageShell>
    )
  }

  if (step === 'welcome') {
    return (
      <PageShell>
        <div>
          <h1 className="text-[20px] font-bold tracking-tight text-[var(--ink)]">Empréstimo rápido</h1>
          <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
            Faça seu cadastro e envie seus documentos para começar a análise.
          </p>
        </div>
        <PrimaryButton type="button" onClick={() => setStep('register')}>
          Criar cadastro
        </PrimaryButton>
        <button
          type="button"
          onClick={() => setStep('login')}
          className="rounded-xl border border-[var(--border)] py-3 text-[14px] font-semibold text-[var(--ink)] transition hover:bg-[var(--page)]"
        >
          Já tenho cadastro
        </button>
      </PageShell>
    )
  }

  if (step === 'register') {
    return (
      <PageShell>
        <RegisterForm
          submitting={submitting}
          error={error}
          initialDocument={prefillDocument}
          onBack={() => setStep('welcome')}
          onSubmit={handleRegister}
        />
      </PageShell>
    )
  }

  if (step === 'login') {
    return (
      <PageShell>
        <LoginForm
          submitting={submitting}
          error={error}
          initialDocument={prefillDocument}
          onBack={() => setStep('welcome')}
          onSubmit={handleRequestCode}
        />
      </PageShell>
    )
  }

  if (step === 'code') {
    return (
      <PageShell>
        <CodeForm
          submitting={submitting}
          error={error}
          onBack={() => setStep('login')}
          onResend={() => void handleRequestCode(pendingDocument)}
          onSubmit={handleVerifyCode}
        />
      </PageShell>
    )
  }

  return (
    <PageShell>
      <DocumentsPanel
        clientName={data?.client?.name || ''}
        verification={data?.verification || null}
        submitting={submitting}
        error={error}
        onSubmit={handleSubmitVerification}
      />
    </PageShell>
  )
}

function RegisterForm({
  submitting,
  error,
  initialDocument,
  onBack,
  onSubmit,
}: {
  submitting: boolean
  error: string | null
  initialDocument: string
  onBack: () => void
  onSubmit: (input: { name: string; email: string; document: string; phone: string }) => void
}) {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [document, setDocument] = useState(initialDocument)
  const [phone, setPhone] = useState('')
  const [localError, setLocalError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLocalError(null)

    if (!name.trim() || !email.trim() || onlyDigits(document).length < 11 || onlyDigits(phone).length < 10) {
      setLocalError('Preencha nome, e-mail, CPF/CNPJ e WhatsApp corretamente.')
      return
    }

    onSubmit({ name: name.trim(), email: email.trim(), document: onlyDigits(document), phone: onlyDigits(phone) })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <h2 className="text-[20px] font-bold tracking-tight text-[var(--ink)]">Criar cadastro</h2>
        <p className="mt-1 text-[13px] text-[var(--ink-soft)]">Preencha seus dados para continuar.</p>
      </div>

      <TextField label="Nome completo" icon={<UserIcon className="h-4 w-4" />} placeholder="Seu nome completo" value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" />
      <TextField label="E-mail" icon={<MailIcon className="h-4 w-4" />} type="email" placeholder="voce@email.com" value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
      <TextField label="CPF ou CNPJ" icon={<BadgeIcon className="h-4 w-4" />} placeholder="000.000.000-00" value={document} onChange={(e) => setDocument(maskDocument(e.target.value))} inputMode="numeric" />
      <TextField label="WhatsApp" icon={<UserIcon className="h-4 w-4" />} placeholder="(00) 00000-0000" value={phone} onChange={(e) => setPhone(maskPhone(e.target.value))} inputMode="numeric" />

      {(localError || error) && <ErrorBanner message={localError || error || ''} />}

      <PrimaryButton disabled={submitting}>{submitting ? 'Enviando…' : 'Continuar'}</PrimaryButton>
      <button type="button" onClick={onBack} className="text-center text-[13px] font-semibold text-[var(--ink-soft)] hover:underline">
        Voltar
      </button>
    </form>
  )
}

function LoginForm({
  submitting,
  error,
  initialDocument,
  onBack,
  onSubmit,
}: {
  submitting: boolean
  error: string | null
  initialDocument: string
  onBack: () => void
  onSubmit: (document: string) => void
}) {
  const [document, setDocument] = useState(initialDocument)
  const [localError, setLocalError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLocalError(null)

    if (onlyDigits(document).length < 11) {
      setLocalError('Informe um CPF ou CNPJ válido.')
      return
    }

    onSubmit(onlyDigits(document))
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <h2 className="text-[20px] font-bold tracking-tight text-[var(--ink)]">Já tenho cadastro</h2>
        <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
          Informe seu CPF/CNPJ — vamos mandar um código de acesso pelo WhatsApp.
        </p>
      </div>

      <TextField label="CPF ou CNPJ" icon={<BadgeIcon className="h-4 w-4" />} placeholder="000.000.000-00" value={document} onChange={(e) => setDocument(maskDocument(e.target.value))} inputMode="numeric" />

      {(localError || error) && <ErrorBanner message={localError || error || ''} />}

      <PrimaryButton disabled={submitting}>{submitting ? 'Enviando…' : 'Enviar código'}</PrimaryButton>
      <button type="button" onClick={onBack} className="text-center text-[13px] font-semibold text-[var(--ink-soft)] hover:underline">
        Voltar
      </button>
    </form>
  )
}

function CodeForm({
  submitting,
  error,
  onBack,
  onResend,
  onSubmit,
}: {
  submitting: boolean
  error: string | null
  onBack: () => void
  onResend: () => void
  onSubmit: (code: string) => void
}) {
  const [code, setCode] = useState('')

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (code.trim().length < 4) return
    onSubmit(code.trim())
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <div>
        <h2 className="text-[20px] font-bold tracking-tight text-[var(--ink)]">Digite o código</h2>
        <p className="mt-1 text-[13px] text-[var(--ink-soft)]">Enviamos um código de 6 dígitos pelo seu WhatsApp.</p>
      </div>

      <TextField label="Código" icon={<KeyIcon className="h-4 w-4" />} placeholder="000000" value={code} onChange={(e) => setCode(onlyDigits(e.target.value))} inputMode="numeric" maxLength={6} />

      {error && <ErrorBanner message={error} />}

      <PrimaryButton disabled={submitting}>{submitting ? 'Confirmando…' : 'Confirmar'}</PrimaryButton>
      <div className="flex items-center justify-between text-[13px] font-semibold">
        <button type="button" onClick={onBack} className="text-[var(--ink-soft)] hover:underline">
          Voltar
        </button>
        <button type="button" onClick={onResend} className="text-[var(--blue-700)] hover:underline">
          Reenviar código
        </button>
      </div>
    </form>
  )
}

const VERIFICATION_COPY: Record<
  LoanCustomerVerificationStatus,
  { title: string; description: string; tone: 'amber' | 'green' | 'red' }
> = {
  pending_documents: {
    title: 'Envie seus documentos',
    description: 'Faltam os documentos abaixo para darmos início à análise do seu cadastro.',
    tone: 'amber',
  },
  pending_review: {
    title: 'Documentos em análise',
    description: 'Recebemos seus documentos e nossa equipe já está analisando. Avisamos assim que sair o resultado.',
    tone: 'amber',
  },
  approved: {
    title: 'Cadastro aprovado!',
    description: 'Seus documentos foram validados. Nossa equipe vai entrar em contato pelo WhatsApp sobre o seu empréstimo.',
    tone: 'green',
  },
  rejected: {
    title: 'Precisamos que você reenvie',
    description: 'Algo não conferiu na análise dos seus documentos. Reenvie abaixo.',
    tone: 'red',
  },
}

function DocumentsPanel({
  clientName,
  verification,
  submitting,
  error,
  onSubmit,
}: {
  clientName: string
  verification: { status: LoanCustomerVerificationStatus; notes: string | null } | null
  submitting: boolean
  error: string | null
  onSubmit: (params: {
    addressProof: File
    documentType: 'rg' | 'cnh'
    identityFront: File
    identityBack?: File
    selfie: File
  }) => void
}) {
  const status = verification?.status || 'pending_documents'
  const copy = VERIFICATION_COPY[status]
  const needsUpload = status === 'pending_documents' || status === 'rejected'

  const [addressProof, setAddressProof] = useState<File | null>(null)
  const [documentType, setDocumentType] = useState<'rg' | 'cnh'>('rg')
  const [identityFront, setIdentityFront] = useState<File | null>(null)
  const [identityBack, setIdentityBack] = useState<File | null>(null)
  const [selfie, setSelfie] = useState<File | null>(null)
  const [localError, setLocalError] = useState<string | null>(null)

  function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setLocalError(null)

    if (!addressProof || !identityFront || !selfie) {
      setLocalError('Envie o comprovante de endereço, o documento e a selfie.')
      return
    }

    onSubmit({
      addressProof,
      documentType,
      identityFront,
      identityBack: identityBack || undefined,
      selfie,
    })
  }

  const toneIcon =
    copy.tone === 'green' ? (
      <CheckCircleIcon className="h-5 w-5 text-[var(--green-600)]" />
    ) : copy.tone === 'red' ? (
      <AlertCircleIcon className="h-5 w-5 text-[var(--red-500)]" />
    ) : (
      <ClockIcon className="h-5 w-5 text-[var(--amber-500)]" />
    )

  const toneBg = copy.tone === 'green' ? 'var(--green-100)' : copy.tone === 'red' ? 'var(--red-100)' : 'var(--amber-100)'

  return (
    <div className="flex flex-col gap-5">
      <div>
        <h2 className="text-[20px] font-bold tracking-tight text-[var(--ink)]">Olá{clientName ? `, ${clientName.split(' ')[0]}` : ''}!</h2>
      </div>

      <div className="flex items-start gap-3 rounded-xl p-3.5" style={{ background: toneBg }}>
        {toneIcon}
        <div>
          <p className="text-[14px] font-bold text-[var(--ink)]">{copy.title}</p>
          <p className="mt-0.5 text-[13px] text-[var(--ink-soft)]">{copy.description}</p>
          {status === 'rejected' && verification?.notes && (
            <p className="mt-1 text-[13px] font-medium text-[var(--red-500)]">Motivo: {verification.notes}</p>
          )}
        </div>
      </div>

      {needsUpload && (
        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <FileField label="Comprovante de endereço" file={addressProof} onChange={setAddressProof} required />

          <SelectField
            label="Tipo de documento"
            value={documentType}
            onChange={(e) => setDocumentType(e.target.value as 'rg' | 'cnh')}
          >
            <option value="rg">RG</option>
            <option value="cnh">CNH</option>
          </SelectField>

          <FileField label={`${documentType === 'rg' ? 'RG' : 'CNH'} (frente)`} file={identityFront} onChange={setIdentityFront} required />
          <FileField label={`${documentType === 'rg' ? 'RG' : 'CNH'} (verso, opcional)`} file={identityBack} onChange={setIdentityBack} />
          <FileField label="Selfie (foto do seu rosto)" file={selfie} onChange={setSelfie} required />

          {(localError || error) && <ErrorBanner message={localError || error || ''} />}

          <PrimaryButton disabled={submitting}>{submitting ? 'Enviando…' : 'Enviar documentos'}</PrimaryButton>
        </form>
      )}
    </div>
  )
}
