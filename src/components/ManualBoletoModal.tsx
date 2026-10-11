import { useEffect, useState } from 'react'
import { attachManualBoleto, type BillRecord } from '../lib/bills'
import { ApiError } from '../lib/api'
import { CloseIcon, PaperclipIcon } from './icons'
import type { AuthCompany, AuthSession } from '../lib/auth'

interface ManualBoletoModalProps {
  open: boolean
  session: AuthSession
  company: AuthCompany
  bill: BillRecord | null
  onClose: () => void
  onSaved: (message: string) => void
}

// Anexa a um título o boleto emitido fora do sistema (ex.: no app do banco): o PDF, a linha
// digitável e o PIX copia e cola. Qualquer um dos três já basta.
export function ManualBoletoModal({ open, session, company, bill, onClose, onSaved }: ManualBoletoModalProps) {
  const [file, setFile] = useState<File | null>(null)
  const [digitable, setDigitable] = useState('')
  const [pix, setPix] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!open) return
    setFile(null)
    setDigitable(bill?.boleto_provider === 'manual' ? (bill.boleto_linha_digital ?? '') : '')
    setPix(bill?.boleto_provider === 'manual' ? (bill.pix_copia_e_cola ?? '') : '')
    setError(null)
  }, [open, bill])

  if (!open || !bill) return null

  const editing = bill.boleto_provider === 'manual'

  async function handleSave() {
    setError(null)
    if (!file && !digitable.trim() && !pix.trim() && !(editing && bill?.boleto_pdf_url)) {
      return setError('Envie o PDF do boleto, a linha digitável ou o PIX copia e cola.')
    }
    setBusy(true)
    try {
      const res = await attachManualBoleto(session.token.token, company.id, bill!.id, {
        file,
        boleto_linha_digital: digitable,
        pix_copia_e_cola: pix,
      })
      onSaved(res.message)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível anexar o boleto.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="max-h-[92vh] w-full max-w-[560px] overflow-y-auto rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="text-[17px] font-bold text-[var(--ink)]">{editing ? 'Boleto anexado' : 'Anexar boleto'}</h2>
            <p className="mt-0.5 text-[12px] text-[var(--muted)]">{bill.name}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
          >
            <CloseIcon className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-4 flex flex-col gap-4">
          <div className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-[var(--ink-soft)]">PDF do boleto</span>
            <label className="flex w-fit cursor-pointer items-center gap-2 rounded-xl border border-[var(--border)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]">
              <PaperclipIcon className="h-3.5 w-3.5 flex-none" />
              {file ? file.name : editing && bill.boleto_pdf_url ? 'Trocar o PDF anexado' : 'Selecionar PDF'}
              <input type="file" accept=".pdf,application/pdf" className="hidden" onChange={(event) => setFile(event.target.files?.[0] ?? null)} />
            </label>
          </div>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Linha digitável (opcional)</span>
            <input
              value={digitable}
              onChange={(event) => setDigitable(event.target.value)}
              inputMode="numeric"
              placeholder="00000.00000 00000.000000 00000.000000 0 00000000000000"
              className="rounded-xl bg-[var(--page)] px-3.5 py-2.5 font-mono text-[13px] text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--blue-300)]"
            />
          </label>

          <label className="flex flex-col gap-1.5">
            <span className="text-[12px] font-semibold text-[var(--ink-soft)]">PIX copia e cola (opcional)</span>
            <textarea
              rows={3}
              value={pix}
              onChange={(event) => setPix(event.target.value)}
              placeholder="00020126…"
              className="resize-y rounded-xl bg-[var(--page)] px-3.5 py-2.5 font-mono text-[12.5px] text-[var(--ink)] focus:outline-none focus:ring-1 focus:ring-[var(--blue-300)]"
            />
          </label>

          <p className="text-[11.5px] text-[var(--muted)]">
            O boleto fica visível neste título (imprimir e copiar) e, se o título estiver vinculado a uma licença, o cliente vê o PDF, a linha
            digitável e o QR Code do PIX no aviso de vencimento.
          </p>
        </div>

        {error && <p className="mt-3 rounded-xl bg-[var(--red-100)] px-4 py-2.5 text-[13px] font-medium text-[var(--red-500)]">{error}</p>}

        <div className="mt-5 flex items-center justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-xl px-5 py-2.5 text-[14px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]">
            Cancelar
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className="rounded-xl bg-[var(--blue-500)] px-6 py-2.5 text-[14px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
          >
            {busy ? 'Salvando…' : 'Salvar boleto'}
          </button>
        </div>
      </div>
    </div>
  )
}
