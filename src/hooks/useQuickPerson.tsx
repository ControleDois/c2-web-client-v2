import { useCallback, useState } from 'react'
import { QuickPersonModal, type QuickPersonRequest } from '../components/QuickPersonModal'
import type { AuthCompany, AuthSession } from '../lib/auth'

// Cadastro rápido de pessoa para qualquer campo de vínculo:
//   const quickPerson = useQuickPerson(session, company)
//   <SearchSelectField ... onCreate={(text) => quickPerson.request({ role: 2, name: text, onCreated: (p) => ... })} />
//   {quickPerson.modal}
export function useQuickPerson(session: AuthSession, company: AuthCompany) {
  const [request, setRequest] = useState<QuickPersonRequest | null>(null)
  const open = useCallback((next: QuickPersonRequest) => setRequest(next), [])
  const modal = <QuickPersonModal request={request} session={session} company={company} onClose={() => setRequest(null)} />
  return { request: open, modal }
}
