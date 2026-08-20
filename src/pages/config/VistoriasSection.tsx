import type { ConfigPayload } from '../../lib/config'

interface VistoriasSectionProps {
  value: ConfigPayload
  onChange: (patch: Partial<ConfigPayload>) => void
}

export function VistoriasSection({ value, onChange }: VistoriasSectionProps) {
  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2.5">
        <input
          type="checkbox"
          checked={Boolean(value.vehicle_inspection_detailed_required)}
          onChange={(event) => onChange({ vehicle_inspection_detailed_required: event.target.checked })}
          className="h-4 w-4 accent-[var(--blue-500)]"
        />
        <span className="text-[13.5px] font-semibold text-[var(--ink)]">Exigir checklist detalhado nas vistorias</span>
      </label>
    </div>
  )
}
