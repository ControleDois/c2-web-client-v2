import { useEffect, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { getCompanyName, type AuthCompany } from '../lib/auth'

export interface PrintColumn {
  key: string
  label: string
  align?: 'left' | 'right'
}

interface PrintPreviewModalProps {
  open: boolean
  title: string
  subtitle?: string
  company: AuthCompany
  columns: PrintColumn[]
  rows: Record<string, ReactNode>[]
  onClose: () => void
}

export function PrintPreviewModal({ open, title, subtitle, company, columns, rows, onClose }: PrintPreviewModalProps) {
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

  return createPortal(
    <div className="print-area-root">
      <style>{`
        .print-area-root { display: none; }
        @media print {
          @page { margin: 0; }
          #root { display: none !important; }
          .print-area-root { display: block !important; }
        }
      `}</style>

      <div
        style={{
          fontFamily:
            '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif',
          background: '#ffffff',
          color: '#111827',
          padding: '18mm 14mm',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 22,
            paddingBottom: 16,
            borderBottom: '1px solid #e5e7eb',
          }}
        >
          <span
            style={{
              display: 'flex',
              height: 44,
              width: 44,
              flex: 'none',
              alignItems: 'center',
              justifyContent: 'center',
              overflow: 'hidden',
              borderRadius: 10,
              background: '#dbeafe',
              color: '#1d4ed8',
              fontWeight: 700,
              fontSize: 16,
            }}
          >
            {logoUrl ? (
              <img src={logoUrl} alt="" style={{ height: '100%', width: '100%', objectFit: 'cover' }} />
            ) : (
              companyName.charAt(0).toUpperCase()
            )}
          </span>
          <div>
            <h1 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: '#111827' }}>{title}</h1>
            {subtitle && (
              <p style={{ margin: '2px 0 0', fontSize: 12.5, color: '#6b7280' }}>{subtitle}</p>
            )}
          </div>
        </div>

        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12.5 }}>
          <thead>
            <tr>
              {columns.map((column) => (
                <th
                  key={column.key}
                  style={{
                    padding: '0 0 8px',
                    textAlign: column.align === 'right' ? 'right' : 'left',
                    fontSize: 10.5,
                    fontWeight: 700,
                    letterSpacing: 0.4,
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
            {rows.map((row, index) => (
              <tr key={index}>
                {columns.map((column) => (
                  <td
                    key={column.key}
                    style={{
                      padding: '8px 0',
                      textAlign: column.align === 'right' ? 'right' : 'left',
                      color: '#111827',
                      borderBottom: '1px solid #e5e7eb',
                    }}
                  >
                    {row[column.key] ?? '—'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>

        <p style={{ marginTop: 22, fontSize: 10.5, color: '#9ca3af' }}>
          {rows.length} registro{rows.length === 1 ? '' : 's'} · Gerado em {new Date().toLocaleString('pt-BR')}
        </p>
      </div>
    </div>,
    document.body
  )
}
