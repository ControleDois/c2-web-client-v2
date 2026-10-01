import { useEffect, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'
import { API_BASE_URL } from '../lib/api'

// Mesma ideia de useNfeStatusUpdates.ts: o backend processa envio/consulta
// de NFS-e em segundo plano (fila + cron, ou callback do servidor Delphi) e
// avisa o resultado via socket ('message', {type:'nfse-status', data: nfse}).
export function useNfseStatusUpdates(companyId: string, onUpdate: (nfse: Record<string, unknown>) => void) {
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate

  useEffect(() => {
    if (!companyId) return

    const socket: Socket = io(API_BASE_URL, { transports: ['websocket', 'polling'] })

    socket.on('connect', () => {
      socket.emit('join:company', { companyId })
    })

    function handleMessage(payload: { type?: string; data?: Record<string, unknown> }) {
      if (payload?.type === 'nfse-status' && payload.data) {
        onUpdateRef.current(payload.data)
      }
    }

    socket.on('message', handleMessage)

    return () => {
      socket.off('message', handleMessage)
      socket.disconnect()
    }
  }, [companyId])
}
