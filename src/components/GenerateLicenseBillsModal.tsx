import { useEffect, useState } from 'react'
import { generateLicenseBills, type GenerateLicenseBillsResult } from '../lib/licenses'
import { fetchCategories, type CategoryRecord } from '../lib/categories'
import { fetchBankAccounts, type BankAccountRecord } from '../lib/bankAccounts'
import { formatCurrency, formatDate } from '../lib/format'
import { ApiError } from '../lib/api'
import { TextField } from './form/TextField'
import { SelectField } from './form/SelectField'
import { CalendarIcon, ClockIcon, CloseIcon } from './icons'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface GenerateLicenseBillsModalProps {
  open: boolean
  session: AuthSession
  company: AuthCompany
  onClose: () => void
  onGenerated: () => void
}

function monthsAgoStart(months: number): string {
  const date = new Date()
  date.setDate(1)
  date.setMonth(date.getMonth() - months)
  const month = String(date.getMonth() + 1).padStart(2, '0')
  return `${date.getFullYear()}-${month}-01`
}

export function GenerateLicenseBillsModal({ open, session, company, onClose, onGenerated }: GenerateLicenseBillsModalProps) {
  const token = session.token.token
  const [categories, setCategories] = useState<CategoryRecord[]>([])
  const [banks, setBanks] = useState<BankAccountRecord[]>([])
  const [categoryId, setCategoryId] = useState('')
  const [bankId, setBankId] = useState('')
  const [until, setUntil] = useState('2027-12')
  const [dueDay, setDueDay] = useState('10')
  const [minExpiry, setMinExpiry] = useState(monthsAgoStart(1))
  const [result, setResult] = useState<GenerateLicenseBillsResult | null>(null)
  const [working, setWorking] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [done, setDone] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setResult(null)
    setError(null)
    setDone(null)
    fetchCategories(token, company.id, { role: 1, limit: 100 })
      .then((res) => {
        setCategories(res.data)
        setCategoryId((current) => current || res.data.find((item) => item.name.toLowerCase() === 'contratos')?.id || '')
      })
      .catch(() => setCategories([]))
    fetchBankAccounts(token, company.id, { limit: 100 })
      .then((res) => setBanks(res.data))
      .catch(() => setBanks([]))
  }, [open, token, company.id])

  if (!open) return null

  function payload(simulate: boolean) {
    return {
      simulate,
      until,
      due_day: Number(dueDay),
      min_expiry: minExpiry,
      category_id: categoryId,
      bank_account_id: bankId || null,
    }
  }

  async function run(simulate: boolean) {
    setWorking(true)
    setError(null)
    try {
      const res = await generateLicenseBills(token, payload(simulate))
      if (simulate) {
        setResult(res)
      } else {
        setResult(null)
        setDone(`${res.created} cobranças geradas e vinculadas às licenças.`)
        onGenerated()
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível gerar as cobranças.')
    } finally {
      setWorking(false)
    }
  }

  function resetResult() {
    setResult(null)
    setDone(null)
  }

  const planned = result?.rows.filter((row) => !row.skipped && row.to_create > 0) ?? []
  const skipped = result?.rows.filter((row) => row.skipped) ?? []
  const canSimulate = Boolean(categoryId && until && dueDay && minExpiry) && !working

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[92vh] w-full max-w-[760px] flex-col rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[16px] font-bold text-[var(--ink)]">Gerar cobranças das licenças</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--ink-soft)]">
              Cria uma conta a receber por mês para cada cliente com mensalidade, a partir do mês da validade. Primeiro você simula, depois confirma.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
            aria-label="Fechar"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <SelectField
            label="Categoria da receita"
            value={categoryId}
            onChange={(event) => {
              setCategoryId(event.target.value)
              resetResult()
            }}
          >
            <option value="">Selecione…</option>
            {categories.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </SelectField>
          <SelectField
            label="Conta bancária (opcional)"
            value={bankId}
            onChange={(event) => {
              setBankId(event.target.value)
              resetResult()
            }}
          >
            <option value="">Definir ao receber</option>
            {banks.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </SelectField>
          <TextField
            label="Gerar até o mês"
            icon={<CalendarIcon className="h-4 w-4" />}
            type="month"
            value={until}
            onChange={(event) => {
              setUntil(event.target.value)
              resetResult()
            }}
          />
          <TextField
            label="Dia do vencimento (1 a 28)"
            icon={<CalendarIcon className="h-4 w-4" />}
            type="number"
            min="1"
            max="28"
            value={dueDay}
            onChange={(event) => {
              setDueDay(event.target.value)
              resetResult()
            }}
          />
          <TextField
            label="Ignorar licenças vencidas antes de"
            icon={<ClockIcon className="h-4 w-4" />}
            type="date"
            value={minExpiry}
            onChange={(event) => {
              setMinExpiry(event.target.value)
              resetResult()
            }}
          />
        </div>

        {error && <p className="mt-3 text-[13px] font-medium text-[var(--red-500)]">{error}</p>}
        {done && <p className="mt-3 text-[13px] font-semibold text-[var(--green-600)]">{done}</p>}

        {result && (
          <div className="mt-4 flex min-h-0 flex-col gap-3">
            <div className="rounded-xl bg-[var(--page)] px-4 py-3 text-[13px] text-[var(--ink)]">
              <b>{result.totals.bills}</b> cobranças para <b>{result.totals.clients}</b> clientes, somando{' '}
              <b>{formatCurrency(result.totals.amount)}</b>.
              {result.totals.skipped > 0 && (
                <span className="text-[var(--muted)]"> {result.totals.skipped} empresas ficam de fora (veja abaixo).</span>
              )}
            </div>

            <div className="min-h-0 overflow-auto rounded-xl border border-[var(--border)]">
              <table className="w-full border-collapse text-[12.5px]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                    <th className="px-3 py-2">Cliente</th>
                    <th className="py-2">Mensalidade</th>
                    <th className="py-2">1º vencimento</th>
                    <th className="py-2">Último</th>
                    <th className="py-2 pr-3 text-right">Cobranças</th>
                  </tr>
                </thead>
                <tbody>
                  {planned.map((row) => (
                    <tr key={row.company_id} className="border-b border-[var(--border)] last:border-none">
                      <td className="px-3 py-2 font-medium text-[var(--ink)]">{row.name}</td>
                      <td className="py-2 text-[var(--ink-soft)]">{formatCurrency(row.monthly_fee)}</td>
                      <td className="py-2 text-[var(--ink-soft)]">{formatDate(row.first_due)}</td>
                      <td className="py-2 text-[var(--ink-soft)]">{formatDate(row.last_due)}</td>
                      <td className="py-2 pr-3 text-right text-[var(--ink-soft)]">
                        {row.to_create}
                        {row.already_exists > 0 ? ` (+${row.already_exists} já existem)` : ''}
                      </td>
                    </tr>
                  ))}
                  {planned.length === 0 && (
                    <tr>
                      <td colSpan={5} className="px-3 py-6 text-center text-[var(--muted)]">
                        Nada novo para gerar com esses ajustes.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>

            {skipped.length > 0 && (
              <details className="text-[12px] text-[var(--ink-soft)]">
                <summary className="cursor-pointer font-semibold">Empresas que ficam de fora ({skipped.length})</summary>
                <ul className="mt-1.5 flex max-h-32 flex-col gap-0.5 overflow-auto">
                  {skipped.map((row) => (
                    <li key={row.company_id}>
                      {row.name} — {row.skipped}
                    </li>
                  ))}
                </ul>
              </details>
            )}
          </div>
        )}

        <div className="mt-5 flex flex-wrap items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[var(--border)] px-4 py-2.5 text-[13.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
          >
            {done ? 'Fechar' : 'Cancelar'}
          </button>
          <button
            type="button"
            onClick={() => void run(true)}
            disabled={!canSimulate}
            className="rounded-xl border border-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-[var(--blue-700)] hover:bg-[var(--blue-100)] disabled:opacity-60"
          >
            {working && !result ? 'Simulando…' : 'Simular'}
          </button>
          {result && result.totals.bills > 0 && (
            <button
              type="button"
              onClick={() => void run(false)}
              disabled={working}
              className="rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white hover:bg-[var(--blue-700)] disabled:opacity-60"
            >
              {working ? 'Gerando…' : `Gerar ${result.totals.bills} cobranças`}
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
