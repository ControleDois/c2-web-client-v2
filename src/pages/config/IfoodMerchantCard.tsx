import { useEffect, useState } from 'react'
import {
  fetchIfoodMerchants,
  connectIfoodMerchant,
  confirmIfoodMerchant,
  syncIfoodCatalog,
  deleteIfoodMerchant,
  type IfoodMerchantRecord,
  type IfoodConnectResult,
  type IfoodCatalogSyncResult,
} from '../../lib/ifood'
import { ApiError } from '../../lib/api'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { LinkIcon, CopyIcon, RefreshIcon, TrashIcon, CheckCircleIcon, ClockIcon } from '../../components/icons'
import type { AuthSession, AuthCompany } from '../../lib/auth'

interface IfoodMerchantCardProps {
  session: AuthSession
  company: AuthCompany
}

const STATUS_LABELS: Record<IfoodMerchantRecord['status'], string> = {
  pending: 'Aguardando autorização',
  authorized: 'Autorizado',
  revoked: 'Revogado',
}

const STATUS_CLASSES: Record<IfoodMerchantRecord['status'], string> = {
  pending: 'bg-[var(--page)] text-[var(--ink-soft)]',
  authorized: 'bg-[var(--green-100)] text-[var(--green-600)]',
  revoked: 'bg-[var(--red-100)] text-[var(--red-500)]',
}

