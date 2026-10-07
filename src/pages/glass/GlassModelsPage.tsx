import { deleteGlassModel, fetchGlassModels, type GlassModelRecord } from '../../lib/glass'
import { GlassList } from './GlassList'
import { PencilIcon, TrashIcon } from '../../components/icons'
import type { AuthCompany, AuthSession } from '../../lib/auth'

interface GlassModelsPageProps {
  session: AuthSession
  company: AuthCompany
  onCreate: () => void
  onEdit: (item: GlassModelRecord) => void
}

export function GlassModelsPage({ session, company, onCreate, onEdit }: GlassModelsPageProps) {
  const token = session.token.token

  return (
    <GlassList<GlassModelRecord>
      eyebrow="Vidraçaria"
      title="Modelos"
      newLabel="Novo modelo"
      searchPlaceholder="Buscar por nome ou categoria"
      emptyLabel="Nenhum modelo encontrado"
      fetchPage={(search, page) => fetchGlassModels(token, company.id, { search, page, limit: 10 })}
      columns={[
        { header: 'Nome', render: (item) => <span className="font-medium text-[var(--ink)]">{item.name}</span> },
        { header: 'Categoria', render: (item) => <span className="text-[var(--ink-soft)]">{item.category}</span> },
        { header: 'Folhas', render: (item) => <span className="text-[var(--ink-soft)]">{item.folhas}</span> },
        {
          header: 'Vidro padrão',
          render: (item) => <span className="text-[var(--ink-soft)]">{item.defaultGlassType?.name ?? '—'}</span>,
        },
        {
          header: 'Ferragens',
          render: (item) => <span className="text-[var(--ink-soft)]">{item.components?.length ?? 0} itens</span>,
        },
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
      cardSubtitle={(item) => `${item.category} · ${item.folhas} folha${item.folhas === 1 ? '' : 's'}`}
      onCreate={onCreate}
      actions={(item, { askDelete }) => [
        { key: 'edit', label: 'Editar', icon: <PencilIcon className="h-4 w-4" />, onClick: () => onEdit(item) },
        { key: 'delete', label: 'Excluir', icon: <TrashIcon className="h-4 w-4" />, tone: 'danger', dividerBefore: true, onClick: () => askDelete(item) },
      ]}
      deleteItem={(item) => deleteGlassModel(token, item.id)}
      deleteTitle="Excluir modelo"
      deleteLabel={(item) => item.name}
    />
  )
}
