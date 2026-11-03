import { useEffect, useState } from 'react'
import { fetchBankAccounts, type BankAccountRecord } from '../lib/bankAccounts'
import { FORM_PAYMENT_LABELS } from '../lib/bills'
import { formatCurrency, formatDate } from '../lib/format'
import type { LateReturnDecision, LateReturnMode, LateReturnPreview } from '../lib/sales'
import { MoneyInput } from './form/MoneyInput'
import { SelectField } from './form/SelectField'

interface LateReturnDecisionModalProps {
  token: string
  companyId: string
  info: LateReturnPreview
  submitting: boolean
  error: string | null
  onCancel: () => void
  onSubmit: (decision: LateReturnDecision) => void
}

function periodLabel(frequency: string, count: number) {
  if (frequency === 'daily') return count === 1 ? 'diária' : 'diárias'
  if (frequency === 'weekly') return count === 1 ? 'semana' : 'semanas'
  return count === 1 ? 'mês' : 'meses'
}

const MODES: { id: LateReturnMode; title: string; description: string }[] = [
  { id: 'charge', title: 'Cobrar', description: 'Lança os períodos a mais em Contas a Receber.' },
  { id: 'paid', title: 'Já recebido', description: 'O cliente pagou agora: lança como recebido no caixa.' },
  { id: 'waive', title: 'Não cobrar', description: 'Exige o motivo, que fica registrado no aluguel.' },
]

