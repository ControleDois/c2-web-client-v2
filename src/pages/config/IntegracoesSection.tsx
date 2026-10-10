import { useEffect, useState } from 'react'
import type { ConfigPayload, ConfigRecord } from '../../lib/config'
import {
  SICREDI_BOLETO_TIPO_COBRANCA_OPTIONS,
  SICREDI_BOLETO_ESPECIE_DOCUMENTO_OPTIONS,
  SICREDI_BOLETO_NEGATIVAR_PROTESTO_OPTIONS,
  SICREDI_BOLETO_TIPO_DESCONTO_OPTIONS,
  SICREDI_BOLETO_TIPO_JUROS_PERCENTUAL_OPTIONS,
  consultarWebhookPixSicredi,
  configurarWebhookPixSicredi,
  consultarWebhookBoletoSicredi,
  criarWebhookBoletoSicredi,
  atualizarWebhookBoletoSicredi,
  testCoraConnection,
  registerCoraWebhook,
  fetchCoraPartnerInfo,
  fetchCoraAuthorizeUrl,
  disconnectCora,
  CORA_CONNECT_STORAGE_KEY,
  type CoraPartnerInfo,
} from '../../lib/config'
import { ApiError } from '../../lib/api'
import { SectionCard } from '../../components/SectionCard'
import { TextField } from '../../components/form/TextField'
import { SelectField } from '../../components/form/SelectField'
import { LockIcon, TagIcon, PaperclipIcon, WalletIcon, LinkIcon, MailIcon } from '../../components/icons'
import type { AuthSession, AuthCompany } from '../../lib/auth'

interface IntegracoesSectionProps {
  value: ConfigPayload
  onChange: (patch: Partial<ConfigPayload>) => void
  config: ConfigRecord | null
  session: AuthSession
  company: AuthCompany
}

