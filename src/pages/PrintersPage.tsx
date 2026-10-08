import { useCallback, useEffect, useState } from 'react'
import {
  cancelPrintJob,
  deletePrinter,
  fetchPrintAgentPackage,
  fetchPrintAgents,
  fetchPrintJobs,
  fetchPrinters,
  PRINT_JOB_STATUS_LABELS,
  regeneratePrintAgentToken,
  retryPrintJob,
  testPrinter,
  type PrintAgentPackageInfo,
  type PrintAgentRecord,
  type PrintJobRecord,
  type PrinterRecord,
} from '../lib/printers'
import { ApiError, apiDownload } from '../lib/api'
import { formatDate, formatDateTime } from '../lib/format'
import { GlassList } from './glass/GlassList'
import { GuideSteps, type GuideStep } from '../components/GuideSteps'
import { ConfirmDialog } from '../components/ConfirmDialog'
import { PencilIcon, PrinterIcon, TrashIcon } from '../components/icons'
import type { AuthCompany, AuthSession } from '../lib/auth'

interface PrintersPageProps {
  session: AuthSession
  company: AuthCompany
  onCreate: () => void
  onEdit: (item: PrinterRecord) => void
}

const JOB_TONES: Record<number, string> = {
  0: 'bg-[var(--page)] text-[var(--ink-soft)]',
  1: 'bg-[var(--amber-100)] text-[var(--amber-500)]',
  2: 'bg-[var(--green-100)] text-[var(--green-600)]',
  3: 'bg-[var(--red-100)] text-[var(--red-500)]',
  4: 'bg-[var(--page)] text-[var(--muted)]',
}

const TEST_TITLE = 'Teste de impressão'

const FAQ: { question: string; answer: string }[] = [
  {
    question: 'A impressora não aparece na lista de impressoras do Windows',
    answer:
      'A lista mostra o que o Windows do computador onde o programa está aberto enxerga. Confira se a impressora está ligada, com o cabo USB ligado e instalada no Windows (Configurações do Windows → Impressoras e scanners). Se o fabricante não tem driver para o seu Windows, adicione a impressora escolhendo o driver "Generic / Text Only" na porta USB: o sistema envia os comandos direto, sem depender do driver do fabricante. Depois de instalar, espere até 15 segundos e a impressora aparece aqui.',
  },
  {
    question: 'O status está "Desconectado"',
    answer:
      'O programa precisa estar aberto no computador (a janela preta pode ficar minimizada, mas não fechada) e o computador precisa ter internet. Se você baixou o pacote e depois clicou em "Gerar novo token", baixe de novo e troque a pasta: o token antigo deixa de valer. Se o antivírus ou o firewall bloquear, libere o C2DelphiPrintServer.exe.',
  },
  {
    question: 'O teste fica "Na fila" e não imprime',
    answer:
      'Na fila significa que o programa ainda não buscou o trabalho: confira se ele está aberto e conectado. Se está conectado e continua na fila, veja se a impressora cadastrada está ativa. Se der "Erro", leia a mensagem na lista de últimas impressões e confira o caminho da impressora.',
  },
  {
    question: 'Dá erro "Impressora não encontrada no Windows"',
    answer:
      'O caminho cadastrado precisa ser exatamente o nome da impressora no Windows. O jeito mais seguro é clicar no nome dela na lista "Impressoras do Windows do computador conectado", ao cadastrar. Impressora de rede com IP: use o formato 192.168.0.50:9100.',
  },
  {
    question: 'Saiu em branco, cortado ou com letras estranhas',
    answer:
      'Edite a impressora e ajuste a largura do papel (48 colunas para bobina de 80 mm, 32 para 58 mm) e a codificação (CP850 resolve a maioria dos casos de acentos; teste Windows-1252 se ainda sair estranho). Use "Salvar e imprimir teste" para conferir.',
  },
  {
    question: 'O Windows mostrou "O Windows protegeu o computador"',
    answer:
      'Esse aviso aparece em programas novos que ainda não têm reputação no Windows. Clique em "Mais informações" e depois em "Executar assim mesmo". É seguro: o programa é o servidor de impressão do Controle Dois.',
  },
  {
    question: 'Troquei de computador ou reinstalei o Windows',
    answer:
      'Baixe o pacote de novo (passo 1) e extraia no computador novo. Se o computador antigo for desligado de vez, ele aparece como desconectado aqui: pode ignorar.',
  },
  {
    question: 'Quero que pare de abrir junto com o Windows',
    answer:
      'Abra o Prompt de Comando na pasta do programa e rode: C2DelphiPrintServer.exe /autostart-off. Para voltar a abrir sozinho, abra o programa normalmente de novo.',
  },
]

