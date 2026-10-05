import { useEffect, useMemo, useState } from 'react'
import {
  courierVehicleLabel,
  deleteDeliveryCourier,
  fetchDeliveryCouriers,
  saveDeliveryCourier,
  type DeliveryCourierRecord,
} from '../lib/deliveryAdmin'
import { fetchVehicles, type VehicleRecord } from '../lib/vehicles'
import { SearchSelectField } from '../components/form/SearchSelectField'
import { ApiError } from '../lib/api'
import { formatPhone } from '../lib/formatPhone'
import { PlusIcon, PencilIcon, SearchIcon, TrashIcon, TruckIcon, UserIcon } from '../components/icons'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { TextField } from '../components/form/TextField'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface DeliveryCouriersPageProps {
  session: AuthSession
  company: AuthCompany
}

interface FormState {
  id?: string
  name: string
  phone: string
  vehicle: string
  vehicle_id: string | null
  vehicleLabel: string | null
  is_active: boolean
}

const EMPTY_FORM: FormState = {
  name: '',
  phone: '',
  vehicle: '',
  vehicle_id: null,
  vehicleLabel: null,
  is_active: true,
}

function vehicleOptionLabel(vehicle: VehicleRecord) {
  return [[vehicle.brand, vehicle.model].filter(Boolean).join(' '), vehicle.license_plate].filter(Boolean).join(' · ')
}

export function DeliveryCouriersPage({ session, company }: DeliveryCouriersPageProps) {
  const [items, setItems] = useState<DeliveryCourierRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [form, setForm] = useState<FormState | null>(null)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<DeliveryCourierRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  function load() {
    return fetchDeliveryCouriers(session.token.token, company.id)
      .then((res) => {
        setItems(res.data || [])
        setError(null)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os entregadores.'))
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    setLoading(true)
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [company.id, session.token.token])

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase()
    if (!term) return items
    return items.filter(
      (item) =>
        item.name.toLowerCase().includes(term) ||
        (item.phone || '').replace(/\D/g, '').includes(term.replace(/\D/g, '') || '§') ||
        courierVehicleLabel(item).toLowerCase().includes(term)
    )
  }, [items, search])

  function openEdit(item: DeliveryCourierRecord) {
    setFormError(null)
    setForm({
      id: item.id,
      name: item.name,
      phone: item.phone || '',
      vehicle: item.vehicle || '',
      vehicle_id: item.vehicle_id,
      vehicleLabel: item.linkedVehicle ? courierVehicleLabel(item) : null,
      is_active: item.is_active,
    })
  }

  async function handleSave() {
    if (!form) return
    if (!form.name.trim()) {
      setFormError('Informe o nome do entregador.')
      return
    }
    setSaving(true)
    setFormError(null)
    try {
      await saveDeliveryCourier(session.token.token, company.id, {
        id: form.id,
        name: form.name,
        phone: form.phone,
        vehicle: form.vehicle,
        vehicle_id: form.vehicle_id,
        is_active: form.is_active,
      })
      setForm(null)
      await load()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível salvar o entregador.')
    } finally {
      setSaving(false)
    }
  }

  async function handleToggle(item: DeliveryCourierRecord) {
    try {
      await saveDeliveryCourier(session.token.token, company.id, {
        id: item.id,
        name: item.name,
        phone: item.phone || '',
        vehicle: item.vehicle || '',
        vehicle_id: item.vehicle_id,
        is_active: !item.is_active,
      })
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível atualizar o entregador.')
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteDeliveryCourier(session.token.token, deleteTarget.id)
      setDeleteTarget(null)
      await load()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível excluir o entregador.')
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
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Entregadores</h1>
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
          Novo entregador
        </button>
      </div>

      <div className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
        <SearchIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
        <input
          type="text"
          placeholder="Buscar por nome, telefone ou veículo"
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
            {items.length === 0 ? 'Nenhum entregador cadastrado ainda.' : 'Nenhum entregador encontrado.'}
          </p>
        ) : (
          <ul className="divide-y divide-[var(--border)]">
            {filtered.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center gap-3 px-4 py-3.5">
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-[var(--blue-100)] text-[var(--blue-500)]">
                  <UserIcon className="h-5 w-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-bold text-[var(--ink)]">{item.name}</p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-[12.5px] text-[var(--ink-soft)]">
                    {item.phone && <span>{formatPhone(item.phone)}</span>}
                    {courierVehicleLabel(item) && (
                      <span className="flex items-center gap-1">
                        <TruckIcon className="h-3.5 w-3.5" />
                        {courierVehicleLabel(item)}
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
            <h2 className="text-[15px] font-bold text-[var(--ink)]">
              {form.id ? 'Editar entregador' : 'Novo entregador'}
            </h2>
            <div className="mt-4 flex flex-col gap-4">
              <TextField
                label="Nome"
                icon={<UserIcon className="h-4 w-4" />}
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                placeholder="Nome do entregador"
                autoFocus
              />
              <TextField
                label="Telefone / WhatsApp"
                icon={<span className="text-[11px] font-bold">☎</span>}
                value={form.phone}
                onChange={(event) => setForm({ ...form, phone: event.target.value })}
                placeholder="(65) 99999-9999"
                inputMode="tel"
              />
              <SearchSelectField
                label="Moto (veículos cadastrados)"
                placeholder="Buscar por placa, marca ou modelo"
                selectedLabel={form.vehicleLabel}
                onSearch={(query) =>
                  fetchVehicles(session.token.token, company.id, { search: query, limit: 8 }).then((res) => res.data)
                }
                getOptionLabel={(vehicle: VehicleRecord) => vehicleOptionLabel(vehicle) || vehicle.license_plate}
                onSelect={(vehicle: VehicleRecord) =>
                  setForm({
                    ...form,
                    vehicle_id: vehicle.id,
                    vehicleLabel: vehicleOptionLabel(vehicle) || vehicle.license_plate,
                  })
                }
                onClear={() => setForm({ ...form, vehicle_id: null, vehicleLabel: null })}
              />
              {!form.vehicle_id && (
                <TextField
                  label="Ou descreva o veículo"
                  icon={<TruckIcon className="h-4 w-4" />}
                  value={form.vehicle}
                  onChange={(event) => setForm({ ...form, vehicle: event.target.value })}
                  placeholder="Só se a moto ainda não estiver em Veículos"
                />
              )}
              <label className="flex items-center gap-2.5 text-[13px] text-[var(--ink)]">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(event) => setForm({ ...form, is_active: event.target.checked })}
                  className="h-4 w-4 accent-[var(--blue-500)]"
                />
                Ativo (aparece para escolher nos pedidos)
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
        title="Excluir entregador"
        message={`Excluir ${deleteTarget?.name ?? 'o entregador'}? Os pedidos já entregues por ele continuam no histórico.`}
        confirmLabel="Excluir"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </div>
  )
}
