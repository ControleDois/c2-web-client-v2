import { useRef, useState, type MouseEvent } from 'react'

interface BarChartPoint {
  label: string
  value: number
}

interface BarChartProps {
  data: BarChartPoint[]
  formatValue?: (value: number) => string
}

export function BarChart({ data, formatValue = (value) => String(value) }: BarChartProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const [hoverIndex, setHoverIndex] = useState<number | null>(null)

  if (data.length === 0) {
    return <p className="py-10 text-center text-[13px] text-[var(--muted)]">Sem dados no período.</p>
  }

  const max = Math.max(...data.map((point) => point.value), 1)
  const height = 160
  const unit = 40
  const labelStep = Math.ceil(data.length / 8) || 1

  function handleMove(event: MouseEvent) {
    const rect = containerRef.current?.getBoundingClientRect()
    if (!rect || rect.width === 0) return
    const relativeX = event.clientX - rect.left
    const index = Math.min(data.length - 1, Math.max(0, Math.floor((relativeX / rect.width) * data.length)))
    setHoverIndex(index)
  }

  return (
    <div ref={containerRef} className="relative pt-9" onMouseMove={handleMove} onMouseLeave={() => setHoverIndex(null)}>
      {hoverIndex !== null && (
        <div
          className="pointer-events-none absolute top-0 z-10 -translate-x-1/2 whitespace-nowrap rounded-lg bg-[var(--ink)] px-2.5 py-1.5 text-[11.5px] font-semibold text-white shadow-lg"
          style={{ left: `${((hoverIndex + 0.5) / data.length) * 100}%` }}
        >
          <p className="text-[10px] font-normal opacity-70">{data[hoverIndex].label}</p>
          {formatValue(data[hoverIndex].value)}
        </div>
      )}

      <svg
        viewBox={`0 0 ${data.length * unit} ${height}`}
        preserveAspectRatio="none"
        className="w-full"
        style={{ height }}
      >
        <line
          x1="0"
          y1={height - 0.5}
          x2={data.length * unit}
          y2={height - 0.5}
          stroke="var(--border)"
          strokeWidth="1"
        />
        {hoverIndex !== null && (
          <rect x={hoverIndex * unit} y={0} width={unit} height={height} fill="var(--blue-100)" opacity={0.5} />
        )}
        {data.map((point, index) => {
          const barHeight = Math.max((point.value / max) * (height - 14), 2)
          const x = index * unit + unit * 0.2
          return (
            <rect
              key={`${point.label}-${index}`}
              x={x}
              y={height - barHeight}
              width={unit * 0.6}
              height={barHeight}
              rx={5}
              fill="var(--blue-500)"
              opacity={hoverIndex === null || hoverIndex === index ? 1 : 0.55}
            />
          )
        })}
      </svg>
      <div className="mt-2 flex justify-between text-[10px] text-[var(--muted)]">
        {data
          .filter((_, index) => index % labelStep === 0)
          .map((point, index) => (
            <span key={`${point.label}-${index}`} className="whitespace-nowrap">
              {point.label}
            </span>
          ))}
      </div>
    </div>
  )
}
