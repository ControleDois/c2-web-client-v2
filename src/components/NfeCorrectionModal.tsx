import { useEffect, useState } from 'react'
import {
  fetchNfeCorrections,
  fetchNfeCorrectionFileUrl,
  sendNfeCorrection,
  formatNfeProviderError,
  type NfeCorrectionRecord,
  type NfeRecord,
} from '../lib/nfes'
import { formatDateTime } from '../lib/format'
import { CloseIcon } from './icons'

interface NfeCorrectionModalProps {
  token: string
  nfe: NfeRecord
  onClose: () => void
}

const MIN_LENGTH = 15
const MAX_LENGTH = 1000

export function NfeCorrectionModal({ token, nfe, onClose }: NfeCorrectionModalProps) {
  const [history, setHistory] = useState<NfeCorrectionRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  useEffect(() => {
    fetchNfeCorrections(token, nfe.id)
      .then((res) => setHistory(res || []))
      .catch(() => setHistory([]))
      .finally(() => setLoading(false))
  }, [token, nfe.id])

  const length = text.trim().length
  const valid = length >= MIN_LENGTH && length <= MAX_LENGTH

  async function handleSend() {
    if (!valid || sending) return
    setSending(true)
    setError(null)
    setSuccess(null)
    try {
      const created = await sendNfeCorrection(token, nfe.id, text.trim())
      setHistory((current) => [created, ...current])
      setText('')
      setSuccess('Carta de correção autorizada pela SEFAZ.')
    } catch (err) {
      setError(formatNfeProviderError(err, 'Não foi possível enviar a carta de correção.'))
    } finally {
      setSending(false)
    }
  }

  async function openFile(correction: NfeCorrectionRecord, type: 'pdf' | 'xml') {
    setError(null)
    try {
      const url = await fetchNfeCorrectionFileUrl(token, nfe.id, correction.id, type)
      window.open(url, '_blank', 'noopener')
    } catch (err) {
      setError(formatNfeProviderError(err, 'Não foi possível abrir o arquivo.'))
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={onClose}>
      <div
        className="flex max-h-[88vh] w-full max-w-xl flex-col overflow-hidden rounded-2xl bg-[var(--surface)] shadow-[var(--card-shadow)]"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-[var(--border)] px-5 py-4">
          <div>
            <h2 className="text-[15px] font-bold text-[var(--ink)]">Carta de correção — NF-e nº {nfe.numero ?? nfe.code}</h2>
            <p className="mt-0.5 text-[12.5px] text-[var(--muted)]">
              Corrige dados informativos da nota já emitida. Não serve para alterar valores, impostos, cliente ou data
              de emissão.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className="rounded-xl p-2 text-[var(--ink-soft)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </div>

        <div className="flex flex-col gap-5 overflow-y-auto p-5">
          <div>
            <textarea
              value={text}
              onChange={(event) => setText(event.target.value.slice(0, MAX_LENGTH))}
              rows={4}
              placeholder="Descreva a correção (ex: Onde se lê endereço de entrega Rua A, leia Rua B)"
              className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[13.5px] text-[var(--ink)] ring-1 ring-transparent transition placeholder:text-[var(--muted)] focus:outline-none focus:ring-[var(--blue-300)]"
            />
            <div className="mt-1 flex items-center justify-between text-[12px] text-[var(--muted)]">
              <span>Mínimo de {MIN_LENGTH} caracteres.</span>
              <span>
                {length}/{MAX_LENGTH}
              </span>
            </div>
            {error && <p className="mt-2 whitespace-pre-wrap text-[12.5px] font-medium text-[var(--red-500)]">{error}</p>}
            {success && !error && <p className="mt-2 text-[12.5px] font-medium text-[var(--green-600)]">{success}</p>}
            <button
              type="button"
              onClick={handleSend}
              disabled={!valid || sending}
              className="mt-3 rounded-xl bg-[var(--blue-500)] px-5 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
            >
              {sending ? 'Enviando à SEFAZ…' : 'Enviar carta de correção'}
            </button>
          </div>

          <div>
            <h3 className="mb-2 text-[12.5px] font-bold text-[var(--ink)]">Cartas já enviadas</h3>
            {loading ? (
              <p className="text-[13px] text-[var(--muted)]">Carregando…</p>
            ) : history.length === 0 ? (
              <p className="text-[13px] text-[var(--muted)]">Nenhuma carta de correção para esta nota.</p>
            ) : (
              <ul className="flex flex-col gap-2.5">
                {history.map((item) => (
                  <li key={item.id} className="rounded-xl bg-[var(--page)] p-3.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[12.5px] font-bold text-[var(--ink)]">Carta nº {item.sequence}</span>
                      <span className="text-[12px] text-[var(--muted)]">
                        {item.created_at ? formatDateTime(item.created_at) : ''}
                      </span>
                    </div>
                    <p className="mt-1 whitespace-pre-wrap text-[13px] text-[var(--ink-soft)]">{item.text}</p>
                    <div className="mt-2 flex gap-3">
                      {item.pdf_path && (
                        <button
                          type="button"
                          onClick={() => openFile(item, 'pdf')}
                          className="text-[12px] font-bold text-[var(--blue-700)] hover:underline"
                        >
                          Abrir PDF
                        </button>
                      )}
                      {item.xml_path && (
                        <button
                          type="button"
                          onClick={() => openFile(item, 'xml')}
                          className="text-[12px] font-bold text-[var(--blue-700)] hover:underline"
                        >
                          Abrir XML
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
