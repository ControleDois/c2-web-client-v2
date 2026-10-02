import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Logo } from '../../components/Logo'
import {
  fetchSignatureInfo,
  requestSignatureCode,
  signatureDownloadUrl,
  verifySignatureCode,
  submitSignature,
  type SignatureInfo,
} from '../../lib/signatureApi'
import { CameraIcon, CheckCircleIcon, AlertCircleIcon, TrashIcon, MailIcon, WhatsappIcon } from '../../components/icons'
import { GeoError, getCurrentFix, reverseGeocodeLine, type GeoFix } from '../../lib/photoWatermark'
import { LiveSelfieCapture } from './LiveSelfieCapture'

interface SignaturePageProps {
  token: string
}

type Step = 'loading' | 'error' | 'already-signed' | 'choose-channel' | 'code' | 'face' | 'sign' | 'done'

const PRIMARY_BUTTON =
  'rounded-xl bg-[var(--blue-500)] px-4 py-3.5 text-[14px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:cursor-not-allowed disabled:opacity-50'
const SECONDARY_BUTTON =
  'rounded-xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3.5 text-center text-[14px] font-bold text-[var(--ink)] hover:bg-[var(--page)]'

const FLOW_STEPS = ['Verificação', 'Facial', 'Assinatura']

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="relative flex min-h-svh items-start justify-center overflow-hidden bg-[var(--page)] px-4 py-6 sm:items-center sm:py-10">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 -left-24 h-96 w-96 rounded-full opacity-40 blur-3xl"
        style={{ background: 'radial-gradient(circle, var(--blue-100), transparent 70%)' }}
      />
      <div className="relative w-full max-w-md">
        <div className="mb-4 flex justify-center sm:mb-6">
          <Logo className="h-9 w-auto sm:h-10" />
        </div>
        <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5 shadow-sm sm:p-8">
          {children}
        </div>
      </div>
    </div>
  )
}

function Stepper({ current }: { current: number }) {
  return (
    <ol className="flex items-center justify-center gap-2">
      {FLOW_STEPS.map((label, index) => {
        const done = index < current
        const active = index === current
        return (
          <li key={label} className="flex items-center gap-2">
            <span
              className={`flex h-6 w-6 items-center justify-center rounded-full text-[11.5px] font-bold ${
                done
                  ? 'bg-[var(--green-600)] text-white'
                  : active
                    ? 'bg-[var(--blue-500)] text-white'
                    : 'bg-[var(--page)] text-[var(--muted)]'
              }`}
            >
              {done ? <CheckCircleIcon className="h-3.5 w-3.5" /> : index + 1}
            </span>
            <span className={`text-[12px] font-semibold ${active ? 'text-[var(--ink)]' : 'text-[var(--muted)]'}`}>
              {label}
            </span>
            {index < FLOW_STEPS.length - 1 && <span className="h-px w-3 bg-[var(--border)]" />}
          </li>
        )
      })}
    </ol>
  )
}

function DocumentActions({ token, viewUrl }: { token: string; viewUrl?: string }) {
  return (
    <div className="mt-2 flex w-full flex-col gap-2.5">
      {viewUrl && (
        <a href={viewUrl} target="_blank" rel="noreferrer" className={`${PRIMARY_BUTTON} block text-center`}>
          Visualizar documento assinado
        </a>
      )}
      <a href={signatureDownloadUrl(token)} className={`${SECONDARY_BUTTON} block`}>
        Baixar PDF
      </a>
    </div>
  )
}

