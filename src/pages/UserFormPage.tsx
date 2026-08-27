import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { createUser, fetchUser, updateUser } from '../lib/users'
import { fetchRoles, type RoleRecord } from '../lib/roles'
import { fetchCompanies, type CompanyRecord } from '../lib/companies'
import { ApiError } from '../lib/api'
import { TextField } from '../components/form/TextField'
import { PasswordField } from '../components/form/PasswordField'
import { SelectField } from '../components/form/SelectField'
import { SearchSelectField } from '../components/form/SearchSelectField'
import { SectionCard } from '../components/SectionCard'
import {
  MailIcon,
  BadgeIcon,
  TagIcon,
  UserIcon,
  PaperclipIcon,
  ChevronLeftIcon,
  TrashIcon,
} from '../components/icons'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface LinkedCompany {
  id: string
  label: string
  sub: string | null
}

interface UserFormPageProps {
  session: AuthSession
  company: AuthCompany
  userId?: string
  onBack: () => void
  onSaved: () => void
}

export function UserFormPage({ session, company, userId, onBack, onSaved }: UserFormPageProps) {
  const isMaster = Boolean(company.isMaster)
  const [loading, setLoading] = useState(Boolean(userId))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [roles, setRoles] = useState<RoleRecord[]>([])
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [roleId, setRoleId] = useState('')
  const [internalCode, setInternalCode] = useState('')
  const [existingAvatarUrl, setExistingAvatarUrl] = useState<string | null>(null)
  const [avatarFile, setAvatarFile] = useState<File | undefined>(undefined)
  const [linkedCompanies, setLinkedCompanies] = useState<LinkedCompany[]>([
    { id: company.id, label: company.people?.name ?? 'Empresa atual', sub: company.people?.document ?? null },
  ])

  const avatarPreviewUrl = useMemo(() => (avatarFile ? URL.createObjectURL(avatarFile) : existingAvatarUrl), [
    avatarFile,
    existingAvatarUrl,
  ])

  useEffect(() => {
    return () => {
      if (avatarFile) URL.revokeObjectURL(avatarPreviewUrl!)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [avatarFile])

  useEffect(() => {
    let cancelled = false
    fetchRoles(session.token.token, company.id, { limit: 100 }).then((res) => {
      if (!cancelled) setRoles(res.data || [])
    })
    return () => {
      cancelled = true
    }
  }, [session.token.token, company.id])

  useEffect(() => {
    if (!userId) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    fetchUser(session.token.token, userId, company.id)
      .then((user) => {
        if (cancelled) return
        setName(user.people?.name ?? '')
        setEmail(user.email ?? '')
        setRoleId(user.people?.role?.id ?? '')
        setInternalCode(user.people?.internal_code != null ? String(user.people.internal_code) : '')
        setExistingAvatarUrl(user.people?.file_url ?? null)
        setAvatarFile(undefined)
        setLinkedCompanies(
          (user.companies ?? []).map((linked) => ({
            id: linked.id,
            label: linked.people?.name ?? 'Empresa sem nome',
            sub: linked.people?.document ?? null,
          }))
        )
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err instanceof ApiError ? err.message : 'Não foi possível carregar o usuário.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [userId, company.id, session.token.token, reloadKey])

  function addLinkedCompany(item: CompanyRecord) {
    // `/company` devolve o People da empresa: o id de verdade da Company (o
    // que a tabela de vínculo company_users exige) vem em item.company.id,
    // não em item.id (que é o id do People).
    const realCompanyId = item.company?.id
    if (!realCompanyId) {
      setError('Não foi possível identificar essa empresa. Tente novamente.')
      return
    }
    setError(null)
    setLinkedCompanies((current) => {
      if (current.some((linked) => linked.id === realCompanyId)) return current
      return [...current, { id: realCompanyId, label: item.name, sub: item.document ?? null }]
    })
  }

  function removeLinkedCompany(companyId: string) {
    setLinkedCompanies((current) => current.filter((linked) => linked.id !== companyId))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!email.trim()) {
      setError('Preencha o e-mail para continuar.')
      return
    }
    if (!userId && password.trim().length < 6) {
      setError('A senha deve ter pelo menos 6 caracteres.')
      return
    }

    const payload = {
      email: email.trim(),
      password: !userId ? password.trim() : undefined,
      roleId: roleId || undefined,
      internalCode: internalCode.trim() ? Number(internalCode.trim()) : undefined,
      name: name.trim() || undefined,
      file: avatarFile,
      companies: linkedCompanies.map((linked) => linked.id),
    }

    setSubmitting(true)
    try {
      if (userId) {
        await updateUser(session.token.token, userId, company.id, payload)
      } else {
        await createUser(session.token.token, company.id, payload)
      }
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o usuário.')
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
          Voltar para usuários
        </button>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Conta</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">
          {userId ? 'Editar usuário' : 'Novo usuário'}
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
            <h2 className="mb-4 text-[14px] font-bold text-[var(--ink)]">Dados</h2>

            <div className="mb-5 flex items-center gap-4">
              <span className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-full bg-[var(--blue-100)] text-[var(--blue-700)]">
                {avatarPreviewUrl ? (
                  <img src={avatarPreviewUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <UserIcon className="h-7 w-7" />
                )}
              </span>
              <div className="flex flex-col gap-1.5">
                <label className="flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]">
                  <PaperclipIcon className="h-3.5 w-3.5 flex-none" />
                  {avatarFile ? avatarFile.name : 'Alterar foto'}
                  <input
                    type="file"
                    accept=".jpg,.jpeg,.png,.webp"
                    className="hidden"
                    onChange={(event) => setAvatarFile(event.target.files?.[0])}
                  />
                </label>
                {avatarFile && (
                  <button
                    type="button"
                    onClick={() => setAvatarFile(undefined)}
                    className="w-fit text-[12px] font-semibold text-[var(--red-500)] hover:underline"
                  >
                    Cancelar nova foto
                  </button>
                )}
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <TextField
                label="Nome"
                icon={<UserIcon className="h-4 w-4" />}
                placeholder="Nome completo"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <TextField
                label="E-mail"
                icon={<MailIcon className="h-4 w-4" />}
                type="email"
                placeholder="usuario@empresa.com.br"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
              />
              <SelectField label="Perfil de acesso" value={roleId} onChange={(event) => setRoleId(event.target.value)}>
                <option value="">Selecione</option>
                {roles.map((role) => (
                  <option key={role.id} value={role.id}>
                    {role.name}
                  </option>
                ))}
              </SelectField>
              <TextField
                label="Código interno"
                icon={<TagIcon className="h-4 w-4" />}
                placeholder="Gerado automaticamente se deixado em branco"
                inputMode="numeric"
                value={internalCode}
                onChange={(event) => setInternalCode(event.target.value.replace(/\D/g, ''))}
              />

              {!userId && (
                <div className="sm:col-span-2">
                  <PasswordField
                    label="Senha"
                    placeholder="Mínimo de 6 caracteres"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                  />
                </div>
              )}

              {userId && (
                <p className="sm:col-span-2 flex items-center gap-1.5 text-[12.5px] text-[var(--muted)]">
                  <BadgeIcon className="h-3.5 w-3.5 flex-none" />
                  A senha não pode ser alterada por aqui.
                </p>
              )}
            </div>
          </div>

          <SectionCard
            title="Empresas vinculadas"
            subtitle="Empresas que este usuário pode acessar"
            defaultCollapsed
          >
            <div className="flex flex-col gap-2">
              {linkedCompanies.map((linked) => (
                <div
                  key={linked.id}
                  className="flex items-center justify-between gap-3 rounded-xl border border-[var(--border)] p-3"
                >
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-[var(--ink)]">{linked.label}</p>
                    <p className="truncate text-[11.5px] text-[var(--muted)]">
                      {linked.sub || (linked.id === company.id ? 'Empresa atual' : '—')}
                    </p>
                  </div>
                  {linked.id !== company.id && (
                    <button
                      type="button"
                      onClick={() => removeLinkedCompany(linked.id)}
                      className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--red-100)] hover:text-[var(--red-500)]"
                      aria-label={`Desvincular ${linked.label}`}
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            <div className="mt-3">
              <SearchSelectField
                label="Adicionar empresa"
                placeholder={isMaster ? 'Buscar qualquer empresa do sistema' : 'Buscar entre suas empresas'}
                selectedLabel={null}
                onSearch={(query) =>
                  fetchCompanies(
                    session.token.token,
                    isMaster ? { search: query, scope: 'all', companyId: company.id } : { search: query }
                  ).then((res) => res.data)
                }
                getOptionLabel={(item: CompanyRecord) => item.name}
                getOptionSubLabel={(item: CompanyRecord) => item.document}
                onSelect={(item: CompanyRecord) => addLinkedCompany(item)}
                onClear={() => {}}
              />
            </div>
          </SectionCard>

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
              {submitting ? 'Salvando…' : 'Salvar usuário'}
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
