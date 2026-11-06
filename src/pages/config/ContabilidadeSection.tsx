import { useEffect, useState, type FormEvent } from 'react'
import { ApiError } from '../../lib/api'
import type { AuthCompany, AuthSession } from '../../lib/auth'
import {
  createAccountant,
  deleteAccountant,
  fetchAccountants,
  fetchAccountingLink,
  formatCnpj,
  formatCpf,
  removeAccountingLink,
  saveAccountingLink,
  searchAccountingFirms,
  updateAccountant,
  type AccountantPayload,
  type AccountantRecord,
  type AccountingFirm,
  type AccountingLink,
} from '../../lib/accounting'
import { isContabilidade } from '../../lib/systemTypes'
import { SectionCard } from '../../components/SectionCard'
import { TextField } from '../../components/form/TextField'
import { ConfirmDialog } from '../../components/ConfirmDialog'
import { BadgeIcon, BuildingIcon, MailIcon, PencilIcon, PhoneIcon, PlusIcon, SearchIcon, TrashIcon, UserIcon } from '../../components/icons'

interface ContabilidadeSectionProps {
  session: AuthSession
  company: AuthCompany
}

const buttonPrimary =
  'flex items-center gap-2 rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-50'
const buttonSecondary =
  'rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[var(--ink-soft)] ring-1 ring-[var(--border)] transition hover:bg-[var(--page)] disabled:opacity-50'

function errorMessage(err: unknown, fallback: string) {
  return err instanceof ApiError ? err.message : fallback
}

// Configurações → Contabilidade. Na empresa de contabilidade (nicho 23) cadastra os contadores;
// nas outras empresas, vincula a contabilidade (cadastro único no ecossistema) e o contador responsável.
export function ContabilidadeSection({ session, company }: ContabilidadeSectionProps) {
  return isContabilidade(company.system_type) ? (
    <AccountantsManager session={session} company={company} />
  ) : (
    <AccountingLinkManager session={session} company={company} />
  )
}

const EMPTY_FORM: AccountantPayload = { name: '', cpf: '', crc: '', email: '', phone: '' }

