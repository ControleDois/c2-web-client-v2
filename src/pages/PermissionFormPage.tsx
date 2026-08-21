import { useEffect, useState, type FormEvent } from 'react'
import { createPermission, fetchPermission, updatePermission, type PermissionRecord } from '../lib/permissions'
import { ApiError } from '../lib/api'
import { TextField } from '../components/form/TextField'
import { TagIcon, ChevronLeftIcon } from '../components/icons'
import type { AuthSession } from '../lib/auth'

interface PermissionFormPageProps {
  session: AuthSession
  permissionId?: string
  onBack: () => void
  onSaved: () => void
}

export function PermissionFormPage({ session, permissionId, onBack, onSaved }: PermissionFormPageProps) {
  const [loading, setLoading] = useState(Boolean(permissionId))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [module, setModule] = useState('')
  const [action, setAction] = useState('')
  const [slug, setSlug] = useState('')

  useEffect(() => {
    if (!permissionId) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    fetchPermission(session.token.token, permissionId)
      .then((permission: PermissionRecord) => {
        if (cancelled) return
        setModule(permission.module ?? '')
        setAction(permission.action ?? '')
        setSlug(permission.slug ?? '')
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err instanceof ApiError ? err.message : 'Não foi possível carregar a permissão.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [permissionId, session.token.token, reloadKey])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!module.trim() || !action.trim() || !slug.trim()) {
      setError('Preencha módulo, ação e slug para continuar.')
      return
    }

    const payload = { module: module.trim(), action: action.trim(), slug: slug.trim() }

    setSubmitting(true)
    try {
      if (permissionId) {
        await updatePermission(session.token.token, permissionId, payload)
      } else {
        await createPermission(session.token.token, payload)
      }
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar a permissão.')
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
          Voltar para permissões
        </button>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Acessos</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">
          {permissionId ? 'Editar permissão' : 'Nova permissão'}
        </h1>
      </div>

      {loading ? (
        <div className="h-11 animate-pulse rounded-xl bg-[var(--surface)]" />
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
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="mb-4 text-[14px] font-bold text-[var(--ink)]">Dados da permissão</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <TextField
                label="Módulo"
                icon={<TagIcon className="h-4 w-4" />}
                placeholder="Ex: people"
                value={module}
                onChange={(event) => setModule(event.target.value)}
              />
              <TextField
                label="Ação"
                icon={<TagIcon className="h-4 w-4" />}
                placeholder="Ex: create"
                value={action}
                onChange={(event) => setAction(event.target.value)}
              />
              <TextField
                label="Slug"
                icon={<TagIcon className="h-4 w-4" />}
                placeholder="Ex: people.create"
                value={slug}
                onChange={(event) => setSlug(event.target.value)}
              />
            </div>
          </div>

          {error && (
            <p className="rounded-xl bg-[var(--red-100)] px-4 py-3 text-[13.5px] font-medium text-[var(--red-500)]">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-[var(--blue-500)] px-6 py-2.5 text-[14px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
            >
              {submitting ? 'Salvando…' : 'Salvar'}
            </button>
            <button
              type="button"
              onClick={onBack}
              className="rounded-xl px-5 py-2.5 text-[14px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
