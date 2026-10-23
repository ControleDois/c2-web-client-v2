import { useEffect, useState } from 'react'
import {
  fetchLicenseCompanies,
  fetchLicenseSettings,
  searchRepresentatives,
  bulkLicenseStatus,
  saveLicenseSettings,
  syncSaasClients,
  representativeName,
  type LicenseCompanyRecord,
  type LicenseSituation,
  type LicenseStatus,
  type LicenseSummaryFilter,
} from '../lib/licenses'
import { formatDocument } from '../lib/formatDocument'
import { formatCurrency, formatDate } from '../lib/format'
import { ApiError } from '../lib/api'
import { getCached, setCached } from '../lib/cache'
import { SearchIcon, PencilIcon, RefreshIcon, AlertTriangleIcon, DollarSignIcon } from '../components/icons'
import { DuplicateCompaniesModal } from '../components/DuplicateCompaniesModal'
import { SearchSelectField } from '../components/form/SearchSelectField'
import { LicensesSummaryCards } from '../components/LicensesSummaryCards'
import { GenerateLicenseBillsModal } from '../components/GenerateLicenseBillsModal'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface LicensesPageProps {
  session: AuthSession
  company: AuthCompany
  onEdit: (item: LicenseCompanyRecord) => void
}

const STATUS_LABELS: Record<LicenseStatus, string> = {
  trial: 'Teste grátis',
  active: 'Ativa',
  blocked: 'Bloqueada',
  inactive: 'Desativada',
}

function statusTone(status: LicenseStatus): string {
  if (status === 'active') return 'bg-[var(--green-100)] text-[var(--green-600)]'
  if (status === 'blocked') return 'bg-[var(--red-100)] text-[var(--red-500)]'
  if (status === 'inactive') return 'bg-[var(--page)] text-[var(--muted)]'
  return 'bg-[var(--blue-100)] text-[var(--blue-700)]'
}

function isExpired(item: LicenseCompanyRecord): boolean {
  return Boolean(item.license_expires_at && new Date(item.license_expires_at) < new Date())
}

