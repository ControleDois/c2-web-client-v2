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
