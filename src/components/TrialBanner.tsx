import { CONTACT_URL, trialDaysLeft } from '../lib/licenseState'
import { formatDate } from '../lib/format'
import type { AuthCompany } from '../lib/auth'

// Faixa fina com o que resta do teste grátis; só aparece enquanto a empresa está no período de teste.
export function TrialBanner({ company }: { company: AuthCompany }) {
  const days = trialDaysLeft(company)
  if (days === null || days < 0) return null

  const urgent = days <= 2
  const text =
    days === 0
      ? 'Hoje é o último dia do seu teste grátis.'
      : `Teste grátis: ${days === 1 ? 'resta 1 dia' : `restam ${days} dias`} (até ${formatDate(company.license_expires_at)}).`

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 px-4 py-2 text-[12.5px] font-semibold sm:px-6 lg:px-8 ${
        urgent ? 'bg-[var(--amber-100)] text-[var(--amber-500)]' : 'bg-[var(--blue-100)] text-[var(--blue-700)]'
      }`}
    >
      <span>{text}</span>
      <a href={CONTACT_URL} target="_blank" rel="noreferrer" className="underline underline-offset-2 hover:opacity-80">
        Falar com a gente para continuar
      </a>
    </div>
  )
}
