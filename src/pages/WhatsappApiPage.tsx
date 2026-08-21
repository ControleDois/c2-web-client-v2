import { useEffect, useState } from 'react'
import {
  fetchCompanyWhatsapps,
  createCompanyWhatsapp,
  updateCompanyWhatsapp,
  deleteCompanyWhatsapp,
  connectWhatsappInstance,
  whatsappInstanceStatus,
  disconnectWhatsappInstance,
  WHATSAPP_STATUS_CONNECTED,
  type CompanyWhatsappRecord,
} from '../lib/companyWhatsapp'
import { ApiError } from '../lib/api'
import { formatPhone } from '../lib/formatPhone'
import { TextField } from '../components/form/TextField'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { RowActionsMenu, type RowAction } from '../components/RowActionsMenu'
import {
  PlusIcon,
  TrashIcon,
  PencilIcon,
  WhatsappIcon,
  QrCodeIcon,
  CheckCircleIcon,
  XCircleIcon,
  CloseIcon,
} from '../components/icons'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface WhatsappApiPageProps {
  session: AuthSession
  company: AuthCompany
}

interface WhatsappFormState {
  id?: string
  name: string
  phone: string
  officialWhatsapp: boolean
  token: string
  sendBillPixButton: boolean
  sendBillBoletoDocument: boolean
  aiAgentActive: boolean
}

const EMPTY_FORM: WhatsappFormState = {
  name: '',
  phone: '',
  officialWhatsapp: false,
  token: '',
  sendBillPixButton: false,
  sendBillBoletoDocument: false,
  aiAgentActive: false,
}

const POLL_INTERVAL_MS = 2500
const POLL_MAX_ATTEMPTS = 30

