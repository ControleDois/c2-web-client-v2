import { useEffect, useState } from 'react'
import type { ConfigPayload, ConfigRecord, ProtectionTrackerUser } from '../../lib/config'
import { fetchTaskBoards, type TaskBoardRecord } from '../../lib/taskBoards'
import { fetchCompanyWhatsapps, type CompanyWhatsappRecord } from '../../lib/companyWhatsapp'
import { fetchUsers, type UserRecord } from '../../lib/users'
import { formatPhone } from '../../lib/formatPhone'
import { TextField } from '../../components/form/TextField'
import { SearchSelectField } from '../../components/form/SearchSelectField'
import { CheckCircleIcon, ClockIcon, TrashIcon, UserIcon } from '../../components/icons'
import type { AuthSession, AuthCompany } from '../../lib/auth'

interface ProtecaoVeicularSectionProps {
  value: ConfigPayload
  onChange: (patch: Partial<ConfigPayload>) => void
  config: ConfigRecord | null
  session: AuthSession
  company: AuthCompany
}

const PROTECTION_VARIABLES = ['{{usuario_nome}}', '{{cliente_nome}}', '{{veiculo}}', '{{placa}}', '{{contrato_codigo}}', '{{prazo}}']

function defaultMessage(): string {
  return (
    `Olá, {{usuario_nome}}.\n\n` +
    `Foi cancelado um contrato de proteção veicular com rastreador e uma tarefa de retirada foi criada.\n\n` +
    `*Associado:* {{cliente_nome}}\n` +
    `*Veículo:* {{veiculo}}\n` +
    `*Placa:* {{placa}}\n` +
    `*Contrato:* {{contrato_codigo}}\n` +
    `*Prazo:* {{prazo}}\n\n` +
    `Acesse o quadro de tarefas para acompanhar a retirada.`
  )
}

