import { can, type Command, type Context, type Database, type Permission } from './model';
import { validDay } from './dates';
import { DomainError } from './errors';

export interface WorkField {
  key: string;
  label: string;
  type?: 'text' | 'textarea' | 'date' | 'number' | 'select' | 'patient' | 'reference';
  options?: string[];
  reference?: string;
  optional?: boolean;
  min?: number;
  max?: number;
}
export interface WorkModule {
  id: string;
  title: string;
  group: string;
  permission: Permission;
  description: string;
  limit: string;
  fields: WorkField[];
  states: Record<string, string>;
  transitions: Record<string, string[]>;
  initial: string;
  network?: boolean;
  sealed?: string[];
}
const text = (key: string, label: string, optional = false): WorkField => ({
  key,
  label,
  optional,
});
const area = (key: string, label: string, optional = false): WorkField => ({
  key,
  label,
  type: 'textarea',
  optional,
});
const day = (key: string, label: string): WorkField => ({ key, label, type: 'date' });
const num = (key: string, label: string, min = 0, max = 100000000): WorkField => ({
  key,
  label,
  type: 'number',
  min,
  max,
});
const select = (key: string, label: string, options: string[]): WorkField => ({
  key,
  label,
  type: 'select',
  options,
});
const ref = (key: string, label: string, reference: string): WorkField => ({
  key,
  label,
  type: 'reference',
  reference,
});
const patient: WorkField = { key: 'patientId', label: 'Pessoa', type: 'patient' };
const flow = {
  states: {
    draft: 'Em preparação',
    active: 'Em acompanhamento',
    done: 'Concluído',
    cancelled: 'Cancelado',
  },
  transitions: { draft: ['active', 'cancelled'], active: ['done', 'cancelled'] },
  initial: 'draft',
  sealed: ['done', 'cancelled'],
};
const task = {
  states: { planned: 'Planejado', done: 'Registrado', cancelled: 'Cancelado' },
  transitions: { planned: ['done', 'cancelled'] },
  initial: 'planned',
  sealed: ['done', 'cancelled'],
};
export const workModules: WorkModule[] = [
  {
    id: 'prenatal',
    title: 'Acompanhamento pré-natal',
    group: 'Assistência',
    permission: 'clinical',
    description: 'Abra o acompanhamento e registre os encontros da gestação.',
    limit:
      'DPP e avaliações são informadas pelo profissional. Protocolos, alertas clínicos, exames e integração com a maternidade ainda dependem de validação.',
    fields: [
      patient,
      day('start', 'Início do acompanhamento'),
      day('expected', 'Data provável do parto informada'),
      text('responsible', 'Profissional responsável'),
      area('notes', 'Observações iniciais'),
    ],
    ...flow,
  },
  {
    id: 'prenatal-consultas',
    title: 'Encontros do pré-natal',
    group: 'Assistência',
    permission: 'clinical',
    description: 'Registro de encontros vinculado ao acompanhamento da pessoa.',
    limit:
      'Não calcula risco, conduta ou idade gestacional. Um registro concluído recebe complementos no histórico, sem substituição do conteúdo.',
    fields: [
      ref('episode', 'Acompanhamento', 'prenatal'),
      day('date', 'Data do encontro'),
      num('week', 'Semana gestacional informada', 0, 45),
      area('assessment', 'Avaliação registrada pelo profissional'),
      area('plan', 'Plano registrado pelo profissional'),
    ],
    ...task,
  },
  {
    id: 'ativacao',
    title: 'Vínculos e primeiro acesso',
    group: 'Gestão',
    permission: 'quality',
    description: 'Prepare os vínculos e registre a conferência de acesso da equipe.',
    limit:
      'Não cria credenciais, envia convites ou ativa usuários reais. A autenticação será conectada posteriormente.',
    fields: [
      text('name', 'Nome fictício do profissional'),
      select('role', 'Função', [
        'Recepção',
        'Equipe médica',
        'Enfermagem',
        'Farmácia',
        'Agente de saúde',
        'Administração da unidade',
      ]),
      text('unit', 'Unidade de vínculo'),
      text('registration', 'Identificador profissional de teste'),
      area('evidence', 'Conferência do vínculo'),
    ],
    ...flow,
    network: true,
  },
  {
    id: 'indicadores',
    title: 'Indicadores e evidências',
    group: 'Gestão',
    permission: 'quality',
    description: 'Acompanhe metas locais com período, fonte e memória de cálculo.',
    limit:
      'Indicadores locais informados manualmente. Não representam cálculo oficial de cofinanciamento ou validação de produção SUS.',
    fields: [
      text('name', 'Nome do indicador'),
      day('from', 'Início do período'),
      day('to', 'Fim do período'),
      num('numerator', 'Numerador'),
      num('denominator', 'Denominador', 1),
      num('target', 'Meta percentual', 0, 100),
      area('source', 'Fonte e evidências'),
    ],
    ...flow,
    network: true,
  },
  {
    id: 'envio',
    title: 'Preparação de produção',
    group: 'Gestão',
    permission: 'quality',
    description: 'Organize competências e pendências para conferência pela gestão.',
    limit:
      'Nenhum lote é transmitido ao SUS. Layouts, códigos oficiais e validação externa ainda não estão conectados.',
    fields: [
      text('competence', 'Competência (AAAA-MM)'),
      select('destination', 'Destino previsto', [
        'e-SUS APS',
        'SIA / BPA',
        'SIH / AIH',
        'APAC',
        'Outro sistema oficial',
      ]),
      num('records', 'Quantidade de registros declarada'),
      area('evidence', 'Referência da produção e conferências'),
      area('issues', 'Pendências encontradas', true),
    ],
    states: { draft: 'Em preparação', checked: 'Conferido localmente', cancelled: 'Cancelado' },
    transitions: { draft: ['checked', 'cancelled'] },
    initial: 'draft',
    sealed: ['checked', 'cancelled'],
    network: true,
  },
  {
    id: 'campanhas',
    title: 'Campanhas e busca ativa',
    group: 'Comunicação',
    permission: 'outreach',
    description: 'Planeje ações, público, responsáveis e acompanhamento.',
    limit:
      'A lista não envia mensagens nem seleciona pacientes automaticamente. Revise o público e os canais antes de qualquer contato real.',
    fields: [
      text('name', 'Nome da campanha'),
      text('audience', 'Público definido pela equipe'),
      day('from', 'Início'),
      day('to', 'Fim'),
      text('owner', 'Responsável'),
      area('message', 'Rascunho de orientação'),
      area('criteria', 'Critérios e objetivo'),
    ],
    ...flow,
    network: true,
  },
  {
    id: 'lembretes',
    title: 'Lembretes e retornos',
    group: 'Comunicação',
    permission: 'outreach',
    description: 'Organize tarefas de contato e documente o resultado manualmente.',
    limit:
      'Não há disparos automáticos D-10 ou D-2, nem confirmação por WhatsApp. Agendamentos continuam sendo alterados na agenda.',
    fields: [
      text('reference', 'Referência do agendamento ou retorno'),
      day('date', 'Data prevista do contato'),
      text('owner', 'Responsável'),
      select('channel', 'Canal planejado', ['Telefone', 'Presencial', 'Mensagem a preparar']),
      area('message', 'Rascunho do lembrete'),
    ],
    ...task,
    network: true,
  },
  {
    id: 'alertas',
    title: 'Pendências e alertas operacionais',
    group: 'Gestão',
    permission: 'quality',
    description: 'Distribua pendências, acompanhe prazos e registre a resolução.',
    limit:
      'Alertas operacionais manuais. Não são avisos de risco clínico ou monitoramento automático.',
    fields: [
      text('name', 'Pendência'),
      select('level', 'Prioridade operacional', ['Rotina', 'Atenção', 'Urgente']),
      text('owner', 'Responsável'),
      day('deadline', 'Prazo'),
      area('detail', 'Descrição e referência'),
    ],
    ...flow,
    network: true,
  },
  {
    id: 'auditoria-revisao',
    title: 'Revisão de registros',
    group: 'Gestão',
    permission: 'quality',
    description: 'Organize achados e acompanhe a revisão humana das operações.',
    limit:
      'Sem análise por IA ou acesso administrativo ao conteúdo clínico. Use referências do histórico de operações, sem copiar dados de saúde.',
    fields: [
      text('reference', 'Referência da operação'),
      area('finding', 'Achado operacional'),
      text('owner', 'Responsável pela revisão'),
      day('deadline', 'Prazo'),
      area('action', 'Ação proposta'),
    ],
    ...flow,
    network: true,
  },
  {
    id: 'mensagens-gestao',
    title: 'Comunicados da gestão',
    group: 'Comunicação',
    permission: 'outreach',
    description: 'Prepare comunicados e registre a revisão antes do contato.',
    limit: 'Rascunhos locais; nenhum WhatsApp, e-mail ou notificação é enviado.',
    fields: [
      text('name', 'Assunto'),
      text('audience', 'Destinatários previstos'),
      area('message', 'Mensagem'),
      text('reviewer', 'Responsável pela revisão'),
    ],
    states: { draft: 'Rascunho', reviewed: 'Revisado localmente', cancelled: 'Cancelado' },
    transitions: { draft: ['reviewed', 'cancelled'] },
    initial: 'draft',
    sealed: ['reviewed', 'cancelled'],
    network: true,
  },
  {
    id: 'cidadao',
    title: 'Solicitações do cidadão',
    group: 'Comunicação',
    permission: 'outreach',
    description: 'Registre uma solicitação recebida pela equipe e acompanhe a resposta.',
    limit:
      'Balcão de registro manual. Portal autenticado, representação legal e canal WhatsApp do cidadão ainda não estão conectados.',
    fields: [
      text('reference', 'Referência fictícia do solicitante'),
      select('kind', 'Tipo', [
        'Informação',
        'Confirmação',
        'Remarcação',
        'Cancelamento',
        'Ouvidoria',
      ]),
      area('request', 'Solicitação recebida'),
      text('owner', 'Responsável'),
      day('deadline', 'Prazo de retorno'),
    ],
    ...flow,
    network: true,
  },
  {
    id: 'familias',
    title: 'Famílias e domicílios',
    group: 'Território',
    permission: 'territory',
    description: 'Cadastre domicílios fictícios por microárea e organize o acompanhamento.',
    limit:
      'A localização é informada manualmente. Não há geocodificação, mapa real ou troca de dados com cadastro nacional.',
    fields: [
      text('name', 'Referência da família'),
      text('address', 'Endereço fictício'),
      text('microarea', 'Microárea'),
      text('agent', 'Agente responsável'),
      num('members', 'Quantidade de moradores', 1, 100),
      area('composition', 'Composição familiar e referências de cadastro'),
      area('needs', 'Necessidades de acompanhamento'),
    ],
    ...flow,
  },
  {
    id: 'visitas',
    title: 'Agenda e registro de visitas',
    group: 'Território',
    permission: 'territory',
    description: 'Planeje visitas e registre a realização, ausência ou reagendamento.',
    limit: 'Dados ficam neste navegador. Não há sincronização com dispositivos ou envio oficial.',
    fields: [
      ref('family', 'Família / domicílio', 'familias'),
      day('date', 'Data planejada'),
      text('agent', 'Agente responsável'),
      select('priority', 'Prioridade de acompanhamento', [
        'Rotina',
        'Retorno pendente',
        'Solicitação da equipe',
      ]),
      area('purpose', 'Objetivo da visita'),
    ],
    states: {
      planned: 'Agendada',
      visited: 'Visita registrada',
      absent: 'Não encontrado',
      cancelled: 'Cancelada',
    },
    transitions: { planned: ['visited', 'absent', 'cancelled'], absent: ['planned', 'cancelled'] },
    initial: 'planned',
    sealed: ['visited', 'cancelled'],
  },
  {
    id: 'bo-municipios',
    title: 'Clientes e municípios',
    group: 'Empresa',
    permission: 'business',
    description: 'Mantenha a carteira comercial da Cuidelo separada da assistência.',
    limit:
      'Cadastros comerciais fictícios. Não criam prefeituras ou liberam acesso à base assistencial.',
    fields: [
      text('name', 'Cliente / prefeitura'),
      text('city', 'Município / UF'),
      text('contact', 'Contato comercial fictício'),
      num('units', 'Unidades previstas', 1, 10000),
      text('owner', 'Responsável comercial'),
    ],
    ...flow,
  },
  {
    id: 'bo-contratos',
    title: 'Contratos',
    group: 'Empresa',
    permission: 'business',
    description: 'Organize vigência, escopo e valores de contratos de demonstração.',
    limit: 'Registro administrativo, sem assinatura, cobrança ou contratação real.',
    fields: [
      ref('client', 'Cliente', 'bo-municipios'),
      text('name', 'Referência do contrato'),
      day('from', 'Início da vigência'),
      day('to', 'Fim da vigência'),
      num('amount', 'Valor mensal declarado (R$)', 0.01),
      area('scope', 'Escopo e condições'),
    ],
    ...flow,
  },
  {
    id: 'bo-recebimentos',
    title: 'Recebimentos',
    group: 'Empresa',
    permission: 'business',
    description: 'Acompanhe vencimentos e registre a conciliação manual de demonstração.',
    limit:
      'Sem conexão bancária, pagamento ou emissão de cobrança. A confirmação é somente uma anotação manual.',
    fields: [
      ref('contract', 'Contrato', 'bo-contratos'),
      text('name', 'Referência da fatura'),
      day('due', 'Vencimento'),
      num('amount', 'Valor (R$)', 0.01),
      text('reference', 'Referência de conciliação fictícia'),
    ],
    states: { open: 'Em aberto', recorded: 'Recebimento anotado', cancelled: 'Cancelado' },
    transitions: { open: ['recorded', 'cancelled'] },
    initial: 'open',
    sealed: ['recorded', 'cancelled'],
  },
  {
    id: 'bo-implantacao',
    title: 'Implantação',
    group: 'Empresa',
    permission: 'business',
    description: 'Acompanhe etapas, responsáveis e evidências de cada implantação.',
    limit:
      'A conclusão de uma tarefa não autoriza operação clínica. Os critérios de liberação permanecem no plano do projeto.',
    fields: [
      ref('client', 'Cliente', 'bo-municipios'),
      select('stage', 'Etapa', [
        'Levantamento',
        'Cadastros',
        'Infraestrutura',
        'Treinamento',
        'Validação',
        'Aceite',
      ]),
      text('owner', 'Responsável'),
      day('deadline', 'Prazo'),
      area('evidence', 'Evidência ou critério de aceite'),
    ],
    ...flow,
  },
  {
    id: 'bo-suporte',
    title: 'Central de suporte',
    group: 'Empresa',
    permission: 'business',
    description: 'Registre chamados, responsáveis, prazos e soluções.',
    limit:
      'Não copie prontuários, credenciais ou dados reais. Sem e-mail, chat ou SLA automatizado.',
    fields: [
      ref('client', 'Cliente', 'bo-municipios'),
      text('name', 'Assunto'),
      select('priority', 'Prioridade', ['Baixa', 'Normal', 'Alta', 'Crítica']),
      text('owner', 'Responsável'),
      day('deadline', 'Prazo acordado'),
      area('detail', 'Descrição sem dados de saúde'),
    ],
    ...flow,
  },
  {
    id: 'bo-equipe',
    title: 'Equipe da Cuidelo',
    group: 'Empresa',
    permission: 'business',
    description: 'Organize responsabilidades comerciais, implantação e suporte.',
    limit: 'Diretório de demonstração; não cria contas de acesso nem altera permissões reais.',
    fields: [
      text('name', 'Nome fictício'),
      select('area', 'Área', ['Comercial', 'Implantação', 'Suporte', 'Desenvolvimento', 'Gestão']),
      text('responsibility', 'Responsabilidades'),
      text('contact', 'Contato fictício'),
    ],
    ...flow,
  },
];
export function moduleFor(id: string) {
  const m = workModules.find((m) => m.id === id);
  if (!m) throw new DomainError('Módulo não encontrado.');
  return m;
}
function allowed(m: WorkModule, c: Context) {
  return can(c.role, m.permission);
}
export function visibleWorkRecords(db: Database, c: Context) {
  return db.workRecords.filter(
    (r) =>
      r.organizationId === c.organizationId &&
      (c.unitId === 'all' ||
        r.unitId === c.unitId ||
        (can(c.role, 'clinical') && r.module.startsWith('prenatal'))) &&
      allowed(moduleFor(r.module), c),
  );
}
export function workMetrics(db: Database, c: Context) {
  if (!can(c.role, 'manage') && !can(c.role, 'territory') && !can(c.role, 'business'))
    throw new DomainError('Indicadores indisponíveis para este perfil.', 'permission');
  const records = db.workRecords.filter(
    (r) => r.organizationId === c.organizationId && (c.unitId === 'all' || r.unitId === c.unitId),
  );
  return db.units
    .filter(
      (u) => u.organizationId === c.organizationId && (c.unitId === 'all' || u.id === c.unitId),
    )
    .map((u) => ({
      unit: u.name,
      prenatal: records.filter(
        (r) =>
          r.unitId === u.id && r.module === 'prenatal' && !['done', 'cancelled'].includes(r.status),
      ).length,
      consultations: records.filter(
        (r) => r.unitId === u.id && r.module === 'prenatal-consultas' && r.status === 'done',
      ).length,
      families: records.filter(
        (r) =>
          r.unitId === u.id && r.module === 'familias' && !['done', 'cancelled'].includes(r.status),
      ).length,
      visits: records.filter(
        (r) => r.unitId === u.id && r.module === 'visitas' && r.status === 'visited',
      ).length,
    }));
}
function validateValues(db: Database, c: Context, m: WorkModule, values: Record<string, string>) {
  if (
    !values ||
    typeof values !== 'object' ||
    Array.isArray(values) ||
    Object.keys(values).some((k) => !m.fields.some((f) => f.key === k))
  )
    throw new DomainError('Campos inválidos para este módulo.');
  const result: Record<string, string> = {};
  for (const f of m.fields) {
    if (typeof values[f.key] !== 'string') throw new DomainError(`Revise o campo ${f.label}.`);
    const value = values[f.key].trim();
    if ((!value && !f.optional) || value.length > 4000)
      throw new DomainError(`Revise o campo ${f.label}.`);
    if (value) {
      if (f.type === 'date' && !validDay(value))
        throw new DomainError(`${f.label}: data inválida.`);
      if (
        f.type === 'number' &&
        (!Number.isFinite(Number(value)) ||
          Number(value) < (f.min ?? 0) ||
          Number(value) > (f.max ?? 100000000))
      )
        throw new DomainError(`${f.label}: valor fora do intervalo.`);
      if (
        f.type === 'number' &&
        ['week', 'members', 'units', 'records', 'numerator', 'denominator'].includes(f.key) &&
        !Number.isSafeInteger(Number(value))
      )
        throw new DomainError(`${f.label}: informe um número inteiro.`);
      if (f.type === 'select' && !f.options?.includes(value))
        throw new DomainError(`${f.label}: opção inválida.`);
      if (
        f.type === 'patient' &&
        !db.patients.some((p) => p.id === value && p.organizationId === c.organizationId)
      )
        throw new DomainError('Pessoa não encontrada nesta prefeitura.', 'scope');
      if (
        f.type === 'reference' &&
        !db.workRecords.some(
          (r) =>
            r.id === value &&
            r.module === f.reference &&
            r.organizationId === c.organizationId &&
            r.unitId === c.unitId &&
            !['cancelled', 'done'].includes(r.status),
        )
      )
        throw new DomainError(`${f.label}: selecione um registro ativo desta unidade.`, 'scope');
    }
    result[f.key] = value;
  }
  if (result.from && result.to && result.from > result.to)
    throw new DomainError('O fim deve ser igual ou posterior ao início.');
  if (m.id === 'prenatal' && result.start > result.expected)
    throw new DomainError('Revise o início do acompanhamento e a data provável do parto.');
  if (m.id === 'indicadores' && Number(result.numerator) > Number(result.denominator))
    throw new DomainError('O numerador não pode superar o denominador neste indicador percentual.');
  if (m.id === 'envio' && !/^\d{4}-(0[1-9]|1[0-2])$/.test(result.competence))
    throw new DomainError('Use competência no formato AAAA-MM.');
  return result;
}
export function applyWorkCommand(
  db: Database,
  c: Context,
  command: Extract<Command, { type: 'work.create' | 'work.transition' | 'work.update' }>,
  at: string,
  id: () => string,
) {
  const original =
    command.type === 'work.create'
      ? undefined
      : db.workRecords.find(
          (r) =>
            r.id === command.id &&
            r.organizationId === c.organizationId &&
            (r.unitId === c.unitId || (c.role === 'manager' && c.unitId === 'all')),
        );
  if (command.type !== 'work.create' && !original)
    throw new DomainError('Registro não encontrado neste contexto.', 'scope');
  const m = moduleFor(command.type === 'work.create' ? command.module : original!.module);
  if (!allowed(m, c))
    throw new DomainError('Este perfil não tem acesso a este módulo.', 'permission');
  if (c.unitId === 'all' && !m.network)
    throw new DomainError('Selecione uma unidade para este registro.', 'scope');
  if (command.type === 'work.create') {
    const values = validateValues(db, c, m, command.values);
    if (
      m.id === 'prenatal' &&
      db.workRecords.some(
        (r) =>
          r.organizationId === c.organizationId &&
          r.module === 'prenatal' &&
          r.values.patientId === values.patientId &&
          !m.sealed?.includes(r.status),
      )
    )
      throw new DomainError(
        'Já existe um acompanhamento aberto para esta pessoa na prefeitura.',
        'conflict',
      );
    const entityId = id();
    db.workRecords.push({
      id: entityId,
      organizationId: c.organizationId,
      unitId: c.unitId,
      module: m.id,
      values,
      status: m.initial,
      createdAt: at,
      updatedAt: at,
      authorId: c.sessionId,
      history: [{ at, actorId: c.sessionId, action: 'Registro criado', reason: '' }],
    });
    return { entityId, action: `${m.title}: registro criado` };
  }
  const r = original!;
  if (!command.reason.trim() || command.reason.length > 4000)
    throw new DomainError('Informe o resultado ou motivo desta alteração.');
  if (m.sealed?.includes(r.status))
    throw new DomainError(
      'Registro encerrado e preservado. Crie um novo registro para continuidade.',
      'immutable',
    );
  if (command.type === 'work.transition') {
    if (!m.transitions[r.status]?.includes(command.status))
      throw new DomainError('Esta mudança de situação não é permitida.', 'conflict');
    r.history.push({
      at,
      actorId: c.sessionId,
      action: `${m.states[r.status]} → ${m.states[command.status]}`,
      reason: command.reason.trim(),
    });
    r.status = command.status;
  } else {
    const values = validateValues(db, c, m, command.values);
    if (m.id === 'prenatal' && values.patientId !== r.values.patientId)
      throw new DomainError('A pessoa do acompanhamento não pode ser substituída.');
    r.history.push({
      at,
      actorId: c.sessionId,
      action: 'Dados atualizados',
      reason: command.reason.trim(),
      previousValues: { ...r.values },
    });
    r.values = values;
  }
  r.updatedAt = at;
  return {
    entityId: r.id,
    action: `${m.title}: ${command.type === 'work.transition' ? 'situação alterada' : 'dados atualizados'}`,
  };
}
