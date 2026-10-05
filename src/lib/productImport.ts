import { readSheet } from 'read-excel-file/browser'
import { apiPost } from './api'

export interface HeroRow {
  id: string | number | null
  name: string | null
  category: string | null
  supplier: string | null
  stock: number | string | null
  cost: number | string | null
  pricePickup: number | string | null
  priceDelivery: number | string | null
  ean: string | number | null
  cfop: string | number | null
  ncm: string | number | null
  cest: string | number | null
}

export interface ImportPreview {
  totals: { rows: number; valid: number; invalid: number; create: number; update: number; duplicates: number }
  categories: { total: number; new: number; items: { name: string; count: number; exists: boolean }[] }
  stock: { productsWithStock: number; units: number; costValue: number }
  warnings: {
    noPrice: number
    noCategory: number
    noBarcode: number
    costAbovePrice: number
    suspiciousPrices: { name: string; price: number }[]
    suspiciousCount: number
    ncmNotFound: string[]
    duplicates: string[]
  }
}

export interface ImportBatchResult {
  created: number
  updated: number
  skipped: number
  stockEntries: number
  forcedZero: number
  errors: { name: string; error: string }[]
  stockError: string | null
}

// Cabeçalhos da planilha "Exportar Produtos Cadastrados" do Hero Delivery.
const COLUMN_MAP: Record<string, keyof HeroRow> = {
  id: 'id',
  nome: 'name',
  categoria: 'category',
  fornecedor: 'supplier',
  'quantidade em estoque': 'stock',
  'custo unitário': 'cost',
  'custo unitario': 'cost',
  'valor de retirada': 'pricePickup',
  'valor de entrega': 'priceDelivery',
  cean: 'ean',
  cfop: 'cfop',
  ncm: 'ncm',
  cest: 'cest',
}

export async function parseHeroSpreadsheet(file: File): Promise<HeroRow[]> {
  const data = await readSheet(file)
  if (!data.length) throw new Error('A planilha está vazia.')

  const header = data[0].map((cell) =>
    String(cell ?? '')
      .trim()
      .toLowerCase()
  )
  const indexes = new Map<keyof HeroRow, number>()
  header.forEach((title, index) => {
    const field = COLUMN_MAP[title]
    if (field && !indexes.has(field)) indexes.set(field, index)
  })

  if (!indexes.has('name') || (!indexes.has('pricePickup') && !indexes.has('priceDelivery'))) {
    throw new Error('Não parece a planilha de produtos do Hero (faltam as colunas NOME e Valor de Retirada).')
  }

  const rows: HeroRow[] = []
  for (const line of data.slice(1)) {
    if (!line.some((cell) => cell !== null && cell !== undefined && cell !== '')) continue
    const row: HeroRow = {
      id: null,
      name: null,
      category: null,
      supplier: null,
      stock: null,
      cost: null,
      pricePickup: null,
      priceDelivery: null,
      ean: null,
      cfop: null,
      ncm: null,
      cest: null,
    }
    for (const [field, index] of indexes) {
      const value = line[index]
      ;(row as unknown as Record<string, unknown>)[field] = value === undefined ? null : (value as unknown)
    }
    rows.push(row)
  }
  return rows
}

export function previewHeroImport(token: string, companyId: string, rows: HeroRow[]) {
  return apiPost<ImportPreview>('/product-import/hero/preview', { companyId, rows }, token)
}

export function applyHeroImport(
  token: string,
  companyId: string,
  rows: HeroRow[],
  options: { importStock: boolean; suspiciousAsZero: boolean }
) {
  return apiPost<ImportBatchResult>('/product-import/hero/apply', { companyId, rows, ...options }, token)
}
