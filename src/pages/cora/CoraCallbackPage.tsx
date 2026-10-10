import { useEffect, useRef, useState } from 'react'
import { CORA_CONNECT_STORAGE_KEY, finishCoraConnection } from '../../lib/config'
import { loadSession } from '../../lib/auth'
import { ApiError } from '../../lib/api'

type Status = 'working' | 'done' | 'error'

// Retorno da Cora depois da autorização (/cora/callback?code=...&state=...): usa a sessão do painel
// para trocar o código pelos tokens da empresa que iniciou a conexão.
export function CoraCallbackPage() {
  const [status, setStatus] = useState<Status>('working')
  const [message, setMessage] = useState('Concluindo a conexão com a Cora…')
  const started = useRef(false)

  useEffect(() => {
    // O código só vale uma vez: evita rodar duas vezes (StrictMode).
    if (started.current) return
    started.current = true

    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const state = params.get('state')
    const refused = params.get('error')
    const session = loadSession()
    let companyId: string | null = null
    try {
      companyId = localStorage.getItem(CORA_CONNECT_STORAGE_KEY)
    } catch {
      companyId = null
    }

    function fail(text: string) {
      setStatus('error')
      setMessage(text)
    }

    if (refused) return fail('A autorização foi cancelada na Cora. Volte ao painel e conecte de novo quando quiser.')
    if (!code || !state) return fail('A Cora não devolveu o código de autorização. Volte ao painel e tente conectar de novo.')
    if (!session) return fail('Sua sessão no Controle Dois expirou. Entre no painel e conecte a Cora de novo.')
    if (!companyId) return fail('Não foi possível saber de qual empresa é esta conexão. Inicie a conexão de novo pelo painel.')

    finishCoraConnection(session.token.token, { companyId, code, state })
      .then((res) => {
        try {
          localStorage.removeItem(CORA_CONNECT_STORAGE_KEY)
        } catch {
          // sem localStorage: segue
        }
        setStatus('done')
        setMessage(res.message)
      })
      .catch((err) => fail(err instanceof ApiError ? err.message : 'Não foi possível concluir a conexão com a Cora.'))
  }, [])

  return (
    <div className="flex min-h-svh items-center justify-center bg-[var(--page)] p-6">
      <div className="w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 text-center shadow-[var(--card-shadow)]">
        {status === 'working' && (
          <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-2 border-[var(--blue-300)] border-t-[var(--blue-500)]" />
        )}
        <h1 className="text-[18px] font-bold text-[var(--ink)]">
          {status === 'done' ? 'Cora conectada' : status === 'error' ? 'Não foi possível conectar' : 'Conectando…'}
        </h1>
        <p className={`mt-2 text-[13.5px] ${status === 'error' ? 'text-[var(--red-500)]' : 'text-[var(--ink-soft)]'}`}>{message}</p>
        {status !== 'working' && (
          <a
            href="/"
            className="mt-5 inline-block rounded-xl bg-[var(--blue-500)] px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-[var(--blue-700)]"
          >
            Voltar ao painel
          </a>
        )}
      </div>
    </div>
  )
}
