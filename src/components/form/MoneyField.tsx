import type { ClipboardEvent, InputHTMLAttributes, ReactNode } from 'react'
import { formatMoneyDisplay, moneyFromPasted, moneyFromTyped } from '../../lib/money'
import type { MoneyChange } from './MoneyInput'
import { TextField } from './TextField'

interface MoneyFieldProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange' | 'type' | 'inputMode'> {
  label: string
  icon: ReactNode
  action?: ReactNode
  trailing?: ReactNode
  value: string | number | null | undefined
  onChange?: (event: MoneyChange) => void
  allowNegative?: boolean
}

// TextField de dinheiro: mesma aparência, com a máscara 1.234,56.
export function MoneyField({ value, onChange, allowNegative = false, placeholder = '0,00', ...rest }: MoneyFieldProps) {
  function handlePaste(event: ClipboardEvent<HTMLInputElement>) {
    const pasted = moneyFromPasted(event.clipboardData.getData('text'), allowNegative)
    if (pasted === null) return
    event.preventDefault()
    onChange?.({ target: { value: pasted } })
  }

  return (
    <TextField
      {...rest}
      inputMode="decimal"
      autoComplete="off"
      placeholder={placeholder}
      value={formatMoneyDisplay(value)}
      onChange={(event) => onChange?.({ target: { value: moneyFromTyped(event.target.value, allowNegative) } })}
      onPaste={handlePaste}
    />
  )
}
