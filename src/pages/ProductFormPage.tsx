import { useEffect, useState, type FormEvent } from 'react'
import {
  createProduct,
  fetchProduct,
  updateProduct,
  PRODUCT_ROLE_LABELS,
  PRODUCT_UNIT_OPTIONS,
  type ProductRecord,
} from '../lib/products'
import { ApiError } from '../lib/api'
import { TextField } from '../components/form/TextField'
import { SelectField } from '../components/form/SelectField'
import { BoxIcon, DollarSignIcon, TagIcon, FileTextIcon, ChevronLeftIcon } from '../components/icons'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface ProductFormPageProps {
  session: AuthSession
  company: AuthCompany
  productId?: string
  onBack: () => void
  onSaved: () => void
}

export function ProductFormPage({ session, company, productId, onBack, onSaved }: ProductFormPageProps) {
  const [loading, setLoading] = useState(Boolean(productId))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [name, setName] = useState('')
  const [role, setRole] = useState(0)
  const [internalCode, setInternalCode] = useState('')
  const [saleValue, setSaleValue] = useState('')
  const [unit, setUnit] = useState('')
  const [barcode, setBarcode] = useState('')
  const [description, setDescription] = useState('')

  const isProduct = role === 0

  useEffect(() => {
    if (!productId) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    fetchProduct(session.token.token, productId)
      .then((product: ProductRecord) => {
        if (cancelled) return
        setName(product.name ?? '')
        setRole(product.role ?? 0)
        setInternalCode(product.internal_code != null ? String(product.internal_code) : '')
        setSaleValue(product.sale_value ? String(product.sale_value) : '')
        setUnit(product.unit ?? '')
        setBarcode(product.barcode ?? '')
        setDescription(product.description ?? '')
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err instanceof ApiError ? err.message : 'Não foi possível carregar o item.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [productId, session.token.token, reloadKey])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Preencha o nome para continuar.')
      return
    }

    const payload = {
      company_id: company.id,
      role,
      name: name.trim(),
      internal_code: internalCode ? Number(internalCode) : undefined,
      sale_value: saleValue ? Number(saleValue.replace(',', '.')) : undefined,
      unit: isProduct && unit.trim() ? unit.trim() : undefined,
      barcode: isProduct && barcode.trim() ? barcode.trim() : undefined,
      description: isProduct && description.trim() ? description.trim() : undefined,
    }

    setSubmitting(true)
    try {
      if (productId) {
        await updateProduct(session.token.token, productId, payload)
      } else {
        await createProduct(session.token.token, payload)
      }
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o item.')
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
          Voltar para produtos e serviços
        </button>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Principal</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">
          {productId ? 'Editar item' : 'Novo item'}
        </h1>
      </div>

      {loading ? (
        <div className="h-11 animate-pulse rounded-xl bg-[var(--surface)]" />
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
            <h2 className="mb-4 text-[14px] font-bold text-[var(--ink)]">Dados do item</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <SelectField
                label="Tipo"
                value={role}
                onChange={(event) => setRole(Number(event.target.value))}
              >
                {Object.entries(PRODUCT_ROLE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
              <TextField
                label="Nome"
                icon={<BoxIcon className="h-4 w-4" />}
                placeholder={isProduct ? 'Ex: Filtro de óleo' : 'Ex: Taxa de limpeza'}
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <TextField
                label="Código interno"
                icon={<FileTextIcon className="h-4 w-4" />}
                placeholder="Automático"
                inputMode="numeric"
                value={internalCode}
                onChange={(event) => setInternalCode(event.target.value.replace(/\D/g, ''))}
              />
              <TextField
                label="Valor de venda"
                icon={<DollarSignIcon className="h-4 w-4" />}
                placeholder="0,00"
                inputMode="decimal"
                value={saleValue}
                onChange={(event) => setSaleValue(event.target.value.replace(/[^\d.,]/g, ''))}
              />

              {isProduct && (
                <>
                  <SelectField label="Unidade" value={unit} onChange={(event) => setUnit(event.target.value)}>
                    <option value="">Selecione</option>
                    {PRODUCT_UNIT_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </SelectField>
                  <TextField
                    label="Código de barras"
                    icon={<TagIcon className="h-4 w-4" />}
                    placeholder="Opcional"
                    value={barcode}
                    onChange={(event) => setBarcode(event.target.value)}
                  />
                  <TextField
                    label="Descrição"
                    icon={<FileTextIcon className="h-4 w-4" />}
                    placeholder="Opcional"
                    value={description}
                    onChange={(event) => setDescription(event.target.value)}
                  />
                </>
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
              {submitting ? 'Salvando…' : 'Salvar'}
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
