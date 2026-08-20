import { useState } from 'react'

export type EntityView = { mode: 'list' } | { mode: 'form'; id?: string }

export function useEntityView() {
  const [view, setView] = useState<EntityView>({ mode: 'list' })

  return {
    view,
    reset: () => setView({ mode: 'list' }),
    create: () => setView({ mode: 'form' }),
    edit: (id: string) => setView({ mode: 'form', id }),
  }
}
