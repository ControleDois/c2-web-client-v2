import { CONTACT_URL, isSelfServiceTrial, isTrial } from '../lib/licenseState'
import { formatDate } from '../lib/format'
import type { AuthCompany } from '../lib/auth'

interface TrialBannerProps {
  company: AuthCompany
  onOpenPlans: () => void
}

const RENEWAL_WARNING_DAYS = 5

function daysUntil(value: string | null | undefined): number | null {
  if (!value) return null
  const end = new Date(value)
  if (Number.isNaN(end.getTime())) return null
  return Math.ceil((end.getTime() - Date.now()) / 86_400_000)
}

// Faixa do topo: teste grátis (leva aos planos) ou aviso de renovação do plano contratado pelo site, que é pago a cada ciclo.
export function TrialBanner({ company, onOpenPlans }: TrialBannerProps) {
  const days = daysUntil(company.license_expires_at)
  if (days === null || days < 0 || company.is_master) return null

  const trial = isTrial(company)
  const renewal = !trial && Boolean(company.plan_id) && days <= RENEWAL_WARNING_DAYS
  if (!trial && !renewal) return null

  const urgent = days <= 2
  const selfService = isSelfServiceTrial(company)
  const remaining = trial
    ? days === 0
      ? 'Hoje é o último dia do seu teste grátis'
      : days === 1
        ? 'Falta 1 dia para o fim do teste grátis'
        : `Restam ${days} dias de teste grátis`
    : days === 0
      ? 'Seu plano vence hoje'
      : days === 1
        ? 'Seu plano vence amanhã'
        : `Seu plano vence em ${days} dias`

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-3 px-4 py-2.5 sm:px-6 lg:px-8 ${
        urgent ? 'bg-[var(--amber-100)]' : 'bg-[var(--blue-100)]'
      }`}
    >
      <p className={`text-[13px] ${urgent ? 'text-[var(--amber-500)]' : 'text-[var(--blue-700)]'}`}>
        <span className="font-bold">{remaining}</span>
        <span className="font-medium"> · até {formatDate(company.license_expires_at)}.</span>
        {selfService && <span className="hidden font-medium sm:inline"> Notas fiscais, assinatura de contratos e WhatsApp fazem parte dos planos.</span>}
      </p>
      {selfService || renewal ? (
        <button
          type="button"
          onClick={onOpenPlans}
          className="rounded-lg bg-[var(--blue-500)] px-4 py-1.5 text-[12.5px] font-bold text-white shadow-sm transition hover:bg-[var(--blue-700)]"
        >
          {renewal ? 'Renovar plano' : 'Ver planos'}
        </button>
      ) : (
        <a
          href={CONTACT_URL}
          target="_blank"
          rel="noreferrer"
          className="rounded-lg bg-[var(--blue-500)] px-4 py-1.5 text-[12.5px] font-bold text-white shadow-sm transition hover:bg-[var(--blue-700)]"
        >
          Falar com a gente
        </a>
      )}
    </div>
  )
}
