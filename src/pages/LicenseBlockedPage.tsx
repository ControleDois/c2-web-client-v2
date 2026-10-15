import { Logo } from '../components/Logo'
import { CONTACT_URL, isTrial } from '../lib/licenseState'
import { formatDate } from '../lib/format'
import type { AuthCompany } from '../lib/auth'

interface LicenseBlockedPageProps {
  company: AuthCompany
  onSwitchCompany: () => void
  onLogout: () => void
}

// Tela única quando o teste grátis acabou ou a assinatura venceu/foi bloqueada: o servidor também barra as chamadas.
export function LicenseBlockedPage({ company, onSwitchCompany, onLogout }: LicenseBlockedPageProps) {
  const trial = isTrial(company)

  return (
    <div className="flex min-h-[70vh] flex-col items-center justify-center px-4 py-10 text-center">
      <Logo className="h-16 w-16" />
      <h1 className="mt-5 text-[22px] font-bold tracking-tight text-[var(--ink)]">
        {trial ? 'Seu teste grátis terminou' : 'Acesso bloqueado'}
      </h1>
      <p className="mt-2 max-w-md text-[14px] leading-relaxed text-[var(--ink-soft)]">
        {trial
          ? `Os 7 dias de teste acabaram${company.license_expires_at ? ` em ${formatDate(company.license_expires_at)}` : ''}. Seus dados continuam guardados: fale com a gente para ativar a assinatura e voltar a usar o sistema.`
          : 'A assinatura desta empresa venceu ou foi bloqueada. Fale com a gente para regularizar e liberar o acesso. Seus dados continuam guardados.'}
      </p>
      <div className="mt-6 flex flex-wrap justify-center gap-3">
        <a
          href={CONTACT_URL}
          target="_blank"
          rel="noreferrer"
          className="rounded-xl bg-[var(--blue-500)] px-5 py-3 text-[14px] font-bold text-white transition hover:bg-[var(--blue-700)]"
        >
          Falar com a gente
        </a>
        <button
          type="button"
          onClick={onSwitchCompany}
          className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-5 py-3 text-[14px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          Trocar de empresa
        </button>
        <button
          type="button"
          onClick={onLogout}
          className="rounded-xl px-5 py-3 text-[14px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          Sair
        </button>
      </div>
    </div>
  )
}
