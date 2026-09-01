import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { getCompanyName, type AuthCompany } from '../lib/auth'
import { formatDocument } from '../lib/formatDocument'
import { formatPhone } from '../lib/formatPhone'
import { formatCep } from '../lib/formatCep'

function formatCompanyAddress(address: Record<string, unknown> | null | undefined): string {
  if (!address) return ''
  const street = [address.address, address.number].filter(Boolean).join(', ')
  const districtCity = [address.district, address.city && address.state ? `${address.city}/${address.state}` : address.city]
    .filter(Boolean)
    .join(' - ')
  const zip = address.zip_code ? `CEP ${formatCep(String(address.zip_code))}` : ''
  return [street, districtCity, zip].filter(Boolean).join(' - ')
}

export interface PrintColumn {
  key: string
  label: string
  align?: 'left' | 'right'
}

interface PrintPreviewModalProps {
  open: boolean
  title: string
  subtitle?: string
  headerDetails?: { label: string; value: string }[]
  company: AuthCompany
  columns: PrintColumn[]
  rows: Record<string, ReactNode>[]
  // Conteúdo extra opcional, anexado dentro da célula da coluna indicada por
  // detailColumnKey (ex.: fornecedor/observação de uma peça, embaixo da
  // descrição) — não cria linha própria, pra nunca separar do resto do item
  // numa quebra de página. Retorne null/undefined pra não mostrar nada.
  rowDetail?: (row: Record<string, ReactNode>) => ReactNode
  detailColumnKey?: string
  // Linhas de total exibidas no rodapé da tabela (ex.: subtotal de peças,
  // subtotal de serviços, total geral). A última entrada com emphasis=true
  // é destacada como o total final.
  totals?: { label: string; value: string; emphasis?: boolean }[]
  onClose: () => void
}

