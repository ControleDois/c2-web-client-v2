import { useEffect, useMemo, useState } from 'react'
import { fetchConfig, updateConfig, parseCentralBoxPaymentMethods, type ConfigPayload, type ConfigRecord } from '../lib/config'
import { isProtecaoVeicular, isEmprestimo, isLojaOnline, isVistoriasNiche } from '../lib/systemTypes'
import { ApiError } from '../lib/api'
import { CompanyFormPage } from './CompanyFormPage'
import { ConfVendaSection } from './config/ConfVendaSection'
import { VistoriasSection } from './config/VistoriasSection'
import { AssinaturaDigitalSection } from './config/AssinaturaDigitalSection'
import { EmprestimoSection } from './config/EmprestimoSection'
import { CobrancasSection } from './config/CobrancasSection'
import { ProtecaoVeicularSection } from './config/ProtecaoVeicularSection'
import { IntegracoesSection } from './config/IntegracoesSection'
import { LojaOnlineSection } from './config/LojaOnlineSection'
import { ComprasSection } from './config/ComprasSection'
import { CheckCircleIcon } from '../components/icons'
import type { AuthSession, AuthCompany } from '../lib/auth'
import type { AppPage } from '../components/layout/AppShell'

interface ConfigPageProps {
  session: AuthSession
  company: AuthCompany
  onNavigate: (page: AppPage) => void
  onSaved?: () => void
}

type ConfigTab =
  | 'dados-empresa'
  | 'conf-venda'
  | 'vistorias'
  | 'protecao-veicular'
  | 'assinatura-digital'
  | 'integracoes'
  | 'cobrancas'
  | 'emprestimo'
  | 'loja-online'
  | 'compras'

interface TabDefinition {
  key: ConfigTab
  label: string
  visible: boolean
}

