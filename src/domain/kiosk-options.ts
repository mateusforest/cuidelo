import type { UnitKind } from './model';
export const preferenceReasons = [
  { id: 'reception', label: 'Prefiro informar à recepção' },
  { id: 'elderly', label: 'Pessoa idosa · 60 anos ou mais' },
  { id: 'elderly-special', label: 'Pessoa idosa · mais de 80 anos' },
  { id: 'disability', label: 'Pessoa com deficiência' },
  { id: 'autism', label: 'Pessoa com transtorno do espectro autista' },
  { id: 'pregnant', label: 'Gestante' },
  { id: 'breastfeeding', label: 'Lactante' },
  { id: 'infant', label: 'Pessoa com criança de colo' },
  { id: 'obesity', label: 'Pessoa com obesidade' },
  { id: 'mobility', label: 'Pessoa com mobilidade reduzida' },
  { id: 'blood-donor', label: 'Doador de sangue · doação nos últimos 120 dias' },
] as const;
export type PreferenceReason = (typeof preferenceReasons)[number]['id'];
export function preferenceLabel(reason?: PreferenceReason) {
  return preferenceReasons.find((r) => r.id === reason)?.label ?? 'Conferir com a recepção';
}
const serviceOptions = [
  {
    value: 'Consulta',
    label: 'Consulta ou retorno',
    description: 'Atendimento médico e continuidade do cuidado',
    kinds: ['ubs', 'upa', 'hospital'],
  },
  {
    value: 'Vacinação',
    label: 'Vacinação',
    description: 'Sala de vacina e conferência da caderneta',
    kinds: ['ubs'],
  },
  {
    value: 'Procedimento',
    label: 'Enfermagem e procedimentos',
    description: 'Curativo, aferição e orientação da equipe',
    kinds: ['ubs', 'upa', 'hospital'],
  },
  {
    value: 'Farmácia',
    label: 'Farmácia',
    description: 'Retirada de medicamentos e orientações',
    kinds: ['ubs', 'hospital'],
  },
  {
    value: 'Exames e coleta',
    label: 'Exames e coleta',
    description: 'Conferência do pedido ou atendimento agendado',
    kinds: ['ubs', 'hospital'],
  },
  {
    value: 'Agendamento e cadastro',
    label: 'Agendamento e cadastro',
    description: 'Marcar atendimento ou atualizar seus dados',
    kinds: ['ubs', 'hospital'],
  },
  {
    value: 'Atendimento de urgência',
    label: 'Acolhimento de urgência',
    description: 'Procure a equipe para avaliação presencial',
    kinds: ['upa', 'hospital'],
  },
  {
    value: 'Admissão / internação',
    label: 'Admissão e internação',
    description: 'Apresente seu encaminhamento à recepção',
    kinds: ['hospital'],
  },
  {
    value: 'Orientação na recepção',
    label: 'Outros assuntos / não sei',
    description: 'A recepção ajuda a encontrar o atendimento',
    kinds: ['ubs', 'upa', 'hospital'],
  },
] as const;
export const kioskServices = serviceOptions.map((s) => s.value);
export function servicesForUnit(kind: UnitKind) {
  return serviceOptions.filter((s) => (s.kinds as readonly string[]).includes(kind));
}
