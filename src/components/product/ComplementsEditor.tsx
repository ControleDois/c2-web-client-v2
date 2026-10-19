import { useRef } from 'react'
import { MoneyField } from '../form/MoneyField'
import { TextField } from '../form/TextField'
import { ApiError } from '../../lib/api'
import { parseMoney } from '../../lib/money'
import {
  uploadComplementImage,
  type ProductComplementPayload,
  type ProductComplementRecord,
} from '../../lib/products'
import { BoxIcon, CameraIcon, CloseIcon, DollarSignIcon, PlusIcon, TagIcon, TrashIcon } from '../icons'

// Complementos do produto (sabores, bordas, adicionais): grupos e, dentro de cada um, as opções que o cliente
// escolhe, cada uma com nome, preço, foto e se está disponível.

export interface ComplementOptionDraft {
  key: string
  id?: string
  productId: string | null
  description: string
  price: string
  active: boolean
  imageUrl: string | null
  fileName: string | null
  fileSize: number | null
  uploading: boolean
  uploadError: string | null
}

export interface ComplementGroupDraft {
  key: string
  id?: string
  name: string
  required: boolean
  minimum: string
  maximum: string
  templateId: string | null
  templateName: string | null
  templateCount: number
  options: ComplementOptionDraft[]
}

const nextKey = () => `c${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`

export function newOption(): ComplementOptionDraft {
  return {
    key: nextKey(),
    productId: null,
    description: '',
    price: '',
    active: true,
    imageUrl: null,
    fileName: null,
    fileSize: null,
    uploading: false,
    uploadError: null,
  }
}

export function newGroup(): ComplementGroupDraft {
  return {
    key: nextKey(),
    name: '',
    required: false,
    minimum: '0',
    maximum: '1',
    templateId: null,
    templateName: null,
    templateCount: 0,
    options: [newOption()],
  }
}

export function draftsFromRecords(records: ProductComplementRecord[] | undefined): ComplementGroupDraft[] {
  return (records ?? []).map((record) => {
    const template = record.complement_template ?? record.complementTemplate ?? null
    return {
      key: nextKey(),
      id: record.id,
      name: record.name ?? '',
      required: Boolean(record.required),
      minimum: String(record.minimum ?? 0),
      maximum: String(record.maximum ?? 1),
      templateId: record.complement_template_id ?? null,
      templateName: template?.name ?? null,
      templateCount: template?.options?.length ?? 0,
      options: record.complement_template_id
        ? []
        : (record.products ?? []).map((option) => ({
            key: nextKey(),
            id: option.id,
            productId: option.product_id ?? null,
            description: option.description ?? '',
            price: option.sale_value === null || option.sale_value === undefined ? '' : String(option.sale_value),
            active: option.status !== false,
            imageUrl: option.image_url ?? null,
            fileName: option.file_name ?? null,
            fileSize: option.file_size ?? null,
            uploading: false,
            uploadError: null,
          })),
    }
  })
}

export function payloadFromDrafts(drafts: ComplementGroupDraft[]): ProductComplementPayload[] {
  return drafts.map((group) => ({
    id: group.id,
    name: group.name.trim(),
    required: group.required,
    minimum: Math.max(0, Math.round(Number(group.minimum) || 0)),
    maximum: Math.max(1, Math.round(Number(group.maximum) || 1)),
    complement_template_id: group.templateId,
    products: group.templateId
      ? []
      : group.options.map((option) => ({
          id: option.id,
          product_id: option.productId,
          description: option.description.trim(),
          sale_value: parseMoney(option.price) ?? 0,
          active: option.active,
          image_url: option.imageUrl,
          file_name: option.fileName,
          file_size: option.fileSize,
        })),
  }))
}

