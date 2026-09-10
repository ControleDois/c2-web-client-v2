import { ChevronDownIcon } from './icons'

interface SortableThProps<F extends string> {
  label: string
  field: F
  align?: 'right'
  className?: string
  activeField: F
  direction: 'asc' | 'desc'
  onSort: (field: F) => void
}

export function SortableTh<F extends string>({
  label,
  field,
  align,
  className,
  activeField,
  direction,
  onSort,
}: SortableThProps<F>) {
  const isActive = activeField === field
  return (
    <th className={className}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={`flex items-center gap-1 hover:text-[var(--ink)] ${align === 'right' ? 'ml-auto flex-row-reverse' : ''}`}
      >
        {label}
        <ChevronDownIcon
          className={`h-3 w-3 flex-none transition-transform ${isActive ? 'text-[var(--ink)]' : 'opacity-30'} ${
            isActive && direction === 'asc' ? 'rotate-180' : ''
          }`}
        />
      </button>
    </th>
  )
}
