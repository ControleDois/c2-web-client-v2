import { useEffect, useRef, useState, type ReactNode } from 'react'
import { MoreVerticalIcon } from './icons'

export interface RowAction {
  key: string
  label: string
  icon: ReactNode
  onClick: () => void
  tone?: 'default' | 'danger' | 'warning'
  dividerBefore?: boolean
}

interface RowActionsMenuProps {
  actions: RowAction[]
}

const MENU_WIDTH = 232

export function RowActionsMenu({ actions }: RowActionsMenuProps) {
  const [open, setOpen] = useState(false)
  const [position, setPosition] = useState({ top: 0, left: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return
      setOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [open])

  function toggle() {
    if (!open && buttonRef.current) {
      const rect = buttonRef.current.getBoundingClientRect()
      setPosition({
        top: rect.bottom + 6,
        left: Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)),
      })
    }
    setOpen((current) => !current)
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggle}
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
        aria-label="Mais ações"
      >
        <MoreVerticalIcon className="h-4 w-4" />
      </button>
      {open && (
        <div
          ref={menuRef}
          style={{ position: 'fixed', top: position.top, left: position.left, width: MENU_WIDTH }}
          className="z-50 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1.5 shadow-[var(--card-shadow)]"
        >
          {actions.map((action) => (
            <div key={action.key}>
              {action.dividerBefore && <div className="my-1.5 border-t border-[var(--border)]" />}
              <button
                type="button"
                onClick={() => {
                  setOpen(false)
                  action.onClick()
                }}
                className={`flex w-full items-center gap-2.5 px-3.5 py-2 text-left text-[13px] font-semibold transition hover:bg-[var(--page)] ${
                  action.tone === 'danger'
                    ? 'text-[var(--red-500)]'
                    : action.tone === 'warning'
                      ? 'text-[var(--amber-500)]'
                      : 'text-[var(--ink)]'
                }`}
              >
                <span className="h-4 w-4 flex-none">{action.icon}</span>
                {action.label}
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
