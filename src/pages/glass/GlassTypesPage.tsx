import { deleteGlassType, fetchGlassTypes, type GlassTypeRecord } from '../../lib/glass'
import { formatCurrency } from '../../lib/format'
import { GlassList } from './GlassList'
import { PencilIcon, TrashIcon } from '../../components/icons'
import type { AuthCompany, AuthSession } from '../../lib/auth'

interface GlassTypesPageProps {
  session: AuthSession
  company: AuthCompany
  onCreate: () => void
  onEdit: (item: GlassTypeRecord) => void
}

function specLabel(item: GlassTypeRecord) {
  return [item.kind, item.thickness_mm ? `${item.thickness_mm} mm` : null, item.color].filter(Boolean).join(' · ')
}

export function GlassTypesPage({ session, company, onCreate, onEdit }: GlassTypesPageProps) {
  const token = session.token.token

  return (
    <GlassList<GlassTypeRecord>
      eyebrow="Vidraçaria"
      title="Vidros"
      newLabel="Novo vidro"
      searchPlaceholder="Buscar por nome ou cor"
      emptyLabel="Nenhum vidro encontrado"
      fetchPage={(search, page) => fetchGlassTypes(token, company.id, { search, page, limit: 10 })}
      columns={[
        { header: 'Nome', render: (item) => <span className="font-medium text-[var(--ink)]">{item.name}</span> },
        { header: 'Especificação', render: (item) => <span className="text-[var(--ink-soft)]">{specLabel(item)}</span> },
        { header: 'Preço/m²', align: 'right', render: (item) => formatCurrency(item.price_per_m2) },
        { header: 'Custo/m²', align: 'right', render: (item) => <span className="text-[var(--ink-soft)]">{formatCurrency(item.cost_per_m2)}</span> },
        {
          header: 'Situação',
          render: (item) => (
            <span className={item.active ? 'text-[var(--green-500,#16a34a)]' : 'text-[var(--muted)]'}>
              {item.active ? 'Ativo' : 'Inativo'}
            </span>
          ),
        },
      ]}
      cardTitle={(item) => item.name}
      cardSubtitle={(item) => `${specLabel(item)} · ${formatCurrency(item.price_per_m2)}/m²`}
      onCreate={onCreate}
      actions={(item, { askDelete }) => [
        { key: 'edit', label: 'Editar', icon: <PencilIcon className="h-4 w-4" />, onClick: () => onEdit(item) },
        { key: 'delete', label: 'Excluir', icon: <TrashIcon className="h-4 w-4" />, tone: 'danger', dividerBefore: true, onClick: () => askDelete(item) },
      ]}
      deleteItem={(item) => deleteGlassType(token, item.id)}
      deleteTitle="Excluir vidro"
      deleteLabel={(item) => item.name}
    />
  )
}
