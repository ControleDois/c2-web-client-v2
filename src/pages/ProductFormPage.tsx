import { useCallback, useEffect, useRef, useState, type FormEvent } from 'react'
import { MoneyField } from '../components/form/MoneyField'
import { parseMoney } from '../lib/money'
import {
  createProduct,
  fetchProduct,
  updateProduct,
  PRODUCT_ROLE_LABELS,
  PRODUCT_UNIT_OPTIONS,
  ICMS_ORIGIN_LABELS,
  type ProductRecord,
  type ProductCategoryRef,
} from '../lib/products'
import { fetchCategoryProducts, type CategoryProductRecord } from '../lib/categoryProducts'
import { fetchNcms, type NcmRecord } from '../lib/ncm'
import { fetchNfeTaxations, type NfeTaxationRecord } from '../lib/nfeTaxations'
import { ApiError } from '../lib/api'
import { TextField } from '../components/form/TextField'
import { SelectField } from '../components/form/SelectField'
import { SearchSelectField } from '../components/form/SearchSelectField'
import { SectionCard } from '../components/SectionCard'
import {
  RecipeEditor,
  draftsFromRecipe,
  recipeError,
  saveRecipeDrafts,
  type RecipeLineDraft,
} from '../components/product/RecipeEditor'
import { fetchRecipe } from '../lib/stock'
import { PopupPanel } from '../components/PopupPanel'
import { isChaveiro, isVidracaria } from '../lib/systemTypes'
import {
  ComplementsEditor,
  complementsError,
  draftsFromRecords,
  payloadFromDrafts,
  type ComplementGroupDraft,
} from '../components/product/ComplementsEditor'
import { BoxIcon, DollarSignIcon, TagIcon, FileTextIcon, ChevronLeftIcon, PlusIcon, CloseIcon } from '../components/icons'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface ProductFormPageProps {
  session: AuthSession
  company: AuthCompany
  productId?: string
  // Novo item vindo da aba Insumos: já abre com "é insumo" marcado.
  defaultIngredient?: boolean
  onBack: () => void
  onSaved: () => void
}

