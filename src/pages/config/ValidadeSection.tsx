import type { ConfigPayload } from '../../lib/config'

interface ValidadeSectionProps {
  value: ConfigPayload
  onChange: (patch: Partial<ConfigPayload>) => void
  onOpenLabels: () => void
}

const SIZES = [
  { w: 60, h: 40, label: '60 × 40 mm' },
  { w: 50, h: 30, label: '50 × 30 mm' },
  { w: 40, h: 25, label: '40 × 25 mm' },
  { w: 100, h: 50, label: '100 × 50 mm' },
]

// Controle de validade de produtos abertos: cada produto informa quanto tempo dura depois de
// aberto e a tela "Etiquetas de validade" imprime a etiqueta com a abertura e o vencimento.
export function ValidadeSection({ value, onChange, onOpenLabels }: ValidadeSectionProps) {
  const enabled = Boolean(value.shelf_life_enabled)
  const width = value.shelf_label_width_mm ?? 60
  const height = value.shelf_label_height_mm ?? 40
  const preset = SIZES.find((size) => size.w === width && size.h === height)

  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-start gap-2.5">
        <input
          type="checkbox"
          checked={enabled}
          onChange={(event) => onChange({ shelf_life_enabled: event.target.checked })}
          className="mt-0.5 h-4 w-4 accent-[var(--blue-500)]"
        />
        <span>
          <span className="block text-[13.5px] font-semibold text-[var(--ink)]">Ativar controle de validade de produtos abertos</span>
          <span className="block text-[12.5px] text-[var(--muted)]">
            No cadastro do produto aparece a validade depois de aberto (ex.: molho de tomate, 2 dias). Na tela “Etiquetas de
            validade” você escolhe o que abriu e imprime a etiqueta com a data de abertura e a data de vencimento.
          </span>
        </span>
      </label>

      {enabled && (
        <div className="flex flex-col gap-3 rounded-xl border border-[var(--border)] p-4">
          <p className="text-[13px] font-semibold text-[var(--ink)]">Tamanho da etiqueta</p>
          <div className="flex flex-wrap gap-2">
            {SIZES.map((size) => (
              <button
                key={size.label}
                type="button"
                onClick={() => onChange({ shelf_label_width_mm: size.w, shelf_label_height_mm: size.h })}
                className={`rounded-lg px-3 py-1.5 text-[12.5px] font-semibold ring-1 ${
                  preset === size ? 'bg-[var(--blue-500)] text-white ring-[var(--blue-500)]' : 'text-[var(--ink-soft)] ring-[var(--border)]'
                }`}
              >
                {size.label}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap items-end gap-3">
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Largura (mm)</span>
              <input
                type="number"
                min={20}
                max={120}
                value={width}
                onChange={(event) => onChange({ shelf_label_width_mm: Number(event.target.value) || 60 })}
                className="w-28 rounded-xl bg-[var(--page)] px-3 py-2 text-[14px] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--blue-300)]"
              />
            </label>
            <label className="flex flex-col gap-1">
              <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Altura (mm)</span>
              <input
                type="number"
                min={15}
                max={120}
                value={height}
                onChange={(event) => onChange({ shelf_label_height_mm: Number(event.target.value) || 40 })}
                className="w-28 rounded-xl bg-[var(--page)] px-3 py-2 text-[14px] text-[var(--ink)] focus:outline-none focus:ring-2 focus:ring-[var(--blue-300)]"
              />
            </label>
          </div>
          <p className="text-[12px] text-[var(--muted)]">
            Use o tamanho da etiqueta da sua impressora (térmica de etiquetas). Na hora de imprimir, escolha essa impressora.
          </p>
          <button
            type="button"
            onClick={onOpenLabels}
            className="w-fit rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-[var(--blue-700)]"
          >
            Abrir etiquetas de validade →
          </button>
        </div>
      )}
    </div>
  )
}
