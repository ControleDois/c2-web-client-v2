import { useCallback, useLayoutEffect, useRef, useState, type CSSProperties, type ReactNode, type RefObject } from 'react'
import { createPortal } from 'react-dom'

interface PopupPanelProps {
  // Elemento a que o popup fica "colado" (o botão ou o campo que o abriu).
  anchorRef: RefObject<HTMLElement | null>
  // Referência do próprio popup: quem trata o clique fora precisa dela, porque o popup mora fora do campo (portal).
  panelRef?: RefObject<HTMLDivElement | null>
  align?: 'left' | 'right'
  // Largura mínima igual à do campo (listas de opções).
  matchWidth?: boolean
  // Largura fixa em px (menus).
  width?: number
  maxWidth?: number
  // Altura máxima do popup, mesmo havendo mais espaço na tela.
  maxHeight?: number
  className?: string
  children: ReactNode
}

const MARGIN = 8
const GAP = 6
const MIN_HEIGHT = 140

// Popup que nunca fica cortado: abre fora do fluxo da tela (portal, posição fixa), encaixa na altura que sobra e vai
// para cima do campo quando embaixo não cabe. Se o conteúdo for maior que o espaço, ele rola por dentro.
export function PopupPanel({
  anchorRef,
  panelRef,
  align = 'left',
  matchWidth = false,
  width,
  maxWidth,
  maxHeight = 420,
  className = '',
  children,
}: PopupPanelProps) {
  const ownRef = useRef<HTMLDivElement>(null)
  const ref = panelRef ?? ownRef
  const [style, setStyle] = useState<CSSProperties | null>(null)

  const place = useCallback(() => {
    const anchor = anchorRef.current
    const panel = ref.current
    if (!anchor || !panel) return

    // A tela pode estar encolhida (zoom do CSS em telas pequenas): as medidas da janela vêm em pixels da tela, e as
    // posições do popup valem em pixels da página. Convertendo tudo para pixels da página, ele cai no lugar certo.
    const zoom = parseFloat(getComputedStyle(document.documentElement).zoom) || 1
    const box = anchor.getBoundingClientRect()
    const rect = {
      top: box.top / zoom,
      bottom: box.bottom / zoom,
      left: box.left / zoom,
      right: box.right / zoom,
      width: box.width / zoom,
    }
    const viewportHeight = window.innerHeight / zoom
    const viewportWidth = window.innerWidth / zoom

    const below = viewportHeight - rect.bottom - MARGIN - GAP
    const above = rect.top - MARGIN - GAP
    // scrollHeight é a altura que o conteúdo teria sem limite (o painel rola quando passa do máximo).
    const contentHeight = Math.min(panel.scrollHeight, maxHeight)
    const openUp = contentHeight > below && above > below

    const room = openUp ? above : below
    const height = Math.max(Math.min(maxHeight, room), Math.min(MIN_HEIGHT, contentHeight))

    const panelWidth = panel.offsetWidth
    let left = align === 'right' ? rect.right - panelWidth : rect.left
    left = Math.max(MARGIN, Math.min(left, viewportWidth - panelWidth - MARGIN))

    const next: CSSProperties = {
      position: 'fixed',
      left,
      maxHeight: height,
      ...(openUp ? { bottom: viewportHeight - rect.top + GAP } : { top: rect.bottom + GAP }),
      ...(matchWidth ? { minWidth: rect.width } : {}),
      visibility: 'visible',
    }

    setStyle((current) =>
      current &&
      current.left === next.left &&
      current.top === next.top &&
      current.bottom === next.bottom &&
      current.maxHeight === next.maxHeight &&
      current.minWidth === next.minWidth
        ? current
        : next
    )
  }, [anchorRef, ref, align, matchWidth, maxHeight])

  // Mede antes de pintar (sem piscar) e acompanha rolagem e redimensionamento da janela.
  useLayoutEffect(() => {
    place()
    let frame = 0
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(place)
    }
    window.addEventListener('resize', schedule)
    window.addEventListener('scroll', schedule, true)
    const observer = typeof ResizeObserver !== 'undefined' && ref.current ? new ResizeObserver(schedule) : null
    if (observer && ref.current) observer.observe(ref.current)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('resize', schedule)
      window.removeEventListener('scroll', schedule, true)
      observer?.disconnect()
    }
  }, [place, ref])

  return createPortal(
    <div
      ref={ref}
      style={{ ...(width ? { width } : {}), ...(maxWidth ? { maxWidth } : {}), ...(style ?? { position: 'fixed', top: 0, left: 0, visibility: 'hidden' }) }}
      className={`z-[100] overflow-y-auto overscroll-contain rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-[var(--card-shadow)] ${className}`}
    >
      {children}
    </div>,
    document.body
  )
}
