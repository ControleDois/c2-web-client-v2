import { useState } from 'react'
import { checkCoraPartnerApp, type ConfigPayload, type CoraPartnerCheck } from '../../lib/config'
import { ApiError } from '../../lib/api'
import { testIfoodCredentials, type IfoodCredentialsCheck } from '../../lib/ifood'
import { SectionCard } from '../../components/SectionCard'
import { TextField } from '../../components/form/TextField'
import { KeyIcon } from '../../components/icons'
import type { AuthSession, AuthCompany } from '../../lib/auth'

interface IntegracoesApisSectionProps {
  value: ConfigPayload
  onChange: (patch: Partial<ConfigPayload>) => void
  session: AuthSession
  company: AuthCompany
}

// Só aparece pra empresa matriz (Controle Dois) - client_id/secret aqui são
// únicos pra toda a plataforma, não por empresa cliente. Cada restaurante
// que usa o Controle Dois autoriza esse MESMO app do iFood (fluxo próprio,
// em "Integrações" dentro de cada empresa).
export function IntegracoesApisSection({ value, onChange, session, company }: IntegracoesApisSectionProps) {
  const [checking, setChecking] = useState(false)
  const [check, setCheck] = useState<IfoodCredentialsCheck | null>(null)
  const [checkError, setCheckError] = useState<string | null>(null)
  const [coraChecking, setCoraChecking] = useState(false)
  const [coraCheck, setCoraCheck] = useState<CoraPartnerCheck | null>(null)
  const [coraCheckError, setCoraCheckError] = useState<string | null>(null)

  async function handleCoraCheck() {
    setCoraChecking(true)
    setCoraCheck(null)
    setCoraCheckError(null)
    try {
      setCoraCheck(await checkCoraPartnerApp(session.token.token, company.id))
    } catch (err) {
      setCoraCheckError(err instanceof ApiError ? err.message : 'Não foi possível testar as credenciais da Cora.')
    } finally {
      setCoraChecking(false)
    }
  }

  async function handleCheck() {
    setChecking(true)
    setCheck(null)
    setCheckError(null)
    try {
      setCheck(await testIfoodCredentials(session.token.token, company.id))
    } catch (err) {
      setCheckError(err instanceof ApiError ? err.message : 'Não foi possível testar as credenciais.')
    } finally {
      setChecking(false)
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <SectionCard title="iFood" subtitle="Credenciais do app centralizado da Controle Dois">
        <div className="flex flex-col gap-4">
          <p className="text-[12px] text-[var(--muted)]">
            Client ID e Client Secret do app registrado no Portal do Desenvolvedor iFood. É um único
            app pra toda a plataforma — cada restaurante autoriza esse mesmo app na tela de
            Integrações da própria empresa, sem precisar ter conta de desenvolvedor.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Client ID (produção)"
              icon={<KeyIcon className="h-4 w-4" />}
              value={value.ifood_client_id ?? ''}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => onChange({ ifood_client_id: event.target.value.trim() })}
            />
            <TextField
              label="Client Secret (produção)"
              icon={<KeyIcon className="h-4 w-4" />}
              type="password"
              value={value.ifood_client_secret ?? ''}
              autoComplete="new-password"
              spellCheck={false}
              onChange={(event) => onChange({ ifood_client_secret: event.target.value.trim() })}
            />
            <TextField
              label="Client ID (teste / homologação)"
              icon={<KeyIcon className="h-4 w-4" />}
              value={value.ifood_test_client_id ?? ''}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => onChange({ ifood_test_client_id: event.target.value.trim() })}
            />
            <TextField
              label="Client Secret (teste / homologação)"
              icon={<KeyIcon className="h-4 w-4" />}
              type="password"
              value={value.ifood_test_client_secret ?? ''}
              autoComplete="new-password"
              spellCheck={false}
              onChange={(event) => onChange({ ifood_test_client_secret: event.target.value.trim() })}
            />
          </div>

          <label
            className={`flex items-start gap-2.5 rounded-xl p-3.5 ${
              value.ifood_use_test ? 'bg-[var(--amber-100)]' : 'bg-[var(--page)]'
            }`}
          >
            <input
              type="checkbox"
              checked={Boolean(value.ifood_use_test)}
              onChange={(event) => onChange({ ifood_use_test: event.target.checked })}
              className="mt-0.5 h-4 w-4 accent-[var(--blue-500)]"
            />
            <span className="text-[13.5px] text-[var(--ink)]">
              <strong>Trabalhar em ambiente de teste (homologação)</strong>
              <br />
              <span className="text-[12px] text-[var(--ink-soft)]">
                Marcado, o sistema usa as credenciais de teste para falar com o iFood. Desmarcado, usa as de produção.
                Vale para todas as empresas, então desmarque assim que terminar os testes.
              </span>
            </span>
          </label>
          {value.ifood_use_test && (
            <p className="text-[12.5px] font-bold text-[var(--amber-500)]">
              Atenção: o sistema está em TESTE. Os pedidos de lojas reais não chegam enquanto isso estiver marcado.
            </p>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleCheck}
                disabled={checking}
                className="rounded-xl px-4 py-2 text-[13px] font-bold text-[var(--blue-500)] ring-1 ring-[var(--blue-300)] hover:bg-[var(--page)] disabled:opacity-60"
              >
                {checking ? 'Testando…' : 'Testar credenciais salvas (do ambiente marcado)'}
              </button>
              <span className="text-[12px] text-[var(--muted)]">Confere o que está salvo (não o que está digitado). Salve antes de testar.</span>
            </div>
            {checkError && <p className="text-[13px] font-medium text-[var(--red-500)]">{checkError}</p>}
            {check && !check.configured && (
              <p className="text-[13px] font-medium text-[var(--red-500)]">Nenhuma credencial salva ainda.</p>
            )}
            {check?.configured && (
              <p className={`text-[13px] font-medium ${check.accepted ? 'text-[var(--green-600)]' : 'text-[var(--red-500)]'}`}>
                Ambiente: <strong>{check.mode === 'test' ? 'teste' : 'produção'}</strong>. Client ID salvo começa com{' '}
                <strong>{check.clientIdStart}</strong>.{' '}
                {check.accepted
                  ? check.merchants.length
                    ? `O iFood aceitou. Lojas que já autorizaram: ${check.merchants.map((merchant) => merchant.name || merchant.id).join(', ')}.`
                    : 'O iFood aceitou as credenciais, mas nenhuma loja autorizou este aplicativo ainda.'
                  : check.error}
              </p>
            )}
          </div>

          <label className="flex items-center gap-2.5">
            <input
              type="checkbox"
              checked={Boolean(value.ifood_webhook_enabled)}
              onChange={(event) => onChange({ ifood_webhook_enabled: event.target.checked })}
              className="h-4 w-4 accent-[var(--blue-500)]"
            />
            <span className="text-[13.5px] font-semibold text-[var(--ink)]">Ativar recebimento de pedidos (webhook)</span>
          </label>

          <p className="text-[11.5px] text-[var(--muted)]">
            URL do webhook a configurar no Portal do Desenvolvedor: <code>https://api.grupoamsfacilita.com.br/connect/ifood/webhook</code>
          </p>
        </div>
      </SectionCard>

      <SectionCard title="Cora (parceria)" subtitle="Aplicativo parceiro da Controle Dois na Cora, usado por todas as empresas">
        <div className="flex flex-col gap-4">
          <p className="text-[12px] text-[var(--muted)]">
            Client ID e Client Secret do aplicativo parceiro que a Cora liberou. As empresas se conectam a ele pelo login
            da própria conta Cora, na tela de Integrações Bancárias. Teste usa o ambiente de testes (stage) da Cora, e
            produção usa o ambiente real.
          </p>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField
              label="Client ID (produção)"
              icon={<KeyIcon className="h-4 w-4" />}
              value={value.cora_partner_client_id ?? ''}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => onChange({ cora_partner_client_id: event.target.value.trim() })}
            />
            <TextField
              label="Client Secret (produção)"
              icon={<KeyIcon className="h-4 w-4" />}
              type="password"
              value={value.cora_partner_client_secret ?? ''}
              autoComplete="new-password"
              spellCheck={false}
              onChange={(event) => onChange({ cora_partner_client_secret: event.target.value.trim() })}
            />
            <TextField
              label="Client ID (teste / stage)"
              icon={<KeyIcon className="h-4 w-4" />}
              value={value.cora_partner_test_client_id ?? ''}
              autoComplete="off"
              spellCheck={false}
              onChange={(event) => onChange({ cora_partner_test_client_id: event.target.value.trim() })}
            />
            <TextField
              label="Client Secret (teste / stage)"
              icon={<KeyIcon className="h-4 w-4" />}
              type="password"
              value={value.cora_partner_test_client_secret ?? ''}
              autoComplete="new-password"
              spellCheck={false}
              onChange={(event) => onChange({ cora_partner_test_client_secret: event.target.value.trim() })}
            />
          </div>

          <label
            className={`flex items-start gap-2.5 rounded-xl p-3.5 ${
              value.cora_partner_use_test ? 'bg-[var(--amber-100)]' : 'bg-[var(--page)]'
            }`}
          >
            <input
              type="checkbox"
              checked={Boolean(value.cora_partner_use_test)}
              onChange={(event) => onChange({ cora_partner_use_test: event.target.checked })}
              className="mt-0.5 h-4 w-4 accent-[var(--blue-500)]"
            />
            <span className="text-[13.5px] text-[var(--ink)]">
              <strong>Trabalhar em ambiente de teste (stage da Cora)</strong>
              <br />
              <span className="text-[12px] text-[var(--ink-soft)]">
                Marcado, o sistema usa as credenciais de teste e a Cora de testes. Desmarcado, usa as de produção. Vale
                para todas as empresas, e as empresas conectadas em um ambiente precisam conectar de novo ao trocar.
              </span>
            </span>
          </label>
          {value.cora_partner_use_test && (
            <p className="text-[12.5px] font-bold text-[var(--amber-500)]">
              Atenção: a Cora está em TESTE. Cobranças e planos não geram dinheiro de verdade enquanto isso estiver marcado.
            </p>
          )}

          <div className="flex flex-col gap-2">
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={handleCoraCheck}
                disabled={coraChecking}
                className="rounded-xl px-4 py-2 text-[13px] font-bold text-[var(--blue-500)] ring-1 ring-[var(--blue-300)] hover:bg-[var(--page)] disabled:opacity-60"
              >
                {coraChecking ? 'Testando…' : 'Testar credenciais salvas (do ambiente marcado)'}
              </button>
              <span className="text-[12px] text-[var(--muted)]">Confere o que está salvo (não o que está digitado). Salve antes de testar.</span>
            </div>
            {coraCheckError && <p className="text-[13px] font-medium text-[var(--red-500)]">{coraCheckError}</p>}
            {coraCheck && !coraCheck.configured && (
              <p className="text-[13px] font-medium text-[var(--red-500)]">
                Nenhuma credencial salva para o ambiente de {coraCheck.mode === 'test' ? 'teste' : 'produção'}.
              </p>
            )}
            {coraCheck?.configured && (
              <p className={`text-[13px] font-medium ${coraCheck.accepted ? 'text-[var(--green-600)]' : 'text-[var(--red-500)]'}`}>
                Ambiente: <strong>{coraCheck.mode === 'test' ? 'teste (stage)' : 'produção'}</strong>. Client ID salvo começa com{' '}
                <strong>{coraCheck.clientIdStart}</strong>. {coraCheck.accepted ? 'A Cora aceitou o aplicativo.' : coraCheck.error}
              </p>
            )}
          </div>
        </div>
      </SectionCard>
    </div>
  )
}
