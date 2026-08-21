import { useEffect, useMemo, useRef, useState, type FormEvent, type PointerEvent as ReactPointerEvent } from 'react'
import {
  createContractTemplate,
  fetchContractTemplate,
  updateContractTemplate,
  TARGET_TYPE_LABELS,
  TARGET_TYPE_VARIABLES,
  COMMON_VARIABLES,
  type ContractTemplateRecord,
} from '../lib/contractTemplates'
import { ApiError } from '../lib/api'
import { TextField } from '../components/form/TextField'
import { SelectField } from '../components/form/SelectField'
import { FileTextIcon, ChevronLeftIcon, CheckCircleIcon, PenIcon } from '../components/icons'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface SignaturePositionPreviewProps {
  page: number
  x: number
  y: number
  onChange: (patch: { x?: number; y?: number }) => void
}

function SignaturePositionPreview({ page, x, y, onChange }: SignaturePositionPreviewProps) {
  const boxRef = useRef<HTMLDivElement>(null)
  const [dragging, setDragging] = useState(false)

  function updateFromPoint(clientX: number, clientY: number) {
    const box = boxRef.current
    if (!box) return
    const rect = box.getBoundingClientRect()
    const relX = ((clientX - rect.left) / rect.width) * 100
    const relY = ((clientY - rect.top) / rect.height) * 100
    onChange({
      x: Math.min(100, Math.max(0, Math.round(relX))),
      y: Math.min(100, Math.max(0, Math.round(relY))),
    })
  }

  function handlePointerDown(event: ReactPointerEvent<HTMLDivElement>) {
    setDragging(true)
    event.currentTarget.setPointerCapture(event.pointerId)
    updateFromPoint(event.clientX, event.clientY)
  }

  function handlePointerMove(event: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging) return
    updateFromPoint(event.clientX, event.clientY)
  }

  function handlePointerUp(event: ReactPointerEvent<HTMLDivElement>) {
    setDragging(false)
    event.currentTarget.releasePointerCapture(event.pointerId)
  }

  return (
    <div className="flex flex-col items-center">
      <div
        ref={boxRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        className="relative aspect-[210/297] w-full max-w-[200px] cursor-crosshair touch-none select-none rounded-lg border border-[var(--border)] bg-white shadow-[var(--card-shadow)]"
      >
        <div className="pointer-events-none absolute inset-3 flex flex-col gap-2">
          {Array.from({ length: 9 }).map((_, index) => (
            <div key={index} className="h-1 rounded bg-[#e6e9ec]" />
          ))}
        </div>
        <div
          className="absolute flex -translate-x-1/2 -translate-y-1/2 cursor-grab items-center gap-1 rounded-md border-2 border-[var(--blue-500)] bg-[var(--blue-100)] px-1.5 py-0.5 text-[9px] font-bold whitespace-nowrap text-[var(--blue-700)] active:cursor-grabbing"
          style={{ left: `${x}%`, top: `${y}%` }}
        >
          <PenIcon className="h-2.5 w-2.5" />
          Assinatura
        </div>
      </div>
      <p className="mt-2 text-center text-[11px] text-[var(--muted)]">
        Clique ou arraste na página {page} para posicionar a assinatura
      </p>
    </div>
  )
}

interface ContractTemplateFormPageProps {
  session: AuthSession
  company: AuthCompany
  templateId?: string
  onBack: () => void
  onSaved: () => void
}