export function WhatsappApiPage({ session, company }: WhatsappApiPageProps) {
  const [items, setItems] = useState<CompanyWhatsappRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)

  const [formOpen, setFormOpen] = useState(false)
  const [form, setForm] = useState<WhatsappFormState>(EMPTY_FORM)
  const [formSubmitting, setFormSubmitting] = useState(false)
  const [formError, setFormError] = useState<string | null>(null)

  const [deleteTarget, setDeleteTarget] = useState<CompanyWhatsappRecord | null>(null)
  const [deleting, setDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  const [connectTarget, setConnectTarget] = useState<CompanyWhatsappRecord | null>(null)
  const [qrCode, setQrCode] = useState<string | null>(null)
  const [connectLoading, setConnectLoading] = useState(false)
  const [connectError, setConnectError] = useState<string | null>(null)
  const [connected, setConnected] = useState(false)

  const [statusLoadingId, setStatusLoadingId] = useState<string | null>(null)
  const [autoCheckingIds, setAutoCheckingIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)

    fetchCompanyWhatsapps(session.token.token, company.id)
      .then(async (res) => {
        if (cancelled) return
        const list = res.data || []
        setItems(list)
        setLoading(false)

        const targets = list.filter((item) => !item.official_whatsapp)
        if (targets.length === 0) return

        setAutoCheckingIds(new Set(targets.map((item) => item.id)))
        const updates = await Promise.all(
          targets.map(async (item) => {
            try {
              const result = await whatsappInstanceStatus(session.token.token, item.id, company.id)
              const connected = result.connected || result.status === WHATSAPP_STATUS_CONNECTED
              return { id: item.id, status: connected ? WHATSAPP_STATUS_CONNECTED : 0 }
            } catch {
              return null
            }
          })
        )
        if (cancelled) return
        setItems((current) =>
          current.map((item) => {
            const update = updates.find((entry) => entry?.id === item.id)
            return update ? { ...item, status: update.status } : item
          })
        )
        setAutoCheckingIds(new Set())
      })
      .catch((err) => {
        if (cancelled) return
        setError(err instanceof ApiError ? err.message : 'Não foi possível carregar os números de WhatsApp.')
        setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [session.token.token, company.id, reloadKey])

  function reload() {
    setReloadKey((key) => key + 1)
  }

  function silentReload() {
    fetchCompanyWhatsapps(session.token.token, company.id)
      .then((res) => {
        setItems(res.data || [])
      })
      .catch(() => {})
  }

  function openCreateForm() {
    setForm(EMPTY_FORM)
    setFormError(null)
    setFormOpen(true)
  }

  function openEditForm(item: CompanyWhatsappRecord) {
    setForm({
      id: item.id,
      name: item.name,
      phone: formatPhone(item.phone),
      officialWhatsapp: item.official_whatsapp,
      token: item.token ?? '',
      sendBillPixButton: item.send_bill_pix_button,
      sendBillBoletoDocument: item.send_bill_boleto_document,
      aiAgentActive: item.ai_agent_active,
    })
    setFormError(null)
    setFormOpen(true)
  }

  async function handleFormSubmit() {
    if (!form.name.trim() || !form.phone.trim()) {
      setFormError('Preencha o nome e o número para continuar.')
      return
    }

    setFormSubmitting(true)
    setFormError(null)

    const payload = {
      company_id: company.id,
      name: form.name.trim(),
      phone: form.phone.replace(/\D/g, ''),
      official_whatsapp: form.officialWhatsapp,
      token: form.officialWhatsapp ? form.token.trim() : undefined,
      send_bill_pix_button: form.sendBillPixButton,
      send_bill_boleto_document: form.sendBillBoletoDocument,
      ai_agent_active: form.aiAgentActive,
    }

    try {
      if (form.id) {
        await updateCompanyWhatsapp(session.token.token, form.id, payload)
      } else {
        await createCompanyWhatsapp(session.token.token, payload)
      }
      setFormOpen(false)
      reload()
    } catch (err) {
      setFormError(err instanceof ApiError ? err.message : 'Não foi possível salvar o número.')
    } finally {
      setFormSubmitting(false)
    }
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return
    const deletedId = deleteTarget.id
    setDeleting(true)
    setDeleteError(null)
    try {
      await deleteCompanyWhatsapp(session.token.token, deletedId)
      setDeleteTarget(null)
      setItems((prev) => prev.filter((item) => item.id !== deletedId))
      silentReload()
    } catch (err) {
      setDeleteError(err instanceof ApiError ? err.message : 'Não foi possível remover o número.')
    } finally {
      setDeleting(false)
    }
  }

  function openConnect(item: CompanyWhatsappRecord) {
    setConnectTarget(item)
    setQrCode(null)
    setConnected(false)
    setConnectError(null)
    setConnectLoading(true)

    connectWhatsappInstance(session.token.token, item.id, company.id)
      .then((result) => {
        if (result.connected || result.status === WHATSAPP_STATUS_CONNECTED) {
          setConnected(true)
          return
        }
        if (result.qrCode) {
          setQrCode(normalizeQrCode(result.qrCode))
        }
        pollConnectionStatus(item.id, 1)
      })
      .catch((err) => {
        setConnectError(err instanceof ApiError ? err.message : 'Não foi possível conectar a instância.')
      })
      .finally(() => setConnectLoading(false))
  }

  function pollConnectionStatus(id: string, attempt: number) {
    if (attempt > POLL_MAX_ATTEMPTS) return

    setTimeout(() => {
      whatsappInstanceStatus(session.token.token, id, company.id)
        .then((result) => {
          if (result.connected || result.status === WHATSAPP_STATUS_CONNECTED) {
            setConnected(true)
            reload()
            return
          }
          if (result.qrCode) {
            setQrCode(normalizeQrCode(result.qrCode))
          }
          pollConnectionStatus(id, attempt + 1)
        })
        .catch(() => {
          pollConnectionStatus(id, attempt + 1)
        })
    }, POLL_INTERVAL_MS)
  }

  function normalizeQrCode(raw: string): string {
    return raw.startsWith('data:') ? raw : `data:image/png;base64,${raw}`
  }

  async function handleCheckStatus(item: CompanyWhatsappRecord) {
    setStatusLoadingId(item.id)
    try {
      await whatsappInstanceStatus(session.token.token, item.id, company.id)
      reload()
    } catch {
      // silencioso — o usuário pode tentar novamente pela linha
    } finally {
      setStatusLoadingId(null)
    }
  }

  async function handleDisconnect(item: CompanyWhatsappRecord) {
    setStatusLoadingId(item.id)
    try {
      await disconnectWhatsappInstance(session.token.token, item.id, company.id)
      reload()
    } catch {
      // silencioso — o usuário pode tentar novamente pela linha
    } finally {
      setStatusLoadingId(null)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Conta</p>
          <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">WhatsApp API</h1>
        </div>
        <button
          type="button"
          onClick={openCreateForm}
          className="flex items-center gap-2 rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)]"
        >
          <PlusIcon className="h-4 w-4" />
          Adicionar número
        </button>
      </div>

      {error && (
        <div className="rounded-2xl bg-[var(--red-100)] p-4 text-[13.5px] font-medium text-[var(--red-500)]">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
        {loading ? (
          <div className="flex flex-col gap-2.5">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-11 animate-pulse rounded-xl bg-[var(--page)]" />
            ))}
          </div>
        ) : items.length === 0 ? (
          <p className="py-10 text-center text-[13.5px] text-[var(--muted)]">Nenhum número de WhatsApp cadastrado.</p>
        ) : (
          <>
            <div className="flex flex-col gap-2.5 sm:hidden">
              {items.map((item) => {
                const isConnected = item.status === WHATSAPP_STATUS_CONNECTED
                const actions: RowAction[] = [
                  { key: 'edit', label: 'Editar', icon: <PencilIcon className="h-4 w-4" />, onClick: () => openEditForm(item) },
                ]
                if (!item.official_whatsapp) {
                  actions.push({
                    key: 'connect',
                    label: 'Conectar',
                    icon: <QrCodeIcon className="h-4 w-4" />,
                    onClick: () => openConnect(item),
                  })
                  actions.push({
                    key: 'status',
                    label: 'Verificar status',
                    icon: <CheckCircleIcon className="h-4 w-4" />,
                    onClick: () => handleCheckStatus(item),
                  })
                  if (isConnected) {
                    actions.push({
                      key: 'disconnect',
                      label: 'Desconectar',
                      icon: <XCircleIcon className="h-4 w-4" />,
                      tone: 'warning',
                      onClick: () => handleDisconnect(item),
                    })
                  }
                }
                actions.push({
                  key: 'delete',
                  label: 'Remover',
                  icon: <TrashIcon className="h-4 w-4" />,
                  tone: 'danger',
                  dividerBefore: true,
                  onClick: () => setDeleteTarget(item),
                })

                return (
                  <div key={item.id} className="rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="min-w-0 truncate text-[13.5px] font-bold text-[var(--ink)]">{item.name}</p>
                        <p className="mt-0.5 text-[12px] text-[var(--ink-soft)]">{formatPhone(item.phone)}</p>
                      </div>
                      <RowActionsMenu actions={actions} />
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-[10.5px] font-bold ${
                          item.official_whatsapp
                            ? 'bg-[var(--blue-100)] text-[var(--blue-700)]'
                            : 'bg-[var(--indigo-100)] text-[var(--indigo-500)]'
                        }`}
                      >
                        {item.official_whatsapp ? 'Oficial' : 'QR Code'}
                      </span>
                      {!item.official_whatsapp && (
                        statusLoadingId === item.id || autoCheckingIds.has(item.id) ? (
                          <span className="text-[11px] text-[var(--muted)]">Verificando…</span>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10.5px] font-bold ${
                              isConnected
                                ? 'bg-[var(--green-100)] text-[var(--green-600)]'
                                : 'bg-[var(--red-100)] text-[var(--red-500)]'
                            }`}
                          >
                            {isConnected ? <CheckCircleIcon className="h-3 w-3" /> : <XCircleIcon className="h-3 w-3" />}
                            {isConnected ? 'Conectado' : 'Desconectado'}
                          </span>
                        )
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
            <div className="hidden overflow-x-auto sm:block">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-b border-[var(--border)] text-left text-[11px] font-semibold tracking-wide text-[var(--muted)] uppercase">
                  <th className="pb-2.5 pl-3">Nome</th>
                  <th className="pb-2.5">Telefone</th>
                  <th className="pb-2.5">Tipo</th>
                  <th className="pb-2.5">Status</th>
                  <th className="pb-2.5 pr-3 text-right">Ações</th>
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => {
                  const isConnected = item.status === WHATSAPP_STATUS_CONNECTED
                  const actions: RowAction[] = [
                    { key: 'edit', label: 'Editar', icon: <PencilIcon className="h-4 w-4" />, onClick: () => openEditForm(item) },
                  ]
                  if (!item.official_whatsapp) {
                    actions.push({
                      key: 'connect',
                      label: 'Conectar',
                      icon: <QrCodeIcon className="h-4 w-4" />,
                      onClick: () => openConnect(item),
                    })
                    actions.push({
                      key: 'status',
                      label: 'Verificar status',
                      icon: <CheckCircleIcon className="h-4 w-4" />,
                      onClick: () => handleCheckStatus(item),
                    })
                    if (isConnected) {
                      actions.push({
                        key: 'disconnect',
                        label: 'Desconectar',
                        icon: <XCircleIcon className="h-4 w-4" />,
                        tone: 'warning',
                        onClick: () => handleDisconnect(item),
                      })
                    }
                  }
                  actions.push({
                    key: 'delete',
                    label: 'Remover',
                    icon: <TrashIcon className="h-4 w-4" />,
                    tone: 'danger',
                    dividerBefore: true,
                    onClick: () => setDeleteTarget(item),
                  })

                  return (
                    <tr
                      key={item.id}
                      className={`border-b border-[var(--border)] transition-colors last:border-none hover:bg-[var(--blue-100)] ${
                        index % 2 === 1 ? 'bg-[var(--page)]' : ''
                      }`}
                    >
                      <td className="py-2.5 pl-3 font-medium text-[var(--ink)]">{item.name}</td>
                      <td className="py-2.5 text-[var(--ink-soft)]">{formatPhone(item.phone)}</td>
                      <td className="py-2.5">
                        <span
                          className={`rounded-full px-2.5 py-1 text-[11px] font-bold ${
                            item.official_whatsapp
                              ? 'bg-[var(--blue-100)] text-[var(--blue-700)]'
                              : 'bg-[var(--indigo-100)] text-[var(--indigo-500)]'
                          }`}
                        >
                          {item.official_whatsapp ? 'Oficial' : 'QR Code'}
                        </span>
                      </td>
                      <td className="py-2.5">
                        {item.official_whatsapp ? (
                          <span className="text-[12px] text-[var(--muted)]">—</span>
                        ) : statusLoadingId === item.id || autoCheckingIds.has(item.id) ? (
                          <span className="text-[12px] text-[var(--muted)]">Verificando…</span>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-bold ${
                              isConnected
                                ? 'bg-[var(--green-100)] text-[var(--green-600)]'
                                : 'bg-[var(--red-100)] text-[var(--red-500)]'
                            }`}
                          >
                            {isConnected ? <CheckCircleIcon className="h-3 w-3" /> : <XCircleIcon className="h-3 w-3" />}
                            {isConnected ? 'Conectado' : 'Desconectado'}
                          </span>
                        )}
                      </td>
                      <td className="py-2.5 pr-3 text-right">
                        <RowActionsMenu actions={actions} />
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
            </div>
          </>
        )}
      </div>

      {formOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" onClick={() => setFormOpen(false)}>
          <div
            className="w-full max-w-[480px] rounded-2xl bg-[var(--surface)] p-6 shadow-[var(--card-shadow)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-bold text-[var(--ink)]">
                {form.id ? 'Editar número' : 'Adicionar número'}
              </h2>
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
                aria-label="Fechar"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-col gap-4">
              <TextField
                label="Nome do número"
                icon={<WhatsappIcon className="h-4 w-4" />}
                placeholder="Ex: Cobrança, Suporte"
                value={form.name}
                onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
              />
              <TextField
                label="Número do WhatsApp"
                icon={<WhatsappIcon className="h-4 w-4" />}
                placeholder="(65) 99999-9999"
                value={form.phone}
                onChange={(event) => setForm((current) => ({ ...current, phone: formatPhone(event.target.value) }))}
              />

              <label className="flex items-center gap-2.5">
                <input
                  type="checkbox"
                  checked={form.officialWhatsapp}
                  onChange={(event) => setForm((current) => ({ ...current, officialWhatsapp: event.target.checked }))}
                  className="h-4 w-4 accent-[var(--blue-500)]"
                />
                <span className="text-[13.5px] font-semibold text-[var(--ink)]">
                  Número oficial (Meta / WhatsApp Business API)
                </span>
              </label>

              {form.officialWhatsapp ? (
                <TextField
                  label="Token de acesso"
                  icon={<WhatsappIcon className="h-4 w-4" />}
                  type="password"
                  placeholder="Token da API oficial"
                  value={form.token}
                  onChange={(event) => setForm((current) => ({ ...current, token: event.target.value }))}
                />
              ) : (
                <div className="flex flex-col gap-2.5">
                  <label className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={form.sendBillPixButton}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, sendBillPixButton: event.target.checked }))
                      }
                      className="h-4 w-4 accent-[var(--blue-500)]"
                    />
                    <span className="text-[13.5px] font-semibold text-[var(--ink)]">Enviar botão PIX nas cobranças</span>
                  </label>
                  <label className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={form.sendBillBoletoDocument}
                      onChange={(event) =>
                        setForm((current) => ({ ...current, sendBillBoletoDocument: event.target.checked }))
                      }
                      className="h-4 w-4 accent-[var(--blue-500)]"
                    />
                    <span className="text-[13.5px] font-semibold text-[var(--ink)]">Enviar boleto em anexo nas cobranças</span>
                  </label>
                  <label className="flex items-center gap-2.5">
                    <input
                      type="checkbox"
                      checked={form.aiAgentActive}
                      onChange={(event) => setForm((current) => ({ ...current, aiAgentActive: event.target.checked }))}
                      className="h-4 w-4 accent-[var(--blue-500)]"
                    />
                    <span className="text-[13.5px] font-semibold text-[var(--ink)]">Agente de IA ativo</span>
                  </label>
                </div>
              )}

              {formError && <p className="text-[13px] font-medium text-[var(--red-500)]">{formError}</p>}
            </div>

            <div className="mt-6 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setFormOpen(false)}
                disabled={formSubmitting}
                className="rounded-xl px-4 py-2 text-[13.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)] disabled:opacity-60"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={handleFormSubmit}
                disabled={formSubmitting}
                className="rounded-xl bg-[var(--blue-500)] px-4 py-2 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
              >
                {formSubmitting ? 'Salvando…' : 'Salvar'}
              </button>
            </div>
          </div>
        </div>
      )}

      {connectTarget && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
          onClick={() => setConnectTarget(null)}
        >
          <div
            className="w-full max-w-[360px] rounded-2xl bg-[var(--surface)] p-6 text-center shadow-[var(--card-shadow)]"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between gap-3">
              <h2 className="text-[15px] font-bold text-[var(--ink)]">Conectar {connectTarget.name}</h2>
              <button
                type="button"
                onClick={() => setConnectTarget(null)}
                className="flex h-7 w-7 items-center justify-center rounded-lg text-[var(--muted)] hover:bg-[var(--page)] hover:text-[var(--ink)]"
                aria-label="Fechar"
              >
                <CloseIcon className="h-4 w-4" />
              </button>
            </div>

            {connected ? (
              <div className="flex flex-col items-center gap-3 py-6">
                <CheckCircleIcon className="h-10 w-10 text-[var(--green-600)]" />
                <p className="text-[13.5px] font-semibold text-[var(--ink)]">Número conectado com sucesso!</p>
              </div>
            ) : connectLoading ? (
              <p className="py-10 text-[13px] text-[var(--muted)]">Gerando QR Code…</p>
            ) : connectError ? (
              <p className="py-6 text-[13px] font-medium text-[var(--red-500)]">{connectError}</p>
            ) : qrCode ? (
              <div className="flex flex-col items-center gap-3">
                <img src={qrCode} alt="QR Code de conexão" className="h-56 w-56 rounded-xl border border-[var(--border)]" />
                <p className="text-[12.5px] text-[var(--muted)]">
                  Abra o WhatsApp no celular, vá em Aparelhos conectados e escaneie o código.
                </p>
              </div>
            ) : (
              <p className="py-10 text-[13px] text-[var(--muted)]">Aguardando QR Code…</p>
            )}
          </div>
        </div>
      )}

      <ConfirmDialog
        open={Boolean(deleteTarget)}
        title="Remover número"
        message={`Tem certeza que deseja remover "${deleteTarget?.name}"? Essa ação não pode ser desfeita.`}
        confirmLabel="Remover"
        loading={deleting}
        onConfirm={handleConfirmDelete}
        onCancel={() => {
          setDeleteTarget(null)
          setDeleteError(null)
        }}
      />

      {deleteError && (
        <div className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-xl bg-[var(--red-500)] px-4 py-2.5 text-[13px] font-semibold text-white shadow-lg">
          {deleteError}
        </div>
      )}
    </div>
  )
}
