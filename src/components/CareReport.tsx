import { useState } from 'react';
import { Printer } from 'lucide-react';
import { careReport } from '../domain/care-report';
import type { Diary } from '../domain/citizen-care';
import { localDay } from '../domain/citizen-care';
import { addDays, shortDate, validDay } from '../domain/dates';
import type { CitizenView } from '../domain/citizen';
import { Button, Field } from './ui';
export function CareReport({ diary, view }: { diary: Diary; view: CitizenView }) {
  const today = localDay(new Date()),
    [from, setFrom] = useState(addDays(today, -29)),
    [to, setTo] = useState(today);
  const report =
    validDay(from) && validDay(to) && from <= to ? careReport(diary, view, from, to) : null;
  const plans = diary.plans.filter(
    (p) =>
      p.start <= to &&
      (!p.end || p.end >= from) &&
      (!p.closedAt || localDay(new Date(p.closedAt)) >= from),
  );
  return (
    <>
      <div className="care-form care-period">
        <Field label="De">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Até">
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>
      {!report ? (
        <p role="alert">Confira o início e o fim do período.</p>
      ) : (
        <article className="cit-sheet care-report">
          <span className="cit-kicker">Demonstração · dados fictícios</span>
          <h2>Relatório de acompanhamento</h2>
          <p>
            <strong>{view.person}</strong> · {shortDate(from)} a {shortDate(to)}
          </p>
          {diary.conditions.length > 0 && (
            <p>Condições informadas pela pessoa: {diary.conditions.join(', ')}.</p>
          )}
          <div className="care-stats">
            <div>
              <strong>{report.entries}</strong>relatos · {report.crises} de crise
            </div>
            <div>
              <strong>{report.taken}</strong>tomadas informadas
            </div>
            <div>
              <strong>{report.skipped}</strong>registros de não tomada
            </div>
            <div>
              <strong>
                {report.pickups} / {report.renewals}
              </strong>
              retiradas / renovações informadas
            </div>
          </div>
          <p>
            Os totais consideram os registros feitos. Um horário sem resposta permanece sem
            informação.
          </p>
          {plans.length > 0 && (
            <section>
              <h3>Medicamentos acompanhados no período</h3>
              <ul>
                {plans.map((p) => (
                  <li key={p.id}>
                    <strong>{p.medicine}</strong> ·{' '}
                    {p.times.join(', ') || 'Somente datas da farmácia'} · horários e datas
                    informados pela pessoa{p.condition ? ' · ' + p.condition : ''}
                  </li>
                ))}
              </ul>
            </section>
          )}
          <h3>Linha do tempo</h3>
          {report.rows.length ? (
            <ol className="care-timeline">
              {report.rows.map((r) => (
                <li key={r.source + r.key}>
                  <small>
                    {shortDate(r.day)} {r.time} · {r.source}
                  </small>
                  <strong>{r.title}</strong>
                  <p>{r.detail}</p>
                </li>
              ))}
            </ol>
          ) : (
            <p>Nenhum registro neste período.</p>
          )}
          <p className="cit-print-warning">
            Resumo demonstrativo · informações pessoais relatadas e registros da unidade · sem
            assinatura clínica.
          </p>
          <Button className="cit-print" onClick={() => window.print()}>
            <Printer size={16} /> Imprimir ou salvar relatório em PDF
          </Button>
        </article>
      )}
    </>
  );
}
