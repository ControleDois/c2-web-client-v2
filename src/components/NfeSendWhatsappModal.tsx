import { useCallback, useEffect, useState } from 'react'
import { sendNfeWhatsapp, type NfeRecord } from '../lib/nfes'
import { fetchCompanyWhatsapps, type CompanyWhatsappRecord } from '../lib/companyWhatsapp'
import { fetchPeople, fetchPerson, type PersonRecord } from '../lib/people'
import { formatPhone } from '../lib/formatPhone'
import { formatDocument } from '../lib/formatDocument'
import { ApiError } from '../lib/api'
import { Select } from './form/Select'
import { SearchSelectField } from './form/SearchSelectField'
import { TextField } from './form/TextField'
import { CloseIcon, UserIcon, WhatsappIcon } from './icons'
import type { AuthCompany, AuthSession } from '../lib/auth'

interface NfeSendWhatsappModalProps {
  open: boolean
  session: AuthSession
  company: AuthCompany
  nfe: NfeRecord | null
  onClose: () => void
  onSent: (message: string) => void
}

interface Client {
  id: string
  label: string
  sub?: string
}

// Envia o PDF da nota autorizada (DANFE/cupom) para o WhatsApp do cliente: escolhe
// o WhatsApp que envia, o cliente e o número (que pode ser digitado na hora).
export function NfeSendWhatsappModal({ open, session, company, nfe, onClose, onSent }: NfeSendWhatsappModalProps) {
  const token = session.token.token
  const [whatsapps, setWhatsapps] = useState<CompanyWhatsappRecord[]>([])
  const [whatsappId, setWhatsappId] = useState('')
  const [client, setClient] = useState<Client | null>(null)
  const [phone, setPhone] = useState('')
  const [message, setMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const nfeId = nfe?.id
  useEffect(() => {
    if (!open || !nfe) return
    setError(null)
    setMessage('')
    setPhone('')
    setClient(nfe.people ? { id: nfe.people.id, label: nfe.people.name, sub: nfe.people.document } : null)
    setWhatsappId(() => {
      try {
        return localStorage.getItem(`c2_nfe_whatsapp_${company.id}`) ?? ''
      } catch {
        return ''
      }
    })
    setLoading(true)
    let cancelled = false
    fetchCompanyWhatsapps(token, company.id, { limit: 100 })
      .then((res) => {
        if (cancelled) return
        const usable = (res.data || []).filter((whatsapp) => !whatsapp.official_whatsapp)
        setWhatsapps(usable)
        setWhatsappId((current) => (usable.some((item) => item.id === current) ? current : usable.length === 1 ? usable[0].id : ''))
      })
      .catch(() => setWhatsapps([]))
      .finally(() => !cancelled && setLoading(false))
    if (nfe.people?.id) {
      fetchPerson(token, nfe.people.id)
        .then((person) => !cancelled && person.phone && setPhone(String(person.phone)))
        .catch(() => undefined)
    }
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, nfeId, token, company.id])

  const searchPeople = useCallback(
    (query: string) => fetchPeople(token, company.id, { search: query, limit: 8 }).then((res) => res.data),
    [token, company.id]
  )

  if (!open || !nfe) return null

  const label = nfe.modelo === 65 ? 'NFC-e' : 'NF-e'
  const digits = phone.replace(/\D/g, '')

  async function handleSend() {
    if (!nfe) return
    if (!whatsappId) {
      setError('Escolha o WhatsApp que vai enviar a nota.')
      return
    }
    if (digits.length < 10) {
      setError('Informe o WhatsApp do cliente com DDD.')
      return
    }
    setSending(true)
    setError(null)
    try {
      const result = await sendNfeWhatsapp(token, nfe.id, {
        whatsappId,
        phone: digits,
        name: client?.label,
        message: message.trim() || undefined,
      })
      try {
        localStorage.setItem(`c2_nfe_whatsapp_${company.id}`, whatsappId)
      } catch {
        // preferência é só uma conveniência
      }
      onSent(result.message)
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : `Não foi possível enviar a ${label}.`)
    } finally {
      setSending(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/40 p-4" onClick={sending ? undefined : onClose}>
      <div
        className="max-h-[92vh] w-full max-w-[480px] overflow-y-auto rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[15px] font-bold text-[var(--ink)]">
              Enviar {label} nº {nfe.numero} pelo WhatsApp
            </h2>
            <p className="mt-1 text-[12.5px] leading-relaxed text-[var(--ink-soft)]">
              O cliente recebe o PDF da nota no WhatsApp. Escolha quem envia e confirme o número.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            aria-label="Fechar"
            className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)] disabled:opacity-60"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          <SearchSelectField
            label="Cliente"
            variant="surface"
            placeholder="Buscar por nome ou documento"
            selectedLabel={client?.label ?? null}
            selectedSubLabel={client?.sub ? formatDocument(client.sub) : undefined}
            onSearch={searchPeople}
            getOptionLabel={(item: PersonRecord) => item.name}
            getOptionSubLabel={(item: PersonRecord) => (item.document ? formatDocument(item.document) : undefined)}
            onSelect={(item: PersonRecord) => {
              setClient({ id: item.id, label: item.name, sub: item.document ?? undefined })
              if (item.phone) setPhone(String(item.phone))
            }}
            onClear={() => setClient(null)}
          />

          <TextField
            label="WhatsApp do cliente"
            icon={<UserIcon className="h-4 w-4" />}
            placeholder="(66) 99999-9999"
            inputMode="tel"
            value={formatPhone(phone)}
            onChange={(event) => setPhone(event.target.value.replace(/\D/g, '').slice(0, 11))}
          />

          <div>
            <p className="mb-1.5 text-[12px] font-semibold text-[var(--ink-soft)]">Enviar por qual WhatsApp?</p>
            {loading ? (
              <div className="h-11 animate-pulse rounded-xl bg-[var(--page)]" />
            ) : whatsapps.length === 0 ? (
              <p className="rounded-xl bg-[var(--amber-100)] px-4 py-3 text-[12.5px] text-[var(--ink)]">
                Nenhum WhatsApp conectado. Conecte um em Configurações → WhatsApp para poder enviar.
              </p>
            ) : (
              <Select value={whatsappId} onChange={setWhatsappId}>
                <option value="">Selecione</option>
                {whatsapps.map((whatsapp) => (
                  <option key={whatsapp.id} value={whatsapp.id}>
                    {whatsapp.name} - {whatsapp.phone}
                  </option>
                ))}
              </Select>
            )}
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Mensagem (opcional)</span>
            <textarea
              value={message}
              onChange={(event) => setMessage(event.target.value)}
              rows={3}
              placeholder="Deixe em branco para usar a mensagem padrão com o número e o valor da nota."
              className="rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
            />
          </label>
        </div>

        {error && <p className="mt-3 text-[13px] font-medium text-[var(--red-500)]">{error}</p>}

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={sending}
            className="h-11 flex-1 rounded-xl border border-[var(--border)] text-[13px] font-bold text-[var(--ink-soft)] disabled:opacity-60"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => void handleSend()}
            disabled={sending || whatsapps.length === 0}
            className="flex h-11 flex-1 items-center justify-center gap-2 rounded-xl bg-[var(--green-600)] text-[13px] font-bold text-white hover:opacity-90 disabled:opacity-50"
          >
            <WhatsappIcon className="h-4 w-4" />
            {sending ? 'Gerando e enviando…' : `Enviar ${label}`}
          </button>
        </div>
      </div>
    </div>
  )
}
