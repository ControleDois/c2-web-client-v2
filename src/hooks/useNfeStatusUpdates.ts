import { useEffect, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'
import { API_BASE_URL } from '../lib/api'

// O backend processa envio/consulta de NF-e em segundo plano (fila + cron) e
// avisa o resultado via socket ('message', {type:'nfe-status', data: nfe}) —
// sem isso, a tela só reflete o status final depois de um F5 manual.
export function useNfeStatusUpdates(companyId: string, onUpdate: (nfe: Record<string, unknown>) => void) {
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate

  useEffect(() => {
    if (!companyId) return

    const socket: Socket = io(API_BASE_URL, { transports: ['websocket', 'polling'] })

    socket.on('connect', () => {
      socket.emit('join:company', { companyId })
    })

    function handleMessage(payload: { type?: string; data?: Record<string, unknown> }) {
      if (payload?.type === 'nfe-status' && payload.data) {
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
