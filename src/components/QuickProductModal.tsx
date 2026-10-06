import { useCallback, useEffect, useState, type FormEvent } from 'react'
import {
  createProduct,
  ICMS_ORIGIN_LABELS,
  PRODUCT_UNIT_OPTIONS,
  type ProductRecord,
} from '../lib/products'
import { fetchNcms, type NcmRecord } from '../lib/ncm'
import { fetchNfeTaxations, type NfeTaxationRecord } from '../lib/nfeTaxations'
import { ApiError } from '../lib/api'
import { TextField } from './form/TextField'
import { MoneyField } from './form/MoneyField'
import { SelectField } from './form/SelectField'
import { SearchSelectField } from './form/SearchSelectField'
import { CloseIcon, TagIcon, WalletIcon } from './icons'
import type { AuthCompany, AuthSession } from '../lib/auth'

export interface QuickProductRequest {
  // Texto que a pessoa já tinha digitado na busca (vira o nome).
  name: string
  onCreated: (product: ProductRecord) => void
}

interface QuickProductModalProps {
  request: QuickProductRequest | null
  session: AuthSession
  company: AuthCompany
  onClose: () => void
}

// Cadastro rápido de produto com os dados fiscais mínimos da NF-e (NCM, grupo
// de tributação e origem), aberto de dentro da emissão.
export function QuickProductModal({ request, session, company, onClose }: QuickProductModalProps) {
  const [name, setName] = useState('')
  const [barcode, setBarcode] = useState('')
  const [unit, setUnit] = useState('UN')
  const [saleValue, setSaleValue] = useState('')
  const [origin, setOrigin] = useState('0')
  const [ncm, setNcm] = useState<{ id: string; label: string } | null>(null)
  const [taxation, setTaxation] = useState<{ id: string; label: string } | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!request) return
    setName(request.name)
    setBarcode('')
    setUnit('UN')
    setSaleValue('')
    setOrigin('0')
    setNcm(null)
    setTaxation(null)
    setError(null)
  }, [request])

  const searchNcms = useCallback(
    (query: string) => fetchNcms(session.token.token, { search: query, limit: 8 }).then((res) => res.data),
    [session.token.token]
  )
  const searchTaxations = useCallback(
    (query: string) =>
      fetchNfeTaxations(session.token.token, company.id, { search: query, limit: 8 }).then((res) => res.data),
    [session.token.token, company.id]
  )

  if (!request) return null

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    if (!request) return
    setError(null)

    if (!name.trim()) {
      setError('Informe o nome do produto.')
      return
    }
    if (!ncm) {
      setError('Escolha o NCM do produto.')
      return
    }
    if (!taxation) {
      setError('Escolha o grupo de tributação do produto.')
      return
    }

    setSaving(true)
    try {
      const created = await createProduct(session.token.token, {
        company_id: company.id,
        role: 0,
        name: name.trim(),
        barcode: barcode.trim() || undefined,
        unit,
        sale_value: saleValue ? Number(saleValue) : undefined,
        ncm_id: ncm.id,
        nfe_taxation_id: taxation.id,
        icms_origin: Number(origin),
      })
      request.onCreated(created)
      onClose()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível cadastrar o produto.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <form
        onSubmit={handleSubmit}
        onClick={(event) => event.stopPropagation()}
        className="max-h-[90svh] w-full max-w-[560px] overflow-y-auto rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[15px] font-bold text-[var(--ink)]">Cadastrar produto</h2>
            <p className="mt-1 text-[12.5px] text-[var(--ink-soft)]">
              Cadastro rápido com o necessário para a NF-e. O cadastro completo continua em Produtos.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)]"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 flex flex-col gap-4">
          <TextField
            label="Nome do produto"
            icon={<TagIcon className="h-4 w-4" />}
            autoFocus
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
          <div className="grid gap-4 sm:grid-cols-3">
            <SelectField label="Unidade" value={unit} onChange={(event) => setUnit(event.target.value)}>
              {PRODUCT_UNIT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </SelectField>
            <MoneyField
              label="Preço de venda"
              icon={<WalletIcon className="h-4 w-4" />}
              value={saleValue}
              onChange={(event) => setSaleValue(event.target.value)}
            />
            <TextField
              label="Código de barras"
              icon={<TagIcon className="h-4 w-4" />}
              placeholder="Opcional"
              value={barcode}
              onChange={(event) => setBarcode(event.target.value)}
            />
          </div>
          <SearchSelectField
            label="NCM"
            placeholder="Buscar por código ou descrição"
            selectedLabel={ncm?.label ?? null}
            onSearch={searchNcms}
            getOptionLabel={(item: NcmRecord) => `${item.code} - ${item.description}`}
            onSelect={(item: NcmRecord) => setNcm({ id: item.id, label: `${item.code} - ${item.description}` })}
            onClear={() => setNcm(null)}
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <SearchSelectField
              label="Grupo de tributação"
              placeholder="Buscar grupo"
              selectedLabel={taxation?.label ?? null}
              onSearch={searchTaxations}
              getOptionLabel={(item: NfeTaxationRecord) => item.name}
              onSelect={(item: NfeTaxationRecord) => setTaxation({ id: item.id, label: item.name })}
              onClear={() => setTaxation(null)}
            />
            <SelectField label="Origem" value={origin} onChange={(event) => setOrigin(event.target.value)}>
              {Object.entries(ICMS_ORIGIN_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
          </div>
        </div>

        {error && <p className="mt-4 text-[13px] font-medium text-[var(--red-500)]">{error}</p>}

        <div className="mt-6 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-11 flex-1 rounded-xl border border-[var(--border)] text-[13px] font-bold text-[var(--ink-soft)]"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving}
            className="h-11 flex-1 rounded-xl bg-[var(--blue-500)] text-[13px] font-bold text-white hover:bg-[var(--blue-700)] disabled:opacity-60"
          >
            {saving ? 'Salvando…' : 'Cadastrar e adicionar'}
          </button>
        </div>
      </form>
    </div>
  )
}
