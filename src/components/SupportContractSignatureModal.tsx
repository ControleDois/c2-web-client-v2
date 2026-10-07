import { useEffect, useState } from 'react'
import { fetchSupportContractSignatureEvidence, type SignatureEvidence } from '../lib/supportContracts'
import { fetchLoanSignatureEvidence } from '../lib/sales'
import { fetchTowingSignatureEvidence } from '../lib/towingSale'
import { ApiError } from '../lib/api'
import { CloseIcon } from './icons'
import type { AuthSession } from '../lib/auth'

interface SupportContractSignatureModalProps {
  open: boolean
  session: AuthSession
  contract: { id: string; people?: { name?: string | null } | null } | null
  flow?: 'support' | 'loan' | 'towing'
  onClose: () => void
}

function formatDateTime(value?: string | null) {
  if (!value) return '—'
  return new Intl.DateTimeFormat('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'medium',
    timeZone: 'America/Cuiaba',
  }).format(new Date(value))
}

function Detail({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">{label}</p>
      <div className="mt-0.5 text-[13px] break-words text-[var(--ink)]">{children}</div>
    </div>
  )
}

export function SupportContractSignatureModal({
  open,
  session,
  contract,
  flow = 'support',
  onClose,
}: SupportContractSignatureModalProps) {
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [signature, setSignature] = useState<SignatureEvidence | null>(null)

  useEffect(() => {
    if (!open || !contract) return
    let cancelled = false
    setLoading(true)
    setError(null)
    setSignature(null)

    const fetchEvidence =
      flow === 'loan'
        ? fetchLoanSignatureEvidence
        : flow === 'towing'
          ? fetchTowingSignatureEvidence
          : fetchSupportContractSignatureEvidence
    fetchEvidence(session.token.token, contract.id)
      .then((res) => {
        if (!cancelled) setSignature(res.signature)
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof ApiError ? err.message : 'Não foi possível carregar a assinatura.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [open, contract, flow, session.token.token])

  if (!open || !contract) return null

  const hasLocation = signature?.latitude != null && signature?.longitude != null
  const mapsUrl = hasLocation ? `https://www.google.com/maps?q=${signature?.latitude},${signature?.longitude}` : null
  const channelLabel = signature?.verifiedChannel === 'email' ? 'E-mail' : 'WhatsApp'
  const isNative = signature?.provider === 'nativo'

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[90svh] w-full max-w-[560px] overflow-y-auto rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[15px] font-bold text-[var(--ink)]">Facial e assinatura</h2>
            <p className="mt-1 text-[12.5px] text-[var(--ink-soft)]">
              {contract.people?.name ??
                (flow === 'loan' ? 'Contrato de empréstimo' : flow === 'towing' ? 'Contrato de guincho' : 'Contrato de suporte')}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
            aria-label="Fechar"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {loading ? (
          <p className="py-10 text-center text-[13px] text-[var(--muted)]">Carregando…</p>
        ) : error ? (
          <p className="py-10 text-center text-[13px] font-medium text-[var(--red-500)]">{error}</p>
        ) : !signature || signature.status !== 2 ? (
          <p className="py-10 text-center text-[13px] text-[var(--muted)]">Este contrato ainda não foi assinado.</p>
        ) : !isNative ? (
          <p className="py-10 text-center text-[13px] text-[var(--muted)]">
            Este contrato foi assinado pelo Autentique, que não registra facial por aqui.
          </p>
        ) : (
          <div className="mt-5 flex flex-col gap-5">
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Facial</p>
                {signature.selfieUrl ? (
                  <a href={signature.selfieUrl} target="_blank" rel="noreferrer">
                    <img
                      src={signature.selfieUrl}
                      alt="Foto da facial"
                      className="w-full rounded-xl border border-[var(--border)] bg-black object-contain"
                    />
                  </a>
                ) : (
                  <p className="text-[12.5px] text-[var(--muted)]">Facial não exigida nesta assinatura.</p>
                )}
              </div>
              <div>
                <p className="mb-1.5 text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Rubrica</p>
                {signature.signatureImageUrl ? (
                  <img
                    src={signature.signatureImageUrl}
                    alt="Rubrica do cliente"
                    className="w-full rounded-xl border border-[var(--border)] bg-white object-contain p-2"
                  />
                ) : (
                  <p className="text-[12.5px] text-[var(--muted)]">Sem rubrica registrada.</p>
                )}
              </div>
            </div>

            <div className="grid gap-3 rounded-xl bg-[var(--page)] p-4 sm:grid-cols-2">
              <Detail label="Assinante">{signature.signerName || '—'}</Detail>
              <Detail label="Data e hora (Cuiabá)">{formatDateTime(signature.signedAt)}</Detail>
              <Detail label="Verificação">
                {signature.verifiedChannel
                  ? `${channelLabel} — ${signature.verifiedChannel === 'email' ? signature.signerEmail : signature.signerPhone}`
                  : 'Código não exigido — assinou pelo link'}
              </Detail>
              <Detail label="Endereço IP">{signature.ipAddress || '—'}</Detail>
              <div className="sm:col-span-2">
                <Detail label="Localização (GPS)">
                  {hasLocation ? (
                    <>
                      {Number(signature.latitude).toFixed(6)}, {Number(signature.longitude).toFixed(6)}
                      {signature.locationAccuracy != null &&
                        ` (±${Math.round(Number(signature.locationAccuracy))} m)`}{' '}
                      <a
                        href={mapsUrl ?? '#'}
                        target="_blank"
                        rel="noreferrer"
                        className="font-semibold text-[var(--blue-500)] hover:underline"
                      >
                        Ver no mapa
                      </a>
                    </>
                  ) : (
                    'Não registrada'
                  )}
                </Detail>
              </div>
              <div className="sm:col-span-2">
                <Detail label="Dispositivo">{signature.userAgent || '—'}</Detail>
              </div>
            </div>

            {signature.fileUrl && (
              <a
                href={signature.fileUrl}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-[var(--blue-500)] px-4 py-3 text-center text-[13.5px] font-bold text-white hover:bg-[var(--blue-700)]"
              >
                Abrir contrato assinado (com página de registro)
              </a>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
