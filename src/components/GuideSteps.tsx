import { useState, type ReactNode } from 'react'
import { CheckCircleIcon, ChevronDownIcon } from './icons'

export type GuideStepStatus = 'done' | 'current' | 'pending' | 'info'

export interface GuideStep {
  key: string
  title: string
  // Frase curta, sempre visível.
  description: ReactNode
  // done = feito (marcado sozinho pelo sistema), current = é a vez, pending = ainda não,
  // info = só orientação (sem marca de feito).
  status: GuideStepStatus
  // Explicação completa, aberta por "Ver detalhes" (já aberta no passo atual).
  details?: ReactNode
  // Botões do passo (baixar, cadastrar…).
  actions?: ReactNode
  // Ajuda extra (vídeo, artigo): aparece como link no passo.
  links?: { label: string; href: string }[]
}

interface GuideStepsProps {
  title: string
  subtitle?: string
  steps: GuideStep[]
}

const BADGE: Record<GuideStepStatus, string> = {
  done: 'bg-[var(--green-100)] text-[var(--green-600)]',
  current: 'bg-[var(--blue-500)] text-white',
  pending: 'bg-[var(--page)] text-[var(--muted)]',
  info: 'bg-[var(--blue-100)] text-[var(--blue-700)]',
}

// Passo a passo que se marca sozinho: cada passo mostra o que fazer, o
// detalhe completo e os botões, e fica "feito" quando o sistema percebe.
// Pensado para ser reaproveitado em qualquer tela que precise de um tutorial
// (impressão, NF-e, WhatsApp…), com espaço para vídeo/artigo por passo.
export function GuideSteps({ title, subtitle, steps }: GuideStepsProps) {
  const [openKeys, setOpenKeys] = useState<Set<string>>(new Set())
  const done = steps.filter((step) => step.status === 'done').length
  const counted = steps.filter((step) => step.status !== 'info').length

  function toggle(key: string) {
    setOpenKeys((current) => {
      const next = new Set(current)
      if (next.has(key)) next.delete(key)
      else next.add(key)
      return next
    })
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-[15px] font-bold text-[var(--ink)]">{title}</h2>
          {subtitle && <p className="mt-0.5 text-[12.5px] text-[var(--ink-soft)]">{subtitle}</p>}
        </div>
        <span className="rounded-full bg-[var(--page)] px-3 py-1 text-[12px] font-bold text-[var(--ink-soft)]">
          {done} de {counted} passos
        </span>
      </div>

      <ol className="mt-4 flex flex-col gap-3">
        {steps.map((step, index) => {
          const open = step.status === 'current' || openKeys.has(step.key)
          return (
            <li
              key={step.key}
              className={`rounded-xl border p-4 ${
                step.status === 'current' ? 'border-[var(--blue-300)] bg-[var(--blue-100)]/40' : 'border-[var(--border)]'
              }`}
            >
              <div className="flex items-start gap-3">
                <span
                  className={`flex h-7 w-7 flex-none items-center justify-center rounded-full text-[12.5px] font-bold ${BADGE[step.status]}`}
                >
                  {step.status === 'done' ? <CheckCircleIcon className="h-4 w-4" /> : index + 1}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[14px] font-bold text-[var(--ink)]">{step.title}</p>
                  <div className="mt-0.5 text-[13px] text-[var(--ink-soft)]">{step.description}</div>

                  {step.actions && <div className="mt-3 flex flex-wrap items-center gap-2">{step.actions}</div>}

                  {step.details && (
                    <>
                      {step.status !== 'current' && (
                        <button
                          type="button"
                          onClick={() => toggle(step.key)}
                          className="mt-2 flex items-center gap-1 text-[12.5px] font-bold text-[var(--blue-700)] hover:underline"
                        >
                          {open ? 'Ocultar detalhes' : 'Ver detalhes'}
                          <ChevronDownIcon className={`h-3.5 w-3.5 transition-transform ${open ? 'rotate-180' : ''}`} />
                        </button>
                      )}
                      {open && (
                        <div className="mt-3 flex flex-col gap-2 rounded-lg bg-[var(--surface)] p-3.5 text-[13px] leading-relaxed text-[var(--ink-soft)]">
                          {step.details}
                        </div>
                      )}
                    </>
                  )}

                  {step.links && step.links.length > 0 && (
                    <div className="mt-2 flex flex-wrap gap-3">
                      {step.links.map((link) => (
                        <a
                          key={link.href}
                          href={link.href}
                          target="_blank"
                          rel="noreferrer"
                          className="text-[12.5px] font-bold text-[var(--blue-700)] hover:underline"
                        >
                          {link.label}
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}