function SicrediPixWebhookCard({ token, companyId }: { token: string; companyId: string }) {
  const [url, setUrl] = useState('')
  const [loading, setLoading] = useState<'consult' | 'save' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleConsult() {
    setLoading('consult')
    setError(null)
    setSuccess(null)
    try {
      const res = await consultarWebhookPixSicredi(token, companyId)
      setUrl(res.webhookUrl ?? '')
      setSuccess(res.webhookUrl ? 'Webhook consultado com sucesso.' : 'Nenhum webhook configurado ainda. Você pode criar um novo.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Webhook não encontrado para estas credenciais. Você pode criar um novo.')
      setUrl('')
    } finally {
      setLoading(null)
    }
  }

  async function handleSave() {
    if (!url.trim()) {
      setError('Informe a URL de notificação.')
      return
    }
    setLoading('save')
    setError(null)
    setSuccess(null)
    try {
      await configurarWebhookPixSicredi(token, companyId, { webhookUrl: url.trim() })
      setSuccess('Webhook Sicredi PIX atualizado com sucesso.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Ocorreu um erro ao atualizar o webhook. Tente novamente mais tarde.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="rounded-xl bg-[var(--page)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--ink)]">
          <LinkIcon className="h-3.5 w-3.5" /> Webhook PIX
        </h4>
        <button
          type="button"
          onClick={handleConsult}
          disabled={loading !== null}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[11.5px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-60"
        >
          {loading === 'consult' ? 'Consultando…' : 'Consultar atual'}
        </button>
      </div>

      <TextField
        label="URL de notificação"
        icon={<LinkIcon className="h-4 w-4" />}
        placeholder="https://sua-api.com/webhook"
        value={url}
        onChange={(event) => setUrl(event.target.value)}
      />

      <button
        type="button"
        onClick={handleSave}
        disabled={loading !== null}
        className="mt-3 w-full rounded-lg bg-[var(--blue-500)] px-3 py-2 text-[12px] font-bold text-white hover:bg-[var(--blue-700)] disabled:opacity-60"
      >
        {loading === 'save' ? 'Enviando…' : 'Atualizar webhook'}
      </button>

      {error && <p className="mt-2 text-[12px] font-medium text-[var(--red-500)]">{error}</p>}
      {success && !error && <p className="mt-2 text-[12px] font-medium text-[var(--green-600)]">{success}</p>}
    </div>
  )
}

function SicrediBoletoWebhookCard({ token, companyId }: { token: string; companyId: string }) {
  const [contratoId, setContratoId] = useState<string | null>(null)
  const [url, setUrl] = useState('')
  const [eventos, setEventos] = useState('')
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [telefone, setTelefone] = useState('')
  const [loading, setLoading] = useState<'consult' | 'save' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function handleConsult() {
    setLoading('consult')
    setError(null)
    setSuccess(null)
    try {
      const res = await consultarWebhookBoletoSicredi(token, companyId)
      setContratoId(res.idContrato ?? null)
      setUrl(res.url ?? '')
      setEventos((res.eventos ?? []).join(','))
      setNome(res.nomeResponsavel ?? '')
      setEmail(res.email ?? '')
      setTelefone(res.telefone ?? '')
      setSuccess('Webhook consultado com sucesso.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Webhook não encontrado para estas credenciais. Você pode criar um novo.')
      setContratoId(null)
      setUrl('')
      setEventos('')
      setNome('')
      setEmail('')
      setTelefone('')
    } finally {
      setLoading(null)
    }
  }

  async function handleSave() {
    if (!url.trim() || !eventos.trim()) {
      setError('Informe a URL de notificação e ao menos um evento.')
      return
    }
    setLoading('save')
    setError(null)
    setSuccess(null)
    const payload = {
      url: url.trim(),
      eventos: eventos.split(',').map((item) => item.trim()).filter(Boolean),
      nomeResponsavel: nome.trim(),
      email: email.trim(),
      telefone: telefone.trim(),
    }
    try {
      if (contratoId) {
        await atualizarWebhookBoletoSicredi(token, companyId, contratoId, payload)
        setSuccess('Webhook Sicredi atualizado com sucesso.')
      } else {
        const res = await criarWebhookBoletoSicredi(token, companyId, payload)
        setContratoId(res.idContrato ?? null)
        setSuccess('Webhook Sicredi criado com sucesso.')
      }
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : `Ocorreu um erro ao ${contratoId ? 'atualizar' : 'criar'} o webhook. Tente novamente mais tarde.`
      )
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="rounded-xl bg-[var(--page)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--ink)]">
          <LinkIcon className="h-3.5 w-3.5" /> Webhook Boleto
        </h4>
        <button
          type="button"
          onClick={handleConsult}
          disabled={loading !== null}
          className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[11.5px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-60"
        >
          {loading === 'consult' ? 'Consultando…' : 'Consultar atual'}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <div className="sm:col-span-2 xl:col-span-2">
          <TextField
            label="URL de notificação"
            icon={<LinkIcon className="h-4 w-4" />}
            placeholder="https://sua-api.com/webhook"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
          />
        </div>
        <TextField
          label="Eventos (ex: LIQUIDACAO)"
          icon={<TagIcon className="h-4 w-4" />}
          placeholder="LIQUIDACAO,BAIXA"
          value={eventos}
          onChange={(event) => setEventos(event.target.value)}
        />
        <TextField
          label="Responsável"
          icon={<TagIcon className="h-4 w-4" />}
          value={nome}
          onChange={(event) => setNome(event.target.value)}
        />
        <TextField
          label="E-mail"
          icon={<MailIcon className="h-4 w-4" />}
          type="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        <TextField
          label="Telefone"
          icon={<TagIcon className="h-4 w-4" />}
          value={telefone}
          onChange={(event) => setTelefone(event.target.value)}
        />
      </div>

      <button
        type="button"
        onClick={handleSave}
        disabled={loading !== null}
        className="mt-3 w-full rounded-lg bg-[var(--blue-500)] px-3 py-2 text-[12px] font-bold text-white hover:bg-[var(--blue-700)] disabled:opacity-60"
      >
        {loading === 'save' ? 'Enviando…' : contratoId ? 'Atualizar webhook' : 'Criar novo webhook'}
      </button>

      {error && <p className="mt-2 text-[12px] font-medium text-[var(--red-500)]">{error}</p>}
      {success && !error && <p className="mt-2 text-[12px] font-medium text-[var(--green-600)]">{success}</p>}
    </div>
  )
}

// Parceria: a empresa entra com o login da Cora e autoriza o Controle Dois (sem certificado).
function CoraPartnerCard({ token, companyId, onStatus }: { token: string; companyId: string; onStatus: (connected: boolean) => void }) {
  const [info, setInfo] = useState<CoraPartnerInfo | null>(null)
  const [busy, setBusy] = useState<'connect' | 'disconnect' | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    fetchCoraPartnerInfo(token, companyId)
      .then((res) => {
        setInfo(res)
        onStatus(res.connected)
      })
      .catch(() => setInfo(null))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, companyId])

  async function handleConnect() {
    setBusy('connect')
    setError(null)
    try {
      const { url } = await fetchCoraAuthorizeUrl(token, companyId)
      // Guarda a empresa: o retorno da Cora volta numa página nova, que precisa saber de quem é a conexão.
      localStorage.setItem(CORA_CONNECT_STORAGE_KEY, companyId)
      window.location.href = url
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível iniciar a conexão com a Cora.')
      setBusy(null)
    }
  }

  async function handleDisconnect() {
    setBusy('disconnect')
    setError(null)
    try {
      await disconnectCora(token, companyId)
      const next = await fetchCoraPartnerInfo(token, companyId)
      setInfo(next)
      onStatus(next.connected)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível desconectar a conta.')
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] p-4">
      <h4 className="mb-1 text-[12.5px] font-bold text-[var(--ink)]">Conta Cora</h4>
      {info && !info.available ? (
        <p className="text-[12px] text-[var(--amber-500)]">
          A parceria com a Cora ainda não foi ativada neste servidor. Peça ao suporte do Controle Dois.
        </p>
      ) : (
        <>
          <p className="mb-3 text-[11.5px] text-[var(--muted)]">
            {info?.connected
              ? `Conta conectada${info.connected_at ? ` em ${new Date(info.connected_at).toLocaleDateString('pt-BR')}` : ''}. Os boletos saem pela sua conta Cora e são baixados sozinhos quando pagos.`
              : 'Entre com o seu login da Cora e autorize o Controle Dois a emitir boletos na sua conta. Não precisa gerar certificado nem chave.'}
            {info?.environment === 'stage' ? ' (ambiente de testes da Cora)' : ''}
          </p>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={handleConnect}
              disabled={busy !== null || !info?.available}
              className="rounded-lg bg-[var(--blue-500)] px-3 py-2 text-[12px] font-bold text-white hover:bg-[var(--blue-700)] disabled:opacity-60"
            >
              {busy === 'connect' ? 'Abrindo a Cora…' : info?.connected ? 'Conectar de novo' : 'Conectar com a Cora'}
            </button>
            {info?.connected && (
              <button
                type="button"
                onClick={handleDisconnect}
                disabled={busy !== null}
                className="rounded-lg border border-[var(--border)] px-3 py-2 text-[12px] font-bold text-[var(--ink-soft)] hover:text-[var(--red-500)] disabled:opacity-60"
              >
                {busy === 'disconnect' ? 'Desconectando…' : 'Desconectar'}
              </button>
            )}
          </div>
        </>
      )}
      {error && <p className="mt-2 text-[12px] font-medium text-[var(--red-500)]">{error}</p>}
    </div>
  )
}

function CoraActionsCard({
  token,
  companyId,
  ready,
  webhookRegistered,
  partner,
}: {
  token: string
  companyId: string
  ready: boolean
  webhookRegistered: boolean
  partner: boolean
}) {
  const [loading, setLoading] = useState<'test' | 'webhook' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  async function run(kind: 'test' | 'webhook') {
    setLoading(kind)
    setError(null)
    setSuccess(null)
    try {
      const res = kind === 'test' ? await testCoraConnection(token, companyId) : await registerCoraWebhook(token, companyId)
      setSuccess(res.message)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível concluir a operação.')
    } finally {
      setLoading(null)
    }
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] p-4">
      <h4 className="mb-1 text-[12.5px] font-bold text-[var(--ink)]">Conexão e aviso de pagamento</h4>
      <p className="mb-3 text-[11.5px] text-[var(--muted)]">
        {partner
          ? 'O aviso de pagamento (baixa automática do boleto) é cadastrado pelo Controle Dois para todas as contas conectadas.'
          : 'Salve as configurações antes de testar. O aviso de pagamento faz a Cora avisar o sistema quando o boleto é pago, para baixar o título sozinho.'}
        {!partner && webhookRegistered ? ' Já registrado — registre de novo só se trocar de certificado ou ambiente.' : ''}
      </p>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => run('test')}
          disabled={!ready || loading !== null}
          className="rounded-lg border border-[var(--border)] px-3 py-2 text-[12px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-60"
        >
          {loading === 'test' ? 'Testando…' : 'Testar conexão'}
        </button>
        {!partner && (
          <button
            type="button"
            onClick={() => run('webhook')}
            disabled={!ready || loading !== null}
            className="rounded-lg bg-[var(--blue-500)] px-3 py-2 text-[12px] font-bold text-white hover:bg-[var(--blue-700)] disabled:opacity-60"
          >
            {loading === 'webhook' ? 'Registrando…' : 'Registrar aviso de pagamento'}
          </button>
        )}
      </div>
      {!ready && (
        <p className="mt-2 text-[11.5px] text-[var(--muted)]">
          {partner
            ? 'Conecte a conta Cora para liberar o teste.'
            : 'Informe o Client ID, envie o certificado e a chave e salve para liberar estes botões.'}
        </p>
      )}
      {error && <p className="mt-2 text-[12px] font-medium text-[var(--red-500)]">{error}</p>}
      {success && !error && <p className="mt-2 text-[12px] font-medium text-[var(--green-600)]">{success}</p>}
    </div>
  )
}

