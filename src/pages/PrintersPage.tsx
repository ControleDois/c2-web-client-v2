import { useCallback, useEffect, useState } from 'react'
import {
  cancelPrintJob,
  deletePrinter,
  fetchPrintAgents,
  fetchPrintJobs,
  fetchPrinters,
  PRINT_JOB_STATUS_LABELS,
  retryPrintJob,
  testPrinter,
  type PrintAgentRecord,
  type PrintJobRecord,
  type PrinterRecord,
} from '../lib/printers'
import { ApiError } from '../lib/api'
import { formatDateTime } from '../lib/format'
import { GlassList } from './glass/GlassList'
import { PencilIcon, PrinterIcon, TrashIcon } from '../components/icons'
import type { AuthCompany, AuthSession } from '../lib/auth'

interface PrintersPageProps {
  session: AuthSession
  company: AuthCompany
  onCreate: () => void
  onEdit: (item: PrinterRecord) => void
}

const JOB_TONES: Record<number, string> = {
  0: 'bg-[var(--page)] text-[var(--ink-soft)]',
  1: 'bg-[var(--amber-100)] text-[var(--amber-500)]',
  2: 'bg-[var(--green-100)] text-[var(--green-600)]',
  3: 'bg-[var(--red-100)] text-[var(--red-500)]',
  4: 'bg-[var(--page)] text-[var(--muted)]',
}

function secondsAgo(iso?: string | null) {
  if (!iso) return 'nunca'
  const seconds = Math.max(Math.round((Date.now() - new Date(iso).getTime()) / 1000), 0)
  if (seconds < 60) return `há ${seconds} s`
  if (seconds < 3600) return `há ${Math.round(seconds / 60)} min`
  return formatDateTime(iso)
}

