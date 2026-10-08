import { useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  createPrinter,
  fetchPrintAgents,
  fetchPrinter,
  PRINTER_COLUMN_OPTIONS,
  PRINTER_ENCODINGS,
  type PrintAgentRecord,
  testPrinter,
  updatePrinter,
} from '../lib/printers'
import { ApiError } from '../lib/api'
import { TextField } from '../components/form/TextField'
import { SelectField } from '../components/form/SelectField'
import { TagIcon, ChevronLeftIcon, PrinterIcon } from '../components/icons'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface PrinterFormPageProps {
  session: AuthSession
  company: AuthCompany
  printerId?: string
  onBack: () => void
  onSaved: () => void
}

export function PrinterFormPage({ session, company, printerId, onBack, onSaved }: PrinterFormPageProps) {
  const token = session.token.token
  const [loading, setLoading] = useState(Boolean(printerId))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [path, setPath] = useState('')
  const [columns, setColumns] = useState(48)
  const [encoding, setEncoding] = useState('cp850')
  const [cutPaper, setCutPaper] = useState(true)
  const [openDrawer, setOpenDrawer] = useState(false)
  const [copies, setCopies] = useState('1')
  const [active, setActive] = useState(true)
  const [detected, setDetected] = useState<string[]>([])
  const [agents, setAgents] = useState<PrintAgentRecord[]>([])
  const [agentId, setAgentId] = useState('')

  // Impressoras que o Windows do computador do cliente enxerga: sugestão pro caminho.
  useEffect(() => {
    fetchPrintAgents(token, company.id)
      .then((list) => {
        setAgents(list)
        setDetected([...new Set(list.flatMap((agent) => agent.detected_printers))].sort())
      })
      .catch(() => {
        setAgents([])
        setDetected([])
      })
  }, [token, company.id])

  useEffect(() => {
    if (!printerId) return
    let cancelled = false
    fetchPrinter(token, printerId)
      .then((item) => {
        if (cancelled) return
        setName(item.name)
        setPath(item.path)
        setColumns(item.paper_columns)
        setEncoding(item.encoding)
        setCutPaper(item.cut_paper)
        setOpenDrawer(item.open_drawer)
        setCopies(String(item.copies))
        setActive(item.active)
        setAgentId(item.print_agent_id ?? '')
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : 'Não foi possível carregar a impressora.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [printerId, token])

  const suggestions = useMemo(() => detected.filter((item) => item !== path), [detected, path])

  function buildPayload() {
    return {
      company_id: company.id,
      name: name.trim(),
      path: path.trim(),
      paper_columns: columns,
      encoding,
      cut_paper: cutPaper,
      open_drawer: openDrawer,
      copies: Math.min(Math.max(Number(copies) || 1, 1), 10),
      active,
      print_agent_id: agentId || null,
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    if (!name.trim() || !path.trim()) {
      setError('Preencha o nome e o caminho da impressora.')
      return
    }
    setSubmitting(true)
    try {
      if (printerId) await updatePrinter(token, printerId, buildPayload())
      else await createPrinter(token, buildPayload())
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar a impressora.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleTest() {
    if (!printerId) return
    setError(null)
    setNotice(null)
    try {
      await updatePrinter(token, printerId, buildPayload())
      await testPrinter(token, printerId)
      setNotice('Página de teste enviada. Veja o resultado na aba Fila de impressão.')
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar o teste.')
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="mb-3 flex items-center gap-1 text-[12.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
          Voltar para impressoras
        </button>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Impressão direta</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">{printerId ? 'Editar impressora' : 'Nova impressora'}</h1>
      </div>

      {loading ? (
        <div className="h-11 animate-pulse rounded-xl bg-[var(--surface)]" />
      ) : loadError ? (
        <p className="rounded-2xl bg-[var(--red-100)] p-5 text-[13.5px] font-medium text-[var(--red-500)]">{loadError}</p>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="mb-1 text-[14px] font-bold text-[var(--ink)]">Dados da impressora</h2>
            <p className="mb-4 text-[12px] text-[var(--muted)]">
              O caminho é como o computador com o servidor de impressão enxerga a impressora: nome no Windows (<code>Elgin i9</code>),
              compartilhamento (<code>\\PC\Elgin</code>), IP da impressora de rede (<code>192.168.0.50:9100</code>) ou porta (<code>COM3</code>).
            </p>
            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Nome"
                icon={<PrinterIcon className="h-4 w-4" />}
                placeholder="Ex: Caixa, Cozinha, Bar"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <TextField
                label="Caminho"
                icon={<TagIcon className="h-4 w-4" />}
                placeholder="Ex: Elgin i9"
                value={path}
                onChange={(event) => setPath(event.target.value)}
              />
              <SelectField label="Largura do papel" value={columns} onChange={(event) => setColumns(Number(event.target.value))}>
                {PRINTER_COLUMN_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
              <SelectField label="Codificação" value={encoding} onChange={(event) => setEncoding(event.target.value)}>
                {PRINTER_ENCODINGS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Computador que imprime"
                value={agentId}
                onChange={(event) => setAgentId(event.target.value)}
              >
                <option value="">Qualquer um da empresa</option>
                {agents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.hostname}
                    {agent.online ? ' (conectado)' : ' (desconectado)'}
                  </option>
                ))}
              </SelectField>
              <TextField
                label="Cópias"
                icon={<TagIcon className="h-4 w-4" />}
                inputMode="numeric"
                value={copies}
                onChange={(event) => setCopies(event.target.value.replace(/\D/g, ''))}
              />
            </div>

            <p className="mt-2 text-[12px] text-[var(--muted)]">
              Escolha o computador onde esta impressora está ligada: só o servidor de impressão dele pega os trabalhos
              dela. Assim, um teste feito em outro computador nunca sai nesta impressora. Em "Qualquer um da empresa",
              o primeiro servidor de impressão livre pega o trabalho.
            </p>

            {suggestions.length > 0 && (
              <div className="mt-3">
                <p className="mb-1.5 text-[12px] font-semibold text-[var(--ink-soft)]">Impressoras do Windows do computador conectado (clique para usar)</p>
                <div className="flex flex-wrap gap-2">
                  {suggestions.map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => {
                        setPath(item)
                        if (!name.trim()) setName(item)
                      }}
                      className="rounded-lg bg-[var(--page)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--ink-soft)] hover:bg-[var(--blue-100)] hover:text-[var(--blue-700)]"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="mt-4 flex flex-col gap-2.5">
              {[
                { label: 'Cortar o papel no fim de cada impressão', value: cutPaper, set: setCutPaper },
                { label: 'Abrir a gaveta de dinheiro ao imprimir', value: openDrawer, set: setOpenDrawer },
                { label: 'Ativa (aparece nas escolhas do PDV)', value: active, set: setActive },
              ].map((item) => (
                <label key={item.label} className="flex items-center gap-2.5">
                  <input type="checkbox" checked={item.value} onChange={(event) => item.set(event.target.checked)} className="h-4 w-4 accent-[var(--blue-500)]" />
                  <span className="text-[13.5px] font-semibold text-[var(--ink)]">{item.label}</span>
                </label>
              ))}
            </div>
          </div>

          {error && <p className="rounded-xl bg-[var(--red-100)] px-4 py-3 text-[13.5px] font-medium text-[var(--red-500)]">{error}</p>}
          {notice && <p className="rounded-xl bg-[var(--blue-100)] px-4 py-3 text-[13.5px] font-medium text-[var(--blue-700)]">{notice}</p>}

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-[var(--blue-500)] px-6 py-2.5 text-[14px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
            >
              {submitting ? 'Salvando…' : 'Salvar'}
            </button>
            {printerId && (
              <button
                type="button"
                onClick={handleTest}
                className="rounded-xl bg-[var(--page)] px-5 py-2.5 text-[14px] font-bold text-[var(--blue-700)] hover:bg-[var(--blue-100)]"
              >
                Salvar e imprimir teste
              </button>
            )}
            <button type="button" onClick={onBack} className="rounded-xl px-5 py-2.5 text-[14px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]">
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
