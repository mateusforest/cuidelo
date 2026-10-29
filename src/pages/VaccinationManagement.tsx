import { useApp } from '../app/context';
import { Badge, EmptyState, Notice, PageHeader, Panel } from '../components/ui';

export function VaccinationManagement() {
  const { data, summary } = useApp();
  const v = summary.vaccination;
  return (
    <>
      <PageHeader
        eyebrow="GESTÃO MUNICIPAL · IMUNIZAÇÃO"
        title="Vacinação da rede"
        description="Acompanhe a produção registrada e os retornos pendentes, por unidade."
      />
      <div className="vaccine-management-period">
        <Badge tone="green">
          Competência {v.month.slice(5)}/{v.month.slice(0, 4)}
        </Badge>
        <span>Aplicações válidas no período · retornos pendentes de todas as datas</span>
      </div>
      <div className="vaccine-metrics">
        <div>
          <span>Aplicações na rede</span>
          <strong>{v.applied}</strong>
        </div>
        <div>
          <span>Retornos pendentes</span>
          <strong>{v.pending}</strong>
        </div>
        <div>
          <span>Retornos em atraso</span>
          <strong>{v.overdue}</strong>
        </div>
        <div>
          <span>Registros do mês anulados</span>
          <strong>{v.voided}</strong>
        </div>
      </div>
      <Panel
        title="Acompanhamento por unidade"
        subtitle="Visão agregada, sem nomes ou dados individuais da caderneta."
      >
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Unidade</th>
                <th>Aplicações no mês</th>
                <th>Retornos pendentes</th>
                <th>Em atraso</th>
              </tr>
            </thead>
            <tbody>
              {v.byUnit.map((r) => (
                <tr key={r.unitId}>
                  <td>
                    <strong>{data.units.find((u) => u.id === r.unitId)?.name}</strong>
                  </td>
                  <td>{r.applied}</td>
                  <td>{r.pending}</td>
                  <td>{r.overdue ? <Badge tone="amber">{r.overdue} em atraso</Badge> : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Panel>
      <Panel
        title="Aplicações por imunobiológico"
        subtitle="Somente aplicações locais válidas; transcrições não entram na produção."
      >
        {v.byImmunobiological.length ? (
          <div className="vaccine-production-bars">
            {v.byImmunobiological.map((r) => (
              <div key={r.name}>
                <span>{r.name}</span>
                <div>
                  <i style={{ width: `${(r.applied / Math.max(v.applied, 1)) * 100}%` }} />
                </div>
                <strong>{r.applied}</strong>
              </div>
            ))}
          </div>
        ) : (
          <EmptyState
            title="Nenhuma aplicação no período"
            description="As aplicações registradas pelas unidades aparecerão aqui após serem salvas."
          />
        )}
      </Panel>
      <Notice>
        Este painel mostra produção de demonstração, não cobertura vacinal oficial. Ainda faltam
        denominadores populacionais, metas validadas, integração com o SUS e conciliação dos dados.
        Transcrições com data de aplicação neste mês: {v.transcribed}.
      </Notice>
    </>
  );
}
