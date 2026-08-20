export function formatCep(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  const parts = [digits.slice(0, 5), digits.slice(5, 8)]

  let result = parts[0]
  if (parts[1]) result += '-' + parts[1]
  return result
}
