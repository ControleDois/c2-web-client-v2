import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import {
  deleteAppRelease,
  fetchAppReleases,
  setCurrentAppRelease,
  uploadAppRelease,
  type AppReleaseRecord,
} from '../lib/appReleases'
import { ApiError } from '../lib/api'
import { formatDateTime } from '../lib/format'
import { TextField } from '../components/form/TextField'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { TagIcon, PaperclipIcon } from '../components/icons'
import type { AuthSession } from '../lib/auth'

interface AppReleasesPageProps {
  session: AuthSession
}

const formatSize = (bytes: number) => `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 2 })} MB`

// Área da empresa matriz: envio das versões do servidor de impressão. A versão
// "atual" é a que todas as empresas baixam na tela de Impressoras.
export function AppReleasesPage({ session }: AppReleasesPageProps) {
  const token = session.token.token
  const [releases, setReleases] = useState<AppReleaseRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [version, setVersion] = useState('')
  const [notes, setNotes] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [makeCurrent, setMakeCurrent] = useState(true)
  const [sending, setSending] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AppReleaseRecord | null>(null)
  const fileInput = useRef<HTMLInputElement>(null)

  const load = useCallback(() => {
    setLoading(true)
    fetchAppReleases(token)
      .then((res) => {
        setReleases(res)
        setError(null)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as versões.'))
      .finally(() => setLoading(false))
  }, [token])

  useEffect(load, [load])

  async function handleUpload(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setNotice(null)
    if (!/^\d+\.\d+\.\d+$/.test(version.trim())) {
      setError('Informe a versão no formato 1.2.3 (a mesma do programa).')
      return
    }
    if (!file) {
      setError('Selecione o arquivo C2DelphiPrintServer.exe.')
      return
    }

    const form = new FormData()
    form.append('version', version.trim())
    form.append('notes', notes.trim())
    form.append('make_current', makeCurrent ? 'true' : 'false')
    form.append('file', file)

    setSending(true)
    try {
      await uploadAppRelease(token, form)
      setNotice(`Versão ${version.trim()} enviada${makeCurrent ? ' e definida como atual' : ''}.`)
      setVersion('')
      setNotes('')
      setFile(null)
      if (fileInput.current) fileInput.current.value = ''
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível enviar o arquivo.')
    } finally {
      setSending(false)
    }
  }

  async function handleSetCurrent(release: AppReleaseRecord) {
    setError(null)
    try {
      await setCurrentAppRelease(token, release.id)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível trocar a versão atual.')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    try {
      await deleteAppRelease(token, deleteTarget.id)
      setDeleteTarget(null)
      load()
    } catch (err) {
      setDeleteTarget(null)
      setError(err instanceof ApiError ? err.message : 'Não foi possível excluir a versão.')
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Matriz</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Aplicativos</h1>
        <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
          Programas que os clientes baixam pelo sistema. Hoje: o <b>Servidor de Impressão</b>.
        </p>
      </div>

      {error && <div className="rounded-2xl bg-[var(--red-100)] p-4 text-[13.5px] font-medium text-[var(--red-500)]">{error}</div>}
      {notice && <div className="rounded-2xl bg-[var(--green-100)] p-4 text-[13.5px] font-medium text-[var(--green-600)]">{notice}</div>}

      <form onSubmit={handleUpload} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="text-[14px] font-bold text-[var(--ink)]">Enviar nova versão do Servidor de Impressão</h2>
        <p className="mb-4 mt-0.5 text-[12px] text-[var(--muted)]">
          Envie o <code>C2DelphiPrintServer.exe</code> compilado. A tela de Impressoras de todas as empresas passa a baixar
          esta versão (com o <code>config.ini</code> de cada empresa já dentro do pacote).
        </p>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Versão"
            icon={<TagIcon className="h-4 w-4" />}
            placeholder="Ex: 1.0.1 (igual a PRINT_SERVER_VERSION do programa)"
            value={version}
            onChange={(event) => setVersion(event.target.value)}
          />
          <div className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Arquivo (.exe)</span>
            <label className="flex cursor-pointer items-center gap-2 rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[13.5px] text-[var(--ink)]">
              <PaperclipIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
              <span className="truncate">{file ? `${file.name} (${formatSize(file.size)})` : 'Selecionar arquivo'}</span>
              <input
                ref={fileInput}
                type="file"
                accept=".exe"
                className="hidden"
                onChange={(event) => setFile(event.target.files?.[0] ?? null)}
              />
            </label>
          </div>
          <label className="flex flex-col gap-1.5 sm:col-span-2">
            <span className="text-[12px] font-semibold text-[var(--ink-soft)]">O que mudou (opcional)</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              rows={3}
              className="rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] focus:outline-none"
            />
          </label>
        </div>
        <label className="mt-4 flex items-center gap-2.5">
          <input
            type="checkbox"
            checked={makeCurrent}
            onChange={(event) => setMakeCurrent(event.target.checked)}
            className="h-4 w-4 accent-[var(--blue-500)]"
          />
          <span className="text-[13.5px] font-semibold text-[var(--ink)]">Definir como a versão atual (a que os clientes baixam)</span>
        </label>
        <button
          type="submit"
          disabled={sending}
          className="mt-4 rounded-xl bg-[var(--blue-500)] px-6 py-2.5 text-[14px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
        >
          {sending ? 'Enviando…' : 'Enviar versão'}
        </button>
      </form>

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        <h2 className="mb-3 text-[14px] font-bold text-[var(--ink)]">Versões enviadas</h2>
        {loading ? (
          <div className="h-16 animate-pulse rounded-xl bg-[var(--page)]" />
        ) : releases.length === 0 ? (
          <p className="py-6 text-center text-[13px] text-[var(--muted)]">Nenhuma versão enviada ainda.</p>
        ) : (
          <div className="flex flex-col divide-y divide-[var(--border)]">
            {releases.map((release) => (
              <div key={release.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="text-[13.5px] font-bold text-[var(--ink)]">
                    Versão {release.version}
                    {release.is_current && (
                      <span className="ml-2 rounded-full bg-[var(--green-100)] px-2.5 py-0.5 text-[11px] font-bold text-[var(--green-600)]">
                        Atual
                      </span>
                    )}
                  </p>
                  <p className="text-[12px] text-[var(--muted)]">
                    {formatDateTime(release.created_at)} · {formatSize(release.file_size)}
                    {release.sha256 ? ` · SHA-256 ${release.sha256.slice(0, 12)}…` : ''}
                  </p>
                  {release.notes && <p className="mt-1 text-[12.5px] text-[var(--ink-soft)]">{release.notes}</p>}
                </div>
                <div className="flex flex-none items-center gap-2">
                  {!release.is_current && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleSetCurrent(release)}
                        className="rounded-lg px-3 py-1.5 text-[12.5px] font-bold text-[var(--blue-700)] hover:bg-[var(--blue-100)]"
                      >
                        Tornar atual
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeleteTarget(release)}
                        className="rounded-lg px-3 py-1.5 text-[12.5px] font-bold text-[var(--red-500)] hover:bg-[var(--red-100)]"
                      >
                        Excluir
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Excluir versão"
        message={`Excluir a versão ${deleteTarget?.version}? Ela deixa de aparecer na lista.`}
        confirmLabel="Excluir"
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
