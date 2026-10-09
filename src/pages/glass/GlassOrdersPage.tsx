import { useState } from 'react'
import {
  changeGlassOrderStatus,
  deleteGlassOrder,
  duplicateGlassOrder,
  fetchGlassOrders,
  GLASS_ORDER_STATUS,
  GLASS_ORDER_STATUS_LABELS,
  type GlassOrderRecord,
} from '../../lib/glass'
import { ApiError } from '../../lib/api'
import { formatCurrency, formatDate } from '../../lib/format'
import { GlassList } from './GlassList'
import { SelectField } from '../../components/form/SelectField'
import { type RowAction } from '../../components/RowActionsMenu'
import { GlassContractModals, type GlassContractTarget } from './GlassContractModals'
import { GlassCutListModal } from './GlassCutListModal'
import { GlassInvoiceModal } from './GlassInvoiceModal'
import { GlassMemoryModal } from './GlassMemoryModal'
import { GlassQuoteModal } from './GlassQuoteModal'
import { NFE_STATUS_LABELS } from '../../lib/nfes'
import { GlassAppointmentModal, type GlassAppointmentDraft } from './GlassAppointmentModal'
import {
  PencilIcon,
  TrashIcon,
  CopyIcon,
  CheckCircleIcon,
  CloseIcon,
  FileTextIcon,
  WhatsappIcon,
  ClockIcon,
  ClipboardCheckIcon,
  CalendarIcon,
} from '../../components/icons'
import type { AuthCompany, AuthSession } from '../../lib/auth'

interface GlassOrdersPageProps {
  session: AuthSession
  company: AuthCompany
  onCreate: () => void
  onEdit: (item: GlassOrderRecord) => void
}

const STATUS_TONES: Record<number, string> = {
  0: 'bg-[var(--page)] text-[var(--ink-soft)]',
  1: 'bg-[var(--blue-100)] text-[var(--blue-700)]',
  2: 'bg-[var(--amber-100)] text-[var(--amber-500)]',
  3: 'bg-[var(--blue-100)] text-[var(--blue-700)]',
  4: 'bg-[var(--blue-100)] text-[var(--blue-700)]',
  5: 'bg-[var(--blue-100)] text-[var(--blue-700)]',
  8: 'bg-[var(--red-100)] text-[var(--red-500)]',
}

// Próximo passo do fluxo: Orçamento → Venda → Produção → Pronto → Instalado → Faturado.
const NEXT_STEP: Record<number, { status: number; label: string } | undefined> = {
  0: { status: GLASS_ORDER_STATUS.SALE, label: 'Aprovar venda' },
  1: { status: GLASS_ORDER_STATUS.PRODUCTION, label: 'Iniciar produção' },
  2: { status: GLASS_ORDER_STATUS.READY, label: 'Marcar como pronto' },
  3: { status: GLASS_ORDER_STATUS.INSTALLED, label: 'Marcar como instalado' },
  4: { status: GLASS_ORDER_STATUS.INVOICED, label: 'Marcar como faturado' },
}

