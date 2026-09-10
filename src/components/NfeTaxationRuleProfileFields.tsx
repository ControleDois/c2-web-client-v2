import {
  NFE_ICMS_SITUACAO_OPTIONS,
  NFE_ICMS_BASE_MODE_OPTIONS,
  NFE_ICMS_ST_BASE_MODE_OPTIONS,
  NFE_PIS_COFINS_SITUACAO_OPTIONS,
  NFE_IPI_SITUACAO_OPTIONS,
  type NfeTaxationRuleProfile,
} from '../lib/nfeTaxations'

interface NfeTaxationRuleProfileFieldsProps {
  value: NfeTaxationRuleProfile
  onChange: (patch: Partial<NfeTaxationRuleProfile>) => void
}

function NumberInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: number | null | undefined
  onChange: (value: number | undefined) => void
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold text-[var(--ink-soft)]">{label}</span>
      <input
        type="number"
        step="any"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value === '' ? undefined : Number(event.target.value))}
        className="w-full rounded-lg bg-[var(--page)] px-3 py-2 text-[13px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
      />
    </label>
  )
}

function SelectInput<T extends string | number>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T | null | undefined
  options: { value: T; label: string }[]
  onChange: (value: T) => void
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[11px] font-semibold text-[var(--ink-soft)]">{label}</span>
      <select
        value={value ?? ''}
        onChange={(event) => {
          const raw = event.target.value
          const isNumeric = typeof options[0]?.value === 'number'
          onChange((isNumeric ? Number(raw) : raw) as T)
        }}
        className="w-full rounded-lg bg-[var(--page)] px-3 py-2 text-[13px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
      >
        <option value="" disabled>
          Selecione
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function CheckboxInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: boolean | undefined
  onChange: (value: boolean) => void
}) {
  return (
    <label className="flex items-center gap-1.5">
      <input
        type="checkbox"
        checked={Boolean(value)}
        onChange={(event) => onChange(event.target.checked)}
        className="h-3.5 w-3.5 accent-[var(--blue-500)]"
      />
      <span className="text-[11.5px] font-medium text-[var(--ink-soft)]">{label}</span>
    </label>
  )
}