export function LicensesPage({ session, company, onEdit }: LicensesPageProps) {
  const [warningDays, setWarningDays] = useState('')
  const [savedWarningDays, setSavedWarningDays] = useState<number | null>(null)
  const [savingWarning, setSavingWarning] = useState(false)
  const [warningMessage, setWarningMessage] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [page, setPage] = useState(1)
  const [representative, setRepresentative] = useState<{ id: string; name: string } | null>(null)
  const [situation, setSituation] = useState<LicenseSituation>('active')
  const [selected, setSelected] = useState<string[]>([])
  const [bulkConfirm, setBulkConfirm] = useState<'active' | 'inactive' | null>(null)
  const [bulkWorking, setBulkWorking] = useState(false)
  const [summaryFilter, setSummaryFilter] = useState<LicenseSummaryFilter | null>(null)
  const [summaryRefreshKey, setSummaryRefreshKey] = useState(0)
  const [billsOpen, setBillsOpen] = useState(false)
  const [items, setItems] = useState<LicenseCompanyRecord[]>([])
  const [meta, setMeta] = useState({ total: 0, lastPage: 1 })
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [syncing, setSyncing] = useState(false)
  const [syncMessage, setSyncMessage] = useState<string | null>(null)
  const [duplicatesOpen, setDuplicatesOpen] = useState(false)

  useEffect(() => {
    let cancelled = false
    const cacheKey = `license-companies:${company.id}:${page}:${search}:${summaryFilter ?? ''}:${representative?.id ?? ''}:${situation}:${summaryRefreshKey}`
    const cached = getCached<{ items: LicenseCompanyRecord[]; meta: typeof meta }>(cacheKey)

    if (cached) {
      setItems(cached.items)
      setMeta(cached.meta)
      setLoading(false)
    } else {
      setLoading(true)
    }
    setError(null)

    const timeout = setTimeout(
      () => {
        fetchLicenseCompanies(session.token.token, { search, page, limit: 20, filter: summaryFilter, representative: representative?.id, situation })
          .then((res) => {
            if (cancelled) return
            const nextItems = res.data || []
            const nextMeta = { total: res.meta?.total ?? res.data?.length ?? 0, lastPage: res.meta?.last_page ?? 1 }
            setItems(nextItems)
            setMeta(nextMeta)
            setCached(cacheKey, { items: nextItems, meta: nextMeta })
          })
          .catch((err) => {
            if (cancelled) return
            setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as empresas.')
          })
          .finally(() => {
            if (!cancelled) setLoading(false)
          })
      },
      cached ? 0 : 350
    )

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, page, summaryFilter, representative, situation, summaryRefreshKey, company.id, session.token.token])

  useEffect(() => {
    fetchLicenseSettings(session.token.token)
      .then((res) => {
        setWarningDays(String(res.warning_days))
        setSavedWarningDays(res.warning_days)
      })
      .catch(() => undefined)
  }, [session.token.token])

  async function handleSaveWarning() {
    const days = Number(warningDays)
    if (!Number.isInteger(days) || days < 0 || days > 90) {
      setWarningMessage('Informe um número de 0 a 90.')
      return
    }
    setSavingWarning(true)
    setWarningMessage(null)
    try {
      const res = await saveLicenseSettings(session.token.token, days)
      setSavedWarningDays(res.warning_days)
      setWarningMessage('Salvo.')
    } catch (err) {
      setWarningMessage(err instanceof ApiError ? err.message : 'Não foi possível salvar.')
    } finally {
      setSavingWarning(false)
      setTimeout(() => setWarningMessage(null), 4000)
    }
  }

  useEffect(() => {
    setSelected([])
    setBulkConfirm(null)
  }, [search, page, summaryFilter, representative, situation])

  const allSelected = items.length > 0 && items.every((item) => selected.includes(item.id))

  function toggleSelected(id: string) {
    setSelected((current) => (current.includes(id) ? current.filter((value) => value !== id) : [...current, id]))
  }

  async function handleBulk(status: 'active' | 'inactive') {
    setBulkWorking(true)
    try {
      const res = await bulkLicenseStatus(session.token.token, selected, status)
      setSyncMessage(
        status === 'inactive'
          ? `${res.updated} empresa${res.updated === 1 ? '' : 's'} desativada${res.updated === 1 ? '' : 's'}.`
          : `${res.updated} empresa${res.updated === 1 ? '' : 's'} reativada${res.updated === 1 ? '' : 's'}.`
      )
      setSelected([])
      setBulkConfirm(null)
      setSummaryRefreshKey((key) => key + 1)
    } catch (err) {
      setSyncMessage(err instanceof ApiError ? err.message : 'Não foi possível atualizar as empresas.')
    } finally {
      setBulkWorking(false)
      setTimeout(() => setSyncMessage(null), 4000)
    }
  }

  async function handleSync() {
    setSyncing(true)
    setSyncMessage(null)
    try {
      await syncSaasClients(session.token.token)
      setSyncMessage('Clientes SaaS sincronizados.')
    } catch (err) {
      setSyncMessage(err instanceof ApiError ? err.message : 'Não foi possível sincronizar os clientes.')
    } finally {
      setSyncing(false)
      setTimeout(() => setSyncMessage(null), 4000)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Matriz</p>
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Licenças</h1>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setDuplicatesOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5 text-[13px] font-semibold text-[var(--ink-soft)] transition hover:text-[var(--ink)]"
          >
            <AlertTriangleIcon className="h-4 w-4" />
            Checar CNPJs duplicados
          </button>
          <button
            type="button"
            onClick={() => setBillsOpen(true)}
            className="flex items-center gap-2 rounded-xl border border-[var(--blue-500)] bg-[var(--surface)] px-3.5 py-2.5 text-[13px] font-bold text-[var(--blue-700)] transition hover:bg-[var(--blue-100)]"
          >
            <DollarSignIcon className="h-4 w-4" />
            Gerar cobranças
          </button>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="flex items-center gap-2 rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
          >
            <RefreshIcon className={`h-4 w-4 ${syncing ? 'animate-spin' : ''}`} />
            {syncing ? 'Sincronizando…' : 'Sincronizar clientes SaaS'}
          </button>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="min-w-[220px] flex-1">
          <p className="text-[13.5px] font-bold text-[var(--ink)]">Aviso de vencimento para o cliente</p>
          <p className="text-[12px] text-[var(--muted)]">
            Quantos dias antes do vencimento da cobrança vinculada o cliente começa a ver o aviso com o boleto e o PIX. No dia e depois do
            vencimento o aviso continua até a conta ser recebida.
          </p>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Dias de antecedência</span>
          <input
            value={warningDays}
            onChange={(event) => setWarningDays(event.target.value.replace(/\D/g, '').slice(0, 2))}
            inputMode="numeric"
            className="w-28 rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--blue-300)]"
          />
        </label>
        <button
          type="button"
          onClick={handleSaveWarning}
          disabled={savingWarning || warningDays === '' || Number(warningDays) === savedWarningDays}
          className="rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
        >
          {savingWarning ? 'Salvando…' : 'Salvar'}
        </button>
        {warningMessage && <span className="text-[12.5px] font-medium text-[var(--ink-soft)]">{warningMessage}</span>}
      </div>

      <LicensesSummaryCards
        session={session}
        search={search}
        representative={representative?.id}
        situation={situation}
        activeFilter={summaryFilter}
        onFilterChange={(filter) => {
          setPage(1)
          setSummaryFilter(filter)
        }}
        refreshKey={summaryRefreshKey}
      />

      <div className="grid gap-3 sm:grid-cols-[1fr_minmax(240px,320px)]">
        <div className="flex min-w-[240px] items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-3.5 py-2.5">
          <SearchIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
          <input
            type="text"
            placeholder="Buscar por nome ou CNPJ"
            value={search}
            onChange={(event) => {
              setPage(1)
              setSearch(event.target.value)
            }}
            className="w-full bg-transparent text-[13.5px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
          />
        </div>
        <SearchSelectField
          label="Representante"
          variant="surface"
          placeholder="Todos os representantes"
          selectedLabel={representative?.name ?? null}
          onSearch={async (query) => {
            const reps = await searchRepresentatives(session.token.token, query)
            const withoutOption = { id: 'none', userId: 'none', name: 'Sem representante' }
            return !query || 'sem representante'.includes(query.toLowerCase()) ? [withoutOption, ...reps] : reps
          }}
          getOptionLabel={(item) => item.name}
          onSelect={(item) => {
            setPage(1)
            setRepresentative({ id: item.userId, name: item.name })
          }}
          onClear={() => {
            setPage(1)
            setRepresentative(null)
          }}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Situação</span>
        {([
          ['active', 'Ativas'],
          ['inactive', 'Desativadas'],
          ['all', 'Todas'],
        ] as [LicenseSituation, string][]).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => {
              setPage(1)
              setSituation(value)
            }}
            className={`rounded-full px-3.5 py-1.5 text-[12.5px] font-semibold transition ${
              situation === value
                ? 'bg-[var(--blue-500)] text-white'
                : 'border border-[var(--border)] bg-[var(--surface)] text-[var(--ink-soft)] hover:text-[var(--ink)]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--blue-300)] bg-[var(--blue-100)] px-4 py-3">
          {bulkConfirm ? (
            <>
              <p className="text-[13px] font-semibold text-[var(--ink)]">
                {bulkConfirm === 'inactive'
                  ? `Desativar ${selected.length} empresa${selected.length === 1 ? '' : 's'}? Elas saem da lista de ativas e ficam sem acesso ao sistema e ao Delphi.`
                  : `Reativar ${selected.length} empresa${selected.length === 1 ? '' : 's'}? O acesso volta a valer pela data de validade.`}
              </p>
              <button
                type="button"
                onClick={() => void handleBulk(bulkConfirm)}
                disabled={bulkWorking}
                className="rounded-xl bg-[var(--blue-500)] px-4 py-2 text-[13px] font-bold text-white hover:bg-[var(--blue-700)] disabled:opacity-60"
              >
                {bulkWorking ? 'Salvando…' : 'Confirmar'}
              </button>
              <button
                type="button"
                onClick={() => setBulkConfirm(null)}
                disabled={bulkWorking}
                className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2 text-[13px] font-semibold text-[var(--ink-soft)]"
              >
                Cancelar
              </button>
            </>
          ) : (
            <>
              <p className="text-[13px] font-semibold text-[var(--ink)]">
                {selected.length} selecionada{selected.length === 1 ? '' : 's'}
              </p>
              {situation !== 'inactive' && (
                <button
                  type="button"
                  onClick={() => setBulkConfirm('inactive')}
                  className="rounded-xl bg-[var(--red-100)] px-4 py-2 text-[13px] font-bold text-[var(--red-500)] hover:bg-[var(--red-500)] hover:text-white"
                >
                  Desativar selecionadas
                </button>
              )}
              {situation !== 'active' && (
                <button
                  type="button"
                  onClick={() => setBulkConfirm('active')}
                  className="rounded-xl bg-[var(--green-100)] px-4 py-2 text-[13px] font-bold text-[var(--green-600)] hover:bg-[var(--green-600)] hover:text-white"
                >
                  Reativar selecionadas
                </button>
              )}
              <button type="button" onClick={() => setSelected([])} className="text-[12.5px] font-semibold text-[var(--ink-soft)] underline">
                Limpar seleção
              </button>
            </>
          )}
        </div>
      )}

      {error && (
        <div className="rounded-2xl bg-[var(--red-100)] p-4 text-[13.5px] font-medium text-[var(--red-500)]">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        {loading ? (
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-11 animate-pulse rounded-xl bg-[var(--page)]" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-[13.5px] text-[var(--muted)]">
            Nenhuma empresa encontrada{search ? ` para "${search}"` : ''}.
          </p>
        ) : (
          <>
            <div className="flex flex-col gap-2.5 sm:hidden">
              {items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => onEdit(item)}
                  className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-left"
                >
                  <div className="flex items-start justify-between gap-2">
                    <p className="min-w-0 truncate text-[13.5px] font-bold text-[var(--ink)]">
                      {item.people?.name || 'Empresa sem nome'}
                    </p>
                    <span className={`flex-none rounded-full px-2 py-0.5 text-[10px] font-bold uppercase ${statusTone(item.license_status)}`}>
                      {STATUS_LABELS[item.license_status] ?? item.license_status}
                    </span>
                  </div>
                  <p className="mt-0.5 text-[12px] text-[var(--ink-soft)]">
                    {item.people?.document ? formatDocument(item.people.document) : '—'}
                  </p>
                  <div className="mt-1.5 flex items-center gap-2 text-[12px] text-[var(--muted)]">
                    <span>Vence {formatDate(item.license_expires_at)}</span>
                    {isExpired(item) && (
                      <span className="rounded-full bg-[var(--red-100)] px-2 py-0.5 text-[10px] font-bold text-[var(--red-500)]">
                        Vencida
                      </span>
                    )}
                  </div>
                </button>
              ))}
            </div>
            <div className="hidden overflow-x-auto sm:block">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                    <th className="w-8 pb-2.5 pl-3">
                      <input
                        type="checkbox"
                        checked={allSelected}
                        onChange={() => setSelected(allSelected ? [] : items.map((item) => item.id))}
                        aria-label="Selecionar todas"
                        className="h-4 w-4 accent-[var(--blue-500)]"
                      />
                    </th>
                    <th className="pb-2.5 pr-4 whitespace-nowrap">Empresa</th>
                    <th className="pb-2.5 pr-4 whitespace-nowrap">CNPJ</th>
                    <th className="pb-2.5 pr-4 whitespace-nowrap">Status</th>
                    <th className="pb-2.5 pr-4 whitespace-nowrap">Vencimento</th>
                    <th className="pb-2.5 pr-4 whitespace-nowrap">Representante</th>
                    <th className="pb-2.5 pr-4 whitespace-nowrap">Mensalidade</th>
                    <th className="pb-2.5 pr-4 whitespace-nowrap">Chave Delphi</th>
                    <th className="pb-2.5 pr-4 whitespace-nowrap">Cobrança</th>
                    <th className="pb-2.5 pr-3 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((item, index) => (
                    <tr
                      key={item.id}
                      onClick={() => onEdit(item)}
                      className={`cursor-pointer border-b border-[var(--border)] transition-colors last:border-none hover:bg-[var(--blue-100)] ${
                        index % 2 === 1 ? 'bg-[var(--page)]' : ''
                      }`}
                    >
                      <td className="py-2.5 pl-3" onClick={(event) => event.stopPropagation()}>
                        <input
                          type="checkbox"
                          checked={selected.includes(item.id)}
                          onChange={() => toggleSelected(item.id)}
                          aria-label={`Selecionar ${item.people?.name || 'empresa'}`}
                          className="h-4 w-4 accent-[var(--blue-500)]"
                        />
                      </td>
                      <td className="py-2.5 pr-4 font-medium text-[var(--ink)]">{item.people?.name || 'Empresa sem nome'}</td>
                      <td className="py-2.5 pr-4 font-mono text-[var(--ink-soft)]">
                        {item.people?.document ? formatDocument(item.people.document) : '—'}
                      </td>
                      <td className="py-2.5 pr-4">
                        <span className={`rounded-full px-2 py-0.5 text-[10.5px] font-bold uppercase ${statusTone(item.license_status)}`}>
                          {STATUS_LABELS[item.license_status] ?? item.license_status}
                        </span>
                      </td>
                      <td className="py-2.5 pr-4 text-[var(--ink-soft)]">
                        <div className="flex items-center gap-1.5">
                          {formatDate(item.license_expires_at)}
                          {isExpired(item) && (
                            <span className="rounded-full bg-[var(--red-100)] px-1.5 py-0.5 text-[10px] font-bold text-[var(--red-500)]">
                              Vencida
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="py-2.5 pr-4 text-[var(--ink-soft)]">{representativeName(item.representative) || '—'}</td>
                      <td className="py-2.5 pr-4 text-[var(--ink-soft)]">
                        {item.monthly_fee != null ? formatCurrency(item.monthly_fee) : '—'}
                      </td>
                      <td className="py-2.5 pr-4">
                        {item.has_delphi_key ? (
                          <span className="rounded-full bg-[var(--green-100)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--green-600)]">Gerada</span>
                        ) : (
                          <span className="text-[var(--muted)]">—</span>
                        )}
                      </td>
                      <td className="py-2.5 pr-4 text-[var(--ink-soft)]">
                        {item.license_bill ? `${formatCurrency(item.license_bill.amount)} · ${formatDate(item.license_bill.date_due)}` : '—'}
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        <button
                          type="button"
                          onClick={(event) => {
                            event.stopPropagation()
                            onEdit(item)
                          }}
                          className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]"
                          aria-label="Gerenciar"
                        >
                          <PencilIcon className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        {!loading && meta.lastPage > 1 && (
          <div className="mt-4 flex items-center justify-between">
            <p className="text-[12px] text-[var(--muted)]">{meta.total} empresas no total</p>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--ink-soft)] disabled:opacity-40"
              >
                Anterior
              </button>
              <span className="text-[12.5px] text-[var(--ink-soft)]">
                {page} / {meta.lastPage}
              </span>
              <button
                type="button"
                disabled={page >= meta.lastPage}
                onClick={() => setPage((p) => Math.min(meta.lastPage, p + 1))}
                className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--ink-soft)] disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          </div>
        )}
      </div>

      {syncMessage && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-[var(--ink)] px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg">
          {syncMessage}
        </div>
      )}

      <GenerateLicenseBillsModal
        open={billsOpen}
        session={session}
        company={company}
        onClose={() => setBillsOpen(false)}
        onGenerated={() => setSummaryRefreshKey((key) => key + 1)}
      />
      <DuplicateCompaniesModal open={duplicatesOpen} session={session} onClose={() => setDuplicatesOpen(false)} />
    </div>
  )
}