// Devolução depois do fim contratado: o operador tem que dizer o que foi feito
// com os períodos a mais antes de a devolução ser gravada — não dá para fechar
// o aluguel e deixar os dias extras sem cobrança nem justificativa.
export function LateReturnDecisionModal({ token, companyId, info, submitting, error, onCancel, onSubmit }: LateReturnDecisionModalProps) {
  const [mode, setMode] = useState<LateReturnMode | null>(null)
  const [amountPerPeriod, setAmountPerPeriod] = useState(info.rate > 0 ? info.rate.toFixed(2) : '')
  const [formPayment, setFormPayment] = useState('')
  const [bankAccountId, setBankAccountId] = useState('')
  const [reason, setReason] = useState('')
  const [bankAccounts, setBankAccounts] = useState<BankAccountRecord[]>([])
  const [localError, setLocalError] = useState<string | null>(null)

  useEffect(() => {
    if (mode !== 'paid' || bankAccounts.length) return
    fetchBankAccounts(token, companyId, { limit: 100 })
      .then((result) => setBankAccounts(result.data))
      .catch(() => setBankAccounts([]))
  }, [mode, token, companyId, bankAccounts.length])

  const periods = `${info.extraPeriods} ${periodLabel(info.frequency, info.extraPeriods)}`
  const amount = Number(amountPerPeriod || 0)
  const discounted = mode !== 'waive' && info.rate > 0 && amount < info.rate
  const needsReason = mode === 'waive' || discounted

  function handleSubmit() {
    setLocalError(null)
    if (!mode) return setLocalError('Escolha o que foi feito com os períodos a mais.')
    if (mode !== 'waive' && amount <= 0) return setLocalError('Informe o valor de cada período.')
    if (mode === 'paid' && formPayment === '') return setLocalError('Informe a forma de pagamento recebida.')
    if (needsReason && reason.trim().length < 10) {
      return setLocalError(
        mode === 'waive' ? 'Escreva o motivo de não cobrar (mínimo 10 caracteres).' : 'Escreva o motivo do desconto (mínimo 10 caracteres).'
      )
    }
    onSubmit({
      mode,
      reason: reason.trim() || undefined,
      amountPerPeriod: mode === 'waive' ? undefined : amount,
      formPayment: mode === 'paid' ? Number(formPayment) : undefined,
      bankAccountId: mode === 'paid' && bankAccountId ? bankAccountId : undefined,
    })
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center overflow-y-auto bg-black/40 p-3 pt-6 sm:pt-16">
      <div className="flex w-full max-w-lg flex-col gap-4 rounded-2xl bg-[var(--surface)] p-5 shadow-xl">
        <div>
          <p className="text-[15px] font-bold text-[var(--ink)]">Devolução em atraso</p>
          <p className="mt-1 text-[13px] text-[var(--ink-soft)]">
            Contratado até <strong>{formatDate(info.contractedEndDate)}</strong>, devolvido em{' '}
            <strong>{formatDate(info.actualReturnDate)}</strong>: <strong className="text-[var(--red-500)]">{periods} a mais</strong>
            {info.rate > 0 && (
              <>
                {' '}
                ({formatCurrency(info.rate)} cada, total {formatCurrency(info.extraTotal)})
              </>
            )}
            . O que foi feito?
          </p>
        </div>

        <div className="grid gap-2 sm:grid-cols-3">
          {MODES.map((option) => (
            <button
              key={option.id}
              type="button"
              onClick={() => setMode(option.id)}
              className={`flex flex-col gap-1 rounded-xl border px-3 py-2.5 text-left transition ${
                mode === option.id
                  ? 'border-[var(--blue-500)] bg-[var(--blue-50)] ring-1 ring-[var(--blue-500)]'
                  : 'border-[var(--border)] hover:bg-[var(--page)]'
              }`}
            >
              <span className="text-[13px] font-bold text-[var(--ink)]">{option.title}</span>
              <span className="text-[11.5px] leading-snug text-[var(--muted)]">{option.description}</span>
            </button>
          ))}
        </div>

        {(mode === 'charge' || mode === 'paid') && (
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Valor por {periodLabel(info.frequency, 1)}</span>
              <MoneyInput
                value={amountPerPeriod}
                onChange={(event) => setAmountPerPeriod(event.target.value)}
                className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)]"
              />
            </label>
            <div className="flex flex-col justify-end pb-2.5 text-[13px] text-[var(--ink-soft)]">
              Total: <strong className="text-[15px] text-[var(--ink)]">{formatCurrency(amount * info.extraPeriods)}</strong>
            </div>
            {mode === 'paid' && (
              <>
                <SelectField label="Forma de pagamento" value={formPayment} onChange={(event) => setFormPayment(event.target.value)}>
                  <option value="">Selecione</option>
                  {Object.entries(FORM_PAYMENT_LABELS).map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </SelectField>
                <SelectField label="Conta (opcional)" value={bankAccountId} onChange={(event) => setBankAccountId(event.target.value)}>
                  <option value="">Conta padrão da venda</option>
                  {bankAccounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name}
                    </option>
                  ))}
                </SelectField>
              </>
            )}
          </div>
        )}

        {needsReason && (
          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-[var(--ink-soft)]">
              {mode === 'waive' ? 'Motivo de não cobrar' : `Motivo do desconto (contrato ${formatCurrency(info.rate)})`}
            </span>
            <textarea
              rows={3}
              value={reason}
              onChange={(event) => setReason(event.target.value)}
              className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent focus:outline-none focus:ring-[var(--blue-300)]"
            />
            <span className="text-[11.5px] text-[var(--muted)]">Fica registrado no aluguel e no histórico com o seu usuário.</span>
          </label>
        )}

        {(localError || error) && (
          <p className="rounded-xl bg-[var(--red-100)] px-3.5 py-2.5 text-[12.5px] font-medium text-[var(--red-500)]">{localError || error}</p>
        )}

        <div className="flex flex-wrap justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-xl border border-[var(--border)] px-4 py-2 text-[13px] font-semibold text-[var(--ink-soft)] disabled:opacity-60"
          >
            Voltar
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            disabled={submitting}
            className="rounded-xl bg-[var(--blue-500)] px-4 py-2 text-[13px] font-bold text-white hover:bg-[var(--blue-700)] disabled:opacity-60"
          >
            {submitting ? 'Registrando…' : 'Confirmar devolução'}
          </button>
        </div>
      </div>
    </div>
  )
}