export function ContractTemplateFormPage({ session, company, templateId, onBack, onSaved }: ContractTemplateFormPageProps) {
  const [loading, setLoading] = useState(Boolean(templateId))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [internalCode, setInternalCode] = useState('')
  const [title, setTitle] = useState('')
  const [targetType, setTargetType] = useState('protection_vehicle')
  const [description, setDescription] = useState('')
  const [html, setHtml] = useState('')
  const [signaturePage, setSignaturePage] = useState(1)
  const [signatureX, setSignatureX] = useState(15)
  const [signatureY, setSignatureY] = useState(80)
  const [isActive, setIsActive] = useState(true)

  const [copiedVariable, setCopiedVariable] = useState<string | null>(null)

  useEffect(() => {
    if (!templateId) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    fetchContractTemplate(session.token.token, templateId)
      .then((template: ContractTemplateRecord) => {
        if (cancelled) return
        setInternalCode(template.internal_code != null ? String(template.internal_code) : '')
        setTitle(template.title ?? '')
        setTargetType(template.target_type ?? 'protection_vehicle')
        setDescription(template.description ?? '')
        setHtml(template.html ?? '')
        setSignaturePage(template.signature_page ?? 1)
        setSignatureX(template.signature_x ?? 15)
        setSignatureY(template.signature_y ?? 80)
        setIsActive(template.is_active !== false)
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err instanceof ApiError ? err.message : 'Não foi possível carregar o modelo.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [templateId, session.token.token, reloadKey])

  const variables = useMemo(
    () => [...COMMON_VARIABLES, ...(TARGET_TYPE_VARIABLES[targetType] ?? [])],
    [targetType]
  )

  function copyVariable(variable: string) {
    navigator.clipboard.writeText(variable).then(() => {
      setCopiedVariable(variable)
      setTimeout(() => setCopiedVariable(null), 1500)
    })
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!title.trim() || !html.trim()) {
      setError('Preencha o título e o conteúdo HTML para continuar.')
      return
    }

    const payload = {
      company_id: company.id,
      internal_code: internalCode ? Number(internalCode) : undefined,
      title: title.trim(),
      target_type: targetType,
      description: description.trim() || undefined,
      html,
      signature_page: signaturePage,
      signature_x: signatureX,
      signature_y: signatureY,
      is_active: isActive,
    }

    setSubmitting(true)
    try {
      if (templateId) {
        await updateContractTemplate(session.token.token, templateId, payload)
      } else {
        await createContractTemplate(session.token.token, payload)
      }
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar o modelo.')
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
          Voltar para modelos de contrato
        </button>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Conta</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">
          {templateId ? 'Editar modelo de contrato' : 'Novo modelo de contrato'}
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
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="mb-4 text-[14px] font-bold text-[var(--ink)]">Dados</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <TextField
                label="Título"
                icon={<FileTextIcon className="h-4 w-4" />}
                placeholder="Ex: Contrato de Proteção Veicular"
                value={title}
                onChange={(event) => setTitle(event.target.value)}
              />
              <TextField
                label="Código interno"
                icon={<FileTextIcon className="h-4 w-4" />}
                placeholder="Automático"
                inputMode="numeric"
                value={internalCode}
                onChange={(event) => setInternalCode(event.target.value.replace(/\D/g, ''))}
              />
              <SelectField label="Tipo" value={targetType} onChange={(event) => setTargetType(event.target.value)}>
                {Object.entries(TARGET_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </SelectField>
              <TextField
                label="Descrição"
                icon={<FileTextIcon className="h-4 w-4" />}
                placeholder="Opcional"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
              />
              <label className="flex items-center gap-2.5 self-end pb-2.5">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={(event) => setIsActive(event.target.checked)}
                  className="h-4 w-4 accent-[var(--blue-500)]"
                />
                <span className="text-[13.5px] font-semibold text-[var(--ink)]">Modelo ativo</span>
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h2 className="text-[14px] font-bold text-[var(--ink)]">Conteúdo HTML</h2>
                <p className="mt-0.5 text-[12px] text-[var(--muted)]">
                  O PDF é gerado a partir deste HTML no momento do envio para assinatura.
                </p>
              </div>
            </div>

            <div className="mb-3 flex flex-wrap gap-1.5">
              {variables.map((variable) => (
                <button
                  key={variable}
                  type="button"
                  onClick={() => copyVariable(variable)}
                  className="flex items-center gap-1 rounded-full bg-[var(--blue-100)] px-2.5 py-1 text-[11.5px] font-mono font-semibold text-[var(--blue-700)] hover:bg-[var(--blue-300)]"
                >
                  {copiedVariable === variable ? <CheckCircleIcon className="h-3 w-3" /> : null}
                  {variable}
                </button>
              ))}
            </div>

            <textarea
              value={html}
              onChange={(event) => setHtml(event.target.value)}
              placeholder="<html>…"
              rows={20}
              spellCheck={false}
              className="w-full resize-y rounded-xl bg-[var(--page)] px-3.5 py-2.5 font-mono text-[12.5px] leading-relaxed text-[var(--ink)] ring-1 ring-transparent transition placeholder:text-[var(--muted)] focus:outline-none focus:ring-[var(--blue-300)]"
            />
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="mb-1 text-[14px] font-bold text-[var(--ink)]">Posição da assinatura</h2>
            <p className="mb-4 text-[12px] text-[var(--muted)]">
              Página e posição (%) onde o campo de assinatura digital será posicionado no PDF gerado.
            </p>
            <div className="grid gap-6 sm:grid-cols-[1fr_auto]">
              <div className="grid gap-4 sm:grid-cols-3">
                <TextField
                  label="Página"
                  icon={<FileTextIcon className="h-4 w-4" />}
                  type="number"
                  min={1}
                  value={signaturePage}
                  onChange={(event) => setSignaturePage(Number(event.target.value))}
                />
                <TextField
                  label="Posição X (%)"
                  icon={<FileTextIcon className="h-4 w-4" />}
                  type="number"
                  min={0}
                  max={100}
                  value={signatureX}
                  onChange={(event) => setSignatureX(Number(event.target.value))}
                />
                <TextField
                  label="Posição Y (%)"
                  icon={<FileTextIcon className="h-4 w-4" />}
                  type="number"
                  min={0}
                  max={100}
                  value={signatureY}
                  onChange={(event) => setSignatureY(Number(event.target.value))}
                />
              </div>
              <SignaturePositionPreview
                page={signaturePage}
                x={signatureX}
                y={signatureY}
                onChange={(patch) => {
                  if (patch.x !== undefined) setSignatureX(patch.x)
                  if (patch.y !== undefined) setSignatureY(patch.y)
                }}
              />
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
              {submitting ? 'Salvando…' : 'Salvar modelo'}
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