function NumberField({
  label,
  value,
  onChange,
}: {
  label: string
  value: number | undefined
  onChange: (value: number) => void
}) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-semibold text-[var(--ink-soft)]">{label}</span>
      <input
        type="number"
        value={value ?? ''}
        onChange={(event) => onChange(Number(event.target.value))}
        className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
      />
    </label>
  )
}

export function IntegracoesSection({ value, onChange, config, session, company }: IntegracoesSectionProps) {
  const token = session.token.token
  const coraPartner = (value.cora_auth_mode ?? 'direct') === 'partner'
  const [coraConnected, setCoraConnected] = useState(false)
  return (
    <div className="flex flex-col gap-4">
      <SectionCard
        title="Banco Cora"
        subtitle="Boleto registrado com PIX pela integração direta da Cora"
        defaultCollapsed={!config?.cora_enabled}
      >
        <div className="flex flex-col gap-5">
          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={Boolean(value.cora_enabled)}
              onChange={(event) => onChange({ cora_enabled: event.target.checked })}
              className="h-4 w-4 accent-[var(--blue-500)]"
            />
            <span className="text-[13.5px] font-semibold text-[var(--ink)]">Emitir boletos pelo Banco Cora</span>
          </label>

          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <SelectField
              label="Forma de conexão"
              value={value.cora_auth_mode ?? 'direct'}
              onChange={(event) => onChange({ cora_auth_mode: event.target.value as 'direct' | 'partner' })}
            >
              <option value="partner">Parceria (conectar com o login da Cora)</option>
              <option value="direct">Integração direta (certificado e chave)</option>
            </SelectField>
          </div>

          {coraPartner && <CoraPartnerCard token={token} companyId={company.id} onStatus={setCoraConnected} />}

          {!coraPartner && (
          <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <TextField
              label="Client ID"
              icon={<LockIcon className="h-4 w-4" />}
              placeholder="int-xxxxxxxxxxxxxxxx"
              value={value.cora_client_id ?? ''}
              onChange={(event) => onChange({ cora_client_id: event.target.value })}
            />
            <SelectField
              label="Ambiente"
              value={value.cora_environment ?? 'production'}
              onChange={(event) => onChange({ cora_environment: event.target.value as 'production' | 'stage' })}
            >
              <option value="production">Produção</option>
              <option value="stage">Testes (stage)</option>
            </SelectField>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Certificado (certificate.pem)</span>
              <label className="flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]">
                <PaperclipIcon className="h-3.5 w-3.5 flex-none" />
                {value.cora_cert_file?.name ?? config?.cora_cert_file_name ?? 'Selecionar arquivo'}
                <input
                  type="file"
                  accept=".crt,.pem,.cer"
                  className="hidden"
                  onChange={(event) => onChange({ cora_cert_file: event.target.files?.[0] })}
                />
              </label>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Chave privada (private-key.key)</span>
              <label className="flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]">
                <PaperclipIcon className="h-3.5 w-3.5 flex-none" />
                {value.cora_key_file?.name ?? config?.cora_key_file_name ?? 'Selecionar arquivo'}
                <input
                  type="file"
                  accept=".key,.pem"
                  className="hidden"
                  onChange={(event) => onChange({ cora_key_file: event.target.files?.[0] })}
                />
              </label>
            </div>
          </div>
          <p className="-mt-3 text-[11.5px] text-[var(--muted)]">
            Gere o Client ID, o certificado e a chave no Cora Web (Conta &gt; Integrações via APIs). Os arquivos ficam
            guardados de forma privada no servidor, nunca com link público.
          </p>
          </>
          )}

          <div>
            <h4 className="mb-3 text-[12.5px] font-bold text-[var(--ink)]">Regras de cobrança</h4>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <NumberField
                label="Multa por atraso (%)"
                value={value.cora_fine_rate}
                onChange={(v) => onChange({ cora_fine_rate: v })}
              />
              <NumberField
                label="Juros ao mês (%)"
                value={value.cora_interest_rate}
                onChange={(v) => onChange({ cora_interest_rate: v })}
              />
              <SelectField
                label="Desconto por pagamento antecipado"
                value={value.cora_discount_type ?? ''}
                onChange={(event) =>
                  onChange({ cora_discount_type: event.target.value as 'FIXED' | 'PERCENT' | '' })
                }
              >
                <option value="">Sem desconto</option>
                <option value="PERCENT">Percentual (%)</option>
                <option value="FIXED">Valor fixo (R$)</option>
              </SelectField>
              {value.cora_discount_type && (
                <NumberField
                  label={value.cora_discount_type === 'PERCENT' ? 'Desconto (%)' : 'Desconto (R$)'}
                  value={value.cora_discount_value}
                  onChange={(v) => onChange({ cora_discount_value: v })}
                />
              )}
            </div>
          </div>

          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={value.cora_include_pix !== false}
              onChange={(event) => onChange({ cora_include_pix: event.target.checked })}
              className="h-4 w-4 accent-[var(--blue-500)]"
            />
            <span className="text-[13.5px] font-semibold text-[var(--ink)]">Incluir PIX (copia e cola) no boleto</span>
          </label>

          <CoraActionsCard
            token={token}
            companyId={company.id}
            ready={
              coraPartner
                ? coraConnected
                : Boolean(config?.cora_client_id && config?.cora_cert_file_name && config?.cora_key_file_name)
            }
            webhookRegistered={Boolean(config?.cora_webhook_endpoint_id)}
            partner={coraPartner}
          />
        </div>
      </SectionCard>

      <SectionCard title="Sicredi PIX" subtitle="Chaves, certificados e regras de cobrança">
        <div className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <TextField
              label="Chave PIX"
              icon={<TagIcon className="h-4 w-4" />}
              value={value.sicredi_chave_pix ?? ''}
              onChange={(event) => onChange({ sicredi_chave_pix: event.target.value })}
            />
            <TextField
              label="Client ID"
              icon={<LockIcon className="h-4 w-4" />}
              value={value.sicredi_client_id ?? ''}
              onChange={(event) => onChange({ sicredi_client_id: event.target.value })}
            />
            <TextField
              label="Client Secret"
              icon={<LockIcon className="h-4 w-4" />}
              type="password"
              value={value.sicredi_client_secret ?? ''}
              onChange={(event) => onChange({ sicredi_client_secret: event.target.value })}
            />
            <div className="sm:col-span-2 xl:col-span-3">
              <TextField
                label="Escopos"
                icon={<TagIcon className="h-4 w-4" />}
                placeholder="cob.write+cob.read+webhook.read+webhook.write (vazio = não manda escopo)"
                value={value.sicredi_escopos ?? ''}
                onChange={(event) => onChange({ sicredi_escopos: event.target.value })}
              />
              <p className="mt-1.5 text-[11.5px] text-[var(--muted)]">
                O Sicredi rejeita o token inteiro se algum escopo pedido aqui não estiver liberado pra
                essa aplicação — cada cliente pode ter permissões diferentes (ex: nem todos têm
                "cobv"). Deixe vazio pra não mandar escopo nenhum e deixar o Sicredi conceder o que
                estiver liberado.
              </p>
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Certificado (.crt, .pem, .cer)</span>
              <label className="flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]">
                <PaperclipIcon className="h-3.5 w-3.5 flex-none" />
                {value.sicredi_cert_file?.name ?? config?.sicredi_cert_file_name ?? 'Selecionar arquivo'}
                <input
                  type="file"
                  accept=".crt,.pem,.cer"
                  className="hidden"
                  onChange={(event) => onChange({ sicredi_cert_file: event.target.files?.[0] })}
                />
              </label>
            </div>
            <div className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Chave privada (.key, .pem)</span>
              <label className="flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]">
                <PaperclipIcon className="h-3.5 w-3.5 flex-none" />
                {value.sicredi_key_file?.name ?? config?.sicredi_key_file_name ?? 'Selecionar arquivo'}
                <input
                  type="file"
                  accept=".key,.pem"
                  className="hidden"
                  onChange={(event) => onChange({ sicredi_key_file: event.target.files?.[0] })}
                />
              </label>
            </div>
          </div>

          <div>
            <h4 className="mb-3 text-[12.5px] font-bold text-[var(--ink)]">Regras de cobrança e inadimplência</h4>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <NumberField
                label="Validade após vencimento (dias)"
                value={value.sicredi_pix_validade_apos_vencimento}
                onChange={(v) => onChange({ sicredi_pix_validade_apos_vencimento: v })}
              />
              <NumberField
                label="Multa (modalidade)"
                value={value.sicredi_pix_multa_modalidade}
                onChange={(v) => onChange({ sicredi_pix_multa_modalidade: v })}
              />
              <NumberField
                label="Multa (valor)"
                value={value.sicredi_pix_multa_valor}
                onChange={(v) => onChange({ sicredi_pix_multa_valor: v })}
              />
              <NumberField
                label="Juros (modalidade)"
                value={value.sicredi_pix_juros_modalidade}
                onChange={(v) => onChange({ sicredi_pix_juros_modalidade: v })}
              />
              <NumberField
                label="Juros (valor)"
                value={value.sicredi_pix_juros_valor}
                onChange={(v) => onChange({ sicredi_pix_juros_valor: v })}
              />
              <NumberField
                label="Desconto (valor)"
                value={value.sicredi_pix_desconto_valor}
                onChange={(v) => onChange({ sicredi_pix_desconto_valor: v })}
              />
              <NumberField
                label="Desconto (dias de antecipação)"
                value={value.sicredi_pix_desconto_dias_antecipacao}
                onChange={(v) => onChange({ sicredi_pix_desconto_dias_antecipacao: v })}
              />
            </div>
          </div>

          <SicrediPixWebhookCard token={token} companyId={company.id} />
        </div>
      </SectionCard>

      <SectionCard title="Sicredi Boleto" subtitle="Credenciais, emissão e regras de cobrança" defaultCollapsed>
        <div className="flex flex-col gap-5">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <TextField
              label="Usuário"
              icon={<LockIcon className="h-4 w-4" />}
              value={value.sicredi_boleto_username ?? ''}
              onChange={(event) => onChange({ sicredi_boleto_username: event.target.value })}
            />
            <TextField
              label="x-api-key"
              icon={<LockIcon className="h-4 w-4" />}
              type="password"
              value={value.sicredi_boleto_x_api_key ?? ''}
              onChange={(event) => onChange({ sicredi_boleto_x_api_key: event.target.value })}
            />
            <TextField
              label="Senha"
              icon={<LockIcon className="h-4 w-4" />}
              type="password"
              value={value.sicredi_boleto_password ?? ''}
              onChange={(event) => onChange({ sicredi_boleto_password: event.target.value })}
            />
            <TextField
              label="Cooperativa"
              icon={<WalletIcon className="h-4 w-4" />}
              value={value.sicredi_boleto_cooperativa ?? ''}
              onChange={(event) => onChange({ sicredi_boleto_cooperativa: event.target.value })}
            />
            <TextField
              label="Posto"
              icon={<WalletIcon className="h-4 w-4" />}
              value={value.sicredi_boleto_posto ?? ''}
              onChange={(event) => onChange({ sicredi_boleto_posto: event.target.value })}
            />
            <TextField
              label="Código do beneficiário"
              icon={<WalletIcon className="h-4 w-4" />}
              value={value.sicredi_boleto_codigo_beneficiario ?? ''}
              onChange={(event) => onChange({ sicredi_boleto_codigo_beneficiario: event.target.value })}
            />
            <SelectField
              label="Tipo de cobrança"
              value={value.sicredi_boleto_tipo_cobranca ?? ''}
              onChange={(event) => onChange({ sicredi_boleto_tipo_cobranca: event.target.value })}
            >
              <option value="">Selecione</option>
              {SICREDI_BOLETO_TIPO_COBRANCA_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>
            <SelectField
              label="Espécie do documento"
              value={value.sicredi_boleto_especie_documento ?? ''}
              onChange={(event) => onChange({ sicredi_boleto_especie_documento: event.target.value })}
            >
              <option value="">Selecione</option>
              {SICREDI_BOLETO_ESPECIE_DOCUMENTO_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>
            <NumberField
              label="Validade após vencimento (dias)"
              value={value.sicredi_boleto_validade_apos_vencimento}
              onChange={(v) => onChange({ sicredi_boleto_validade_apos_vencimento: v })}
            />
          </div>

          <div>
            <h4 className="mb-3 text-[12.5px] font-bold text-[var(--ink)]">Ações após o vencimento</h4>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <SelectField
                label="Negativar / Protestar"
                value={value.sicredi_boleto_negativar_protesto ?? '0'}
                onChange={(event) => onChange({ sicredi_boleto_negativar_protesto: event.target.value })}
              >
                {SICREDI_BOLETO_NEGATIVAR_PROTESTO_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
              {value.sicredi_boleto_negativar_protesto === '1' && (
                <NumberField
                  label="Dias para protesto"
                  value={value.sicredi_boleto_dias_protesto_auto}
                  onChange={(v) => onChange({ sicredi_boleto_dias_protesto_auto: v })}
                />
              )}
              {value.sicredi_boleto_negativar_protesto === '2' && (
                <NumberField
                  label="Dias para negativação"
                  value={value.sicredi_boleto_dias_negativacao_auto}
                  onChange={(v) => onChange({ sicredi_boleto_dias_negativacao_auto: v })}
                />
              )}
            </div>
          </div>

          <div>
            <h4 className="mb-3 text-[12.5px] font-bold text-[var(--ink)]">Juros, multa e desconto</h4>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <SelectField
                label="Tipo de juros"
                value={value.sicredi_boleto_tipo_juros ?? 'VALOR'}
                onChange={(event) => onChange({ sicredi_boleto_tipo_juros: event.target.value })}
              >
                <option value="VALOR">R$ Fixo</option>
                <option value="PERCENTUAL">% Mensal</option>
              </SelectField>
              <NumberField
                label="Juros"
                value={value.sicredi_boleto_juros}
                onChange={(v) => onChange({ sicredi_boleto_juros: v })}
              />
              <SelectField
                label="Período do juros percentual"
                value={value.sicredi_boleto_tipo_juros_percentual ?? ''}
                onChange={(event) => onChange({ sicredi_boleto_tipo_juros_percentual: event.target.value })}
              >
                <option value="">Selecione</option>
                {SICREDI_BOLETO_TIPO_JUROS_PERCENTUAL_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Tipo de multa"
                value={value.sicredi_boleto_tipo_multa ?? 'VALOR'}
                onChange={(event) => onChange({ sicredi_boleto_tipo_multa: event.target.value })}
              >
                <option value="VALOR">R$ Fixo</option>
                <option value="PERCENTUAL">% Única</option>
              </SelectField>
              <NumberField
                label="Multa"
                value={value.sicredi_boleto_multa}
                onChange={(v) => onChange({ sicredi_boleto_multa: v })}
              />
              <SelectField
                label="Tipo de desconto"
                value={value.sicredi_boleto_tipo_desconto ?? 'VALOR'}
                onChange={(event) => onChange({ sicredi_boleto_tipo_desconto: event.target.value })}
              >
                {SICREDI_BOLETO_TIPO_DESCONTO_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
            </div>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              {[1, 2, 3].map((n) => (
                <div key={n} className="grid grid-cols-2 gap-2 rounded-xl bg-[var(--page)] p-3">
                  <NumberField
                    label={`Desconto ${n}: valor`}
                    value={value[`sicredi_boleto_valor_desconto${n}` as keyof ConfigPayload] as number | undefined}
                    onChange={(v) => onChange({ [`sicredi_boleto_valor_desconto${n}`]: v })}
                  />
                  <NumberField
                    label={`Desconto ${n}: dias`}
                    value={value[`sicredi_boleto_dias_desconto${n}` as keyof ConfigPayload] as number | undefined}
                    onChange={(v) => onChange({ [`sicredi_boleto_dias_desconto${n}`]: v })}
                  />
                </div>
              ))}
            </div>
          </div>

          <div>
            <h4 className="mb-3 text-[12.5px] font-bold text-[var(--ink)]">Instruções impressas</h4>
            <div className="grid gap-3 sm:grid-cols-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <TextField
                  key={`informativo${n}`}
                  label={`Informativo ${n}`}
                  icon={<TagIcon className="h-4 w-4" />}
                  value={(value[`sicredi_boleto_informativo${n}` as keyof ConfigPayload] as string) ?? ''}
                  onChange={(event) => onChange({ [`sicredi_boleto_informativo${n}`]: event.target.value })}
                />
              ))}
              {[1, 2, 3, 4].map((n) => (
                <TextField
                  key={`mensagem${n}`}
                  label={`Mensagem ${n}`}
                  icon={<TagIcon className="h-4 w-4" />}
                  value={(value[`sicredi_boleto_mensagem${n}` as keyof ConfigPayload] as string) ?? ''}
                  onChange={(event) => onChange({ [`sicredi_boleto_mensagem${n}`]: event.target.value })}
                />
              ))}
            </div>
          </div>

          <SicrediBoletoWebhookCard token={token} companyId={company.id} />
        </div>
      </SectionCard>
    </div>
  )
}
