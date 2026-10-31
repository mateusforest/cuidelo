import { deliveryOrder } from '../data/delivery-order';
import { normalizedName } from '../domain/identification';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUpRight, SearchCheck, FileCheck2 } from 'lucide-react';
import inventory from '../data/pulso-inventory.json';
import { Badge, Notice, PageHeader, Panel, SearchField } from '../components/ui';

const labels: Record<string, string> = {
  demonstravel: 'Demonstrável',
  parcial: 'Parcial',
  adaptado: 'Adaptado',
  pendente: 'A desenvolver',
};
const tone = (status: string) =>
  status === 'demonstravel'
    ? ('green' as const)
    : status === 'parcial'
      ? ('amber' as const)
      : status === 'adaptado'
        ? ('blue' as const)
        : ('neutral' as const);
export function Coverage() {
  const [search, setSearch] = useState(''),
    [group, setGroup] = useState('Todas as áreas'),
    [status, setStatus] = useState('todos');
  const groups = ['Todas as áreas', ...new Set(inventory.rows.map((r) => r.group))];
  const rows = inventory.rows.filter(
    (r) =>
      (group === 'Todas as áreas' || r.group === group) &&
      (status === 'todos' || r.status === status) &&
      normalizedName(`${r.titulo} ${r.descricao} ${r.note}`).includes(normalizedName(search)),
  );
  if (status === 'parcial')
    rows.sort(
      (a, b) =>
        (deliveryOrder.get(a.id)?.position ?? 100) - (deliveryOrder.get(b.id)?.position ?? 100),
    );
  return (
    <>
      <PageHeader
        eyebrow="COMPARAÇÃO COM O PROTÓTIPO ORIGINAL"
        title="O que veio do Pulso"
        description="46 telas conferidas. Veja a cobertura atual e o que ainda precisa ser desenvolvido."
      />
      <Notice tone="amber">
        <SearchCheck size={20} />
        <div>
          <strong>A base atual ainda não reproduz todo o Pulso.</strong>
          <p>
            O mapa abaixo mantém cada tela do original como referência. “Parcial” indica que o
            percurso ainda está incompleto; “demonstrável” descreve esta versão local, sem
            homologação para atendimento.
          </p>
        </div>
      </Notice>
      <Panel
        title="Primeira entrega · da escuta ao consultório"
        subtitle="Prioridade 01 e 02 de 44 · Escuta inicial e Fila e salas"
      >
        <div className="panel-body">
          <p>
            <strong>01 · Escuta inicial — demonstrável no fluxo manual.</strong> Registre a
            classificação e o prazo de reavaliação. Encaminhe para consultório, enfermagem,
            vacinação ou farmácia. O destino pode receber, devolver ou concluir a passagem. A escuta
            também pode terminar com orientação confirmada.
          </p>
          <p>
            <strong>02 · Fila e salas — em desenvolvimento.</strong> A chamada na TV reserva um dos
            dois consultórios. A entrada confirma a ocupação. A devolução justificada, a conclusão e
            a observação liberam a sala. O controle físico dos outros setores e a sincronização
            entre dispositivos continuam pendentes.
          </p>
          <p>
            Restam 43 percursos parciais. A ordem começa pelo atendimento da unidade, com
            consultório, farmácia e agenda logo após a fila. Protocolos e regras clínicas dependem
            de validação institucional.
          </p>
          <button
            className="button secondary"
            onClick={() => {
              setStatus('parcial');
              setGroup('Todas as áreas');
              setSearch('');
              document.getElementById('coverage-list')?.scrollIntoView({ block: 'start' });
            }}
          >
            Ver percursos parciais em ordem de entrega
          </button>
          <Link className="row-link" to="/acesso">
            Conhecer os acessos
          </Link>
        </div>
      </Panel>
      <div className="coverage-stats">
        {Object.entries(labels).map(([key, label]) => (
          <button
            className={status === key ? 'selected' : ''}
            onClick={() => setStatus(status === key ? 'todos' : key)}
            key={key}
          >
            <strong>{inventory.rows.filter((r) => r.status === key).length}</strong>
            <span>{label}</span>
          </button>
        ))}
      </div>
      <Panel
        title="Conferência tela por tela"
        subtitle="A contagem compara telas do protótipo; não mede percentual de conclusão do produto."
      >
        <div id="coverage-list" className="table-toolbar">
          <SearchField
            placeholder="Buscar tela ou capacidade"
            value={search}
            onChange={setSearch}
          />
          <label className="coverage-filter">
            <span className="sr-only">Área do Pulso</span>
            <select value={group} onChange={(e) => setGroup(e.target.value)}>
              {groups.map((g) => (
                <option key={g}>{g}</option>
              ))}
            </select>
          </label>
          <span className="result-count">
            {rows.length} de {inventory.rows.length} telas
          </span>
        </div>
        <div className="table-scroll">
          <table className="coverage-table">
            <thead>
              <tr>
                <th>Tela no Pulso</th>
                <th>Cobertura atual</th>
                <th>O que existe e o que falta</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  <td>
                    <strong>{row.titulo}</strong>
                    {deliveryOrder.has(row.id) && (
                      <small className="cell-secondary">
                        Ordem {String(deliveryOrder.get(row.id)!.position).padStart(2, '0')} ·{' '}
                        {deliveryOrder.get(row.id)!.group}
                      </small>
                    )}
                    <small className="cell-secondary">{row.group}</small>
                    <small className="cell-secondary">{row.descricao}</small>
                  </td>
                  <td>
                    <Badge tone={tone(row.status)}>{labels[row.status]}</Badge>
                    {row.route && (
                      <Link to={row.route} className="row-link">
                        Ver base atual
                        <ArrowUpRight size={14} />
                      </Link>
                    )}
                  </td>
                  <td>{row.note}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <p className="coverage-empty">
            Nenhuma tela neste filtro. Ajuste a busca para continuar.
          </p>
        )}
      </Panel>
      <div className="coverage-extra">
        <FileCheck2 size={24} />
        <div>
          <h2>O projeto também precisa ir além do Pulso.</h2>
          <p>
            Internação, UTI, centro cirúrgico, maternidade e os demais fluxos hospitalares não têm
            telas próprias no catálogo original. A base de leitos já foi iniciada no Cuidelo. O
            escopo hospitalar completo continua no plano da primeira implantação.
          </p>
          <Link to="/desenvolvimento" className="row-link">
            Ver plano completo
            <ArrowUpRight size={15} />
          </Link>
        </div>
      </div>
      <p className="coverage-source">
        Referência: Pulso.html, 1.619.050 bytes. As cópias de Downloads e WhatsApp são idênticas.
        Conferência estática do código em 29/10/2026; os fluxos do Cuidelo foram verificados no
        navegador. O original foi preservado.
      </p>
    </>
  );
}
