import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Logo } from '../../components/Logo'
import {
  fetchSignatureInfo,
  requestSignatureCode,
  verifySignatureCode,
  submitSignature,
  type SignatureInfo,
} from '../../lib/signatureApi'
import { CheckCircleIcon, AlertCircleIcon, TrashIcon, MailIcon, WhatsappIcon } from '../../components/icons'
import { LiveSelfieCapture } from './LiveSelfieCapture'

interface SignaturePageProps {
  token: string
}

type Step = 'loading' | 'error' | 'already-signed' | 'choose-channel' | 'code' | 'sign' | 'done'

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-svh items-center justify-center overflow-hidden bg-[var(--page)] px-4 py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -left-24 h-96 w-96 rounded-full opacity-40 blur-3xl"
        style={{ background: 'radial-gradient(circle, var(--blue-100), transparent 70%)' }}
      />
      <div className="relative w-full max-w-md">
        <div className="mb-6 flex justify-center">
          <Logo className="h-10 w-auto" />
        </div>
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-6 shadow-sm sm:p-8">
          {children}
        </div>
      </div>
    </div>
  )
}

function SignaturePad({ onChange }: { onChange: (blob: Blob | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)
  const hasStroke = useRef(false)

  function getCtx() {
    const canvas = canvasRef.current
    return canvas?.getContext('2d') || null
  }

  function point(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  function handleDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    const ctx = getCtx()
    if (!ctx) return
    drawing.current = true
    const { x, y } = point(event)
    ctx.beginPath()
    ctx.moveTo(x, y)
  }

  function handleMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const ctx = getCtx()
    if (!ctx) return
    const { x, y } = point(event)
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.strokeStyle = '#141413'
    ctx.lineTo(x, y)
    ctx.stroke()
    hasStroke.current = true
  }

  function handleUp() {
    drawing.current = false
    emit()
  }

  function emit() {
    const canvas = canvasRef.current
    if (!canvas || !hasStroke.current) {
      onChange(null)
      return
    }
    canvas.toBlob((blob) => onChange(blob), 'image/png')
  }

  function clear() {
    const canvas = canvasRef.current
    const ctx = getCtx()
    if (!canvas || !ctx) return
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    hasStroke.current = false
    onChange(null)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="overflow-hidden rounded-2xl border-2 border-dashed border-[var(--border)] bg-white">
        <canvas
          ref={canvasRef}
          width={400}
          height={160}
          className="h-40 w-full touch-none"
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerLeave={handleUp}
        />
      </div>
      <button
        type="button"
        onClick={clear}
        className="flex items-center gap-1.5 self-end text-[12.5px] font-semibold text-[var(--muted)] hover:text-[var(--ink)]"
      >
        <TrashIcon className="h-3.5 w-3.5" />
        Limpar
      </button>
    </div>
  )
}

