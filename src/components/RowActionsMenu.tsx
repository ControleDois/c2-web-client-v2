import { useEffect, useRef, useState, type ReactNode } from 'react'
import { MoreVerticalIcon } from './icons'
import { PopupPanel } from './PopupPanel'

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
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      if (menuRef.current?.contains(target) || buttonRef.current?.contains(target)) return
      setOpen(false)
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
    <>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((current) => !current)}
        className="inline-flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
        aria-label="Mais ações"
      >
        <MoreVerticalIcon className="h-4 w-4" />
      </button>
      {open && (
        <PopupPanel anchorRef={buttonRef} panelRef={menuRef} align="right" width={MENU_WIDTH} maxHeight={520} className="py-1.5">
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
        </PopupPanel>
      )}
    </>
  )
}