function buildConfigPayload(companyId: string, config: ConfigRecord | null): ConfigPayload {
  return {
    companyId,
    sale_people_default_id: config?.sale_people_default_id ?? undefined,
    sale_category_default_id: config?.sale_category_default_id ?? undefined,
    sale_bank_account_default_id: config?.sale_bank_account_default_id ?? undefined,
    central_box_active: config?.central_box_active ?? 0,
    central_box_payment_methods: parseCentralBoxPaymentMethods(config?.central_box_payment_methods),

    vehicle_inspection_detailed_required: config?.vehicle_inspection_detailed_required ?? false,
    purchase_management_enabled: config?.purchase_management_enabled ?? false,

    multa_modalidade: config?.multa_modalidade ?? undefined,
    multa_valor: config?.multa_valor ?? undefined,
    juros_modalidade: config?.juros_modalidade ?? undefined,
    juros_valor: config?.juros_valor ?? undefined,
    desconto_valor: config?.desconto_valor ?? undefined,
    desconto_dias_antecipacao: config?.desconto_dias_antecipacao ?? undefined,

    protection_cancel_tracker_task_enabled: config?.protection_cancel_tracker_task_enabled ?? false,
    protection_cancel_tracker_task_board_id: config?.protection_cancel_tracker_task_board_id ?? undefined,
    protection_cancel_tracker_task_due_days: config?.protection_cancel_tracker_task_due_days ?? undefined,
    protection_cancel_tracker_task_send_whatsapp: config?.protection_cancel_tracker_task_send_whatsapp ?? false,
    protection_cancel_tracker_task_whatsapp_id: config?.protection_cancel_tracker_task_whatsapp_id ?? undefined,
    protection_cancel_tracker_task_users: config?.protection_cancel_tracker_task_users ?? [],
    protection_cancel_tracker_task_message: config?.protection_cancel_tracker_task_message ?? undefined,

    autentique_api_url: config?.autentique_api_url ?? undefined,
    autentique_api_token: config?.autentique_api_token ?? undefined,
    autentique_folder_id: config?.autentique_folder_id ?? undefined,
    autentique_pdf_converter_url: config?.autentique_pdf_converter_url ?? undefined,
    autentique_webhook_secret: config?.autentique_webhook_secret ?? undefined,

    sicredi_chave_pix: config?.sicredi_chave_pix ?? undefined,
    sicredi_client_id: config?.sicredi_client_id ?? undefined,
    sicredi_client_secret: config?.sicredi_client_secret ?? undefined,
    sicredi_pix_validade_apos_vencimento: config?.sicredi_pix_validade_apos_vencimento ?? undefined,
    sicredi_pix_multa_modalidade: config?.sicredi_pix_multa_modalidade ?? undefined,
    sicredi_pix_multa_valor: config?.sicredi_pix_multa_valor ?? undefined,
    sicredi_pix_juros_modalidade: config?.sicredi_pix_juros_modalidade ?? undefined,
    sicredi_pix_juros_valor: config?.sicredi_pix_juros_valor ?? undefined,
    sicredi_pix_desconto_valor: config?.sicredi_pix_desconto_valor ?? undefined,
    sicredi_pix_desconto_dias_antecipacao: config?.sicredi_pix_desconto_dias_antecipacao ?? undefined,

    sicredi_boleto_username: config?.sicredi_boleto_username ?? undefined,
    sicredi_boleto_x_api_key: config?.sicredi_boleto_x_api_key ?? undefined,
    sicredi_boleto_password: config?.sicredi_boleto_password ?? undefined,
    sicredi_boleto_cooperativa: config?.sicredi_boleto_cooperativa ?? undefined,
    sicredi_boleto_posto: config?.sicredi_boleto_posto ?? undefined,
    sicredi_boleto_codigo_beneficiario: config?.sicredi_boleto_codigo_beneficiario ?? undefined,
    sicredi_boleto_tipo_cobranca: config?.sicredi_boleto_tipo_cobranca ?? undefined,
    sicredi_boleto_especie_documento: config?.sicredi_boleto_especie_documento ?? undefined,
    sicredi_boleto_negativar_protesto: config?.sicredi_boleto_negativar_protesto ?? undefined,
    sicredi_boleto_dias_protesto_auto: config?.sicredi_boleto_dias_protesto_auto ?? undefined,
    sicredi_boleto_dias_negativacao_auto: config?.sicredi_boleto_dias_negativacao_auto ?? undefined,
    sicredi_boleto_validade_apos_vencimento: config?.sicredi_boleto_validade_apos_vencimento ?? undefined,
    sicredi_boleto_tipo_juros: config?.sicredi_boleto_tipo_juros ?? undefined,
    sicredi_boleto_juros: config?.sicredi_boleto_juros ?? undefined,
    sicredi_boleto_tipo_juros_percentual: config?.sicredi_boleto_tipo_juros_percentual ?? undefined,
    sicredi_boleto_tipo_multa: config?.sicredi_boleto_tipo_multa ?? undefined,
    sicredi_boleto_multa: config?.sicredi_boleto_multa ?? undefined,
    sicredi_boleto_tipo_desconto: config?.sicredi_boleto_tipo_desconto ?? undefined,
    sicredi_boleto_valor_desconto1: config?.sicredi_boleto_valor_desconto1 ?? undefined,
    sicredi_boleto_dias_desconto1: config?.sicredi_boleto_dias_desconto1 ?? undefined,
    sicredi_boleto_valor_desconto2: config?.sicredi_boleto_valor_desconto2 ?? undefined,
    sicredi_boleto_dias_desconto2: config?.sicredi_boleto_dias_desconto2 ?? undefined,
    sicredi_boleto_valor_desconto3: config?.sicredi_boleto_valor_desconto3 ?? undefined,
    sicredi_boleto_dias_desconto3: config?.sicredi_boleto_dias_desconto3 ?? undefined,
    sicredi_boleto_informativo1: config?.sicredi_boleto_informativo1 ?? undefined,
    sicredi_boleto_informativo2: config?.sicredi_boleto_informativo2 ?? undefined,
    sicredi_boleto_informativo3: config?.sicredi_boleto_informativo3 ?? undefined,
    sicredi_boleto_informativo4: config?.sicredi_boleto_informativo4 ?? undefined,
    sicredi_boleto_informativo5: config?.sicredi_boleto_informativo5 ?? undefined,
    sicredi_boleto_mensagem1: config?.sicredi_boleto_mensagem1 ?? undefined,
    sicredi_boleto_mensagem2: config?.sicredi_boleto_mensagem2 ?? undefined,
    sicredi_boleto_mensagem3: config?.sicredi_boleto_mensagem3 ?? undefined,
    sicredi_boleto_mensagem4: config?.sicredi_boleto_mensagem4 ?? undefined,

    billing_whatsapp_enabled: config?.billing_whatsapp_enabled ?? false,
    billing_whatsapp_ai_mode: config?.billing_whatsapp_ai_mode ?? false,
    billing_whatsapp_start_time: config?.billing_whatsapp_start_time ?? undefined,
    billing_whatsapp_min_interval_minutes: config?.billing_whatsapp_min_interval_minutes ?? undefined,
    billing_whatsapp_max_interval_minutes: config?.billing_whatsapp_max_interval_minutes ?? undefined,
    billing_whatsapp_customer_area_url: config?.billing_whatsapp_customer_area_url ?? undefined,
    billing_whatsapp_rules: config?.billing_whatsapp_rules ?? [],
    billing_whatsapp_message_before: config?.billing_whatsapp_message_before ?? undefined,
    billing_whatsapp_message_overdue: config?.billing_whatsapp_message_overdue ?? undefined,

    loan_points_per_payoff: config?.loan_points_per_payoff ?? undefined,

    shop: config?.company?.shop
      ? {
          link_url: config.company.shop.linkUrl ?? '',
          color_default: config.company.shop.colorDefault ?? undefined,
          is_active: config.company.shop.isActive ?? false,
          accepting_orders: config.company.shop.acceptingOrders ?? true,
          delivery_fee: config.company.shop.deliveryFee ?? undefined,
          minimum_order_value: config.company.shop.minimumOrderValue ?? undefined,
          delivery_radius_km: config.company.shop.deliveryRadiusKm ?? undefined,
          estimated_delivery_minutes: config.company.shop.estimatedDeliveryMinutes ?? undefined,
          opening_hours: config.company.shop.openingHours ?? undefined,
        }
      : undefined,
  }
}

