import {
  LayoutDashboard,
  CalendarDays,
  Users,
  ClipboardList,
  BedDouble,
  Pill,
  ArrowRightLeft,
  Building2,
  ShieldCheck,
  Workflow,
  Cable,
  Stethoscope,
  Monitor,
  SearchCheck,
  HeartPulse,
  Syringe,
  Package,
} from 'lucide-react';
import { can, type Permission, type Role } from '../domain/model';
import { workModules } from '../domain/work-modules';
export const navigation = [
  {
    group: 'Acompanhar',
    items: [
      { path: '/', label: 'Início', icon: LayoutDashboard },
      { path: '/modulos', label: 'Módulos e acompanhamentos', icon: Workflow },
    ],
  },
  {
    group: 'Assistência',
    items: [
      {
        path: '/recepcao',
        label: 'Recepção e atendimento',
        icon: ClipboardList,
        permission: 'queue',
      },
      { path: '/fila', label: 'Fila e salas', icon: Users, permission: 'queue' },
      { path: '/agenda', label: 'Agenda', icon: CalendarDays, permission: 'schedule' },
      { path: '/vacinacao', label: 'Sala de vacinação', icon: Syringe, permission: 'vaccination' },
      {
        path: '/escuta',
        label: 'Escuta e sinais vitais',
        icon: HeartPulse,
        permission: 'clinical',
      },
      { path: '/exames', label: 'Exames e resultados', icon: Stethoscope, permission: 'clinical' },
      { path: '/consultorio', label: 'Meu consultório', icon: Stethoscope, permission: 'clinical' },
      { path: '/senhas', label: 'Painel de senhas', icon: Monitor, permission: 'queue' },
      {
        path: '/pessoas',
        label: 'Pessoas e prontuários',
        icon: Users,
        permission: 'patients.read',
      },
      { path: '/hospital', label: 'Internação e leitos', icon: BedDouble, permission: 'beds' },
    ],
  },
  {
    group: 'Operação',
    items: [
      { path: '/farmacia', label: 'Farmácia e estoque', icon: Pill, permission: 'stock' },
      {
        path: '/vacinas-estoque',
        label: 'Lotes de vacinas',
        icon: Package,
        permission: 'vaccine.stock',
      },
      { path: '/regulacao', label: 'Regulação', icon: ArrowRightLeft, permission: 'regulation' },
    ],
  },
  {
    group: 'Gestão',
    items: [
      { path: '/unidades', label: 'Unidades da rede', icon: Building2, permission: 'network' },
      { path: '/vacinacao-rede', label: 'Vacinação da rede', icon: Syringe, permission: 'manage' },
      {
        path: '/auditoria',
        label: 'Histórico de operações',
        icon: ShieldCheck,
        permission: 'manage',
      },
      {
        path: '/desempenho',
        label: 'Tempos e desempenho',
        icon: LayoutDashboard,
        permission: 'performance',
      },
      { path: '/dispositivos', label: 'Totem e TV', icon: Monitor, permission: 'devices' },
      { path: '/integracoes', label: 'Integrações', icon: Cable },
      { path: '/desenvolvimento', label: 'Plano de entrega', icon: Workflow },
      { path: '/comparacao', label: 'Comparar com Pulso', icon: SearchCheck },
    ],
  },
];
export const stations: Record<Role, string[]> = {
  manager: ['/', '/unidades', '/desempenho'],
  reception: ['/recepcao', '/agenda', '/pessoas'],
  clinical: ['/consultorio', '/escuta', '/exames'],
  nursing: ['/escuta', '/vacinacao', '/exames'],
  pharmacy: ['/farmacia', '/vacinas-estoque'],
  regulation: ['/regulacao', '/agenda'],
  admin: ['/recepcao', '/agenda', '/hospital'],
  acs: ['/paineis/campo-hoje', '/modulos/familias', '/modulos/visitas'],
  business: ['/paineis/bo-resumo', '/modulos/bo-municipios'],
};
export const resources = ['/integracoes', '/desenvolvimento', '/comparacao'];
export const navItems = navigation.flatMap((g) => g.items);
export const reportLinks: {
  id: string;
  title: string;
  description: string;
  permission: Permission;
}[] = [
  {
    id: 'prenatal-municipio',
    title: 'Pré-natal da rede',
    description: 'Acompanhamentos ativos e encontros registrados por unidade.',
    permission: 'manage',
  },
  {
    id: 'relatorios',
    title: 'Relatórios da operação',
    description: 'Conferir e exportar os indicadores locais da rede ou unidade.',
    permission: 'manage',
  },
  {
    id: 'campo-hoje',
    title: 'Meu dia no território',
    description: 'Visitas planejadas e pendências das famílias.',
    permission: 'territory',
  },
  {
    id: 'campo-mapa',
    title: 'Microáreas e roteiro',
    description: 'Organizar domicílios por microárea e planejar visitas.',
    permission: 'territory',
  },
  {
    id: 'campo-envios',
    title: 'Registros e sincronização',
    description: 'Conferir os registros locais e as dependências de envio.',
    permission: 'territory',
  },
  {
    id: 'campo-mes',
    title: 'Produção do agente',
    description: 'Visitas, ausências e famílias acompanhadas no período.',
    permission: 'territory',
  },
  {
    id: 'bo-resumo',
    title: 'Resumo da empresa',
    description: 'Carteira, contratos, recebimentos e implantação.',
    permission: 'business',
  },
  {
    id: 'bo-uso',
    title: 'Acompanhamento dos clientes',
    description: 'Unidades previstas, implantação e chamados da carteira.',
    permission: 'business',
  },
];

