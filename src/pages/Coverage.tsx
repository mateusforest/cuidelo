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
      `${r.titulo} ${r.descricao} ${r.note}`
        .toLocaleLowerCase('pt-BR')
        .includes(search.toLocaleLowerCase('pt-BR')),
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
        title="Avanços da versão 0.6"
        subtitle="O percurso de chegada agora conecta mais etapas dos módulos parciais."
      >
        <div className="panel-body">
          <p>
            Recepção com conferência de CPF ou nome, preferência confirmada, triagem, chamadas na TV
            e controle de ausência e retorno. Fila, escuta e consultório respeitam o encaminhamento;
            gestão e relatórios recebem os tempos e as contagens por etapa.
          </p>
          <p>
            Os 44 módulos continuam parciais porque suas pendências completas ainda incluem
            integração, protocolos, autenticação e outras funções. A descrição de cada módulo abaixo
            mostra o avanço e o que falta.
          </p>
          <Link className="row-link" to="/recepcao">
            Testar o percurso da recepção
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
        <div className="table-toolbar">
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