// Mensagem do primeiro problema que impede de salvar (ou null).
export function complementsError(drafts: ComplementGroupDraft[]): string | null {
  for (const [index, group] of drafts.entries()) {
    const label = group.name.trim() ? `"${group.name.trim()}"` : `${index + 1}`
    if (!group.name.trim()) return `Dê um nome ao grupo de complementos ${index + 1}.`
    if (group.templateId) continue
    if (group.options.length === 0) return `Adicione pelo menos um complemento no grupo ${label}.`
    if (Number(group.maximum) < Number(group.minimum)) {
      return `No grupo ${label}, o máximo não pode ser menor que o mínimo.`
    }
    for (const option of group.options) {
      if (option.uploading) return 'Espere a foto terminar de enviar para salvar.'
      if (!option.description.trim()) return `Dê um nome a todos os complementos do grupo ${label}.`
      if (parseMoney(option.price) === null) return `Informe o preço do complemento "${option.description.trim()}" (pode ser 0,00).`
    }
  }
  return null
}

type Tone = 'blue' | 'good' | 'pause'
const TONE_ACTIVE: Record<Tone, string> = {
  blue: 'bg-[var(--blue-500)] text-white',
  good: 'bg-[var(--green-600)] text-white',
  pause: 'bg-[var(--amber-500)] text-white',
}
const segmented = (active: boolean, tone: Tone = 'blue') =>
  `rounded-md px-3.5 py-2 text-[13px] font-bold transition ${active ? TONE_ACTIVE[tone] : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'}`

interface ComplementsEditorProps {
  value: ComplementGroupDraft[]
  onChange: (next: ComplementGroupDraft[]) => void
  token: string
}

