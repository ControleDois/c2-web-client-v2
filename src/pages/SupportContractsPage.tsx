import { useEffect, useState } from 'react'
import {
  fetchSupportContracts,
  deleteSupportContract,
  updateSupportContract,
  SUPPORT_CONTRACT_STATUS_LABELS,
  type SupportContractRecord,
} from '../lib/supportContracts'
import { ApiError } from '../lib/api'
import { formatCurrency, formatDate } from '../lib/format'
import {
  SearchIcon,
  PlusIcon,
  PencilIcon,
  TrashIcon,
  XCircleIcon,
  PrinterIcon,
  WhatsappIcon,
  CameraIcon,
} from '../components/icons'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { RowActionsMenu, type RowAction } from '../components/RowActionsMenu'
import { SupportContractPreviewModal } from '../components/SupportContractPreviewModal'
import { SupportContractSendModal } from '../components/SupportContractSendModal'
import { SupportContractSignatureModal } from '../components/SupportContractSignatureModal'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface SupportContractsPageProps {
  session: AuthSession
  company: AuthCompany
  onCreate: () => void
  onEdit: (contract: SupportContractRecord) => void
}

function statusTone(status: number): string {
  return status === 1 ? 'bg-[var(--page)] text-[var(--muted)]' : 'bg-[var(--green-100)] text-[var(--green-600)]'
}

