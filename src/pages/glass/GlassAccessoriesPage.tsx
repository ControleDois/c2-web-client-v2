import { deleteGlassAccessory, fetchGlassAccessories, type GlassAccessoryRecord } from '../../lib/glass'
import { formatCurrency } from '../../lib/format'
import { GlassList } from './GlassList'
import { PencilIcon, TrashIcon } from '../../components/icons'
import type { AuthCompany, AuthSession } from '../../lib/auth'

interface GlassAccessoriesPageProps {
  session: AuthSession
  company: AuthCompany
  onCreate: () => void
  onEdit: (item: GlassAccessoryRecord) => void
}

export function GlassAccessoriesPage({ session, company, onCreate, onEdit }: GlassAccessoriesPageProps) {
  const token = session.token.token

  return (
    <GlassList<GlassAccessoryRecord>
      eyebrow="Vidraçaria"
      title="Acessórios"
      newLabel="Novo acessório"
      searchPlaceholder="Buscar por nome ou referência"
      emptyLabel="Nenhum acessório encontrado"
      fetchPage={(search, page) => fetchGlassAccessories(token, company.id, { search, page, limit: 10 })}
      columns={[
        { header: 'Nome', render: (item) => <span className="font-medium text-[var(--ink)]">{item.name}</span> },
        { header: 'Referência', render: (item) => <span className="text-[var(--ink-soft)]">{item.reference || '—'}</span> },
        { header: 'Unidade', render: (item) => <span className="text-[var(--ink-soft)]">{item.unit}</span> },
        { header: 'Preço', align: 'right', render: (item) => formatCurrency(item.price) },
        {
          header: 'Situação',
          render: (item) => (
            <span className={item.active ? 'text-[var(--green-600)]' : 'text-[var(--muted)]'}>{item.active ? 'Ativo' : 'Inativo'}</span>
          ),
        },
      ]}
      cardTitle={(item) => item.name}
      cardSubtitle={(item) => `${formatCurrency(item.price)} / ${item.unit}`}
      onCreate={onCreate}
      actions={(item, { askDelete }) => [
        { key: 'edit', label: 'Editar', icon: <PencilIcon className="h-4 w-4" />, onClick: () => onEdit(item) },
        { key: 'delete', label: 'Excluir', icon: <TrashIcon className="h-4 w-4" />, tone: 'danger', dividerBefore: true, onClick: () => askDelete(item) },
      ]}
      deleteItem={(item) => deleteGlassAccessory(token, item.id)}
      deleteTitle="Excluir acessório"
      deleteLabel={(item) => item.name}
    />
  )
}
