import { useEffect, useRef, useState } from 'react'
import { getPersonName, getUserRoleName, type AuthSession } from '../../lib/auth'
import {
  fetchNotifications,
  fetchUnreadNotificationCount,
  markNotificationRead,
  type NotificationRecord,
} from '../../lib/notifications'
import { formatDateTime } from '../../lib/format'
import { ThemeToggle } from '../ThemeToggle'
import {
  BellIcon,
  ChevronDownIcon,
  UserIcon,
  BuildingIcon,
  BuildingsIcon,
  LogoutIcon,
  WhatsappIcon,
  FileTextIcon,
  ShieldIcon,
  LockIcon,
  ClockIcon,
  MenuIcon,
} from '../icons'

interface HeaderProps {
  session: AuthSession
  onNavigate: (
    page: 'users' | 'companies' | 'whatsapp-api' | 'contract-templates' | 'roles' | 'permissions' | 'company-groups' | 'audit-logs'
  ) => void
  onOpenMobileNav: () => void
  onLogout: () => void
}

const POLL_MS = 60000

export function Header({ session, onNavigate, onOpenMobileNav, onLogout }: HeaderProps) {
  const [unreadCount, setUnreadCount] = useState(0)
  const [notifOpen, setNotifOpen] = useState(false)
  const [notifications, setNotifications] = useState<NotificationRecord[]>([])
  const [notifLoading, setNotifLoading] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)

  const notifRef = useRef<HTMLDivElement>(null)
  const userRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let cancelled = false
    function loadCount() {
      fetchUnreadNotificationCount(session.token.token)
        .then((res) => {
          if (!cancelled) setUnreadCount(res.count)
        })
        .catch(() => {})
    }
    loadCount()
    const interval = setInterval(loadCount, POLL_MS)
    return () => {
      cancelled = true
      clearInterval(interval)
    }
  }, [session.token.token])

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      const target = event.target as Node
      if (notifRef.current && !notifRef.current.contains(target)) setNotifOpen(false)
      if (userRef.current && !userRef.current.contains(target)) setUserMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function toggleNotifications() {
    const opening = !notifOpen
    setNotifOpen(opening)
    setUserMenuOpen(false)
    if (opening) {
      setNotifLoading(true)
      fetchNotifications(session.token.token, { limit: 8 })
        .then((res) => setNotifications(res.data || []))
        .catch(() => setNotifications([]))
        .finally(() => setNotifLoading(false))
    }
  }

  function handleNotificationClick(notification: NotificationRecord) {
    if (notification.readAt) return
    setNotifications((current) =>
      current.map((item) => (item.id === notification.id ? { ...item, readAt: new Date().toISOString() } : item))
    )
    setUnreadCount((count) => Math.max(0, count - 1))
    markNotificationRead(session.token.token, notification.id).catch(() => {})
  }

  const personName = getPersonName(session.user)
  const roleName = getUserRoleName(session.user)
  const photoUrl = session.user.people?.file_url

  return (
    <header className="app-shell-header flex h-14 flex-none items-center justify-between gap-1.5 border-b border-[var(--border)] bg-[var(--surface)] px-3 sm:px-5">
      <button
        type="button"
        onClick={onOpenMobileNav}
        aria-label="Abrir menu"
        className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[var(--ink-soft)] transition hover:bg-[var(--page)] hover:text-[var(--ink)] lg:hidden"
      >
        <MenuIcon className="h-[18px] w-[18px]" />
      </button>

      <div className="flex flex-1 items-center justify-end gap-1.5">
      <ThemeToggle variant="inline" />

      <div ref={notifRef} className="relative">
        <button
          type="button"
          onClick={toggleNotifications}
          aria-label="Notificações"
          className="relative flex h-9 w-9 items-center justify-center rounded-full text-[var(--ink-soft)] transition hover:bg-[var(--page)] hover:text-[var(--ink)]"
        >
          <BellIcon className="h-[18px] w-[18px]" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-[var(--red-500)] px-1 text-[9px] font-bold text-white">
              {unreadCount > 9 ? '9+' : unreadCount}
            </span>
          )}
        </button>

        {notifOpen && (
          <div className="absolute right-0 top-full z-50 mt-2 w-80 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--card-shadow)]">
            <div className="border-b border-[var(--border)] px-4 py-3">
              <h3 className="text-[13px] font-bold text-[var(--ink)]">Notificações</h3>
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifLoading ? (
                <p className="px-4 py-6 text-center text-[12.5px] text-[var(--muted)]">Carregando…</p>
              ) : notifications.length === 0 ? (
                <p className="px-4 py-6 text-center text-[12.5px] text-[var(--muted)]">Nenhuma notificação por enquanto.</p>
              ) : (
                notifications.map((notification) => (
                  <button
                    key={notification.id}
                    type="button"
                    onClick={() => handleNotificationClick(notification)}
                    className={`flex w-full flex-col items-start gap-0.5 border-b border-[var(--border)] px-4 py-3 text-left last:border-none hover:bg-[var(--page)] ${
                      !notification.readAt ? 'bg-[var(--blue-100)]' : ''
                    }`}
                  >
                    <span className="text-[12.5px] font-bold text-[var(--ink)]">{notification.title}</span>
                    {notification.body && (
                      <span className="text-[12px] text-[var(--ink-soft)]">{notification.body}</span>
                    )}
                    <span className="text-[10.5px] text-[var(--muted)]">
                      {formatDateTime(notification.createdAt ?? notification.created_at)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      <div className="mx-1.5 h-6 w-px bg-[var(--border)]" />

      <div ref={userRef} className="relative">
        <button
          type="button"
          onClick={() => {
            setUserMenuOpen((current) => !current)
            setNotifOpen(false)
          }}
          className="flex items-center gap-2 rounded-xl py-1.5 pl-1.5 pr-2.5 transition hover:bg-[var(--page)]"
        >
          <span className="flex h-8 w-8 flex-none items-center justify-center overflow-hidden rounded-full bg-[var(--blue-100)] text-[var(--blue-700)]">
            {photoUrl ? (
              <img src={photoUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <UserIcon className="h-4 w-4" />
            )}
          </span>
          <span className="hidden text-left sm:block">
            <span className="block max-w-[140px] truncate text-[12.5px] font-bold text-[var(--ink)]">{personName}</span>
            {roleName && <span className="block max-w-[140px] truncate text-[10.5px] text-[var(--muted)]">{roleName}</span>}
          </span>
          <ChevronDownIcon className="h-3.5 w-3.5 flex-none text-[var(--muted)]" />
        </button>

        {userMenuOpen && (
          <div className="absolute right-0 top-full z-50 mt-2 w-60 overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] py-1.5 shadow-[var(--card-shadow)]">
            <div className="border-b border-[var(--border)] px-4 py-3">
              <p className="truncate text-[13px] font-bold text-[var(--ink)]">{personName}</p>
              {roleName && <p className="truncate text-[11.5px] text-[var(--muted)]">{roleName}</p>}
            </div>
            <button
              type="button"
              onClick={() => {
                setUserMenuOpen(false)
                onNavigate('users')
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] font-semibold text-[var(--ink)] hover:bg-[var(--page)]"
            >
              <UserIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
              Usuários
            </button>
            <button
              type="button"
              onClick={() => {
                setUserMenuOpen(false)
                onNavigate('companies')
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] font-semibold text-[var(--ink)] hover:bg-[var(--page)]"
            >
              <BuildingIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
              Empresas
            </button>
            <div className="my-1.5 border-t border-[var(--border)]" />
            <p className="px-4 pb-1.5 text-[10.5px] font-bold tracking-[0.09em] text-[var(--muted)] uppercase">
              Adicionais
            </p>
            <button
              type="button"
              onClick={() => {
                setUserMenuOpen(false)
                onNavigate('whatsapp-api')
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] font-semibold text-[var(--ink)] hover:bg-[var(--page)]"
            >
              <WhatsappIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
              Whatsapp Api
            </button>
            <button
              type="button"
              onClick={() => {
                setUserMenuOpen(false)
                onNavigate('contract-templates')
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] font-semibold text-[var(--ink)] hover:bg-[var(--page)]"
            >
              <FileTextIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
              Modelos de Contratos
            </button>
            <div className="my-1.5 border-t border-[var(--border)]" />
            <p className="px-4 pb-1.5 text-[10.5px] font-bold tracking-[0.09em] text-[var(--muted)] uppercase">
              Acessos
            </p>
            <button
              type="button"
              onClick={() => {
                setUserMenuOpen(false)
                onNavigate('roles')
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] font-semibold text-[var(--ink)] hover:bg-[var(--page)]"
            >
              <ShieldIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
              Perfis de Acesso
            </button>
            <button
              type="button"
              onClick={() => {
                setUserMenuOpen(false)
                onNavigate('permissions')
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] font-semibold text-[var(--ink)] hover:bg-[var(--page)]"
            >
              <LockIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
              Permissões de Acesso
            </button>
            <button
              type="button"
              onClick={() => {
                setUserMenuOpen(false)
                onNavigate('company-groups')
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] font-semibold text-[var(--ink)] hover:bg-[var(--page)]"
            >
              <BuildingsIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
              Grupo de Empresas
            </button>
            <button
              type="button"
              onClick={() => {
                setUserMenuOpen(false)
                onNavigate('audit-logs')
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] font-semibold text-[var(--ink)] hover:bg-[var(--page)]"
            >
              <ClockIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
              Logs do Sistema
            </button>
            <div className="my-1.5 border-t border-[var(--border)]" />
            <button
              type="button"
              onClick={() => {
                setUserMenuOpen(false)
                onLogout()
              }}
              className="flex w-full items-center gap-2.5 px-4 py-2.5 text-left text-[13px] font-semibold text-[var(--red-500)] hover:bg-[var(--page)]"
            >
              <LogoutIcon className="h-4 w-4 flex-none" />
              Sair
            </button>
          </div>
        )}
      </div>
      </div>
    </header>
  )
}