export function ProductFormPage({ session, company, productId, defaultIngredient = false, onBack, onSaved }: ProductFormPageProps) {
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
  const [printToken, setPrintToken] = useState(false)
  const [askName, setAskName] = useState(false)

  const [selectedCategories, setSelectedCategories] = useState<ProductCategoryRef[]>([])
  const [availableCategories, setAvailableCategories] = useState<CategoryProductRecord[]>([])
  const [showCategoryPicker, setShowCategoryPicker] = useState(false)
  const categoryAnchorRef = useRef<HTMLDivElement>(null)
  const [categorySearch, setCategorySearch] = useState('')

  // Dados fiscais (NFe)
  const [ncm, setNcm] = useState<{ id: string; label: string } | null>(null)
  const [nfeTaxation, setNfeTaxation] = useState<{ id: string; label: string } | null>(null)
  const [icmsOrigin, setIcmsOrigin] = useState('')
  const [codeCest, setCodeCest] = useState('')
  const [complements, setComplements] = useState<ComplementGroupDraft[]>([])
  const [isIngredient, setIsIngredient] = useState(Boolean(defaultIngredient) && !productId)
  const [controlsStock, setControlsStock] = useState(true)
  const [minStock, setMinStock] = useState('')
  const [recipe, setRecipe] = useState<RecipeLineDraft[]>([])
  const [producible, setProducible] = useState<number | null>(null)
  const [createdId, setCreatedId] = useState<string | null>(null)

  const isProduct = role === 0

  const searchNcms = useCallback(
    (query: string) => fetchNcms(session.token.token, { search: query, limit: 8 }).then((res) => res.data),
    [session.token.token]
  )
  const searchNfeTaxations = useCallback(
    (query: string) => fetchNfeTaxations(session.token.token, company.id, { search: query, limit: 8 }).then((res) => res.data),
    [session.token.token, company.id]
  )

  useEffect(() => {
    let cancelled = false
    fetchCategoryProducts(session.token.token, company.id, { limit: 200 })
      .then((res) => {
        if (!cancelled) setAvailableCategories(res.data)
      })
      .catch(() => {})
    return () => {
      cancelled = true
    }
  }, [session.token.token, company.id])

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
        setPrintToken(Boolean(product.print_token))
        setAskName(Boolean(product.ask_name))
        setSelectedCategories(product.categories ?? [])
        setNcm(product.ncm ? { id: product.ncm.id, label: `${product.ncm.code} - ${product.ncm.description}` } : null)
        setNfeTaxation(product.taxation ? { id: product.taxation.id, label: product.taxation.name } : null)
        setIcmsOrigin(product.icms_origin !== null && product.icms_origin !== undefined ? String(product.icms_origin) : '')
        setCodeCest(product.code_cest ?? '')
        setComplements(draftsFromRecords(product.complements))
        setIsIngredient(Boolean(product.is_ingredient))
        setControlsStock(product.controls_stock !== false)
        setMinStock(product.min_stock !== null && product.min_stock !== undefined ? String(Number(product.min_stock)) : '')
        if ((product.role ?? 0) === 0) {
          fetchRecipe(session.token.token, productId)
            .then((loaded) => {
              if (cancelled) return
              setRecipe(draftsFromRecipe(loaded))
              setProducible(loaded.items.length ? loaded.producible : null)
            })
            .catch(() => {})
        }
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

    if (isProduct) {
      const problem = complementsError(complements) ?? (isIngredient ? null : recipeError(recipe))
      if (problem) {
        setError(problem)
        return
      }
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
      print_token: isProduct ? printToken : false,
      ask_name: isProduct ? askName : false,
      categories: isProduct ? selectedCategories.map((category) => ({ id: category.id })) : undefined,
      ncm_id: isProduct ? ncm?.id : undefined,
      nfe_taxation_id: isProduct ? nfeTaxation?.id : undefined,
      icms_origin: isProduct && icmsOrigin !== '' ? Number(icmsOrigin) : undefined,
      code_cest: isProduct && codeCest.trim() ? codeCest.trim() : undefined,
      complements: isProduct ? payloadFromDrafts(complements) : undefined,
      is_ingredient: isProduct ? isIngredient : undefined,
      controls_stock: isProduct ? controlsStock : undefined,
      min_stock: isProduct ? (parseMoney(minStock) ?? null) : undefined,
    }

    setSubmitting(true)
    try {
      const currentId = productId ?? createdId
      let savedId = currentId
      if (currentId) {
        await updateProduct(session.token.token, currentId, payload)
      } else {
        const created = await createProduct(session.token.token, payload)
        savedId = created.id
        setCreatedId(created.id)
      }
      // A ficha técnica é salva à parte. Se der erro, o produto já foi salvo: a pessoa corrige e salva de novo.
      if (isProduct && savedId) {
        try {
          await saveRecipeDrafts(session.token.token, savedId, isIngredient ? [] : recipe)
        } catch (err) {
          setError(
            `O produto foi salvo, mas a ficha técnica não: ${err instanceof ApiError ? err.message : 'tente de novo.'}`
          )
          return
        }
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
          {isVidracaria(company.system_type) ? 'Voltar para produtos fiscais' : 'Voltar para produtos e serviços'}
        </button>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Principal</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">
          {isVidracaria(company.system_type) ? (productId ? 'Editar produto fiscal' : 'Novo produto fiscal') : productId ? 'Editar item' : 'Novo item'}
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
              <MoneyField
                label="Valor de venda"
                icon={<DollarSignIcon className="h-4 w-4" />}
                placeholder="0,00"
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

            {isProduct && !isVidracaria(company.system_type) && (
              <label className="mt-4 flex items-start gap-2.5 rounded-xl bg-[var(--page)] p-3.5">
                <input
                  type="checkbox"
                  checked={printToken}
                  onChange={(event) => setPrintToken(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[var(--blue-500)]"
                />
                <span>
                  <span className="block text-[13.5px] font-semibold text-[var(--ink)]">Imprimir ficha na venda</span>
                  <span className="block text-[12px] text-[var(--ink-soft)]">
                    Cada unidade vendida no PDV imprime uma ficha com código de barras. O cliente troca a ficha pelo produto e o
                    caixa bipa para dar baixa. Sai na impressora do comprovante.
                  </span>
                </span>
              </label>
            )}

            {isProduct && !isVidracaria(company.system_type) && (
              <label className="mt-4 flex items-start gap-2.5 rounded-xl bg-[var(--page)] p-3.5">
                <input
                  type="checkbox"
                  checked={askName}
                  onChange={(event) => setAskName(event.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[var(--blue-500)]"
                />
                <span>
                  <span className="block text-[13.5px] font-semibold text-[var(--ink)]">Produto avulso (pedir o nome na venda)</span>
                  <span className="block text-[12px] text-[var(--ink-soft)]">
                    Ao bipar ou escolher este produto no PDV, o caixa digita o nome do item e o valor. Serve para vender na hora algo que
                    não está cadastrado, sem criar um produto novo.
                  </span>
                </span>
              </label>
            )}

            {isProduct && (
              <div className="mt-4">
                <span className="mb-1.5 block text-[12px] font-semibold text-[var(--ink-soft)]">Categorias</span>
                <div className="flex flex-wrap items-center gap-1.5">
                  {selectedCategories.map((category) => (
                    <span
                      key={category.id}
                      className="flex items-center gap-1.5 rounded-lg bg-[var(--blue-100)] px-2.5 py-1.5 text-[12.5px] font-semibold text-[var(--blue-700)]"
                    >
                      {category.name}
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedCategories((prev) => prev.filter((c) => c.id !== category.id))
                        }
                        className="rounded-full p-0.5 hover:bg-[var(--blue-300)]"
                      >
                        <CloseIcon className="h-3 w-3" />
                      </button>
                    </span>
                  ))}

                  <div ref={categoryAnchorRef} className="relative">
                    <button
                      type="button"
                      onClick={() => setShowCategoryPicker((prev) => !prev)}
                      className="flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-2.5 py-1.5 text-[12.5px] font-semibold text-[var(--ink-soft)] hover:border-[var(--blue-500)] hover:text-[var(--blue-700)]"
                    >
                      <PlusIcon className="h-3.5 w-3.5" />
                      Adicionar categoria
                    </button>

                    {showCategoryPicker && (
                      <PopupPanel anchorRef={categoryAnchorRef} width={256} maxHeight={360} className="p-2">
                        <input
                          type="text"
                          autoFocus
                          placeholder="Buscar categoria"
                          value={categorySearch}
                          onChange={(event) => setCategorySearch(event.target.value)}
                          className="w-full rounded-lg bg-[var(--page)] px-3 py-2 text-[13px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
                        />
                        <div className="mt-1.5 flex flex-col gap-0.5">
                          {availableCategories
                            .filter((category) => !selectedCategories.some((c) => c.id === category.id))
                            .filter((category) =>
                              categorySearch.trim()
                                ? category.name.toLowerCase().includes(categorySearch.trim().toLowerCase())
                                : true
                            )
                            .map((category) => (
                              <button
                                key={category.id}
                                type="button"
                                onClick={() => {
                                  setSelectedCategories((prev) => [...prev, category])
                                  setCategorySearch('')
                                }}
                                className="rounded-lg px-2.5 py-1.5 text-left text-[13px] text-[var(--ink)] hover:bg-[var(--page)]"
                              >
                                {category.name}
                              </button>
                            ))}
                          {availableCategories.filter(
                            (category) => !selectedCategories.some((c) => c.id === category.id)
                          ).length === 0 && (
                            <p className="px-2.5 py-1.5 text-[12.5px] text-[var(--muted)]">
                              Nenhuma categoria disponível.
                            </p>
                          )}
                        </div>
                      </PopupPanel>
                    )}
                  </div>
                </div>
              </div>
            )}
          </div>

          {isProduct && (
            <SectionCard title="Dados fiscais" subtitle="Necessários para emitir NFe com este item">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <SearchSelectField
                  label="NCM"
                  placeholder="Buscar por código ou descrição"
                  selectedLabel={ncm?.label ?? null}
                  onSearch={searchNcms}
                  getOptionLabel={(item: NcmRecord) => `${item.code} - ${item.description}`}
                  onSelect={(item: NcmRecord) => setNcm({ id: item.id, label: `${item.code} - ${item.description}` })}
                  onClear={() => setNcm(null)}
                />
                <SearchSelectField
                  label="Tributação"
                  placeholder="Buscar tributação"
                  selectedLabel={nfeTaxation?.label ?? null}
                  onSearch={searchNfeTaxations}
                  getOptionLabel={(item: NfeTaxationRecord) => item.name}
                  onSelect={(item: NfeTaxationRecord) => setNfeTaxation({ id: item.id, label: item.name })}
                  onClear={() => setNfeTaxation(null)}
                />
                <SelectField
                  label="Origem da mercadoria (ICMS)"
                  value={icmsOrigin}
                  onChange={(event) => setIcmsOrigin(event.target.value)}
                >
                  <option value="">Selecione</option>
                  {Object.entries(ICMS_ORIGIN_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </SelectField>
                <TextField
                  label="Código CEST"
                  icon={<TagIcon className="h-4 w-4" />}
                  placeholder="Opcional"
                  value={codeCest}
                  onChange={(event) => setCodeCest(event.target.value)}
                />
              </div>
            </SectionCard>
          )}

          {isProduct && (
            <SectionCard
              title="Estoque"
              subtitle="Controle de saldo, estoque mínimo e insumo"
            >
              <div className="flex flex-col gap-4">
                <label className="flex items-start gap-2.5 rounded-xl bg-[var(--page)] p-3.5">
                  <input
                    type="checkbox"
                    checked={isIngredient}
                    onChange={(event) => setIsIngredient(event.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-[var(--blue-500)]"
                  />
                  <span>
                    <span className="block text-[13.5px] font-semibold text-[var(--ink)]">É um insumo (matéria-prima)</span>
                    <span className="block text-[12px] text-[var(--ink-soft)]">
                      Marque para itens que você compra para fazer os produtos (pão, carne, queijo, embalagem). Eles entram no estoque e nas fichas técnicas, mas não aparecem no PDV nem no cardápio.
                    </span>
                  </span>
                </label>
                {!isIngredient && (
                  <label className="flex items-start gap-2.5 rounded-xl bg-[var(--page)] p-3.5">
                    <input
                      type="checkbox"
                      checked={controlsStock}
                      onChange={(event) => setControlsStock(event.target.checked)}
                      className="mt-0.5 h-4 w-4 accent-[var(--blue-500)]"
                    />
                    <span>
                      <span className="block text-[13.5px] font-semibold text-[var(--ink)]">Controlar o estoque deste item</span>
                      <span className="block text-[12px] text-[var(--ink-soft)]">
                        Ligado: cada venda desconta do estoque (ou dos insumos, se tiver ficha técnica). Desligue para itens feitos sob encomenda ou que você não controla.
                      </span>
                    </span>
                  </label>
                )}
                {(isIngredient || controlsStock) && (
                  <div className="max-w-[260px]">
                    <TextField
                      label={`Estoque mínimo${unit ? ` (${unit})` : ''}`}
                      icon={<BoxIcon className="h-4 w-4" />}
                      inputMode="decimal"
                      placeholder="Sem aviso"
                      value={minStock}
                      onChange={(event) => setMinStock(event.target.value.replace(/[^\d.,]/g, ''))}
                    />
                    <p className="mt-1.5 text-[12px] text-[var(--muted)]">Quando o saldo chegar nesse número, o item aparece como "baixo" no estoque e no dashboard.</p>
                  </div>
                )}
              </div>
            </SectionCard>
          )}

          {isProduct && !isIngredient && !isChaveiro(company.system_type) && (
            <SectionCard
              title="Ficha técnica (receita)"
              subtitle="Insumos que cada unidade gasta, custo de produção e margem"
              defaultCollapsed={false}
            >
              <RecipeEditor
                value={recipe}
                onChange={setRecipe}
                token={session.token.token}
                companyId={company.id}
                productId={productId ?? createdId ?? undefined}
                salePrice={parseMoney(saleValue) ?? 0}
                producible={producible}
              />
            </SectionCard>
          )}

          {isProduct && !isChaveiro(company.system_type) && (
            <SectionCard
              title="Complementos"
              subtitle="Sabores, bordas e adicionais que o cliente escolhe (delivery, iFood e PDV)"
            >
              <ComplementsEditor value={complements} onChange={setComplements} token={session.token.token} />
            </SectionCard>
          )}

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
