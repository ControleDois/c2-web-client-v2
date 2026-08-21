import { useEffect, useRef, useState, type ReactNode } from 'react'
import { SearchIcon } from '../icons'

interface SearchSelectFieldProps<T> {
  label: string
  placeholder: string
  selectedLabel: string | null
  selectedSubLabel?: string | null
  onSearch: (query: string) => Promise<T[]>
  getOptionLabel: (item: T) => string
  getOptionSubLabel?: (item: T) => string | undefined
  onSelect: (item: T) => void
  onClear: () => void
  action?: ReactNode
  variant?: 'page' | 'surface'
}

export function SearchSelectField<T>({
  label,
  placeholder,
  selectedLabel,
  selectedSubLabel,
  onSearch,
  getOptionLabel,
  getOptionSubLabel,
  onSelect,
  onClear,
  action,
  variant = 'page',
}: SearchSelectFieldProps<T>) {
  const [query, setQuery] = useState('')
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [results, setResults] = useState<T[]>([])
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    let cancelled = false
    setLoading(true)

    const timeout = setTimeout(() => {
      onSearch(query)
        .then((items) => {
          if (!cancelled) setResults(items)
        })
        .finally(() => {
          if (!cancelled) setLoading(false)
        })
    }, 250)

    return () => {
      cancelled = true
      clearTimeout(timeout)
    }
  }, [query, open, onSearch])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  return (
    <div ref={containerRef} className="relative flex flex-col gap-1.5">
      {(label || action) && (
        <div className="flex items-center justify-between">
          <span className="text-[12px] font-semibold text-[var(--ink-soft)]">{label}</span>
          {action}
        </div>
      )}

      {selectedLabel ? (
        <div className="flex items-center gap-2 rounded-xl bg-[var(--blue-100)] px-3.5 py-2.5">
          <span className="min-w-0 flex-1">
            <span className="block truncate text-[14px] font-semibold text-[var(--blue-700)]">{selectedLabel}</span>
            {selectedSubLabel && (
              <span className="block truncate text-[12px] text-[var(--blue-700)] opacity-75">{selectedSubLabel}</span>
            )}
          </span>
          <button
            type="button"
            onClick={onClear}
            className="flex-none text-[12px] font-semibold text-[var(--blue-700)] hover:underline"
          >
            Trocar
          </button>
        </div>
      ) : (
        <div
          className={`flex items-center gap-2 rounded-xl px-3.5 py-2.5 ring-1 ring-transparent transition focus-within:ring-[var(--blue-300)] ${
            variant === 'surface' ? 'border border-[var(--border)] bg-[var(--surface)]' : 'bg-[var(--page)]'
          }`}
        >
          <SearchIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
          <input
            type="text"
            placeholder={placeholder}
            value={query}
            onFocus={() => setOpen(true)}
            onChange={(event) => {
              setQuery(event.target.value)
              setOpen(true)
            }}
            className="w-full bg-transparent text-[14px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
          />
        </div>
      )}

      {open && !selectedLabel && (
        <div className="absolute top-full z-10 mt-1 w-full overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--card-shadow)]">
          {loading ? (
            <p className="px-3.5 py-3 text-[12.5px] text-[var(--muted)]">Buscando…</p>
          ) : results.length === 0 ? (
            <p className="px-3.5 py-3 text-[12.5px] text-[var(--muted)]">Nenhum resultado.</p>
          ) : (
            <ul className="max-h-56 overflow-y-auto">
              {results.map((item, index) => (
                <li key={index}>
                  <button
                    type="button"
                    onClick={() => {
                      onSelect(item)
                      setOpen(false)
                      setQuery('')
                    }}
                    className="flex w-full flex-col items-start px-3.5 py-2.5 text-left hover:bg-[var(--page)]"
                  >
                    <span className="text-[13.5px] font-semibold text-[var(--ink)]">{getOptionLabel(item)}</span>
                    {getOptionSubLabel?.(item) && (
                      <span className="text-[12px] text-[var(--muted)]">{getOptionSubLabel(item)}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
