import { Children, isValidElement, useEffect, useRef, useState, type ReactNode } from 'react'
import { ChevronDownIcon } from '../icons'

interface SelectOption {
  value: string
  label: ReactNode
  disabled?: boolean
}

interface SelectProps {
  value: string | number
  onChange: (value: string) => void
  children: ReactNode
  disabled?: boolean
  className?: string
  variant?: 'page' | 'surface'
}

// O <select> nativo não dá pra estilizar de verdade — o popup de opções usa
// a renderização do sistema operacional (fonte, tamanho e cor genéricos),
// bem diferente do resto da interface. Este componente monta o próprio
// popup em HTML/CSS, então fica consistente em qualquer navegador/SO.
// Aceita <option> como children (mesmo formato de um select nativo) pra não
// precisar reescrever as listas de opções já existentes pelo sistema.
function parseOptions(children: ReactNode): SelectOption[] {
  const options: SelectOption[] = []
  Children.forEach(children, (child) => {
    if (!isValidElement<{ value?: unknown; disabled?: boolean; children?: ReactNode }>(child)) return
    options.push({
      value: String(child.props.value ?? ''),
      label: child.props.children,
      disabled: child.props.disabled,
    })
  })
  return options
}

export function Select({ value, onChange, children, disabled, className = '', variant = 'surface' }: SelectProps) {
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const options = parseOptions(children)
  const stringValue = String(value)
  const selected = options.find((option) => option.value === stringValue)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false)
    }
    function handleKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleKey)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleKey)
    }
  }, [open])

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={`flex w-full items-center gap-2 rounded-xl px-3.5 py-2.5 text-left text-[13.5px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)] disabled:cursor-not-allowed disabled:opacity-60 ${
          variant === 'surface' ? 'border border-[var(--border)] bg-[var(--surface)]' : 'bg-[var(--page)]'
        }`}
      >
        <span className="min-w-0 flex-1 truncate">{selected?.label ?? ''}</span>
        <ChevronDownIcon
          className={`h-3.5 w-3.5 flex-none text-[var(--muted)] transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {open && (
        <div className="absolute left-0 top-full z-20 mt-1 min-w-full w-max max-w-sm overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--card-shadow)]">
          <ul className="max-h-64 overflow-y-auto py-1.5">
            {options.map((option) => (
              <li key={option.value}>
                <button
                  type="button"
                  disabled={option.disabled}
                  onClick={() => {
                    onChange(option.value)
                    setOpen(false)
                  }}
                  className={`block w-full whitespace-normal px-3.5 py-2 text-left text-[13.5px] font-medium transition hover:bg-[var(--page)] disabled:cursor-not-allowed disabled:opacity-50 ${
                    option.value === stringValue ? 'text-[var(--blue-700)]' : 'text-[var(--ink)]'
                  }`}
                >
                  {option.label}
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  )
}
