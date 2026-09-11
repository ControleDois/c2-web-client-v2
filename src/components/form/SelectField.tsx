import type { ReactNode } from 'react'
import { Select } from './Select'

interface SelectFieldProps {
  label: string
  value: string | number
  // Mantém o formato de evento de um <select> nativo (event.target.value)
  // pra não precisar tocar em nenhum dos ~25 lugares que já usam este
  // componente — só o popup de opções por baixo dos panos mudou.
  onChange: (event: { target: { value: string } }) => void
  children: ReactNode
  disabled?: boolean
  variant?: 'page' | 'surface'
  className?: string
}

export function SelectField({
  label,
  value,
  onChange,
  children,
  disabled,
  variant = 'page',
  className,
}: SelectFieldProps) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-[12px] font-semibold text-[var(--ink-soft)]">{label}</span>
      <Select
        value={value}
        onChange={(newValue) => onChange({ target: { value: newValue } })}
        disabled={disabled}
        variant={variant}
        className={className}
      >
        {children}
      </Select>
    </label>
  )
}
