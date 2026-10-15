import { useEffect, useState, type FormEvent } from 'react'
import { createPlan, fetchPlan, fetchPlanCatalog, priceWithDiscount, updatePlan, type PlanPayload } from '../lib/plans'
import type { PlanFeatureDef } from '../lib/subscription'
import { ApiError } from '../lib/api'
import { formatCurrency } from '../lib/format'
import { TextField } from '../components/form/TextField'
import { MoneyField } from '../components/form/MoneyField'
import { ChevronLeftIcon, TagIcon, CoinIcon } from '../components/icons'
import type { AuthSession } from '../lib/auth'

interface PlanFormPageProps {
  session: AuthSession
  planId?: string
  onBack: () => void
  onSaved: () => void
}

const textareaClass =
  'w-full rounded-xl bg-[var(--page)] px-3.5 py-3 text-[14px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-1 focus:ring-[var(--blue-300)]'

const toNumber = (value: string) => {
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : 0
}

type FeatureState = Record<string, { enabled: boolean; unlimited: boolean; value: string }>

export function PlanFormPage({ session, planId, onBack, onSaved }: PlanFormPageProps) {
  const token = session.token.token
  const [catalog, setCatalog] = useState<PlanFeatureDef[]>([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [name, setName] = useState('')
  const [slug, setSlug] = useState('')
  const [tagline, setTagline] = useState('')
  const [description, setDescription] = useState('')
  const [priceMonthly, setPriceMonthly] = useState('')
  const [sellYearly, setSellYearly] = useState(true)
  const [priceYearly, setPriceYearly] = useState('')
  const [discountPercent, setDiscountPercent] = useState('')
  const [discountLabel, setDiscountLabel] = useState('')
  const [discountEndsAt, setDiscountEndsAt] = useState('')
  const [highlighted, setHighlighted] = useState(false)
  const [active, setActive] = useState(false)
  const [position, setPosition] = useState('0')
  const [highlights, setHighlights] = useState('')
  const [features, setFeatures] = useState<FeatureState>({})

  useEffect(() => {
    let cancelled = false
    Promise.all([fetchPlanCatalog(token), planId ? fetchPlan(token, planId) : Promise.resolve(null)])
      .then(([catalogResult, plan]) => {
        if (cancelled) return
        setCatalog(catalogResult)
        const state: FeatureState = {}
        for (const feature of catalogResult) {
          const raw = plan?.features?.[feature.key]
          if (feature.type === 'boolean') {
            state[feature.key] = { enabled: raw === true, unlimited: false, value: '' }
          } else {
            state[feature.key] = {
              enabled: true,
              unlimited: plan ? raw === null || raw === undefined : true,
              value: raw !== null && raw !== undefined ? String(raw) : '',
            }
          }
        }
        setFeatures(state)
        if (plan) {
          setName(plan.name)
          setSlug(plan.slug)
          setTagline(plan.tagline ?? '')
          setDescription(plan.description ?? '')
          setPriceMonthly(String(plan.price_monthly))
          setSellYearly(plan.price_yearly !== null && plan.price_yearly !== undefined)
          setPriceYearly(plan.price_yearly !== null && plan.price_yearly !== undefined ? String(plan.price_yearly) : '')
          setDiscountPercent(plan.discount_percent ? String(plan.discount_percent) : '')
          setDiscountLabel(plan.discount_label ?? '')
          setDiscountEndsAt(plan.discount_ends_at ? plan.discount_ends_at.slice(0, 10) : '')
          setHighlighted(plan.highlighted)
          setActive(plan.active)
          setPosition(String(plan.position ?? 0))
          setHighlights((plan.highlights ?? []).join('\n'))
        }
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : 'Não foi possível carregar o plano.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [planId, token])

  function patchFeature(key: string, patch: Partial<FeatureState[string]>) {
    setFeatures((current) => ({ ...current, [key]: { ...current[key], ...patch } }))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (name.trim().length < 2) {
      setError('Informe o nome do plano.')
      return
    }
    if (toNumber(priceMonthly) <= 0 && active) {
      setError('Informe o valor mensal para ativar o plano.')
      return
    }

    const featurePayload: PlanPayload['features'] = {}
    for (const feature of catalog) {
      const state = features[feature.key]
      if (!state) continue
      if (feature.type === 'boolean') featurePayload[feature.key] = state.enabled
      else featurePayload[feature.key] = state.unlimited || state.value.trim() === '' ? null : Math.max(0, Math.floor(toNumber(state.value)))
    }

    const payload: PlanPayload = {
      name: name.trim(),
      slug: slug.trim() || undefined,
      tagline: tagline.trim() || null,
      description: description.trim() || null,
      price_monthly: toNumber(priceMonthly),
      price_yearly: sellYearly && priceYearly ? toNumber(priceYearly) : null,
      discount_percent: Math.min(100, Math.max(0, toNumber(discountPercent))),
      discount_label: discountLabel.trim() || null,
      discount_ends_at: discountEndsAt ? new Date(`${discountEndsAt}T23:59:59`).toISOString() : null,
      highlighted,
      active,
      position: Math.max(0, Math.floor(toNumber(position))),
      features: featurePayload,
      highlights: highlights
        .split('\n')
        .map((line) => line.trim())
        .filter(Boolean),
    }

    setSubmitting(true)
    try {
      if (planId) await updatePlan(token, planId, payload)
      else await createPlan(token, payload)
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o plano.')
    } finally {
      setSubmitting(false)
    }
  }

  const percent = Math.min(100, Math.max(0, toNumber(discountPercent)))
  const monthly = toNumber(priceMonthly)
  const yearly = toNumber(priceYearly)

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="mb-3 flex items-center gap-1 text-[12.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
          Voltar para os planos
        </button>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Planos</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">{planId ? 'Editar plano' : 'Novo plano'}</h1>
      </div>

      {loading ? (
        <div className="h-11 animate-pulse rounded-xl bg-[var(--surface)]" />
      ) : loadError ? (
        <p className="rounded-2xl bg-[var(--red-100)] p-5 text-[13.5px] font-medium text-[var(--red-500)]">{loadError}</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="mb-4 text-[14px] font-bold text-[var(--ink)]">Dados do plano</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField label="Nome" icon={<TagIcon className="h-4 w-4" />} placeholder="Ex: Profissional" value={name} onChange={(event) => setName(event.target.value)} />
              <TextField
                label="Endereço (slug)"
                icon={<TagIcon className="h-4 w-4" />}
                placeholder="gerado do nome"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
              />
              <div className="sm:col-span-2">
                <TextField
                  label="Frase curta"
                  icon={<TagIcon className="h-4 w-4" />}
                  placeholder="Ex: Para vender mais e cobrar sem esforço"
                  value={tagline}
                  onChange={(event) => setTagline(event.target.value)}
                />
              </div>
              <label className="flex flex-col gap-1.5 sm:col-span-2">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Descrição (opcional)</span>
                <textarea rows={2} value={description} onChange={(event) => setDescription(event.target.value)} className={textareaClass} />
              </label>
              <TextField label="Ordem na lista" icon={<TagIcon className="h-4 w-4" />} inputMode="numeric" value={position} onChange={(event) => setPosition(event.target.value.replace(/\D/g, ''))} />
            </div>
            <div className="mt-4 flex flex-col gap-2.5">
              <label className="flex items-center gap-2.5">
                <input type="checkbox" checked={active} onChange={(event) => setActive(event.target.checked)} className="h-4 w-4 accent-[var(--blue-500)]" />
                <span className="text-[13.5px] font-semibold text-[var(--ink)]">Ativo: aparece no site e no painel dos clientes</span>
              </label>
              <label className="flex items-center gap-2.5">
                <input type="checkbox" checked={highlighted} onChange={(event) => setHighlighted(event.target.checked)} className="h-4 w-4 accent-[var(--blue-500)]" />
                <span className="text-[13.5px] font-semibold text-[var(--ink)]">Destacar como "Mais popular" (só um plano por vez)</span>
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="mb-4 text-[14px] font-bold text-[var(--ink)]">Preços e desconto</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <MoneyField label="Valor mensal" icon={<CoinIcon className="h-4 w-4" />} value={priceMonthly} onChange={(event) => setPriceMonthly(event.target.value)} />
              <div>
                <MoneyField
                  label="Valor anual"
                  icon={<CoinIcon className="h-4 w-4" />}
                  value={priceYearly}
                  disabled={!sellYearly}
                  onChange={(event) => setPriceYearly(event.target.value)}
                />
                <label className="mt-2 flex items-center gap-2">
                  <input type="checkbox" checked={sellYearly} onChange={(event) => setSellYearly(event.target.checked)} className="h-4 w-4 accent-[var(--blue-500)]" />
                  <span className="text-[12.5px] text-[var(--ink-soft)]">Vender também no ciclo anual</span>
                </label>
              </div>
              <TextField
                label="Desconto (%)"
                icon={<TagIcon className="h-4 w-4" />}
                inputMode="decimal"
                placeholder="0"
                value={discountPercent}
                onChange={(event) => setDiscountPercent(event.target.value.replace(/[^\d.,]/g, '').replace(',', '.'))}
              />
              <TextField
                label="Nome da promoção"
                icon={<TagIcon className="h-4 w-4" />}
                placeholder="Ex: Lançamento"
                value={discountLabel}
                onChange={(event) => setDiscountLabel(event.target.value)}
              />
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Desconto vale até (opcional)</span>
                <input
                  type="date"
                  value={discountEndsAt}
                  onChange={(event) => setDiscountEndsAt(event.target.value)}
                  className="rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--blue-300)]"
                />
              </label>
            </div>
            {monthly > 0 && (
              <p className="mt-3 rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[12.5px] text-[var(--ink-soft)]">
                O cliente vê: {formatCurrency(priceWithDiscount(monthly, percent))}/mês
                {percent > 0 ? ` (de ${formatCurrency(monthly)}, ${percent}% de desconto)` : ''}
                {sellYearly && yearly > 0 ? ` · ${formatCurrency(priceWithDiscount(yearly, percent))}/ano` : ''}
              </p>
            )}
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="text-[14px] font-bold text-[var(--ink)]">O que o plano libera</h2>
            <p className="mb-4 mt-0.5 text-[12px] text-[var(--muted)]">
              Esses recursos são conferidos pelo sistema: o que estiver desligado fica bloqueado e mostra o convite para assinar. O teste grátis nunca inclui notas fiscais,
              assinatura digital nem WhatsApp.
            </p>
            <div className="flex flex-col gap-3">
              {catalog.map((feature) => {
                const state = features[feature.key]
                if (!state) return null
                const blocked = feature.requires ? !features[feature.requires]?.enabled : false
                return (
                  <div key={feature.key} className={`rounded-xl bg-[var(--page)] p-4 ${blocked ? 'opacity-50' : ''}`}>
                    {feature.type === 'boolean' ? (
                      <label className="flex items-start gap-2.5">
                        <input
                          type="checkbox"
                          checked={state.enabled}
                          onChange={(event) => patchFeature(feature.key, { enabled: event.target.checked })}
                          className="mt-0.5 h-4 w-4 accent-[var(--blue-500)]"
                        />
                        <span>
                          <span className="block text-[13.5px] font-bold text-[var(--ink)]">{feature.label}</span>
                          <span className="block text-[12px] text-[var(--ink-soft)]">{feature.description}</span>
                        </span>
                      </label>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <span>
                          <span className="block text-[13.5px] font-bold text-[var(--ink)]">{feature.label}</span>
                          <span className="block text-[12px] text-[var(--ink-soft)]">{feature.description}</span>
                        </span>
                        <div className="flex items-center gap-3">
                          <input
                            disabled={state.unlimited || blocked}
                            inputMode="numeric"
                            value={state.value}
                            placeholder="0"
                            onChange={(event) => patchFeature(feature.key, { value: event.target.value.replace(/\D/g, '') })}
                            className="w-24 rounded-lg bg-[var(--surface)] px-3 py-2 text-[13.5px] text-[var(--ink)] disabled:opacity-50 focus:outline-none focus:ring-1 focus:ring-[var(--blue-300)]"
                          />
                          <label className="flex items-center gap-1.5 text-[12.5px] font-semibold text-[var(--ink-soft)]">
                            <input
                              type="checkbox"
                              checked={state.unlimited}
                              disabled={blocked}
                              onChange={(event) => patchFeature(feature.key, { unlimited: event.target.checked })}
                              className="h-4 w-4 accent-[var(--blue-500)]"
                            />
                            Ilimitado
                          </label>
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="text-[14px] font-bold text-[var(--ink)]">Destaques para o cliente</h2>
            <p className="mb-3 mt-0.5 text-[12px] text-[var(--muted)]">
              Uma vantagem por linha (até 12). Aparece como lista no cartão do plano. Serve também para o que o sistema não confere, como suporte e treinamento.
            </p>
            <textarea
              rows={6}
              value={highlights}
              onChange={(event) => setHighlights(event.target.value)}
              placeholder={'Tudo do plano anterior\nSuporte por WhatsApp'}
              className={textareaClass}
            />
          </div>

          {error && <p className="rounded-xl bg-[var(--red-100)] px-4 py-3 text-[13.5px] font-medium text-[var(--red-500)]">{error}</p>}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-[var(--blue-500)] px-6 py-2.5 text-[14px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
            >
              {submitting ? 'Salvando…' : 'Salvar plano'}
            </button>
            <button type="button" onClick={onBack} className="rounded-xl px-5 py-2.5 text-[14px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]">
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
