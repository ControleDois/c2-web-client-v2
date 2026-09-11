import { useState } from 'react'
import { SectionCard } from '../../components/SectionCard'
import { EyeIcon, EyeOffIcon, CopyIcon } from '../../components/icons'

// Token de API da empresa (Config.token) - usado por sistemas externos (ex:
// siace-erp) pra autenticar direto por empresa, sem login de usuário.
export function ApiTokenCard({ apiToken }: { apiToken?: string }) {
  const [visible, setVisible] = useState(false)
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    if (!apiToken) return
    navigator.clipboard?.writeText(apiToken)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return (
    <SectionCard title="Integração" subtitle="Token de acesso desta empresa pra sistemas externos (ex: siace-erp)" defaultCollapsed>
      {apiToken ? (
        <div className="flex items-center gap-2 rounded-xl bg-[var(--page)] px-3.5 py-2.5">
          <span className="min-w-0 flex-1 truncate font-mono text-[13.5px] text-[var(--ink)]">
            {visible ? apiToken : '•'.repeat(32)}
          </span>
          <button
            type="button"
            onClick={() => setVisible((current) => !current)}
            aria-label={visible ? 'Ocultar token' : 'Mostrar token'}
            title={visible ? 'Ocultar token' : 'Mostrar token'}
            className="flex h-8 w-8 flex-none items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--surface)] hover:text-[var(--ink)]"
          >
            {visible ? <EyeOffIcon className="h-4 w-4" /> : <EyeIcon className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={handleCopy}
            className="flex flex-none items-center gap-1.5 rounded-lg bg-[var(--surface)] px-2.5 py-1.5 text-[11.5px] font-bold text-[var(--blue-700)] hover:bg-[var(--blue-100)]"
          >
            <CopyIcon className="h-3.5 w-3.5" />
            {copied ? 'Copiado!' : 'Copiar'}
          </button>
        </div>
      ) : (
        <p className="text-[12.5px] text-[var(--muted)]">Token ainda não disponível.</p>
      )}
    </SectionCard>
  )
}
