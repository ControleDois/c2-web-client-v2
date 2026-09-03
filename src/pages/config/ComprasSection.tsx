import type { ConfigPayload } from '../../lib/config'

interface ComprasSectionProps {
  value: ConfigPayload
  onChange: (patch: Partial<ConfigPayload>) => void
  onOpenPurchaseManagement: () => void
}

export function ComprasSection({ value, onChange, onOpenPurchaseManagement }: ComprasSectionProps) {
  return (
    <div className="flex flex-col gap-4">
      <label className="flex items-center gap-2.5">
        <input
          type="checkbox"
          checked={Boolean(value.purchase_management_enabled)}
          onChange={(event) => onChange({ purchase_management_enabled: event.target.checked })}
          className="h-4 w-4 accent-[var(--blue-500)]"
        />
        <span className="text-[13.5px] font-semibold text-[var(--ink)]">Ativar Gestão de Compras</span>
      </label>
      <p className="text-[12.5px] text-[var(--muted)]">
        Controle os insumos que a empresa compra para funcionar (ex: ingredientes, materiais de
        uso interno), com alerta de estoque baixo e envio de solicitações de compra.
      </p>

      {value.purchase_management_enabled && (
        <button
          type="button"
          onClick={onOpenPurchaseManagement}
          className="w-fit rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13px] font-bold text-white transition hover:bg-[var(--blue-700)]"
        >
          Acessar Gestão de Compras →
        </button>
      )}
    </div>
  )
}