function SignaturePad({ onChange }: { onChange: (blob: Blob | null) => void }) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const drawing = useRef(false)
  const hasStroke = useRef(false)
  const [empty, setEmpty] = useState(true)

  function getCtx() {
    return canvasRef.current?.getContext('2d') || null
  }

  // O canvas tem resolução fixa e é esticado pelo CSS - converte o ponto do
  // toque (px da tela) pra px do canvas, senão o traço sai deslocado/menor
  // em telas que não têm a largura exata do canvas.
  function point(event: ReactPointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    return {
      x: (event.clientX - rect.left) * (canvas.width / rect.width),
      y: (event.clientY - rect.top) * (canvas.height / rect.height),
    }
  }

  function handleDown(event: ReactPointerEvent<HTMLCanvasElement>) {
    const ctx = getCtx()
    if (!ctx) return
    event.currentTarget.setPointerCapture(event.pointerId)
    drawing.current = true
    const { x, y } = point(event)
    ctx.beginPath()
    ctx.moveTo(x, y)
    ctx.lineTo(x + 0.01, y + 0.01)
    ctx.lineWidth = 4
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#141413'
    ctx.stroke()
  }

  function handleMove(event: ReactPointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return
    const ctx = getCtx()
    if (!ctx) return
    const { x, y } = point(event)
    ctx.lineTo(x, y)
    ctx.stroke()
    hasStroke.current = true
    setEmpty(false)
  }

  function handleUp() {
    if (!drawing.current) return
    drawing.current = false
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
    setEmpty(true)
    onChange(null)
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="relative overflow-hidden rounded-2xl border-2 border-dashed border-[var(--border)] bg-white">
        <canvas
          ref={canvasRef}
          width={600}
          height={360}
          className="aspect-[5/3] w-full touch-none"
          onPointerDown={handleDown}
          onPointerMove={handleMove}
          onPointerUp={handleUp}
          onPointerCancel={handleUp}
        />
        {empty && (
          <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-[13px] font-semibold text-[#9aa7b2]">
            Assine aqui com o dedo
          </span>
        )}
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
  const [cameraStarted, setCameraStarted] = useState(false)
  const [locating, setLocating] = useState(false)
  const [location, setLocation] = useState<GeoFix | null>(null)
  const [addressLine, setAddressLine] = useState<string | null>(null)
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
          setStep('face')
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
      setStep('face')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Código incorreto.')
    }
  }

  async function handleStartCamera() {
    setError(null)
    setLocating(true)
    try {
      const fix = await getCurrentFix()
      setLocation(fix)
      reverseGeocodeLine(fix, 4000).then(setAddressLine)
      setCameraStarted(true)
    } catch (err) {
      const kind = err instanceof GeoError ? err.kind : 'unavailable'
      setError(
        kind === 'denied'
          ? 'Precisamos da sua localização para registrar a assinatura. Libere o acesso à localização nas configurações do navegador (ícone de cadeado) e toque em "Abrir câmera" de novo.'
          : 'Não conseguimos obter sua localização. Vá para um local com melhor sinal de GPS e tente de novo.'
      )
    } finally {
      setLocating(false)
    }
  }

  async function handleSubmit() {
    if (!selfieBlob || !signatureBlob || !location) {
      setError('Faça a facial e desenhe sua rubrica antes de confirmar.')
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const res = await submitSignature(token, selfieBlob, signatureBlob, location)
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
          <CheckCircleIcon className="h-12 w-12 text-[var(--green-600)]" />
          <h1 className="text-[18px] font-bold text-[var(--ink)]">Documento já assinado</h1>
          <p className="text-[13.5px] text-[var(--muted)]">
            Este documento já foi confirmado e assinado anteriormente.
          </p>
          <DocumentActions token={token} viewUrl={info?.documentUrl} />
        </div>
      </PageShell>
    )
  }

  if (step === 'done') {
    return (
      <PageShell>
        <div className="flex flex-col items-center gap-3 text-center">
          <CheckCircleIcon className="h-12 w-12 text-[var(--green-600)]" />
          <h1 className="text-[18px] font-bold text-[var(--ink)]">Assinado com sucesso!</h1>
          <p className="text-[13.5px] text-[var(--muted)]">
            Obrigado, {info?.signerName}. Sua assinatura foi registrada no documento.
          </p>
          <DocumentActions token={token} viewUrl={fileUrl} />
        </div>
      </PageShell>
    )
  }

  const flowIndex = step === 'face' ? 1 : step === 'sign' ? 2 : 0

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

        <Stepper current={flowIndex} />

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
                className={`${SECONDARY_BUTTON} flex items-center justify-center gap-2`}
              >
                <MailIcon className="h-4 w-4" />
                E-mail ({info.maskedEmail})
              </button>
            )}
            {info?.allowWhatsapp && (
              <button
                type="button"
                onClick={() => handleRequestCode('whatsapp')}
                className="flex items-center justify-center gap-2 rounded-xl bg-[var(--green-600)] px-4 py-3.5 text-[14px] font-bold text-white hover:opacity-90"
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
              autoComplete="one-time-code"
              maxLength={6}
              value={code}
              onChange={(event) => setCode(event.target.value.replace(/\D/g, ''))}
              placeholder="000000"
              className="rounded-xl border border-[var(--border)] bg-[var(--page)] px-4 py-3 text-center text-[22px] font-bold tracking-[0.3em] text-[var(--ink)] placeholder:text-[var(--muted)] focus:border-[var(--blue-500)] focus:outline-none"
            />
            <button type="button" onClick={handleVerifyCode} disabled={code.length !== 6} className={PRIMARY_BUTTON}>
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

        {step === 'face' && (
          <div className="flex flex-col gap-4">
            {!cameraStarted ? (
              <>
                <div className="flex flex-col items-center gap-2 text-center">
                  <span className="flex h-14 w-14 items-center justify-center rounded-full bg-[var(--blue-100)] text-[var(--blue-500)]">
                    <CameraIcon className="h-7 w-7" />
                  </span>
                  <h2 className="text-[16px] font-bold text-[var(--ink)]">Vamos confirmar que é você</h2>
                  <p className="text-[13px] text-[var(--muted)]">
                    Vamos usar a câmera frontal e a sua localização para uma verificação rápida. Leva uns segundos.
                  </p>
                </div>
                <ul className="flex flex-col gap-1.5 rounded-xl bg-[var(--page)] px-4 py-3 text-[12.5px] text-[var(--ink-soft)]">
                  <li>• Fique num lugar bem iluminado</li>
                  <li>• Tire óculos escuros, boné ou máscara</li>
                  <li>• Permita o acesso à câmera e à localização quando o navegador pedir</li>
                  <li>• Siga as instruções na tela: aproximar, afastar e piscar</li>
                </ul>
                <button type="button" onClick={handleStartCamera} disabled={locating} className={PRIMARY_BUTTON}>
                  {locating ? 'Obtendo localização…' : 'Abrir câmera'}
                </button>
              </>
            ) : (
              <>
                {location && (
                  <LiveSelfieCapture onCapture={setSelfieBlob} location={location} addressLine={addressLine} />
                )}
                {selfieBlob && (
                  <button type="button" onClick={() => setStep('sign')} className={PRIMARY_BUTTON}>
                    Continuar para a assinatura
                  </button>
                )}
              </>
            )}
          </div>
        )}

        {step === 'sign' && (
          <div className="flex flex-col gap-4">
            <div className="text-center">
              <h2 className="text-[16px] font-bold text-[var(--ink)]">Desenhe sua rubrica</h2>
              <p className="mt-1 text-[13px] text-[var(--muted)]">
                Use o dedo no quadro abaixo. Se ficar apertado, gire o celular.
              </p>
            </div>
            <SignaturePad onChange={setSignatureBlob} />
            <button
              type="button"
              onClick={handleSubmit}
              disabled={submitting || !selfieBlob || !signatureBlob}
              className={PRIMARY_BUTTON}
            >
              {submitting ? 'Assinando…' : 'Confirmar assinatura'}
            </button>
          </div>
        )}
      </div>
    </PageShell>
  )
}