export function ConfigPage({ session, company, onNavigate, onSaved }: ConfigPageProps) {
  const [config, setConfig] = useState<ConfigRecord | null>(null)
  const [formState, setFormState] = useState<ConfigPayload>(() => buildConfigPayload(company.id, null))
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)
  const [activeTab, setActiveTab] = useState<ConfigTab>('dados-empresa')

  const systemType = company.system_type

  const tabs = useMemo<TabDefinition[]>(
    () => [
      { key: 'dados-empresa', label: 'Dados da Empresa', visible: true },
      { key: 'conf-venda', label: 'Conf. de Venda', visible: true },
      { key: 'vistorias', label: 'Vistorias', visible: isVistoriasNiche(systemType) },
      { key: 'protecao-veicular', label: 'Proteção Veicular', visible: isProtecaoVeicular(systemType) },
      { key: 'assinatura-digital', label: 'Assinatura Digital', visible: true },
      { key: 'integracoes', label: 'Integrações Bancárias', visible: true },
      { key: 'cobrancas', label: 'Cobranças', visible: true },
      { key: 'emprestimo', label: 'Empréstimo', visible: isEmprestimo(systemType) },
      { key: 'loja-online', label: 'Loja Online', visible: isLojaOnline(systemType) },
      { key: 'compras', label: 'Compras', visible: true },
    ],
    [systemType]
  )

  const visibleTabs = tabs.filter((tab) => tab.visible)

  useEffect(() => {
    if (!visibleTabs.some((tab) => tab.key === activeTab) && visibleTabs.length > 0) {
      setActiveTab(visibleTabs[0].key)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [systemType])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    fetchConfig(session.token.token, company.id)
      .then((res) => {
        if (cancelled) return
        setConfig(res)
        setFormState(buildConfigPayload(company.id, res))
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err instanceof ApiError ? err.message : 'Não foi possível carregar as configurações.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [session.token.token, company.id, reloadKey])

  function handleChange(patch: Partial<ConfigPayload>) {
    setFormState((current) => ({ ...current, ...patch }))
    setSaved(false)
  }

  async function handleSave() {
    if (!config) return
    setSubmitting(true)
    setError(null)
    setSaved(false)
    try {
      // Um rascunho de Loja Online sem slug preenchido não pode ser enviado —
      // o backend rejeita `shop` sem `link_url`, o que bloquearia o Salvar
      // global mesmo quando o usuário só editou outra aba.
      const payload = { ...formState }
      if (payload.shop && !payload.shop.link_url) {
        delete payload.shop
      }
      const updated = await updateConfig(session.token.token, config.id, payload)
      setConfig(updated)
      setSaved(true)
      onSaved?.()
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar as configurações.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Conta</p>
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Configurações</h1>
        </div>
        {activeTab !== 'dados-empresa' && (
          <button
            type="button"
            onClick={handleSave}
            disabled={submitting || loading || Boolean(loadError)}
            className="flex items-center gap-2 rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
          >
            {saved ? (
              <>
                <CheckCircleIcon className="h-4 w-4" /> Salvo
              </>
            ) : submitting ? (
              'Salvando…'
            ) : (
              'Salvar'
            )}
          </button>
        )}
      </div>

      {error && (
        <div className="rounded-2xl bg-[var(--red-100)] p-4 text-[13.5px] font-medium text-[var(--red-500)]">
          {error}
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
        <>
          <div className="flex flex-wrap gap-1 border-b border-[var(--border)]">
            {visibleTabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`rounded-t-xl px-4 py-2.5 text-[13px] font-bold transition ${
                  activeTab === tab.key
                    ? 'bg-[var(--blue-500)] text-white'
                    : 'text-[var(--ink-soft)] hover:bg-[var(--surface)]'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {activeTab === 'dados-empresa' ? (
            company.people?.id ? (
              <CompanyFormPage session={session} companyId={company.people.id} onSaved={() => {}} embedded />
            ) : (
              <div className="rounded-2xl bg-[var(--red-100)] p-4 text-[13.5px] font-medium text-[var(--red-500)]">
                Não foi possível identificar o cadastro da empresa ativa.
              </div>
            )
          ) : (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
              {activeTab === 'conf-venda' && (
                <ConfVendaSection value={formState} onChange={handleChange} config={config} session={session} company={company} />
              )}
              {activeTab === 'vistorias' && <VistoriasSection value={formState} onChange={handleChange} />}
              {activeTab === 'assinatura-digital' && (
                <AssinaturaDigitalSection value={formState} onChange={handleChange} />
              )}
              {activeTab === 'emprestimo' && <EmprestimoSection value={formState} onChange={handleChange} />}
              {activeTab === 'protecao-veicular' && (
                <ProtecaoVeicularSection value={formState} onChange={handleChange} config={config} session={session} company={company} />
              )}
              {activeTab === 'integracoes' && (
                <IntegracoesSection value={formState} onChange={handleChange} config={config} session={session} company={company} />
              )}
              {activeTab === 'cobrancas' && <CobrancasSection value={formState} onChange={handleChange} />}
              {activeTab === 'loja-online' && <LojaOnlineSection value={formState} onChange={handleChange} />}
              {activeTab === 'compras' && (
                <ComprasSection
                  value={formState}
                  onChange={handleChange}
                  onOpenPurchaseManagement={() => onNavigate('purchase-management')}
                />
              )}
            </div>
          )}
        </>
      )}
    </div>
  )
}