function AccountantsManager({ session, company }: ContabilidadeSectionProps) {
  const token = session.token.token
  const [accountants, setAccountants] = useState<AccountantRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [editing, setEditing] = useState<AccountantRecord | 'new' | null>(null)
  const [form, setForm] = useState<AccountantPayload>(EMPTY_FORM)
  const [saving, setSaving] = useState(false)
  const [deleteTarget, setDeleteTarget] = useState<AccountantRecord | null>(null)
  const [deleting, setDeleting] = useState(false)

  function load() {
    setLoading(true)
    fetchAccountants(token, company.id)
      .then(setAccountants)
      .catch((err) => setError(errorMessage(err, 'Não foi possível carregar os contadores.')))
      .finally(() => setLoading(false))
  }

  useEffect(load, [token, company.id])

  function openForm(target: AccountantRecord | 'new') {
    setError(null)
    setEditing(target)
    setForm(
      target === 'new'
        ? EMPTY_FORM
        : { name: target.name, cpf: formatCpf(target.cpf), crc: target.crc, email: target.email ?? '', phone: target.phone ?? '' }
    )
  }

  async function handleSave(event: FormEvent) {
    event.preventDefault()
    if (!editing) return
    setSaving(true)
    setError(null)
    try {
      if (editing === 'new') await createAccountant(token, company.id, form)
      else await updateAccountant(token, company.id, editing.id, form)
      setEditing(null)
      load()
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível salvar o contador.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!deleteTarget) return
    setDeleting(true)
    try {
      await deleteAccountant(token, company.id, deleteTarget.id)
      setDeleteTarget(null)
      load()
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível excluir o contador.'))
      setDeleteTarget(null)
    } finally {
      setDeleting(false)
    }
  }

  return (
    <SectionCard
      title="Contadores do escritório"
      subtitle="As empresas clientes escolhem um destes contadores como responsável (vai no SPED e nas obrigações)"
    >
      <div className="mt-4 flex flex-col gap-4">
        {error && <div className="rounded-xl bg-[var(--red-100)] p-3 text-[13px] font-medium text-[var(--red-500)]">{error}</div>}

        {loading ? (
          <p className="text-[13px] text-[var(--muted)]">Carregando…</p>
        ) : accountants.length === 0 && !editing ? (
          <p className="text-[13px] text-[var(--muted)]">Nenhum contador cadastrado ainda.</p>
        ) : (
          <ul className="flex flex-col gap-2">
            {accountants.map((accountant) => (
              <li key={accountant.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--page)] px-4 py-3">
                <div>
                  <p className="text-[14px] font-bold text-[var(--ink)]">{accountant.name}</p>
                  <p className="text-[12.5px] text-[var(--ink-soft)]">
                    CPF {formatCpf(accountant.cpf)} · CRC {accountant.crc}
                    {accountant.email ? ` · ${accountant.email}` : ''}
                  </p>
                  <p className="text-[12px] text-[var(--muted)]">
                    Responsável por {accountant.clients ?? 0} {accountant.clients === 1 ? 'empresa' : 'empresas'}
                  </p>
                </div>
                <div className="flex gap-1">
                  <button type="button" onClick={() => openForm(accountant)} aria-label={`Editar ${accountant.name}`} className="rounded-lg p-2 text-[var(--ink-soft)] hover:bg-[var(--surface)]">
                    <PencilIcon className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => setDeleteTarget(accountant)} aria-label={`Excluir ${accountant.name}`} className="rounded-lg p-2 text-[var(--red-500)] hover:bg-[var(--red-100)]">
                    <TrashIcon className="h-4 w-4" />
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}

        {editing ? (
          <form onSubmit={handleSave} className="flex flex-col gap-4 rounded-xl border border-[var(--border)] p-4">
            <p className="text-[13.5px] font-bold text-[var(--ink)]">{editing === 'new' ? 'Novo contador' : 'Editar contador'}</p>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <TextField label="Nome" icon={<UserIcon className="h-4 w-4" />} value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required />
              <TextField label="CPF" icon={<BadgeIcon className="h-4 w-4" />} value={form.cpf} onChange={(event) => setForm({ ...form, cpf: formatCpf(event.target.value) })} required />
              <TextField label="CRC" icon={<BadgeIcon className="h-4 w-4" />} value={form.crc} onChange={(event) => setForm({ ...form, crc: event.target.value })} placeholder="Ex.: MT012345/O-1" required />
              <TextField label="E-mail" type="email" icon={<MailIcon className="h-4 w-4" />} value={form.email ?? ''} onChange={(event) => setForm({ ...form, email: event.target.value })} />
              <TextField label="Telefone" icon={<PhoneIcon className="h-4 w-4" />} value={form.phone ?? ''} onChange={(event) => setForm({ ...form, phone: event.target.value })} />
            </div>
            <div className="flex gap-2">
              <button type="submit" disabled={saving} className={buttonPrimary}>
                {saving ? 'Salvando…' : 'Salvar contador'}
              </button>
              <button type="button" onClick={() => setEditing(null)} className={buttonSecondary}>
                Cancelar
              </button>
            </div>
          </form>
        ) : (
          <button type="button" onClick={() => openForm('new')} className={`${buttonPrimary} self-start`}>
            <PlusIcon className="h-4 w-4" />
            Cadastrar contador
          </button>
        )}
        <p className="text-[12px] text-[var(--muted)]">
          O endereço, o CNPJ e o código do município do escritório vêm de Dados da Empresa: deixe-os completos.
        </p>
      </div>

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Excluir contador"
        message={`Excluir ${deleteTarget?.name}? Empresas que têm ele como responsável precisam trocar antes.`}
        confirmLabel="Excluir"
        loading={deleting}
        onConfirm={handleDelete}
        onCancel={() => setDeleteTarget(null)}
      />
    </SectionCard>
  )
}

function AccountingLinkManager({ session, company }: ContabilidadeSectionProps) {
  const token = session.token.token
  const [link, setLink] = useState<AccountingLink | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searching, setSearching] = useState(false)
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<AccountingFirm[] | null>(null)
  const [selected, setSelected] = useState<AccountingFirm | null>(null)
  const [accountantId, setAccountantId] = useState('')
  const [saving, setSaving] = useState(false)
  const [confirmRemove, setConfirmRemove] = useState(false)

  useEffect(() => {
    fetchAccountingLink(token, company.id)
      .then((res) => setLink(res.link))
      .catch((err) => setError(errorMessage(err, 'Não foi possível carregar a contabilidade.')))
      .finally(() => setLoading(false))
  }, [token, company.id])

  async function handleSearch(event: FormEvent) {
    event.preventDefault()
    setSearching(true)
    setError(null)
    try {
      setResults(await searchAccountingFirms(token, company.id, search))
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível buscar as contabilidades.'))
    } finally {
      setSearching(false)
    }
  }

  function choose(firm: AccountingFirm) {
    setSelected(firm)
    setAccountantId(link?.firm?.id === firm.id ? (link.accountant?.id ?? '') : (firm.accountants[0]?.id ?? ''))
  }

  async function handleSave() {
    if (!selected) return
    setSaving(true)
    setError(null)
    try {
      const res = await saveAccountingLink(token, company.id, selected.id, accountantId || null)
      setLink(res.link)
      setSelected(null)
      setResults(null)
      setSearch('')
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível vincular a contabilidade.'))
    } finally {
      setSaving(false)
    }
  }

  async function handleRemove() {
    setSaving(true)
    try {
      await removeAccountingLink(token, company.id)
      setLink(null)
      setConfirmRemove(false)
    } catch (err) {
      setError(errorMessage(err, 'Não foi possível desvincular.'))
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <p className="text-[13px] text-[var(--muted)]">Carregando…</p>

  return (
    <SectionCard title="Contabilidade da empresa" subtitle="O escritório contábil que atende esta empresa e o contador responsável">
      <div className="mt-4 flex flex-col gap-4">
        {error && <div className="rounded-xl bg-[var(--red-100)] p-3 text-[13px] font-medium text-[var(--red-500)]">{error}</div>}

        {link?.firm ? (
          <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl bg-[var(--page)] px-4 py-3.5">
            <div>
              <p className="text-[11px] font-bold tracking-wide text-[var(--muted)] uppercase">Vinculada</p>
              <p className="text-[15px] font-bold text-[var(--ink)]">{link.firm.name}</p>
              <p className="text-[12.5px] text-[var(--ink-soft)]">
                CNPJ {formatCnpj(link.firm.document)}
                {link.firm.city ? ` · ${link.firm.city}/${link.firm.state ?? ''}` : ''}
              </p>
              <p className="mt-1 text-[13px] text-[var(--ink)]">
                {link.accountant ? (
                  <>
                    Contador responsável: <strong>{link.accountant.name}</strong> (CRC {link.accountant.crc})
                  </>
                ) : (
                  <span className="text-[var(--amber-500)]">Sem contador responsável escolhido</span>
                )}
              </p>
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => link.firm && choose(link.firm)} className={buttonSecondary}>
                Trocar contador
              </button>
              <button type="button" onClick={() => setConfirmRemove(true)} className={buttonSecondary}>
                Desvincular
              </button>
            </div>
          </div>
        ) : (
          <p className="text-[13px] text-[var(--ink-soft)]">Nenhuma contabilidade vinculada. Busque o escritório pelo nome ou CNPJ.</p>
        )}

        {!selected && (
          <form onSubmit={handleSearch} className="flex flex-wrap items-end gap-2">
            <div className="min-w-[260px] flex-1">
              <TextField
                label={link?.firm ? 'Trocar de contabilidade' : 'Buscar contabilidade'}
                icon={<SearchIcon className="h-4 w-4" />}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Nome ou CNPJ do escritório"
              />
            </div>
            <button type="submit" disabled={searching} className={buttonPrimary}>
              {searching ? 'Buscando…' : 'Buscar'}
            </button>
          </form>
        )}

        {!selected && results && (
          results.length === 0 ? (
            <p className="text-[13px] text-[var(--muted)]">
              Nenhuma contabilidade encontrada. O escritório precisa estar cadastrado no sistema com o nicho Contabilidade: fale com o suporte.
            </p>
          ) : (
            <ul className="flex flex-col gap-2">
              {results.map((firm) => (
                <li key={firm.id}>
                  <button type="button" onClick={() => choose(firm)} className="flex w-full items-center gap-3 rounded-xl bg-[var(--page)] px-4 py-3 text-left hover:ring-2 hover:ring-[var(--blue-300)]">
                    <BuildingIcon className="h-5 w-5 flex-none text-[var(--muted)]" />
                    <span>
                      <span className="block text-[14px] font-bold text-[var(--ink)]">{firm.name}</span>
                      <span className="block text-[12.5px] text-[var(--ink-soft)]">
                        CNPJ {formatCnpj(firm.document)}
                        {firm.city ? ` · ${firm.city}/${firm.state ?? ''}` : ''} · {firm.accountants.length}{' '}
                        {firm.accountants.length === 1 ? 'contador' : 'contadores'}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )
        )}

        {selected && (
          <div className="flex flex-col gap-3 rounded-xl border border-[var(--border)] p-4">
            <p className="text-[14px] font-bold text-[var(--ink)]">{selected.name}</p>
            {selected.accountants.length === 0 ? (
              <p className="text-[13px] text-[var(--amber-500)]">
                Este escritório ainda não cadastrou contadores. Dá para vincular agora e escolher o responsável depois.
              </p>
            ) : (
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Contador responsável</span>
                <select
                  value={accountantId}
                  onChange={(event) => setAccountantId(event.target.value)}
                  className="rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] focus:outline-none"
                >
                  {selected.accountants.map((accountant) => (
                    <option key={accountant.id} value={accountant.id}>
                      {accountant.name} · CRC {accountant.crc}
                    </option>
                  ))}
                </select>
              </label>
            )}
            <div className="flex gap-2">
              <button type="button" onClick={handleSave} disabled={saving} className={buttonPrimary}>
                {saving ? 'Salvando…' : 'Vincular'}
              </button>
              <button type="button" onClick={() => setSelected(null)} className={buttonSecondary}>
                Cancelar
              </button>
            </div>
          </div>
        )}
      </div>

      <ConfirmDialog
        open={confirmRemove}
        title="Desvincular contabilidade"
        message="A empresa fica sem contabilidade vinculada. O histórico do vínculo é mantido."
        confirmLabel="Desvincular"
        loading={saving}
        onConfirm={handleRemove}
        onCancel={() => setConfirmRemove(false)}
      />
    </SectionCard>
  )
}
