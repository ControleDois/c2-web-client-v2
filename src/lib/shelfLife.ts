import { apiGet, apiPost } from './api'

// Controle de validade de produtos abertos: produtos com validade depois de aberto e as
// etiquetas impressas (data de abertura e de vencimento).

export interface ShelfLifeProduct {
  id: string
  code?: number
  name: string
  barcode?: string | null
  unit?: string | null
  opened_shelf_life: number
  opened_shelf_life_unit: 'hours' | 'days'
  storage_condition?: string | null
}

export interface ShelfLifeLabelRecord {
  id: string
  code?: number
  product_id: string
  product_name: string
  opened_at: string
  expires_at: string
  quantity: number
  responsible?: string | null
  storage_condition?: string | null
}

interface Paginated<T> {
  data: T[]
  meta?: { total: number; per_page: number; current_page: number; last_page: number }
}

export function fetchShelfLifeProducts(token: string, companyId: string, search?: string) {
  return apiGet<ShelfLifeProduct[]>('/shelf-life/products', { companyId, search: search || undefined }, token)
}

export function fetchShelfLifeLabels(token: string, companyId: string, page = 1) {
  return apiGet<Paginated<ShelfLifeLabelRecord>>('/shelf-life/labels', { companyId, page: String(page), limit: '30' }, token)
}

export function createShelfLifeLabels(
  token: string,
  payload: { companyId: string; responsible?: string; openedAt?: string; items: { productId: string; quantity: number }[] }
) {
  return apiPost<ShelfLifeLabelRecord[]>('/shelf-life/labels', payload, token)
}

export function shelfLifeText(product: Pick<ShelfLifeProduct, 'opened_shelf_life' | 'opened_shelf_life_unit'>) {
  const n = product.opened_shelf_life
  return product.opened_shelf_life_unit === 'hours' ? `${n} ${n === 1 ? 'hora' : 'horas'}` : `${n} ${n === 1 ? 'dia' : 'dias'}`
}

const dateTime = (iso: string) =>
  new Date(iso).toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })

const escape = (value: string) =>
  value.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] as string)

// Imprime as etiquetas (uma página por etiqueta, no tamanho configurado) pela impressora escolhida
// na janela de impressão do navegador — a térmica de etiquetas.
export function printShelfLifeLabels(
  labels: ShelfLifeLabelRecord[],
  options: { widthMm: number; heightMm: number; companyName: string }
) {
  const { widthMm: w, heightMm: h } = options
  const small = h < 32
  const pages = labels.flatMap((label) =>
    Array.from({ length: Math.max(1, label.quantity) }, () => {
      return `<section class="label">
        <div class="name">${escape(label.product_name)}</div>
        <div class="row"><span>ABERTO EM</span><b>${dateTime(label.opened_at)}</b></div>
        <div class="row due"><span>VALIDADE</span><b>${dateTime(label.expires_at)}</b></div>
        ${label.storage_condition && !small ? `<div class="info">${escape(label.storage_condition)}</div>` : ''}
        <div class="foot">${label.responsible ? `Resp.: ${escape(label.responsible)}` : ''}${
          label.responsible && !small ? ' · ' : ''
        }${small ? '' : escape(options.companyName)}</div>
      </section>`
    })
  )
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>Etiquetas de validade</title><style>
    @page { size: ${w}mm ${h}mm; margin: 0 }
    * { box-sizing: border-box; margin: 0; padding: 0; -webkit-print-color-adjust: exact; print-color-adjust: exact }
    html, body { width: ${w}mm; font-family: Arial, Helvetica, sans-serif; color: #000 }
    .label { width: ${w}mm; height: ${h}mm; padding: ${small ? 1.2 : 2}mm ${small ? 1.5 : 2.5}mm; display: flex; flex-direction: column;
      justify-content: space-between; page-break-after: always; break-after: page; overflow: hidden }
    .label:last-child { page-break-after: auto; break-after: auto }
    .name { font-weight: 800; font-size: ${small ? 8.5 : Math.min(13, w / 5)}pt; line-height: 1.1; text-transform: uppercase;
      border-bottom: 0.35mm solid #000; padding-bottom: 0.8mm; max-height: 2.4em; overflow: hidden }
    .row { display: flex; justify-content: space-between; align-items: baseline; gap: 1mm; font-size: ${small ? 7 : 8.5}pt }
    .row span { font-weight: 700 }
    .row b { font-size: ${small ? 7.5 : 9.5}pt }
    .due { border: 0.5mm solid #000; padding: 0.5mm 1mm; border-radius: 0.8mm; font-weight: 900 }
    .due span, .due b { font-weight: 900 }
    .due b { font-size: ${small ? 9 : 11.5}pt }
    .info { font-size: ${small ? 6.5 : 7.5}pt }
    .foot { font-size: ${small ? 6 : 7}pt; color: #222; white-space: nowrap; overflow: hidden; text-overflow: ellipsis }
    @media screen { body { background: #ddd; padding: 8px } .label { background: #fff; margin: 0 0 8px; box-shadow: 0 1px 3px rgba(0,0,0,.3) } }
  </style></head><body>${pages.join('')}</body></html>`

  const frame = document.createElement('iframe')
  frame.style.position = 'fixed'
  frame.style.right = '0'
  frame.style.bottom = '0'
  frame.style.width = '0'
  frame.style.height = '0'
  frame.style.border = '0'
  document.body.appendChild(frame)
  const doc = frame.contentDocument!
  doc.open()
  doc.write(html)
  doc.close()
  setTimeout(() => {
    frame.contentWindow?.focus()
    frame.contentWindow?.print()
    setTimeout(() => frame.remove(), 60_000)
  }, 250)
  return html
}
