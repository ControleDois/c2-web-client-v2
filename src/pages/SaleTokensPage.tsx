import { useEffect, useState } from 'react'
import {
  cancelSaleToken,
  fetchSaleTokenSummary,
  fetchSaleTokens,
  SALE_TOKEN_STATUS_LABELS,
  undoSaleTokenRedeem,
  type SaleTokenRecord,
  type SaleTokenSummary,
} from '../lib/saleTokens'
import { ApiError } from '../lib/api'
import { formatDateTime } from '../lib/format'
import { GlassList } from './glass/GlassList'
import { SelectField } from '../components/form/SelectField'
import { CloseIcon, RefreshIcon } from '../components/icons'
import type { AuthCompany, AuthSession } from '../lib/auth'

interface SaleTokensPageProps {
  session: AuthSession
  company: AuthCompany
}

const STATUS_TONES: Record<number, string> = {
  0: 'bg-[var(--amber-100)] text-[var(--amber-500)]',
  1: 'bg-[var(--green-100)] text-[var(--green-600)]',
  2: 'bg-[var(--red-100)] text-[var(--red-500)]',
}

// Controle das fichas de venda: quantas foram emitidas, trocadas e quantas
// ainda estão na rua (vales). A baixa em si é feita no PDV, bipando a ficha.
export function SaleTokensPage({ session, company }: SaleTokensPageProps) {
  const token = session.token.token
  const [summary, setSummary] = useState<SaleTokenSummary | null>(null)
  const [status, setStatus] = useState('')
  const [reloadToken, setReloadToken] = useState(0)
  const [notice, setNotice] = useState<string | null>(null)

  useEffect(() => {
    fetchSaleTokenSummary(token, company.id)
      .then(setSummary)
      .catch(() => setSummary(null))
  }, [token, company.id, reloadToken])

  async function run(action: () => Promise<unknown>) {
    setNotice(null)
    try {
      await action()
      setReloadToken((value) => value + 1)
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : 'Não foi possível concluir a ação.')
    }
  }

  const cards = [
    { label: 'Emitidas hoje', value: summary?.issued_today },
    { label: 'Trocadas hoje', value: summary?.redeemed_today },
    { label: 'Vales em aberto', value: summary?.pending_total },
  ]

  return (
    <>
      <GlassList<SaleTokenRecord>
        eyebrow="Distribuidora"
        title="Fichas"
        searchPlaceholder="Buscar por código, produto ou nº da venda"
        emptyLabel="Nenhuma ficha encontrada"
        filterKey={`${status}:${reloadToken}`}
        beforeContent={
          <>
            <div className="grid gap-3 sm:grid-cols-3">
              {cards.map((card) => (
                <div key={card.label} className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                  <p className="text-[12px] font-semibold text-[var(--ink-soft)]">{card.label}</p>
                  <p className="mt-1 text-[26px] font-bold tracking-tight text-[var(--ink)]">{card.value ?? '—'}</p>
                </div>
              ))}
            </div>
            {summary && summary.pending_by_product.length > 0 && (
              <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
                <h2 className="text-[14px] font-bold text-[var(--ink)]">Vales em aberto por produto</h2>
                <p className="mb-3 text-[12px] text-[var(--muted)]">Fichas vendidas que o cliente ainda não trocou.</p>
                <div className="flex flex-wrap gap-2">
                  {summary.pending_by_product.map((item) => (
                    <span key={item.product_name} className="rounded-lg bg-[var(--page)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--ink)]">
                      {item.product_name}: <span className="text-[var(--blue-700)]">{item.total}</span>
                    </span>
                  ))}
                </div>
              </div>
            )}
            <p className="text-[12.5px] text-[var(--ink-soft)]">
              A troca é feita no PDV, na tela <b>Fichas</b>, bipando o código de barras da ficha. Uma ficha só vale uma vez.
            </p>
            {notice && <div className="rounded-xl bg-[var(--red-100)] px-4 py-3 text-[13px] font-medium text-[var(--red-500)]">{notice}</div>}
          </>
        }
        filters={
          <div className="min-w-[180px]">
            <SelectField label="" variant="surface" value={status} onChange={(event) => setStatus(event.target.value)}>
              <option value="">Todas as situações</option>
              {Object.entries(SALE_TOKEN_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </SelectField>
          </div>
        }
        fetchPage={(search, page) => fetchSaleTokens(token, company.id, { search, page, limit: 20, status })}
        columns={[
          { header: 'Código', render: (item) => <span className="font-mono text-[12.5px] font-semibold text-[var(--ink)]">{item.token_code}</span> },
          { header: 'Produto', render: (item) => <span className="font-medium text-[var(--ink)]">{item.product_name}</span> },
          { header: 'Venda', render: (item) => <span className="text-[var(--ink-soft)]">{item.sale_code ? `#${item.sale_code}` : '—'} · {item.sequence}/{item.total}</span> },
          { header: 'Emitida', render: (item) => <span className="text-[var(--ink-soft)]">{formatDateTime(item.created_at)}</span> },
          {
            header: 'Situação',
            render: (item) => (
              <span>
                <span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${STATUS_TONES[item.status] ?? STATUS_TONES[0]}`}>
                  {SALE_TOKEN_STATUS_LABELS[item.status] ?? item.status}
                </span>
                {item.status === 1 && item.redeemed_at && (
                  <span className="ml-2 text-[11.5px] text-[var(--muted)]">{formatDateTime(item.redeemed_at)}</span>
                )}
              </span>
            ),
          },
        ]}
        cardTitle={(item) => `${item.product_name} · ${item.token_code}`}
        cardSubtitle={(item) => SALE_TOKEN_STATUS_LABELS[item.status]}
        actions={(item) => {
          if (item.status === 0) {
            return [
              { key: 'cancel', label: 'Cancelar ficha', icon: <CloseIcon className="h-4 w-4" />, tone: 'danger', onClick: () => run(() => cancelSaleToken(token, item.id)) },
            ]
          }
          if (item.status === 1) {
            return [
              { key: 'undo', label: 'Desfazer a troca', icon: <RefreshIcon className="h-4 w-4" />, tone: 'warning', onClick: () => run(() => undoSaleTokenRedeem(token, item.id)) },
            ]
          }
          return []
        }}
        deleteItem={async () => {}}
        deleteTitle=""
        deleteLabel={() => ''}
      />
    </>
  )
}
