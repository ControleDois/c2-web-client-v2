export function formatPhone(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 11)
  const isMobile = digits.length > 10
  const ddd = digits.slice(0, 2)
  const firstPart = isMobile ? digits.slice(2, 7) : digits.slice(2, 6)
  const secondPart = isMobile ? digits.slice(7, 11) : digits.slice(6, 10)

  let result = ddd
  if (firstPart) result = `(${ddd}) ${firstPart}`
  if (secondPart) result += '-' + secondPart
  return result
}
