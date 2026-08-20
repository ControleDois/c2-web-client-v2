export async function downloadFromUrl(url: string, filename: string): Promise<void> {
  const response = await fetch(url)
  if (!response.ok) throw new Error('Não foi possível baixar o arquivo.')

  const blob = await response.blob()
  const objectUrl = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = objectUrl
  link.download = filename
  document.body.appendChild(link)
  link.click()
  link.remove()
  URL.revokeObjectURL(objectUrl)
}

export function isPdfUrl(url: string): boolean {
  return /\.pdf(\?|#|$)/i.test(url)
}

export function isImageUrl(url: string): boolean {
  return /\.(jpe?g|png|webp|gif|bmp|svg)(\?|#|$)/i.test(url)
}
