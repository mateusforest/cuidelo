import { createSeed } from './seed';
import { demoContext } from '../domain/access';
import { citizenView } from '../domain/citizen';
import { applyCommand } from '../domain/operations';
import { dateKey, addDays } from '../domain/dates';
import type { Command } from '../domain/model';
import type { DocumentContent } from '../domain/clinical-documents';

export const citizenExamples = { ana: 'Ana Clara Martins', joao: 'João Pedro Souza' } as const;
export type ExampleId = keyof typeof citizenExamples;

// Roteiro isolado. Usa os comandos da agenda e do consultório, sem alterar o trabalho da equipe.
export function readCitizenExample(example: ExampleId, now = new Date()) {
  const today = dateKey(now),
    visitDay = addDays(today, -2),
    at = new Date(visitDay + 'T12:00:00-03:00');
  const db = createSeed(at),
    unit = 'aurora-centro',
    doctor = demoContext('aurora', unit, 'clinical'),
    desk = demoContext('aurora', unit, 'reception');
  const patientId = example === 'ana' ? 'aurora-p1' : 'aurora-p2',
    encounterId = example === 'ana' ? unit + '-e0' : unit + '-e1';
  let seq = 0;
  const id = (): ReturnType<Crypto['randomUUID']> =>
    `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
  const schedule = (days: number, time: string, service: string) =>
    applyCommand(
      db,
      desk,
      {
        type: 'appointment.create',
        patientId,
        service,
        professional: 'Equipe de referência · demo',
        date: addDays(today, days),
        time,
        duration: 30,
      },
      at,
      id,
    );
  schedule(
    1,
    example === 'ana' ? '09:30' : '14:00',
    example === 'ana' ? 'Consulta de acompanhamento' : 'Consulta de enfermagem',
  );
  if (example === 'ana') {
    schedule(6, '10:15', 'Retorno na unidade');
    const cancelled = schedule(-1, '15:00', 'Consulta médica');
    applyCommand(
      db,
      desk,
      { type: 'appointment.cancel', id: cancelled, reason: 'Remarcação de exemplo' },
      at,
      id,
    );
  }
  const command = (cmd: Command) => applyCommand(db, doctor, cmd, at, id);
  command({ type: 'encounter.start', id: encounterId });
  const issue = (content: DocumentContent) => {
    const doc = command({ type: 'document.save', encounterId, expectedVersion: 0, content });
    command({ type: 'document.issue', id: doc, expectedVersion: 1, reviewed: true });
    return doc;
  };
  if (example === 'ana') {
    issue({
      kind: 'prescription',
      orientations: 'Receita fictícia para conhecer o aplicativo.',
      items: [
        {
          id: 'item-demo',
          medicine: 'Medicamento demonstrativo A',
          strength: 'Concentração de exemplo',
          form: 'Apresentação de exemplo',
          dose: 'Dose fictícia',
          route: 'Via fictícia',
          frequency: 'Frequência fictícia',
          duration: 'Duração fictícia',
          quantity: '1',
          quantityUnit: 'unidade de teste',
          instructions: 'Exemplo sem uso clínico.',
        },
      ],
    });
    issue({
      kind: 'exams',
      items: [
        {
          id: 'exame-demo',
          name: 'Exame laboratorial demonstrativo',
          material: 'Amostra fictícia',
          notes: '',
        },
      ],
      indication: 'Solicitação fictícia de acompanhamento.',
      priority: 'routine',
      priorityReason: '',
    });
    issue({ kind: 'certificate', startDate: visitDay, days: '2' });
  }
  command({
    type: 'note.finalize',
    encounterId,
    record: {
      soap: {
        subjective: '',
        objective: '',
        assessment: 'Avaliação fictícia',
        plan: 'Acompanhamento demonstrativo',
      },
      coding: { codes: [], reason: 'Exemplo de navegação' },
    },
  });
  return citizenView(db, doctor, patientId, now);
}
