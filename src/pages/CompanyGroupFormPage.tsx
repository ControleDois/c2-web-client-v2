import { useEffect, useState, type FormEvent } from 'react'
import {
  createCompanyGroup,
  fetchCompanyGroup,
  updateCompanyGroup,
  companyGroupMemberName,
  SHARING_OPTIONS,
  type CompanyGroupRecord,
  type SharedDataFlags,
} from '../lib/companyGroups'
import { fetchCompanies, type CompanyRecord } from '../lib/companies'
import { ApiError } from '../lib/api'
import { TextField } from '../components/form/TextField'
import { SearchSelectField } from '../components/form/SearchSelectField'
import { TagIcon, ChevronLeftIcon, PlusIcon, TrashIcon } from '../components/icons'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface CompanyGroupFormPageProps {
  session: AuthSession
  company: AuthCompany
  groupId?: string
  onBack: () => void
  onSaved: () => void
}

interface CompanyRow {
  tempId: string
  companyId: string | null
  label: string | null
  sub: string | null
}

function newRow(): CompanyRow {
  return { tempId: Math.random().toString(36).slice(2), companyId: null, label: null, sub: null }
}

const EMPTY_SHARING: SharedDataFlags = {}

export function CompanyGroupFormPage({ session, company, groupId, onBack, onSaved }: CompanyGroupFormPageProps) {
  const [loading, setLoading] = useState(Boolean(groupId))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [name, setName] = useState('')
  const [sharing, setSharing] = useState<SharedDataFlags>(EMPTY_SHARING)
  const [rows, setRows] = useState<CompanyRow[]>([newRow()])

  useEffect(() => {
    if (!groupId) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    fetchCompanyGroup(session.token.token, groupId)
      .then((group: CompanyGroupRecord) => {
        if (cancelled) return
        setName(group.name ?? '')
        setSharing(group.shared_data ?? {})
        const memberRows = (group.companies ?? []).map((member) => ({
          tempId: Math.random().toString(36).slice(2),
          companyId: member.id,
          label: companyGroupMemberName(member),
          sub: null,
        }))
        setRows(memberRows.length > 0 ? memberRows : [newRow()])
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err instanceof ApiError ? err.message : 'Não foi possível carregar o grupo.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [groupId, session.token.token, reloadKey])

  const activeSharingCount = SHARING_OPTIONS.filter((option) => sharing[option.key]).length

  function toggleSharing(key: keyof SharedDataFlags) {
    setSharing((current) => ({ ...current, [key]: !current[key] }))
  }

  function setAllSharing(value: boolean) {
    const next: SharedDataFlags = {}
    for (const option of SHARING_OPTIONS) next[option.key] = value
    setSharing(next)
  }

  function addRow() {
    setRows((current) => [...current, newRow()])
  }

  function removeRow(tempId: string) {
    setRows((current) => (current.length > 1 ? current.filter((row) => row.tempId !== tempId) : [newRow()]))
  }

  function selectCompany(tempId: string, item: CompanyRecord) {
    const alreadyUsed = rows.some((row) => row.tempId !== tempId && row.companyId === item.id)
    if (alreadyUsed) {
      setError('Esta empresa já faz parte do grupo.')
      return
    }
    setError(null)
    setRows((current) =>
      current.map((row) =>
        row.tempId === tempId ? { ...row, companyId: item.id, label: item.name, sub: item.document } : row
      )
    )
  }

  function clearRow(tempId: string) {
    setRows((current) => current.map((row) => (row.tempId === tempId ? { ...row, companyId: null, label: null, sub: null } : row)))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    const companyIds = rows.map((row) => row.companyId).filter((id): id is string => Boolean(id))

    if (!name.trim()) {
      setError('Preencha o nome do grupo para continuar.')
      return
    }
    if (companyIds.length === 0) {
      setError('Adicione ao menos uma empresa ao grupo.')
      return
    }

    const payload = {
      company_id: company.id,
      name: name.trim(),
      companies: companyIds,
      shared_data: sharing,
    }

    setSubmitting(true)
    try {
      if (groupId) {
        await updateCompanyGroup(session.token.token, groupId, payload)
      } else {
        await createCompanyGroup(session.token.token, payload)
      }
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o grupo.')
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
          Voltar para grupos de empresas
        </button>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Acessos</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">
          {groupId ? 'Editar grupo de empresas' : 'Novo grupo de empresas'}
        </h1>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
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
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="mb-4 text-[14px] font-bold text-[var(--ink)]">Dados do grupo</h2>
            <TextField
              label="Nome do grupo"
              icon={<TagIcon className="h-4 w-4" />}
              placeholder="Ex: Rede Centro-Oeste"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[14px] font-bold text-[var(--ink)]">Compartilhamento entre empresas</h2>
                <p className="mt-0.5 text-[12px] text-[var(--muted)]">
                  {activeSharingCount} de {SHARING_OPTIONS.length} ativos
                </p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAllSharing(true)}
                  className="rounded-xl border border-[var(--border)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]"
                >
                  Marcar todos
                </button>
                <button
                  type="button"
                  onClick={() => setAllSharing(false)}
                  className="rounded-xl border border-[var(--border)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]"
                >
                  Desmarcar todos
                </button>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {SHARING_OPTIONS.map((option) => (
                <label
                  key={option.key}
                  className={`flex cursor-pointer flex-col gap-1 rounded-xl border p-3.5 transition ${
                    sharing[option.key] ? 'border-[var(--blue-300)] bg-[var(--blue-100)]' : 'border-[var(--border)] bg-[var(--page)]'
                  }`}
                >
                  <span className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={Boolean(sharing[option.key])}
                      onChange={() => toggleSharing(option.key)}
                      className="h-4 w-4 accent-[var(--blue-500)]"
                    />
                    <span className="text-[13px] font-bold text-[var(--ink)]">{option.title}</span>
                  </span>
                  <span className="text-[11.5px] text-[var(--muted)]">{option.description}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-[14px] font-bold text-[var(--ink)]">Empresas do grupo</h2>
              <button
                type="button"
                onClick={addRow}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-1.5 text-[12px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Adicionar empresa
              </button>
            </div>

            <div className="flex flex-col gap-3">
              {rows.map((row) => (
                <div key={row.tempId} className="flex items-end gap-2">
                  <div className="flex-1">
                    <SearchSelectField
                      label="Empresa"
                      placeholder="Buscar por nome ou documento"
                      selectedLabel={row.label}
                      selectedSubLabel={row.sub}
                      onSearch={(query) => fetchCompanies(session.token.token, { search: query }).then((res) => res.data)}
                      getOptionLabel={(item: CompanyRecord) => item.name}
                      getOptionSubLabel={(item: CompanyRecord) => item.document}
                      onSelect={(item: CompanyRecord) => selectCompany(row.tempId, item)}
                      onClear={() => clearRow(row.tempId)}
                    />
                  </div>
                  <button
                    type="button"
                    onClick={() => removeRow(row.tempId)}
                    className="mb-0.5 flex h-[42px] w-[42px] flex-none items-center justify-center rounded-xl text-[var(--muted)] hover:bg-[var(--red-100)] hover:text-[var(--red-500)]"
                    aria-label="Remover empresa"
                  >
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              ))}
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