export function GlassStatusBadge({ status }: { status: number }) {
  return (
    <span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${STATUS_TONES[status] ?? STATUS_TONES[0]}`}>
      {GLASS_ORDER_STATUS_LABELS[status] ?? status}
    </span>
  )
}

export function GlassOrdersPage({ session, company, onCreate, onEdit }: GlassOrdersPageProps) {
  const token = session.token.token
  const [status, setStatus] = useState('')
  const [cancelTarget, setCancelTarget] = useState<{ order: GlassOrderRecord; reload: () => void } | null>(null)
  const [cancelReason, setCancelReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [contractTarget, setContractTarget] = useState<GlassContractTarget | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [memoryOrder, setMemoryOrder] = useState<GlassOrderRecord | null>(null)
  const [quoteOrder, setQuoteOrder] = useState<GlassOrderRecord | null>(null)
  const [invoiceOrder, setInvoiceOrder] = useState<GlassOrderRecord | null>(null)
  const [cutListOrder, setCutListOrder] = useState<GlassOrderRecord | null>(null)
  const [appointmentDraft, setAppointmentDraft] = useState<GlassAppointmentDraft | null>(null)

  async function run(action: () => Promise<unknown>, reload: () => void) {
    setMessage(null)
    try {
      await action()
      reload()
    } catch (err) {
      setMessage(err instanceof ApiError ? err.message : 'Não foi possível concluir a ação.')
    }
  }

  async function confirmCancel() {
    if (!cancelTarget) return
    setBusy(true)
    await run(
      () => changeGlassOrderStatus(token, cancelTarget.order.id, GLASS_ORDER_STATUS.CANCELED, cancelReason.trim()),
      cancelTarget.reload
    )
    setBusy(false)
    setCancelTarget(null)
    setCancelReason('')
  }

  return (
    <>
      <GlassList<GlassOrderRecord>
        eyebrow="Vidraçaria"
        title="Orçamentos e Vendas"
        newLabel="Novo orçamento"
        searchPlaceholder="Buscar por cliente, referência ou número"
        emptyLabel="Nenhum orçamento encontrado"
        filterKey={`${status}:${reloadToken}`}
        filters={
          <div className="min-w-[180px]">
            <SelectField label="" variant="surface" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Todos os status</option>
              {Object.entries(GLASS_ORDER_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
          </div>
        }
        fetchPage={(search, page) => fetchGlassOrders(token, company.id, { search, page, limit: 10, status })}
        columns={[
          { header: 'Nº', render: (item) => <span className="font-mono text-[var(--ink-soft)]">#{item.code}</span> },
          { header: 'Cliente', render: (item) => <span className="font-medium text-[var(--ink)]">{item.people?.name ?? '—'}</span> },
          { header: 'Referência', render: (item) => <span className="text-[var(--ink-soft)]">{item.reference || '—'}</span> },
          { header: 'Data', render: (item) => <span className="text-[var(--ink-soft)]">{formatDate(item.created_at)}</span> },
          { header: 'Status', render: (item) => <GlassStatusBadge status={item.status} /> },
          {
            header: 'Contrato',
            render: (item) => {
              const contract = item.meta?.contract
              if (!contract) return <span className="text-[var(--muted)]">Não enviado</span>
              return contract.status === 2 ? (
                <span className="font-semibold text-[var(--green-600)]">Assinado</span>
              ) : (
                <span className="text-[var(--amber-500)]">Aguardando assinatura</span>
              )
            },
          },
          {
            header: 'NF-e',
            render: (item) => {
              const nfe = item.meta?.nfe
              if (!nfe) return <span className="text-[var(--muted)]">—</span>
              return (
                <span className={nfe.status === 2 ? 'font-semibold text-[var(--green-600)]' : 'text-[var(--ink-soft)]'}>
                  {NFE_STATUS_LABELS[nfe.status] ?? nfe.status}
                  {nfe.numero ? ` nº ${nfe.numero}` : ''}
                </span>
              )
            },
          },
          { header: 'Total', align: 'right', render: (item) => <span className="font-semibold">{formatCurrency(item.total)}</span> },
        ]}
        cardTitle={(item) => `#${item.code} · ${item.people?.name ?? 'Sem cliente'}`}
        cardSubtitle={(item) => (
          <span className="flex items-center gap-2">
            <GlassStatusBadge status={item.status} />
            {formatCurrency(item.total)}
          </span>
        )}
        onCreate={onCreate}
        actions={(item, { reload, askDelete }) => {
          const next = NEXT_STEP[item.status]
          const list: RowAction[] = [
            { key: 'edit', label: 'Editar', icon: <PencilIcon className="h-4 w-4" />, onClick: () => onEdit(item) },
            {
              key: 'duplicate',
              label: 'Duplicar',
              icon: <CopyIcon className="h-4 w-4" />,
              onClick: () => run(() => duplicateGlassOrder(token, item.id), reload),
            },
          ]
          list.push({
            key: 'quote',
            label: 'Imprimir / enviar orçamento',
            icon: <FileTextIcon className="h-4 w-4" />,
            dividerBefore: true,
            onClick: () => setQuoteOrder(item),
          })
          const hasContract = Boolean(item.meta?.contract)
          const openContract = (mode: GlassContractTarget['mode']) => setContractTarget({ mode, order: item })
          list.push(
            {
              key: 'contract-preview',
              label: 'Ver contrato',
              icon: <FileTextIcon className="h-4 w-4" />,
              onClick: () => openContract('preview'),
            },
            {
              key: 'contract-send',
              label: hasContract ? 'Reenviar contrato' : 'Enviar contrato',
              icon: <WhatsappIcon className="h-4 w-4" />,
              onClick: () => openContract('send'),
            }
          )
          if (hasContract) {
            list.push(
              {
                key: 'contract-timeline',
                label: 'Detalhes do envio',
                icon: <ClockIcon className="h-4 w-4" />,
                onClick: () => openContract('timeline'),
              },
              {
                key: 'contract-evidence',
                label: 'Facial e assinatura',
                icon: <ClipboardCheckIcon className="h-4 w-4" />,
                onClick: () => openContract('evidence'),
              }
            )
          }
          list.push({
            key: 'memory',
            label: 'Memória de cálculo',
            icon: <ClipboardCheckIcon className="h-4 w-4" />,
            onClick: () => setMemoryOrder(item),
          })
          if (item.status !== GLASS_ORDER_STATUS.CANCELED) {
            list.push({
              key: 'schedule',
              label: 'Agendar visita',
              icon: <CalendarIcon className="h-4 w-4" />,
              onClick: () =>
                setAppointmentDraft({
                  order: item,
                  type: item.status >= GLASS_ORDER_STATUS.SALE ? 'instalacao' : 'medicao',
                }),
            })
          }
          if (item.status >= GLASS_ORDER_STATUS.SALE && item.status !== GLASS_ORDER_STATUS.CANCELED) {
            list.push({
              key: 'cut-list',
              label: 'Lista de corte',
              icon: <ClipboardCheckIcon className="h-4 w-4" />,
              onClick: () => setCutListOrder(item),
            })
          }
          if (item.status >= GLASS_ORDER_STATUS.SALE && item.status !== GLASS_ORDER_STATUS.CANCELED) {
            const nfeStatus = item.meta?.nfe?.status
            if (nfeStatus === undefined || nfeStatus === 0 || nfeStatus === 3) {
              list.push({
                key: 'invoice',
                label: nfeStatus === undefined ? 'Emitir NF-e' : 'Gerar NF-e novamente',
                icon: <FileTextIcon className="h-4 w-4" />,
                onClick: () => setInvoiceOrder(item),
              })
            }
          }
          if (next) {
            list.push({
              key: 'next',
              label: next.label,
              icon: <CheckCircleIcon className="h-4 w-4" />,
              dividerBefore: true,
              onClick: () => run(() => changeGlassOrderStatus(token, item.id, next.status), reload),
            })
          }
          if (item.status !== GLASS_ORDER_STATUS.CANCELED && item.status < GLASS_ORDER_STATUS.INVOICED) {
            list.push({
              key: 'cancel',
              label: 'Cancelar',
              icon: <CloseIcon className="h-4 w-4" />,
              tone: 'warning',
              onClick: () => setCancelTarget({ order: item, reload }),
            })
          }
          list.push({
            key: 'delete',
            label: 'Excluir',
            icon: <TrashIcon className="h-4 w-4" />,
            tone: 'danger',
            dividerBefore: true,
            onClick: () => askDelete(item),
          })
          return list
        }}
        deleteItem={(item) => deleteGlassOrder(token, item.id)}
        deleteTitle="Excluir orçamento"
        deleteLabel={(item) => `Orçamento #${item.code}`}
      />

      {cancelTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setCancelTarget(null)}>
          <div
            className="w-full max-w-[420px] rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-[16px] font-bold text-[var(--ink)]">Cancelar orçamento #{cancelTarget.order.code}</h2>
            <p className="mt-1 text-[13px] text-[var(--ink-soft)]">Informe o motivo para ficar no histórico.</p>
            <textarea
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              rows={3}
              className="mt-3 w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] focus:outline-none"
              placeholder="Ex: cliente fechou com outra empresa"
            />
            <div className="mt-4 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setCancelTarget(null)}
                className="rounded-xl px-4 py-2 text-[13.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
              >
                Voltar
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={confirmCancel}
                className="rounded-xl bg-[var(--red-500)] px-5 py-2 text-[13.5px] font-bold text-white disabled:opacity-60"
              >
                {busy ? 'Cancelando…' : 'Cancelar orçamento'}
              </button>
            </div>
          </div>
        </div>
      )}

      <GlassAppointmentModal
        open={Boolean(appointmentDraft)}
        session={session}
        company={company}
        draft={appointmentDraft}
        onClose={() => setAppointmentDraft(null)}
        onChanged={() => {
          setAppointmentDraft(null)
          setNotice('Visita agendada. Veja na Agenda.')
        }}
      />

      <GlassQuoteModal
        open={Boolean(quoteOrder)}
        session={session}
        company={company}
        order={quoteOrder}
        onClose={() => setQuoteOrder(null)}
        onNotice={setNotice}
      />

      <GlassMemoryModal
        open={Boolean(memoryOrder)}
        session={session}
        company={company}
        order={memoryOrder}
        onClose={() => setMemoryOrder(null)}
      />

      <GlassInvoiceModal
        open={Boolean(invoiceOrder)}
        session={session}
        company={company}
        order={invoiceOrder}
        onClose={() => setInvoiceOrder(null)}
        onDone={(text) => {
          setNotice(text)
          setReloadToken((value) => value + 1)
        }}
      />

      <GlassCutListModal
        open={Boolean(cutListOrder)}
        session={session}
        company={company}
        orderIds={cutListOrder ? [cutListOrder.id] : undefined}
        title={cutListOrder ? `Lista de corte — pedido #${cutListOrder.code}` : undefined}
        onClose={() => setCutListOrder(null)}
      />

      <GlassContractModals
        session={session}
        company={company}
        target={contractTarget}
        onClose={() => {
          setContractTarget(null)
          setReloadToken((value) => value + 1)
        }}
        onSent={setNotice}
      />

      {notice && (
        <div
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-[var(--ink)] px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg"
          onClick={() => setNotice(null)}
        >
          {notice}
        </div>
      )}

      {message && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-[var(--red-500)] px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg">
          {message}
        </div>
      )}
    </>
  )
}
