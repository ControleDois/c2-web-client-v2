import { useEffect, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'
import { API_BASE_URL } from '../lib/api'
import type { NfeManifestSyncJob } from '../lib/nfeManifests'

// A consulta de novas notas ("Consultar notas") roda em segundo plano
// (fila + callback assíncrono do provedor) — sem isso, a tela só saberia
// que o job terminou depois de um F5 manual.
export function useNfeManifestSyncUpdates(companyId: string, onUpdate: (job: NfeManifestSyncJob) => void) {
  const onUpdateRef = useRef(onUpdate)
  onUpdateRef.current = onUpdate

  useEffect(() => {
    if (!companyId) return

    const socket: Socket = io(API_BASE_URL, { transports: ['websocket', 'polling'] })

    socket.on('connect', () => {
      socket.emit('join:company', { companyId })
    })

    function handleMessage(payload: { type?: string; data?: NfeManifestSyncJob }) {
      if (payload?.type === 'nfe-manifest-sync-status' && payload.data) {
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
