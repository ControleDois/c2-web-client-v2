import { useEffect, useMemo, useRef, useState } from 'react'
import type { AuthSession } from '../lib/auth'
import { ApiError } from '../lib/api'
import { formatCurrency } from '../lib/format'
import { fetchFinancialGoalSummary, type FinancialGoalSummary } from '../lib/financialGoals'
import { ChevronLeftIcon, ChevronRightIcon } from '../components/icons'

interface FinancialGoalsPageProps {
  session: AuthSession
}

// Entradas x saídas: azul e âmbar do tema, validados para daltonismo e contraste (claro e escuro).
const IN_COLOR = 'var(--blue-500)'
const OUT_COLOR = 'var(--amber-500)'

const MONTHS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
const MONTHS_SHORT = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun', 'jul', 'ago', 'set', 'out', 'nov', 'dez']

// Largura real do contêiner: o SVG desenha em pixels de verdade (texto não cresce com a tela).
function useWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(fallback)
  useEffect(() => {
    const element = ref.current
    if (!element) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(280, Math.round(entry.contentRect.width))))
    observer.observe(element)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

function currentMonth() {
  const now = new Date()
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
}

function shiftMonth(month: string, delta: number) {
  const [year, m] = month.split('-').map(Number)
  const date = new Date(year, m - 1 + delta, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function monthLabel(month: string, short = false) {
  const [year, m] = month.split('-').map(Number)
  if (short) return `${MONTHS_SHORT[m - 1]}/${String(year).slice(2)}`
  const name = MONTHS[m - 1]
  return `${name[0].toUpperCase()}${name.slice(1)} de ${year}`
}

function compactMoney(value: number) {
  if (Math.abs(value) >= 1000) return `R$ ${(value / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} mil`
  return `R$ ${Math.round(value)}`
}

// Divisões "redondas" para o eixo do valor (0, 2 mil, 4 mil…).
function niceTicks(max: number, count = 4) {
  if (max <= 0) return [0, 1]
  const raw = max / count
  const power = 10 ** Math.floor(Math.log10(raw))
  const step = [1, 2, 2.5, 5, 10].map((f) => f * power).find((candidate) => candidate >= raw) ?? raw
  const ticks: number[] = []
  for (let value = 0; value <= max + step * 0.001; value += step) ticks.push(value)
  if (ticks[ticks.length - 1] < max) ticks.push(ticks[ticks.length - 1] + step)
  return ticks
}

function Tile({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: string }) {
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3">
      <p className="text-[11.5px] font-semibold text-[var(--muted)]">{label}</p>
      <p className="mt-0.5 text-[18px] font-bold tracking-tight" style={{ color: tone ?? 'var(--ink)' }}>
        {value}
      </p>
      {hint && <p className="mt-0.5 text-[12px] text-[var(--ink-soft)]">{hint}</p>}
    </div>
  )
}

function Legend({ items }: { items: { label: string; color: string; dashed?: boolean }[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-[var(--ink-soft)]">
      {items.map((item) => (
        <span key={item.label} className="flex items-center gap-1.5">
          <svg width="18" height="8" aria-hidden="true">
            <line x1="1" y1="4" x2="17" y2="4" stroke={item.color} strokeWidth="2.5" strokeLinecap="round" strokeDasharray={item.dashed ? '3 3' : undefined} />
          </svg>
          {item.label}
        </span>
      ))}
    </div>
  )
}

// Barra da meta: recebido + a receber contra o total a pagar do mês.
function GoalBar({ summary }: { summary: FinancialGoalSummary }) {
  const scale = Math.max(summary.goal, summary.forecast, 1)
  const receivedPct = (summary.received.total / scale) * 100
  const pendingPct = (summary.receivable.pending.total / scale) * 100
  const goalPct = (summary.goal / scale) * 100
  const covered = summary.goal > 0 ? Math.min(100, (summary.forecast / summary.goal) * 100) : 100
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[12px] font-semibold text-[var(--muted)]">Meta do mês: pagar todas as contas</p>
          <p className="mt-0.5 text-[26px] font-bold tracking-tight text-[var(--ink)]">{formatCurrency(summary.goal)}</p>
          <p className="text-[12.5px] text-[var(--ink-soft)]">
            {summary.payable.total.count} {summary.payable.total.count === 1 ? 'conta vence' : 'contas vencem'} no mês ·{' '}
            {formatCurrency(summary.payable.paid.total)} já pago
          </p>
        </div>
        <div className="text-right">
          {summary.gap > 0 ? (
            <>
              <p className="text-[12px] font-semibold text-[var(--muted)]">Falta vender/receber</p>
              <p className="text-[22px] font-bold tracking-tight text-[var(--red-500)]">{formatCurrency(summary.gap)}</p>
              <p className="text-[12px] text-[var(--ink-soft)]">além do que já está previsto</p>
            </>
          ) : (
            <>
              <p className="text-[12px] font-semibold text-[var(--muted)]">Meta coberta</p>
              <p className="text-[22px] font-bold tracking-tight text-[var(--green-600)]">
                + {formatCurrency(summary.forecast - summary.goal)}
              </p>
              <p className="text-[12px] text-[var(--ink-soft)]">sobra prevista no mês</p>
            </>
          )}
        </div>
      </div>

      <div className="relative mt-4 h-4 overflow-hidden rounded-full bg-[var(--page)]" role="img" aria-label={`Previsto cobre ${Math.round(covered)}% da meta`}>
        <div className="absolute inset-y-0 left-0 flex gap-[2px]" style={{ width: `${Math.min(100, receivedPct + pendingPct)}%` }}>
          {receivedPct > 0 && <div className="h-full rounded-l-full" style={{ width: `${(receivedPct / (receivedPct + pendingPct)) * 100}%`, background: IN_COLOR }} />}
          {pendingPct > 0 && (
            <div className="h-full rounded-r-full" style={{ flex: 1, background: IN_COLOR, opacity: 0.4 }} />
          )}
        </div>
        <div className="absolute inset-y-0 w-[3px] rounded-full bg-[var(--ink)]" style={{ left: `calc(${Math.min(goalPct, 99.5)}% - 3px)` }} title="Meta" />
      </div>
      <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-[var(--ink-soft)]">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: IN_COLOR }} /> Recebido {formatCurrency(summary.received.total)}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ background: IN_COLOR, opacity: 0.4 }} /> A receber {formatCurrency(summary.receivable.pending.total)}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-[2px] bg-[var(--ink)]" /> Meta {formatCurrency(summary.goal)}
        </span>
        <span className="ml-auto font-semibold text-[var(--ink)]">Previsto cobre {Math.round(covered)}% da meta</span>
      </div>
    </div>
  )
}

const CHART_H = 220
const PAD = { top: 16, right: 16, bottom: 26, left: 56 }

// Acumulado do mês: entradas (recebido + previsto) x contas a pagar, dia a dia.
function MonthChart({ summary }: { summary: FinancialGoalSummary }) {
  const [wrapRef, CHART_W] = useWidth<HTMLDivElement>(720)
  const [hover, setHover] = useState<number | null>(null)
  const points = useMemo(() => {
    let inSum = 0
    let outSum = 0
    return summary.daily.map((day) => {
      inSum += day.received + day.expected
      outSum += day.payable
      return { ...day, inSum, outSum }
    })
  }, [summary.daily])
  const max = Math.max(...points.map((point) => Math.max(point.inSum, point.outSum)), 1)
  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1]
  const innerW = CHART_W - PAD.left - PAD.right
  const innerH = CHART_H - PAD.top - PAD.bottom
  const x = (index: number) => PAD.left + (points.length > 1 ? (index / (points.length - 1)) * innerW : innerW / 2)
  const y = (value: number) => PAD.top + innerH - (value / top) * innerH
  const path = (key: 'inSum' | 'outSum') => points.map((point, index) => `${index ? 'L' : 'M'}${x(index).toFixed(1)},${y(point[key]).toFixed(1)}`).join(' ')
  const todayIndex = points.findIndex((point) => point.day === summary.today)
  const last = points[points.length - 1]

  function handleMove(event: React.MouseEvent<SVGRectElement>) {
    const box = (event.currentTarget.ownerSVGElement as SVGSVGElement).getBoundingClientRect()
    const relative = ((event.clientX - box.left) / box.width) * CHART_W
    const index = Math.round(((relative - PAD.left) / innerW) * (points.length - 1))
    setHover(Math.max(0, Math.min(points.length - 1, index)))
  }

  const hovered = hover !== null ? points[hover] : null
  const tooltipLeft = hover !== null ? (x(hover) / CHART_W) * 100 : 0

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[14px] font-bold text-[var(--ink)]">Acumulado do mês</p>
          <p className="text-[12px] text-[var(--muted)]">Enquanto a linha azul estiver abaixo da âmbar, o caixa previsto não cobre as contas até aquele dia</p>
        </div>
        <Legend items={[{ label: 'Entradas (recebido + a receber)', color: IN_COLOR }, { label: 'Contas a pagar', color: OUT_COLOR }]} />
      </div>
      <div ref={wrapRef} className="relative mt-3">
        <svg width={CHART_W} height={CHART_H} viewBox={`0 0 ${CHART_W} ${CHART_H}`} className="block" role="img" aria-label="Entradas e contas a pagar acumuladas no mês">
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={PAD.left} x2={CHART_W - PAD.right} y1={y(tick)} y2={y(tick)} stroke="var(--border)" strokeWidth="1" />
              <text x={PAD.left - 8} y={y(tick) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
                {compactMoney(tick)}
              </text>
            </g>
          ))}
          {points.map((point, index) =>
            (index % (CHART_W < 520 ? 7 : 5) === 0 && points.length - 1 - index >= (CHART_W < 520 ? 4 : 3)) || index === points.length - 1 ? (
              <text key={point.day} x={x(index)} y={CHART_H - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">
                {Number(point.day.slice(8))}
              </text>
            ) : null
          )}
          {todayIndex >= 0 && (
            <g>
              <line x1={x(todayIndex)} x2={x(todayIndex)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--muted)" strokeDasharray="3 4" strokeWidth="1" />
              <text x={x(todayIndex) + 4} y={PAD.top + 10} fontSize="11" fill="var(--muted)">
                hoje
              </text>
            </g>
          )}
          <path d={path('outSum')} fill="none" stroke={OUT_COLOR} strokeWidth="2" strokeLinejoin="round" />
          <path d={path('inSum')} fill="none" stroke={IN_COLOR} strokeWidth="2" strokeLinejoin="round" />
          {last && (
            <>
              <circle cx={x(points.length - 1)} cy={y(last.outSum)} r="4" fill={OUT_COLOR} stroke="var(--surface)" strokeWidth="2" />
              <circle cx={x(points.length - 1)} cy={y(last.inSum)} r="4" fill={IN_COLOR} stroke="var(--surface)" strokeWidth="2" />
            </>
          )}
          {hovered && hover !== null && (
            <g pointerEvents="none">
              <line x1={x(hover)} x2={x(hover)} y1={PAD.top} y2={PAD.top + innerH} stroke="var(--ink-soft)" strokeWidth="1" />
              <circle cx={x(hover)} cy={y(hovered.outSum)} r="4.5" fill={OUT_COLOR} stroke="var(--surface)" strokeWidth="2" />
              <circle cx={x(hover)} cy={y(hovered.inSum)} r="4.5" fill={IN_COLOR} stroke="var(--surface)" strokeWidth="2" />
            </g>
          )}
          <rect
            x={PAD.left}
            y={PAD.top}
            width={innerW}
            height={innerH}
            fill="transparent"
            onMouseMove={handleMove}
            onMouseLeave={() => setHover(null)}
          />
        </svg>
        {hovered && (
          <div
            className="pointer-events-none absolute top-2 z-10 w-56 -translate-x-1/2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-[12px] shadow-lg"
            style={{ left: `clamp(7rem, ${tooltipLeft}%, calc(100% - 7rem))` }}
          >
            <p className="font-bold text-[var(--ink)]">Dia {Number(hovered.day.slice(8))}</p>
            <p className="mt-1 flex justify-between text-[var(--ink-soft)]">
              <span>Entradas acumuladas</span>
              <span className="font-semibold text-[var(--ink)]">{formatCurrency(hovered.inSum)}</span>
            </p>
            <p className="flex justify-between text-[var(--ink-soft)]">
              <span>Contas acumuladas</span>
              <span className="font-semibold text-[var(--ink)]">{formatCurrency(hovered.outSum)}</span>
            </p>
            {(hovered.received > 0 || hovered.expected > 0 || hovered.payable > 0) && (
              <p className="mt-1 border-t border-[var(--border)] pt-1 text-[var(--muted)]">
                No dia: {hovered.received > 0 ? `recebido ${formatCurrency(hovered.received)} · ` : ''}
                {hovered.expected > 0 ? `a receber ${formatCurrency(hovered.expected)} · ` : ''}
                {hovered.payable > 0 ? `a pagar ${formatCurrency(hovered.payable)}` : ''}
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// Últimos 6 meses: o que de fato entrou e saiu do caixa.
function HistoryChart({ summary }: { summary: FinancialGoalSummary }) {
  const [wrapRef, W] = useWidth<HTMLDivElement>(520)
  const [hover, setHover] = useState<number | null>(null)
  const H = 220
  const pad = { top: 12, right: 12, bottom: 26, left: 56 }
  const max = Math.max(...summary.history.map((item) => Math.max(item.received, item.paid)), 1)
  const ticks = niceTicks(max)
  const top = ticks[ticks.length - 1]
  const innerW = W - pad.left - pad.right
  const innerH = H - pad.top - pad.bottom
  const group = innerW / summary.history.length
  const barW = Math.min(28, group * 0.3)
  const y = (value: number) => pad.top + innerH - (value / top) * innerH
  const hovered = hover !== null ? summary.history[hover] : null

  // Barra com o topo arredondado e a base reta, presa no eixo.
  const bar = (x0: number, value: number, color: string) => {
    const h = innerH - (y(value) - pad.top)
    if (h <= 0) return null
    const r = Math.min(4, h, barW / 2)
    const yTop = y(value)
    const yBase = pad.top + innerH
    return (
      <path
        d={`M${x0},${yBase} V${yTop + r} Q${x0},${yTop} ${x0 + r},${yTop} H${x0 + barW - r} Q${x0 + barW},${yTop} ${x0 + barW},${yTop + r} V${yBase} Z`}
        fill={color}
      />
    )
  }

  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-[14px] font-bold text-[var(--ink)]">Últimos 6 meses</p>
          <p className="text-[12px] text-[var(--muted)]">O que realmente entrou e saiu do caixa em cada mês</p>
        </div>
        <Legend items={[{ label: 'Recebido', color: IN_COLOR }, { label: 'Pago', color: OUT_COLOR }]} />
      </div>
      <div ref={wrapRef} className="relative mt-3">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="block" role="img" aria-label="Recebido e pago nos últimos 6 meses">
          {ticks.map((tick) => (
            <g key={tick}>
              <line x1={pad.left} x2={W - pad.right} y1={y(tick)} y2={y(tick)} stroke="var(--border)" strokeWidth="1" />
              <text x={pad.left - 8} y={y(tick) + 4} textAnchor="end" fontSize="11" fill="var(--muted)">
                {compactMoney(tick)}
              </text>
            </g>
          ))}
          {summary.history.map((item, index) => {
            const center = pad.left + group * index + group / 2
            return (
              <g key={item.month}>
                {hover === index && <rect x={pad.left + group * index + 4} y={pad.top} width={group - 8} height={innerH} rx="6" fill="var(--page)" />}
                {bar(center - barW - 1, item.received, IN_COLOR)}
                {bar(center + 1, item.paid, OUT_COLOR)}
                <text x={center} y={H - 8} textAnchor="middle" fontSize="11" fill="var(--muted)">
                  {monthLabel(item.month, true)}
                </text>
                <rect
                  x={pad.left + group * index}
                  y={pad.top}
                  width={group}
                  height={innerH + pad.bottom}
                  fill="transparent"
                  onMouseEnter={() => setHover(index)}
                  onMouseLeave={() => setHover(null)}
                />
              </g>
            )
          })}
        </svg>
        {hovered && hover !== null && (
          <div
            className="pointer-events-none absolute top-2 z-10 w-52 -translate-x-1/2 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 text-[12px] shadow-lg"
            style={{ left: `clamp(6.5rem, ${((pad.left + group * hover + group / 2) / W) * 100}%, calc(100% - 6.5rem))` }}
          >
            <p className="font-bold text-[var(--ink)]">{monthLabel(hovered.month)}</p>
            <p className="mt-1 flex justify-between text-[var(--ink-soft)]">
              <span>Recebido</span>
              <span className="font-semibold text-[var(--ink)]">{formatCurrency(hovered.received)}</span>
            </p>
            <p className="flex justify-between text-[var(--ink-soft)]">
              <span>Pago</span>
              <span className="font-semibold text-[var(--ink)]">{formatCurrency(hovered.paid)}</span>
            </p>
            <p className="mt-1 flex justify-between border-t border-[var(--border)] pt-1 text-[var(--ink-soft)]">
              <span>Saldo</span>
              <span className="font-semibold text-[var(--ink)]">{formatCurrency(hovered.received - hovered.paid)}</span>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}

export function FinancialGoalsPage({ session }: FinancialGoalsPageProps) {
  const [month, setMonth] = useState(currentMonth)
  const [summary, setSummary] = useState<FinancialGoalSummary | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    fetchFinancialGoalSummary(session.token.token, month)
      .then(setSummary)
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível carregar as metas.'))
      .finally(() => setLoading(false))
  }, [session.token.token, month])

  return (
    <div className="flex flex-col gap-5 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Matriz</p>
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Metas financeiras</h1>
        </div>
        <div className="flex items-center gap-1 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-1">
          <button type="button" onClick={() => setMonth((current) => shiftMonth(current, -1))} aria-label="Mês anterior" className="rounded-lg p-1.5 text-[var(--ink-soft)] hover:bg-[var(--page)]">
            <ChevronLeftIcon className="h-4 w-4" />
          </button>
          <span className="w-36 text-center text-[13px] font-bold text-[var(--ink)]">{monthLabel(month)}</span>
          <button type="button" onClick={() => setMonth((current) => shiftMonth(current, 1))} aria-label="Próximo mês" className="rounded-lg p-1.5 text-[var(--ink-soft)] hover:bg-[var(--page)]">
            <ChevronRightIcon className="h-4 w-4" />
          </button>
          {month !== currentMonth() && (
            <button type="button" onClick={() => setMonth(currentMonth())} className="rounded-lg px-2.5 py-1 text-[12px] font-semibold text-[var(--blue-700)] hover:bg-[var(--page)]">
              Hoje
            </button>
          )}
        </div>
      </div>

      {error && <div className="rounded-2xl bg-[var(--red-100)] p-4 text-[13.5px] font-medium text-[var(--red-500)]">{error}</div>}

      {loading && !summary ? (
        <div className="flex flex-col gap-4">
          {[120, 80, 260].map((height) => (
            <div key={height} className="animate-pulse rounded-2xl bg-[var(--surface)]" style={{ height }} />
          ))}
        </div>
      ) : summary ? (
        <div className={`flex flex-col gap-5 transition-opacity ${loading ? 'opacity-60' : ''}`}>
          <GoalBar summary={summary} />
          <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
            <Tile
              label="Falta pagar no mês"
              value={formatCurrency(summary.payable.pending.total)}
              hint={`${summary.payable.pending.count} de ${summary.payable.total.count} contas em aberto`}
            />
            <Tile label="Recebido no mês" value={formatCurrency(summary.received.total)} hint={`${summary.received.count} recebimentos`} />
            <Tile
              label="A receber no mês"
              value={formatCurrency(summary.receivable.pending.total)}
              hint={
                summary.receivable.overdueInMonth.total > 0
                  ? `${formatCurrency(summary.receivable.overdueInMonth.total)} já vencido`
                  : `${summary.receivable.pending.count} contas a receber`
              }
            />
            <Tile
              label="Atrasados de meses anteriores"
              value={formatCurrency(summary.receivable.overdueBefore.total)}
              hint={summary.receivable.overdueBefore.count ? `${summary.receivable.overdueBefore.count} contas para cobrar` : 'Nada atrasado'}
              tone={summary.receivable.overdueBefore.total > 0 ? 'var(--red-500)' : undefined}
            />
          </div>
          <div className="grid gap-5 xl:grid-cols-5">
            <div className="min-w-0 xl:col-span-3">
              <MonthChart summary={summary} />
            </div>
            <div className="min-w-0 xl:col-span-2">
              <HistoryChart summary={summary} />
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}
