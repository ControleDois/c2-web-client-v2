import { useEffect, useState } from 'react'
import {
  deleteGlassModel,
  fetchGlassModelFilters,
  fetchGlassModels,
  GLASS_CALC_TYPE_LABELS,
  type GlassModelFilters,
  type GlassModelRecord,
} from '../../lib/glass'
import { GlassCalcTypeModal } from './GlassCalcTypeModal'
import { SelectField } from '../../components/form/SelectField'
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
  const [options, setOptions] = useState<GlassModelFilters>({ suppliers: [], lines: [], gauges: [] })
  const [supplier, setSupplier] = useState('')
  const [line, setLine] = useState('')
  const [gauge, setGauge] = useState('')
  const [calcOpen, setCalcOpen] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    fetchGlassModelFilters(token, company.id)
      .then(setOptions)
      .catch(() => setOptions({ suppliers: [], lines: [], gauges: [] }))
  }, [token, company.id])

  return (
    <>
    <GlassList<GlassModelRecord>
      eyebrow="Vidraçaria"
      title="Modelos"
      newLabel="Novo modelo"
      searchPlaceholder="Buscar por nome, categoria ou linha"
      filterKey={`${supplier}:${line}:${gauge}:${reloadToken}`}
      beforeContent={
        <div className="flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => setCalcOpen(true)}
            className="rounded-xl border border-[var(--border)] px-3.5 py-2 text-[12.5px] font-bold text-[var(--ink-soft)] hover:text-[var(--ink)]"
          >
            Trocar tipo de cálculo
          </button>
          {notice && <span className="text-[12.5px] font-medium text-[var(--blue-700)]">{notice}</span>}
        </div>
      }
      filters={
        (options.suppliers.length > 0 || options.lines.length > 0 || options.gauges.length > 0) && (
          <div className="flex flex-wrap gap-2">
            <div className="min-w-[170px]"><SelectField label="" variant="surface" value={supplier} onChange={(event) => setSupplier(event.target.value)}>
              <option value="">Todos os fornecedores</option>
              {options.suppliers.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </SelectField></div>
            <div className="min-w-[170px]"><SelectField label="" variant="surface" value={line} onChange={(event) => setLine(event.target.value)}>
              <option value="">Todas as linhas</option>
              {options.lines.map((value) => (
                <option key={value} value={value}>
                  {value}
                </option>
              ))}
            </SelectField></div>
            <div className="min-w-[170px]"><SelectField label="" variant="surface" value={gauge} onChange={(event) => setGauge(event.target.value)}>
              <option value="">Todas as bitolas</option>
              {options.gauges.map((value) => (
                <option key={value} value={value}>
                  {value} mm
                </option>
              ))}
            </SelectField></div>
          </div>
        )
      }
      emptyLabel="Nenhum modelo encontrado"
      fetchPage={(search, page) => fetchGlassModels(token, company.id, { search, page, limit: 10, supplier, line, gauge })}
      columns={[
        { header: 'Nome', render: (item) => <span className="font-medium text-[var(--ink)]">{item.name}</span> },
        { header: 'Categoria', render: (item) => <span className="text-[var(--ink-soft)]">{item.category}</span> },
        {
          header: 'Linha',
          render: (item) => (
            <span className="text-[var(--ink-soft)]">
              {[item.supplier, item.line, item.gauge_mm ? `${item.gauge_mm} mm` : null].filter(Boolean).join(' · ') || '—'}
            </span>
          ),
        },
        { header: 'Folhas', render: (item) => <span className="text-[var(--ink-soft)]">{item.folhas}</span> },
        {
          header: 'Vidro padrão',
          render: (item) => <span className="text-[var(--ink-soft)]">{item.defaultGlassType?.name ?? '—'}</span>,
        },
        {
          header: 'Cálculo',
          render: (item) => <span className="text-[var(--ink-soft)]">{GLASS_CALC_TYPE_LABELS[item.calc_type ?? 'composition']}</span>,
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
    <GlassCalcTypeModal
      open={calcOpen}
      session={session}
      company={company}
      scope={{ supplier, line, gauge }}
      onClose={() => setCalcOpen(false)}
      onApplied={(updated) => {
        setCalcOpen(false)
        setNotice(`${updated} modelo${updated === 1 ? '' : 's'} atualizado${updated === 1 ? '' : 's'}.`)
        setReloadToken((value) => value + 1)
      }}
    />
    </>
  )
}
