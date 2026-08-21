import { useEffect, useState, type FormEvent } from 'react'
import {
  createBankAccount,
  fetchBankAccount,
  updateBankAccount,
  type BankAccountRecord,
  type BankCreditCard,
} from '../lib/bankAccounts'
import { ApiError } from '../lib/api'
import { TextField } from '../components/form/TextField'
import { WalletIcon, CreditCardIcon, ChevronLeftIcon, PlusIcon, TrashIcon } from '../components/icons'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface BankAccountFormPageProps {
  session: AuthSession
  company: AuthCompany
  accountId?: string
  onBack: () => void
  onSaved: () => void
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

const EMPTY_CARD: BankCreditCard = {
  name: '',
  brand: '',
  last_digits: '',
  limit_value: undefined,
  closing_day: 1,
  due_day: 10,
  status: 0,
}

export function BankAccountFormPage({ session, company, accountId, onBack, onSaved }: BankAccountFormPageProps) {
  const [loading, setLoading] = useState(Boolean(accountId))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [name, setName] = useState('')
  const [balance, setBalance] = useState('')
  const [dateBalance, setDateBalance] = useState(todayISO())
  const [creditCards, setCreditCards] = useState<BankCreditCard[]>([])

  useEffect(() => {
    if (!accountId) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    fetchBankAccount(session.token.token, accountId)
      .then((account: BankAccountRecord) => {
        if (cancelled) return
        setName(account.name ?? '')
        setBalance(account.balance !== undefined && account.balance !== null ? String(account.balance) : '')
        setDateBalance(account.date_balance ? account.date_balance.slice(0, 10) : todayISO())
        setCreditCards(account.credit_cards ?? [])
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err instanceof ApiError ? err.message : 'Não foi possível carregar a conta.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [accountId, session.token.token, reloadKey])

  function addCreditCard() {
    setCreditCards((cards) => [...cards, { ...EMPTY_CARD }])
  }

  function updateCreditCard(index: number, patch: Partial<BankCreditCard>) {
    setCreditCards((cards) => cards.map((card, i) => (i === index ? { ...card, ...patch } : card)))
  }

  function removeCreditCard(index: number) {
    setCreditCards((cards) => cards.filter((_, i) => i !== index))
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!name.trim()) {
      setError('Preencha o nome para continuar.')
      return
    }

    const invalidCard = creditCards.find((card) => !card.name.trim())
    if (invalidCard) {
      setError('Preencha o nome de todos os cartões de crédito adicionados.')
      return
    }

    const payload = {
      company_id: company.id,
      name: name.trim(),
      balance: balance ? Number(balance) : 0,
      date_balance: dateBalance || undefined,
      credit_cards: creditCards.map((card) => ({
        id: card.id,
        name: card.name.trim(),
        brand: card.brand || undefined,
        last_digits: card.last_digits || undefined,
        limit_value: card.limit_value || undefined,
        closing_day: card.closing_day,
        due_day: card.due_day,
        status: card.status ?? 0,
      })),
    }

    setSubmitting(true)
    try {
      if (accountId) {
        await updateBankAccount(session.token.token, accountId, payload)
      } else {
        await createBankAccount(session.token.token, payload)
      }
      onSaved()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível salvar a conta.')
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
          Voltar para contas
        </button>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Financeiro</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">
          {accountId ? 'Editar conta' : 'Nova conta'}
        </h1>
      </div>

      {loading ? (
        <div className="h-11 animate-pulse rounded-xl bg-[var(--surface)]" />
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
            <h2 className="mb-4 text-[14px] font-bold text-[var(--ink)]">Dados da conta</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <TextField
                label="Nome"
                icon={<WalletIcon className="h-4 w-4" />}
                placeholder="Ex: Caixa, Banco do Brasil"
                value={name}
                onChange={(event) => setName(event.target.value)}
              />
              <TextField
                label="Saldo inicial"
                icon={<WalletIcon className="h-4 w-4" />}
                placeholder="0,00"
                inputMode="decimal"
                value={balance}
                onChange={(event) => setBalance(event.target.value.replace(/[^\d.,-]/g, ''))}
              />
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Data do saldo</span>
                <input
                  type="date"
                  value={dateBalance}
                  onChange={(event) => setDateBalance(event.target.value)}
                  className="min-w-0 w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                />
              </label>
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-[14px] font-bold text-[var(--ink)]">Cartões de crédito</h2>
                <p className="mt-0.5 text-[12px] text-[var(--muted)]">
                  Cadastre os cartões ligados a esta conta, com limite e dias de fechamento da fatura
                </p>
              </div>
              <button
                type="button"
                onClick={addCreditCard}
                className="flex items-center gap-1.5 rounded-xl border border-[var(--border)] px-3 py-2 text-[12.5px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]"
              >
                <PlusIcon className="h-3.5 w-3.5" />
                Adicionar cartão
              </button>
            </div>

            {creditCards.length === 0 ? (
              <p className="py-4 text-center text-[13px] text-[var(--muted)]">Nenhum cartão cadastrado ainda.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {creditCards.map((card, index) => (
                  <div key={index} className="rounded-xl bg-[var(--page)] p-4">
                    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
                      <div className="xl:col-span-2">
                        <TextField
                          label="Nome do cartão"
                          icon={<CreditCardIcon className="h-4 w-4" />}
                          placeholder="Ex: Nubank Empresarial"
                          value={card.name}
                          onChange={(event) => updateCreditCard(index, { name: event.target.value })}
                        />
                      </div>
                      <TextField
                        label="Bandeira"
                        icon={<CreditCardIcon className="h-4 w-4" />}
                        placeholder="Visa, Master..."
                        value={card.brand ?? ''}
                        onChange={(event) => updateCreditCard(index, { brand: event.target.value })}
                      />
                      <TextField
                        label="Final"
                        icon={<CreditCardIcon className="h-4 w-4" />}
                        placeholder="0000"
                        inputMode="numeric"
                        value={card.last_digits ?? ''}
                        onChange={(event) => updateCreditCard(index, { last_digits: event.target.value.replace(/\D/g, '').slice(0, 4) })}
                      />
                      <TextField
                        label="Limite"
                        icon={<WalletIcon className="h-4 w-4" />}
                        placeholder="0,00"
                        inputMode="decimal"
                        value={card.limit_value !== undefined && card.limit_value !== null ? String(card.limit_value) : ''}
                        onChange={(event) => updateCreditCard(index, { limit_value: event.target.value ? Number(event.target.value.replace(/[^\d.,]/g, '')) : undefined })}
                      />
                      <label className="flex flex-col gap-1.5">
                        <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Fecha (dia)</span>
                        <input
                          type="number"
                          min={1}
                          max={31}
                          value={card.closing_day}
                          onChange={(event) => updateCreditCard(index, { closing_day: Number(event.target.value) })}
                          className="w-full rounded-xl bg-[var(--surface)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                        />
                      </label>
                      <div className="flex items-end justify-between gap-3 xl:col-span-6">
                        <label className="flex items-center gap-2 text-[13px] font-semibold text-[var(--ink)]">
                          <input
                            type="checkbox"
                            checked={card.status === 1}
                            onChange={(event) => updateCreditCard(index, { status: event.target.checked ? 1 : 0 })}
                            className="h-4 w-4 accent-[var(--blue-500)]"
                          />
                          Ativo
                        </label>
                        <label className="flex items-center gap-1.5 text-[12px] font-semibold text-[var(--ink-soft)]">
                          Vence (dia)
                          <input
                            type="number"
                            min={1}
                            max={31}
                            value={card.due_day}
                            onChange={(event) => updateCreditCard(index, { due_day: Number(event.target.value) })}
                            className="w-16 rounded-lg bg-[var(--surface)] px-2 py-1 text-[13px] text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)]"
                          />
                        </label>
                        <button
                          type="button"
                          onClick={() => removeCreditCard(index)}
                          className="flex items-center gap-1.5 rounded-lg px-2 py-1.5 text-[12.5px] font-bold text-[var(--red-500)] hover:bg-[var(--red-100)]"
                        >
                          <TrashIcon className="h-3.5 w-3.5" />
                          Remover
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
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
