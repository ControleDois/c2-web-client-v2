import { deleteGlassProfile, fetchGlassProfiles, type GlassProfileRecord } from '../../lib/glass'
import { formatCurrency } from '../../lib/format'
import { GlassList } from './GlassList'
import { PencilIcon, TrashIcon } from '../../components/icons'
import type { AuthCompany, AuthSession } from '../../lib/auth'

interface GlassProfilesPageProps {
  session: AuthSession
  company: AuthCompany
  onCreate: () => void
  onEdit: (item: GlassProfileRecord) => void
}

export function GlassProfilesPage({ session, company, onCreate, onEdit }: GlassProfilesPageProps) {
  const token = session.token.token

  return (
    <GlassList<GlassProfileRecord>
      eyebrow="Vidraçaria"
      title="Perfis"
      newLabel="Novo perfil"
      searchPlaceholder="Buscar por nome, linha, cor ou referência"
      emptyLabel="Nenhum perfil encontrado"
      fetchPage={(search, page) => fetchGlassProfiles(token, company.id, { search, page, limit: 10 })}
      columns={[
        { header: 'Nome', render: (item) => <span className="font-medium text-[var(--ink)]">{item.name}</span> },
        { header: 'Linha', render: (item) => <span className="text-[var(--ink-soft)]">{item.line || '—'}</span> },
        { header: 'Cor / acabamento', render: (item) => <span className="text-[var(--ink-soft)]">{item.color || '—'}</span> },
        { header: 'Barra', render: (item) => <span className="text-[var(--ink-soft)]">{item.bar_length_mm.toLocaleString('pt-BR')} mm</span> },
        { header: 'Preço/m', align: 'right', render: (item) => formatCurrency(item.price_per_m) },
        {
          header: 'Situação',
          render: (item) => (
            <span className={item.active ? 'text-[var(--green-600)]' : 'text-[var(--muted)]'}>{item.active ? 'Ativo' : 'Inativo'}</span>
          ),
        },
      ]}
      cardTitle={(item) => item.name}
      cardSubtitle={(item) => `${[item.line, item.color].filter(Boolean).join(' · ')} · ${formatCurrency(item.price_per_m)}/m`}
      onCreate={onCreate}
      actions={(item, { askDelete }) => [
        { key: 'edit', label: 'Editar', icon: <PencilIcon className="h-4 w-4" />, onClick: () => onEdit(item) },
        { key: 'delete', label: 'Excluir', icon: <TrashIcon className="h-4 w-4" />, tone: 'danger', dividerBefore: true, onClick: () => askDelete(item) },
      ]}
      deleteItem={(item) => deleteGlassProfile(token, item.id)}
      deleteTitle="Excluir perfil"
      deleteLabel={(item) => item.name}
    />
  )
}
