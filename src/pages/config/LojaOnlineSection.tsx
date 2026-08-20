import { useEffect, useMemo, useState } from 'react'
import type { ConfigPayload, ShopOpeningHour, ShopPayload } from '../../lib/config'
import { TextField } from '../../components/form/TextField'
import { LinkIcon, TagIcon, PaperclipIcon, TrashIcon, PlusIcon, CheckCircleIcon } from '../../components/icons'

interface LojaOnlineSectionProps {
  value: ConfigPayload
  onChange: (patch: Partial<ConfigPayload>) => void
}

const WEEKDAY_LABELS = ['Domingo', 'Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado']

function defaultOpeningHours(): ShopOpeningHour[] {
  return Array.from({ length: 7 }).map((_, weekday) => ({ weekday, enabled: false, opens: '08:00', closes: '18:00' }))
}

function defaultShop(): ShopPayload {
  return { link_url: '', is_active: false, accepting_orders: true, opening_hours: defaultOpeningHours(), categories: [] }
}

export function LojaOnlineSection({ value, onChange }: LojaOnlineSectionProps) {
  const [categoryInput, setCategoryInput] = useState('')
  const [copied, setCopied] = useState(false)

  const shop = value.shop ?? defaultShop()
  const openingHours = shop.opening_hours ?? defaultOpeningHours()

  const publicUrl = useMemo(() => {
    if (!shop.link_url) return ''
    return `${window.location.origin}/delivery/${shop.link_url}`
  }, [shop.link_url])

  const bannerPreviewUrl = useMemo(
    () => (shop.banner_file ? URL.createObjectURL(shop.banner_file) : null),
    [shop.banner_file]
  )
  useEffect(() => {
    return () => {
      if (bannerPreviewUrl) URL.revokeObjectURL(bannerPreviewUrl)
    }
  }, [bannerPreviewUrl])

  function patchShop(patch: Partial<ShopPayload>) {
    onChange({ shop: { ...shop, ...patch } })
  }

  function updateOpeningHour(weekday: number, patch: Partial<ShopOpeningHour>) {
    patchShop({ opening_hours: openingHours.map((hour) => (hour.weekday === weekday ? { ...hour, ...patch } : hour)) })
  }

  function addCategory() {
    const name = categoryInput.trim()
    if (!name) return
    const categories = shop.categories ?? []
    if (categories.includes(name)) return
    patchShop({ categories: [...categories, name] })
    setCategoryInput('')
  }

  function removeCategory(name: string) {
    patchShop({ categories: (shop.categories ?? []).filter((c) => c !== name) })
  }

  function handleCopy() {
    if (!publicUrl) return
    navigator.clipboard.writeText(publicUrl).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className="flex flex-col gap-6">
      <div>
        <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Link público da loja</span>
        <div className="mt-1.5 flex items-center gap-2 rounded-xl bg-[var(--page)] px-3.5 py-2.5">
          <LinkIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
          <span className="w-full truncate text-[13px] text-[var(--ink-soft)]">
            {publicUrl || 'Defina o slug abaixo para gerar o link'}
          </span>
          {publicUrl && (
            <button
              type="button"
              onClick={handleCopy}
              className="flex-none rounded-lg px-2.5 py-1 text-[12px] font-bold text-[var(--blue-700)] hover:bg-[var(--blue-100)]"
            >
              {copied ? (
                <span className="flex items-center gap-1">
                  <CheckCircleIcon className="h-3.5 w-3.5" /> Copiado
                </span>
              ) : (
                'Copiar'
              )}
            </button>
          )}
        </div>
      </div>

      <div className="flex items-center gap-4">
        <span className="flex h-16 w-16 flex-none items-center justify-center overflow-hidden rounded-xl bg-[var(--page)] text-[var(--muted)]">
          {bannerPreviewUrl ? (
            <img src={bannerPreviewUrl} alt="" className="h-full w-full object-cover" />
          ) : (
            <PaperclipIcon className="h-6 w-6" />
          )}
        </span>
        <label className="flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]">
          <PaperclipIcon className="h-3.5 w-3.5 flex-none" />
          {shop.banner_file ? shop.banner_file.name : 'Selecionar banner'}
          <input
            type="file"
            accept=".jpg,.jpeg,.png,.webp"
            className="hidden"
            onChange={(event) => patchShop({ banner_file: event.target.files?.[0] })}
          />
        </label>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        <TextField
          label="Slug (link_url)"
          icon={<LinkIcon className="h-4 w-4" />}
          placeholder="minha-loja"
          value={shop.link_url}
          onChange={(event) => patchShop({ link_url: event.target.value })}
        />
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Cor padrão</span>
          <input
            type="color"
            value={shop.color_default ?? '#1478c4'}
            onChange={(event) => patchShop({ color_default: event.target.value })}
            className="h-[42px] w-full cursor-pointer rounded-xl bg-[var(--page)] px-2"
          />
        </label>
        <div className="flex items-end gap-4 pb-2.5">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={Boolean(shop.is_active)}
              onChange={(event) => patchShop({ is_active: event.target.checked })}
              className="h-4 w-4 accent-[var(--blue-500)]"
            />
            <span className="text-[13px] font-semibold text-[var(--ink)]">Loja ativa</span>
          </label>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={shop.accepting_orders ?? true}
              onChange={(event) => patchShop({ accepting_orders: event.target.checked })}
              className="h-4 w-4 accent-[var(--blue-500)]"
            />
            <span className="text-[13px] font-semibold text-[var(--ink)]">Aceitando pedidos</span>
          </label>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <TextField
          label="Taxa de entrega"
          icon={<TagIcon className="h-4 w-4" />}
          type="number"
          value={shop.delivery_fee ?? ''}
          onChange={(event) => patchShop({ delivery_fee: Number(event.target.value) })}
        />
        <TextField
          label="Pedido mínimo"
          icon={<TagIcon className="h-4 w-4" />}
          type="number"
          value={shop.minimum_order_value ?? ''}
          onChange={(event) => patchShop({ minimum_order_value: Number(event.target.value) })}
        />
        <TextField
          label="Raio de entrega (km)"
          icon={<TagIcon className="h-4 w-4" />}
          type="number"
          value={shop.delivery_radius_km ?? ''}
          onChange={(event) => patchShop({ delivery_radius_km: Number(event.target.value) })}
        />
        <TextField
          label="Tempo estimado (min)"
          icon={<TagIcon className="h-4 w-4" />}
          type="number"
          value={shop.estimated_delivery_minutes ?? ''}
          onChange={(event) => patchShop({ estimated_delivery_minutes: Number(event.target.value) })}
        />
      </div>

      <div>
        <h3 className="mb-2 text-[13px] font-bold text-[var(--ink)]">Categorias</h3>
        <div className="mb-2 flex gap-2">
          <input
            type="text"
            value={categoryInput}
            onChange={(event) => setCategoryInput(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') {
                event.preventDefault()
                addCategory()
              }
            }}
            placeholder="Ex: Bebidas, Sobremesas"
            className="w-full max-w-xs rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)]"
          />
          <button
            type="button"
            onClick={addCategory}
            className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-2 text-[12.5px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]"
          >
            <PlusIcon className="h-3.5 w-3.5" />
            Adicionar
          </button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(shop.categories ?? []).map((category) => (
            <span
              key={category}
              className="flex items-center gap-1.5 rounded-full bg-[var(--blue-100)] px-3 py-1 text-[12px] font-semibold text-[var(--blue-700)]"
            >
              {category}
              <button type="button" onClick={() => removeCategory(category)} aria-label={`Remover ${category}`}>
                <TrashIcon className="h-3 w-3" />
              </button>
            </span>
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-[13px] font-bold text-[var(--ink)]">Horário de funcionamento</h3>
        <div className="flex flex-col gap-2">
          {openingHours.map((hour) => (
            <div key={hour.weekday} className="flex flex-wrap items-center gap-3 rounded-xl bg-[var(--page)] px-4 py-2.5">
              <label className="flex w-32 flex-none items-center gap-2">
                <input
                  type="checkbox"
                  checked={hour.enabled}
                  onChange={(event) => updateOpeningHour(hour.weekday, { enabled: event.target.checked })}
                  className="h-4 w-4 accent-[var(--blue-500)]"
                />
                <span className="text-[13px] font-semibold text-[var(--ink)]">{WEEKDAY_LABELS[hour.weekday]}</span>
              </label>
              <input
                type="time"
                value={hour.opens}
                disabled={!hour.enabled}
                onChange={(event) => updateOpeningHour(hour.weekday, { opens: event.target.value })}
                className="rounded-xl bg-[var(--surface)] px-3 py-1.5 text-[13px] text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)] disabled:opacity-50"
              />
              <span className="text-[12px] text-[var(--muted)]">até</span>
              <input
                type="time"
                value={hour.closes}
                disabled={!hour.enabled}
                onChange={(event) => updateOpeningHour(hour.weekday, { closes: event.target.value })}
                className="rounded-xl bg-[var(--surface)] px-3 py-1.5 text-[13px] text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)] disabled:opacity-50"
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
