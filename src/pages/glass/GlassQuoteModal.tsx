import { useEffect, useState } from 'react'
import {
  fetchGlassQuoteSettings,
  GLASS_QUOTE_OPTION_LABELS,
  printGlassQuote,
  saveGlassQuoteSettings,
  sendGlassQuote,
  type GlassOrderRecord,
  type GlassQuoteSettings,
} from '../../lib/glass'
import { fetchCompanyWhatsapps, type CompanyWhatsappRecord } from '../../lib/companyWhatsapp'
import { ApiError } from '../../lib/api'
import { SelectField } from '../../components/form/SelectField'
import { CloseIcon, PrinterIcon, WhatsappIcon } from '../../components/icons'
import type { AuthCompany, AuthSession } from '../../lib/auth'

interface GlassQuoteModalProps {
  open: boolean
  session: AuthSession
  company: AuthCompany
  order: Pick<GlassOrderRecord, 'id' | 'code' | 'people'> | null
  onClose: () => void
  onNotice?: (message: string) => void
}

// Orçamento impresso: escolhe o que aparece (sim/não), visualiza o PDF para
// imprimir e envia pelo WhatsApp. "Salvar como padrão" vale para os próximos.
export function GlassQuoteModal({ open, session, company, order, onClose, onNotice }: GlassQuoteModalProps) {
  const token = session.token.token
  const [settings, setSettings] = useState<GlassQuoteSettings | null>(null)
  const [whatsapps, setWhatsapps] = useState<CompanyWhatsappRecord[]>([])
  const [whatsappId, setWhatsappId] = useState('')
  const [busy, setBusy] = useState<'print' | 'send' | 'save' | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [message, setMessage] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setError(null)
    setMessage(null)
    setWhatsappId('')
    fetchGlassQuoteSettings(token, company.id)
      .then(setSettings)
      .catch((err) => {
        setSettings(null)
        setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as opções do orçamento.')
      })
    fetchCompanyWhatsapps(token, company.id, { limit: 100 })
      .then((res) => setWhatsapps((res.data || []).filter((whatsapp) => !whatsapp.official_whatsapp)))
      .catch(() => setWhatsapps([]))
  }, [open, token, company.id])

  if (!open || !order) return null

  function toggle(key: keyof GlassQuoteSettings['options'], value: boolean) {
    setSettings((current) => (current ? { ...current, options: { ...current.options, [key]: value } } : current))
  }

  async function run(kind: 'print' | 'send' | 'save', action: () => Promise<void>) {
    if (!settings || busy) return
    setBusy(kind)
    setError(null)
    setMessage(null)
    try {
      await action()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível concluir a operação.')
    } finally {
      setBusy(null)
    }
  }

  function handlePrint() {
    // A janela é aberta no clique (antes da espera) para o navegador não bloquear.
    const popup = window.open('', '_blank')
    void run('print', async () => {
      try {
        const { url } = await printGlassQuote(token, order!.id, settings!)
        if (popup) popup.location.href = url
        else window.open(url, '_blank')
      } catch (err) {
        popup?.close()
        throw err
      }
    })
  }

  const handleSend = () =>
    run('send', async () => {
      if (!whatsappId) throw new ApiError('Selecione o WhatsApp que vai enviar.', 400)
      await sendGlassQuote(token, order!.id, whatsappId, settings!)
      const text = 'Orçamento colocado na fila de envio do WhatsApp.'
      setMessage(text)
      onNotice?.(text)
    })

  const handleSave = () =>
    run('save', async () => {
      await saveGlassQuoteSettings(token, company.id, settings!)
      setMessage('Opções salvas como padrão para os próximos orçamentos.')
    })

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-[720px] overflow-y-auto rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[17px] font-bold text-[var(--ink)]">Orçamento nº {order.code}</h2>
            <p className="mt-0.5 text-[12px] text-[var(--muted)]">
              {order.people?.name ?? 'Sem cliente'} · escolha o que aparece no orçamento impresso.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        {!settings ? (
          <p className="py-10 text-center text-[13px] text-[var(--muted)]">{error ?? 'Carregando…'}</p>
        ) : (
          <>
            <div className="mt-4 grid gap-x-6 gap-y-2.5 rounded-xl bg-[var(--page)] p-4 sm:grid-cols-2 lg:grid-cols-3">
              {GLASS_QUOTE_OPTION_LABELS.map((option) => (
                <label key={option.key} className="flex items-center gap-2.5">
                  <input
                    type="checkbox"
                    checked={settings.options[option.key]}
                    onChange={(event) => toggle(option.key, event.target.checked)}
                    className="h-4 w-4 accent-[var(--blue-500)]"
                  />
                  <span className="text-[13px] text-[var(--ink)]">{option.label}</span>
                </label>
              ))}
            </div>

            <label className="mt-4 flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Observações do orçamento</span>
              <textarea
                rows={3}
                value={settings.observations}
                onChange={(event) => setSettings({ ...settings, observations: event.target.value })}
                placeholder="Prazo de execução, garantia, condições…"
                className="resize-y rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--blue-300)]"
              />
            </label>

            <label className="mt-4 flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Mensagem do WhatsApp</span>
              <textarea
                rows={3}
                value={settings.whatsapp_message}
                onChange={(event) => setSettings({ ...settings, whatsapp_message: event.target.value })}
                className="resize-y rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--blue-300)]"
              />
              <span className="text-[11.5px] text-[var(--muted)]">
                Use {'<<nome_cliente>>'}, {'<<nmr_orcamento>>'}, {'<<nome_empresa>>'} e {'<<relatorio>>'} (link do PDF).
              </span>
            </label>

            <div className="mt-4 max-w-[360px]">
              <SelectField label="WhatsApp para envio" value={whatsappId} onChange={(event) => setWhatsappId(event.target.value)}>
                <option value="">Selecione</option>
                {whatsapps.map((whatsapp) => (
                  <option key={whatsapp.id} value={whatsapp.id}>
                    {whatsapp.name} - {whatsapp.phone}
                  </option>
                ))}
              </SelectField>
            </div>
          </>
        )}

        {error && settings && (
          <p className="mt-3 rounded-xl bg-[var(--red-100)] px-4 py-2.5 text-[13px] font-medium text-[var(--red-500)]">{error}</p>
        )}
        {message && (
          <p className="mt-3 rounded-xl bg-[var(--blue-100)] px-4 py-2.5 text-[13px] font-medium text-[var(--blue-700)]">{message}</p>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={!settings || busy !== null}
            className="rounded-xl px-4 py-2.5 text-[13.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-60"
          >
            {busy === 'save' ? 'Salvando…' : 'Salvar como padrão'}
          </button>
          <button
            type="button"
            onClick={handleSend}
            disabled={!settings || busy !== null}
            className="flex items-center gap-2 rounded-xl bg-[var(--page)] px-5 py-2.5 text-[14px] font-bold text-[var(--blue-700)] transition hover:bg-[var(--blue-100)] disabled:opacity-60"
          >
            <WhatsappIcon className="h-4 w-4" />
            {busy === 'send' ? 'Enviando…' : 'Enviar por WhatsApp'}
          </button>
          <button
            type="button"
            onClick={handlePrint}
            disabled={!settings || busy !== null}
            className="flex items-center gap-2 rounded-xl bg-[var(--blue-500)] px-6 py-2.5 text-[14px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
          >
            <PrinterIcon className="h-4 w-4" />
            {busy === 'print' ? 'Gerando…' : 'Visualizar / imprimir'}
          </button>
        </div>
      </div>
    </div>
  )
}
