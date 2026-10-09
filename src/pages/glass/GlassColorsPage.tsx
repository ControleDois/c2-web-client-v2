import { deleteGlassColor, fetchGlassColors, GLASS_COLOR_KIND_LABELS, type GlassColorRecord } from '../../lib/glass'
import { GlassList } from './GlassList'
import { PencilIcon, TrashIcon } from '../../components/icons'
import type { AuthCompany, AuthSession } from '../../lib/auth'

interface GlassColorsPageProps {
  session: AuthSession
  company: AuthCompany
  onCreate: () => void
  onEdit: (item: GlassColorRecord) => void
}

const adjustLabel = (value: number) => (value ? `${value > 0 ? '+' : ''}${value.toLocaleString('pt-BR')}%` : '—')

export function GlassColorsPage({ session, company, onCreate, onEdit }: GlassColorsPageProps) {
  const token = session.token.token

  return (
    <GlassList<GlassColorRecord>
      eyebrow="Vidraçaria"
      title="Cores"
      newLabel="Nova cor"
      searchPlaceholder="Buscar por nome"
      emptyLabel="Nenhuma cor cadastrada"
      fetchPage={(search, page) => fetchGlassColors(token, company.id, { search, page, limit: 10 })}
      columns={[
        { header: 'Nome', render: (item) => <span className="font-medium text-[var(--ink)]">{item.name}</span> },
        { header: 'Tipo', render: (item) => <span className="text-[var(--ink-soft)]">{GLASS_COLOR_KIND_LABELS[item.kind]}</span> },
        { header: 'Acréscimo no preço', align: 'right', render: (item) => adjustLabel(item.price_adjust_percent) },
        {
          header: 'Situação',
          render: (item) => (
            <span className={item.active ? 'text-[var(--green-600)]' : 'text-[var(--muted)]'}>{item.active ? 'Ativa' : 'Inativa'}</span>
          ),
        },
      ]}
      cardTitle={(item) => item.name}
      cardSubtitle={(item) => `${GLASS_COLOR_KIND_LABELS[item.kind]} · ${adjustLabel(item.price_adjust_percent)}`}
      onCreate={onCreate}
      actions={(item, { askDelete }) => [
        { key: 'edit', label: 'Editar', icon: <PencilIcon className="h-4 w-4" />, onClick: () => onEdit(item) },
        { key: 'delete', label: 'Excluir', icon: <TrashIcon className="h-4 w-4" />, tone: 'danger', dividerBefore: true, onClick: () => askDelete(item) },
      ]}
      deleteItem={(item) => deleteGlassColor(token, item.id)}
      deleteTitle="Excluir cor"
      deleteLabel={(item) => item.name}
    />
  )
}
