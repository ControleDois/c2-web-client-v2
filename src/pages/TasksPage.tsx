import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  createTaskBoard,
  deleteTaskBoard,
  fetchTaskBoards,
  moveTask,
  updateTaskBoard,
  TASK_PRIORITY_LABELS,
  type TaskBoardRecord,
  type TaskCardRecord,
} from '../lib/tasks'
import { ApiError } from '../lib/api'
import { formatDate } from '../lib/format'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { PlusIcon, SearchIcon, PencilIcon, TrashIcon, ClockIcon, UserIcon } from '../components/icons'
import { TaskFormPage } from './TaskFormPage'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface TasksPageProps {
  session: AuthSession
  company: AuthCompany
}

type View = { mode: 'board' } | { mode: 'form'; taskId?: string; boardId?: string }

const DEFAULT_COLUMNS = ['A fazer', 'Em andamento', 'Concluído']

const PRIORITY_STYLES: Record<number, string> = {
  0: 'bg-[var(--page)] text-[var(--ink-soft)]',
  1: 'bg-[var(--amber-100)] text-[var(--amber-500)]',
  2: 'bg-[var(--red-100)] text-[var(--red-500)]',
}

function isOverdue(date?: string | null): boolean {
  if (!date) return false
  const due = new Date(`${String(date).slice(0, 10)}T23:59:59`)
  return due.getTime() < Date.now()
}

