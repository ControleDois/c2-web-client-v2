import { useEffect, useMemo, useState } from 'react'
import { MoneyField } from '../components/form/MoneyField'
import {
  deleteDeliveryNeighborhood,
  fetchDeliveryNeighborhoods,
  saveDeliveryNeighborhood,
  type DeliveryNeighborhoodRecord,
} from '../lib/deliveryAdmin'
import { ApiError } from '../lib/api'
import { formatCurrency } from '../lib/format'
import { ClockIcon, CoinIcon, PlusIcon, PencilIcon, RouteIcon, SearchIcon, TrashIcon } from '../components/icons'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { TextField } from '../components/form/TextField'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface DeliveryNeighborhoodsPageProps {
  session: AuthSession
  company: AuthCompany
}

interface FormState {
  id?: string
  name: string
  fee: string
  minutes: string
  is_active: boolean
}

const EMPTY_FORM: FormState = { name: '', fee: '', minutes: '', is_active: true }

function parseFee(text: string): number {
  const normalized = text.trim().replace(/[^\d,.-]/g, '')
  const value = normalized.includes(',') ? normalized.replace(/\./g, '').replace(',', '.') : normalized
  return value === '' ? 0 : Number(value)
}

export function DeliveryNeighborhoodsPage({ session, company }: DeliveryNeighborhoodsPageProps) {
  const [items, setItems] = useState<DeliveryNeighborhoodRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeliveryNeighborhoodRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  function load() {
    return fetchDeliveryNeighborhoods(session.token.token, company.id)
      .then((res) => {
        setItems(res.data || [])
        setError(null)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os bairros.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    setLoading(true)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id, session.token.token])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    return term ? items.filter((item) => item.name.toLowerCase().includes(term)) : items
  }, [items, search])

  const activeCount = items.filter((item) => item.is_active).length

  function openEdit(item: DeliveryNeighborhoodRecord) {
    setFormError(null)
    setForm({
      id: item.id,
      name: item.name,
      fee: String(Number(item.delivery_fee)).replace('.', ','),
      minutes: item.estimated_minutes ? String(item.estimated_minutes) : '',
      is_active: item.is_active,
    })
  }

  async function handleSave() {
    if (!form) return
    if (!form.name.trim()) {
      setFormError('Informe o nome do bairro.')
      return
    }
    const fee = parseFee(form.fee)
    if (!Number.isFinite(fee) || fee < 0) {
      setFormError('Informe uma taxa de entrega válida.')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      await saveDeliveryNeighborhood(session.token.token, company.id, {
        id: form.id,
        name: form.name,
        delivery_fee: fee,
        estimated_minutes: form.minutes.trim() ? Number(form.minutes) : null,
        is_active: form.is_active,
      })
      setForm(null)
      await load()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível salvar o bairro.')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(item: DeliveryNeighborhoodRecord) {
    try {
      await saveDeliveryNeighborhood(session.token.token, company.id, {
        id: item.id,
        name: item.name,
        delivery_fee: Number(item.delivery_fee),
        estimated_minutes: item.estimated_minutes,
        is_active: !item.is_active,
      })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível atualizar o bairro.')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteDeliveryNeighborhood(session.token.token, deleteTarget.id)
      setDeleteTarget(null)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível excluir o bairro.')
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-500)] uppercase">Delivery</p>
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Bairros e taxas de entrega</h1>
        </div>
        <button
          type="button"
          onClick={() => {
            setFormError(null)
            setForm({ ...EMPTY_FORM })
          }}
          className="flex items-center gap-2 rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)]"
        >
          <PlusIcon className="h-4 w-4" />
          Novo bairro
        </button>
      </div>

      <p className="rounded-xl bg-[var(--blue-100)] px-4 py-3 text-[12.5px] text-[var(--ink-soft)]">
        {activeCount > 0
          ? `Com bairros ativos (${activeCount}), o delivery só entrega neles e cobra a taxa e o tempo de cada bairro.`
          : 'Sem nenhum bairro ativo, vale a taxa única configurada na Loja Online e qualquer endereço é aceito.'}
      </p>

      <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
        <SearchIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
        <input
          type="text"
          placeholder="Buscar bairro"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          className="w-full bg-transparent text-[13.5px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
        />
      </div>

      {error && (
        <p className="rounded-xl bg-[var(--red-100)] px-4 py-3 text-[13px] font-medium text-[var(--red-500)]">
          {error}
        </p>
      )}

      <div className="overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--card-shadow)]">
        {loading ? (
          <p className="py-12 text-center text-[13.5px] text-[var(--muted)]">Carregando…</p>
        ) : filtered.length === 0 ? (
          <p className="py-12 text-center text-[13.5px] text-[var(--muted)]">
            {items.length === 0 ? 'Nenhum bairro cadastrado ainda.' : 'Nenhum bairro encontrado.'}
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {filtered.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[var(--blue-100)] text-[var(--blue-500)]">
                  <RouteIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold text-[var(--ink)]">{item.name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-4 text-[12.5px] text-[var(--ink-soft)]">
                    <span className="flex items-center gap-1">
                      <CoinIcon className="h-3.5 w-3.5" />
                      {Number(item.delivery_fee) > 0 ? formatCurrency(Number(item.delivery_fee)) : 'Entrega grátis'}
                    </span>
                    {item.estimated_minutes && (
                      <span className="flex items-center gap-1">
                        <ClockIcon className="h-3.5 w-3.5" />
                        {item.estimated_minutes} min
                      </span>
                    )}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => handleToggle(item)}
                  className={`rounded-full px-3 py-1 text-[11.5px] font-bold ${
                    item.is_active
                      ? 'bg-[var(--green-100)] text-[var(--green-600)]'
                      : 'bg-[var(--page)] text-[var(--muted)]'
                  }`}
                >
                  {item.is_active ? 'Ativo' : 'Inativo'}
                </button>
                <button
                  type="button"
                  onClick={() => openEdit(item)}
                  aria-label="Editar"
                  className="rounded-lg p-2 text-[var(--ink-soft)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
                >
                  <PencilIcon className="h-4 w-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(item)}
                  aria-label="Excluir"
                  className="rounded-lg p-2 text-[var(--red-500)] hover:bg-[var(--red-100)]"
                >
                  <TrashIcon className="h-4 w-4" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      {form && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={saving ? undefined : () => setForm(null)}
        >
          <div
            className="w-full max-w-[460px] rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 className="text-[15px] font-bold text-[var(--ink)]">{form.id ? 'Editar bairro' : 'Novo bairro'}</h2>
            <div className="mt-4 flex flex-col gap-4">
              <TextField
                label="Bairro"
                icon={<RouteIcon className="h-4 w-4" />}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Nome como o cliente digita o endereço"
                autoFocus
              />
              <div className="grid gap-4 sm:grid-cols-2">
                <MoneyField
                  label="Taxa de entrega (R$)"
                  icon={<CoinIcon className="h-4 w-4" />}
                  value={form.fee}
                  onChange={(event) => setForm({ ...form, fee: event.target.value })}
                  placeholder="0,00"
                />
                <TextField
                  label="Tempo estimado (min)"
                  icon={<ClockIcon className="h-4 w-4" />}
                  value={form.minutes}
                  onChange={(event) => setForm({ ...form, minutes: event.target.value.replace(/\D/g, '') })}
                  placeholder="Opcional"
                  inputMode="numeric"
                />
              </div>
              <label className="flex items-center gap-2.5 text-[13px] text-[var(--ink)]">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
                  className="h-4 w-4 accent-[var(--blue-500)]"
                />
                Ativo (o delivery entrega neste bairro)
              </label>
            </div>
            {formError && <p className="mt-3 text-[13px] font-medium text-[var(--red-500)]">{formError}</p>}
            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setForm(null)}
                disabled={saving}
                className="rounded-xl px-4 py-2 text-[13.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving}
                className="rounded-xl bg-[var(--blue-500)] px-4 py-2 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
              >
                {saving ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Excluir bairro"
        message={`Excluir ${deleteTarget?.name ?? 'o bairro'}? Os clientes deste bairro deixam de poder pedir entrega.`}
        confirmLabel="Excluir"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