export function IfoodMerchantCard({ session, company }: IfoodMerchantCardProps) {
  const token = session.token.token
  const [merchants, setMerchants] = useState<IfoodMerchantRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [connecting, setConnecting] = useState(false)
  const [freshConnect, setFreshConnect] = useState<IfoodConnectResult | null>(null)

  const [confirmingId, setConfirmingId] = useState<string | null>(null)
  const [merchantIdInput, setMerchantIdInput] = useState('')
  const [merchantNameInput, setMerchantNameInput] = useState('')
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [confirmError, setConfirmError] = useState<string | null>(null)

  const [syncingId, setSyncingId] = useState<string | null>(null)
  const [syncResult, setSyncResult] = useState<{ merchantId: string; result: IfoodCatalogSyncResult } | null>(null)
  const [syncError, setSyncError] = useState<string | null>(null)

  const [revokeTarget, setRevokeTarget] = useState<IfoodMerchantRecord | null>(null)
  const [revoking, setRevoking] = useState(false)

  function load() {
    setLoading(true)
    setError(null)
    fetchIfoodMerchants(token, company.id)
      .then(setMerchants)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as lojas conectadas.'))
      .finally(() => setLoading(false))
  }

  useEffect(load, [company.id, token])

  async function handleConnect() {
    setConnecting(true)
    setError(null)
    setFreshConnect(null)
    try {
      const result = await connectIfoodMerchant(token, company.id)
      setFreshConnect(result)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível gerar o código de autorização.')
    } finally {
      setConnecting(false)
    }
  }

  function startConfirm(merchant: IfoodMerchantRecord) {
    setConfirmingId(merchant.id)
    setMerchantIdInput('')
    setMerchantNameInput('')
    setConfirmError(null)
  }

  async function handleConfirm(merchantRecordId: string) {
    if (!merchantIdInput.trim()) {
      setConfirmError('Informe o merchantId da loja autorizada no Portal do Parceiro.')
      return
    }
    setConfirmLoading(true)
    setConfirmError(null)
    try {
      await confirmIfoodMerchant(token, merchantRecordId, {
        merchant_id: merchantIdInput.trim(),
        merchant_name: merchantNameInput.trim() || undefined,
      })
      setConfirmingId(null)
      if (freshConnect?.id === merchantRecordId) setFreshConnect(null)
      load()
    } catch (err) {
      setConfirmError(err instanceof ApiError ? err.message : 'Não foi possível confirmar a autorização.')
    } finally {
      setConfirmLoading(false)
    }
  }

  async function handleSync(merchant: IfoodMerchantRecord) {
    setSyncingId(merchant.id)
    setSyncError(null)
    setSyncResult(null)
    try {
      const result = await syncIfoodCatalog(token, merchant.id)
      setSyncResult({ merchantId: merchant.id, result })
    } catch (err) {
      setSyncError(err instanceof ApiError ? err.message : 'Não foi possível sincronizar o cardápio.')
    } finally {
      setSyncingId(null)
    }
  }

  async function handleRevoke() {
    if (!revokeTarget) return
    setRevoking(true)
    try {
      await deleteIfoodMerchant(token, revokeTarget.id)
      setRevokeTarget(null)
      load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível revogar a conexão.')
      setRevokeTarget(null)
    } finally {
      setRevoking(false)
    }
  }

  return (
    <div className="rounded-xl bg-[var(--page)] p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h4 className="flex items-center gap-1.5 text-[12.5px] font-bold text-[var(--ink)]">
          <LinkIcon className="h-3.5 w-3.5" /> iFood
        </h4>
        <button
          type="button"
          onClick={handleConnect}
          disabled={connecting}
          className="rounded-lg bg-[var(--blue-500)] px-3 py-1.5 text-[11.5px] font-bold text-white hover:bg-[var(--blue-700)] disabled:opacity-60"
        >
          {connecting ? 'Gerando código…' : '+ Conectar loja'}
        </button>
      </div>

      {error && <p className="mb-3 text-[12px] font-medium text-[var(--red-500)]">{error}</p>}

      {freshConnect && (
        <div className="mb-4 rounded-xl border border-[var(--blue-300)] bg-[var(--surface)] p-3.5">
          <p className="text-[12px] font-semibold text-[var(--ink)]">
            1. Copie o código abaixo e abra o Portal do Parceiro do iFood pra autorizar
          </p>
          <div className="mt-2 flex items-center gap-2">
            <code className="flex-1 truncate rounded-lg bg-[var(--page)] px-3 py-2 text-[15px] font-bold tracking-wide text-[var(--blue-700)]">
              {freshConnect.user_code}
            </code>
            <button
              type="button"
              onClick={() => navigator.clipboard?.writeText(freshConnect.user_code)}
              className="flex h-9 w-9 flex-none items-center justify-center rounded-lg border border-[var(--border)] text-[var(--ink-soft)] hover:text-[var(--ink)]"
              title="Copiar código"
            >
              <CopyIcon className="h-4 w-4" />
            </button>
          </div>
          <a
            href={freshConnect.verification_url_complete}
            target="_blank"
            rel="noreferrer"
            className="mt-2 inline-block text-[12px] font-semibold text-[var(--blue-700)] hover:underline"
          >
            Abrir Portal do Parceiro do iFood →
          </a>
          <p className="mt-2 text-[11px] text-[var(--muted)]">
            Depois que o dono ou um usuário com permissão "Owner" autorizar no Portal do Parceiro, volte aqui e clique
            em "Confirmar" na linha correspondente abaixo.
          </p>
        </div>
      )}

      {loading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 2 }).map((_, index) => (
            <div key={index} className="h-14 animate-pulse rounded-xl bg-[var(--surface)]" />
          ))}
        </div>
      ) : merchants.length === 0 ? (
        <p className="text-[12.5px] text-[var(--muted)]">Nenhuma loja conectada ainda.</p>
      ) : (
        <div className="flex flex-col gap-2.5">
          {merchants.map((merchant) => (
            <div key={merchant.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="min-w-0">
                  <p className="truncate text-[13px] font-bold text-[var(--ink)]">
                    {merchant.merchant_name || merchant.merchant_id || 'Loja em autorização'}
                  </p>
                  {merchant.merchant_id && (
                    <p className="truncate text-[11px] text-[var(--muted)]">merchantId: {merchant.merchant_id}</p>
                  )}
                </div>
                <span
                  className={`flex flex-none items-center gap-1 rounded-full px-2.5 py-1 text-[10.5px] font-bold ${STATUS_CLASSES[merchant.status]}`}
                >
                  {merchant.status === 'authorized' ? (
                    <CheckCircleIcon className="h-3 w-3" />
                  ) : (
                    <ClockIcon className="h-3 w-3" />
                  )}
                  {STATUS_LABELS[merchant.status]}
                </span>
              </div>

              <div className="mt-2.5 flex flex-wrap items-center gap-2">
                {merchant.status === 'pending' && confirmingId !== merchant.id && (
                  <button
                    type="button"
                    onClick={() => startConfirm(merchant)}
                    className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[11.5px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]"
                  >
                    Confirmar autorização
                  </button>
                )}
                {merchant.status === 'authorized' && (
                  <button
                    type="button"
                    onClick={() => handleSync(merchant)}
                    disabled={syncingId === merchant.id}
                    className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3 py-1.5 text-[11.5px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-60"
                  >
                    <RefreshIcon className="h-3.5 w-3.5" />
                    {syncingId === merchant.id ? 'Sincronizando…' : 'Sincronizar cardápio'}
                  </button>
                )}
                {merchant.status !== 'revoked' && (
                  <button
                    type="button"
                    onClick={() => setRevokeTarget(merchant)}
                    className="flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-[11.5px] font-bold text-[var(--red-500)] hover:bg-[var(--red-100)]"
                  >
                    <TrashIcon className="h-3.5 w-3.5" />
                    Revogar
                  </button>
                )}
              </div>

              {confirmingId === merchant.id && (
                <div className="mt-3 rounded-lg bg-[var(--page)] p-3">
                  <div className="grid gap-2.5 sm:grid-cols-2">
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold text-[var(--ink-soft)]">merchantId (iFood)</span>
                      <input
                        type="text"
                        value={merchantIdInput}
                        onChange={(event) => setMerchantIdInput(event.target.value)}
                        className="rounded-lg bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)]"
                      />
                    </label>
                    <label className="flex flex-col gap-1">
                      <span className="text-[11px] font-semibold text-[var(--ink-soft)]">Nome da loja (opcional)</span>
                      <input
                        type="text"
                        value={merchantNameInput}
                        onChange={(event) => setMerchantNameInput(event.target.value)}
                        className="rounded-lg bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)]"
                      />
                    </label>
                  </div>
                  {confirmError && <p className="mt-2 text-[11.5px] font-medium text-[var(--red-500)]">{confirmError}</p>}
                  <div className="mt-2.5 flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleConfirm(merchant.id)}
                      disabled={confirmLoading}
                      className="rounded-lg bg-[var(--blue-500)] px-3 py-1.5 text-[11.5px] font-bold text-white hover:bg-[var(--blue-700)] disabled:opacity-60"
                    >
                      {confirmLoading ? 'Confirmando…' : 'Confirmar'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingId(null)}
                      className="rounded-lg px-3 py-1.5 text-[11.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
                    >
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              {syncResult?.merchantId === merchant.id && (
                <p className="mt-2 text-[11.5px] font-medium text-[var(--green-600)]">
                  {syncResult.result.synced} de {syncResult.result.total} produtos sincronizados
                  {syncResult.result.failed.length > 0 && ` · ${syncResult.result.failed.length} com erro`}
                </p>
              )}
              {syncError && syncingId === null && <p className="mt-2 text-[11.5px] font-medium text-[var(--red-500)]">{syncError}</p>}
            </div>
          ))}
        </div>
      )}

      <ConfirmDialog
        open={Boolean(revokeTarget)}
        title="Revogar conexão"
        message={`Tem certeza que deseja revogar a conexão com "${revokeTarget?.merchant_name || revokeTarget?.merchant_id}"? Pedidos novos dessa loja no iFood vão parar de chegar automaticamente.`}
        confirmLabel="Revogar"
        loading={revoking}
        onConfirm={handleRevoke}
        onCancel={() => setRevokeTarget(null)}
      />
    </div>
  )
}
