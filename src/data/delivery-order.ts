// Sequência dos percursos que estavam parciais na auditoria de 31/10/2026.
export const deliveryGroups = [
  {
    name: 'Atendimento na unidade',
    ids: [
      'escuta',
      'fila',
      'consultorio',
      'farmacia',
      'agenda',
      'regulacao',
      'vacina',
      'recepcao',
      'prenatal',
    ],
  },
  {
    name: 'Acesso e operação da rede',
    ids: ['entrar', 'ativar', 'onde', 'config', 'lotacao', 'desempenho', 'auditoria', 'alertas'],
  },
  {
    name: 'Continuidade no território',
    ids: [
      'campo-entrar',
      'campo-familia',
      'campo-cadastro',
      'campo-visita',
      'campo-hoje',
      'campo-mapa',
      'campo-envios',
      'campo-mes',
      'lembretes',
      'zap-cidadao',
    ],
  },
  {
    name: 'Gestão municipal',
    ids: [
      'visao',
      'relatorios',
      'envio',
      'prenatal-municipio',
      'vacinacao',
      'indicadores',
      'campanhas',
      'nova-campanha',
      'zap-gestao',
    ],
  },
  {
    name: 'Operação da Cuidelo',
    ids: [
      'bo-municipios',
      'bo-implantacao',
      'bo-suporte',
      'bo-equipe',
      'bo-uso',
      'bo-contratos',
      'bo-recebimentos',
      'bo-resumo',
    ],
  },
];
export const deliveryOrder = new Map(
  deliveryGroups
    .flatMap((g) => g.ids.map((id) => ({ id, group: g.name })))
    .map((item, index) => [item.id, { position: index + 1, group: item.group }]),
);
