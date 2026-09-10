import { useEffect, useState, type FormEvent } from 'react'
import {
  createNfeTaxation,
  fetchNfeTaxation,
  updateNfeTaxation,
  fetchNfeTaxationRules,
  createNfeTaxationRule,
  updateNfeTaxationRule,
  deleteNfeTaxationRule,
  emptyTaxationRuleProfile,
  NFE_ALL_STATES,
  type NfeTaxationRuleRecord,
  type NfeTaxationRuleProfile,
} from '../lib/nfeTaxations'
import { ApiError } from '../lib/api'
import { TextField } from '../components/form/TextField'
import { SectionCard } from '../components/SectionCard'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { NfeTaxationRuleProfileFields } from '../components/NfeTaxationRuleProfileFields'
import { TagIcon, ChevronLeftIcon, PlusIcon, TrashIcon, CopyIcon, CheckCircleIcon } from '../components/icons'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface NfeTaxationFormPageProps {
  session: AuthSession
  company: AuthCompany
  taxationId?: string
  onBack: () => void
  onSaved: () => void
}

function ruleStatesLabel(rule: NfeTaxationRuleRecord): string {
  return rule.states && rule.states.length ? rule.states.join(', ') : 'Padrão geral'
}

export function NfeTaxationFormPage({ session, company, taxationId, onBack }: NfeTaxationFormPageProps) {
  const [loading, setLoading] = useState(Boolean(taxationId))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [saved, setSaved] = useState(false)
  const [reloadKey, setReloadKey] = useState(0)

  const [activeTaxationId, setActiveTaxationId] = useState<string | undefined>(taxationId)
  const [name, setName] = useState('')

  const [rules, setRules] = useState<NfeTaxationRuleRecord[]>([])
  const [selectedRuleId, setSelectedRuleId] = useState<string | null>(null)
  const [selectedStates, setSelectedStates] = useState<string[]>([])
  const [selectedProfile, setSelectedProfile] = useState<'resale' | 'finalConsumer'>('resale')
  const [resale, setResale] = useState<NfeTaxationRuleProfile>(emptyTaxationRuleProfile())
  const [finalConsumer, setFinalConsumer] = useState<NfeTaxationRuleProfile>(emptyTaxationRuleProfile())
  const [copyDone, setCopyDone] = useState(false)

  const [deleteRuleTarget, setDeleteRuleTarget] = useState<NfeTaxationRuleRecord | null>(null)
  const [deletingRule, setDeletingRule] = useState(false)
  const [deleteRuleError, setDeleteRuleError] = useState<string | null>(null)

  function applyRule(rule: NfeTaxationRuleRecord | null) {
    if (!rule) {
      setSelectedRuleId(null)
      setSelectedStates([])
      setResale(emptyTaxationRuleProfile())
      setFinalConsumer(emptyTaxationRuleProfile())
      setSelectedProfile('resale')
      return
    }
    setSelectedRuleId(rule.id)
    setSelectedStates(rule.states ?? [])
    setResale({ ...emptyTaxationRuleProfile(), ...(rule.nfeTaxationRulesResale ?? {}) })
    setFinalConsumer({ ...emptyTaxationRuleProfile(), ...(rule.nfeTaxationRulesFinalConsumer ?? {}) })
  }

  useEffect(() => {
    if (!taxationId) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    Promise.all([fetchNfeTaxation(session.token.token, taxationId), fetchNfeTaxationRules(session.token.token, taxationId)])
      .then(([taxation, ruleList]) => {
        if (cancelled) return
        setActiveTaxationId(taxation.id)
        setName(taxation.name ?? '')
        setRules(ruleList)
        applyRule(ruleList[0] ?? null)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [taxationId, session.token.token, reloadKey])

  function toggleState(uf: string) {
    setSelectedStates((prev) => (prev.includes(uf) ? prev.filter((item) => item !== uf) : [...prev, uf]))
  }

  function handleCopyResaleToFinalConsumer() {
    setFinalConsumer({ ...resale })
    setSelectedProfile('finalConsumer')
    setCopyDone(true)
    setTimeout(() => setCopyDone(false), 2500)
  }

  async function handleDeleteRule() {
    if (!deleteRuleTarget) return
    setDeletingRule(true)
    setDeleteRuleError(null)
    try {
      await deleteNfeTaxationRule(session.token.token, deleteRuleTarget.id)
      const remaining = rules.filter((rule) => rule.id !== deleteRuleTarget.id)
      setRules(remaining)
      if (selectedRuleId === deleteRuleTarget.id) {
        applyRule(remaining[0] ?? null)
      }
      setDeleteRuleTarget(null)
    } catch (err) {
      setDeleteRuleError(err instanceof ApiError ? err.message : 'Não foi possível excluir a regra.')
    } finally {
      setDeletingRule(false)
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setSaved(false)

    if (!name.trim()) {
      setError('Preencha o nome para continuar.')
      return
    }

    setSubmitting(true)
    try {
      let id = activeTaxationId
      if (id) {
        await updateNfeTaxation(session.token.token, id, { company_id: company.id, name: name.trim() })
      } else {
        const taxation = await createNfeTaxation(session.token.token, { company_id: company.id, name: name.trim() })
        id = taxation.id
        setActiveTaxationId(id)
      }

      const rulePayload = {
        nfe_taxation_id: id,
        states: selectedStates,
        nfeTaxationRulesResale: resale,
        nfeTaxationRulesFinalConsumer: finalConsumer,
      }
      const savedRule = selectedRuleId
        ? await updateNfeTaxationRule(session.token.token, selectedRuleId, rulePayload)
        : await createNfeTaxationRule(session.token.token, rulePayload)

      const freshRules = await fetchNfeTaxationRules(session.token.token, id)
      setRules(freshRules)
      applyRule(freshRules.find((rule) => rule.id === savedRule.id) ?? freshRules[0] ?? null)

      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
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

          <SectionCard
            title="Regras vinculadas"
            subtitle="Cada regra pode atender UFs diferentes dentro da mesma tributação"
            headerExtra={
              <button
                type="button"
                onClick={() => applyRule(null)}
                className="flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--border)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--ink-soft)] hover:border-[var(--blue-500)] hover:text-[var(--blue-700)]"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Nova regra
              </button>
            }
          >
            {rules.length === 0 ? (
              <p className="rounded-xl border border-dashed border-[var(--border)] bg-[var(--page)] px-4 py-6 text-center text-[12.5px] text-[var(--muted)]">
                Nenhuma regra cadastrada ainda. Preencha os dados abaixo e salve a primeira regra.
              </p>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
                {rules.map((rule, index) => (
                  <div
                    key={rule.id}
                    className={`group relative rounded-xl p-3 text-left ring-1 ring-inset transition ${
                      selectedRuleId === rule.id
                        ? 'bg-[var(--blue-100)] ring-[var(--blue-500)]'
                        : 'bg-[var(--page)] ring-transparent hover:ring-[var(--border)]'
                    }`}
                  >
                    <button type="button" onClick={() => applyRule(rule)} className="block w-full text-left">
                      <div className="flex items-center justify-between gap-2 pr-6">
                        <span className="text-[13px] font-bold text-[var(--ink)]">Regra {index + 1}</span>
                        <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10.5px] font-semibold text-[var(--ink-soft)]">
                          {ruleStatesLabel(rule)}
                        </span>
                      </div>
                      <p className="mt-1.5 font-mono text-[11px] text-[var(--muted)]">
                        Revenda: {rule.nfeTaxationRulesResale?.icms_situacao_tributaria || '—'} · Final:{' '}
                        {rule.nfeTaxationRulesFinalConsumer?.icms_situacao_tributaria || '—'}
                      </p>
                    </button>
                    <button
                      type="button"
                      onClick={() => setDeleteRuleTarget(rule)}
                      className="absolute right-2 top-2 rounded-lg p-1 text-[var(--muted)] opacity-0 transition hover:bg-[var(--red-100)] hover:text-[var(--red-500)] group-hover:opacity-100"
                      aria-label="Excluir regra"
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
            {!selectedRuleId && (
              <div className="mt-3 rounded-xl bg-[var(--amber-100)] px-3.5 py-2.5 text-[12.5px] font-semibold text-[var(--amber-500)]">
                Editando uma nova regra.
              </div>
            )}
          </SectionCard>

          <SectionCard
            title="Estados atendidos"
            subtitle="Deixe vazio para usar a regra como padrão geral"
            headerExtra={
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedStates([...NFE_ALL_STATES])}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[11.5px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]"
                >
                  Todos
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedStates([])}
                  className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[11.5px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]"
                >
                  Limpar
                </button>
              </div>
            }
          >
            <div className="flex flex-wrap gap-1.5">
              {NFE_ALL_STATES.map((uf) => (
                <button
                  key={uf}
                  type="button"
                  onClick={() => toggleState(uf)}
                  className={`h-8 w-11 rounded-lg text-[12px] font-bold transition ${
                    selectedStates.includes(uf)
                      ? 'bg-[var(--blue-500)] text-white'
                      : 'bg-[var(--page)] text-[var(--ink-soft)] hover:text-[var(--ink)]'
                  }`}
                >
                  {uf}
                </button>
              ))}
            </div>
          </SectionCard>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="inline-flex rounded-xl bg-[var(--page)] p-1">
              <button
                type="button"
                onClick={() => setSelectedProfile('resale')}
                className={`rounded-lg px-4 py-2 text-[13px] font-bold transition ${
                  selectedProfile === 'resale' ? 'bg-[var(--blue-500)] text-white' : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
                }`}
              >
                Cliente Revenda
              </button>
              <button
                type="button"
                onClick={() => setSelectedProfile('finalConsumer')}
                className={`rounded-lg px-4 py-2 text-[13px] font-bold transition ${
                  selectedProfile === 'finalConsumer' ? 'bg-[var(--blue-500)] text-white' : 'text-[var(--ink-soft)] hover:text-[var(--ink)]'
                }`}
              >
                Consumidor Final
              </button>
            </div>

            <div className="flex items-center gap-2.5">
              {copyDone && <span className="text-[12px] font-semibold text-[var(--green-600)]">Copiado!</span>}
              <button
                type="button"
                onClick={handleCopyResaleToFinalConsumer}
                className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--ink-soft)] hover:border-[var(--blue-500)] hover:text-[var(--blue-700)]"
              >
                <CopyIcon className="h-3.5 w-3.5" />
                Copiar revenda para consumidor final
              </button>
            </div>
          </div>

          {selectedProfile === 'resale' ? (
            <SectionCard title="Regra para Cliente Revenda" subtitle="Usada quando o destinatário é revendedor (tem inscrição estadual)">
              <NfeTaxationRuleProfileFields value={resale} onChange={(patch) => setResale((prev) => ({ ...prev, ...patch }))} />
            </SectionCard>
          ) : (
            <SectionCard
              title="Regra para Consumidor Final"
              subtitle="Usada quando o destinatário é consumidor final (sem inscrição estadual)"
            >
              <NfeTaxationRuleProfileFields
                value={finalConsumer}
                onChange={(patch) => setFinalConsumer((prev) => ({ ...prev, ...patch }))}
              />
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
              className="flex items-center gap-2 rounded-xl bg-[var(--blue-500)] px-6 py-2.5 text-[14px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
            >
              {saved ? (
                <>
                  <CheckCircleIcon className="h-4 w-4" /> Salvo
                </>
              ) : submitting ? (
                'Salvando…'
              ) : (
                'Salvar regra'
              )}
            </button>
            <button
              type="button"
              onClick={onBack}
              className="rounded-xl px-5 py-2.5 text-[14px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
            >
              Voltar para tributação
            </button>
          </div>
        </form>
      )}

      <ConfirmDialog
        open={Boolean(deleteRuleTarget)}
        title="Excluir regra"
        message="Tem certeza que deseja excluir esta regra? Essa ação não pode ser desfeita."
        confirmLabel="Excluir"
        loading={deletingRule}
        onConfirm={handleDeleteRule}
        onCancel={() => {
          setDeleteRuleTarget(null)
          setDeleteRuleError(null)
        }}
      />

      {deleteRuleError && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-[var(--red-500)] px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg">
          {deleteRuleError}
        </div>
      )}
    </div>
  )
}
