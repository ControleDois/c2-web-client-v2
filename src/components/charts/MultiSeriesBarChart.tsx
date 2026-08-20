import { useRef, useState, type MouseEvent } from 'react'

interface Series {
  name: string
  color: string
  data: number[]
}

interface MultiSeriesBarChartProps {
  labels: string[]
  series: Series[]
  formatValue?: (value: number) => string
}

export function MultiSeriesBarChart({ labels, series, formatValue = (value) => String(value) }: MultiSeriesBarChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  if (labels.length === 0) {
    return <p className="py-10 text-center text-[13px] text-[var(--muted)]">Sem dados no período.</p>
  }

  const max = Math.max(...series.flatMap((s) => s.data), 1)
  const height = 200
  const unit = 46
  const barGap = 2
  const barWidth = (unit - barGap * (series.length + 1)) / series.length
  const labelStep = Math.ceil(labels.length / 10) || 1

  function handleMove(event: MouseEvent) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return
    const relativeX = event.clientX - rect.left
    const index = Math.min(labels.length - 1, Math.max(0, Math.floor((relativeX / rect.width) * labels.length)))
    setHoverIndex(index)
  }

  const tooltipLeftPercent = hoverIndex !== null ? ((hoverIndex + 0.5) / labels.length) * 100 : 0
  const tooltipAlign = tooltipLeftPercent < 15 ? 'left' : tooltipLeftPercent > 85 ? 'right' : 'center'

  return (
    <div>
      <div className="mb-3 flex flex-wrap items-center gap-4">
        {series.map((s) => (
          <div key={s.name} className="flex items-center gap-1.5 text-[11.5px] font-semibold text-[var(--ink-soft)]">
            <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: s.color }} />
            {s.name}
          </div>
        ))}
      </div>

      <div ref={containerRef} className="relative pt-14" onMouseMove={handleMove} onMouseLeave={() => setHoverIndex(null)}>
        {hoverIndex !== null && (
          <div
            className="pointer-events-none absolute top-0 z-10 whitespace-nowrap rounded-lg bg-[var(--ink)] px-3 py-2 text-[11.5px] font-semibold text-white shadow-lg"
            style={{
              left: `${tooltipLeftPercent}%`,
              transform: `translate(${tooltipAlign === 'center' ? '-50%' : tooltipAlign === 'left' ? '0' : '-100%'}, 0)`,
            }}
          >
            <p className="mb-1 text-[10px] font-normal opacity-70">{labels[hoverIndex]}</p>
            {series.map((s) => (
              <div key={s.name} className="flex items-center gap-1.5">
                <span className="h-2 w-2 rounded-sm" style={{ backgroundColor: s.color }} />
                <span className="font-normal opacity-80">{s.name}:</span> {formatValue(s.data[hoverIndex] ?? 0)}
              </div>
            ))}
          </div>
        )}

        <svg viewBox={`0 0 ${labels.length * unit} ${height}`} preserveAspectRatio="none" className="w-full" style={{ height }}>
          <line x1="0" y1={height - 0.5} x2={labels.length * unit} y2={height - 0.5} stroke="var(--border)" strokeWidth="1" />
          {hoverIndex !== null && (
            <rect x={hoverIndex * unit} y={0} width={unit} height={height} fill="var(--blue-100)" opacity={0.4} />
          )}
          {labels.map((label, labelIndex) =>
            series.map((s, seriesIndex) => {
              const value = s.data[labelIndex] ?? 0
              const barHeight = Math.max((Math.abs(value) / max) * (height - 14), value === 0 ? 0 : 2)
              const x = labelIndex * unit + barGap + seriesIndex * (barWidth + barGap)
              return (
                <rect
                  key={`${label}-${s.name}`}
                  x={x}
                  y={height - barHeight}
                  width={barWidth}
                  height={barHeight}
                  rx={2}
                  fill={s.color}
                />
              )
            })
          )}
        </svg>

        <div className="mt-2 flex justify-between text-[10px] text-[var(--muted)] print:text-[7.5px]">
          {labels
            .filter((_, index) => index % labelStep === 0)
            .map((label, index) => (
              <span key={`${label}-${index}`} className="whitespace-nowrap">
                {label}
              </span>
            ))}
        </div>
      </div>
    </div>
  )
}
