import {
  CloseIcon,
  ChevronRightIcon,
  WalletIcon,
  CoinIcon,
  TagIcon,
  TrendUpIcon,
  BuildingIcon,
  BuildingsIcon,
  FileTextIcon,
} from './icons'
import { MODALITY_LABELS, MODALITY_DESCRIPTIONS, MODALITY_ORDER, type Modality } from '../lib/loanModalities'

interface NewLoanModalProps {
  open: boolean
  onClose: () => void
  onSelect: (modality: Modality) => void
}

const MODALITY_ICONS: Record<Modality, typeof WalletIcon> = {
  dinheiro_alugado: WalletIcon,
  per_installment: CoinIcon,
  custom: TagIcon,
  sobre_total: TrendUpIcon,
  sac: BuildingIcon,
  price: BuildingsIcon,
  cheque: FileTextIcon,
}

export function NewLoanModal({ open, onClose, onSelect }: NewLoanModalProps) {
  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="w-full max-w-[480px] rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-[19px] font-bold text-[var(--ink)]">Novo Empréstimo</h2>
            <p className="mt-0.5 text-[13px] text-[var(--ink-soft)]">Escolha a modalidade</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-[var(--ink-soft)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
            aria-label="Fechar"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-5 flex flex-col divide-y divide-[var(--border)] rounded-xl bg-[var(--page)]">
          {MODALITY_ORDER.map((modality) => {
            const Icon = MODALITY_ICONS[modality]
            return (
              <button
                key={modality}
                type="button"
                onClick={() => onSelect(modality)}
                className="flex items-center gap-3.5 px-4 py-3.5 text-left transition first:rounded-t-xl last:rounded-b-xl hover:bg-[var(--blue-100)]"
              >
                <span className="flex h-10 w-10 flex-none items-center justify-center rounded-xl bg-[var(--blue-100)] text-[var(--blue-700)]">
                  <Icon className="h-[18px] w-[18px]" />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-[var(--ink)]">{MODALITY_LABELS[modality]}</p>
                  <p className="mt-0.5 text-[12px] text-[var(--ink-soft)]">{MODALITY_DESCRIPTIONS[modality]}</p>
                </div>
                <ChevronRightIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}
