import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { createRole, fetchRole, updateRole, type RoleRecord } from '../lib/roles'
import { fetchPermissions, type PermissionRecord } from '../lib/permissions'
import { SYSTEM_TYPE_LABELS } from '../lib/systemTypes'
import { ApiError } from '../lib/api'
import { TextField } from '../components/form/TextField'
import { SelectField } from '../components/form/SelectField'
import { TagIcon, ChevronLeftIcon } from '../components/icons'
import type { AuthSession } from '../lib/auth'

interface RoleFormPageProps {
  session: AuthSession
  roleId?: string
  onBack: () => void
  onSaved: () => void
}

type Tab = 'dados' | 'permissoes'

export function RoleFormPage({ session, roleId, onBack, onSaved }: RoleFormPageProps) {
  const [loading, setLoading] = useState(Boolean(roleId))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [activeTab, setActiveTab] = useState<Tab>('dados')

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [systemType, setSystemType] = useState(0)

  const [allPermissions, setAllPermissions] = useState<PermissionRecord[]>([])
  const [permissionsLoading, setPermissionsLoading] = useState(true)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!roleId) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    fetchRole(session.token.token, roleId)
      .then((role: RoleRecord) => {
        if (cancelled) return
        setName(role.name ?? '')
        setDescription(role.description ?? '')
        setSystemType(role.system_type ?? 0)
        setSelectedIds(new Set((role.permissions ?? []).map((permission) => permission.id)))
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err instanceof ApiError ? err.message : 'Não foi possível carregar o perfil.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [roleId, session.token.token, reloadKey])

  useEffect(() => {
    let cancelled = false
    setPermissionsLoading(true)
    fetchPermissions(session.token.token, { limit: 1000 })
      .then((res) => {
        if (!cancelled) setAllPermissions(res.data || [])
      })
      .catch(() => {
        if (!cancelled) setAllPermissions([])
      })
      .finally(() => {
        if (!cancelled) setPermissionsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [session.token.token])

  const groupedPermissions = useMemo(() => {
    const groups: Record<string, PermissionRecord[]> = {}
    for (const permission of allPermissions) {
      const key = permission.module || 'Outros'
      if (!groups[key]) groups[key] = []
      groups[key].push(permission)
    }
    return groups
  }, [allPermissions])

  function togglePermission(id: string) {
    setSelectedIds((current) => {
      const next = new Set(current)
      if (next.has(id)) {
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  function toggleModule(modulePermissions: PermissionRecord[]) {
    const allSelected = modulePermissions.every((permission) => selectedIds.has(permission.id))
    setSelectedIds((current) => {
      const next = new Set(current)
      for (const permission of modulePermissions) {
        if (allSelected) {
          next.delete(permission.id)
        } else {
          next.add(permission.id)
        }
      }
      return next
    })
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Preencha o nome para continuar.')
      return
    }

    const payload = {
      name: name.trim(),
      description: description.trim(),
      system_type: systemType,
      permissions: Array.from(selectedIds),
    }

    setSubmitting(true)
    try {
      if (roleId) {
        await updateRole(session.token.token, roleId, payload)
      } else {
        await createRole(session.token.token, payload)
      }
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o perfil.')
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
          Voltar para perfis de acesso
        </button>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Acessos</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">
          {roleId ? 'Editar perfil de acesso' : 'Novo perfil de acesso'}
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
          <div className="flex flex-wrap gap-1 border-b border-[var(--border)]">
            <button
              type="button"
              onClick={() => setActiveTab('dados')}
              className={`rounded-t-xl px-4 py-2.5 text-[13px] font-bold transition ${
                activeTab === 'dados' ? 'bg-[var(--blue-500)] text-white' : 'text-[var(--ink-soft)] hover:bg-[var(--surface)]'
              }`}
            >
              Dados
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('permissoes')}
              className={`rounded-t-xl px-4 py-2.5 text-[13px] font-bold transition ${
                activeTab === 'permissoes' ? 'bg-[var(--blue-500)] text-white' : 'text-[var(--ink-soft)] hover:bg-[var(--surface)]'
              }`}
            >
              Permissões ({selectedIds.size})
            </button>
          </div>

          {activeTab === 'dados' ? (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <TextField
                  label="Nome"
                  icon={<TagIcon className="h-4 w-4" />}
                  placeholder="Ex: Administrador"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                />
                <TextField
                  label="Descrição"
                  icon={<TagIcon className="h-4 w-4" />}
                  placeholder="Opcional"
                  value={description}
                  onChange={(event) => setDescription(event.target.value)}
                />
                <SelectField
                  label="Nicho do sistema"
                  value={systemType}
                  onChange={(event) => setSystemType(Number(event.target.value))}
                >
                  {Object.entries(SYSTEM_TYPE_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </SelectField>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
              {permissionsLoading ? (
                <div className="flex flex-col gap-2.5">
                  {Array.from({ length: 4 }).map((_, index) => (
                    <div key={index} className="h-11 animate-pulse rounded-xl bg-[var(--page)]" />
                  ))}
                </div>
              ) : Object.keys(groupedPermissions).length === 0 ? (
                <p className="py-6 text-center text-[13.5px] text-[var(--muted)]">Nenhuma permissão cadastrada.</p>
              ) : (
                <div className="flex flex-col gap-5">
                  {Object.entries(groupedPermissions).map(([moduleName, modulePermissions]) => {
                    const allSelected = modulePermissions.every((permission) => selectedIds.has(permission.id))
                    return (
                      <div key={moduleName}>
                        <label className="mb-2 flex items-center gap-2.5">
                          <input
                            type="checkbox"
                            checked={allSelected}
                            onChange={() => toggleModule(modulePermissions)}
                            className="h-4 w-4 accent-[var(--blue-500)]"
                          />
                          <span className="text-[13px] font-bold tracking-wide text-[var(--ink)] uppercase">{moduleName}</span>
                        </label>
                        <div className="grid gap-2 pl-6 sm:grid-cols-2 xl:grid-cols-3">
                          {modulePermissions.map((permission) => (
                            <label
                              key={permission.id}
                              className="flex items-center gap-2.5 rounded-xl bg-[var(--page)] px-3.5 py-2"
                            >
                              <input
                                type="checkbox"
                                checked={selectedIds.has(permission.id)}
                                onChange={() => togglePermission(permission.id)}
                                className="h-4 w-4 accent-[var(--blue-500)]"
                              />
                              <span className="text-[13px] font-semibold text-[var(--ink)]">{permission.action}</span>
                            </label>
                          ))}
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

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
