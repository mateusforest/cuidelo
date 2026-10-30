import type { Encounter, IntakeContent, IntakeRecord, Vitals } from './model';
import { readyForIntake } from './reception';
import { DomainError } from './errors';

// Limites de formato e capacidade de armazenamento, não faixas clínicas ou de normalidade.
export const vitalFields: {
  key: keyof Vitals;
  label: string;
  unit: string;
  max: number;
  step: number;
}[] = [
  { key: 'systolic', label: 'Pressão sistólica', unit: 'mmHg', max: 999, step: 1 },
  { key: 'diastolic', label: 'Pressão diastólica', unit: 'mmHg', max: 999, step: 1 },
  { key: 'pulse', label: 'Frequência cardíaca', unit: 'bpm', max: 999, step: 1 },
  { key: 'respiratoryRate', label: 'Frequência respiratória', unit: 'irpm', max: 999, step: 1 },
  { key: 'temperature', label: 'Temperatura', unit: '°C', max: 99.9, step: 0.1 },
  { key: 'oxygenSaturation', label: 'Saturação de oxigênio', unit: '%', max: 100, step: 1 },
  { key: 'weight', label: 'Peso', unit: 'kg', max: 999.999, step: 0.001 },
  { key: 'height', label: 'Altura', unit: 'cm', max: 999.9, step: 0.1 },
];

export function validateIntakeContent(content: IntakeContent): IntakeContent {
  if (
    !content ||
    typeof content.complaint !== 'string' ||
    typeof content.observations !== 'string' ||
    !content.vitals ||
    typeof content.vitals !== 'object' ||
    Array.isArray(content.vitals)
  )
    throw new DomainError('Revise o conteúdo da escuta.');
  if (content.complaint.length > 2000 || content.observations.length > 4000)
    throw new DomainError('O relato permite 2.000 caracteres e as observações, 4.000.');
  const vitals: Vitals = {};
  for (const key of Object.keys(content.vitals))
    if (!vitalFields.some((f) => f.key === key)) throw new DomainError('Medida não reconhecida.');
  for (const field of vitalFields) {
    const value = content.vitals[field.key];
    if (value === undefined) continue;
    if (
      typeof value !== 'number' ||
      !Number.isFinite(value) ||
      value < 0 ||
      ((field.key === 'weight' || field.key === 'height') && value === 0) ||
      value > field.max ||
      Math.abs(value / field.step - Math.round(value / field.step)) > 0.000001
    )
      throw new DomainError(
        `Revise ${field.label.toLocaleLowerCase('pt-BR')}: informe um valor em ${field.unit}, respeitando o intervalo e a precisão do campo.`,
      );
    vitals[field.key] = value;
  }
  if ((vitals.systolic === undefined) !== (vitals.diastolic === undefined))
    throw new DomainError('Informe as duas medidas da pressão arterial ou deixe ambas em branco.');
  const complaint = content.complaint.trim(),
    observations = content.observations.trim();
  if (!complaint && !observations && !Object.keys(vitals).length)
    throw new DomainError('Registre um relato, uma observação ou uma medida.');
  return { complaint, observations, vitals };
}

export function activeIntakes(records: IntakeRecord[]) {
  const corrected = new Set(records.map((r) => r.correctionOf).filter(Boolean));
  return records.filter((r) => !corrected.has(r.id));
}

export function intakeQueueState(encounter: Encounter, hasRecord: boolean) {
  if (encounter.status === 'completed') return 'completed';
  if (hasRecord) return 'recorded';
  if (encounter.status !== 'waiting' || !readyForIntake(encounter)) return 'other';
  return encounter.intakeStartedAt ? 'active' : 'pending';
}
