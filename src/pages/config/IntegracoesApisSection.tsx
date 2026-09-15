import type { ConfigPayload } from '../../lib/config'
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
export function IntegracoesApisSection({ value, onChange }: IntegracoesApisSectionProps) {
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
              label="Client ID"
              icon={<KeyIcon className="h-4 w-4" />}
              value={value.ifood_client_id ?? ''}
              onChange={(event) => onChange({ ifood_client_id: event.target.value })}
            />
            <TextField
              label="Client Secret"
              icon={<KeyIcon className="h-4 w-4" />}
              type="password"
              value={value.ifood_client_secret ?? ''}
              onChange={(event) => onChange({ ifood_client_secret: event.target.value })}
            />
          </div>
          <p className="text-[11.5px] text-[var(--muted)]">
            URL do webhook a configurar no Portal do Desenvolvedor: <code>https://api.grupoamsfacilita.com.br/connect/ifood/webhook</code>
          </p>
        </div>
      </SectionCard>
    </div>
  )
}
