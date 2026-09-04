import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { getCompanyName, type AuthCompany } from '../lib/auth'
import { formatDate } from '../lib/format'

export interface PurchaseStockPrintGroup {
  name: string
  items: { id: string; name: string }[]
}

interface PurchaseStockPrintModalProps {
  open: boolean
  company: AuthCompany
  groups: PurchaseStockPrintGroup[]
  onClose: () => void
}

export function PurchaseStockPrintModal({ open, company, groups, onClose }: PurchaseStockPrintModalProps) {
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

  const companyName = getCompanyName(company)
  const today = formatDate(new Date().toISOString())
  const fontFamily = '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif'

  return createPortal(
    <div className="print-area-root">
      <style>{`
        .print-area-root { display: none; }
        @media print {
          @page { margin: 10mm 8mm; }
          #root { display: none !important; }
          .print-area-root { display: block !important; }
          .print-group { break-inside: avoid; page-break-inside: avoid; }
        }
      `}</style>

      <div
        style={{
          display: 'flex',
          alignItems: 'flex-start',
          justifyContent: 'space-between',
          paddingBottom: 10,
          borderBottom: '1px solid #d1d5db',
          fontFamily,
        }}
      >
        <div>
          <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: '#111827' }}>{companyName}</p>
          <p style={{ margin: '2px 0 0', fontSize: 10.5, color: '#6b7280' }}>Lista de Estoque — Contagem Física</p>
        </div>
        <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>{today}</p>
      </div>

      {groups.length === 0 ? (
        <p style={{ marginTop: 16, fontSize: 11, color: '#6b7280', fontFamily }}>Nenhum produto na lista.</p>
      ) : (
        <div style={{ marginTop: 14, columnCount: 2, columnGap: 20 }}>
          {groups.map((group) => (
            <div key={group.name} className="print-group" style={{ marginBottom: 12 }}>
              <div
                style={{
                  background: '#8a9a8c',
                  color: '#ffffff',
                  textAlign: 'center',
                  fontWeight: 700,
                  fontSize: 11,
                  padding: '4px 0',
                  textTransform: 'uppercase',
                  fontFamily,
                }}
              >
                {group.name}
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 10.5, fontFamily }}>
                <thead>
                  <tr>
                    <th style={{ border: '1px solid #9ca3af', padding: '3px 6px', width: 56, fontWeight: 700, color: '#111827' }}>
                      ESTOQUE
                    </th>
                    <th style={{ border: '1px solid #9ca3af', padding: '3px 6px', textAlign: 'left', fontWeight: 700, color: '#111827' }}>
                      PRODUTO
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((product) => (
                    <tr key={product.id}>
                      <td style={{ border: '1px solid #9ca3af', padding: '5px 6px', height: 18 }} />
                      <td style={{ border: '1px solid #9ca3af', padding: '5px 6px', color: '#111827' }}>{product.name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}

      <div
        style={{
          marginTop: 24,
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 10.5,
          color: '#374151',
          fontFamily,
        }}
      >
        <span>Data: {today}</span>
        <span>Responsável: ______________________________</span>
      </div>
    </div>,
    document.body
  )
}