export function ComplementsEditor({ value, onChange, token }: ComplementsEditorProps) {
  const fileInput = useRef<HTMLInputElement>(null)
  const uploadTarget = useRef<{ group: string; option: string } | null>(null)

  const updateGroup = (key: string, patch: Partial<ComplementGroupDraft>) =>
    onChange(value.map((group) => (group.key === key ? { ...group, ...patch } : group)))

  const updateOption = (groupKey: string, optionKey: string, patch: Partial<ComplementOptionDraft>) =>
    onChange(
      value.map((group) =>
        group.key === groupKey
          ? { ...group, options: group.options.map((option) => (option.key === optionKey ? { ...option, ...patch } : option)) }
          : group
      )
    )

  // O envio é assíncrono: usa sempre a lista mais recente que o pai guardou.
  const latest = useRef(value)
  latest.current = value
  const patchLatestOption = (groupKey: string, optionKey: string, patch: Partial<ComplementOptionDraft>) =>
    onChange(
      latest.current.map((group) =>
        group.key === groupKey
          ? { ...group, options: group.options.map((option) => (option.key === optionKey ? { ...option, ...patch } : option)) }
          : group
      )
    )

  function pickPhoto(groupKey: string, optionKey: string) {
    uploadTarget.current = { group: groupKey, option: optionKey }
    fileInput.current?.click()
  }

  async function handleFile(files: FileList | null) {
    const target = uploadTarget.current
    const file = files?.[0]
    if (fileInput.current) fileInput.current.value = ''
    if (!target || !file) return
    updateOption(target.group, target.option, { uploading: true, uploadError: null })
    try {
      const uploaded = await uploadComplementImage(token, file)
      patchLatestOption(target.group, target.option, {
        uploading: false,
        imageUrl: uploaded.image_url,
        fileName: uploaded.file_name,
        fileSize: uploaded.file_size,
      })
    } catch (err) {
      patchLatestOption(target.group, target.option, {
        uploading: false,
        uploadError: err instanceof ApiError ? err.message : 'Não foi possível enviar a foto. Use JPG ou PNG de até 10 MB.',
      })
    }
  }

  return (
    <div className="flex flex-col gap-4">
      <input ref={fileInput} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={(event) => void handleFile(event.target.files)} />

      <p className="rounded-xl bg-[var(--blue-100)] px-4 py-3 text-[13px] leading-relaxed text-[var(--blue-700)]">
        Complementos são os extras que o cliente escolhe junto com o produto, como <strong>sabores, bordas ou adicionais</strong>. Crie um{' '}
        <strong>grupo</strong> (ex.: "Adicionais") e, dentro dele, cada <strong>complemento</strong> com nome, preço e foto.
      </p>

      {value.length === 0 && (
        <div className="rounded-xl border border-dashed border-[var(--border)] px-4 py-8 text-center">
          <p className="text-[14px] font-semibold text-[var(--ink)]">Este produto ainda não tem complementos</p>
          <p className="mt-1 text-[12.5px] text-[var(--ink-soft)]">Toque em "Adicionar grupo de complementos" para criar o primeiro.</p>
        </div>
      )}

      {value.map((group, groupIndex) => (
        <div key={group.key} className="rounded-2xl border border-[var(--border)] bg-[var(--page)] p-4">
          <div className="mb-3 flex items-center justify-between gap-3">
            <p className="text-[13px] font-bold text-[var(--ink)]">Grupo {groupIndex + 1}</p>
            <button
              type="button"
              onClick={() => onChange(value.filter((item) => item.key !== group.key))}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12.5px] font-bold text-[var(--red-500)] hover:bg-[var(--red-100)]"
            >
              <TrashIcon className="h-3.5 w-3.5" />
              Remover grupo
            </button>
          </div>

          <div className="grid gap-4 lg:grid-cols-12">
            <div className="lg:col-span-6">
              <TextField
                label="Nome do grupo"
                icon={<TagIcon className="h-4 w-4" />}
                placeholder="Ex.: Escolha seus adicionais"
                value={group.name}
                maxLength={100}
                onChange={(event) => updateGroup(group.key, { name: event.target.value })}
              />
            </div>
            <div className="flex flex-col gap-1.5 lg:col-span-3">
              <span className="text-[12px] font-semibold text-[var(--ink-soft)]">O cliente precisa escolher?</span>
              <div className="flex w-fit rounded-lg bg-[var(--surface)] p-0.5">
                <button type="button" onClick={() => updateGroup(group.key, { required: false, minimum: '0' })} className={segmented(!group.required)}>
                  Não
                </button>
                <button
                  type="button"
                  onClick={() => updateGroup(group.key, { required: true, minimum: Number(group.minimum) >= 1 ? group.minimum : '1' })}
                  className={segmented(group.required)}
                >
                  Sim
                </button>
              </div>
            </div>
            <div className="lg:col-span-3">
              <div className="grid grid-cols-2 gap-3">
                <TextField
                  label="Mínimo"
                  icon={<BoxIcon className="h-4 w-4" />}
                  inputMode="numeric"
                  value={group.minimum}
                  onChange={(event) => updateGroup(group.key, { minimum: event.target.value.replace(/\D/g, '').slice(0, 2) })}
                />
                <TextField
                  label="Máximo"
                  icon={<BoxIcon className="h-4 w-4" />}
                  inputMode="numeric"
                  value={group.maximum}
                  onChange={(event) => updateGroup(group.key, { maximum: event.target.value.replace(/\D/g, '').slice(0, 2) })}
                />
              </div>
            </div>
          </div>
          <p className="mt-2 text-[12px] text-[var(--muted)]">Mínimo e máximo: quantos complementos deste grupo o cliente pode marcar.</p>

          {group.templateId ? (
            <p className="mt-4 rounded-xl bg-[var(--amber-100)] px-4 py-3 text-[13px] text-[var(--ink)]">
              Este grupo usa o modelo <strong>{group.templateName ?? 'de complemento'}</strong>
              {group.templateCount ? ` (${group.templateCount} opções)` : ''}. As opções vêm do modelo e são editadas em "Modelos de Complemento".
            </p>
          ) : (
            <div className="mt-4 flex flex-col gap-3">
              <p className="text-[12px] font-semibold text-[var(--ink-soft)]">Complementos deste grupo</p>
              {group.options.map((option) => (
                <div key={option.key} className="rounded-xl bg-[var(--surface)] p-3">
                  <div className="flex flex-wrap items-start gap-3">
                    <button
                      type="button"
                      onClick={() => pickPhoto(group.key, option.key)}
                      disabled={option.uploading}
                      aria-label={option.imageUrl ? 'Trocar a foto' : 'Adicionar foto'}
                      className="relative flex h-[76px] w-[76px] flex-none flex-col items-center justify-center gap-1 overflow-hidden rounded-xl border border-dashed border-[var(--border)] bg-[var(--page)] text-[11px] font-bold text-[var(--muted)] transition hover:border-[var(--blue-500)] hover:text-[var(--blue-700)]"
                    >
                      {option.imageUrl ? (
                        <img src={option.imageUrl} alt="" className="h-full w-full object-cover" />
                      ) : (
                        <>
                          <CameraIcon className="h-5 w-5" />
                          Foto
                        </>
                      )}
                      {option.uploading && (
                        <span className="absolute inset-0 flex items-center justify-center bg-[var(--surface)]/80 text-[11px] font-bold text-[var(--blue-700)]">Enviando…</span>
                      )}
                    </button>

                    <div className="grid min-w-0 flex-1 basis-[260px] gap-3 sm:grid-cols-[1fr_150px]">
                      <TextField
                        label="Nome do complemento"
                        icon={<TagIcon className="h-4 w-4" />}
                        placeholder="Ex.: Queijo extra"
                        value={option.description}
                        maxLength={100}
                        onChange={(event) => updateOption(group.key, option.key, { description: event.target.value })}
                      />
                      <MoneyField
                        label="Preço"
                        icon={<DollarSignIcon className="h-4 w-4" />}
                        value={option.price}
                        onChange={(event) => updateOption(group.key, option.key, { price: event.target.value })}
                      />
                    </div>

                    <div className="flex flex-none flex-col gap-1.5">
                      <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Situação</span>
                      <div className="flex rounded-lg bg-[var(--page)] p-0.5">
                        <button type="button" onClick={() => updateOption(group.key, option.key, { active: true })} className={segmented(option.active, 'good')}>
                          Ativo
                        </button>
                        <button type="button" onClick={() => updateOption(group.key, option.key, { active: false })} className={segmented(!option.active, 'pause')}>
                          Pausado
                        </button>
                      </div>
                    </div>

                    <button
                      type="button"
                      aria-label="Remover este complemento"
                      onClick={() => updateGroup(group.key, { options: group.options.filter((item) => item.key !== option.key) })}
                      className="mt-6 flex h-9 w-9 flex-none items-center justify-center rounded-lg text-[var(--red-500)] hover:bg-[var(--red-100)]"
                    >
                      <CloseIcon className="h-4 w-4" />
                    </button>
                  </div>
                  {option.uploadError && <p className="mt-2 text-[12.5px] font-medium text-[var(--red-500)]">{option.uploadError}</p>}
                  {!option.imageUrl && !option.uploading && !option.uploadError && (
                    <p className="mt-2 text-[12px] text-[var(--muted)]">Sem foto. No iFood, complementos com foto vendem mais.</p>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={() => updateGroup(group.key, { options: [...group.options, newOption()] })}
                className="flex w-fit items-center gap-1.5 rounded-xl px-3 py-2 text-[13px] font-bold text-[var(--blue-700)] ring-1 ring-[var(--blue-300)] hover:bg-[var(--blue-100)]"
              >
                <PlusIcon className="h-4 w-4" />
                Adicionar complemento
              </button>
            </div>
          )}
        </div>
      ))}

      <button
        type="button"
        onClick={() => onChange([...value, newGroup()])}
        className="flex w-fit items-center gap-1.5 rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white hover:bg-[var(--blue-700)]"
      >
        <PlusIcon className="h-4 w-4" />
        Adicionar grupo de complementos
      </button>
    </div>
  )
}