export function PrintPreviewModal({
  open,
  title,
  subtitle,
  headerDetails,
  company,
  columns,
  rows,
  rowDetail,
  detailColumnKey,
  totals,
  onClose,
}: PrintPreviewModalProps) {
  const triggeredRef = useRef(false)
  const onCloseRef = useRef(onClose)
  onCloseRef.current = onClose

  useEffect(() => {
    if (!open) {
      triggeredRef.current = false
      return
    }
    if (triggeredRef.current) return
    triggeredRef.current = true

    function handleAfterPrint() {
      onCloseRef.current()
    }
    window.addEventListener('afterprint', handleAfterPrint)

    const timeout = setTimeout(() => window.print(), 50)

    return () => {
      window.removeEventListener('afterprint', handleAfterPrint)
      clearTimeout(timeout)
    }
    // onClose is read via onCloseRef so identity changes don't tear down/reschedule the print timer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  if (!open) return null

  const logoUrl = company.people?.file_url
  const companyName = getCompanyName(company)
  const companyDocument = company.people?.document ? formatDocument(String(company.people.document)) : ''
  const companyPhone = company.people?.phone ? formatPhone(String(company.people.phone)) : ''
  const companyAddress = formatCompanyAddress(company.people?.address as Record<string, unknown> | null | undefined)
  const resolvedDetailColumnKey = detailColumnKey ?? columns[0]?.key

  return createPortal(
    <div className="print-area-root">
      <style>{`
        .print-area-root { display: none; }
        @media print {
          @page { margin: 12mm 14mm; }
          #root { display: none !important; }
          .print-area-root { display: block !important; }
          .print-row { break-inside: avoid; page-break-inside: avoid; }
          .print-footer-block { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <table
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          fontSize: 11,
          fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          background: '#ffffff',
          color: '#111827',
        }}
      >
        <thead>
          <tr>
            <th colSpan={columns.length} style={{ padding: 0, fontWeight: 400, textAlign: 'left' }}>
              <div
                style={{
                  display: 'flex',
                  alignItems: 'flex-start',
                  justifyContent: 'space-between',
                  gap: 14,
                  paddingBottom: 12,
                  borderBottom: '1px solid #e5e7eb',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span
                    style={{
                      display: 'flex',
                      height: 38,
                      width: 38,
                      flex: 'none',
                      alignItems: 'center',
                      justifyContent: 'center',
                      overflow: 'hidden',
                      borderRadius: 8,
                      background: '#dbeafe',
                      color: '#1d4ed8',
                      fontWeight: 700,
                      fontSize: 14,
                    }}
                  >
                    {logoUrl ? (
                      <img src={logoUrl} alt="" style={{ height: '100%', width: '100%', objectFit: 'cover' }} />
                    ) : (
                      companyName.charAt(0).toUpperCase()
                    )}
                  </span>
                  <div>
                    <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: '#111827' }}>{companyName}</p>
                    <p style={{ margin: '2px 0 0', fontSize: 9.5, color: '#6b7280', lineHeight: 1.5 }}>
                      {[companyDocument && `CNPJ/CPF: ${companyDocument}`, companyAddress, companyPhone && `Tel: ${companyPhone}`]
                        .filter(Boolean)
                        .join(' · ')}
                    </p>
                  </div>
                </div>
                <div style={{ textAlign: 'right', flex: 'none' }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>{title}</p>
                  {subtitle && <p style={{ margin: '2px 0 0', fontSize: 10.5, color: '#6b7280' }}>{subtitle}</p>}
                </div>
              </div>

              {headerDetails && headerDetails.length > 0 && (
                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns: 'repeat(2, 1fr)',
                    gap: '6px 24px',
                    padding: '10px 0',
                    borderBottom: '1px solid #e5e7eb',
                  }}
                >
                  {headerDetails.map((detail) => (
                    <div key={detail.label} style={{ gridColumn: detail.label === 'Descrição do serviço' ? '1 / -1' : undefined }}>
                      <span style={{ fontSize: 9, fontWeight: 700, letterSpacing: 0.3, color: '#6b7280', textTransform: 'uppercase' }}>
                        {detail.label}:
                      </span>{' '}
                      <span style={{ fontSize: 11, color: '#111827' }}>{detail.value || '—'}</span>
                    </div>
                  ))}
                </div>
              )}
            </th>
          </tr>
          <tr>
            {columns.map((column) => (
              <th
                key={column.key}
                style={{
                  padding: '8px 0 6px',
                  textAlign: column.align === 'right' ? 'right' : 'left',
                  fontSize: 9,
                  fontWeight: 700,
                  letterSpacing: 0.3,
                  color: '#6b7280',
                  textTransform: 'uppercase',
                  borderBottom: '1px solid #d1d5db',
                }}
              >
                {column.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const detail = rowDetail?.(row)
            return (
              <tr key={index} className="print-row">
                {columns.map((column) => (
                  <td
                    key={column.key}
                    style={{
                      padding: '7px 0',
                      textAlign: column.align === 'right' ? 'right' : 'left',
                      verticalAlign: 'top',
                      color: '#111827',
                      borderBottom: '1px solid #e5e7eb',
                    }}
                  >
                    {row[column.key] ?? '—'}
                    {detail && column.key === resolvedDetailColumnKey && (
                      <div style={{ marginTop: 3, fontSize: 9.5, color: '#6b7280', fontWeight: 400 }}>{detail}</div>
                    )}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
        {totals && totals.length > 0 && (
          <tfoot>
            <tr>
              <td colSpan={columns.length} style={{ padding: 0 }}>
                <div className="print-footer-block" style={{ display: 'flex', justifyContent: 'flex-end', paddingTop: 10 }}>
                  <div style={{ minWidth: 200 }}>
                    {totals.map((total, index) => (
                      <div
                        key={total.label}
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          gap: 20,
                          padding: total.emphasis ? '6px 0 0' : '3px 0',
                          marginTop: total.emphasis ? 4 : 0,
                          borderTop: total.emphasis ? '1px solid #d1d5db' : index === 0 ? 'none' : undefined,
                          fontSize: total.emphasis ? 12.5 : 10.5,
                          fontWeight: total.emphasis ? 700 : 500,
                          color: total.emphasis ? '#111827' : '#4b5563',
                        }}
                      >
                        <span>{total.label}</span>
                        <span>{total.value}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </td>
            </tr>
          </tfoot>
        )}
      </table>
      <p style={{ marginTop: 16, fontSize: 9, color: '#9ca3af', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif' }}>
        {rows.length} registro{rows.length === 1 ? '' : 's'} · Gerado em {new Date().toLocaleString('pt-BR')}
      </p>
    </div>,
    document.body
  )
}
