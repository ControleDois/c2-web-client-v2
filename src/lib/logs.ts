// Payloads de log costumam vir como string JSON — tenta parsear e reformatar
// com indentação; se não for JSON válido, mostra cru.
export function formatLogPayload(value: string | null | undefined): string {
  if (!value) return ''
  try {
    return JSON.stringify(JSON.parse(value), null, 2)
  } catch {
    return value
  }
}
