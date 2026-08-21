import { useEffect, useState, type FormEvent } from 'react'
import {
  createCategory,
  fetchCategories,
  fetchCategory,
  updateCategory,
  CATEGORY_ROLE_LABELS,
  type CategoryRecord,
} from '../lib/categories'
import { ApiError } from '../lib/api'
import { TextField } from '../components/form/TextField'
import { SelectField } from '../components/form/SelectField'
import { TagIcon, ChevronLeftIcon } from '../components/icons'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface CategoryFormPageProps {
  session: AuthSession
  company: AuthCompany
  categoryId?: string
  onBack: () => void
  onSaved: () => void
}

export function CategoryFormPage({ session, company, categoryId, onBack, onSaved }: CategoryFormPageProps) {
  const [loading, setLoading] = useState(Boolean(categoryId))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [name, setName] = useState('')
  const [role, setRole] = useState(0)
  const [parentId, setParentId] = useState('')
  const [parentOptions, setParentOptions] = useState<CategoryRecord[]>([])

  useEffect(() => {
    if (!categoryId) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    fetchCategory(session.token.token, categoryId)
      .then((category: CategoryRecord) => {
        if (cancelled) return
        setName(category.name ?? '')
        setRole(category.role ?? 0)
        setParentId(category.category_id ?? '')
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err instanceof ApiError ? err.message : 'Não foi possível carregar a categoria.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [categoryId, session.token.token, reloadKey])

  useEffect(() => {
    let cancelled = false
    fetchCategories(session.token.token, company.id, { role, limit: 100 })
      .then((res) => {
        if (!cancelled) setParentOptions((res.data || []).filter((item) => item.id !== categoryId))
      })
      .catch(() => {
        if (!cancelled) setParentOptions([])
      })
    return () => {
      cancelled = true
    }
  }, [session.token.token, company.id, role, categoryId])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Preencha o nome para continuar.')
      return
    }

    const payload = {
      company_id: company.id,
      name: name.trim(),
      role,
      category_id: parentId || undefined,
    }

    setSubmitting(true)
    try {
      if (categoryId) {
        await updateCategory(session.token.token, categoryId, payload)
      } else {
        await createCategory(session.token.token, payload)
      }
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar a categoria.')
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
          Voltar para categorias
        </button>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Financeiro</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">
          {categoryId ? 'Editar categoria' : 'Nova categoria'}
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
            <h2 className="mb-4 text-[14px] font-bold text-[var(--ink)]">Dados da categoria</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <TextField
                label="Nome"
                icon={<TagIcon className="h-4 w-4" />}
                placeholder="Ex: Combustível, Manutenção"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <SelectField
                label="Tipo"
                value={role}
                onChange={(event) => {
                  setRole(Number(event.target.value))
                  setParentId('')
                }}
              >
                {Object.entries(CATEGORY_ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
              <SelectField label="Categoria pai" value={parentId} onChange={(event) => setParentId(event.target.value)}>
                <option value="">Nenhuma</option>
                {parentOptions.map((option) => (
                  <option key={option.id} value={option.id}>
                    {option.name}
                  </option>
                ))}
              </SelectField>
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
