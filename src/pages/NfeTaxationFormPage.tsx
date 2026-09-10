import { useEffect, useState, type FormEvent } from 'react'
import {
  createNfeTaxation,
  fetchNfeTaxation,
  updateNfeTaxation,
  fetchNfeTaxationRules,
  createNfeTaxationRule,
  updateNfeTaxationRule,
  emptyTaxationRuleProfile,
  type NfeTaxationRecord,
  type NfeTaxationRuleProfile,
} from '../lib/nfeTaxations'
import { ApiError } from '../lib/api'
import { TextField } from '../components/form/TextField'
import { SectionCard } from '../components/SectionCard'
import { NfeTaxationRuleProfileFields } from '../components/NfeTaxationRuleProfileFields'
import { TagIcon, ChevronLeftIcon } from '../components/icons'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface NfeTaxationFormPageProps {
  session: AuthSession
  company: AuthCompany
  taxationId?: string
  onBack: () => void
  onSaved: () => void
}

export function NfeTaxationFormPage({ session, company, taxationId, onBack, onSaved }: NfeTaxationFormPageProps) {
  const [loading, setLoading] = useState(Boolean(taxationId))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [name, setName] = useState('')
  const [ruleId, setRuleId] = useState<string | null>(null)
  const [resale, setResale] = useState<NfeTaxationRuleProfile>(emptyTaxationRuleProfile())
  const [finalConsumer, setFinalConsumer] = useState<NfeTaxationRuleProfile>(emptyTaxationRuleProfile())

  useEffect(() => {
    if (!taxationId) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    Promise.all([
      fetchNfeTaxation(session.token.token, taxationId),
      fetchNfeTaxationRules(session.token.token, taxationId),
    ])
      .then(([taxation, rules]: [NfeTaxationRecord, Awaited<ReturnType<typeof fetchNfeTaxationRules>>]) => {
        if (cancelled) return
        setName(taxation.name ?? '')
        const rule = rules[0]
        if (rule) {
          setRuleId(rule.id)
          setResale({ ...emptyTaxationRuleProfile(), ...(rule.nfeTaxationRulesResale ?? {}) })
          setFinalConsumer({ ...emptyTaxationRuleProfile(), ...(rule.nfeTaxationRulesFinalConsumer ?? {}) })
        }
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err instanceof ApiError ? err.message : 'Não foi possível carregar a tributação.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [taxationId, session.token.token, reloadKey])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Preencha o nome para continuar.')
      return
    }

    setSubmitting(true)
    try {
      let id = taxationId
      if (id) {
        await updateNfeTaxation(session.token.token, id, { company_id: company.id, name: name.trim() })
      } else {
        const taxation = await createNfeTaxation(session.token.token, { company_id: company.id, name: name.trim() })
        id = taxation.id
      }

      const rulePayload = {
        nfe_taxation_id: id,
        nfeTaxationRulesResale: resale,
        nfeTaxationRulesFinalConsumer: finalConsumer,
      }
      if (ruleId) {
        await updateNfeTaxationRule(session.token.token, ruleId, rulePayload)
      } else {
        await createNfeTaxationRule(session.token.token, rulePayload)
      }

      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar a tributação.')
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
          Voltar para tributação
        </button>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Fiscal</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">
          {taxationId ? 'Editar tributação' : 'Nova tributação'}
        </h1>
      </div>

      {loading ? (
        <div className="flex flex-col gap-3">
          {Array.from({ length: 3 }).map((_, index) => (
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
            <h2 className="mb-4 text-[14px] font-bold text-[var(--ink)]">Dados da tributação</h2>
            <TextField
              label="Nome"
              icon={<TagIcon className="h-4 w-4" />}
              placeholder="Ex: Tributação padrão"
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <SectionCard title="Revenda" subtitle="Perfil usado quando o destinatário é revendedor (tem inscrição estadual)">
            <NfeTaxationRuleProfileFields value={resale} onChange={(patch) => setResale((prev) => ({ ...prev, ...patch }))} />
          </SectionCard>

          <SectionCard
            title="Consumidor Final"
            subtitle="Perfil usado quando o destinatário é consumidor final (sem inscrição estadual)"
          >
            <NfeTaxationRuleProfileFields
              value={finalConsumer}
              onChange={(patch) => setFinalConsumer((prev) => ({ ...prev, ...patch }))}
            />
          </SectionCard>

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
