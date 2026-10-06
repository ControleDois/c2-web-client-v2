import { useCallback, useEffect, useMemo, useState } from 'react'
import { MoneyInput } from '../components/form/MoneyInput'
import {
  createNfe,
  fetchNfe,
  updateNfe,
  sendNfe,
  formatNfeProviderError,
  NFE_STATUS_LABELS,
  NFE_PRESENCA_COMPRADOR_OPTIONS,
  NFE_INDICADOR_PAGAMENTO_OPTIONS,
  NFE_FORMA_PAGAMENTO_OPTIONS,
  NFE_TIPO_INTEGRACAO_OPTIONS,
  NFE_BANDEIRA_OPERADORA_OPTIONS,
  NFE_LOCAL_DESTINO_OVERRIDE_OPTIONS,
  NFE_CONSUMIDOR_FINAL_OVERRIDE_OPTIONS,
  type NfeRecord,
  type NfeDraftPayload,
  type NfePaymentRecord,
} from '../lib/nfes'
import { fetchPeople, type PersonRecord } from '../lib/people'
import { fetchNfeNatureOperations, type NfeNatureOperationRecord } from '../lib/nfeNatureOperations'
import { fetchProducts, type ProductRecord } from '../lib/products'
import { formatDocument } from '../lib/formatDocument'
import { formatCurrency } from '../lib/format'
import { ApiError } from '../lib/api'
import { extractPendencies, type Pendencies } from '../lib/pendencies'
import { PendenciesDialog } from '../components/PendenciesDialog'
import { SelectField } from '../components/form/SelectField'
import { SearchSelectField } from '../components/form/SearchSelectField'
import { useQuickPerson } from '../hooks/useQuickPerson'
import { SectionCard } from '../components/SectionCard'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { NfeCustomerSummary } from '../components/NfeCustomerSummary'
import { QuickNatureOperationModal, type QuickNatureOperationRequest } from '../components/QuickNatureOperationModal'
import { QuickProductModal, type QuickProductRequest } from '../components/QuickProductModal'
import { TrashIcon, ChevronLeftIcon, PlusIcon, ChevronDownIcon, AlertTriangleIcon } from '../components/icons'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface NfeFormPageProps {
  session: AuthSession
  company: AuthCompany
  nfeId?: string
  onBack: () => void
  onSaved: () => void
}

interface EntityPick {
  id: string
  label: string
  sub?: string
}

interface ProductEntry {
  tempId: string
  productId: string
  label: string
  amount: string
  costValue: string
  natureOperationId?: string
  natureOperationLabel?: string
  expanded: boolean
}

interface PaymentEntry {
  tempId: string
  indicadorPagamento: number
  formaPagamento: string
  valorPagamento: string
  dataPagamento: string
  descricaoPagamento: string
  tipoIntegracao: string
  cnpjTransacional: string
  ufTransacional: string
  bandeiraOperadora: string
  numeroAutorizacao: string
  cnpjCredenciadora: string
  cnpjBeneficiario: string
  idTerminalPagamento: string
}

function emptyPaymentEntry(tempId: string): PaymentEntry {
  return {
    tempId,
    indicadorPagamento: 0,
    formaPagamento: '01',
    valorPagamento: '',
    dataPagamento: today(),
    descricaoPagamento: '',
    tipoIntegracao: '',
    cnpjTransacional: '',
    ufTransacional: '',
    bandeiraOperadora: '',
    numeroAutorizacao: '',
    cnpjCredenciadora: '',
    cnpjBeneficiario: '',
    idTerminalPagamento: '',
  }
}

function paymentEntryFromRecord(payment: NfePaymentRecord, index: number): PaymentEntry {
  return {
    tempId: `payment-${index}`,
    indicadorPagamento: payment.indicador_pagamento ?? 0,
    formaPagamento: payment.forma_pagamento ?? '01',
    valorPagamento: String(payment.valor_pagamento ?? 0),
    dataPagamento: payment.data_pagamento ? payment.data_pagamento.slice(0, 10) : today(),
    descricaoPagamento: payment.descricao_pagamento ?? '',
    tipoIntegracao: payment.tipo_integracao ? String(payment.tipo_integracao) : '',
    cnpjTransacional: payment.cnpj_transacional ?? '',
    ufTransacional: payment.uf_transacional ?? '',
    bandeiraOperadora: payment.bandeira_operadora ?? '',
    numeroAutorizacao: payment.numero_autorizacao ?? '',
    cnpjCredenciadora: payment.cnpj_credenciadora ?? '',
    cnpjBeneficiario: payment.cnpj_beneficiario ?? '',
    idTerminalPagamento: payment.id_terminal_pagamento ?? '',
  }
}

function parseAmount(value: string): number {
  if (!value) return 0
  const normalized = value.includes(',') ? value.replace(/\./g, '').replace(',', '.') : value
  const num = Number(normalized)
  return Number.isNaN(num) ? 0 : num
}

