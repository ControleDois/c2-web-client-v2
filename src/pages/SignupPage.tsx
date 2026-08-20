import { useState, type FormEvent } from 'react'
import { Logo } from '../components/Logo'
import { LegalFooter } from '../components/LegalFooter'
import { TextField } from '../components/form/TextField'
import { PasswordField } from '../components/form/PasswordField'
import { BuildingIcon, MailIcon } from '../components/icons'

interface SignupPageProps {
  onBackToLogin: () => void
}

export function SignupPage({ onBackToLogin }: SignupPageProps) {
  const [companyName, setCompanyName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [acceptedTerms, setAcceptedTerms] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!companyName || !email || !password) {
      setError('Preencha todos os campos para continuar.')
      return
    }
    if (password.length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }
    if (!acceptedTerms) {
      setError('Você precisa aceitar os Termos de Uso e a Política de Privacidade.')
      return
    }

    setSubmitting(true)
    await new Promise((resolve) => setTimeout(resolve, 900))
    setSubmitting(false)
  }

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

      <div className="relative w-full max-w-[400px]">
        <div className="mb-8 flex flex-col items-center gap-3 text-center">
          <Logo className="h-20 w-20" />
          <div>
            <h1 className="text-[17px] font-bold tracking-tight text-[var(--ink)]">Controle Dois</h1>
            <p className="mt-0.5 text-[13px] text-[var(--muted)]">14 dias grátis, sem cartão de crédito</p>
          </div>
        </div>

        <form
          onSubmit={handleSubmit}
          className="flex flex-col gap-5 rounded-[28px] bg-[var(--surface)] p-8 shadow-[var(--card-shadow)]"
        >
          <div>
            <h2 className="text-[20px] font-bold tracking-tight text-[var(--ink)]">Comece grátis</h2>
            <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
              Crie sua conta e comece a usar o Controle Dois hoje mesmo.
            </p>
          </div>

          <TextField
            label="Nome da empresa"
            icon={<BuildingIcon className="h-4 w-4" />}
            placeholder="Oficina Central"
            autoComplete="organization"
            value={companyName}
            onChange={(event) => setCompanyName(event.target.value)}
          />

          <TextField
            label="E-mail"
            icon={<MailIcon className="h-4 w-4" />}
            type="email"
            placeholder="voce@suaempresa.com.br"
            autoComplete="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />

          <PasswordField
            label="Senha"
            placeholder="Mínimo 6 caracteres"
            autoComplete="new-password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />

          <label className="flex items-start gap-2.5 text-[12.5px] leading-relaxed text-[var(--ink-soft)]">
            <input
              type="checkbox"
              checked={acceptedTerms}
              onChange={(event) => setAcceptedTerms(event.target.checked)}
              className="mt-0.5 h-4 w-4 flex-none accent-[var(--blue-500)]"
            />
            <span>
              Li e aceito os{' '}
              <a
                href="https://controledois.com.br/termos-de-uso"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-[var(--blue-700)] hover:underline"
              >
                Termos de Uso
              </a>{' '}
              e a{' '}
              <a
                href="https://controledois.com.br/politica-de-privacidade"
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-[var(--blue-700)] hover:underline"
              >
                Política de Privacidade
              </a>
              .
            </span>
          </label>

          {error && (
            <p className="rounded-lg bg-[var(--red-100)] px-3 py-2 text-[13px] font-medium text-[var(--red-500)]">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="rounded-xl bg-[var(--blue-500)] py-3 text-[14px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
          >
            {submitting ? 'Criando conta…' : 'Criar conta grátis'}
          </button>

          <p className="text-center text-[13px] text-[var(--ink-soft)]">
            Já tem conta?{' '}
            <button
              type="button"
              onClick={onBackToLogin}
              className="font-semibold text-[var(--blue-700)] hover:underline"
            >
              Entrar
            </button>
          </p>
        </form>

        <LegalFooter />
      </div>
    </div>
  )
}
