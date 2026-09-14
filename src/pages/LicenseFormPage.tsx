import { useEffect, useState } from 'react'
import {
  fetchLicenseCompany,
  updateLicenseCompany,
  searchRepresentatives,
  representativeName,
  type LicenseCompanyDetail,
  type LicenseStatus,
} from '../lib/licenses'
import { formatDocument } from '../lib/formatDocument'
import { formatDate } from '../lib/format'
import { ApiError } from '../lib/api'
import { TextField } from '../components/form/TextField'
import { SearchSelectField } from '../components/form/SearchSelectField'
import { SectionCard } from '../components/SectionCard'
import { ChevronLeftIcon, ClockIcon, KeyIcon, DollarSignIcon } from '../components/icons'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface LicenseFormPageProps {
  session: AuthSession
  company: AuthCompany
  licenseId: string
  onBack: () => void
  onSaved: () => void
}

const STATUS_LABELS: Record<LicenseStatus, string> = {
  trial: 'Teste grátis',
  active: 'Ativa',
  blocked: 'Bloqueada',
}

function statusTone(status: LicenseStatus): string {
  if (status === 'active') return 'bg-[var(--green-100)] text-[var(--green-600)]'
  if (status === 'blocked') return 'bg-[var(--red-100)] text-[var(--red-500)]'
  return 'bg-[var(--blue-100)] text-[var(--blue-700)]'
}

function toDateInputValue(value?: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toISOString().slice(0, 10)
}

function plusDays(days: number): string {
  const date = new Date()
  date.setDate(date.getDate() + days)
  return date.toISOString().slice(0, 10)
}

