import type { ConfigPayload } from '../../lib/config'
import { TextField } from '../../components/form/TextField'
import { CoinIcon } from '../../components/icons'

interface EmprestimoSectionProps {
  value: ConfigPayload
  onChange: (patch: Partial<ConfigPayload>) => void
}

export function EmprestimoSection({ value, onChange }: EmprestimoSectionProps) {
  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <TextField
        label="Pontos por quitação"
        icon={<CoinIcon className="h-4 w-4" />}
        type="number"
        placeholder="0"
        value={value.loan_points_per_payoff ?? ''}
        onChange={(event) => onChange({ loan_points_per_payoff: Number(event.target.value) })}
      />
    </div>
  )
}
