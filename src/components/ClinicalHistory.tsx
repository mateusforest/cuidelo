import { Badge, Button } from './ui';
import type { IntakeRecord, NoteAddendum, Vitals } from '../domain/model';
import { activeIntakes, vitalFields } from '../domain/intake';
import { clockTime, shortDate } from '../domain/dates';

export function VitalsSummary({ vitals }: { vitals: Vitals }) {
  return Object.keys(vitals).length ? (
    <dl className="vitals-summary">
      {vitalFields
        .filter((f) => vitals[f.key] !== undefined)
        .map((f) => (
          <div key={f.key}>
            <dt>{f.label}</dt>
            <dd>
              {vitals[f.key]!.toLocaleString('pt-BR', { maximumFractionDigits: 3 })}{' '}
              <small>{f.unit}</small>
            </dd>
          </div>
        ))}
    </dl>
  ) : (
    <p className="muted">Sem medidas neste registro.</p>
  );
}

export function IntakeHistory({
  records,
  onCorrect,
  unitNames,
}: {
  records: IntakeRecord[];
  onCorrect?: (record: IntakeRecord) => void;
  unitNames?: Record<string, string>;
}) {
  const current = new Set(activeIntakes(records).map((r) => r.id));
  return (
    <div className="intake-history">
      {[...records].reverse().map((r) => (
        <article key={r.id} className={`intake-entry ${current.has(r.id) ? '' : 'superseded'}`}>
          <div className="intake-entry-heading">
            <div>
              <strong>
                {r.kind === 'initial'
                  ? 'Escuta inicial'
                  : r.kind === 'correction'
                    ? 'Correção de registro'
                    : 'Nova aferição'}
              </strong>
              <small>
                Registrado em {shortDate(r.recordedAt)} às {clockTime(r.recordedAt)} ·{' '}
                {unitNames?.[r.unitId] ? `${unitNames[r.unitId]} · ` : ''}
                {r.author}
              </small>
            </div>
            {!current.has(r.id) && <Badge>Substituído por correção</Badge>}
          </div>
          {r.correctionReason && (
            <p className="correction-reason">
              <strong>Motivo da correção:</strong> {r.correctionReason}
            </p>
          )}
          {r.correctionOf && (
            <p className="muted">
              Corrige o registro de{' '}
              {clockTime(records.find((i) => i.id === r.correctionOf)?.recordedAt ?? r.recordedAt)}.
              O conteúdo anterior continua no histórico.
            </p>
          )}
          {r.complaint && (
            <div className="note-text">
              <span>Motivo da procura</span>
              <p>{r.complaint}</p>
            </div>
          )}
          <VitalsSummary vitals={r.vitals} />
          {r.observations && (
            <div className="note-text">
              <span>Observações</span>
              <p>{r.observations}</p>
            </div>
          )}
          {onCorrect && current.has(r.id) && (
            <Button variant="ghost" onClick={() => onCorrect(r)}>
              Registrar correção
            </Button>
          )}
        </article>
      ))}
    </div>
  );
}

export function NoteAddenda({ items }: { items: NoteAddendum[] }) {
  return (
    <div className="note-addenda">
      {items.map((a) => (
        <article className="intake-entry" key={a.id}>
          <div className="intake-entry-heading">
            <div>
              <strong>Complemento do registro</strong>
              <small>
                {shortDate(a.recordedAt)} às {clockTime(a.recordedAt)} · {a.author}
              </small>
            </div>
            <Badge>Preservado</Badge>
          </div>
          <p className="correction-reason">
            <strong>Motivo:</strong> {a.reason}
          </p>
          <p className="clinical-prose">{a.text}</p>
        </article>
      ))}
    </div>
  );
}
