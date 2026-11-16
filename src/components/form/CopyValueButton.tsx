import { useState } from 'react'
import { CheckCircleIcon as CheckIcon, CopyIcon } from '../icons'

// Botão de copiar dentro do campo (ex.: CSC da NFC-e): copia o valor e mostra "Copiado".
export function CopyValueButton({ value, label = 'Copiar' }: { value?: string | null; label?: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    if (!value) return
    try {
      await navigator.clipboard.writeText(value)
    } catch {
      const area = document.createElement('textarea')
      area.value = value
      area.style.position = 'fixed'
      area.style.opacity = '0'
      document.body.appendChild(area)
      area.select()
      document.execCommand('copy')
      area.remove()
    }
    setCopied(true)
    window.setTimeout(() => setCopied(false), 1500)
  }

  return (
    <button
      type="button"
      onClick={() => void copy()}
      disabled={!value}
      title={label}
      className="flex flex-none items-center gap-1 rounded-lg px-2 py-1 text-[12px] font-semibold text-[var(--blue-700)] transition hover:bg-[var(--blue-100)] disabled:opacity-40"
    >
      {copied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
      {copied ? 'Copiado' : label}
    </button>
  )
}