export function scopeLabel(path: string, label: string, role?: Role) {
  if (role !== 'admin') return label;
  if (path === '/vacinacao-rede') return 'Vacinação da unidade';
  if (path === '/paineis/prenatal-municipio') return 'Pré-natal da unidade';
  return label;
}
export function routeInfo(path: string, role?: Role) {
  const root = path.split('/')[1],
    id = path.split('/')[2];
  if (root === 'modulos' && id) {
    const m = workModules.find((m) => m.id === id);
    if (m) return { label: m.title, permission: m.permission, parent: '/modulos' };
  }
  if (root === 'paineis' && id) {
    const r = reportLinks.find((r) => r.id === id);
    if (r)
      return {
        label: scopeLabel(path, r.title, role),
        permission: r.permission,
        parent: '/modulos',
      };
  }
  if (root === 'atendimento')
    return {
      label: 'Atendimento no consultório',
      permission: 'clinical' as const,
      parent: '/consultorio',
    };
  if (root === 'escuta' && id)
    return { label: 'Registro de escuta', permission: 'clinical' as const, parent: '/escuta' };
  if (root === 'pessoas' && id)
    return {
      label: 'Prontuário da pessoa',
      permission: 'patients.read' as const,
      parent: '/pessoas',
    };
  if (root === 'acesso') return { label: 'Acessos demonstrativos', parent: '/acesso' };
  const item = navItems.find((i) => i.path === path);
  return {
    label: scopeLabel(path, item?.label ?? 'Página indisponível', role),
    parent: item?.path ?? '',
    permission: item && 'permission' in item ? (item.permission as Permission) : undefined,
  };
}
export function allowedRoute(role: Role, path: string) {
  const i = routeInfo(path);
  return !!i.parent && (!i.permission || can(role, i.permission));
}

export const shortcuts: { path: string; title: string; detail: string; permission: Permission }[] =
  [
    {
      path: '/pessoas',
      title: 'Pessoas e prontuários',
      detail: 'Buscar cadastros e consultar o histórico da pessoa.',
      permission: 'patients.read',
    },
    {
      path: '/fila',
      title: 'Fila e salas',
      detail: 'Ver as senhas em espera e a ocupação das salas.',
      permission: 'queue',
    },
    {
      path: '/vacinas-estoque',
      title: 'Lotes de vacinas',
      detail: 'Conferir entradas, saldo e validade dos lotes.',
      permission: 'vaccine.stock',
    },
    {
      path: '/recepcao',
      title: 'Recepção',
      detail: 'Identificar chegadas, conferir senhas e acompanhar a fila.',
      permission: 'queue',
    },
    {
      path: '/consultorio',
      title: 'Meu consultório',
      detail: 'Chamar na TV e registrar o início e fim de cada consulta.',
      permission: 'clinical',
    },
    {
      path: '/exames',
      title: 'Exames e resultados',
      detail: 'Acompanhar pedidos, resultados recebidos e revisão médica.',
      permission: 'clinical',
    },
    {
      path: '/escuta',
      title: 'Escuta e sinais vitais',
      detail: 'Registrar o acolhimento antes da consulta.',
      permission: 'clinical',
    },
    {
      path: '/agenda',
      title: 'Agenda',
      detail: 'Marcar horários e confirmar chegadas.',
      permission: 'schedule',
    },
    {
      path: '/hospital',
      title: 'Internação e leitos',
      detail: 'Acompanhar admissões, saídas e disponibilidade.',
      permission: 'beds',
    },
    {
      path: '/vacinacao',
      title: 'Vacinação',
      detail: 'Aplicações, caderneta e retornos.',
      permission: 'vaccination',
    },
    {
      path: '/farmacia',
      title: 'Farmácia',
      detail: 'Conferir receitas, registrar entregas e controlar lotes.',
      permission: 'stock',
    },
    {
      path: '/regulacao',
      title: 'Regulação',
      detail: 'Solicitações e encaminhamentos da unidade.',
      permission: 'regulation',
    },
    {
      path: '/desempenho',
      title: 'Tempos e desempenho',
      detail: 'Espera, escuta e tempo em consultório.',
      permission: 'performance',
    },
    {
      path: '/dispositivos',
      title: 'Totem e TV',
      detail: 'Abrir as telas públicas desta unidade.',
      permission: 'devices',
    },
  ];
