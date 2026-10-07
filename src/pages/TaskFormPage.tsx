import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  createTask,
  deleteTask,
  fetchTask,
  updateTask,
  TASK_PRIORITY_LABELS,
  TASK_STATUS_LABELS,
  type TaskBoardRecord,
  type TaskRecord,
} from '../lib/tasks'
import { fetchPeople, type PersonRecord } from '../lib/people'
import { fetchCompanyWhatsapps, type CompanyWhatsappRecord } from '../lib/companyWhatsapp'
import { formatDocument } from '../lib/formatDocument'
import { formatPhone } from '../lib/formatPhone'
import { ApiError } from '../lib/api'
import { TextField } from '../components/form/TextField'
import { SelectField } from '../components/form/SelectField'
import { SearchSelectField } from '../components/form/SearchSelectField'
import { SectionCard } from '../components/SectionCard'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { useQuickPerson } from '../hooks/useQuickPerson'
import { ChevronLeftIcon, TagIcon, PlusIcon, TrashIcon, PaperclipIcon } from '../components/icons'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface TaskFormPageProps {
  session: AuthSession
  company: AuthCompany
  taskId?: string
  initialBoardId?: string
  boards: TaskBoardRecord[]
  onBack: () => void
  onSaved: () => void
}

interface EntityPick {
  id: string
  label: string
  sub?: string
}

interface FileEntry {
  key: string
  id?: string
  title: string
  description: string
  file?: File
  fileName?: string | null
  fileUrl?: string | null
}

const inputClass =
  'w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition placeholder:text-[var(--muted)] focus:outline-none focus:ring-[var(--blue-300)]'

function dateValue(value?: string | null): string {
  return value ? String(value).slice(0, 10) : ''
}

function dateTimeValue(value?: string | null): string {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  const offset = date.getTimezoneOffset() * 60000
  return new Date(date.getTime() - offset).toISOString().slice(0, 16)
}

