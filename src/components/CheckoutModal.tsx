import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { TextField } from './form/TextField'
import { BuildingIcon, CheckCircleIcon, CloseIcon, CopyIcon, FileTextIcon, MailIcon } from './icons'
import {
  createCheckout,
  fetchPlanOrder,
  saveBillingData,
  type PlanCycle,
  type PlanOrderInfo,
  type PublicPlan,
  type SubscriptionSummary,
} from '../lib/subscription'
import { fetchCnpjData } from '../lib/cnpjLookup'
import { fetchCepData } from '../lib/cepLookup'
import { isValidCnpj, isValidCpf } from '../lib/document'
import { formatDocument } from '../lib/formatDocument'
import { formatCep } from '../lib/formatCep'
import { BRAZIL_STATES } from '../lib/brazilStates'
import { formatCurrency, formatDate } from '../lib/format'
import { contactLink } from '../lib/licenseState'
import { ApiError } from '../lib/api'
import type { AuthCompany, AuthSession } from '../lib/auth'

interface CheckoutModalProps {
  session: AuthSession
  company: AuthCompany
  plan: PublicPlan
  cycle: PlanCycle
  onClose: () => void
  onActivated: (summary: SubscriptionSummary) => void
}

type Phase = 'loading' | 'data' | 'pix' | 'paid' | 'error' | 'offline'

