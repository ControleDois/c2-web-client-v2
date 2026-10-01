import { useEffect, useState } from 'react'
import { fetchVehicles, type VehicleRecord } from '../lib/vehicles'
import { fetchInvestments, type InvestmentRecord } from '../lib/investments'
import { formatCurrency, formatDate } from '../lib/format'
import { ApiError } from '../lib/api'
import { TruckIcon, CoinIcon, TrendUpIcon } from '../components/icons'
import type { AuthCompany, AuthSession } from '../lib/auth'

interface GaragemDashboardPageProps {
  session: AuthSession
  company: AuthCompany
}

function vehicleLabel(vehicle: VehicleRecord): string {
  const model = [vehicle.brand, vehicle.model].filter(Boolean).join(' ')
  return model || vehicle.license_plate || '—'
}

function vehicleCost(vehicle: VehicleRecord): number {
  return Number(vehicle.purchase_price || 0) + Number(vehicle.total_expenses || 0)
}

function daysSince(date?: string | null): number {
  if (!date) return 0
  const start = new Date(date).getTime()
  return Math.max(0, Math.round((Date.now() - start) / 86400000))
}

export function GaragemDashboardPage({ session, company }: GaragemDashboardPageProps) {
  const token = session.token.token
  const [vehicles, setVehicles] = useState<VehicleRecord[]>([])
  const [investments, setInvestments] = useState<InvestmentRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setLoading(true)
    setError(null)
    Promise.all([
      fetchVehicles(token, company.id, { limit: 200 }),
      fetchInvestments(token, company.id, { status: 'ativo', limit: 100 }),
    ])
      .then(([vehiclesRes, investmentsRes]) => {
        setVehicles(vehiclesRes.data)
        setInvestments(investmentsRes.data)
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Não foi possível carregar o dashboard.'))
      .finally(() => setLoading(false))
  }, [token, company.id])

  const emEstoque = vehicles.filter((v) => v.flip_status !== 'vendido')
  const vendidos = vehicles.filter((v) => v.flip_status === 'vendido')
  const capitalEstoque = emEstoque.reduce((a, v) => a + vehicleCost(v), 0)
  const faturamento = vendidos.reduce((a, v) => a + Number(v.sale_price || 0), 0)
  const lucro = vendidos.reduce((a, v) => a + Number(v.sale_price || 0) - vehicleCost(v), 0)
  const margem = faturamento ? (lucro / faturamento) * 100 : 0
  const parado = emEstoque
    .map((v) => ({ v, dias: daysSince(v.purchase_date) }))
    .sort((a, b) => b.dias - a.dias)
    .slice(0, 6)

  const investAtual = investments.reduce(
    (a, x) => a + Number(x.current_amount ?? x.invested_amount ?? 0),
    0
  )

  if (loading) {
    return (
      <div className="flex flex-col gap-4 p-4 sm:p-6 lg:p-8">
        {Array.from({ length: 4 }).map((_, index) => (
          <div key={index} className="h-20 animate-pulse rounded-2xl bg-[var(--surface)]" />
        ))}
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Dashboard</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">Garagem do Investidor</h1>
      </div>

      {error && (
        <div className="rounded-2xl bg-[var(--red-100)] p-4 text-[13.5px] font-medium text-[var(--red-500)]">
          {error}
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Em estoque</p>
          <p className="mt-1 text-[20px] font-bold text-[var(--ink)]">{emEstoque.length}</p>
          <p className="text-[12px] text-[var(--muted)]">{formatCurrency(capitalEstoque)} investidos</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Vendidos</p>
          <p className="mt-1 text-[20px] font-bold text-[var(--ink)]">{vendidos.length}</p>
          <p className="text-[12px] text-[var(--muted)]">{formatCurrency(faturamento)} em vendas</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Lucro nas vendas</p>
          <p className={`mt-1 text-[20px] font-bold ${lucro >= 0 ? 'text-[var(--green-600)]' : 'text-[var(--red-500)]'}`}>
            {formatCurrency(lucro)}
          </p>
          <p className="text-[12px] text-[var(--muted)]">margem de {margem.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</p>
        </div>
        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-4 col-span-2 lg:col-span-2">
          <p className="text-[11px] font-bold uppercase tracking-wide text-[var(--muted)]">Outros investimentos (ativos)</p>
          <p className="mt-1 text-[20px] font-bold text-[var(--ink)]">{formatCurrency(investAtual)}</p>
          <p className="text-[12px] text-[var(--muted)]">{investments.length} investimento{investments.length === 1 ? '' : 's'} ativo{investments.length === 1 ? '' : 's'}</p>
        </div>
      </div>

      <h2 className="text-[16px] font-bold text-[var(--ink)]">Estoque parado há mais tempo</h2>
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        {parado.length === 0 ? (
          <p className="py-6 text-center text-[13.5px] text-[var(--muted)]">Nenhum veículo em estoque.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                  <th className="pb-2.5">Veículo</th>
                  <th className="pb-2.5">Compra</th>
                  <th className="pb-2.5 text-right">Dias em estoque</th>
                  <th className="pb-2.5 text-right">Custo total</th>
                </tr>
              </thead>
              <tbody>
                {parado.map(({ v, dias }) => (
                  <tr key={v.id} className="border-b border-[var(--border)] last:border-none">
                    <td className="py-2.5">
                      <div className="flex items-center gap-2">
                        <TruckIcon className="h-4 w-4 text-[var(--muted)]" />
                        <span className="font-semibold text-[var(--ink)]">{vehicleLabel(v)}</span>
                        <span className="font-mono text-[12px] text-[var(--muted)]">{v.license_plate}</span>
                      </div>
                    </td>
                    <td className="py-2.5 text-[var(--ink-soft)]">{formatDate(v.purchase_date)}</td>
                    <td className={`py-2.5 text-right font-mono ${dias > 90 ? 'text-[var(--red-500)]' : ''}`}>{dias}</td>
                    <td className="py-2.5 text-right font-mono">{formatCurrency(vehicleCost(v))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {vendidos.length > 0 && (
        <>
          <h2 className="text-[16px] font-bold text-[var(--ink)]">Últimas vendas</h2>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                    <th className="pb-2.5">Veículo</th>
                    <th className="pb-2.5">Venda</th>
                    <th className="pb-2.5 text-right">Custo</th>
                    <th className="pb-2.5 text-right">Venda</th>
                    <th className="pb-2.5 text-right">Lucro</th>
                  </tr>
                </thead>
                <tbody>
                  {vendidos
                    .slice()
                    .sort((a, b) => (b.sale_date || '').localeCompare(a.sale_date || ''))
                    .slice(0, 8)
                    .map((v) => {
                      const cost = vehicleCost(v)
                      const profit = Number(v.sale_price || 0) - cost
                      return (
                        <tr key={v.id} className="border-b border-[var(--border)] last:border-none">
                          <td className="py-2.5">
                            <div className="flex items-center gap-2">
                              <CoinIcon className="h-4 w-4 text-[var(--muted)]" />
                              <span className="font-semibold text-[var(--ink)]">{vehicleLabel(v)}</span>
                            </div>
                          </td>
                          <td className="py-2.5 text-[var(--ink-soft)]">{formatDate(v.sale_date)}</td>
                          <td className="py-2.5 text-right font-mono">{formatCurrency(cost)}</td>
                          <td className="py-2.5 text-right font-mono">{formatCurrency(Number(v.sale_price || 0))}</td>
                          <td className={`py-2.5 text-right font-mono font-semibold ${profit >= 0 ? 'text-[var(--green-600)]' : 'text-[var(--red-500)]'}`}>
                            {formatCurrency(profit)}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}

      {investments.length > 0 && (
        <>
          <h2 className="flex items-center gap-2 text-[16px] font-bold text-[var(--ink)]">
            <TrendUpIcon className="h-4 w-4" />
            Outros investimentos ativos
          </h2>
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-[var(--border)] text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                    <th className="pb-2.5">Investimento</th>
                    <th className="pb-2.5 text-right">Aplicado</th>
                    <th className="pb-2.5 text-right">Valor atual</th>
                  </tr>
                </thead>
                <tbody>
                  {investments.map((x) => (
                    <tr key={x.id} className="border-b border-[var(--border)] last:border-none">
                      <td className="py-2.5 font-semibold text-[var(--ink)]">{x.name}</td>
                      <td className="py-2.5 text-right font-mono">{formatCurrency(Number(x.invested_amount || 0))}</td>
                      <td className="py-2.5 text-right font-mono">
                        {formatCurrency(Number(x.current_amount ?? x.invested_amount ?? 0))}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      )}
    </div>
  )
}
