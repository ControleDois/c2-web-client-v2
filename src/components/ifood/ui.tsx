import type { ReactNode } from 'react'
import { AlertTriangleIcon, CheckCircleIcon, XCircleIcon } from '../icons'

// Blocos visuais das telas do iFood: texto claro, botões grandes e sempre uma dica de o que fazer.

export const buttonPrimary =
  'inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--blue-500)] px-5 py-3 text-[14px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:cursor-not-allowed disabled:opacity-50'

export const buttonSecondary =
  'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[14px] font-bold text-[var(--blue-700)] ring-1 ring-[var(--blue-300)] transition hover:bg-[var(--blue-100)] disabled:cursor-not-allowed disabled:opacity-50'

export const buttonDanger =
  'inline-flex items-center justify-center gap-2 rounded-xl px-5 py-3 text-[14px] font-bold text-[var(--red-500)] ring-1 ring-[var(--red-500)]/30 transition hover:bg-[var(--red-100)] disabled:cursor-not-allowed disabled:opacity-50'

export const inputClass =
  'w-full rounded-xl bg-[var(--page)] px-4 py-3 text-[14.5px] text-[var(--ink)] placeholder:text-[var(--muted)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]'

export function PageHeader({ eyebrow, title, children }: { eyebrow: string; title: string; children?: ReactNode }) {
  return (
    <div>
      <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-500)] uppercase">{eyebrow}</p>
      <h1 className="mt-0.5 text-[24px] font-bold tracking-tight text-[var(--ink)]">{title}</h1>
      {children && <div className="mt-1.5 max-w-[680px] text-[14px] leading-relaxed text-[var(--ink-soft)]">{children}</div>}
    </div>
  )
}

// Cartão de uma tarefa: título, uma frase explicando para que serve e o conteúdo.
export function Panel({
  title,
  help,
  action,
  children,
}: {
  title: string
  help?: ReactNode
  action?: ReactNode
  children: ReactNode
}) {
  return (
    <section className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-[var(--card-shadow)] sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <h2 className="text-[16px] font-bold text-[var(--ink)]">{title}</h2>
          {help && <p className="mt-1 text-[13.5px] leading-relaxed text-[var(--ink-soft)]">{help}</p>}
        </div>
        {action}
      </div>
      <div className="mt-4">{children}</div>
    </section>
  )
}

type Tone = 'info' | 'good' | 'warn' | 'bad'

const TONE: Record<Tone, { box: string; icon: ReactNode }> = {
  info: { box: 'bg-[var(--blue-100)] text-[var(--blue-700)]', icon: <span className="text-[16px]">💡</span> },
  good: { box: 'bg-[var(--green-100)] text-[var(--green-600)]', icon: <CheckCircleIcon className="h-5 w-5" /> },
  warn: { box: 'bg-[var(--amber-100)] text-[var(--amber-500)]', icon: <AlertTriangleIcon className="h-5 w-5" /> },
  bad: { box: 'bg-[var(--red-100)] text-[var(--red-500)]', icon: <XCircleIcon className="h-5 w-5" /> },
}

// Caixa de aviso ou dica: sempre diz o que aconteceu e, se der, o que fazer agora.
export function Tip({ tone = 'info', title, children }: { tone?: Tone; title?: string; children?: ReactNode }) {
  return (
    <div className={`flex items-start gap-3 rounded-xl px-4 py-3.5 ${TONE[tone].box}`}>
      <span className="mt-0.5 flex-none">{TONE[tone].icon}</span>
      <div className="min-w-0 text-[13.5px] leading-relaxed">
        {title && <p className="font-bold">{title}</p>}
        {children && <div className={title ? 'mt-0.5 opacity-90' : ''}>{children}</div>}
      </div>
    </div>
  )
}

export function Pill({ tone, children, title }: { tone: 'good' | 'warn' | 'bad' | 'neutral'; children: ReactNode; title?: string }) {
  const style = {
    good: 'bg-[var(--green-100)] text-[var(--green-600)]',
    warn: 'bg-[var(--amber-100)] text-[var(--amber-500)]',
    bad: 'bg-[var(--red-100)] text-[var(--red-500)]',
    neutral: 'bg-[var(--page)] text-[var(--ink-soft)]',
  }[tone]
  return (
    <span title={title} className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-[12.5px] font-bold ${style}`}>
      {children}
    </span>
  )
}

// Troca a mensagem técnica do iFood por uma frase que o usuário entende.
export function friendlyIfoodMessage(raw: string): string {
  const text = String(raw || '')
  if (/no permissions? granted|forbidden|not authorized|unauthorized/i.test(text)) {
    return 'O iFood ainda não liberou este recurso para a sua loja. Fale com o suporte e informe esta mensagem.'
  }
  if (/client not found|deactivated/i.test(text)) {
    return 'O iFood não reconheceu as credenciais do sistema. Peça ao suporte para conferir em Configurações > Integrações · APIs.'
  }
  if (/timeout|econnreset|enotfound|network/i.test(text)) {
    return 'Não foi possível falar com o iFood agora. Tente de novo em alguns instantes.'
  }
  if (/image|imagem|foto/i.test(text) && /size|tamanho|format|formato/i.test(text)) {
    return 'A foto não foi aceita pelo iFood. Use uma imagem JPG ou PNG de até 5 MB.'
  }
  return text
}
