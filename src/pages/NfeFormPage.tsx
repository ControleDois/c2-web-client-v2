import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react'
import {
  createNfe,
  fetchNfe,
  updateNfe,
  NFE_STATUS_LABELS,
  NFE_PRESENCA_COMPRADOR_OPTIONS,
  NFE_INDICADOR_PAGAMENTO_OPTIONS,
  NFE_FORMA_PAGAMENTO_OPTIONS,
  type NfeRecord,
  type NfeDraftPayload,
} from '../lib/nfes'
import { fetchPeople, type PersonRecord } from '../lib/people'
import { fetchNfeNatureOperations, type NfeNatureOperationRecord } from '../lib/nfeNatureOperations'
import { fetchProducts, type ProductRecord } from '../lib/products'
import { formatDocument } from '../lib/formatDocument'
import { formatCurrency } from '../lib/format'
import { ApiError } from '../lib/api'
import { SelectField } from '../components/form/SelectField'
import { SearchSelectField } from '../components/form/SearchSelectField'
import { SectionCard } from '../components/SectionCard'
import { TrashIcon, ChevronLeftIcon, PlusIcon } from '../components/icons'
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
}

interface PaymentEntry {
  tempId: string
  indicadorPagamento: number
  formaPagamento: string
  valorPagamento: string
  dataPagamento: string
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

function today(): string {
  return new Date().toISOString().slice(0, 10)
}

export function NfeFormPage({ session, company, nfeId, onBack, onSaved }: NfeFormPageProps) {
  const [loading, setLoading] = useState(Boolean(nfeId))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string[]>([])
  const [reloadKey, setReloadKey] = useState(0)

  const [code, setCode] = useState<number | undefined>(undefined)
  const [status, setStatus] = useState(0)

  const [customer, setCustomer] = useState<EntityPick | null>(null)
  const [natureOperation, setNatureOperation] = useState<EntityPick | null>(null)
  const [presencaComprador, setPresencaComprador] = useState(1)

  const [valorFrete, setValorFrete] = useState('')
  const [valorSeguro, setValorSeguro] = useState('')
  const [valorDesconto, setValorDesconto] = useState('')
  const [valorOutrasDespesas, setValorOutrasDespesas] = useState('')

  const [products, setProducts] = useState<ProductEntry[]>([])
  const [payments, setPayments] = useState<PaymentEntry[]>([])

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
          nfe.nature_operation ? { id: nfe.nature_operation.id, label: nfe.nature_operation.description } : null
        )
        setPresencaComprador(nfe.presenca_comprador ?? 1)
        setValorFrete(nfe.valor_frete ? String(nfe.valor_frete) : '')
        setValorSeguro(nfe.valor_seguro ? String(nfe.valor_seguro) : '')
        setValorDesconto(nfe.valor_desconto ? String(nfe.valor_desconto) : '')
        setValorOutrasDespesas(nfe.valor_outras_despesas ? String(nfe.valor_outras_despesas) : '')
        setProducts(
          (nfe.itens ?? []).map((item, index) => ({
            tempId: `item-${index}`,
            productId: item.product_id,
            label: item.product?.name || item.descricao || 'Produto',
            amount: String(item.quantidade_comercial ?? 1),
            costValue: String(item.valor_unitario_comercial ?? 0),
          }))
        )
        setPayments(
          (nfe.pagamentos ?? []).map((payment, index) => ({
            tempId: `payment-${index}`,
            indicadorPagamento: payment.indicador_pagamento ?? 0,
            formaPagamento: payment.forma_pagamento ?? '01',
            valorPagamento: String(payment.valor_pagamento ?? 0),
            dataPagamento: payment.data_pagamento ? payment.data_pagamento.slice(0, 10) : today(),
          }))
        )
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
  const grandTotal = Math.max(0, productsTotal - parseAmount(valorDesconto))
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
    setPayments((prev) => [
      ...prev,
      {
        tempId: `payment-${Date.now()}-${prev.length}`,
        indicadorPagamento: 0,
        formaPagamento: '01',
        valorPagamento: '',
        dataPagamento: today(),
      },
    ])
  }

  function handleUpdatePayment(tempId: string, patch: Partial<PaymentEntry>) {
    setPayments((prev) => prev.map((payment) => (payment.tempId === tempId ? { ...payment, ...patch } : payment)))
  }

  function handleRemovePayment(tempId: string) {
    setPayments((prev) => prev.filter((payment) => payment.tempId !== tempId))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError([])

    if (!customer) {
      setError(['Selecione o cliente da NF-e.'])
      return
    }
    if (!natureOperation) {
      setError(['Selecione a natureza de operação da NF-e.'])
      return
    }
    if (products.length === 0) {
      setError(['Adicione pelo menos um produto.'])
      return
    }
    if (payments.length === 0) {
      setError(['Adicione pelo menos uma forma de pagamento.'])
      return
    }

    const payload: NfeDraftPayload = {
      peopleId: customer.id,
      nfeNatureOperationId: natureOperation.id,
      modelo: 55,
      presenca_comprador: presencaComprador,
      valor_frete: parseAmount(valorFrete),
      valor_seguro: parseAmount(valorSeguro),
      valor_desconto: parseAmount(valorDesconto),
      valor_outras_despesas: parseAmount(valorOutrasDespesas),
      products: products.map((item) => ({
        product_id: item.productId,
        amount: parseAmount(item.amount) || 1,
        cost_value: parseAmount(item.costValue),
      })),
      payments: payments.map((payment) => ({
        indicador_pagamento: payment.indicadorPagamento,
        forma_pagamento: payment.formaPagamento,
        valor_pagamento: parseAmount(payment.valorPagamento),
        data_pagamento: payment.dataPagamento,
      })),
    }

    setSubmitting(true)
    try {
      if (nfeId) {
        await updateNfe(session.token.token, nfeId, payload)
      } else {
        await createNfe(session.token.token, payload)
      }
      onSaved()
    } catch (err) {
      if (err instanceof ApiError) {
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
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          {nfeId && status !== 0 && (
            <div className="rounded-2xl bg-[var(--amber-100)] px-4 py-3 text-[13px] font-medium text-[var(--amber-500)]">
              Esta NF-e já está com status "{NFE_STATUS_LABELS[status] ?? status}". Editar o rascunho não altera a
              numeração já reservada.
            </div>
          )}

          <SectionCard title="Dados da NF-e">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <SearchSelectField
                label="Cliente"
                placeholder="Buscar por nome ou documento"
                selectedLabel={customer?.label ?? null}
                selectedSubLabel={customer?.sub ? formatDocument(customer.sub) : undefined}
                onSearch={searchPeople}
                getOptionLabel={(item: PersonRecord) => item.name}
                getOptionSubLabel={(item: PersonRecord) => (item.document ? formatDocument(item.document) : undefined)}
                onSelect={(item: PersonRecord) => setCustomer({ id: item.id, label: item.name, sub: item.document ?? undefined })}
                onClear={() => setCustomer(null)}
              />
              <SearchSelectField
                label="Natureza de operação"
                placeholder="Buscar natureza de operação"
                selectedLabel={natureOperation?.label ?? null}
                onSearch={searchNatureOperations}
                getOptionLabel={(item: NfeNatureOperationRecord) => item.description}
                onSelect={(item: NfeNatureOperationRecord) => setNatureOperation({ id: item.id, label: item.description })}
                onClear={() => setNatureOperation(null)}
              />
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
            </div>
          </SectionCard>

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
                  <div key={item.tempId} className="flex flex-wrap items-center gap-2 rounded-xl bg-[var(--page)] px-3.5 py-2.5">
                    <span className="min-w-[140px] flex-1 truncate text-[13px] font-semibold text-[var(--ink)]" title={item.label}>
                      {item.label}
                    </span>
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Qtd."
                      title="Quantidade"
                      value={item.amount}
                      onChange={(event) => handleUpdateProduct(item.tempId, { amount: event.target.value.replace(/[^\d.,]/g, '') })}
                      className="w-16 flex-none rounded-lg bg-[var(--surface)] px-3 py-2 text-right text-[13px] text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)]"
                    />
                    <input
                      type="text"
                      inputMode="decimal"
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
                      onClick={() => handleRemoveProduct(item.tempId)}
                      className="flex-none rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--red-100)] hover:text-[var(--red-500)]"
                      aria-label="Remover produto"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          <SectionCard title="Frete, seguro e despesas">
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Frete (R$)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={valorFrete}
                  onChange={(event) => setValorFrete(event.target.value.replace(/[^\d.,]/g, ''))}
                  placeholder="0,00"
                  className="rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Seguro (R$)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={valorSeguro}
                  onChange={(event) => setValorSeguro(event.target.value.replace(/[^\d.,]/g, ''))}
                  placeholder="0,00"
                  className="rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Desconto (R$)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={valorDesconto}
                  onChange={(event) => setValorDesconto(event.target.value.replace(/[^\d.,]/g, ''))}
                  placeholder="0,00"
                  className="rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Outras despesas (R$)</span>
                <input
                  type="text"
                  inputMode="decimal"
                  value={valorOutrasDespesas}
                  onChange={(event) => setValorOutrasDespesas(event.target.value.replace(/[^\d.,]/g, ''))}
                  placeholder="0,00"
                  className="rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                />
              </label>
            </div>
          </SectionCard>

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
            <div className="mb-4">
              <button
                type="button"
                onClick={handleAddPayment}
                className="flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--ink-soft)] hover:border-[var(--blue-500)] hover:text-[var(--blue-700)]"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Adicionar pagamento
              </button>
            </div>

            {payments.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--page)] px-4 py-6 text-center text-[12.5px] text-[var(--muted)]">
                Nenhum pagamento adicionado ainda.
              </p>
            ) : (
              <div className="flex flex-col gap-2">
                {payments.map((payment) => (
                  <div key={payment.tempId} className="flex flex-wrap items-center gap-2 rounded-xl bg-[var(--page)] px-3.5 py-2.5">
                    <select
                      value={payment.indicadorPagamento}
                      onChange={(event) => handleUpdatePayment(payment.tempId, { indicadorPagamento: Number(event.target.value) })}
                      className="rounded-lg bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)]"
                    >
                      {NFE_INDICADOR_PAGAMENTO_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <select
                      value={payment.formaPagamento}
                      onChange={(event) => handleUpdatePayment(payment.tempId, { formaPagamento: event.target.value })}
                      className="min-w-[160px] flex-1 rounded-lg bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)]"
                    >
                      {NFE_FORMA_PAGAMENTO_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                    <input
                      type="date"
                      value={payment.dataPagamento}
                      onChange={(event) => handleUpdatePayment(payment.tempId, { dataPagamento: event.target.value })}
                      className="rounded-lg bg-[var(--surface)] px-3 py-2 text-[13px] text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)]"
                    />
                    <input
                      type="text"
                      inputMode="decimal"
                      placeholder="Valor"
                      value={payment.valorPagamento}
                      onChange={(event) => handleUpdatePayment(payment.tempId, { valorPagamento: event.target.value.replace(/[^\d.,]/g, '') })}
                      className="w-28 flex-none rounded-lg bg-[var(--surface)] px-3 py-2 text-right text-[13px] text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)]"
                    />
                    <button
                      type="button"
                      onClick={() => handleRemovePayment(payment.tempId)}
                      className="flex-none rounded-lg p-2 text-[var(--muted)] hover:bg-[var(--red-100)] hover:text-[var(--red-500)]"
                      aria-label="Remover pagamento"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </SectionCard>

          {error.length > 0 && (
            <div className="rounded-2xl bg-[var(--red-100)] p-4 text-[13.5px] font-medium text-[var(--red-500)]">
              <ul className="list-disc pl-4">
                {error.map((message, index) => (
                  <li key={index}>{message}</li>
                ))}
              </ul>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-[var(--blue-500)] px-6 py-2.5 text-[14px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
            >
              {submitting ? 'Salvando…' : 'Salvar rascunho'}
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