export function SupportContractsPage({ session, company, onCreate, onEdit }: SupportContractsPageProps) {
  const token = session.token.token
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [items, setItems] = useState<SupportContractRecord[]>([])
  const [meta, setMeta] = useState({ total: 0, lastPage: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [cancelTarget, setCancelTarget] = useState<SupportContractRecord | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<SupportContractRecord | null>(null)
  const [contractTarget, setContractTarget] = useState<SupportContractRecord | null>(null)
  const [sendContractTarget, setSendContractTarget] = useState<SupportContractRecord | null>(null)
  const [signatureTarget, setSignatureTarget] = useState<SupportContractRecord | null>(null)
  const [busy, setBusy] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [feedback, setFeedback] = useState<string | null>(null)

  function load() {
    setLoading(true)
    setError(null)
    fetchSupportContracts(token, company.id, { search: search || undefined, page, limit: 10 })
      .then((res) => {
        setItems(res.data)
        setMeta({ total: res.meta?.total ?? res.data.length, lastPage: res.meta?.last_page ?? 1 })
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os contratos.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [token, company.id, search, page])

  async function handleCancel() {
    if (!cancelTarget) return
    setBusy(true)
    setActionError(null)
    try {
      await updateSupportContract(token, cancelTarget.id, { status: 1 })
      setCancelTarget(null)
      load()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Não foi possível cancelar o contrato.')
    } finally {
      setBusy(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setBusy(true)
    setActionError(null)
    try {
      await deleteSupportContract(token, deleteTarget.id)
      setDeleteTarget(null)
      load()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Não foi possível excluir o contrato.')
    } finally {
      setBusy(false)
    }
  }

  function buildActions(contract: SupportContractRecord): RowAction[] {
    const actions: RowAction[] = [
      { key: 'edit', label: 'Editar', icon: <PencilIcon className="h-4 w-4" />, onClick: () => onEdit(contract) },
      {
        key: 'contract',
        label: 'Visualizar contrato',
        icon: <PrinterIcon className="h-4 w-4" />,
        onClick: () => setContractTarget(contract),
      },
      {
        key: 'send-contract',
        label: 'Contrato e envio',
        icon: <WhatsappIcon className="h-4 w-4" />,
        onClick: () => setSendContractTarget(contract),
      },
    ]
    if (contract.meta?.signed) {
      actions.push({
        key: 'signature-evidence',
        label: 'Facial e assinatura',
        icon: <CameraIcon className="h-4 w-4" />,
        onClick: () => setSignatureTarget(contract),
      })
    }
    if (contract.status === 0) {
      actions.push({
        key: 'cancel',
        label: 'Cancelar contrato',
        icon: <XCircleIcon className="h-4 w-4" />,
        tone: 'warning',
        onClick: () => setCancelTarget(contract),
      })
    }
    actions.push({
      key: 'delete',
      label: 'Excluir',
      icon: <TrashIcon className="h-4 w-4" />,
      tone: 'danger',
      dividerBefore: true,
      onClick: () => setDeleteTarget(contract),
    })
    return actions
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Suporte Técnico</p>
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Contratos de Suporte</h1>
        </div>
        <button
          type="button"
          onClick={onCreate}
          className="flex items-center gap-2 rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)]"
        >
          <PlusIcon className="h-4 w-4" />
          Novo Contrato
        </button>
      </div>

      <div className="flex min-w-[240px] items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
        <SearchIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
        <input
          type="text"
          placeholder="Buscar por cliente"
          value={search}
          onChange={(event) => {
            setPage(1)
            setSearch(event.target.value)
          }}
          className="w-full bg-transparent text-[13.5px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
        />
      </div>

      {error && (
        <div className="rounded-2xl bg-[var(--red-100)] p-4 text-[13.5px] font-medium text-[var(--red-500)]">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        {loading ? (
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-11 animate-pulse rounded-xl bg-[var(--page)]" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-[13.5px] text-[var(--muted)]">
            Nenhum contrato de suporte encontrado{search ? ` para "${search}"` : ''}.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2.5 sm:hidden">
              {items.map((contract) => (
                <div key={contract.id} className="rounded-xl border border-[var(--border)] p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <p className="min-w-0 truncate text-[13.5px] font-bold text-[var(--ink)]">
                        {contract.people?.name ?? '—'}
                      </p>
                      <p className="mt-0.5 text-[12px] text-[var(--muted)]">
                        {contract.title} · vence dia {contract.billing_day}
                      </p>
                      <p className="mt-0.5 text-[12px] text-[var(--ink-soft)]">
                        desde {formatDate(contract.start_date)}
                      </p>
                    </div>
                    <div className="flex flex-none items-start gap-1.5">
                      <div className="flex flex-col items-end gap-1.5">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold ${statusTone(contract.status)}`}
                        >
                          {SUPPORT_CONTRACT_STATUS_LABELS[contract.status] ?? '—'}
                        </span>
                        <span className="text-[13.5px] font-bold text-[var(--ink)]">
                          {formatCurrency(Number(contract.monthly_value))}
                        </span>
                      </div>
                      <RowActionsMenu actions={buildActions(contract)} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                    <th className="pb-2.5 pl-3">Cliente</th>
                    <th className="pb-2.5">Contrato</th>
                    <th className="pb-2.5">Vencimento</th>
                    <th className="pb-2.5">Início</th>
                    <th className="pb-2.5 text-right">Valor mensal</th>
                    <th className="pb-2.5">Status</th>
                    <th className="pb-2.5 pr-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((contract, index) => (
                    <tr
                      key={contract.id}
                      className={`border-b border-[var(--border)] transition-colors last:border-none hover:bg-[var(--blue-100)] ${
                        index % 2 === 1 ? 'bg-[var(--page)]' : ''
                      }`}
                    >
                      <td className="py-2.5 pl-3 font-medium text-[var(--ink)]">{contract.people?.name ?? '—'}</td>
                      <td className="py-2.5 text-[var(--ink-soft)]">{contract.title}</td>
                      <td className="py-2.5 text-[var(--ink-soft)]">Dia {contract.billing_day}</td>
                      <td className="py-2.5 whitespace-nowrap text-[var(--ink-soft)]">
                        {formatDate(contract.start_date)}
                      </td>
                      <td className="py-2.5 text-right font-mono font-semibold text-[var(--ink)]">
                        {formatCurrency(Number(contract.monthly_value))}
                      </td>
                      <td className="py-2.5">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${statusTone(contract.status)}`}
                        >
                          {SUPPORT_CONTRACT_STATUS_LABELS[contract.status] ?? '—'}
                        </span>
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        <RowActionsMenu actions={buildActions(contract)} />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!loading && meta.lastPage > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-[12px] text-[var(--muted)]">{meta.total} contratos no total</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--ink-soft)] disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="text-[12.5px] text-[var(--ink-soft)]">
                {page} / {meta.lastPage}
              </span>
              <button
                type="button"
                disabled={page >= meta.lastPage}
                onClick={() => setPage((p) => Math.min(meta.lastPage, p + 1))}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--ink-soft)] disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Cancelar contrato"
        message={`As parcelas futuras ainda pendentes de "${cancelTarget?.people?.name ?? ''}" serão removidas de Contas a Receber. Parcelas já pagas ou vencidas não são afetadas.`}
        confirmLabel="Cancelar contrato"
        loading={busy}
        onConfirm={handleCancel}
        onCancel={() => setCancelTarget(null)}
      />

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Excluir contrato"
        message={`Tem certeza que deseja excluir o contrato de "${deleteTarget?.people?.name ?? ''}"? As parcelas pendentes também serão removidas.`}
        confirmLabel="Excluir"
        loading={busy}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />

      <SupportContractPreviewModal
        open={Boolean(contractTarget)}
        session={session}
        company={company}
        contract={contractTarget}
        onClose={() => setContractTarget(null)}
      />

      <SupportContractSignatureModal
        open={Boolean(signatureTarget)}
        session={session}
        contract={signatureTarget}
        onClose={() => setSignatureTarget(null)}
      />

      <SupportContractSendModal
        open={Boolean(sendContractTarget)}
        session={session}
        company={company}
        contract={sendContractTarget}
        onClose={() => setSendContractTarget(null)}
        onSent={(message) => {
          setFeedback(message)
          setTimeout(() => setFeedback(null), 4000)
          load()
        }}
      />

      {actionError && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-[var(--red-500)] px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg">
          {actionError}
        </div>
      )}

      {feedback && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-[var(--green-600)] px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg">
          {feedback}
        </div>
      )}
    </div>
  )
}