export function TasksPage({ session, company }: TasksPageProps) {
  const token = session.token.token
  const [view, setView] = useState<View>({ mode: 'board' })
  const [boards, setBoards] = useState<TaskBoardRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [search, setSearch] = useState('')

  const [draggingTaskId, setDraggingTaskId] = useState<string | null>(null)
  const [dropBoardId, setDropBoardId] = useState<string | null>(null)

  const [addingColumn, setAddingColumn] = useState(false)
  const [newColumnTitle, setNewColumnTitle] = useState('')
  const [editingColumnId, setEditingColumnId] = useState<string | null>(null)
  const [editingTitle, setEditingTitle] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<TaskBoardRecord | null>(null)
  const [busy, setBusy] = useState(false)

  const reload = useCallback(() => setReloadKey((key) => key + 1), [])

  useEffect(() => {
    if (view.mode !== 'board') return
    let cancelled = false
    setLoading(true)
    setError(null)

    fetchTaskBoards(token, company.id)
      .then((res) => {
        if (!cancelled) setBoards(res.data ?? [])
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as tarefas.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [token, company.id, reloadKey, view.mode])

  const visibleBoards = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return boards
    return boards.map((board) => ({
      ...board,
      tasks: board.tasks.filter(
        (task) => task.title.toLowerCase().includes(term) || (task.people?.name ?? '').toLowerCase().includes(term)
      ),
    }))
  }, [boards, search])

  async function handleDrop(targetBoardId: string) {
    const taskId = draggingTaskId
    setDraggingTaskId(null)
    setDropBoardId(null)
    if (!taskId) return

    const from = boards.find((board) => board.tasks.some((task) => task.id === taskId))
    if (!from || from.id === targetBoardId) return
    const moved = from.tasks.find((task) => task.id === taskId) as TaskCardRecord

    // Move na tela na hora; se o servidor recusar, recarrega o quadro como estava.
    setBoards((current) =>
      current.map((board) => {
        if (board.id === from.id) return { ...board, tasks: board.tasks.filter((task) => task.id !== taskId) }
        if (board.id === targetBoardId) return { ...board, tasks: [...board.tasks, moved] }
        return board
      })
    )

    try {
      await moveTask(token, taskId, targetBoardId)
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Não foi possível mover a tarefa.')
      reload()
    }
  }

  async function handleAddColumn(title: string) {
    const trimmed = title.trim()
    if (!trimmed) return
    setBusy(true)
    setActionError(null)
    try {
      await createTaskBoard(token, { companyId: company.id, title: trimmed, position: boards.length })
      setNewColumnTitle('')
      setAddingColumn(false)
      reload()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Não foi possível criar a coluna.')
    } finally {
      setBusy(false)
    }
  }

  async function handleCreateDefaultColumns() {
    setBusy(true)
    setActionError(null)
    try {
      for (let index = 0; index < DEFAULT_COLUMNS.length; index++) {
        await createTaskBoard(token, { companyId: company.id, title: DEFAULT_COLUMNS[index], position: index })
      }
      reload()
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Não foi possível criar as colunas.')
      reload()
    } finally {
      setBusy(false)
    }
  }

  async function handleRenameColumn(board: TaskBoardRecord) {
    const trimmed = editingTitle.trim()
    setEditingColumnId(null)
    if (!trimmed || trimmed === board.title) return
    setActionError(null)
    try {
      await updateTaskBoard(token, board.id, { companyId: company.id, title: trimmed, position: board.position ?? undefined })
      setBoards((current) => current.map((item) => (item.id === board.id ? { ...item, title: trimmed } : item)))
    } catch (err) {
      setActionError(err instanceof ApiError ? err.message : 'Não foi possível renomear a coluna.')
    }
  }

  async function handleDeleteColumn() {
    if (!deleteTarget) return
    setBusy(true)
    setActionError(null)
    try {
      await deleteTaskBoard(token, deleteTarget.id)
      setDeleteTarget(null)
      reload()
    } catch (err) {
      setDeleteTarget(null)
      setActionError(err instanceof ApiError ? err.message : 'Não foi possível excluir a coluna.')
    } finally {
      setBusy(false)
    }
  }

  if (view.mode === 'form') {
    return (
      <TaskFormPage
        session={session}
        company={company}
        taskId={view.taskId}
        initialBoardId={view.boardId}
        boards={boards}
        onBack={() => setView({ mode: 'board' })}
        onSaved={() => setView({ mode: 'board' })}
      />
    )
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Operação</p>
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Tarefas</h1>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <span className="relative">
            <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--muted)]" />
            <input
              type="text"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar tarefa ou cliente"
              className="w-64 rounded-xl border border-[var(--border)] bg-[var(--surface)] py-2.5 pl-9 pr-3.5 text-[13.5px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--blue-300)]"
            />
          </span>
          <button
            type="button"
            disabled={boards.length === 0}
            onClick={() => setView({ mode: 'form', boardId: boards[0]?.id })}
            className="flex items-center gap-2 rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-50"
          >
            <PlusIcon className="h-4 w-4" />
            Nova tarefa
          </button>
        </div>
      </div>

      {actionError && (
        <p className="rounded-xl bg-[var(--red-100)] px-4 py-3 text-[13px] font-medium text-[var(--red-500)]">{actionError}</p>
      )}

      {loading && boards.length === 0 ? (
        <div className="flex gap-4 overflow-hidden">
          {Array.from({ length: 3 }).map((_, index) => (
            <div key={index} className="h-72 w-[300px] flex-none animate-pulse rounded-2xl bg-[var(--surface)]" />
          ))}
        </div>
      ) : error ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl bg-[var(--red-100)] p-5">
          <p className="text-[13.5px] font-medium text-[var(--red-500)]">{error}</p>
          <button
            type="button"
            onClick={reload}
            className="rounded-xl bg-[var(--surface)] px-4 py-2 text-[13px] font-bold text-[var(--red-500)] hover:bg-white"
          >
            Tentar novamente
          </button>
        </div>
      ) : boards.length === 0 ? (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-[var(--border)] bg-[var(--surface)] px-6 py-14 text-center">
          <h2 className="text-[15px] font-bold text-[var(--ink)]">Nenhum quadro de tarefas ainda</h2>
          <p className="max-w-md text-[13px] text-[var(--ink-soft)]">
            Comece com as colunas padrão ({DEFAULT_COLUMNS.join(', ')}) — você pode renomear, adicionar e excluir
            colunas depois.
          </p>
          <button
            type="button"
            onClick={handleCreateDefaultColumns}
            disabled={busy}
            className="rounded-xl bg-[var(--blue-500)] px-5 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
          >
            {busy ? 'Criando…' : 'Criar colunas padrão'}
          </button>
        </div>
      ) : (
        <div className="flex items-start gap-4 overflow-x-auto pb-4">
          {visibleBoards.map((board) => (
            <section
              key={board.id}
              onDragOver={(event) => {
                if (!draggingTaskId) return
                event.preventDefault()
                setDropBoardId(board.id)
              }}
              onDragLeave={() => setDropBoardId((current) => (current === board.id ? null : current))}
              onDrop={(event) => {
                event.preventDefault()
                handleDrop(board.id)
              }}
              className={`flex w-[300px] flex-none flex-col rounded-2xl border bg-[var(--surface)] transition ${
                dropBoardId === board.id ? 'border-[var(--blue-500)] ring-2 ring-[var(--blue-300)]' : 'border-[var(--border)]'
              }`}
            >
              <header className="flex items-center justify-between gap-2 px-4 pb-2 pt-4">
                {editingColumnId === board.id ? (
                  <input
                    autoFocus
                    value={editingTitle}
                    onChange={(event) => setEditingTitle(event.target.value)}
                    onBlur={() => handleRenameColumn(board)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') handleRenameColumn(board)
                      if (event.key === 'Escape') setEditingColumnId(null)
                    }}
                    className="min-w-0 flex-1 rounded-lg bg-[var(--page)] px-2.5 py-1.5 text-[14px] font-bold text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--blue-300)]"
                  />
                ) : (
                  <h2 className="flex min-w-0 items-center gap-2 text-[14px] font-bold text-[var(--ink)]">
                    <span className="truncate">{board.title}</span>
                    <span className="flex-none rounded-full bg-[var(--page)] px-2 py-0.5 text-[11.5px] font-bold text-[var(--ink-soft)]">
                      {board.tasks.length}
                    </span>
                  </h2>
                )}
                <div className="flex flex-none items-center">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingColumnId(board.id)
                      setEditingTitle(board.title)
                    }}
                    aria-label="Renomear coluna"
                    className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
                  >
                    <PencilIcon className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setDeleteTarget(board)}
                    aria-label="Excluir coluna"
                    className="rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--red-100)] hover:text-[var(--red-500)]"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </header>

              <div className="flex min-h-[60px] flex-col gap-2.5 px-3 pb-2 pt-1">
                {board.tasks.map((task) => (
                  <article
                    key={task.id}
                    draggable
                    onDragStart={() => setDraggingTaskId(task.id)}
                    onDragEnd={() => {
                      setDraggingTaskId(null)
                      setDropBoardId(null)
                    }}
                    onClick={() => setView({ mode: 'form', taskId: task.id, boardId: board.id })}
                    className={`cursor-pointer rounded-xl border border-[var(--border)] bg-[var(--page)] p-3 transition hover:border-[var(--blue-300)] ${
                      draggingTaskId === task.id ? 'opacity-40' : ''
                    }`}
                  >
                    <p className="text-[13.5px] font-semibold leading-snug text-[var(--ink)]">{task.title}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-1.5">
                      {task.priority !== null && task.priority !== undefined && (
                        <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold ${PRIORITY_STYLES[task.priority] ?? PRIORITY_STYLES[0]}`}>
                          {TASK_PRIORITY_LABELS[task.priority] ?? ''}
                        </span>
                      )}
                      {task.date_expected_finish && (
                        <span
                          className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-[10.5px] font-bold ${
                            isOverdue(task.date_expected_finish)
                              ? 'bg-[var(--red-100)] text-[var(--red-500)]'
                              : 'bg-[var(--surface)] text-[var(--ink-soft)]'
                          }`}
                        >
                          <ClockIcon className="h-3 w-3" />
                          {formatDate(task.date_expected_finish)}
                        </span>
                      )}
                    </div>
                    {task.people?.name && (
                      <p className="mt-2 flex items-center gap-1.5 text-[12px] text-[var(--ink-soft)]">
                        <UserIcon className="h-3.5 w-3.5 flex-none" />
                        <span className="truncate">{task.people.name}</span>
                      </p>
                    )}
                  </article>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setView({ mode: 'form', boardId: board.id })}
                className="m-3 mt-1 flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-[var(--border)] py-2 text-[12.5px] font-semibold text-[var(--ink-soft)] hover:border-[var(--blue-500)] hover:text-[var(--blue-700)]"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Adicionar tarefa
              </button>
            </section>
          ))}

          <div className="w-[300px] flex-none">
            {addingColumn ? (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-3">
                <input
                  autoFocus
                  value={newColumnTitle}
                  onChange={(event) => setNewColumnTitle(event.target.value)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter') handleAddColumn(newColumnTitle)
                    if (event.key === 'Escape') setAddingColumn(false)
                  }}
                  placeholder="Nome da coluna"
                  className="w-full rounded-lg bg-[var(--page)] px-3 py-2 text-[13.5px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--blue-300)]"
                />
                <div className="mt-2 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddColumn(newColumnTitle)}
                    disabled={busy || !newColumnTitle.trim()}
                    className="rounded-lg bg-[var(--blue-500)] px-3.5 py-1.5 text-[12.5px] font-bold text-white disabled:opacity-60"
                  >
                    Adicionar
                  </button>
                  <button
                    type="button"
                    onClick={() => setAddingColumn(false)}
                    className="rounded-lg px-3 py-1.5 text-[12.5px] font-semibold text-[var(--ink-soft)]"
                  >
                    Cancelar
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setAddingColumn(true)}
                className="flex w-full items-center justify-center gap-1.5 rounded-2xl border border-dashed border-[var(--border)] py-3 text-[13px] font-semibold text-[var(--ink-soft)] hover:border-[var(--blue-500)] hover:text-[var(--blue-700)]"
              >
                <PlusIcon className="h-4 w-4" />
                Nova coluna
              </button>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Excluir coluna"
        message={`Tem certeza que deseja excluir a coluna "${deleteTarget?.title}"? Essa ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        loading={busy}
        onConfirm={handleDeleteColumn}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
