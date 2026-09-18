import { useEffect, useRef } from 'react'
import { io, type Socket } from 'socket.io-client'
import { API_BASE_URL } from '../lib/api'
import type { TimeClockEventRecord } from '../lib/timeClock'

// O backend emite 'time-clock:event' assim que o webhook do relógio de
// ponto recebe uma batida - sem isso, o painel só atualizaria com F5.
export function useTimeClockUpdates(companyId: string, onEvent: (event: TimeClockEventRecord) => void) {
  const onEventRef = useRef(onEvent)
  onEventRef.current = onEvent

  useEffect(() => {
    if (!companyId) return

    const socket: Socket = io(API_BASE_URL, { transports: ['websocket', 'polling'] })

    socket.on('connect', () => {
      socket.emit('join:company', { companyId })
    })

    function handleEvent(payload: {
      id: string
      device_id: string
      device_name: string | null
      people_id: string | null
      people_name: string | null
      external_user_id: string
      direction: 'in' | 'out' | 'unknown'
      occurred_at: string
    }) {
      onEventRef.current({
        id: payload.id,
        device_id: payload.device_id,
        device_name: payload.device_name,
        people_id: payload.people_id,
        people_name: payload.people_name,
        external_user_id: payload.external_user_id,
        direction: payload.direction,
        occurred_at: payload.occurred_at,
      })
    }

    socket.on('time-clock:event', handleEvent)

    return () => {
      socket.off('time-clock:event', handleEvent)
      socket.disconnect()
    }
  }, [companyId])
}
