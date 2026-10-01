import { useEffect, useState, type FormEvent } from 'react'
import { createNfse, updateNfse, fetchNfse, type NfsePayload } from '../lib/nfse'
import { fetchCompany } from '../lib/companies'
import { fetchPeople, fetchPerson, type PersonRecord } from '../lib/people'
import { ApiError } from '../lib/api'
import { SearchSelectField } from '../components/form/SearchSelectField'
import { TextField } from '../components/form/TextField'
import { ChevronLeftIcon, FileTextIcon, WalletIcon } from '../components/icons'
import type { AuthSession, AuthCompany } from '../lib/auth'

interface NfseFormPageProps {
  session: AuthSession
  company: AuthCompany
  nfseId?: string
  onBack: () => void
  onSaved: () => void
}

function todayISO(): string {
  return new Date().toISOString().slice(0, 10)
}

function onlyNumbers(value?: string | null): string {
  return String(value || '').replace(/\D/g, '')
}

function parseAmount(value: string): number {
  if (!value) return 0
  const normalized = value.includes(',') ? value.replace(/\./g, '').replace(',', '.') : value
  const num = Number(normalized)
  return Number.isNaN(num) ? 0 : num
}

export function NfseFormPage({ session, company, nfseId, onBack, onSaved }: NfseFormPageProps) {
  const [loading, setLoading] = useState(Boolean(nfseId))
  const [loadError, setLoadError] = useState<string | null>(null)
  const [reloadKey, setReloadKey] = useState(0)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const [person, setPerson] = useState<PersonRecord | null>(null)
  const [descricaoServico, setDescricaoServico] = useState('')
  const [valorServico, setValorServico] = useState('')
  const [descontoIncondicionado, setDescontoIncondicionado] = useState('')
  const [descontoCondicionado, setDescontoCondicionado] = useState('')
  const [codigoTributacaoNacionalIss, setCodigoTributacaoNacionalIss] = useState('010101')
  const [dataCompetencia, setDataCompetencia] = useState(todayISO())
  const [pedidoCompra, setPedidoCompra] = useState('')
  const [informacoesComplementares, setInformacoesComplementares] = useState('')
  const [inscricaoMunicipalTomador, setInscricaoMunicipalTomador] = useState('')

  useEffect(() => {
    if (!nfseId) return
    let cancelled = false
    setLoading(true)
    setLoadError(null)

    fetchNfse(session.token.token, nfseId)
      .then(async (nfse) => {
        if (cancelled) return
        setDescricaoServico(nfse.descricao_servico ?? '')
        setValorServico(String(nfse.valor_servico ?? ''))
        setDescontoIncondicionado(nfse.desconto_incondicionado ? String(nfse.desconto_incondicionado) : '')
        setDescontoCondicionado(nfse.desconto_condicionado ? String(nfse.desconto_condicionado) : '')
        setCodigoTributacaoNacionalIss(nfse.codigo_tributacao_nacional_iss ?? '010101')
        setDataCompetencia(nfse.data_competencia ? nfse.data_competencia.slice(0, 10) : todayISO())
        setPedidoCompra(nfse.pedido_compra ?? '')
        setInformacoesComplementares(nfse.informacoes_complementares ?? '')

        if (nfse.people) {
          setPerson({
            id: nfse.people.id,
            name: nfse.people.name,
            social_name: nfse.people.social_name,
            document: nfse.people.document ?? nfse.cnpj_tomador ?? nfse.cpf_tomador ?? '',
          } as PersonRecord)

          try {
            const fullPerson = await fetchPerson(session.token.token, nfse.people.id)
            if (!cancelled) setPerson(fullPerson)
          } catch {
            // Mantém o placeholder montado acima - só não dá pra reconstruir o
            // endereço do tomador se o cliente tiver sido excluído.
          }
        }
      })
      .catch((err) => {
        if (cancelled) return
        setLoadError(err instanceof ApiError ? err.message : 'Não foi possível carregar a NFS-e.')
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [nfseId, session.token.token, reloadKey])

  async function handleSubmit(event: FormEvent) {
    event.preventDefault()
    setError(null)

    if (!person) {
      setError('Selecione o tomador (cliente) da NFS-e.')
      return
    }
    if (!descricaoServico.trim()) {
      setError('Descreva o serviço prestado.')
      return
    }
    const value = parseAmount(valorServico)
    if (!value) {
      setError('Informe o valor do serviço.')
      return
    }

    setSubmitting(true)
    try {
      const document = onlyNumbers(person.document)
      const address = person.address

      const payload: NfsePayload = {
        companyId: company.id,
        peopleId: person.id,
        razaoSocialTomador: person.social_name || person.name,
        cnpjTomador: document.length === 14 ? document : undefined,
        cpfTomador: document.length === 11 ? document : undefined,
        inscricaoMunicipalTomador: inscricaoMunicipalTomador || undefined,
        codigoMunicipioTomador: Number(address?.code_ibge) || undefined,
        cepTomador: onlyNumbers(address?.zip_code) || undefined,
        logradouroTomador: address?.address || undefined,
        numeroTomador: address?.number || undefined,
        complementoTomador: address?.complement || undefined,
        bairroTomador: address?.district || undefined,
        telefoneTomador: person.phone || undefined,
        emailTomador: person.email || undefined,
        dataCompetencia,
        codigoTributacaoNacionalIss,
        descricaoServico: descricaoServico.trim(),
        pedidoCompra: pedidoCompra.trim() || undefined,
        informacoesComplementares: informacoesComplementares.trim() || undefined,
        valorServico: value,
        descontoIncondicionado: parseAmount(descontoIncondicionado) || undefined,
        descontoCondicionado: parseAmount(descontoCondicionado) || undefined,
      }

      if (nfseId) {
        await updateNfse(session.token.token, nfseId, payload)
      } else {
        // Prestador (a própria empresa): preenchido automaticamente a partir
        // do cadastro da empresa - não é um campo editável no formulário,
        // mesma ideia de NfsesController.buildDraftFromSale no backend.
        // fetchCompany busca pelo id do People que representa a empresa
        // (company.people.id), não pelo id do tenant (company.id) -
        // CompaniesController.show consulta a tabela people, não companies.
        if (!company.people?.id) {
          throw new Error('Não foi possível identificar o cadastro da empresa para preencher o prestador.')
        }
        const issuer = await fetchCompany(session.token.token, company.people.id)
        const issuerDocument = onlyNumbers(issuer.document)

        await createNfse(session.token.token, {
          ...payload,
          emitenteDps: 1,
          codigoMunicipioEmissora: Number(issuer.address?.code_ibge) || undefined,
          codigoMunicipioPrestacao: Number(issuer.address?.code_ibge) || undefined,
          cnpjPrestador: issuerDocument.length === 14 ? issuerDocument : undefined,
          cpfPrestador: issuerDocument.length === 11 ? issuerDocument : undefined,
          inscricaoMunicipalPrestador: issuer.municipal_registration || undefined,
          razaoSocialPrestador: issuer.social_name || issuer.name,
          codigoMunicipioPrestador: Number(issuer.address?.code_ibge) || undefined,
          cepPrestador: onlyNumbers(issuer.address?.zip_code) || undefined,
          logradouroPrestador: issuer.address?.address || undefined,
          numeroPrestador: issuer.address?.number || undefined,
          complementoPrestador: issuer.address?.complement || undefined,
          bairroPrestador: issuer.address?.district || undefined,
          telefonePrestador: issuer.phone || undefined,
          emailPrestador: issuer.email || undefined,
          codigoOpcaoSimplesNacional: Number(issuer.crt) === 1 ? 1 : 2,
          regimeTributarioSimplesNacional: Number(issuer.crt) === 1 ? 1 : undefined,
          regimeEspecialTributacao: 0,
          tributacaoIss: 1,
          tipoRetencaoIss: 1,
        })
      }

      onSaved()
    } catch (err) {
      setError(
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Não foi possível salvar a NFS-e.'
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="flex flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <div>
        <button
          type="button"
          onClick={onBack}
          className="mb-3 flex items-center gap-1 text-[12.5px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
        >
          <ChevronLeftIcon className="h-3.5 w-3.5" />
          Voltar para NFS-e
        </button>
        <p className="text-[12px] font-semibold tracking-wide text-[var(--blue-700)] uppercase">Fiscal</p>
        <h1 className="mt-0.5 text-[22px] font-bold tracking-tight text-[var(--ink)]">
          {nfseId ? 'Editar NFS-e' : 'Nova NFS-e'}
        </h1>
      </div>

      {loading ? (
        <div className="h-11 animate-pulse rounded-xl bg-[var(--surface)]" />
      ) : loadError ? (
        <div className="flex flex-col items-start gap-3 rounded-2xl bg-[var(--red-100)] p-5">
          <p className="text-[13.5px] font-medium text-[var(--red-500)]">{loadError}</p>
          <button
            type="button"
            onClick={() => setReloadKey((key) => key + 1)}
            className="rounded-xl bg-[var(--surface)] px-4 py-2 text-[13px] font-bold text-[var(--red-500)] hover:bg-white"
          >
            Tentar novamente
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex flex-col gap-6">
          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="mb-4 text-[14px] font-bold text-[var(--ink)]">Tomador</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <div className="sm:col-span-2 xl:col-span-1">
                <SearchSelectField
                  label="Cliente"
                  placeholder="Buscar por nome ou documento…"
                  selectedLabel={person?.name ?? null}
                  selectedSubLabel={person?.document ?? undefined}
                  onSearch={(query) =>
                    fetchPeople(session.token.token, company.id, { search: query, limit: 8 }).then((res) => res.data)
                  }
                  getOptionLabel={(item: PersonRecord) => item.name}
                  getOptionSubLabel={(item: PersonRecord) => item.document ?? undefined}
                  onSelect={(item: PersonRecord) => setPerson(item)}
                  onClear={() => setPerson(null)}
                />
              </div>
              <TextField
                label="Inscrição municipal (opcional)"
                icon={<FileTextIcon className="h-4 w-4" />}
                value={inscricaoMunicipalTomador}
                onChange={(event) => setInscricaoMunicipalTomador(event.target.value)}
              />
            </div>
          </div>

          <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-6">
            <h2 className="mb-4 text-[14px] font-bold text-[var(--ink)]">Serviço</h2>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Valor do serviço</span>
                <div className="flex items-center gap-2 rounded-xl bg-[var(--page)] px-3.5 py-2.5 ring-1 ring-transparent transition focus-within:ring-[var(--blue-300)]">
                  <WalletIcon className="h-4 w-4 flex-none text-[var(--muted)]" />
                  <input
                    type="text"
                    inputMode="decimal"
                    placeholder="0,00"
                    value={valorServico}
                    onChange={(event) => setValorServico(event.target.value.replace(/[^\d.,]/g, ''))}
                    className="min-w-0 w-full bg-[var(--page)] text-[14px] text-[var(--ink)] placeholder:text-[var(--muted)] focus:outline-none"
                  />
                </div>
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Desconto incondicionado</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={descontoIncondicionado}
                  onChange={(event) => setDescontoIncondicionado(event.target.value.replace(/[^\d.,]/g, ''))}
                  className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Desconto condicionado</span>
                <input
                  type="text"
                  inputMode="decimal"
                  placeholder="0,00"
                  value={descontoCondicionado}
                  onChange={(event) => setDescontoCondicionado(event.target.value.replace(/[^\d.,]/g, ''))}
                  className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                />
              </label>
              <TextField
                label="Código de tributação nacional (ISS)"
                icon={<FileTextIcon className="h-4 w-4" />}
                placeholder="010101"
                value={codigoTributacaoNacionalIss}
                onChange={(event) => setCodigoTributacaoNacionalIss(event.target.value)}
              />
              <label className="flex flex-col gap-1.5">
                <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Data de competência</span>
                <input
                  type="date"
                  value={dataCompetencia}
                  onChange={(event) => setDataCompetencia(event.target.value)}
                  className="w-full rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
                />
              </label>
              <TextField
                label="Pedido de compra (opcional)"
                icon={<FileTextIcon className="h-4 w-4" />}
                value={pedidoCompra}
                onChange={(event) => setPedidoCompra(event.target.value)}
              />
            </div>

            <label className="mt-4 flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Descrição do serviço</span>
              <textarea
                value={descricaoServico}
                onChange={(event) => setDescricaoServico(event.target.value)}
                rows={3}
                placeholder="Descreva o serviço prestado…"
                className="w-full resize-none rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
              />
            </label>

            <label className="mt-4 flex flex-col gap-1.5">
              <span className="text-[12px] font-semibold text-[var(--ink-soft)]">Informações complementares</span>
              <textarea
                value={informacoesComplementares}
                onChange={(event) => setInformacoesComplementares(event.target.value)}
                rows={2}
                placeholder="Observações adicionais (opcional)"
                className="w-full resize-none rounded-xl bg-[var(--page)] px-3.5 py-2.5 text-[14px] text-[var(--ink)] ring-1 ring-transparent transition focus:outline-none focus:ring-[var(--blue-300)]"
              />
            </label>
          </div>

          {error && (
            <p className="rounded-xl bg-[var(--red-100)] px-4 py-3 text-[13.5px] font-medium text-[var(--red-500)]">
              {error}
            </p>
          )}

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-xl bg-[var(--blue-500)] px-6 py-2.5 text-[14px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
            >
              {submitting ? 'Salvando…' : nfseId ? 'Salvar alterações' : 'Salvar rascunho'}
            </button>
            <button
              type="button"
              onClick={onBack}
              className="rounded-xl px-5 py-2.5 text-[14px] font-semibold text-[var(--ink-soft)] hover:text-[var(--ink)]"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
