import { useEffect, useState, type FormEvent } from 'react'
import type { AuthCompany, AuthSession } from '../lib/auth'
import { ApiError } from '../lib/api'
import { fetchCepData } from '../lib/cepLookup'
import { formatCurrency, formatDateTime } from '../lib/format'
import { fetchAccountingLink, type AccountingLink } from '../lib/accounting'
import {
  downloadSpedFile,
  downloadStoredSped,
  fetchSpedFiles,
  generateSpedFiscal,
  loadSavedAccountant,
  saveAccountant,
  type SpedAccountant,
  type SpedFiscalFile,
  type SpedFiscalResult,
} from '../lib/spedFiscal'
import { TextField } from '../components/form/TextField'
import { SelectField } from '../components/form/SelectField'
import { SectionCard } from '../components/SectionCard'
import { BadgeIcon, BuildingIcon, CalendarIcon, CoinIcon, MailIcon, MapPinIcon, PhoneIcon, TagIcon, UserIcon } from '../components/icons'

interface SpedFiscalPageProps {
  session: AuthSession
  company: AuthCompany
}

function previousMonth(): string {
  const now = new Date()
  const date = new Date(now.getFullYear(), now.getMonth() - 1, 1)
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`
}

function lastDayOfPreviousYear(): string {
  return `${new Date().getFullYear() - 1}-12-31`
}

function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="rounded-xl bg-[var(--page)] px-4 py-3">
      <p className="text-[11px] font-bold tracking-wide text-[var(--muted)] uppercase">{label}</p>
      <p className="mt-0.5 text-[18px] font-bold text-[var(--ink)]">{value}</p>
      {hint && <p className="text-[12px] text-[var(--ink-soft)]">{hint}</p>}
    </div>
  )
}

export function SpedFiscalPage({ session, company }: SpedFiscalPageProps) {
  const [month, setMonth] = useState(previousMonth)
  const [profile, setProfile] = useState<'A' | 'B' | 'C'>('A')
  const [activity, setActivity] = useState<0 | 1>(1)
  const [purpose, setPurpose] = useState<0 | 1>(0)
  const [withInventory, setWithInventory] = useState(false)
  const [inventoryDate, setInventoryDate] = useState(lastDayOfPreviousYear)
  const [accountant, setAccountant] = useState<SpedAccountant>(() => loadSavedAccountant(company.id))
  const [previousCredit, setPreviousCredit] = useState('')
  const [revenueCode, setRevenueCode] = useState('')
  const [dueDate, setDueDate] = useState('')
  const [cepLoading, setCepLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [result, setResult] = useState<SpedFiscalResult | null>(null)
  const [linkedAccountant, setLinkedAccountant] = useState<AccountingLink | null>(null)

  useEffect(() => {
    fetchAccountingLink(session.token.token, company.id)
      .then((res) => setLinkedAccountant(res.link))
      .catch(() => setLinkedAccountant(null))
  }, [session.token.token, company.id])

  const [files, setFiles] = useState<SpedFiscalFile[] | null>(null)
  const [downloadingId, setDownloadingId] = useState<string | null>(null)

  function loadFiles() {
    fetchSpedFiles(session.token.token, company.id)
      .then(setFiles)
      .catch(() => setFiles([]))
  }

  useEffect(loadFiles, [session.token.token, company.id])

  async function handleDownloadStored(file: SpedFiscalFile) {
    setDownloadingId(file.id)
    try {
      await downloadStoredSped(session.token.token, company.id, file)
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível baixar o arquivo.')
    } finally {
      setDownloadingId(null)
    }
  }

  function patchAccountant(patch: Partial<SpedAccountant>) {
    setAccountant((current) => ({ ...current, ...patch }))
  }

  async function lookupCep() {
    if (accountant.zip_code.replace(/\D/g, '').length !== 8) return
    setCepLoading(true)
    try {
      const data = await fetchCepData(accountant.zip_code)
      patchAccountant({ address: data.street, district: data.district, code_ibge: data.codeIbge })
    } catch {
      setError('CEP do contador não encontrado.')
    } finally {
      setCepLoading(false)
    }
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)
    setResult(null)
    setGenerating(true)
    if (!linkedAccountant?.accountant) saveAccountant(company.id, accountant)
    try {
      const generated = await generateSpedFiscal(session.token.token, {
        company_id: company.id,
        month,
        profile,
        activity,
        purpose,
        inventory_date: withInventory ? inventoryDate : undefined,
        accountant,
        previous_credit_balance: previousCredit ? Number(previousCredit.replace(',', '.')) : undefined,
        revenue_code: revenueCode || undefined,
        due_date: dueDate || undefined,
      })
      setResult(generated)
      downloadSpedFile(generated)
      loadFiles()
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Não foi possível gerar o SPED Fiscal.')
    } finally {
      setGenerating(false)
    }
  }

  const summary = result?.summary

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Fiscal</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">SPED Fiscal</h1>
        <p className="mt-1 max-w-3xl text-[13.5px] text-[var(--ink-soft)]">
          Gera o arquivo da EFD ICMS/IPI do mês a partir das notas: saídas pelas NF-e e NFC-e emitidas e entradas pelas
          notas recebidas no Manifesto NF-e. Entregue o arquivo ao contador para validar e transmitir no PVA.
        </p>
      </div>

      <SectionCard title="Período e arquivo">
        <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <TextField label="Mês" icon={<CalendarIcon className="h-4 w-4" />} type="month" value={month} onChange={(event) => setMonth(event.target.value)} required />
          <SelectField label="Perfil" value={profile} onChange={(event) => setProfile(event.target.value as 'A' | 'B' | 'C')}>
            <option value="A">Perfil A</option>
            <option value="B">Perfil B</option>
            <option value="C">Perfil C</option>
          </SelectField>
          <SelectField label="Atividade" value={activity} onChange={(event) => setActivity(Number(event.target.value) === 0 ? 0 : 1)}>
            <option value={1}>Outros (comércio e serviços)</option>
            <option value={0}>Industrial ou equiparado</option>
          </SelectField>
          <SelectField label="Finalidade" value={purpose} onChange={(event) => setPurpose(Number(event.target.value) === 1 ? 1 : 0)}>
            <option value={0}>Remessa original</option>
            <option value={1}>Remessa substituta</option>
          </SelectField>
        </div>
        <p className="mt-3 text-[12px] text-[var(--muted)]">O perfil é o que a SEFAZ definiu para a empresa: confirme com o contador.</p>
      </SectionCard>

      <SectionCard title="Inventário (bloco H)" subtitle="Normalmente vai no SPED de fevereiro, com o estoque de 31 de dezembro">
        <label className="mt-4 flex items-center gap-2.5 text-[13.5px] font-semibold text-[var(--ink)]">
          <input type="checkbox" checked={withInventory} onChange={(event) => setWithInventory(event.target.checked)} className="h-4 w-4" />
          Incluir inventário neste arquivo
        </label>
        {withInventory && (
          <div className="mt-3 max-w-xs">
            <TextField label="Data do inventário" icon={<CalendarIcon className="h-4 w-4" />} type="date" value={inventoryDate} onChange={(event) => setInventoryDate(event.target.value)} required />
            <p className="mt-1.5 text-[12px] text-[var(--muted)]">Usa o saldo e o custo médio de cada produto nessa data.</p>
          </div>
        )}
      </SectionCard>

      {linkedAccountant?.accountant ? (
        <SectionCard title="Contador (registro 0100)" subtitle="Vem da contabilidade vinculada em Configurações → Contabilidade">
          <div className="mt-4 rounded-xl bg-[var(--page)] px-4 py-3">
            <p className="text-[14px] font-bold text-[var(--ink)]">
              {linkedAccountant.accountant.name} · CRC {linkedAccountant.accountant.crc}
            </p>
            <p className="text-[12.5px] text-[var(--ink-soft)]">{linkedAccountant.firm?.name}</p>
          </div>
        </SectionCard>
      ) : (
        <>
          <p className="-mb-3 text-[12.5px] text-[var(--ink-soft)]">
            Dica: vincule a contabilidade em Configurações → Contabilidade e o contador passa a vir de lá.
          </p>
        <SectionCard title="Contador (registro 0100)" subtitle="Fica salvo neste navegador para os próximos meses">
          <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            <TextField label="Nome" icon={<UserIcon className="h-4 w-4" />} value={accountant.name} onChange={(event) => patchAccountant({ name: event.target.value })} required />
            <TextField label="CPF" icon={<BadgeIcon className="h-4 w-4" />} value={accountant.cpf} onChange={(event) => patchAccountant({ cpf: event.target.value })} required />
            <TextField label="CRC" icon={<BadgeIcon className="h-4 w-4" />} value={accountant.crc} onChange={(event) => patchAccountant({ crc: event.target.value })} required />
            <TextField label="CNPJ do escritório (opcional)" icon={<BuildingIcon className="h-4 w-4" />} value={accountant.cnpj} onChange={(event) => patchAccountant({ cnpj: event.target.value })} />
            <TextField label="E-mail" icon={<MailIcon className="h-4 w-4" />} type="email" value={accountant.email} onChange={(event) => patchAccountant({ email: event.target.value })} required />
            <TextField label="Telefone" icon={<PhoneIcon className="h-4 w-4" />} value={accountant.phone} onChange={(event) => patchAccountant({ phone: event.target.value })} />
            <TextField
              label="CEP" icon={<MapPinIcon className="h-4 w-4" />}
              value={accountant.zip_code}
              onChange={(event) => patchAccountant({ zip_code: event.target.value })}
              onBlur={lookupCep}
              action={cepLoading ? <span className="text-[11px] text-[var(--muted)]">Buscando…</span> : undefined}
            />
            <TextField label="Endereço" icon={<MapPinIcon className="h-4 w-4" />} value={accountant.address} onChange={(event) => patchAccountant({ address: event.target.value })} />
            <TextField label="Número" icon={<MapPinIcon className="h-4 w-4" />} value={accountant.number} onChange={(event) => patchAccountant({ number: event.target.value })} />
            <TextField label="Bairro" icon={<MapPinIcon className="h-4 w-4" />} value={accountant.district} onChange={(event) => patchAccountant({ district: event.target.value })} />
            <TextField label="Complemento" icon={<MapPinIcon className="h-4 w-4" />} value={accountant.complement} onChange={(event) => patchAccountant({ complement: event.target.value })} />
            <TextField
              label="Código IBGE do município" icon={<MapPinIcon className="h-4 w-4" />}
              value={accountant.code_ibge}
              onChange={(event) => patchAccountant({ code_ibge: event.target.value })}
              required
            />
          </div>
        </SectionCard>
        </>
      )}

      <SectionCard
        title="Apuração do ICMS (regime normal)"
        subtitle="Só para empresas do regime normal com ICMS a recolher; no Simples a apuração vai zerada"
        defaultCollapsed
      >
        <div className="mt-4 grid gap-4 sm:grid-cols-3">
          <TextField label="Saldo credor do mês anterior" icon={<CoinIcon className="h-4 w-4" />} inputMode="decimal" value={previousCredit} onChange={(event) => setPreviousCredit(event.target.value)} placeholder="0,00" />
          <TextField label="Código de receita da UF" icon={<TagIcon className="h-4 w-4" />} value={revenueCode} onChange={(event) => setRevenueCode(event.target.value)} />
          <TextField label="Vencimento do ICMS" icon={<CalendarIcon className="h-4 w-4" />} type="date" value={dueDate} onChange={(event) => setDueDate(event.target.value)} />
        </div>
      </SectionCard>

      {error && <div className="rounded-2xl bg-[var(--red-100)] p-4 text-[13.5px] font-medium text-[var(--red-500)]">{error}</div>}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={generating}
          className="rounded-xl bg-[var(--blue-500)] px-5 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-50"
        >
          {generating ? 'Gerando… (pode levar alguns minutos)' : 'Gerar SPED Fiscal'}
        </button>
        {result && (
          <button
            type="button"
            onClick={() => downloadSpedFile(result)}
            className="rounded-xl px-4 py-2.5 text-[13px] font-semibold text-[var(--blue-700)] hover:underline"
          >
            Baixar de novo ({result.file_name})
          </button>
        )}
      </div>

      {summary && (
        <SectionCard title="Resumo do arquivo" subtitle={`${summary.lines} linhas · ${summary.regime === 'normal' ? 'Regime normal' : 'Simples Nacional'}`}>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <Stat
              label="Saídas"
              value={formatCurrency(summary.outputs.total)}
              hint={`${summary.outputs.nfe} NF-e · ${summary.outputs.nfce} NFC-e · ${summary.outputs.cancelled} canceladas`}
            />
            <Stat
              label="Entradas"
              value={formatCurrency(summary.inputs.total)}
              hint={`${summary.inputs.notes} notas${summary.inputs.withoutXml ? ` · ${summary.inputs.withoutXml} sem XML` : ''}`}
            />
            <Stat
              label="ICMS"
              value={formatCurrency(summary.icms.toPay)}
              hint={`Débitos ${formatCurrency(summary.icms.debits)} · Créditos ${formatCurrency(summary.icms.credits)}`}
            />
            <Stat
              label="Inventário"
              value={summary.inventory ? formatCurrency(summary.inventory.total) : 'Sem inventário'}
              hint={summary.inventory ? `${summary.inventory.items} produtos` : undefined}
            />
          </div>
          {summary.warnings.length > 0 && (
            <div className="mt-4 rounded-xl bg-[var(--amber-100)] p-4">
              <p className="text-[13px] font-bold text-[var(--amber-500)]">Confira antes de enviar ao contador</p>
              <ul className="mt-2 flex list-disc flex-col gap-1 pl-5 text-[12.5px] text-[var(--ink-soft)]">
                {summary.warnings.map((warning) => (
                  <li key={warning}>{warning}</li>
                ))}
              </ul>
            </div>
          )}
        </SectionCard>
      )}

      <SectionCard title="Arquivos gerados" subtitle="Todo SPED gerado fica guardado aqui para baixar de novo quando precisar">
        {files === null ? (
          <p className="mt-4 text-[13px] text-[var(--muted)]">Carregando…</p>
        ) : files.length === 0 ? (
          <p className="mt-4 text-[13px] text-[var(--muted)]">Nenhum SPED gerado ainda.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {files.map((file, index) => {
              const latest = files.findIndex((item) => item.month === file.month) === index
              const [year, month] = file.month.split('-')
              return (
                <li key={file.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-[var(--page)] px-4 py-3">
                  <div>
                    <p className="flex flex-wrap items-center gap-2 text-[14px] font-bold text-[var(--ink)]">
                      {month}/{year}
                      {latest ? (
                        <span className="rounded-full bg-[var(--green-100)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--green-600)]">Mais recente</span>
                      ) : (
                        <span className="rounded-full bg-[var(--surface)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--muted)]">Versão anterior</span>
                      )}
                      {file.origin === 'auto' && (
                        <span className="rounded-full bg-[var(--blue-100)] px-2 py-0.5 text-[10.5px] font-bold text-[var(--blue-700)]">Automático</span>
                      )}
                    </p>
                    <p className="text-[12.5px] text-[var(--ink-soft)]">
                      Gerado em {formatDateTime(file.created_at)}
                      {file.generated_by_name ? ` por ${file.generated_by_name}` : ''}
                      {file.summary
                        ? ` · ${file.summary.outputs.nfe + file.summary.outputs.nfce} saídas · ${file.summary.inputs.notes} entradas${file.summary.inventory ? ' · com inventário' : ''}`
                        : ''}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleDownloadStored(file)}
                    disabled={downloadingId === file.id}
                    className="rounded-xl px-4 py-2 text-[13px] font-semibold text-[var(--blue-700)] ring-1 ring-[var(--border)] hover:bg-[var(--surface)] disabled:opacity-50"
                  >
                    {downloadingId === file.id ? 'Baixando…' : 'Baixar'}
                  </button>
                </li>
              )
            })}
          </ul>
        )}
      </SectionCard>
    </form>
  )
}
