import type { SharedCareReport } from '../domain/shared-care-report';
import { shortDate } from '../domain/dates';
export function CareReportContent({ snapshot }: { snapshot: SharedCareReport }) {
  return (
    <>
      {' '}
      <span className="cit-kicker">Demonstração · dados fictícios</span>
      <h2>Relatório de acompanhamento</h2>
      <p>
        <strong>{snapshot.person}</strong> · {shortDate(snapshot.from)} a {shortDate(snapshot.to)}
      </p>
      {snapshot.conditions.length > 0 && (
        <p>Condições informadas pela pessoa: {snapshot.conditions.join(', ')}.</p>
      )}
      <div className="care-stats">
        <div>
          <strong>{snapshot.counts.entries}</strong>relatos · {snapshot.counts.crises} de crise
        </div>
        <div>
          <strong>{snapshot.counts.taken}</strong>tomadas informadas
        </div>
        <div>
          <strong>{snapshot.counts.skipped}</strong>registros de não tomada
        </div>
        <div>
          <strong>
            {snapshot.counts.pickups} / {snapshot.counts.renewals}
          </strong>
          retiradas / renovações informadas
        </div>
        <div>
          <strong>{snapshot.counts.postponed}</strong>avisos adiados
        </div>
      </div>
      <p>
        Os totais consideram os registros feitos. Um horário sem resposta permanece sem informação.
      </p>
      {snapshot.medicines.length > 0 && (
        <section>
          <h3>Medicamentos acompanhados no período</h3>
          <ul>
            {snapshot.medicines.map((p, i) => (
              <li key={i}>
                <strong>{p.name}</strong> · {p.times || 'Somente datas da farmácia'} · horários e
                datas informados pela pessoa{p.condition ? ' · ' + p.condition : ''}
              </li>
            ))}
          </ul>
        </section>
      )}
      <h3>Linha do tempo</h3>
      {snapshot.rows.length ? (
        <ol className="care-timeline">
          {snapshot.rows.map((r, i) => (
            <li key={i}>
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
    </>
  );
}