// Os campos de cada tributo (ICMS/PIS/COFINS/IPI) são os mesmos nos dois
// perfis (Revenda/Consumidor Final) — confirmado direto nos models do
// backend (NfeTaxationRuleResale/NfeTaxationRuleFinalConsumer).
export function NfeTaxationRuleProfileFields({ value, onChange }: NfeTaxationRuleProfileFieldsProps) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h4 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[var(--ink-soft)]">ICMS</h4>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SelectInput
            label="Situação tributária (CST/CSOSN)"
            value={value.icms_situacao_tributaria}
            options={NFE_ICMS_SITUACAO_OPTIONS}
            onChange={(v) => onChange({ icms_situacao_tributaria: v })}
          />
          <SelectInput
            label="Modalidade base de cálculo"
            value={value.icms_modalidade_base_calculo}
            options={NFE_ICMS_BASE_MODE_OPTIONS}
            onChange={(v) => onChange({ icms_modalidade_base_calculo: v })}
          />
          <NumberInput
            label="Redução base de cálculo (%)"
            value={value.icms_reducao_base_calculo}
            onChange={(v) => onChange({ icms_reducao_base_calculo: v })}
          />
          <NumberInput label="Alíquota (%)" value={value.icms_aliquota} onChange={(v) => onChange({ icms_aliquota: v })} />
          <NumberInput
            label="% diferimento"
            value={value.icms_percentual_diferimento}
            onChange={(v) => onChange({ icms_percentual_diferimento: v })}
          />
          <SelectInput
            label="Modalidade base de cálculo ST"
            value={value.icms_modalidade_base_calculo_st}
            options={NFE_ICMS_ST_BASE_MODE_OPTIONS}
            onChange={(v) => onChange({ icms_modalidade_base_calculo_st: v })}
          />
          <NumberInput
            label="Margem valor adicionado ST (%)"
            value={value.icms_margem_valor_adicionado_st}
            onChange={(v) => onChange({ icms_margem_valor_adicionado_st: v })}
          />
          <NumberInput
            label="Redução base de cálculo ST (%)"
            value={value.icms_reducao_base_calculo_st}
            onChange={(v) => onChange({ icms_reducao_base_calculo_st: v })}
          />
          <NumberInput
            label="Alíquota ST (%)"
            value={value.icms_aliquota_st}
            onChange={(v) => onChange({ icms_aliquota_st: v })}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
          <CheckboxInput label="Soma frete na base" value={value.icms_adiciona_frete} onChange={(v) => onChange({ icms_adiciona_frete: v })} />
          <CheckboxInput label="Soma seguro na base" value={value.icms_adiciona_seguro} onChange={(v) => onChange({ icms_adiciona_seguro: v })} />
          <CheckboxInput label="Soma IPI na base" value={value.icms_adiciona_ipi} onChange={(v) => onChange({ icms_adiciona_ipi: v })} />
          <CheckboxInput
            label="Soma outras despesas na base"
            value={value.icms_adiciona_outras_despesas}
            onChange={(v) => onChange({ icms_adiciona_outras_despesas: v })}
          />
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[var(--ink-soft)]">PIS</h4>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SelectInput
            label="Situação tributária"
            value={value.pis_situacao_tributaria}
            options={NFE_PIS_COFINS_SITUACAO_OPTIONS}
            onChange={(v) => onChange({ pis_situacao_tributaria: v })}
          />
          <NumberInput
            label="Alíquota (%)"
            value={value.pis_aliquota_porcentual}
            onChange={(v) => onChange({ pis_aliquota_porcentual: v })}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
          <CheckboxInput label="Soma frete na base" value={value.pis_adiciona_frete} onChange={(v) => onChange({ pis_adiciona_frete: v })} />
          <CheckboxInput label="Soma seguro na base" value={value.pis_adiciona_seguro} onChange={(v) => onChange({ pis_adiciona_seguro: v })} />
          <CheckboxInput label="Soma IPI na base" value={value.pis_adiciona_ipi} onChange={(v) => onChange({ pis_adiciona_ipi: v })} />
          <CheckboxInput
            label="Soma outras despesas na base"
            value={value.pis_adiciona_outras_despesas}
            onChange={(v) => onChange({ pis_adiciona_outras_despesas: v })}
          />
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[var(--ink-soft)]">COFINS</h4>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SelectInput
            label="Situação tributária"
            value={value.cofins_situacao_tributaria}
            options={NFE_PIS_COFINS_SITUACAO_OPTIONS}
            onChange={(v) => onChange({ cofins_situacao_tributaria: v })}
          />
          <NumberInput
            label="Alíquota (%)"
            value={value.cofins_aliquota_porcentual}
            onChange={(v) => onChange({ cofins_aliquota_porcentual: v })}
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
          <CheckboxInput label="Soma frete na base" value={value.cofins_adiciona_frete} onChange={(v) => onChange({ cofins_adiciona_frete: v })} />
          <CheckboxInput label="Soma seguro na base" value={value.cofins_adiciona_seguro} onChange={(v) => onChange({ cofins_adiciona_seguro: v })} />
          <CheckboxInput label="Soma IPI na base" value={value.cofins_adiciona_ipi} onChange={(v) => onChange({ cofins_adiciona_ipi: v })} />
          <CheckboxInput
            label="Soma outras despesas na base"
            value={value.cofins_adiciona_outras_despesas}
            onChange={(v) => onChange({ cofins_adiciona_outras_despesas: v })}
          />
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[var(--ink-soft)]">
          IPI <span className="font-normal normal-case text-[var(--muted)]">(ignorado em NFC-e)</span>
        </h4>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <SelectInput
            label="Situação tributária"
            value={value.ipi_situacao_tributaria}
            options={NFE_IPI_SITUACAO_OPTIONS}
            onChange={(v) => onChange({ ipi_situacao_tributaria: v })}
          />
          <NumberInput label="Alíquota (%)" value={value.ipi_aliquota} onChange={(v) => onChange({ ipi_aliquota: v })} />
        </div>
        <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1.5">
          <CheckboxInput label="Soma frete na base" value={value.ipi_adiciona_frete} onChange={(v) => onChange({ ipi_adiciona_frete: v })} />
          <CheckboxInput label="Soma seguro na base" value={value.ipi_adiciona_seguro} onChange={(v) => onChange({ ipi_adiciona_seguro: v })} />
          <CheckboxInput
            label="Soma outras despesas na base"
            value={value.ipi_adiciona_outras_despesas}
            onChange={(v) => onChange({ ipi_adiciona_outras_despesas: v })}
          />
        </div>
      </div>

      <div>
        <h4 className="mb-2 text-[12px] font-bold uppercase tracking-wide text-[var(--ink-soft)]">Outros</h4>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-[var(--ink-soft)]">Informações adicionais da NFe</span>
            <input
              type="text"
              value={value.informacoes_nfe ?? ''}
              onChange={(event) => onChange({ informacoes_nfe: event.target.value })}
              className="w-full rounded-lg bg-[var(--page)] px-3 py-2 text-[13px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
            />
          </label>
          <div className="flex items-end pb-2">
            <CheckboxInput
              label="Exibir informações do IBPT no DANFE"
              value={value.informacoes_ibpt}
              onChange={(v) => onChange({ informacoes_ibpt: v })}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