export function PrintersPage({ session, company, onCreate, onEdit }: PrintersPageProps) {
  const token = session.token.token
  const [agents, setAgents] = useState<PrintAgentRecord[]>([])
  const [jobs, setJobs] = useState<PrintJobRecord[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)

  const loadStatus = useCallback(() => {
    fetchPrintAgents(token, company.id).then(setAgents).catch(() => {})
    fetchPrintJobs(token, company.id, 10)
      .then((res) => setJobs(res.data || []))
      .catch(() => {})
  }, [token, company.id])

  // Status do servidor de impressão e fila: atualiza sozinho enquanto a tela está aberta.
  useEffect(() => {
    loadStatus()
    const timer = setInterval(loadStatus, 5000)
    return () => clearInterval(timer)
  }, [loadStatus])

  async function runJobAction(action: () => Promise<unknown>) {
    setNotice(null)
    try {
      await action()
      loadStatus()
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : 'Não foi possível concluir a ação.')
    }
  }

  const online = agents.filter((agent) => agent.online)

  return (
    <>
      <GlassList<PrinterRecord>
        eyebrow="Impressão direta"
        title="Impressoras"
        newLabel="Nova impressora"
        searchPlaceholder="Buscar por nome ou caminho"
        emptyLabel="Nenhuma impressora cadastrada"
        filterKey={String(reloadToken)}
        fetchPage={(search, page) => fetchPrinters(token, company.id, { search, page, limit: 10 })}
        columns={[
          { header: 'Nome', render: (item) => <span className="font-medium text-[var(--ink)]">{item.name}</span> },
          { header: 'Caminho', render: (item) => <span className="font-mono text-[12px] text-[var(--ink-soft)]">{item.path}</span> },
          { header: 'Papel', render: (item) => <span className="text-[var(--ink-soft)]">{item.paper_columns} col.</span> },
          {
            header: 'Situação',
            render: (item) => (
              <span className={item.active ? 'text-[var(--green-600)]' : 'text-[var(--muted)]'}>{item.active ? 'Ativa' : 'Inativa'}</span>
            ),
          },
        ]}
        cardTitle={(item) => item.name}
        cardSubtitle={(item) => item.path}
        onCreate={onCreate}
        actions={(item, { askDelete }) => [
          { key: 'edit', label: 'Editar', icon: <PencilIcon className="h-4 w-4" />, onClick: () => onEdit(item) },
          {
            key: 'test',
            label: 'Imprimir teste',
            icon: <PrinterIcon className="h-4 w-4" />,
            onClick: () =>
              runJobAction(async () => {
                await testPrinter(token, item.id)
                setNotice(`Teste enviado para "${item.name}". Acompanhe a fila abaixo.`)
              }),
          },
          { key: 'delete', label: 'Excluir', icon: <TrashIcon className="h-4 w-4" />, tone: 'danger', dividerBefore: true, onClick: () => askDelete(item) },
        ]}
        deleteItem={async (item) => {
          await deletePrinter(token, item.id)
          setReloadToken((value) => value + 1)
        }}
        deleteTitle="Excluir impressora"
        deleteLabel={(item) => item.name}
      />

      <div className="flex flex-col gap-6 px-4 pb-8 sm:px-6 lg:px-8">
        {notice && (
          <div className="rounded-xl bg-[var(--blue-100)] px-4 py-3 text-[13px] font-medium text-[var(--blue-700)]" onClick={() => setNotice(null)}>
            {notice}
          </div>
        )}

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[14px] font-bold text-[var(--ink)]">Servidor de impressão</h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${
                online.length ? 'bg-[var(--green-100)] text-[var(--green-600)]' : 'bg-[var(--red-100)] text-[var(--red-500)]'
              }`}
            >
              {online.length ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
          {agents.length === 0 ? (
            <p className="mt-2 text-[12.5px] text-[var(--ink-soft)]">
              Nenhum computador conectado ainda. Instale o <b>C2 Print Server</b> no computador onde ficam as impressoras e informe o
              token da empresa no <code>config.ini</code>: ele aparece aqui sozinho, com a lista das impressoras do Windows.
            </p>
          ) : (
            <div className="mt-3 flex flex-col divide-y divide-[var(--border)]">
              {agents.map((agent) => (
                <div key={agent.id} className="flex flex-wrap items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[var(--ink)]">
                      <span className={`mr-2 inline-block h-2 w-2 rounded-full ${agent.online ? 'bg-[var(--green-600)]' : 'bg-[var(--red-500)]'}`} />
                      {agent.hostname}
                      {agent.agent_version ? <span className="ml-2 text-[11.5px] font-normal text-[var(--muted)]">v{agent.agent_version}</span> : null}
                    </p>
                    <p className="text-[12px] text-[var(--muted)]">
                      Último sinal {secondsAgo(agent.last_seen_at)}
                      {agent.detected_printers.length ? ` · ${agent.detected_printers.length} impressora(s) no Windows` : ''}
                    </p>
                  </div>
                  {agent.detected_printers.length > 0 && (
                    <p className="max-w-[420px] text-right text-[11.5px] text-[var(--ink-soft)]">{agent.detected_printers.join(' · ')}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-[14px] font-bold text-[var(--ink)]">Últimas impressões</h2>
          <p className="mb-3 text-[12px] text-[var(--muted)]">Atualiza sozinho. Trabalho com erro pode ser reenviado.</p>
          {jobs.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-[var(--muted)]">Nenhuma impressão ainda.</p>
          ) : (
            <div className="flex flex-col divide-y divide-[var(--border)]">
              {jobs.map((job) => (
                <div key={job.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-[var(--ink)]">
                      #{job.code} · {job.title || 'Documento'} <span className="font-normal text-[var(--muted)]">→ {job.printer?.name ?? '—'}</span>
                    </p>
                    <p className="truncate text-[12px] text-[var(--muted)]">
                      {formatDateTime(job.created_at)}
                      {job.error ? ` · ${job.error}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-none items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${JOB_TONES[job.status] ?? JOB_TONES[0]}`}>
                      {PRINT_JOB_STATUS_LABELS[job.status] ?? job.status}
                    </span>
                    {(job.status === 3 || job.status === 4) && (
                      <button
                        type="button"
                        onClick={() => runJobAction(() => retryPrintJob(token, job.id))}
                        className="rounded-lg px-2.5 py-1 text-[12px] font-bold text-[var(--blue-700)] hover:bg-[var(--blue-100)]"
                      >
                        Reenviar
                      </button>
                    )}
                    {job.status === 0 && (
                      <button
                        type="button"
                        onClick={() => runJobAction(() => cancelPrintJob(token, job.id))}
                        className="rounded-lg px-2.5 py-1 text-[12px] font-bold text-[var(--red-500)] hover:bg-[var(--red-100)]"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
