import { useCallback, useEffect, useState } from 'react'
import { downloadIfoodApiLogs, fetchIfoodApiLogs, type IfoodApiLog } from '../lib/ifoodApiLogs'
import { ApiError } from '../lib/api'
import { TextField } from '../components/form/TextField'
import { ClockIcon, RefreshIcon } from '../components/icons'
import type { AuthSession } from '../lib/auth'

interface IfoodApiLogsPageProps {
  session: AuthSession
}

// Valor de <input type="datetime-local"> no horário local do computador.
function toLocalInput(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function formatMoment(iso: string): string {
  const date = new Date(iso)
  const pad = (n: number, size = 2) => String(n).padStart(size, '0')
  return `${pad(date.getDate())}/${pad(date.getMonth() + 1)}/${date.getFullYear()} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}.${pad(date.getMilliseconds(), 3)}`
}

function statusTone(status: number | null): string {
  if (status === null) return 'bg-[var(--page)] text-[var(--muted)]'
  if (status >= 200 && status < 300) return 'bg-[var(--green-100)] text-[var(--green-600)]'
  return 'bg-[var(--red-100)] text-[var(--red-500)]'
}

// Log das chamadas à API do iFood (endpoint, horário, código HTTP e resposta): é o que o iFood pede
// anexado às gravações de homologação. Só a empresa matriz vê.
export function IfoodApiLogsPage({ session }: IfoodApiLogsPageProps) {
  const token = session.token.token
  const [from, setFrom] = useState(() => toLocalInput(new Date(Date.now() - 2 * 3600 * 1000)))
  const [to, setTo] = useState('')
  const [rows, setRows] = useState<IfoodApiLog[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [auto, setAuto] = useState(false)
  const [openId, setOpenId] = useState<string | null>(null)
  const [downloading, setDownloading] = useState<'txt' | 'csv' | null>(null)

  const load = useCallback(
    (silent = false) => {
      if (!silent) setLoading(true)
      setError(null)
      fetchIfoodApiLogs(token, from, to)
        .then((data) => setRows([...data].reverse()))
        .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível carregar o log.'))
        .finally(() => setLoading(false))
    },
    [token, from, to]
  )

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    if (!auto) return
    const timer = setInterval(() => load(true), 5000)
    return () => clearInterval(timer)
  }, [auto, load])

  async function handleDownload(format: 'txt' | 'csv') {
    setDownloading(format)
    try {
      await downloadIfoodApiLogs(token, from, to, format)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível baixar o arquivo.')
    } finally {
      setDownloading(null)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Matriz</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Logs da API do iFood</h1>
        <p className="mt-1 max-w-3xl text-[13px] text-[var(--ink-soft)]">
          Toda chamada do sistema ao iFood fica registrada aqui, com endpoint, horário, código HTTP e resposta. Na homologação: grave a tela com o
          relógio visível, faça os testes, abra esta página, ajuste o período para o horário do teste e baixe o arquivo para anexar.
        </p>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="w-[220px]">
          <TextField label="De" icon={<ClockIcon className="h-4 w-4" />} type="datetime-local" value={from} onChange={(event) => setFrom(event.target.value)} />
        </div>
        <div className="w-[220px]">
          <TextField label="Até (opcional)" icon={<ClockIcon className="h-4 w-4" />} type="datetime-local" value={to} onChange={(event) => setTo(event.target.value)} />
        </div>
        <button
          type="button"
          onClick={() => load()}
          className="flex items-center gap-2 rounded-xl border border-[var(--border)] px-3.5 py-2.5 text-[13px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          <RefreshIcon className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
        <label className="flex items-center gap-2 pb-2.5 text-[12.5px] font-semibold text-[var(--ink-soft)]">
          <input type="checkbox" checked={auto} onChange={(event) => setAuto(event.target.checked)} className="h-4 w-4 accent-[var(--blue-500)]" />
          Atualizar sozinho (5 s)
        </label>
        <div className="ml-auto flex gap-2">
          <button
            type="button"
            onClick={() => void handleDownload('txt')}
            disabled={downloading !== null}
            className="rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13px] font-bold text-white hover:bg-[var(--blue-700)] disabled:opacity-60"
          >
            {downloading === 'txt' ? 'Baixando…' : 'Baixar .txt'}
          </button>
          <button
            type="button"
            onClick={() => void handleDownload('csv')}
            disabled={downloading !== null}
            className="rounded-xl border border-[var(--blue-500)] px-4 py-2.5 text-[13px] font-bold text-[var(--blue-700)] hover:bg-[var(--blue-100)] disabled:opacity-60"
          >
            {downloading === 'csv' ? 'Baixando…' : 'Baixar .csv'}
          </button>
        </div>
      </div>

      {error && <p className="text-[13px] font-medium text-[var(--red-500)]">{error}</p>}

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        {loading && rows.length === 0 ? (
          <div className="flex flex-col gap-2">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-10 animate-pulse rounded-xl bg-[var(--page)]" />
            ))}
          </div>
        ) : rows.length === 0 ? (
          <p className="py-10 text-center text-[13.5px] text-[var(--muted)]">Nenhuma chamada ao iFood neste período.</p>
        ) : (
          <div className="flex flex-col">
            <p className="mb-2 text-[12px] text-[var(--muted)]">{rows.length} chamadas (da mais recente para a mais antiga)</p>
            {rows.map((row) => (
              <div key={row.id} className="border-b border-[var(--border)] last:border-none">
                <button
                  type="button"
                  onClick={() => setOpenId(openId === row.id ? null : row.id)}
                  className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 py-2.5 text-left"
                >
                  <span className="w-[170px] flex-none font-mono text-[12px] text-[var(--ink-soft)]">{formatMoment(row.created_at)}</span>
                  <span className="w-[56px] flex-none text-[12px] font-bold text-[var(--ink)]">{row.method}</span>
                  <span className={`flex-none rounded-full px-2 py-0.5 text-[11px] font-bold ${statusTone(row.status_code)}`}>{row.status_code ?? 'sem resposta'}</span>
                  <span className="min-w-0 flex-1 truncate font-mono text-[12px] text-[var(--ink)]">{row.path}</span>
                  {row.duration_ms !== null && <span className="flex-none text-[11.5px] text-[var(--muted)]">{row.duration_ms} ms</span>}
                </button>
                {openId === row.id && (
                  <div className="mb-3 grid gap-3 rounded-xl bg-[var(--page)] p-3 text-[12px] lg:grid-cols-2">
                    <div>
                      <p className="mb-1 font-bold text-[var(--ink-soft)]">Requisição</p>
                      <pre className="max-h-64 overflow-auto font-mono break-all whitespace-pre-wrap text-[var(--ink)]">
                        {row.request_body ? JSON.stringify(row.request_body, null, 2) : '—'}
                      </pre>
                    </div>
                    <div>
                      <p className="mb-1 font-bold text-[var(--ink-soft)]">Resposta</p>
                      <pre className="max-h-64 overflow-auto font-mono break-all whitespace-pre-wrap text-[var(--ink)]">{row.response_body ?? '—'}</pre>
                      {row.error && <p className="mt-2 font-medium text-[var(--red-500)]">{row.error}</p>}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
