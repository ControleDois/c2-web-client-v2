import { useEffect, useMemo, useState, type FormEvent } from 'react'
import { createUser, fetchUser, updateUser } from '../lib/users'
import { fetchRoles, type RoleRecord } from '../lib/roles'
import { ApiError } from '../lib/api'
import { TextField } from '../components/form/TextField'
import { PasswordField } from '../components/form/PasswordField'
import { SelectField } from '../components/form/SelectField'
import { MailIcon, BadgeIcon, TagIcon, UserIcon, PaperclipIcon, ChevronLeftIcon } from '../components/icons'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface UserFormPageProps {
  session: AuthSession
  company: AuthCompany
  userId?: string
  onBack: () => void
  onSaved: () => void
}

export function UserFormPage({ session, company, userId, onBack, onSaved }: UserFormPageProps) {
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
      companies: [company.id],
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
