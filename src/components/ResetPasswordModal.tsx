import { useEffect, useState } from 'react'
import { resetUserPassword } from '../lib/users'
import { ApiError } from '../lib/api'
import { TextField } from './form/TextField'
import { CloseIcon, CopyIcon, KeyIcon } from './icons'
import type { AuthSession } from '../lib/auth'

interface ResetPasswordModalProps {
  open: boolean
  session: AuthSession
  companyId: string
  user: { id: string; name: string; email: string } | null
  onClose: () => void
}

// Equipe da matriz: troca rápida da senha de um usuário que esqueceu. Gera uma senha fácil de ditar
// ou aceita uma digitada.
export function ResetPasswordModal({ open, session, companyId, user, onClose }: ResetPasswordModalProps) {
  const [custom, setCustom] = useState(false)
  const [password, setPassword] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    if (!open) return
    setCustom(false)
    setPassword('')
    setError(null)
    setResult(null)
    setCopied(false)
  }, [open, user?.id])

  if (!open || !user) return null

  async function handleSave() {
    if (!user) return
    setSaving(true)
    setError(null)
    try {
      const res = await resetUserPassword(session.token.token, user.id, companyId, custom ? password.trim() : undefined)
      setResult(res.password ?? password.trim())
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível alterar a senha.')
    } finally {
      setSaving(false)
    }
  }

  async function handleCopy() {
    if (!result) return
    try {
      await navigator.clipboard.writeText(result)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div className="w-full max-w-[460px] rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 className="text-[16px] font-bold text-[var(--ink)]">Alterar senha</h2>
            <p className="mt-0.5 truncate text-[12.5px] text-[var(--ink-soft)]">
              {user.name} · {user.email}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        {result ? (
          <div className="mt-5 flex flex-col gap-3">
            <p className="text-[13px] font-semibold text-[var(--green-600)]">Senha alterada. Passe esta senha ao usuário:</p>
            <div className="flex items-center gap-2 rounded-xl bg-[var(--page)] px-4 py-3">
              <span className="flex-1 font-mono text-[20px] font-bold tracking-wider break-all text-[var(--ink)]">{result}</span>
              <button
                type="button"
                onClick={() => void handleCopy()}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-2 text-[12.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
              >
                <CopyIcon className="h-4 w-4" />
                {copied ? 'Copiada' : 'Copiar'}
              </button>
            </div>
            <p className="text-[12px] text-[var(--muted)]">
              A senha só aparece agora. Se o usuário estava logado, a sessão antiga foi encerrada. A troca fica registrada no histórico de auditoria.
            </p>
            <button
              type="button"
              onClick={onClose}
              className="rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white hover:bg-[var(--blue-700)]"
            >
              Fechar
            </button>
          </div>
        ) : (
          <div className="mt-5 flex flex-col gap-4">
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => setCustom(false)}
                className={`rounded-xl border-2 px-3 py-3 text-left text-[13px] font-bold transition ${
                  !custom ? 'border-[var(--blue-500)] bg-[var(--blue-100)] text-[var(--blue-700)]' : 'border-[var(--border)] text-[var(--ink-soft)]'
                }`}
              >
                Gerar uma senha
                <span className="mt-0.5 block text-[11.5px] font-medium opacity-80">Fácil de ditar, sem letras que confundem</span>
              </button>
              <button
                type="button"
                onClick={() => setCustom(true)}
                className={`rounded-xl border-2 px-3 py-3 text-left text-[13px] font-bold transition ${
                  custom ? 'border-[var(--blue-500)] bg-[var(--blue-100)] text-[var(--blue-700)]' : 'border-[var(--border)] text-[var(--ink-soft)]'
                }`}
              >
                Digitar a senha
                <span className="mt-0.5 block text-[11.5px] font-medium opacity-80">Você escolhe qual</span>
              </button>
            </div>

            {custom && (
              <TextField
                label="Nova senha (mínimo 6 caracteres)"
                icon={<KeyIcon className="h-4 w-4" />}
                type="text"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                autoFocus
              />
            )}

            {error && <p className="text-[13px] font-medium text-[var(--red-500)]">{error}</p>}

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-[13.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                disabled={saving || (custom && password.trim().length < 6)}
                className="rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white hover:bg-[var(--blue-700)] disabled:opacity-60"
              >
                {saving ? 'Salvando…' : custom ? 'Salvar senha' : 'Gerar e salvar'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
