import type { ConfigPayload, CompanyTerminalPayload } from '../../lib/config'
import { SectionCard } from '../../components/SectionCard'
import { TextField } from '../../components/form/TextField'
import { PlusIcon, TrashIcon, LinkIcon, TagIcon, BuildingIcon } from '../../components/icons'

interface TerminaisSectionProps {
  value: ConfigPayload
  onChange: (patch: Partial<ConfigPayload>) => void
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: (value: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 flex-none rounded-full transition ${checked ? 'bg-[var(--blue-500)]' : 'bg-[var(--border)]'}`}
    >
      <span
        className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition ${checked ? 'left-5.5' : 'left-0.5'}`}
      />
    </button>
  )
}

// Terminal = um PDV físico (caixa, balcão). O operador escolhe um desses ao
// entrar no PDV web; se ele tiver um "Link do servidor local" configurado
// (um c2-delphi-server rodando na máquina do cliente), a emissão da
// NF-e/NFC-e passa a usar esse link em vez do servidor padrão - mais rápido
// e independe da internet do estabelecimento cair. O cadastro completo
// (impressora, certificado, TEF, balança) desse mesmo terminal é legado do
// sistema desktop e não tem tela própria - só o que o PDV web usa fica aqui.
export function TerminaisSection({ value, onChange }: TerminaisSectionProps) {
  const terminals = value.terminals ?? []

  function update(index: number, patch: Partial<CompanyTerminalPayload>) {
    const next = terminals.map((terminal, i) => (i === index ? { ...terminal, ...patch } : terminal))
    onChange({ terminals: next })
  }

  function remove(index: number) {
    onChange({ terminals: terminals.filter((_, i) => i !== index) })
  }

  function add() {
    onChange({
      terminals: [...terminals, { name: `Terminal ${terminals.length + 1}`, active: true }],
    })
  }

  return (
    <SectionCard
      title="Terminais (PDV)"
      subtitle="Cada caixa/balcão que usa o PDV web - o operador escolhe um ao entrar"
    >
      <div className="flex flex-col gap-3">
        {terminals.length === 0 && (
          <p className="rounded-xl bg-[var(--page)] px-4 py-6 text-center text-[12.5px] text-[var(--muted)]">
            Nenhum terminal cadastrado. Sem terminais, o PDV web usa direto o servidor padrão pra todo mundo.
          </p>
        )}

        {terminals.map((terminal, index) => (
          <div key={terminal.id ?? `new-${index}`} className="rounded-2xl border border-[var(--border)] p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="grid flex-1 grid-cols-1 gap-3 sm:grid-cols-2">
                <TextField
                  label="Nome do terminal"
                  icon={<TagIcon className="h-4 w-4" />}
                  value={terminal.name}
                  onChange={(event) => update(index, { name: event.target.value })}
                  placeholder="Caixa 1"
                />
                <TextField
                  label="Link do servidor local (opcional)"
                  icon={<LinkIcon className="h-4 w-4" />}
                  value={terminal.api_url ?? ''}
                  onChange={(event) => update(index, { api_url: event.target.value })}
                  placeholder="http://192.168.0.50:8080"
                />
              </div>
              <button
                type="button"
                onClick={() => remove(index)}
                className="flex h-9 w-9 flex-none items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--red-100)] hover:text-[var(--red-500)]"
                title="Remover terminal"
              >
                <TrashIcon className="h-4 w-4" />
              </button>
            </div>
            <p className="mt-1.5 text-[11px] text-[var(--muted)]">
              Deixe em branco pra esse terminal usar o servidor padrão da empresa. Preencha só se houver um
              c2-delphi-server rodando na máquina/rede desse caixa.
            </p>
            <div className="mt-3 flex items-center justify-between rounded-xl bg-[var(--page)] px-3.5 py-2.5">
              <span className="text-[12.5px] font-semibold text-[var(--ink)]">Terminal ativo</span>
              <Toggle checked={terminal.active} onChange={(active) => update(index, { active })} />
            </div>
          </div>
        ))}

        <button
          type="button"
          onClick={add}
          className="flex items-center justify-center gap-2 rounded-xl border border-dashed border-[var(--border)] py-2.5 text-[12.5px] font-bold text-[var(--ink-soft)] hover:border-[var(--blue-300)] hover:text-[var(--blue-700)]"
        >
          <PlusIcon className="h-3.5 w-3.5" />
          Adicionar terminal
        </button>

        <p className="flex items-start gap-2 rounded-xl bg-[var(--blue-100)] px-3.5 py-2.5 text-[11.5px] text-[var(--blue-700)]">
          <BuildingIcon className="mt-0.5 h-3.5 w-3.5 flex-none" />
          Impressora, certificado, TEF e balança de cada terminal continuam configurados no sistema desktop -
          aqui só o essencial pro PDV web saber qual terminal está sendo usado e pra onde mandar a nota.
        </p>
      </div>
    </SectionCard>
  )
}
