import { useState } from 'react'

export function useRowSelection() {
  const [selected, setSelected] = useState<Set<string>>(new Set())

  function toggle(id: string) {
    setSelected((current) => {
      const next = new Set(current)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function toggleAll(ids: string[]) {
    setSelected((current) => {
      const allSelected = ids.length > 0 && ids.every((id) => current.has(id))
      return allSelected ? new Set() : new Set(ids)
    })
  }

  function clear() {
    setSelected(new Set())
  }

  return { selected, toggle, toggleAll, clear, setSelected }
}
