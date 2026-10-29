import type { Immunization, VaccineVoid } from '../domain/model';
import { Badge, Button, EmptyState } from './ui';
import { shortDate, clockTime } from '../domain/dates';

export function VaccineHistory({
  records,
  voids,
  unitNames,
  onVoid,
}: {
  records: Immunization[];
  voids: VaccineVoid[];
  unitNames: Record<string, string>;
  onVoid?: (record: Immunization) => void;
}) {
  if (!records.length)
    return (
      <EmptyState
        title="Nenhuma vacinação registrada"
        description="Registre uma aplicação ou transcreva um comprovante fictício para começar o histórico."
      />
    );
  return (
    <div className="vaccine-history">
      {[...records]
        .sort((a, b) => b.date.localeCompare(a.date) || b.recordedAt.localeCompare(a.recordedAt))
        .map((i) => {
          const annulment = voids.find((v) => v.applicationId === i.id);
          return (
            <article key={i.id} className={`vaccine-record ${annulment ? 'voided' : ''}`}>
              <div className="vaccine-record-heading">
                <div>
                  <span className="eyebrow">
                    {shortDate(i.date)} · {i.dose}
                  </span>
                  <h3>{i.immunobiological}</h3>
                  <p>
                    {i.source === 'administered'
                      ? 'Aplicação na unidade'
                      : 'Transcrição de comprovante'}{' '}
                    · {unitNames[i.unitId]}
                  </p>
                </div>
                <Badge tone={annulment ? 'red' : i.source === 'administered' ? 'green' : 'blue'}>
                  {annulment
                    ? 'Anulado'
                    : i.source === 'administered'
                      ? 'Aplicação registrada'
                      : 'Histórico transcrito'}
                </Badge>
              </div>
              <dl className="vaccine-record-data">
                <div>
                  <dt>Lote</dt>
                  <dd>{i.batch || 'Não informado'}</dd>
                </div>
                <div>
                  <dt>Fabricante</dt>
                  <dd>{i.manufacturer || 'Não informado'}</dd>
                </div>
                <div>
                  <dt>Profissional informado</dt>
                  <dd>{i.professional || 'Não informado no comprovante'}</dd>
                </div>
                <div>
                  <dt>Via / local</dt>
                  <dd>{[i.route, i.site].filter(Boolean).join(' · ') || 'Não informado'}</dd>
                </div>
              </dl>
              {i.source === 'administered' && (
                <p className="muted">
                  Estratégia: {i.strategy} · Grupo: {i.group}
                </p>
              )}
              {i.source === 'transcribed' && <p className="muted">Origem: {i.institution}</p>}
              {i.observations && <p className="clinical-prose">{i.observations}</p>}
              {annulment && (
                <div className="vaccine-void">
                  <strong>
                    Anulação em {shortDate(annulment.recordedAt)} · {annulment.author}
                  </strong>
                  <p>{annulment.reason}</p>
                  {i.source === 'administered' && (
                    <small>A anulação documental não devolve doses ao estoque.</small>
                  )}
                </div>
              )}
              <div className="vaccine-record-footer">
                <small>
                  Registrado em {shortDate(i.recordedAt)} às {clockTime(i.recordedAt)} · {i.author}
                </small>
                {!annulment && onVoid && (
                  <Button variant="ghost" onClick={() => onVoid(i)}>
                    Anular registro
                  </Button>
                )}
              </div>
            </article>
          );
        })}
    </div>
  );
}
