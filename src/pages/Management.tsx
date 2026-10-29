import { useState } from 'react';
import {
  ArrowUpRight,
  Building2,
  Cable,
  ExternalLink,
  RotateCcw,
  CheckCircle2,
  CircleDot,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../app/context';
import { can, unitKindNames } from '../domain/model';
import { clockTime, shortDate } from '../domain/dates';
import {
  Badge,
  Button,
  EmptyState,
  Modal,
  Notice,
  PageHeader,
  Panel,
  SearchField,
} from '../components/ui';

export function Units() {
  const { data, summary, changeContext } = useApp();
  const navigate = useNavigate();
  return (
    <>
      <PageHeader
        eyebrow="ESTRUTURA DA REDE"
        title="Unidades da rede"
        description="Estabelecimentos do cenário de demonstração e seus contextos de trabalho."
      />
      <div className="organization-strip">
        <Building2 size={23} />
        <div>
          <strong>{data.units.length} unidades cadastradas</strong>
          <span>Organizadas por modalidade de atendimento</span>
        </div>
      </div>
      <Panel>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Unidade</th>
                <th>Modalidade</th>
                <th>Região</th>
                <th>Leitos no contexto</th>
                <th>
                  <span className="sr-only">Ações</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {data.units.map((u) => (
                <tr key={u.id}>
                  <td>
                    <strong>{u.name}</strong>
                    <small className="cell-secondary">Unidade fictícia</small>
                  </td>
                  <td>{unitKindNames[u.kind]}</td>
                  <td>{u.district}</td>
                  <td>{summary.units.find((s) => s.unit.id === u.id)?.totalBeds ?? '—'}</td>
                  <td>
                    <Button
                      variant="secondary"
                      onClick={() => {
                        changeContext({ unitId: u.id });
                        navigate('/');
                      }}
                    >
                      Abrir unidade
                      <ArrowUpRight size={16} />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Notice>
        CNES, vínculos profissionais, setores e configurações de estabelecimentos serão conectados e
        validados nas próximas etapas. Os exemplos atuais não representam cadastro oficial.
      </Notice>
    </>
  );
}
export function Audit() {
  const { data } = useApp();
  const [search, setSearch] = useState('');
  const events = data.audit.filter((e) =>
    `${e.action} ${e.actor}`.toLocaleLowerCase('pt-BR').includes(search.toLocaleLowerCase('pt-BR')),
  );
  return (
    <>
      <PageHeader
        eyebrow="RASTREABILIDADE"
        title="Histórico de operações"
        description="Registros das ações realizadas nesta demonstração, por rede e unidade."
      />
      <Notice>
        Este histórico é local e pode ser alterado fora da aplicação. A auditoria protegida, a
        identidade autenticada e a retenção serão implementadas no servidor.
      </Notice>
      <Panel>
        <div className="table-toolbar">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Buscar operação ou perfil"
          />
          <span className="result-count">Últimos 150 registros do contexto</span>
        </div>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Quando</th>
                <th>Operação</th>
                <th>Perfil de demonstração</th>
                <th>Unidade</th>
              </tr>
            </thead>
            <tbody>
              {events.map((e) => (
                <tr key={e.id}>
                  <td>
                    {shortDate(e.at)}
                    <small className="cell-secondary">{clockTime(e.at)}</small>
                  </td>
                  <td>
                    <strong>{e.action}</strong>
                    <small className="cell-secondary record-number">
                      Referência: {e.entityId.slice(0, 16)}
                    </small>
                  </td>
                  <td>{e.actor}</td>
                  <td>{data.units.find((u) => u.id === e.unitId)?.name}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!events.length && (
          <EmptyState
            title="As próximas ações deixam um histórico"
            description="Cadastre uma pessoa ou registre uma operação para acompanhar a rastreabilidade local."
          />
        )}
      </Panel>
    </>
  );
}

const integrations = [
  {
    name: 'e-SUS APS / Siaps',
    scope: 'Transmissão e acompanhamento da produção da atenção primária.',
    next: 'Mapear dados, validar versões e realizar prova de transmissão.',
    url: 'https://sisaps.saude.gov.br/sistemas/esusaps/docs/manual/APOIO/API_transmissao/',
  },
  {
    name: 'RNDS',
    scope: 'Interoperabilidade de documentos e informações em saúde.',
    next: 'Definir documentos, credenciamento e ambiente de homologação.',
    url: 'https://rnds-guia.saude.gov.br/',
  },
  {
    name: 'CNES e cadastros oficiais',
    scope: 'Estabelecimentos, equipes, vínculos e identificadores de referência.',
    next: 'Definir importação, atualização e conciliação com o cadastro local.',
    url: 'https://cnes.datasus.gov.br/',
  },
  {
    name: 'Assistência farmacêutica',
    scope: 'Informações e fluxos da assistência farmacêutica pública.',
    next: 'Mapear os conjuntos exigidos e a integração aplicável à rede.',
    url: 'https://webatendimento.saude.gov.br/faq/esusaf',
  },
  {
    name: 'Produção e faturamento SUS',
    scope: 'AIH, BPA, APAC e fechamento conforme os serviços da rede.',
    next: 'Implementar regras por competência, críticas e conciliação de retornos.',
    url: 'https://controleavaliacao.saude.gov.br/',
  },
  {
    name: 'Laboratório e imagem',
    scope: 'Pedidos, amostras, laudos e retorno ao prontuário.',
    next: 'Definir parceiros e contratos de dados; validar o percurso completo.',
    url: null,
  },
  {
    name: 'Regulação e referência',
    scope: 'Solicitações, vagas e contrarreferência entre os serviços.',
    next: 'Identificar o sistema utilizado por cada rede e validar o intercâmbio.',
    url: 'https://www.gov.br/saude/pt-br/composicao/saes/drac/regulacao-do-acesso/sistemas-de-informacao/sistemas-de-informacao/',
  },
  {
    name: 'Identidade e persistência',
    scope: 'Acesso autenticado, permissões no servidor e dados protegidos.',
    next: 'Conectar o backend em uma etapa própria, conforme combinado.',
    url: null,
  },
];
export function Integrations() {
  return (
    <>
      <PageHeader
        eyebrow="CONEXÕES DA PLATAFORMA"
        title="Integrações"
        description="Dependências previstas para a operação real da rede pública."
      />
      <Notice>
        Nenhuma integração está ativa. Este painel registra o trabalho necessário, sem transmitir
        dados ou simular confirmações externas.
      </Notice>
      <div className="integration-grid">
        {integrations.map((i) => (
          <Panel key={i.name}>
            <div className="integration-card">
              <div className="integration-top">
                <span className="integration-icon">
                  <Cable size={23} />
                </span>
                <Badge>Não conectado</Badge>
              </div>
              <h2>{i.name}</h2>
              <p>{i.scope}</p>
              <div className="integration-next">
                <span>Próxima etapa</span>
                <p>{i.next}</p>
              </div>
              {i.url && (
                <a className="text-link" href={i.url} target="_blank" rel="noreferrer">
                  Referência oficial
                  <ExternalLink size={14} />
                </a>
              )}
            </div>
          </Panel>
        ))}
      </div>
    </>
  );
}

const scope = [
  [
    'Identidade e interface',
    'Base local',
    'Marca aprovada, componentes, navegação e contextos.',
    'Validar acessibilidade e usabilidade com as equipes.',
  ],
  [
    'Organizações, unidades e perfis',
    'Base local',
    'Diretório e filtros de contexto; perfis demonstrativos.',
    'Autenticação, autorização no servidor e isolamento de dados.',
  ],
  [
    'Cadastro de pessoas',
    'Fluxo local',
    'Cadastro, busca, nome social e histórico demonstrativo.',
    'CPF/CNS, responsáveis, duplicidades, migração e identidade.',
  ],
  [
    'Agenda e recepção',
    'Fluxo local',
    'Agendamento, conflitos, cancelamento, chegada e fila.',
    'Escalas, salas, bloqueios, faltas e validação em campo.',
  ],
  [
    'Prontuário e enfermagem',
    'Fluxo local',
    'Escuta, sinais vitais, novas aferições, correções e SOAP com complementos preservados.',
    'Autoria autenticada, assinatura, processo de enfermagem, documentos e ordens.',
  ],
  [
    'UPA e pronto atendimento',
    'Fluxo local',
    'Escuta, aferições seriadas, atendimento e estado de observação.',
    'Protocolo de risco aprovado, reavaliação clínica estruturada, medicação e transferências.',
  ],
  [
    'Internação e leitos',
    'Fluxo local',
    'Admissão, ocupação, saída e higienização.',
    'Transferências, isolamento, beira-leito e passagem de plantão.',
  ],
  [
    'Farmácia e suprimentos',
    'Fluxo local',
    'Lotes, validade, saldo e movimentos administrativos.',
    'Prescrição, validação, dispensação, administração, compras e perdas.',
  ],
  [
    'Regulação e transporte',
    'Fluxo local',
    'Solicitação e registro manual de agendamento.',
    'Vagas integradas, contrarreferência, transporte e TFD.',
  ],
  [
    'Vacinação e vigilância',
    'Fluxo local',
    'Caderneta, aplicações, lotes, perdas, quarentena, aprazamentos e produção por unidade.',
    'Calendário validado, codificação oficial, rede de frio completa, notificações e integração SUS.',
  ],
  [
    'Território e ACS',
    'Planejado',
    'Escopo incluído na primeira versão pública.',
    'Domicílios, famílias, microáreas, visitas e sincronização protegida.',
  ],
  [
    'Odontologia, CAPS e reabilitação',
    'Planejado',
    'Escopo incluído conforme os serviços da rede.',
    'Odontograma, tratamento e planos de cuidado multiprofissionais.',
  ],
  [
    'Centro cirúrgico, UTI e maternidade',
    'Planejado',
    'Escopo hospitalar incluído na primeira versão pública.',
    'Ordens, anestesia, recuperação, balanços e identificação mãe-bebê.',
  ],
  [
    'Diagnóstico, CME e hemoterapia',
    'Planejado',
    'Desenvolvimento ou integração especializada validada.',
    'Pedidos, laudos, resultados críticos, ciclos e rastreabilidade.',
  ],
  [
    'Operação hospitalar',
    'Planejado',
    'Nutrição, hotelaria, manutenção e engenharia clínica.',
    'Fluxos por setor e validação com responsáveis.',
  ],
  [
    'Gestão, produção e faturamento SUS',
    'Planejado',
    'Resumo operacional local e exportação agregada iniciados.',
    'Competências, tabelas, AIH/BPA/APAC, recursos e prestação de contas.',
  ],
  [
    'Continuidade, proteção e auditoria',
    'Planejado',
    'Histórico local e testes de regras de domínio iniciados.',
    'Backup, restauração, contingência hospitalar, segurança e operação 24/7.',
  ],
  [
    'Cidadão e comunicação',
    'Planejado',
    'Escopo incluído na primeira versão pública.',
    'Acesso representado, agendamentos, documentos e canais autorizados.',
  ],
];
export function Development() {
  const { context, repository, notify } = useApp();
  const [reset, setReset] = useState(false),
    [busy, setBusy] = useState(false);
  return (
    <>
      <PageHeader
        eyebrow="CONSTRUÇÃO DA CUIDELO"
        title="Plano de entrega"
        description="O desenvolvimento avança por dependências; o lançamento mantém o escopo público completo."
      />
      <div className="release-banner">
        <CheckCircle2 size={25} />
        <div>
          <h2>Identidade aprovada. Desenvolvimento iniciado.</h2>
          <p>
            Esta é uma base de trabalho local, anterior à primeira implantação. Nenhum módulo está
            homologado para uso clínico em produção.
          </p>
        </div>
        <a className="button secondary" href="/brand/guia.html" target="_blank" rel="noreferrer">
          Guia da marca
          <ExternalLink size={15} />
        </a>
      </div>
      <Panel
        title="Cobertura e próximos passos"
        subtitle="A existência de uma tela não significa conclusão operacional de um módulo."
      >
        <div className="table-scroll">
          <table className="roadmap-table">
            <thead>
              <tr>
                <th>Frente</th>
                <th>Etapa atual</th>
                <th>O que existe</th>
                <th>Próxima evidência necessária</th>
              </tr>
            </thead>
            <tbody>
              {scope.map(([name, status, has, next]) => (
                <tr key={name}>
                  <td>
                    <strong>{name}</strong>
                  </td>
                  <td>
                    <Badge tone={status === 'Planejado' ? 'neutral' : 'blue'}>{status}</Badge>
                  </td>
                  <td>{has}</td>
                  <td>{next}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <div className="next-steps">
        <CircleDot size={24} />
        <div>
          <h3>Próximo marco: identidade de acesso e persistência protegida</h3>
          <p>
            Depois da validação destes fluxos, conectar o backend, aplicar permissões no servidor e
            verificar o isolamento entre redes. A expansão para convênios e redes privadas continua
            em uma etapa posterior.
          </p>
        </div>
      </div>
      {can(context.role, 'manage') && (
        <Panel title="Dados de demonstração">
          <div className="reset-row">
            <div>
              <strong>Recomeçar o cenário de testes</strong>
              <p>
                Remove as alterações locais de todas as redes fictícias e recria os exemplos.
                Disponível no perfil Administração.
              </p>
            </div>
            <Button
              variant="secondary"
              disabled={context.role !== 'manager'}
              onClick={() => setReset(true)}
            >
              <RotateCcw size={16} />
              Redefinir cenário da prefeitura
            </Button>
          </div>
        </Panel>
      )}
      {reset && (
        <Modal title="Redefinir todos os dados fictícios?" onClose={() => setReset(false)}>
          <div className="modal-body">
            <p>
              Cadastros, agendas, rascunhos, internações e movimentos criados neste navegador serão
              substituídos pelo cenário inicial de todas as redes de demonstração.
            </p>
          </div>
          <div className="modal-actions">
            <Button variant="secondary" disabled={busy} onClick={() => setReset(false)}>
              Manter dados
            </Button>
            <Button
              variant="danger"
              disabled={busy}
              onClick={async () => {
                setBusy(true);
                try {
                  await repository.reset(context);
                  setReset(false);
                  notify('Cenário de demonstração recriado.');
                } catch (e) {
                  notify((e as Error).message, 'error');
                } finally {
                  setBusy(false);
                }
              }}
            >
              Redefinir dados fictícios
            </Button>
          </div>
        </Modal>
      )}
    </>
  );
}
