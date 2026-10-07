import { SupportContractPreviewModal } from '../../components/SupportContractPreviewModal'
import { SupportContractSendModal } from '../../components/SupportContractSendModal'
import { SupportContractTimelineModal } from '../../components/SupportContractTimelineModal'
import { SupportContractSignatureModal } from '../../components/SupportContractSignatureModal'
import type { GlassOrderRecord } from '../../lib/glass'
import type { AuthCompany, AuthSession } from '../../lib/auth'

export type GlassContractMode = 'preview' | 'send' | 'timeline' | 'evidence'

export interface GlassContractTarget {
  mode: GlassContractMode
  order: Pick<GlassOrderRecord, 'id' | 'people' | 'meta'>
}

interface GlassContractModalsProps {
  session: AuthSession
  company: AuthCompany
  target: GlassContractTarget | null
  onClose: () => void
  onSent: (message: string) => void
}

// Reaproveita os modais de contrato do suporte/empréstimo com o fluxo "glass".
export function GlassContractModals({ session, company, target, onClose, onSent }: GlassContractModalsProps) {
  const order = target?.order ?? null
  const person = order ? { id: order.id, people: order.people ? { name: order.people.name } : null } : null

  return (
    <>
      <SupportContractPreviewModal
        open={target?.mode === 'preview'}
        session={session}
        company={company}
        contract={person as never}
        flow="glass"
        onClose={onClose}
      />
      <SupportContractSendModal
        open={target?.mode === 'send'}
        session={session}
        company={company}
        contract={order ? { id: order.id, meta: { contract_sent: Boolean(order.meta?.contract) } } : null}
        flow="glass"
        onClose={onClose}
        onSent={onSent}
      />
      <SupportContractTimelineModal
        open={target?.mode === 'timeline'}
        session={session}
        contract={person}
        flow="glass"
        onClose={onClose}
      />
      <SupportContractSignatureModal
        open={target?.mode === 'evidence'}
        session={session}
        contract={person}
        flow="glass"
        onClose={onClose}
      />
    </>
  )
}