function productTotal(item: ProductEntry): number {
  return parseAmount(item.amount) * parseAmount(item.costValue)
}

const STEPS = ['Cliente', 'Produtos', 'Avançado'] as const

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function NfeFormPage({ session, company, nfeId, onBack, onSaved }: NfeFormPageProps) {
  const quickPerson = useQuickPerson(session, company)
  const [loading, setLoading] = useState(Boolean(nfeId))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string[]>([])
  const [pendencies, setPendencies] = useState<Pendencies | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [step, setStep] = useState(0)
  const [savedId, setSavedId] = useState<string | undefined>(nfeId)
  const [confirmEmit, setConfirmEmit] = useState(false)
  const [natureRequest, setNatureRequest] = useState<QuickNatureOperationRequest | null>(null)
  const [productRequest, setProductRequest] = useState<QuickProductRequest | null>(null)
  // Nota nova: o 1º pagamento acompanha o total da nota até a pessoa mexer no valor.
  const [autoPayment, setAutoPayment] = useState(!nfeId)

  const [code, setCode] = useState<number | undefined>(undefined)
  const [status, setStatus] = useState(0)

  const [customer, setCustomer] = useState<EntityPick | null>(null)
  const [natureOperation, setNatureOperation] = useState<EntityPick | null>(null)
  const [presencaComprador, setPresencaComprador] = useState(1)
  const [localDestinoOverride, setLocalDestinoOverride] = useState('')
  const [consumidorFinalOverride, setConsumidorFinalOverride] = useState('')

  const [valorFrete, setValorFrete] = useState('')
  const [valorSeguro, setValorSeguro] = useState('')
  const [valorDesconto, setValorDesconto] = useState('')
  const [valorOutrasDespesas, setValorOutrasDespesas] = useState('')

  const [products, setProducts] = useState<ProductEntry[]>([])
  const [payments, setPayments] = useState<PaymentEntry[]>([])
  const [observacoes, setObservacoes] = useState('')

  useEffect(() => {
    if (!nfeId) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    fetchNfe(session.token.token, nfeId)
      .then((nfe: NfeRecord) => {
        if (cancelled) return
        setCode(nfe.code)
        setStatus(nfe.status)
        setCustomer(nfe.people ? { id: nfe.people.id, label: nfe.people.name, sub: nfe.people.document } : null)
        setNatureOperation(
          nfe.natureOperation ? { id: nfe.natureOperation.id, label: nfe.natureOperation.description } : null
        )
        setPresencaComprador(nfe.presenca_comprador ?? 1)
        setLocalDestinoOverride(nfe.local_destino_override ? String(nfe.local_destino_override) : '')
        setConsumidorFinalOverride(nfe.consumidor_final_override ? String(nfe.consumidor_final_override) : '')
        setValorFrete(nfe.valor_frete ? String(nfe.valor_frete) : '')
        setValorSeguro(nfe.valor_seguro ? String(nfe.valor_seguro) : '')
        setValorDesconto(nfe.valor_desconto ? String(nfe.valor_desconto) : '')
        setValorOutrasDespesas(nfe.valor_outras_despesas ? String(nfe.valor_outras_despesas) : '')
        setObservacoes(nfe.informacoes_adicionais_contribuinte ?? '')
        setProducts(
          (nfe.itens ?? []).map((item, index) => ({
            tempId: `item-${index}`,
            productId: item.product_id,
            label: item.product?.name || item.descricao || 'Produto',
            amount: String(item.quantidade_comercial ?? 1),
            costValue: String(item.valor_unitario_comercial ?? 0),
            natureOperationId: item.nfe_nature_operation_id ?? undefined,
            natureOperationLabel: item.natureOperation?.description,
            expanded: false,
          }))
        )
        setPayments((nfe.pagamentos ?? []).map((payment, index) => paymentEntryFromRecord(payment, index)))
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err instanceof ApiError ? err.message : 'Não foi possível carregar a NF-e.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [nfeId, session.token.token, reloadKey])

  const searchPeople = useCallback(
    (query: string) => fetchPeople(session.token.token, company.id, { search: query, limit: 8 }).then((res) => res.data),
    [session.token.token, company.id]
  )
  const searchNatureOperations = useCallback(
    (query: string) =>
      fetchNfeNatureOperations(session.token.token, company.id, { search: query, limit: 8 }).then((res) => res.data),
    [session.token.token, company.id]
  )
  const searchProducts = useCallback(
    (query: string) => fetchProducts(session.token.token, company.id, { search: query, limit: 8 }).then((res) => res.data),
    [session.token.token, company.id]
  )

  const productsTotal = useMemo(() => products.reduce((sum, item) => sum + productTotal(item), 0), [products])
  const grandTotal = Math.max(
    0,
    productsTotal +
      parseAmount(valorFrete) +
      parseAmount(valorSeguro) +
      parseAmount(valorOutrasDespesas) -
      parseAmount(valorDesconto)
  )
  const paymentsTotal = useMemo(
    () => payments.reduce((sum, payment) => sum + parseAmount(payment.valorPagamento), 0),
    [payments]
  )
  const paymentsRemaining = grandTotal - paymentsTotal

  function handleAddProduct(product: ProductRecord) {
    setProducts((prev) => [
      ...prev,
      {
        tempId: `item-${Date.now()}-${prev.length}`,
        productId: product.id,
        label: product.name,
        amount: '1',
        costValue: product.sale_value ? String(product.sale_value) : '',
        expanded: false,
      },
    ])
  }

  function handleUpdateProduct(tempId: string, patch: Partial<ProductEntry>) {
    setProducts((prev) => prev.map((item) => (item.tempId === tempId ? { ...item, ...patch } : item)))
  }

  function handleRemoveProduct(tempId: string) {
    setProducts((prev) => prev.filter((item) => item.tempId !== tempId))
  }

  function handleAddPayment() {
    setAutoPayment(false)
    setPayments((prev) => {
      const entry = emptyPaymentEntry(`payment-${Date.now()}-${prev.length}`)
      const paid = prev.reduce((sum, payment) => sum + parseAmount(payment.valorPagamento), 0)
      const remaining = grandTotal - paid
      return [...prev, { ...entry, valorPagamento: remaining > 0 ? remaining.toFixed(2) : '' }]
    })
  }

  function handleUpdatePayment(tempId: string, patch: Partial<PaymentEntry>) {
    if (patch.valorPagamento !== undefined) setAutoPayment(false)
    setPayments((prev) => prev.map((payment) => (payment.tempId === tempId ? { ...payment, ...patch } : payment)))
  }

  // Ao chegar no passo Avançado sem pagamento, já sugere um pagamento em dinheiro com o total.
  useEffect(() => {
    if (step !== 2 || payments.length > 0 || loading) return
    setPayments([{ ...emptyPaymentEntry('payment-auto'), valorPagamento: grandTotal > 0 ? grandTotal.toFixed(2) : '' }])
  }, [step, payments.length, loading, grandTotal])

  useEffect(() => {
    if (!autoPayment || payments.length !== 1) return
    const target = grandTotal > 0 ? grandTotal.toFixed(2) : ''
    setPayments((prev) => (prev.length === 1 && prev[0].valorPagamento !== target ? [{ ...prev[0], valorPagamento: target }] : prev))
  }, [autoPayment, payments.length, grandTotal])

  function handleRemovePayment(tempId: string) {
    setPayments((prev) => prev.filter((payment) => payment.tempId !== tempId))
  }

  function validateStep(target: number): string[] {
    if (target === 0) {
      const messages: string[] = []
      if (!customer) messages.push('Selecione o cliente da NF-e.')
      if (!natureOperation) messages.push('Selecione a natureza de operação da NF-e.')
      return messages
    }
    if (target === 1) {
      return products.length === 0 ? ['Adicione pelo menos um produto.'] : []
    }
    if (payments.length === 0) return ['Adicione pelo menos uma forma de pagamento.']
    const messages: string[] = []
    payments.forEach((payment, index) => {
      if (parseAmount(payment.valorPagamento) <= 0) {
        messages.push(`Pagamento ${index + 1}: informe um valor maior que zero.`)
      }
      if (payment.formaPagamento === '99' && !payment.descricaoPagamento.trim()) {
        messages.push(`Pagamento ${index + 1}: descreva a forma de pagamento (obrigatório para "Outros").`)
      }
    })
    return messages
  }

  function goNext() {
    const messages = validateStep(step)
    setError(messages)
    if (messages.length === 0) setStep((current) => Math.min(current + 1, STEPS.length - 1))
  }

  function goToStep(target: number) {
    if (target <= step) {
      setError([])
      setStep(target)
      return
    }
    for (let index = step; index < target; index++) {
      const messages = validateStep(index)
      if (messages.length > 0) {
        setStep(index)
        setError(messages)
        return
      }
    }
    setError([])
    setStep(target)
  }

  async function handleSubmit(emit = false) {
    setError([])

    for (let index = 0; index < STEPS.length; index++) {
      const messages = validateStep(index)
      if (messages.length > 0) {
        setStep(index)
        setError(messages)
        return
      }
    }

    const payload: NfeDraftPayload = {
      peopleId: customer!.id,
      nfeNatureOperationId: natureOperation!.id,
      modelo: 55,
      presenca_comprador: presencaComprador,
      local_destino_override: localDestinoOverride ? Number(localDestinoOverride) : undefined,
      consumidor_final_override: consumidorFinalOverride ? Number(consumidorFinalOverride) : undefined,
      valor_frete: parseAmount(valorFrete),
      valor_seguro: parseAmount(valorSeguro),
      valor_desconto: parseAmount(valorDesconto),
      valor_outras_despesas: parseAmount(valorOutrasDespesas),
      informacoes_complementares: observacoes.trim() || undefined,
      products: products.map((item) => ({
        product_id: item.productId,
        amount: parseAmount(item.amount) || 1,
        cost_value: parseAmount(item.costValue),
        nfe_nature_operation_id: item.natureOperationId || undefined,
      })),
      payments: payments.map((payment) => ({
        indicador_pagamento: payment.indicadorPagamento,
        forma_pagamento: payment.formaPagamento,
        valor_pagamento: parseAmount(payment.valorPagamento),
        data_pagamento: payment.dataPagamento,
        descricao_pagamento: payment.descricaoPagamento.trim() || undefined,
        tipo_integracao: payment.tipoIntegracao ? Number(payment.tipoIntegracao) : undefined,
        cnpj_transacional: payment.cnpjTransacional.trim() || undefined,
        uf_transacional: payment.ufTransacional.trim() || undefined,
        bandeira_operadora: payment.bandeiraOperadora || undefined,
        numero_autorizacao: payment.numeroAutorizacao.trim() || undefined,
        cnpj_credenciadora: payment.cnpjCredenciadora.trim() || undefined,
        cnpj_beneficiario: payment.cnpjBeneficiario.trim() || undefined,
        id_terminal_pagamento: payment.idTerminalPagamento.trim() || undefined,
      })),
    }

    setSubmitting(true)
    try {
      const record = savedId ? await updateNfe(session.token.token, savedId, payload) : await createNfe(session.token.token, payload)
      const id = record?.id ?? savedId
      if (id) setSavedId(id)

      if (emit && id) {
        try {
          await sendNfe(session.token.token, id)
        } catch (err) {
          const found = extractPendencies(err)
          if (found) setPendencies(found)
          else setError([formatNfeProviderError(err, 'A nota foi salva como rascunho, mas não foi possível emitir.')])
          return
        }
      }
      onSaved()
    } catch (err) {
      const found = extractPendencies(err)
      if (found) {
        setPendencies(found)
      } else if (err instanceof ApiError) {
        setError([err.message])
      } else {
        setError(['Não foi possível salvar a NF-e.'])
      }
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
          Voltar para notas fiscais
        </button>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Fiscal</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">
          {nfeId ? `Editar NF-e${code ? ` #${code}` : ''}` : 'Nova NF-e'}
        </h1>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 4 }).map((_, index) => (
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
        <form onSubmit={(event) => event.preventDefault()} className="flex flex-col gap-6">
          {nfeId && status !== 0 && (
            <div className="rounded-2xl bg-[var(--amber-100)] px-4 py-3 text-[13px] font-medium text-[var(--amber-500)]">
              Esta NF-e já está com status "{NFE_STATUS_LABELS[status] ?? status}". Editar o rascunho não altera a
              numeração já reservada.
            </div>
          )}

          <nav aria-label="Etapas da NF-e" className="grid grid-cols-3 gap-2 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-2">
            {STEPS.map((label, index) => {
              const active = index === step
              const done = index < step
              return (
                <button
                  key={label}
                  type="button"
                  onClick={() => goToStep(index)}
                  aria-current={active ? 'step' : undefined}
                  className={`flex items-center justify-center gap-2 rounded-xl px-3 py-2.5 text-[13.5px] font-bold transition ${
                    active
                      ? 'bg-[var(--blue-500)] text-white'
                      : 'text-[var(--ink-soft)] hover:bg-[var(--page)] hover:text-[var(--ink)]'
                  }`}
                >
                  <span
                    className={`flex h-6 w-6 flex-none items-center justify-center rounded-full text-[12px] ${
                      active
                        ? 'bg-white/25 text-white'
                        : done
                          ? 'bg-[var(--green-600)] text-white'
                          : 'bg-[var(--page)] text-[var(--ink-soft)]'
                    }`}
                  >
                    {done ? '✓' : index + 1}
                  </span>
                  {label}
                </button>
              )
            })}
          </nav>

          {step === 0 && (
            <>
          <SectionCard title="Cliente e natureza da operação">
            <div className="grid gap-4 sm:grid-cols-2">
              <SearchSelectField
                label="Cliente"
                placeholder="Buscar por nome ou documento"
                selectedLabel={customer?.label ?? null}
                selectedSubLabel={customer?.sub ? formatDocument(customer.sub) : undefined}
                onSearch={searchPeople}
                getOptionLabel={(item: PersonRecord) => item.name}
                getOptionSubLabel={(item: PersonRecord) => (item.document ? formatDocument(item.document) : undefined)}
                onSelect={(item: PersonRecord) => setCustomer({ id: item.id, label: item.name, sub: item.document ?? undefined })}
                onCreate={(typed) =>
                  quickPerson.request({ role: 2, name: typed, onCreated: (item: PersonRecord) => setCustomer({ id: item.id, label: item.name, sub: item.document ?? undefined }) })
                }
                onClear={() => setCustomer(null)}
              />
              <SearchSelectField
                label="Natureza da operação"
                placeholder="Buscar natureza de operação"
                selectedLabel={natureOperation?.label ?? null}
                onSearch={searchNatureOperations}
                getOptionLabel={(item: NfeNatureOperationRecord) => item.description}
                onSelect={(item: NfeNatureOperationRecord) => setNatureOperation({ id: item.id, label: item.description })}
                onCreate={(typed) =>
                  setNatureRequest({
                    description: typed,
                    onCreated: (item: NfeNatureOperationRecord) => setNatureOperation({ id: item.id, label: item.description }),
                  })
                }
                onClear={() => setNatureOperation(null)}
              />
            </div>
            {customer && (
              <div className="mt-5">
                <h3 className="mb-2 text-[12.5px] font-bold text-[var(--ink)]">Dados do cliente</h3>
                <NfeCustomerSummary token={session.token.token} personId={customer.id} />
              </div>
            )}
          </SectionCard>
            </>
          )}

          {step === 1 && (
            <>
          <SectionCard
            title="Produtos"
            headerExtra={<span className="text-[13.5px] font-bold text-[var(--ink)]">Total: {formatCurrency(productsTotal)}</span>}
          >
            <div className="mb-4">
              <SearchSelectField
                label="Adicionar produto"
                placeholder="Buscar por nome ou código"
                selectedLabel={null}
                onSearch={searchProducts}
                getOptionLabel={(item: ProductRecord) => item.name}
                getOptionSubLabel={(item: ProductRecord) => (item.sale_value ? formatCurrency(item.sale_value) : undefined)}
                onSelect={(item: ProductRecord) => handleAddProduct(item)}
                onCreate={(typed) => setProductRequest({ name: typed, onCreated: handleAddProduct })}
                onClear={() => {}}
              />
            </div>

            {products.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--page)] px-4 py-6 text-center text-[12.5px] text-[var(--muted)]">
                Nenhum produto adicionado ainda.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {products.map((item) => (
                  <div key={item.tempId} className="rounded-xl bg-[var(--page)] px-3.5 py-2.5">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="min-w-[140px] flex-1 truncate text-[13px] font-semibold text-[var(--ink)]" title={item.label}>
                        {item.label}
                      </span>
                      {item.natureOperationLabel && (
                        <span className="flex-none rounded-full bg-[var(--blue-100)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--blue-700)]">
                          {item.natureOperationLabel}
                        </span>
                      )}
                      <input
                        type="text"
                        inputMode="decimal"
                        placeholder="Qtd."
                        title="Quantidade"
                        value={item.amount}
                        onChange={(event) => handleUpdateProduct(item.tempId, { amount: event.target.value.replace(/[^\d.,]/g, '') })}
                        className="w-16 flex-none rounded-lg bg-[var(--surface)] px-3 py-2 text-right text-[13px] text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)]"
                      />
                      <MoneyInput
                        placeholder="Vl. unit."
                        title="Valor unitário"
                        value={item.costValue}
                        onChange={(event) => handleUpdateProduct(item.tempId, { costValue: event.target.value.replace(/[^\d.,]/g, '') })}
                        className="w-24 flex-none rounded-lg bg-[var(--surface)] px-3 py-2 text-right text-[13px] text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)]"
                      />
                      <span className="w-24 flex-none text-right text-[13px] font-bold text-[var(--ink)]">
                        {formatCurrency(productTotal(item))}
                      </span>
                      <button
                        type="button"
                        onClick={() => handleUpdateProduct(item.tempId, { expanded: !item.expanded })}
                        className="flex-none rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]"
                        aria-label="Natureza de operação deste item"
                        title="Natureza de operação (CFOP) deste item"
                      >
                        <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform duration-200 ${item.expanded ? 'rotate-180' : ''}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRemoveProduct(item.tempId)}
                        className="flex-none rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--red-100)] hover:text-[var(--red-500)]"
                        aria-label="Remover produto"
                      >
                        <TrashIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>

                    {item.expanded && (
                      <div className="mt-2.5 border-t border-[var(--border)] pt-2.5">
                        <SearchSelectField
                          label="Natureza de operação deste item (opcional)"
                          placeholder="Padrão da nota — buscar para trocar o CFOP só deste item"
                          variant="surface"
                          selectedLabel={item.natureOperationLabel ?? null}
                          onSearch={searchNatureOperations}
                          getOptionLabel={(nature: NfeNatureOperationRecord) => nature.description}
                          onSelect={(nature: NfeNatureOperationRecord) =>
                            handleUpdateProduct(item.tempId, {
                              natureOperationId: nature.id,
                              natureOperationLabel: nature.description,
                            })
                          }
                          onClear={() => handleUpdateProduct(item.tempId, { natureOperationId: undefined, natureOperationLabel: undefined })}
                        />
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

            </>
          )}

          {step === 2 && (
            <>
          <SectionCard
            title="Pagamentos"
            headerExtra={
              <div className="flex flex-none items-center gap-4 text-[12.5px] font-semibold text-[var(--ink-soft)]">
                <span>Total da nota: {formatCurrency(grandTotal)}</span>
                <span className={paymentsRemaining === 0 ? 'text-[var(--green-600)]' : 'text-[var(--amber-500)]'}>
                  Restante: {formatCurrency(paymentsRemaining)}
                </span>
              </div>
            }
          >
            <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
              <button
                type="button"
                onClick={handleAddPayment}
                className="flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--ink-soft)] hover:border-[var(--blue-500)] hover:text-[var(--blue-700)]"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Adicionar pagamento
              </button>
              {payments.length === 1 && (
                <label className="flex items-center gap-2 text-[12.5px] font-semibold text-[var(--ink-soft)]">
                  <input
                    type="checkbox"
                    checked={autoPayment}
                    onChange={(event) => setAutoPayment(event.target.checked)}
                    className="h-4 w-4 accent-[var(--blue-500)]"
                  />
                  Calcular automaticamente
                </label>
              )}
            </div>

            {payments.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--page)] px-4 py-6 text-center text-[12.5px] text-[var(--muted)]">
                Nenhum pagamento adicionado ainda.
              </p>
            ) : (
              <div className="flex flex-col gap-4">
                {payments.map((payment, index) => {
                  const needsDescricao = payment.formaPagamento === '99'
                  return (
                    <div key={payment.tempId} className="rounded-xl border border-[var(--border)] bg-[var(--page)] p-4">
                      <div className="mb-3 flex items-center justify-between">
                        <span className="text-[13px] font-bold text-[var(--ink)]">Pagamento {index + 1}</span>
                        <button
                          type="button"
                          onClick={() => handleRemovePayment(payment.tempId)}
                          className="flex-none rounded-lg p-1.5 text-[var(--muted)] hover:bg-[var(--red-100)] hover:text-[var(--red-500)]"
                          aria-label="Remover pagamento"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                        </button>
                      </div>

                      <div className="grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
                        <SelectField
                          label="Indicador de pagamento"
                          value={payment.indicadorPagamento}
                          onChange={(event) =>
                            handleUpdatePayment(payment.tempId, { indicadorPagamento: Number(event.target.value) })
                          }
                          variant="surface"
                        >
                          {NFE_INDICADOR_PAGAMENTO_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </SelectField>
                        <SelectField
                          label="Forma de pagamento"
                          value={payment.formaPagamento}
                          onChange={(event) => handleUpdatePayment(payment.tempId, { formaPagamento: event.target.value })}
                          variant="surface"
                        >
                          {NFE_FORMA_PAGAMENTO_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </SelectField>
                        <label className="flex flex-col gap-1.5">
                          <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Data do pagamento</span>
                          <input
                            type="date"
                            value={payment.dataPagamento}
                            onChange={(event) => handleUpdatePayment(payment.tempId, { dataPagamento: event.target.value })}
                            className="rounded-xl bg-[var(--surface)] px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)]"
                          />
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Valor do pagamento</span>
                          <MoneyInput
                            placeholder="0,00"
                            value={payment.valorPagamento}
                            onChange={(event) =>
                              handleUpdatePayment(payment.tempId, { valorPagamento: event.target.value.replace(/[^\d.,]/g, '') })
                            }
                            className="rounded-xl bg-[var(--surface)] px-3.5 py-2.5 text-right text-[13.5px] text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)]"
                          />
                        </label>
                      </div>

                      <div className="mt-3.5">
                        <label className="flex flex-col gap-1.5">
                          <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
                            Descrição do pagamento
                            {needsDescricao && <span className="text-[var(--red-500)]"> (obrigatório para "Outros")</span>}
                          </span>
                          <input
                            type="text"
                            placeholder='Ex: Vale-refeição, transferência PIX manual...'
                            value={payment.descricaoPagamento}
                            onChange={(event) => handleUpdatePayment(payment.tempId, { descricaoPagamento: event.target.value })}
                            className={`rounded-xl bg-[var(--surface)] px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] ring-1 transition focus:outline-none focus:ring-[var(--blue-300)] ${
                              needsDescricao && !payment.descricaoPagamento.trim()
                                ? 'ring-[var(--red-500)]'
                                : 'ring-transparent'
                            }`}
                          />
                        </label>
                      </div>

                      <details className="mt-3.5 rounded-xl bg-[var(--surface)] px-3.5 py-2.5">
                        <summary className="cursor-pointer text-[12.5px] font-bold text-[var(--ink-soft)]">
                          Dados de cartão / PIX (opcional)
                        </summary>
                      <div className="mt-3.5 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
                        <SelectField
                          label="Tipo de integração"
                          value={payment.tipoIntegracao}
                          onChange={(event) => handleUpdatePayment(payment.tempId, { tipoIntegracao: event.target.value })}
                          variant="surface"
                        >
                          <option value="">Não se aplica</option>
                          {NFE_TIPO_INTEGRACAO_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </SelectField>
                        <SelectField
                          label="Bandeira da operadora"
                          value={payment.bandeiraOperadora}
                          onChange={(event) => handleUpdatePayment(payment.tempId, { bandeiraOperadora: event.target.value })}
                          variant="surface"
                        >
                          {NFE_BANDEIRA_OPERADORA_OPTIONS.map((option) => (
                            <option key={option.value} value={option.value}>
                              {option.label}
                            </option>
                          ))}
                        </SelectField>
                        <label className="flex flex-col gap-1.5">
                          <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Número de autorização</span>
                          <input
                            type="text"
                            placeholder="Opcional"
                            value={payment.numeroAutorizacao}
                            onChange={(event) => handleUpdatePayment(payment.tempId, { numeroAutorizacao: event.target.value })}
                            className="rounded-xl bg-[var(--surface)] px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)]"
                          />
                        </label>
                      </div>

                      <div className="mt-3.5 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-3">
                        <label className="flex flex-col gap-1.5">
                          <span className="text-[12px] font-semibold text-[var(--ink-soft)]">CNPJ transacional</span>
                          <input
                            type="text"
                            placeholder="Opcional"
                            value={payment.cnpjTransacional}
                            onChange={(event) => handleUpdatePayment(payment.tempId, { cnpjTransacional: event.target.value })}
                            className="rounded-xl bg-[var(--surface)] px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)]"
                          />
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className="text-[12px] font-semibold text-[var(--ink-soft)]">UF transacional</span>
                          <input
                            type="text"
                            maxLength={2}
                            placeholder="Opcional"
                            value={payment.ufTransacional}
                            onChange={(event) =>
                              handleUpdatePayment(payment.tempId, { ufTransacional: event.target.value.toUpperCase() })
                            }
                            className="rounded-xl bg-[var(--surface)] px-3.5 py-2.5 text-[13.5px] uppercase text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)]"
                          />
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className="text-[12px] font-semibold text-[var(--ink-soft)]">CNPJ credenciadora</span>
                          <input
                            type="text"
                            placeholder="Opcional"
                            value={payment.cnpjCredenciadora}
                            onChange={(event) => handleUpdatePayment(payment.tempId, { cnpjCredenciadora: event.target.value })}
                            className="rounded-xl bg-[var(--surface)] px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)]"
                          />
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className="text-[12px] font-semibold text-[var(--ink-soft)]">CNPJ beneficiário</span>
                          <input
                            type="text"
                            placeholder="Opcional"
                            value={payment.cnpjBeneficiario}
                            onChange={(event) => handleUpdatePayment(payment.tempId, { cnpjBeneficiario: event.target.value })}
                            className="rounded-xl bg-[var(--surface)] px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)]"
                          />
                        </label>
                        <label className="flex flex-col gap-1.5">
                          <span className="text-[12px] font-semibold text-[var(--ink-soft)]">ID do terminal de pagamento</span>
                          <input
                            type="text"
                            placeholder="Opcional"
                            value={payment.idTerminalPagamento}
                            onChange={(event) => handleUpdatePayment(payment.tempId, { idTerminalPagamento: event.target.value })}
                            className="rounded-xl bg-[var(--surface)] px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)]"
                          />
                        </label>
                      </div>
                      </details>
                    </div>
                  )
                })}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Frete, seguro, desconto e despesas">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Frete (R$)</span>
                <MoneyInput
                  value={valorFrete}
                  onChange={(event) => setValorFrete(event.target.value.replace(/[^\d.,]/g, ''))}
                  placeholder="0,00"
                  className="rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Seguro (R$)</span>
                <MoneyInput
                  value={valorSeguro}
                  onChange={(event) => setValorSeguro(event.target.value.replace(/[^\d.,]/g, ''))}
                  placeholder="0,00"
                  className="rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Desconto (R$)</span>
                <MoneyInput
                  value={valorDesconto}
                  onChange={(event) => setValorDesconto(event.target.value.replace(/[^\d.,]/g, ''))}
                  placeholder="0,00"
                  className="rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Outras despesas (R$)</span>
                <MoneyInput
                  value={valorOutrasDespesas}
                  onChange={(event) => setValorOutrasDespesas(event.target.value.replace(/[^\d.,]/g, ''))}
                  placeholder="0,00"
                  className="rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                />
              </label>
            </div>
          </SectionCard>

          <SectionCard
            title="Operação"
            subtitle="Presença do comprador e ajustes da classificação — o sistema calcula pelo cadastro do cliente"
            defaultCollapsed
          >
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <SelectField
                label="Presença do comprador"
                value={presencaComprador}
                onChange={(event) => setPresencaComprador(Number(event.target.value))}
              >
                {NFE_PRESENCA_COMPRADOR_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Classificação da operação (CFOP/idDest)"
                value={localDestinoOverride}
                onChange={(event) => setLocalDestinoOverride(event.target.value)}
              >
                {NFE_LOCAL_DESTINO_OVERRIDE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
              <SelectField
                label="Consumidor final"
                value={consumidorFinalOverride}
                onChange={(event) => setConsumidorFinalOverride(event.target.value)}
              >
                {NFE_CONSUMIDOR_FINAL_OVERRIDE_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </SelectField>
            </div>
            {(localDestinoOverride || consumidorFinalOverride) && (
              <p className="mt-3 flex items-start gap-2 rounded-xl bg-[var(--amber-100)] px-3.5 py-2.5 text-[12.5px] font-medium text-[var(--amber-500)]">
                <AlertTriangleIcon className="mt-0.5 h-3.5 w-3.5 flex-none" />
                Você está forçando manualmente {localDestinoOverride && consumidorFinalOverride
                  ? 'a classificação da operação e o consumidor final'
                  : localDestinoOverride
                    ? 'a classificação da operação'
                    : 'o consumidor final'}{' '}
                em vez de deixar o sistema calcular pelo cadastro do cliente. A SEFAZ pode rejeitar se isso não
                corresponder à situação fiscal real (ex: inscrição estadual de substituto tributário no estado de
                destino). Use por sua conta e risco.
              </p>
            )}
          </SectionCard>

          <SectionCard title="Observações" subtitle="Aparece em Informações Complementares no DANFE">
            <textarea
              value={observacoes}
              onChange={(event) => setObservacoes(event.target.value)}
              rows={3}
              placeholder="Ex: Nota fiscal referente ao evento realizado em..."
              className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition placeholder:text-[var(--muted)] focus:outline-none focus:ring-[var(--blue-300)]"
            />
          </SectionCard>

            </>
          )}

          <PendenciesDialog pendencies={pendencies} onClose={() => setPendencies(null)} />

          {error.length > 0 && (
            <div className="rounded-2xl bg-[var(--red-100)] p-4 text-[13.5px] font-medium text-[var(--red-500)]">
              <ul className="list-disc pl-4">
                {error.map((message, index) => (
                  <li key={index}>{message}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={step === 0 ? onBack : () => goToStep(step - 1)}
                className="rounded-xl border border-[var(--border)] px-5 py-2.5 text-[14px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
              >
                {step === 0 ? 'Cancelar' : 'Voltar'}
              </button>
              <span className="text-[13px] font-semibold text-[var(--ink-soft)]">
                Total da nota: <span className="text-[var(--ink)]">{formatCurrency(grandTotal)}</span>
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => handleSubmit(false)}
                disabled={submitting}
                className="rounded-xl border border-[var(--border)] px-5 py-2.5 text-[14px] font-bold text-[var(--blue-700)] transition hover:bg-[var(--page)] disabled:opacity-60"
              >
                {submitting ? 'Salvando…' : nfeId && status !== 0 ? 'Salvar alterações' : 'Salvar rascunho'}
              </button>
              {step < STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={goNext}
                  className="rounded-xl bg-[var(--blue-500)] px-6 py-2.5 text-[14px] font-bold text-white transition hover:bg-[var(--blue-700)]"
                >
                  Avançar
                </button>
              ) : (
                (!nfeId || status === 0) && (
                  <button
                    type="button"
                    onClick={() => {
                      const messages = [0, 1, 2].flatMap((index) => validateStep(index))
                      if (messages.length > 0) {
                        handleSubmit(false)
                        return
                      }
                      setConfirmEmit(true)
                    }}
                    disabled={submitting}
                    className="rounded-xl bg-[var(--blue-500)] px-6 py-2.5 text-[14px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
                  >
                    Salvar e emitir
                  </button>
                )
              )}
            </div>
          </div>

          <ConfirmDialog
            open={confirmEmit}
            title="Emitir NF-e agora?"
            message={`A nota de ${formatCurrency(grandTotal)} será salva e enviada à SEFAZ. Depois de autorizada, só dá para cancelar com justificativa ou corrigir por carta de correção.`}
            confirmLabel="Emitir"
            danger={false}
            loading={submitting}
            onConfirm={() => {
              setConfirmEmit(false)
              handleSubmit(true)
            }}
            onCancel={() => setConfirmEmit(false)}
          />
        </form>
      )}
      {quickPerson.modal}
      <QuickNatureOperationModal
        request={natureRequest}
        session={session}
        company={company}
        onClose={() => setNatureRequest(null)}
      />
      <QuickProductModal
        request={productRequest}
        session={session}
        company={company}
        onClose={() => setProductRequest(null)}
      />
    </div>
  )
}