export function SignaturePage({ token }: SignaturePageProps) {
  const [step, setStep] = useState<Step>('loading')
  const [info, setInfo] = useState<SignatureInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [channel, setChannel] = useState<'email' | 'whatsapp' | null>(null)
  const [code, setCode] = useState('')
  const [sentTo, setSentTo] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [selfieBlob, setSelfieBlob] = useState<Blob | null>(null)
  const [signatureBlob, setSignatureBlob] = useState<Blob | null>(null)
  const [fileUrl, setFileUrl] = useState('')

  useEffect(() => {
    fetchSignatureInfo(token)
      .then((data) => {
        setInfo(data)
        if (data.alreadySigned) {
          setStep('already-signed')
        } else if (data.verified) {
          setStep('sign')
        } else {
          setStep('choose-channel')
        }
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : 'Link inválido.')
        setStep('error')
      })
  }, [token])

  async function handleRequestCode(selected: 'email' | 'whatsapp') {
    setError(null)
    try {
      const res = await requestSignatureCode(token, selected)
      setChannel(selected)
      setSentTo(res.destination)
      setStep('code')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível enviar o código.')
    }
  }

  async function handleVerifyCode() {
    setError(null)
    try {
      await verifySignatureCode(token, code)
      setStep('sign')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código incorreto.')
    }
  }

  async function handleSubmit() {
    if (!selfieBlob || !signatureBlob) {
      setError('Tire a foto e desenhe sua rubrica antes de confirmar.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const res = await submitSignature(token, selfieBlob, signatureBlob)
      setFileUrl(res.fileUrl)
      setStep('done')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível assinar. Tente novamente.')
    } finally {
      setSubmitting(false)
    }
  }

  if (step === 'loading') {
    return (
      <PageShell>
        <p className="text-center text-[14px] text-[var(--muted)]">Carregando documento…</p>
      </PageShell>
    )
  }

  if (step === 'error') {
    return (
      <PageShell>
        <div className="flex flex-col items-center gap-3 text-center">
          <AlertCircleIcon className="h-10 w-10 text-[var(--red-500)]" />
          <p className="text-[14px] font-semibold text-[var(--ink)]">{error}</p>
        </div>
      </PageShell>
    )
  }

  if (step === 'already-signed') {
    return (
      <PageShell>
        <div className="flex flex-col items-center gap-3 text-center">
          <CheckCircleIcon className="h-10 w-10 text-[var(--green-600)]" />
          <h1 className="text-[17px] font-bold text-[var(--ink)]">Documento já assinado</h1>
          <p className="text-[13.5px] text-[var(--muted)]">
            Este documento já foi confirmado e assinado anteriormente.
          </p>
          {info?.documentUrl && (
            <a
              href={info.documentUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 rounded-xl bg-[var(--blue-500)] px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-[var(--blue-700)]"
            >
              Ver documento assinado
            </a>
          )}
        </div>
      </PageShell>
    )
  }

  if (step === 'done') {
    return (
      <PageShell>
        <div className="flex flex-col items-center gap-3 text-center">
          <CheckCircleIcon className="h-10 w-10 text-[var(--green-600)]" />
          <h1 className="text-[17px] font-bold text-[var(--ink)]">Assinado com sucesso!</h1>
          <p className="text-[13.5px] text-[var(--muted)]">
            Obrigado, {info?.signerName}. Sua assinatura foi registrada.
          </p>
          {fileUrl && (
            <a
              href={fileUrl}
              target="_blank"
              rel="noreferrer"
              className="mt-2 rounded-xl bg-[var(--blue-500)] px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-[var(--blue-700)]"
            >
              Ver documento assinado
            </a>
          )}
        </div>
      </PageShell>
    )
  }

  return (
    <PageShell>
      <div className="flex flex-col gap-5">
        <div className="text-center">
          <p className="text-[12px] font-semibold uppercase tracking-wide text-[var(--blue-500)]">
            {info?.companyName}
          </p>
          <h1 className="mt-0.5 text-[18px] font-bold text-[var(--ink)]">Assinatura de documento</h1>
          <p className="mt-1 text-[13px] text-[var(--muted)]">Olá, {info?.signerName}</p>
        </div>

        {info?.documentUrl && (
          <a
            href={info.documentUrl}
            target="_blank"
            rel="noreferrer"
            className="rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-2.5 text-center text-[13px] font-bold text-[var(--blue-500)] hover:bg-[var(--page)]"
          >
            Ler o documento antes de assinar
          </a>
        )}

        {error && (
          <p className="rounded-xl bg-[var(--red-100)] px-3.5 py-2.5 text-center text-[13px] font-medium text-[var(--red-500)]">
            {error}
          </p>
        )}

        {step === 'choose-channel' && (
          <div className="flex flex-col gap-3">
            <p className="text-center text-[13px] text-[var(--muted)]">
              Pra confirmar sua identidade, escolha onde receber o código de verificação:
            </p>
            {info?.allowEmail && (
              <button
                type="button"
                onClick={() => handleRequestCode('email')}
                className="flex items-center justify-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-[13.5px] font-bold text-[var(--ink)] hover:bg-[var(--page)]"
              >
                <MailIcon className="h-4 w-4" />
                E-mail ({info.maskedEmail})
              </button>
            )}
            {info?.allowWhatsapp && (
              <button
                type="button"
                onClick={() => handleRequestCode('whatsapp')}
                className="flex items-center justify-center gap-2 rounded-xl bg-[var(--green-600)] px-4 py-3 text-[13.5px] font-bold text-white hover:opacity-90"
              >
                <WhatsappIcon className="h-4 w-4" />
                WhatsApp ({info.maskedPhone})
              </button>
            )}
            {!info?.allowEmail && !info?.allowWhatsapp && (
              <p className="text-center text-[13px] text-[var(--red-500)]">
                Nenhum canal de verificação disponível. Entre em contato com {info?.companyName}.
              </p>
            )}
          </div>
        )}

        {step === 'code' && (
          <div className="flex flex-col gap-3">
            <p className="text-center text-[13px] text-[var(--muted)]">
              Enviamos um código de 6 dígitos pra {sentTo} ({channel === 'email' ? 'e-mail' : 'WhatsApp'}).
            </p>
            <input
              type="text"
              inputMode="numeric"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="rounded-xl border border-[var(--border)] bg-[var(--page)] px-4 py-3 text-center text-[22px] font-bold tracking-[0.3em] text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-[var(--blue-500)] focus:outline-none"
            />
            <button
              type="button"
              onClick={handleVerifyCode}
              disabled={code.length !== 6}
              className="rounded-xl bg-[var(--blue-500)] px-4 py-3 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              Confirmar código
            </button>
            <button
              type="button"
              onClick={() => setStep('choose-channel')}
              className="text-[12.5px] font-semibold text-[var(--muted)]"
            >
              Escolher outro canal
            </button>
          </div>
        )}

        {step === 'sign' && (
          <div className="flex flex-col gap-4">
            <div>
              <p className="mb-2 text-[12.5px] font-semibold text-[var(--ink-soft)]">1. Tire uma foto sua ao vivo</p>
              <LiveSelfieCapture onCapture={setSelfieBlob} />
            </div>

            <div>
              <p className="mb-2 text-[12.5px] font-semibold text-[var(--ink-soft)]">2. Desenhe sua rubrica</p>
              <SignaturePad onChange={setSignatureBlob} />
            </div>

            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !selfieBlob || !signatureBlob}
              className="rounded-xl bg-[var(--blue-500)] px-4 py-3 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {submitting ? 'Assinando…' : 'Confirmar assinatura'}
            </button>
          </div>
        )}
      </div>
    </PageShell>
  )
}
