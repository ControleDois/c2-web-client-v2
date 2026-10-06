import { ApiError } from './api'

export interface PendencyGroup {
  label: string
  items: string[]
}

export interface Pendencies {
  title: string
  total: number
  groups: PendencyGroup[]
}

function messageOf(item: unknown): string {
  if (typeof item === 'string') return item
  if (item && typeof item === 'object' && 'message' in item && typeof item.message === 'string') return item.message
  return ''
}

// Pendências do servidor vêm como "Cliente: preencha ...", "Produto 1 (X): ...";
// o trecho antes do primeiro ": " vira o título do grupo.
function splitGroup(message: string): { label: string; text: string } {
  const index = message.indexOf(': ')
  if (index > 0 && index <= 60) {
    return { label: message.slice(0, index), text: message.slice(index + 2) }
  }
  return { label: 'Geral', text: message }
}

// Só considera "pendências" quando o servidor devolveu uma lista (mais de um
// erro, ou a mensagem fala em pendências) — erro simples continua no aviso comum.
export function extractPendencies(err: unknown): Pendencies | null {
  if (!(err instanceof ApiError) || !err.body || typeof err.body !== 'object') return null
  const body = err.body as { message?: unknown; errors?: unknown }
  if (!Array.isArray(body.errors)) return null

  const messages = body.errors.map(messageOf).filter(Boolean)
  const title = typeof body.message === 'string' ? body.message : ''
  const isPendencyList = messages.length > 1 || /pendência/i.test(title)
  if (!messages.length || !isPendencyList) return null

  const groups: PendencyGroup[] = []
  for (const message of messages) {
    const { label, text } = splitGroup(message)
    const group = groups.find((item) => item.label === label)
    if (group) group.items.push(text)
    else groups.push({ label, items: [text] })
  }

  return { title: title || 'Existem pendências para corrigir.', total: messages.length, groups }
}