export function ProtecaoVeicularSection({ value, onChange, config, session, company }: ProtecaoVeicularSectionProps) {
  const [boardLabel, setBoardLabel] = useState<string | null>(null)
  const [whatsappLabel, setWhatsappLabel] = useState<string | null>(null)
  const [copiedVariable, setCopiedVariable] = useState<string | null>(null)

  useEffect(() => {
    setBoardLabel(config?.protection_cancel_tracker_task_board?.title ?? null)
    setWhatsappLabel(config?.protection_cancel_tracker_task_whatsapp?.name ?? null)
  }, [config])

  const users = value.protection_cancel_tracker_task_users ?? []

  function addUser(user: UserRecord) {
    if (users.some((item) => item.user_id === user.id)) return
    const next: ProtectionTrackerUser[] = [
      ...users,
      { user_id: user.id, name: user.name, phone: '', email: user.user?.email ?? '' },
    ]
    onChange({ protection_cancel_tracker_task_users: next })
  }

  function removeUser(userId: string) {
    onChange({ protection_cancel_tracker_task_users: users.filter((item) => item.user_id !== userId) })
  }

  function copyVariable(variable: string) {
    navigator.clipboard.writeText(variable).then(() => {
      setCopiedVariable(variable)
      setTimeout(() => setCopiedVariable(null), 1500)
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <label className="flex items-center gap-2.5">
        <input
          type="checkbox"
          checked={Boolean(value.protection_cancel_tracker_task_enabled)}
          onChange={(event) => onChange({ protection_cancel_tracker_task_enabled: event.target.checked })}
          className="h-4 w-4 accent-[var(--blue-500)]"
        />
        <span className="text-[13.5px] font-semibold text-[var(--ink)]">
          Criar tarefa de retirada ao cancelar contrato com rastreador
        </span>
      </label>

      <div className="grid gap-4 sm:grid-cols-2">
        <SearchSelectField
          label="Quadro de tarefas"
          placeholder="Buscar quadro"
          selectedLabel={boardLabel}
          onSearch={(query) => fetchTaskBoards(session.token.token, company.id, { search: query }).then((res) => res.data)}
          getOptionLabel={(item: TaskBoardRecord) => item.title}
          onSelect={(item: TaskBoardRecord) => {
            setBoardLabel(item.title)
            onChange({ protection_cancel_tracker_task_board_id: item.id })
          }}
          onClear={() => {
            setBoardLabel(null)
            onChange({ protection_cancel_tracker_task_board_id: undefined })
          }}
        />
        <TextField
          label="Prazo (dias)"
          icon={<ClockIcon className="h-4 w-4" />}
          type="number"
          value={value.protection_cancel_tracker_task_due_days ?? ''}
          onChange={(event) => onChange({ protection_cancel_tracker_task_due_days: Number(event.target.value) })}
        />
      </div>

      <label className="flex items-center gap-2.5">
        <input
          type="checkbox"
          checked={Boolean(value.protection_cancel_tracker_task_send_whatsapp)}
          onChange={(event) => onChange({ protection_cancel_tracker_task_send_whatsapp: event.target.checked })}
          className="h-4 w-4 accent-[var(--blue-500)]"
        />
        <span className="text-[13.5px] font-semibold text-[var(--ink)]">Enviar aviso via WhatsApp</span>
      </label>

      {value.protection_cancel_tracker_task_send_whatsapp && (
        <SearchSelectField
          label="Número de WhatsApp"
          placeholder="Buscar número"
          selectedLabel={whatsappLabel}
          onSearch={(query) =>
            fetchCompanyWhatsapps(session.token.token, company.id, { search: query }).then((res) => res.data)
          }
          getOptionLabel={(item: CompanyWhatsappRecord) => item.name}
          getOptionSubLabel={(item: CompanyWhatsappRecord) => formatPhone(item.phone)}
          onSelect={(item: CompanyWhatsappRecord) => {
            setWhatsappLabel(item.name)
            onChange({ protection_cancel_tracker_task_whatsapp_id: item.id })
          }}
          onClear={() => {
            setWhatsappLabel(null)
            onChange({ protection_cancel_tracker_task_whatsapp_id: undefined })
          }}
        />
      )}

      <div>
        <h3 className="mb-2 text-[13px] font-bold text-[var(--ink)]">Responsáveis</h3>
        <SearchSelectField
          label="Adicionar responsável"
          placeholder="Buscar por nome"
          selectedLabel={null}
          onSearch={(query) => fetchUsers(session.token.token, company.id, { search: query }).then((res) => res.data)}
          getOptionLabel={(item: UserRecord) => item.name}
          onSelect={(item: UserRecord) => addUser(item)}
          onClear={() => {}}
        />
        {users.length > 0 && (
          <div className="mt-3 flex flex-col gap-2">
            {users.map((user) => (
              <div
                key={user.user_id}
                className="flex items-center gap-3 rounded-xl bg-[var(--page)] px-4 py-2.5"
              >
                <UserIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[var(--ink)]">{user.name}</span>
                <button
                  type="button"
                  onClick={() => removeUser(user.user_id)}
                  className="flex-none rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--red-100)] hover:text-[var(--red-500)]"
                  aria-label="Remover responsável"
                >
                  <TrashIcon className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      <div>
        <div className="mb-2 flex flex-wrap items-center justify-between gap-3">
          <h3 className="text-[13px] font-bold text-[var(--ink)]">Mensagem de aviso</h3>
          <button
            type="button"
            onClick={() => onChange({ protection_cancel_tracker_task_message: defaultMessage() })}
            className="rounded-xl border border-[var(--border)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]"
          >
            Restaurar padrão
          </button>
        </div>
        <div className="mb-2 flex flex-wrap gap-1.5">
          {PROTECTION_VARIABLES.map((variable) => (
            <button
              key={variable}
              type="button"
              onClick={() => copyVariable(variable)}
              className="flex items-center gap-1 rounded-full bg-[var(--blue-100)] px-2.5 py-1 text-[11.5px] font-mono font-semibold text-[var(--blue-700)] hover:bg-[var(--blue-300)]"
            >
              {copiedVariable === variable ? <CheckCircleIcon className="h-3 w-3" /> : null}
              {variable}
            </button>
          ))}
        </div>
        <textarea
          value={value.protection_cancel_tracker_task_message ?? ''}
          onChange={(event) => onChange({ protection_cancel_tracker_task_message: event.target.value })}
          rows={7}
          className="w-full resize-none rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
        />
      </div>
    </div>
  )
}