// Compra do plano sem sair do sistema: confere os dados de cobrança, gera o PIX (e o boleto) e espera o pagamento.
export function CheckoutModal({ session, company, plan, cycle, onClose, onActivated }: CheckoutModalProps) {
  const token = session.token.token
  const address = (company.people?.address ?? {}) as Record<string, string | null | undefined>

  const [phase, setPhase] = useState<Phase>('loading')
  const [order, setOrder] = useState<PlanOrderInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [qr, setQr] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [summary, setSummary] = useState<SubscriptionSummary | null>(null)

  const [document, setDocument] = useState(company.people?.document ? formatDocument(company.people.document) : '')
  const [email, setEmail] = useState(typeof company.people?.email === 'string' ? company.people.email : session.user.email)
  const [zipCode, setZipCode] = useState(address.zip_code ? formatCep(address.zip_code) : '')
  const [street, setStreet] = useState(address.address ?? '')
  const [number, setNumber] = useState(address.number ?? '')
  const [district, setDistrict] = useState(address.district ?? '')
  const [city, setCity] = useState(address.city ?? '')
  const [state, setState] = useState(address.state ?? '')
  const [codeIbge, setCodeIbge] = useState(address.code_ibge ?? '')
  const [lookupMessage, setLookupMessage] = useState<string | null>(null)
  const [savingData, setSavingData] = useState(false)
  const started = useRef(false)

  const price = (cycle === 'yearly' ? plan.yearly : plan.monthly)?.price ?? 0
  const documentDigits = document.replace(/\D/g, '')

  async function start() {
    setPhase('loading')
    setError(null)
    try {
      const created = await createCheckout(token, { company_id: company.id, plan_id: plan.id, cycle })
      setOrder(created)
      setPhase(created.status === 'paid' ? 'paid' : 'pix')
    } catch (err) {
      if (err instanceof ApiError && (err.body as { code?: string } | null)?.code === 'E_BILLING_DATA') {
        setPhase('data')
        return
      }
      // Pagamento online fora do ar: a venda não pode se perder, então a compra vira um pedido pelo WhatsApp.
      if (err instanceof ApiError && err.status === 503) {
        setPhase('offline')
        return
      }
      setError(err instanceof ApiError ? err.message : 'Não foi possível gerar o pagamento. Tente novamente.')
      setPhase('error')
    }
  }

  useEffect(() => {
    if (started.current) return
    started.current = true
    void start()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (!order?.pix_copy_paste) return
    let cancelled = false
    QRCode.toDataURL(order.pix_copy_paste, { margin: 1, width: 220 })
      .then((url) => {
        if (!cancelled) setQr(url)
      })
      .catch(() => undefined)
    return () => {
      cancelled = true
    }
  }, [order?.pix_copy_paste])

  // Confere o pagamento a cada poucos segundos; o plano é ativado assim que a Cora confirma.
  useEffect(() => {
    if (phase !== 'pix' || !order) return
    const timer = setInterval(() => {
      fetchPlanOrder(token, company.id, order.id)
        .then((result) => {
          if (result.order.status === 'paid') {
            setSummary(result.summary)
            setOrder(result.order)
            setPhase('paid')
            onActivated(result.summary)
          }
        })
        .catch(() => undefined)
    }, 4000)
    return () => clearInterval(timer)
  }, [phase, order, token, company.id, onActivated])

  useEffect(() => {
    if (documentDigits.length !== 14 || !isValidCnpj(documentDigits)) return
    let cancelled = false
    setLookupMessage('Buscando os dados do CNPJ…')
    fetchCnpjData(documentDigits)
      .then((result) => {
        if (cancelled) return
        setEmail((current) => current || result.email)
        setZipCode((current) => current || (result.zipCode ? formatCep(result.zipCode) : ''))
        setStreet((current) => current || result.street)
        setNumber((current) => current || result.number)
        setDistrict((current) => current || result.district)
        setCity((current) => current || result.city)
        setState((current) => current || result.state)
        setCodeIbge((current) => current || result.codeIbge)
        setLookupMessage(`Dados encontrados: ${result.socialName || result.name}`)
      })
      .catch(() => {
        if (!cancelled) setLookupMessage('Não encontramos esse CNPJ; preencha à mão.')
      })
    return () => {
      cancelled = true
    }
  }, [documentDigits])

  async function handleCep(value: string) {
    setZipCode(formatCep(value))
    const digits = value.replace(/\D/g, '')
    if (digits.length !== 8) return
    try {
      const result = await fetchCepData(digits)
      setStreet((current) => result.street || current)
      setDistrict((current) => result.district || current)
      setCity((current) => result.city || current)
      setState((current) => result.state || current)
      setCodeIbge(result.codeIbge || '')
    } catch {
      // CEP não encontrado: segue à mão
    }
  }

  async function submitData() {
    setError(null)
    if (!isValidCpf(documentDigits) && !isValidCnpj(documentDigits)) {
      setError('Informe um CPF ou CNPJ válido.')
      return
    }
    if (!email.trim()) {
      setError('Informe o e-mail para receber o comprovante.')
      return
    }
    if (zipCode.replace(/\D/g, '').length !== 8 || !street.trim() || !city.trim() || state.length !== 2) {
      setError('Informe o CEP, a rua, a cidade e o estado.')
      return
    }
    setSavingData(true)
    try {
      await saveBillingData(token, {
        company_id: company.id,
        document: documentDigits,
        email: email.trim(),
        address: {
          zip_code: zipCode.replace(/\D/g, ''),
          address: street,
          number: number || null,
          district: district || null,
          city,
          state,
          code_ibge: codeIbge || null,
        },
      })
      await start()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar os dados.')
    } finally {
      setSavingData(false)
    }
  }

  async function copyPix() {
    if (!order?.pix_copy_paste) return
    try {
      await navigator.clipboard.writeText(order.pix_copy_paste)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // sem permissão: a pessoa copia pelo campo
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4" onClick={phase === 'paid' ? undefined : onClose}>
      <div
        className="max-h-[92vh] w-full max-w-lg overflow-y-auto rounded-3xl bg-[var(--surface)] p-6 shadow-xl sm:p-7"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Assinar plano</p>
            <h2 className="mt-0.5 text-[19px] font-bold text-[var(--ink)]">
              {plan.name} · {cycle === 'yearly' ? 'anual' : 'mensal'}
            </h2>
            <p className="text-[13px] text-[var(--ink-soft)]">{formatCurrency(price)}</p>
          </div>
          {phase !== 'paid' && (
            <button type="button" onClick={onClose} aria-label="Fechar" className="text-[var(--muted)] hover:text-[var(--ink)]">
              <CloseIcon className="h-5 w-5" />
            </button>
          )}
        </div>

        {phase === 'loading' && (
          <div className="flex flex-col items-center gap-3 py-12">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--blue-300)] border-t-[var(--blue-500)]" />
            <p className="text-[13px] text-[var(--ink-soft)]">Gerando o seu pagamento…</p>
          </div>
        )}

        {phase === 'offline' && (
          <div className="py-6">
            <p className="text-[14px] leading-relaxed text-[var(--ink-soft)]">
              O pagamento online está indisponível agora, mas você não precisa esperar: chame a gente no WhatsApp com o plano escolhido e liberamos o seu acesso assim que o
              pagamento for combinado.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <a
                href={contactLink(
                  `Olá! Quero assinar o plano ${plan.name} (${cycle === 'yearly' ? 'anual' : 'mensal'}, ${formatCurrency(price)}) para a empresa ${company.people?.name ?? ''}.`
                )}
                target="_blank"
                rel="noreferrer"
                className="rounded-xl bg-[var(--blue-500)] px-5 py-3 text-[14px] font-bold text-white hover:bg-[var(--blue-700)]"
              >
                Assinar pelo WhatsApp
              </a>
              <button type="button" onClick={onClose} className="rounded-xl px-4 py-3 text-[14px] font-semibold text-[var(--ink-soft)]">
                Fechar
              </button>
            </div>
          </div>
        )}

        {phase === 'error' && (
          <div className="py-6">
            <p className="rounded-lg bg-[var(--red-100)] px-3 py-2.5 text-[13px] font-medium text-[var(--red-500)]">{error}</p>
            <div className="mt-4 flex gap-3">
              <button type="button" onClick={() => void start()} className="rounded-xl bg-[var(--blue-500)] px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-[var(--blue-700)]">
                Tentar de novo
              </button>
              <button type="button" onClick={onClose} className="rounded-xl px-4 py-2.5 text-[13.5px] font-semibold text-[var(--ink-soft)]">
                Fechar
              </button>
            </div>
          </div>
        )}

        {phase === 'data' && (
          <div className="mt-5">
            <p className="text-[13px] leading-relaxed text-[var(--ink-soft)]">
              Para gerar o pagamento e emitir a cobrança, precisamos de alguns dados da empresa. Leva só um minuto.
            </p>
            <div className="mt-4 grid gap-3.5 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <TextField
                  label="CNPJ ou CPF"
                  icon={<BuildingIcon className="h-4 w-4" />}
                  inputMode="numeric"
                  value={document}
                  onChange={(event) => {
                    setLookupMessage(null)
                    setDocument(formatDocument(event.target.value))
                  }}
                />
                {lookupMessage && <p className="mt-1.5 text-[12px] font-medium text-[var(--blue-700)]">{lookupMessage}</p>}
              </div>
              <div className="sm:col-span-2">
                <TextField label="E-mail" icon={<MailIcon className="h-4 w-4" />} type="email" value={email} onChange={(event) => setEmail(event.target.value)} />
              </div>
              <TextField label="CEP" icon={<FileTextIcon className="h-4 w-4" />} inputMode="numeric" value={zipCode} onChange={(event) => void handleCep(event.target.value)} />
              <TextField label="Número" icon={<FileTextIcon className="h-4 w-4" />} value={number} onChange={(event) => setNumber(event.target.value)} />
              <div className="sm:col-span-2">
                <TextField label="Rua" icon={<FileTextIcon className="h-4 w-4" />} value={street} onChange={(event) => setStreet(event.target.value)} />
              </div>
              <TextField label="Bairro" icon={<FileTextIcon className="h-4 w-4" />} value={district} onChange={(event) => setDistrict(event.target.value)} />
              <TextField label="Cidade" icon={<FileTextIcon className="h-4 w-4" />} value={city} onChange={(event) => setCity(event.target.value)} />
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Estado</span>
                <select
                  value={state}
                  onChange={(event) => setState(event.target.value)}
                  className="rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--blue-300)]"
                >
                  <option value="">Selecione</option>
                  {BRAZIL_STATES.map((uf) => (
                    <option key={uf} value={uf}>
                      {uf}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {error && <p className="mt-4 rounded-lg bg-[var(--red-100)] px-3 py-2 text-[13px] font-medium text-[var(--red-500)]">{error}</p>}
            <button
              type="button"
              disabled={savingData}
              onClick={() => void submitData()}
              className="mt-5 w-full rounded-xl bg-[var(--blue-500)] py-3 text-[14px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
            >
              {savingData ? 'Salvando…' : 'Continuar para o pagamento'}
            </button>
          </div>
        )}

        {phase === 'pix' && order && (
          <div className="mt-5">
            <p className="text-center text-[13px] text-[var(--ink-soft)]">
              Pague com PIX: o plano é liberado sozinho assim que o pagamento for confirmado.
            </p>
            <div className="mt-4 flex flex-col items-center gap-3">
              {qr ? (
                <img src={qr} alt="QR Code do PIX" className="h-[220px] w-[220px] rounded-xl bg-white p-2" />
              ) : (
                <div className="h-[220px] w-[220px] animate-pulse rounded-xl bg-[var(--page)]" />
              )}
              {order.pix_copy_paste && (
                <>
                  <p className="w-full break-all rounded-xl bg-[var(--page)] px-3 py-2.5 text-[11.5px] leading-snug text-[var(--ink-soft)]">
                    {order.pix_copy_paste}
                  </p>
                  <button
                    type="button"
                    onClick={() => void copyPix()}
                    className="flex items-center gap-2 rounded-xl bg-[var(--blue-500)] px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-[var(--blue-700)]"
                  >
                    <CopyIcon className="h-4 w-4" />
                    {copied ? 'Código copiado!' : 'Copiar código PIX'}
                  </button>
                </>
              )}
              {order.boleto_url && (
                <a href={order.boleto_url} target="_blank" rel="noreferrer" className="text-[12.5px] font-semibold text-[var(--blue-700)] hover:underline">
                  Prefere boleto? Abrir o boleto
                </a>
              )}
            </div>
            <p className="mt-5 flex items-center justify-center gap-2 text-[12px] text-[var(--muted)]">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[var(--amber-500)]" />
              Aguardando o pagamento…
            </p>
          </div>
        )}

        {phase === 'paid' && (
          <div className="flex flex-col items-center gap-3 py-8 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--green-100)] text-[var(--green-600)]">
              <CheckCircleIcon className="h-8 w-8" />
            </span>
            <h3 className="text-[18px] font-bold text-[var(--ink)]">Pagamento confirmado!</h3>
            <p className="max-w-xs text-[13px] leading-relaxed text-[var(--ink-soft)]">
              O plano {plan.name} está ativo{summary?.expires_at ? ` até ${formatDate(summary.expires_at)}` : ''}. Notas fiscais, assinatura digital e WhatsApp, quando
              incluídos no plano, já estão liberados.
            </p>
            <button type="button" onClick={onClose} className="mt-2 rounded-xl bg-[var(--blue-500)] px-6 py-3 text-[14px] font-bold text-white hover:bg-[var(--blue-700)]">
              Começar a usar
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