function formatBytes(bytes?: number | null) {
  if (!bytes) return ''
  return `${(bytes / (1024 * 1024)).toLocaleString('pt-BR', { maximumFractionDigits: 1 })} MB`
}

function secondsAgo(iso?: string | null) {
  if (!iso) return 'nunca'
  const seconds = Math.max(Math.round((Date.now() - new Date(iso).getTime()) / 1000), 0)
  if (seconds < 60) return `há ${seconds} s`
  if (seconds < 3600) return `há ${Math.round(seconds / 60)} min`
  return formatDateTime(iso)
}

export function PrintersPage({ session, company, onCreate, onEdit }: PrintersPageProps) {
  const token = session.token.token
  const [agents, setAgents] = useState<PrintAgentRecord[]>([])
  const [jobs, setJobs] = useState<PrintJobRecord[]>([])
  const [notice, setNotice] = useState<string | null>(null)
  const [reloadToken, setReloadToken] = useState(0)
  const [packageInfo, setPackageInfo] = useState<PrintAgentPackageInfo | null>(null)
  const [printersTotal, setPrintersTotal] = useState<number | null>(null)
  const [downloading, setDownloading] = useState(false)
  const [downloadError, setDownloadError] = useState<string | null>(null)
  const [tokenDialog, setTokenDialog] = useState(false)
  const [tokenBusy, setTokenBusy] = useState(false)

  const loadStatus = useCallback(() => {
    fetchPrintAgents(token, company.id).then(setAgents).catch(() => {})
    fetchPrintJobs(token, company.id, 10)
      .then((res) => setJobs(res.data || []))
      .catch(() => {})
    fetchPrinters(token, company.id, { limit: 1 })
      .then((res) => setPrintersTotal(res.meta?.total ?? res.data?.length ?? 0))
      .catch(() => {})
  }, [token, company.id])

  useEffect(() => {
    fetchPrintAgentPackage(token, company.id)
      .then(setPackageInfo)
      .catch(() => setPackageInfo(null))
  }, [token, company.id, tokenDialog])

  async function handleDownload() {
    setDownloading(true)
    setDownloadError(null)
    try {
      await apiDownload(`/print-agent/download?companyId=${encodeURIComponent(company.id)}`, token, 'C2-Servidor-de-Impressao.zip')
      // O token é criado no primeiro download: atualiza as informações do pacote.
      fetchPrintAgentPackage(token, company.id).then(setPackageInfo).catch(() => {})
    } catch (err) {
      setDownloadError(err instanceof ApiError ? err.message : 'Não foi possível baixar o programa. Tente novamente.')
    } finally {
      setDownloading(false)
    }
  }

  async function handleRegenerateToken() {
    setTokenBusy(true)
    try {
      await regeneratePrintAgentToken(token, company.id)
      setTokenDialog(false)
      setNotice('Novo token gerado. Baixe o pacote de novo (passo 1) e troque a pasta do programa nos computadores.')
    } catch (err) {
      setTokenDialog(false)
      setNotice(err instanceof ApiError ? err.message : 'Não foi possível gerar o novo token.')
    } finally {
      setTokenBusy(false)
    }
  }

  // Status do servidor de impressão e fila: atualiza sozinho enquanto a tela está aberta.
  useEffect(() => {
    loadStatus()
    const timer = setInterval(loadStatus, 5000)
    return () => clearInterval(timer)
  }, [loadStatus])

  async function runJobAction(action: () => Promise<unknown>) {
    setNotice(null)
    try {
      await action()
      loadStatus()
    } catch (err) {
      setNotice(err instanceof ApiError ? err.message : 'Não foi possível concluir a ação.')
    }
  }

  const online = agents.filter((agent) => agent.online)
  const everConnected = agents.length > 0
  const testPrinted = jobs.some((job) => job.title === TEST_TITLE && job.status === 2)
  const hasPrinters = (printersTotal ?? 0) > 0

  // Cada passo se marca sozinho conforme o sistema percebe; o "atual" é o primeiro que falta.
  const baseStatuses = [everConnected, everConnected, online.length > 0, hasPrinters, testPrinted]
  const currentIndex = baseStatuses.findIndex((done) => !done)
  const statusOf = (index: number) => (baseStatuses[index] ? 'done' : index === currentIndex ? 'current' : 'pending') as GuideStep['status']

  const offlineAgent = agents.find((agent) => !agent.online)

  const steps: GuideStep[] = [
    {
      key: 'download',
      title: 'Baixe o programa no computador das impressoras',
      description: 'É o "servidor de impressão": um programa pequeno que fica ligado e imprime o que o sistema mandar.',
      status: statusOf(0),
      actions: packageInfo?.available ? (
        <>
          <button
            type="button"
            onClick={handleDownload}
            disabled={downloading}
            className="rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)] disabled:opacity-60"
          >
            {downloading ? 'Preparando…' : 'Baixar servidor de impressão'}
          </button>
          <span className="text-[12px] text-[var(--muted)]">
            Versão {packageInfo.version}
            {packageInfo.file_size ? ` · ${formatBytes(packageInfo.file_size)}` : ''}
            {packageInfo.released_at ? ` · ${formatDate(packageInfo.released_at)}` : ''} · Windows
          </span>
        </>
      ) : packageInfo ? (
        <span className="text-[12.5px] font-semibold text-[var(--amber-500)]">
          O programa ainda não foi publicado. Fale com o suporte do Controle Dois.
        </span>
      ) : undefined,
      details: (
        <>
          <p>
            Instale <b>no computador onde as impressoras estão ligadas</b> (por exemplo, o computador do caixa). Se você tem
            impressoras em computadores diferentes, repita este passo em cada um.
          </p>
          <p>
            O arquivo baixado já vem <b>pronto para a sua empresa</b>: você não precisa digitar endereço, usuário nem senha.
            Funciona em Windows 10 ou mais novo.
          </p>
          {downloadError && <p className="font-semibold text-[var(--red-500)]">{downloadError}</p>}
        </>
      ),
    },
    {
      key: 'open',
      title: 'Extraia a pasta e abra o programa',
      description: 'Duas etapas: extrair o arquivo .zip e dar dois cliques no programa.',
      status: statusOf(1),
      details: (
        <ol className="list-decimal space-y-1.5 pl-5">
          <li>
            Abra a pasta de downloads, clique com o botão direito no arquivo <b>C2-Servidor-de-Impressao.zip</b> e escolha{' '}
            <b>Extrair tudo…</b>. Coloque num lugar fixo, como <code>C:\ControleDois</code>. <b>Não abra de dentro do .zip.</b>
          </li>
          <li>
            Dentro da pasta, dê dois cliques em <b>C2DelphiPrintServer.exe</b>.
          </li>
          <li>
            Se o Windows mostrar <b>“O Windows protegeu o computador”</b>, clique em <b>Mais informações</b> e depois em{' '}
            <b>Executar assim mesmo</b>. Isso acontece porque o programa é novo para o Windows; ele é seguro.
          </li>
          <li>
            Abre uma <b>janela preta</b> com a mensagem “Conectado ao sistema”. <b>Pode minimizar, mas não feche</b>: é ela que
            imprime.
          </li>
          <li>
            Na primeira vez o programa se configura para <b>abrir sozinho quando o computador ligar</b>: você não precisa
            lembrar de abrir todo dia.
          </li>
        </ol>
      ),
    },
    {
      key: 'connected',
      title: 'Aguarde a conexão',
      description: online.length ? (
        <>
          <b className="text-[var(--green-600)]">Conectado</b> — {online.map((agent) => agent.hostname).join(', ')}.
        </>
      ) : everConnected ? (
        <span className="text-[var(--red-500)]">
          O computador {offlineAgent?.hostname} não dá sinal {secondsAgo(offlineAgent?.last_seen_at)}. O programa está aberto
          e com internet?
        </span>
      ) : (
        'Assim que o programa abrir, o computador aparece aqui sozinho (leva até 15 segundos). Não precisa atualizar a página.'
      ),
      status: statusOf(2),
      details: (
        <p>
          Quando conectar, o computador aparece no quadro “Servidor de impressão” mais abaixo, junto com a lista das
          impressoras que o Windows dele enxerga. Se demorar mais que 1 minuto, veja “Não deu certo?” no fim da página.
        </p>
      ),
    },
    {
      key: 'register',
      title: 'Cadastre a impressora',
      description: 'Dê um nome (ex.: Caixa, Cozinha, Bar) e escolha a impressora na lista.',
      status: statusOf(3),
      actions: (
        <button
          type="button"
          onClick={onCreate}
          className="rounded-xl bg-[var(--blue-500)] px-4 py-2.5 text-[13.5px] font-bold text-white transition hover:bg-[var(--blue-700)]"
        >
          Cadastrar impressora
        </button>
      ),
      details: (
        <>
          <p>
            No cadastro, as impressoras do Windows aparecem como botões: <b>é só clicar</b> na que você quer usar (o “caminho”
            é preenchido sozinho).
          </p>
          <p>
            Largura do papel: <b>48 colunas</b> para bobina de 80 mm (a mais comum) e <b>32</b> para 58 mm. Marque “Abrir a
            gaveta” se o caixa tem gaveta ligada na impressora.
          </p>
          <p>
            Impressora de rede (com IP): em “Caminho”, escreva o IP e a porta, por exemplo <code>192.168.0.50:9100</code>.
          </p>
        </>
      ),
    },
    {
      key: 'test',
      title: 'Imprima uma página de teste',
      description: testPrinted
        ? 'Teste impresso com sucesso.'
        : 'Na lista de impressoras, abra o menu ⋮ da linha e escolha “Imprimir teste” (ou use “Salvar e imprimir teste” ao editar).',
      status: statusOf(4),
      details: (
        <p>
          Sai uma página com a largura do papel, acentos, negrito e um QR-code. Se saiu tudo certo, está pronto. O resultado
          aparece em “Últimas impressões”, mais abaixo. Se não saiu, veja “Não deu certo?”.
        </p>
      ),
    },
    {
      key: 'use',
      title: 'Escolha a impressora no PDV',
      description: 'No PDV: Venda Rápida → Configurações → Impressoras.',
      status: 'info',
      details: (
        <p>
          Lá você escolhe em qual impressora sai o comprovante da venda e em qual sai a NFC-e. Com impressora escolhida, o PDV
          imprime direto, sem mostrar a pré-visualização. Sem impressora escolhida, tudo continua como antes (com preview).
        </p>
      ),
    },
  ]

  return (
    <>
      <GlassList<PrinterRecord>
        eyebrow="Impressão direta"
        title="Impressoras"
        newLabel="Nova impressora"
        searchPlaceholder="Buscar por nome ou caminho"
        emptyLabel="Nenhuma impressora cadastrada"
        filterKey={String(reloadToken)}
        beforeContent={
          <GuideSteps
            title="Como configurar a impressão direta"
            subtitle="Siga os passos na ordem. Cada um se marca sozinho quando fica pronto."
            steps={steps}
          />
        }
        fetchPage={(search, page) => fetchPrinters(token, company.id, { search, page, limit: 10 })}
        columns={[
          { header: 'Nome', render: (item) => <span className="font-medium text-[var(--ink)]">{item.name}</span> },
          { header: 'Caminho', render: (item) => <span className="font-mono text-[12px] text-[var(--ink-soft)]">{item.path}</span> },
          { header: 'Papel', render: (item) => <span className="text-[var(--ink-soft)]">{item.paper_columns} col.</span> },
          {
            header: 'Situação',
            render: (item) => (
              <span className={item.active ? 'text-[var(--green-600)]' : 'text-[var(--muted)]'}>{item.active ? 'Ativa' : 'Inativa'}</span>
            ),
          },
        ]}
        cardTitle={(item) => item.name}
        cardSubtitle={(item) => item.path}
        onCreate={onCreate}
        actions={(item, { askDelete }) => [
          { key: 'edit', label: 'Editar', icon: <PencilIcon className="h-4 w-4" />, onClick: () => onEdit(item) },
          {
            key: 'test',
            label: 'Imprimir teste',
            icon: <PrinterIcon className="h-4 w-4" />,
            onClick: () =>
              runJobAction(async () => {
                await testPrinter(token, item.id)
                setNotice(`Teste enviado para "${item.name}". Acompanhe a fila abaixo.`)
              }),
          },
          { key: 'delete', label: 'Excluir', icon: <TrashIcon className="h-4 w-4" />, tone: 'danger', dividerBefore: true, onClick: () => askDelete(item) },
        ]}
        deleteItem={async (item) => {
          await deletePrinter(token, item.id)
          setReloadToken((value) => value + 1)
        }}
        deleteTitle="Excluir impressora"
        deleteLabel={(item) => item.name}
      />

      <div className="flex flex-col gap-6 px-4 pb-8 sm:px-6 lg:px-8">
        {notice && (
          <div className="rounded-xl bg-[var(--blue-100)] px-4 py-3 text-[13px] font-medium text-[var(--blue-700)]" onClick={() => setNotice(null)}>
            {notice}
          </div>
        )}

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[14px] font-bold text-[var(--ink)]">Servidor de impressão</h2>
            <span
              className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${
                online.length ? 'bg-[var(--green-100)] text-[var(--green-600)]' : 'bg-[var(--red-100)] text-[var(--red-500)]'
              }`}
            >
              {online.length ? 'Conectado' : 'Desconectado'}
            </span>
          </div>
          {agents.length === 0 ? (
            <p className="mt-2 text-[12.5px] text-[var(--ink-soft)]">
              Nenhum computador conectado ainda. Instale o <b>C2 Print Server</b> no computador onde ficam as impressoras e informe o
              token da empresa no <code>config.ini</code>: ele aparece aqui sozinho, com a lista das impressoras do Windows.
            </p>
          ) : (
            <div className="mt-3 flex flex-col divide-y divide-[var(--border)]">
              {agents.map((agent) => (
                <div key={agent.id} className="flex flex-wrap items-start justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-[var(--ink)]">
                      <span className={`mr-2 inline-block h-2 w-2 rounded-full ${agent.online ? 'bg-[var(--green-600)]' : 'bg-[var(--red-500)]'}`} />
                      {agent.hostname}
                      {agent.agent_version ? <span className="ml-2 text-[11.5px] font-normal text-[var(--muted)]">v{agent.agent_version}</span> : null}
                    </p>
                    <p className="text-[12px] text-[var(--muted)]">
                      Último sinal {secondsAgo(agent.last_seen_at)}
                      {agent.detected_printers.length ? ` · ${agent.detected_printers.length} impressora(s) no Windows` : ''}
                    </p>
                  </div>
                  {agent.detected_printers.length > 0 && (
                    <p className="max-w-[420px] text-right text-[11.5px] text-[var(--ink-soft)]">{agent.detected_printers.join(' · ')}</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-[14px] font-bold text-[var(--ink)]">Últimas impressões</h2>
          <p className="mb-3 text-[12px] text-[var(--muted)]">Atualiza sozinho. Trabalho com erro pode ser reenviado.</p>
          {jobs.length === 0 ? (
            <p className="py-4 text-center text-[13px] text-[var(--muted)]">Nenhuma impressão ainda.</p>
          ) : (
            <div className="flex flex-col divide-y divide-[var(--border)]">
              {jobs.map((job) => (
                <div key={job.id} className="flex flex-wrap items-center justify-between gap-3 py-2.5">
                  <div className="min-w-0">
                    <p className="truncate text-[13px] font-semibold text-[var(--ink)]">
                      #{job.code} · {job.title || 'Documento'} <span className="font-normal text-[var(--muted)]">→ {job.printer?.name ?? '—'}</span>
                    </p>
                    <p className="truncate text-[12px] text-[var(--muted)]">
                      {formatDateTime(job.created_at)}
                      {job.error ? ` · ${job.error}` : ''}
                    </p>
                  </div>
                  <div className="flex flex-none items-center gap-2">
                    <span className={`rounded-full px-2.5 py-0.5 text-[11.5px] font-bold ${JOB_TONES[job.status] ?? JOB_TONES[0]}`}>
                      {PRINT_JOB_STATUS_LABELS[job.status] ?? job.status}
                    </span>
                    {(job.status === 3 || job.status === 4) && (
                      <button
                        type="button"
                        onClick={() => runJobAction(() => retryPrintJob(token, job.id))}
                        className="rounded-lg px-2.5 py-1 text-[12px] font-bold text-[var(--blue-700)] hover:bg-[var(--blue-100)]"
                      >
                        Reenviar
                      </button>
                    )}
                    {job.status === 0 && (
                      <button
                        type="button"
                        onClick={() => runJobAction(() => cancelPrintJob(token, job.id))}
                        className="rounded-lg px-2.5 py-1 text-[12px] font-bold text-[var(--red-500)] hover:bg-[var(--red-100)]"
                      >
                        Cancelar
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <h2 className="text-[14px] font-bold text-[var(--ink)]">Não deu certo?</h2>
          <p className="mb-3 text-[12px] text-[var(--muted)]">Os problemas mais comuns e como resolver.</p>
          <div className="flex flex-col divide-y divide-[var(--border)]">
            {FAQ.map((item) => (
              <details key={item.question} className="group py-2.5">
                <summary className="cursor-pointer list-none text-[13px] font-semibold text-[var(--ink)] marker:hidden">
                  <span className="mr-2 text-[var(--blue-700)] group-open:hidden">+</span>
                  <span className="mr-2 hidden text-[var(--blue-700)] group-open:inline">−</span>
                  {item.question}
                </summary>
                <p className="mt-2 pl-5 text-[12.5px] leading-relaxed text-[var(--ink-soft)]">{item.answer}</p>
              </details>
            ))}
          </div>
          <p className="mt-3 text-[12px] text-[var(--muted)]">
            No computador, o programa também guarda um arquivo <code>print-server.log</code> na pasta dele com o que aconteceu —
            útil para o suporte.
          </p>
        </div>

        <details className="rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-5">
          <summary className="cursor-pointer text-[13px] font-bold text-[var(--ink)]">Avançado: acesso do programa (token)</summary>
          <p className="mt-2 text-[12.5px] text-[var(--ink-soft)]">
            O pacote baixado já leva o acesso da sua empresa dentro do arquivo <code>config.ini</code>. Se esse arquivo for parar
            em mãos erradas, gere um novo token: os computadores com o token antigo param de imprimir até você baixar o pacote
            de novo.
            {packageInfo?.token_created_at ? ` Token atual criado em ${formatDate(packageInfo.token_created_at)}.` : ''}
          </p>
          <button
            type="button"
            disabled={!packageInfo?.has_token}
            onClick={() => setTokenDialog(true)}
            className="mt-3 rounded-xl border border-[var(--border)] px-4 py-2 text-[12.5px] font-bold text-[var(--red-500)] hover:bg-[var(--red-100)] disabled:opacity-50"
          >
            Gerar novo token
          </button>
        </details>
      </div>

      <ConfirmDialog
        open={tokenDialog}
        title="Gerar novo token"
        message="Os computadores que já estão com o programa vão parar de imprimir até você baixar o pacote de novo e trocar a pasta. Continuar?"
        confirmLabel="Gerar novo token"
        loading={tokenBusy}
        onConfirm={handleRegenerateToken}
        onCancel={() => setTokenDialog(false)}
      />
    </>
  )
}