export function LicenseFormPage({ session, licenseId, onBack }: LicenseFormPageProps) {
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [detail, setDetail] = useState<LicenseCompanyDetail | null>(null)

  const [expiresAt, setExpiresAt] = useState('')
  const [savingSubscription, setSavingSubscription] = useState(false)
  const [subscriptionError, setSubscriptionError] = useState<string | null>(null)
  const [subscriptionMessage, setSubscriptionMessage] = useState<string | null>(null)

  const [keyDueDate, setKeyDueDate] = useState(plusDays(30))
  const [savingKey, setSavingKey] = useState(false)
  const [keyError, setKeyError] = useState<string | null>(null)

  const [monthlyFee, setMonthlyFee] = useState('')
  const [commissionPercent, setCommissionPercent] = useState('')
  const [representativeId, setRepresentativeId] = useState<string | null>(null)
  const [representativeLabel, setRepresentativeLabel] = useState<string | null>(null)
  const [savingCommercial, setSavingCommercial] = useState(false)
  const [commercialError, setCommercialError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    fetchLicenseCompany(session.token.token, licenseId)
      .then((data) => {
        if (cancelled) return
        setDetail(data)
        setExpiresAt(toDateInputValue(data.license_expires_at) || plusDays(30))
        setMonthlyFee(data.monthly_fee != null ? String(data.monthly_fee) : '')
        setCommissionPercent(data.commission_percent != null ? String(data.commission_percent) : '')
        setRepresentativeId(data.representative_user_id ?? null)
        setRepresentativeLabel(data.representative ? representativeName(data.representative) : null)
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err instanceof ApiError ? err.message : 'Não foi possível carregar a empresa.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [licenseId, session.token.token, reloadKey])

  async function handleSaveSubscription() {
    setSavingSubscription(true)
    setSubscriptionError(null)
    setSubscriptionMessage(null)
    try {
      const updated = await updateLicenseCompany(session.token.token, licenseId, {
        license_status: 'active',
        license_expires_at: expiresAt ? new Date(expiresAt).toISOString() : null,
      })
      setDetail(updated)
      setSubscriptionMessage('Validade atualizada.')
    } catch (err) {
      setSubscriptionError(err instanceof ApiError ? err.message : 'Não foi possível salvar a validade.')
    } finally {
      setSavingSubscription(false)
    }
  }

  async function handleBlock() {
    setSavingSubscription(true)
    setSubscriptionError(null)
    setSubscriptionMessage(null)
    try {
      const updated = await updateLicenseCompany(session.token.token, licenseId, { license_status: 'blocked' })
      setDetail(updated)
      setSubscriptionMessage('Empresa bloqueada.')
    } catch (err) {
      setSubscriptionError(err instanceof ApiError ? err.message : 'Não foi possível bloquear a empresa.')
    } finally {
      setSavingSubscription(false)
    }
  }

  async function handleSaveKey() {
    if (!keyDueDate) return
    setSavingKey(true)
    setKeyError(null)
    try {
      const updated = await updateLicenseCompany(session.token.token, licenseId, {
        delphi_key_due_date: new Date(keyDueDate).toISOString(),
      })
      setDetail(updated)
    } catch (err) {
      setKeyError(err instanceof ApiError ? err.message : 'Não foi possível gerar a chave.')
    } finally {
      setSavingKey(false)
    }
  }

  async function handleSaveCommercial() {
    setSavingCommercial(true)
    setCommercialError(null)
    try {
      const updated = await updateLicenseCompany(session.token.token, licenseId, {
        monthly_fee: monthlyFee === '' ? null : Number(monthlyFee),
        commission_percent: commissionPercent === '' ? null : Number(commissionPercent),
        representative_user_id: representativeId,
      })
      setDetail(updated)
    } catch (err) {
      setCommercialError(err instanceof ApiError ? err.message : 'Não foi possível salvar os dados comerciais.')
    } finally {
      setSavingCommercial(false)
    }
  }

  const expired = Boolean(detail?.license_expires_at && new Date(detail.license_expires_at) < new Date())

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="mb-3 flex items-center gap-1 text-[12.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
          Voltar para licenças
        </button>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Matriz</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">
          {detail?.people?.name || 'Licença'}
        </h1>
        {detail?.people?.document && (
          <p className="mt-0.5 font-mono text-[12.5px] text-[var(--ink-soft)]">{formatDocument(detail.people.document)}</p>
        )}
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-24 animate-pulse rounded-2xl bg-[var(--surface)]" />
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
      ) : detail ? (
        <div className="flex flex-col gap-6">
          <SectionCard
            title="Assinatura Web"
            subtitle="Validade do acesso ao sistema"
            headerExtra={
              <div className="flex items-center gap-1.5">
                <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase ${statusTone(detail.license_status)}`}>
                  {STATUS_LABELS[detail.license_status] ?? detail.license_status}
                </span>
                {expired && (
                  <span className="rounded-full bg-[var(--red-100)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--red-500)]">
                    Vencida
                  </span>
                )}
              </div>
            }
          >
            <div className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Nova validade"
                  icon={<ClockIcon className="h-4 w-4" />}
                  type="date"
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                />
                <div className="flex items-end">
                  <button
                    type="button"
                    onClick={() => setExpiresAt(plusDays(30))}
                    className="rounded-xl border border-[var(--border)] px-3.5 py-2.5 text-[13px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
                  >
                    Liberar por 30 dias
                  </button>
                </div>
              </div>

              {subscriptionError && <p className="text-[13px] font-medium text-[var(--red-500)]">{subscriptionError}</p>}
              {subscriptionMessage && <p className="text-[13px] font-medium text-[var(--green-600)]">{subscriptionMessage}</p>}

              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={handleSaveSubscription}
                  disabled={savingSubscription || !expiresAt}
                  className="rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
                >
                  {savingSubscription ? 'Salvando…' : 'Salvar validade'}
                </button>
                <button
                  type="button"
                  onClick={handleBlock}
                  disabled={savingSubscription || detail.license_status === 'blocked'}
                  className="rounded-xl bg-[var(--red-100)] px-4 py-2.5 text-[13.5px] font-bold text-[var(--red-500)] transition hover:bg-[var(--red-500)] hover:text-white disabled:opacity-60"
                >
                  Bloquear
                </button>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Chave Delphi" subtitle="Chave de licença usada pelo ERP desktop (siace-erp)">
            <div className="flex flex-col gap-4">
              <div className="rounded-xl bg-[var(--page)] px-3.5 py-2.5">
                {detail.delphiKey ? (
                  <>
                    <p className="break-all font-mono text-[13px] font-semibold text-[var(--ink)]">{detail.delphiKey.key}</p>
                    <p className="mt-0.5 text-[12px] text-[var(--muted)]">
                      Válida até {formatDate(detail.delphiKey.dueDate)} — o Delphi renova sozinho a cada conexão
                      enquanto a assinatura estiver liberada.
                    </p>
                  </>
                ) : (
                  <p className="text-[12.5px] text-[var(--muted)]">Ainda não gerou chave.</p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Validade da chave"
                  icon={<KeyIcon className="h-4 w-4" />}
                  type="date"
                  value={keyDueDate}
                  onChange={(event) => setKeyDueDate(event.target.value)}
                />
              </div>

              {keyError && <p className="text-[13px] font-medium text-[var(--red-500)]">{keyError}</p>}

              <div>
                <button
                  type="button"
                  onClick={handleSaveKey}
                  disabled={savingKey || !keyDueDate}
                  className="rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
                >
                  {savingKey ? 'Gerando…' : 'Gerar / Atualizar chave'}
                </button>
              </div>
            </div>
          </SectionCard>

          <SectionCard title="Dados Comerciais" subtitle="Mensalidade, comissão e representante responsável">
            <div className="flex flex-col gap-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <TextField
                  label="Mensalidade"
                  icon={<DollarSignIcon className="h-4 w-4" />}
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0,00"
                  value={monthlyFee}
                  onChange={(event) => setMonthlyFee(event.target.value)}
                />
                <TextField
                  label="Comissão do representante (%)"
                  icon={<DollarSignIcon className="h-4 w-4" />}
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  placeholder="0"
                  value={commissionPercent}
                  onChange={(event) => setCommissionPercent(event.target.value)}
                />
              </div>

              <SearchSelectField
                label="Representante"
                placeholder="Buscar por nome"
                selectedLabel={representativeLabel}
                onSearch={(query) => searchRepresentatives(session.token.token, query)}
                getOptionLabel={(item) => item.name}
                onSelect={(item) => {
                  setRepresentativeId(item.userId)
                  setRepresentativeLabel(item.name)
                }}
                onClear={() => {
                  setRepresentativeId(null)
                  setRepresentativeLabel(null)
                }}
              />

              {commercialError && <p className="text-[13px] font-medium text-[var(--red-500)]">{commercialError}</p>}

              <div>
                <button
                  type="button"
                  onClick={handleSaveCommercial}
                  disabled={savingCommercial}
                  className="rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
                >
                  {savingCommercial ? 'Salvando…' : 'Salvar dados comerciais'}
                </button>
              </div>
            </div>
          </SectionCard>
        </div>
      ) : null}
    </div>
  )
}
