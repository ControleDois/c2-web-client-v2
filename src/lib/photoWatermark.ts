// Marca d'água de data/hora + localização nas fotos — mesmo mecanismo usado
// nas vistorias de veículo (app-para-locadora/lib/photo-watermark.ts).

export function formatTimestamp(): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(new Date())
}

export async function getLocationLines(): Promise<string[]> {
  const position = await new Promise<GeolocationPosition | null>((resolve) => {
    if (!navigator.geolocation) {
      resolve(null)
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve(pos),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 10000 },
    )
  })

  if (!position) {
    return []
  }

  const { latitude, longitude } = position.coords

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`,
    )
    const data = await res.json()
    const addr = data?.address
    if (!addr) {
      return [`Lat: ${latitude.toFixed(5)}, Lng: ${longitude.toFixed(5)}`]
    }
    return [
      `${addr.road || ''}, ${addr.house_number || 'S/N'}`,
      addr.suburb || addr.neighbourhood || '',
      `${addr.city || addr.town || addr.village || ''} ${addr.state || ''}`,
      addr.postcode || '',
      addr.country || 'Brasil',
    ].filter((line) => line && line.trim() !== '' && line !== ', S/N')
  } catch {
    return [`Lat: ${latitude.toFixed(5)}, Lng: ${longitude.toFixed(5)}`]
  }
}

export function watermarkPhoto(file: File, lines: string[]): Promise<File> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    const objectUrl = URL.createObjectURL(file)

    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        URL.revokeObjectURL(objectUrl)
        resolve(file)
        return
      }

      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)

      const fontSize = Math.max(Math.floor(canvas.height * 0.03), 24)
      ctx.font = `${fontSize}px sans-serif`
      ctx.fillStyle = 'white'
      ctx.textAlign = 'right'
      ctx.shadowColor = 'rgba(0, 0, 0, 0.8)'
      ctx.shadowBlur = 6
      ctx.shadowOffsetX = 2
      ctx.shadowOffsetY = 2

      let y = fontSize + 20
      const x = canvas.width - 20
      for (const line of lines) {
        ctx.fillText(line, x, y)
        y += fontSize * 1.3
      }

      canvas.toBlob(
        (blob) => {
          URL.revokeObjectURL(objectUrl)
          if (!blob) {
            resolve(file)
            return
          }
          resolve(new File([blob], file.name, { type: 'image/jpeg' }))
        },
        'image/jpeg',
        0.85,
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      reject(new Error("Falha ao carregar a foto para aplicar a marca d'água."))
    }

    img.src = objectUrl
  })
}

// ---------- Carimbo de evidência (data/hora + GPS) ----------

export interface GeoFix {
  latitude: number
  longitude: number
  accuracy: number
}

export type GeoErrorKind = 'denied' | 'unavailable' | 'timeout'

export class GeoError extends Error {
  kind: GeoErrorKind

  constructor(kind: GeoErrorKind) {
    super(kind)
    this.kind = kind
  }
}

export function getCurrentFix(): Promise<GeoFix> {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) {
      reject(new GeoError('unavailable'))
      return
    }
    navigator.geolocation.getCurrentPosition(
      (pos) =>
        resolve({
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          accuracy: pos.coords.accuracy,
        }),
      (err) => reject(new GeoError(err.code === 1 ? 'denied' : err.code === 3 ? 'timeout' : 'unavailable')),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 30000 }
    )
  })
}

export function formatDateTime(date = new Date()): string {
  return new Intl.DateTimeFormat('pt-BR', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(date)
}

export function formatFixLine(fix: GeoFix): string {
  return `GPS ${fix.latitude.toFixed(6)}, ${fix.longitude.toFixed(6)} (±${Math.round(fix.accuracy)} m)`
}

// Endereço aproximado pelo OpenStreetMap - só complemento: se demorar ou
// falhar, o carimbo segue só com as coordenadas.
export async function reverseGeocodeLine(fix: GeoFix, timeoutMs = 3000): Promise<string | null> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=json&lat=${fix.latitude}&lon=${fix.longitude}&zoom=18&addressdetails=1`,
      { signal: controller.signal }
    )
    const addr = (await res.json())?.address
    if (!addr) return null
    const street = [addr.road, addr.house_number].filter(Boolean).join(', ')
    const city = [addr.city || addr.town || addr.village, addr.state].filter(Boolean).join(' - ')
    const line = [street, addr.suburb || addr.neighbourhood, city].filter(Boolean).join(' | ')
    return line || null
  } catch {
    return null
  } finally {
    clearTimeout(timer)
  }
}

export async function buildStampLines(fix: GeoFix | null, withAddress = true): Promise<string[]> {
  const lines = [formatDateTime()]
  if (!fix) {
    lines.push('Localização não disponível')
    return lines
  }
  lines.push(formatFixLine(fix))
  if (withAddress) {
    const address = await reverseGeocodeLine(fix)
    if (address) lines.push(address)
  }
  return lines
}

// Barra escura no rodapé com as linhas de evidência; a fonte encolhe até a
// linha mais longa caber na largura da imagem.
export function drawStampBar(canvas: HTMLCanvasElement, lines: string[]) {
  const ctx = canvas.getContext('2d')
  if (!ctx || !lines.length) return

  const padding = Math.round(canvas.width * 0.025)
  let fontSize = Math.max(14, Math.round(canvas.width * 0.032))
  const minFont = 10
  const fontFor = (size: number) => `600 ${size}px system-ui, sans-serif`

  while (fontSize > minFont) {
    ctx.font = fontFor(fontSize)
    if (Math.max(...lines.map((line) => ctx.measureText(line).width)) <= canvas.width - padding * 2) break
    fontSize -= 1
  }

  const lineHeight = Math.round(fontSize * 1.35)
  const barHeight = lineHeight * lines.length + padding
  ctx.fillStyle = 'rgba(0, 0, 0, 0.65)'
  ctx.fillRect(0, canvas.height - barHeight, canvas.width, barHeight)
  ctx.fillStyle = '#ffffff'
  ctx.font = fontFor(fontSize)
  ctx.textAlign = 'left'
  ctx.textBaseline = 'middle'
  lines.forEach((line, index) => {
    ctx.fillText(line, padding, canvas.height - barHeight + padding / 2 + lineHeight * index + lineHeight / 2)
  })
}

export function stampPhotoFile(file: File, lines: string[]): Promise<File> {
  return new Promise((resolve) => {
    const objectUrl = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(objectUrl)
      const canvas = document.createElement('canvas')
      canvas.width = img.naturalWidth
      canvas.height = img.naturalHeight
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(file)
        return
      }
      ctx.drawImage(img, 0, 0)
      drawStampBar(canvas, lines)
      canvas.toBlob(
        (blob) => resolve(blob ? new File([blob], file.name, { type: 'image/jpeg' }) : file),
        'image/jpeg',
        0.9
      )
    }

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl)
      resolve(file)
    }

    img.src = objectUrl
  })
}