export function TaskFormPage({ session, company, taskId, initialBoardId, boards, onBack, onSaved }: TaskFormPageProps) {
  const token = session.token.token
  const quickPerson = useQuickPerson(session, company)

  const [loading, setLoading] = useState(Boolean(taskId))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [boardId, setBoardId] = useState(initialBoardId ?? boards[0]?.id ?? '')
  const [priority, setPriority] = useState(0)
  const [status, setStatus] = useState(0)
  const [dueDate, setDueDate] = useState('')
  const [finishDate, setFinishDate] = useState('')
  const [person, setPerson] = useState<EntityPick | null>(null)
  const [remind, setRemind] = useState(false)
  const [remindAt, setRemindAt] = useState('')
  const [whatsapp, setWhatsapp] = useState<EntityPick | null>(null)
  const [files, setFiles] = useState<FileEntry[]>([])

  useEffect(() => {
    if (!taskId) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    fetchTask(token, taskId)
      .then((task: TaskRecord) => {
        if (cancelled) return
        setTitle(task.title ?? '')
        setDescription(task.description ?? '')
        setBoardId(task.task_board_id ?? '')
        setPriority(task.priority ?? 0)
        setStatus(task.status ?? 0)
        setDueDate(dateValue(task.date_expected_finish))
        setFinishDate(dateValue(task.date_finish))
        setPerson(task.people ? { id: task.people.id, label: task.people.name } : null)
        setRemind(Boolean(task.remind_whatsapp))
        setRemindAt(dateTimeValue(task.remind_at))
        setWhatsapp(task.whatsapp ? { id: task.whatsapp.id, label: task.whatsapp.name } : null)
        setFiles(
          (task.files ?? []).map((file, index) => ({
            key: `file-${index}`,
            id: file.id,
            title: file.title ?? '',
            description: file.description ?? '',
            fileName: file.file_name,
            fileUrl: file.file_url,
          }))
        )
      })
      .catch((err) => {
        if (!cancelled) setLoadError(err instanceof ApiError ? err.message : 'Não foi possível carregar a tarefa.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [taskId, token, reloadKey])

  const searchPeople = useCallback(
    (query: string) => fetchPeople(token, company.id, { search: query, limit: 8 }).then((res) => res.data),
    [token, company.id]
  )
  const searchWhatsapps = useCallback(
    (query: string) => fetchCompanyWhatsapps(token, company.id, { search: query }).then((res) => res.data),
    [token, company.id]
  )

  function addFile() {
    setFiles((current) => [...current, { key: `file-${Date.now()}`, title: '', description: '' }])
  }

  function updateFile(key: string, patch: Partial<FileEntry>) {
    setFiles((current) => current.map((file) => (file.key === key ? { ...file, ...patch } : file)))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!title.trim()) {
      setError('Informe o título da tarefa.')
      return
    }
    if (!boardId) {
      setError('Escolha a coluna do quadro.')
      return
    }
    if (remind && (!person || !remindAt)) {
      setError('Para lembrar por WhatsApp, informe o cliente e a data e hora do lembrete.')
      return
    }
    if (files.some((file) => !file.title.trim())) {
      setError('Dê um título para cada anexo.')
      return
    }

    const form = new FormData()
    form.append('company_id', company.id)
    form.append('task_board_id', boardId)
    form.append('title', title.trim())
    form.append('status', String(status))
    form.append('priority', String(priority))
    if (description.trim()) form.append('description', description.trim())
    if (person) form.append('people_id', person.id)
    if (dueDate) form.append('date_expected_finish', dueDate)
    if (finishDate) form.append('date_finish', finishDate)
    form.append('remind_whatsapp', remind ? 'true' : 'false')
    if (remind && remindAt) form.append('remind_at', new Date(remindAt).toISOString())
    if (remind && whatsapp) form.append('whatsapp_id', whatsapp.id)

    // O servidor apaga os anexos que não voltam na lista: sempre reenvia os existentes.
    files.forEach((file, index) => {
      form.append(`files[${index}][id]`, file.id ?? '')
      form.append(`files[${index}][title]`, file.title.trim())
      form.append(`files[${index}][description]`, file.description.trim())
      if (file.file) form.append(`files[${index}][file]`, file.file)
    })

    setSubmitting(true)
    try {
      if (taskId) await updateTask(token, taskId, form)
      else await createTask(token, form)
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar a tarefa.')
    } finally {
      setSubmitting(false)
    }
  }

  async function handleDelete() {
    if (!taskId) return
    setSubmitting(true)
    try {
      await deleteTask(token, taskId)
      onSaved()
    } catch (err) {
      setConfirmDelete(false)
      setError(err instanceof ApiError ? err.message : 'Não foi possível excluir a tarefa.')
    } finally {
      setSubmitting(false)
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
          Voltar para tarefas
        </button>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Operação</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">
          {taskId ? 'Editar tarefa' : 'Nova tarefa'}
        </h1>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
            <div key={index} className="h-11 animate-pulse rounded-xl bg-[var(--surface)]" />
          ))}
        </div>
      ) : loadError ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl bg-[var(--red-100)] p-5">
          <p className="text-[13.5px] font-medium text-[var(--red-500)]">{loadError}</p>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="rounded-xl bg-[var(--surface)] px-4 py-2 text-[13px] font-bold text-[var(--red-500)] hover:bg-white"
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <SectionCard title="Dados da tarefa">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="sm:col-span-2 xl:col-span-3">
                <TextField
                  label="Título"
                  icon={<TagIcon className="h-4 w-4" />}
                  placeholder="Ex: Configurar o servidor do cliente"
                  autoFocus={!taskId}
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                />
              </div>
              <SelectField label="Coluna" value={boardId} onChange={(event) => setBoardId(event.target.value)}>
                {boards.map((board) => (
                  <option key={board.id} value={board.id}>
                    {board.title}
                  </option>
                ))}
              </SelectField>
              <SelectField label="Prioridade" value={priority} onChange={(event) => setPriority(Number(event.target.value))}>
                {Object.entries(TASK_PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
              <SelectField label="Situação" value={status} onChange={(event) => setStatus(Number(event.target.value))}>
                {Object.entries(TASK_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Prazo</span>
                <input type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} className={inputClass} />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Concluída em</span>
                <input type="date" value={finishDate} onChange={(event) => setFinishDate(event.target.value)} className={inputClass} />
              </label>
              <div className="sm:col-span-2 xl:col-span-1">
                <SearchSelectField
                  label="Cliente (opcional)"
                  placeholder="Buscar por nome ou documento"
                  selectedLabel={person?.label ?? null}
                  selectedSubLabel={person?.sub ? formatDocument(person.sub) : undefined}
                  onSearch={searchPeople}
                  getOptionLabel={(item: PersonRecord) => item.name}
                  getOptionSubLabel={(item: PersonRecord) => (item.document ? formatDocument(item.document) : undefined)}
                  onSelect={(item: PersonRecord) => setPerson({ id: item.id, label: item.name, sub: item.document ?? undefined })}
                  onCreate={(typed) =>
                    quickPerson.request({
                      role: 2,
                      name: typed,
                      onCreated: (item: PersonRecord) => setPerson({ id: item.id, label: item.name, sub: item.document ?? undefined }),
                    })
                  }
                  onClear={() => setPerson(null)}
                />
              </div>
              <div className="sm:col-span-2 xl:col-span-3">
                <label className="flex flex-col gap-1.5">
                  <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Descrição</span>
                  <textarea
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                    rows={4}
                    placeholder="Detalhes do que precisa ser feito"
                    className={inputClass}
                  />
                </label>
              </div>
            </div>
          </SectionCard>

          <SectionCard
            title="Lembrete por WhatsApp"
            subtitle="Avisa o cliente vinculado na data e hora escolhidas"
            defaultCollapsed={!remind}
          >
            <div className="flex flex-col gap-4">
              <label className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={remind}
                  onChange={(event) => setRemind(event.target.checked)}
                  className="h-4 w-4 accent-[var(--blue-500)]"
                />
                <span className="text-[13.5px] font-semibold text-[var(--ink)]">Enviar lembrete por WhatsApp</span>
              </label>
              {remind && (
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="flex flex-col gap-1.5">
                    <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Data e hora do lembrete</span>
                    <input
                      type="datetime-local"
                      value={remindAt}
                      onChange={(event) => setRemindAt(event.target.value)}
                      className={inputClass}
                    />
                  </label>
                  <SearchSelectField
                    label="WhatsApp de envio"
                    placeholder="Buscar número"
                    selectedLabel={whatsapp?.label ?? null}
                    onSearch={searchWhatsapps}
                    getOptionLabel={(item: CompanyWhatsappRecord) => item.name}
                    getOptionSubLabel={(item: CompanyWhatsappRecord) => formatPhone(item.phone)}
                    onSelect={(item: CompanyWhatsappRecord) => setWhatsapp({ id: item.id, label: item.name })}
                    onClear={() => setWhatsapp(null)}
                  />
                  <p className="text-[12px] text-[var(--ink-soft)] sm:col-span-2">
                    O lembrete vai para o telefone do cliente vinculado à tarefa — informe o cliente nos dados acima.
                  </p>
                </div>
              )}
            </div>
          </SectionCard>

          <SectionCard
            title="Anexos"
            subtitle="Fotos e PDFs de até 5 MB"
            headerExtra={
              <button
                type="button"
                onClick={addFile}
                className="flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--ink-soft)] hover:border-[var(--blue-500)] hover:text-[var(--blue-700)]"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Adicionar anexo
              </button>
            }
            defaultCollapsed={files.length === 0}
          >
            {files.length === 0 ? (
              <p className="text-[13px] text-[var(--muted)]">Nenhum anexo.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {files.map((file) => (
                  <div key={file.key} className="grid gap-3 rounded-xl bg-[var(--page)] p-3.5 sm:grid-cols-[1fr_1fr_auto_auto]">
                    <input
                      type="text"
                      value={file.title}
                      onChange={(event) => updateFile(file.key, { title: event.target.value })}
                      placeholder="Título do anexo"
                      className="rounded-lg bg-[var(--surface)] px-3 py-2 text-[13.5px] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--blue-300)]"
                    />
                    <input
                      type="text"
                      value={file.description}
                      onChange={(event) => updateFile(file.key, { description: event.target.value })}
                      placeholder="Descrição (opcional)"
                      className="rounded-lg bg-[var(--surface)] px-3 py-2 text-[13.5px] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--blue-300)]"
                    />
                    <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 py-2 text-[12.5px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]">
                      <PaperclipIcon className="h-3.5 w-3.5 flex-none" />
                      <span className="max-w-[160px] truncate">{file.file?.name ?? file.fileName ?? 'Escolher arquivo'}</span>
                      <input
                        type="file"
                        accept=".jpg,.jpeg,.png,.webp,.pdf"
                        className="hidden"
                        onChange={(event) => updateFile(file.key, { file: event.target.files?.[0] })}
                      />
                    </label>
                    <div className="flex items-center gap-1">
                      {file.fileUrl && !file.file && (
                        <a
                          href={file.fileUrl}
                          target="_blank"
                          rel="noreferrer"
                          className="rounded-lg px-2.5 py-2 text-[12.5px] font-bold text-[var(--blue-700)] hover:bg-[var(--surface)]"
                        >
                          Abrir
                        </a>
                      )}
                      <button
                        type="button"
                        onClick={() => setFiles((current) => current.filter((item) => item.key !== file.key))}
                        aria-label="Remover anexo"
                        className="rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--red-100)] hover:text-[var(--red-500)]"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {error && (
            <p className="rounded-2xl bg-[var(--red-100)] p-4 text-[13.5px] font-medium text-[var(--red-500)]">{error}</p>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={submitting}
                className="rounded-xl bg-[var(--blue-500)] px-6 py-2.5 text-[14px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
              >
                {submitting ? 'Salvando…' : 'Salvar tarefa'}
              </button>
              <button
                type="button"
                onClick={onBack}
                className="rounded-xl px-5 py-2.5 text-[14px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
              >
                Cancelar
              </button>
            </div>
            {taskId && (
              <button
                type="button"
                onClick={() => setConfirmDelete(true)}
                className="flex items-center gap-1.5 rounded-xl px-4 py-2.5 text-[13.5px] font-bold text-[var(--red-500)] hover:bg-[var(--red-100)]"
              >
                <TrashIcon className="h-4 w-4" />
                Excluir tarefa
              </button>
            )}
          </div>
        </form>
      )}

      <ConfirmDialog
        open={confirmDelete}
        title="Excluir tarefa"
        message="Tem certeza que deseja excluir esta tarefa? Essa ação não pode ser desfeita."
        confirmLabel="Excluir"
        loading={submitting}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
      {quickPerson.modal}
    </div>
  )
}
