import { Link } from 'react-router-dom';
import type { MouseEvent } from 'react';
import {
  ArrowRight,
  Download,
  Building2,
  HeartPulse,
  Pill,
  Smartphone,
  Stethoscope,
  BedDouble,
} from 'lucide-react';
import { isPortable } from '../app/links';
import '../styles/presentation.css';

const tour = [
  {
    title: 'A visão da prefeitura',
    icon: Building2,
    session: 'aurora:manager',
    detail:
      'Indicadores da rede, unidades e tempos de atendimento. A gestão acompanha dados agregados.',
    result: 'Enxergar onde a rede precisa de atenção.',
  },
  {
    title: 'Chegada e acolhimento',
    icon: HeartPulse,
    session: 'aurora-centro:reception',
    detail:
      'Identificação, preferência, encaminhamento à escuta e chamada na TV. A avaliação clínica é feita pela equipe.',
    result: 'Organizar o percurso de cada pessoa.',
  },
  {
    title: 'O cuidado no consultório',
    icon: Stethoscope,
    session: 'aurora-centro:clinical',
    detail:
      'Chamada, prontuário, receitas, exames e encaminhamentos. Revisão do Dia a dia e orientações ao cidadão.',
    result: 'Dar continuidade ao cuidado e ao registro.',
  },
  {
    title: 'Farmácia e abastecimento',
    icon: Pill,
    session: 'aurora-centro:pharmacy',
    detail:
      'Entregas totais ou parciais, estoque por lote, devoluções e estornos ligados à entrega original.',
    result: 'Rastrear o medicamento da central à entrega.',
  },
  {
    title: 'O cidadão depois da consulta',
    icon: Smartphone,
    route: '/cidadao',
    detail:
      'Agenda, documentos, diário, medicação, avisos de retirada e renovação e confirmação de leitura de orientações.',
    result: 'Manter a pessoa próxima da equipe.',
  },
  {
    title: 'UPA, hospital e rede completa',
    icon: BedDouble,
    session: 'aurora-hospital:admin',
    detail:
      'Demonstração de admissões, ocupação, transferências de leito e higienização. Setores especializados seguem em desenvolvimento.',
    result: 'Construir uma plataforma para toda a rede pública.',
  },
];

export function Presentation() {
  function focusTour(event: MouseEvent<HTMLAnchorElement>) {
    event.preventDefault();
    const tourSection = document.getElementById('roteiro');
    tourSection?.focus({ preventScroll: true });
    tourSection?.scrollIntoView({ block: 'start' });
  }
  const pdf =
    (isPortable() ? 'https://cuidelo.vercel.app' : '') +
    '/downloads/Cuidelo-Apresentacao-Vacaria.pdf';
  return (
    <main className="presentation">
      <a className="skip-link" href="#roteiro" onClick={focusTour}>
        Ir para o roteiro
      </a>
      <header className="presentation-nav">
        <img src="/brand/marca.svg" alt="Cuidelo" />
        <span>Demonstração · dados fictícios</span>
        <Link to="/acesso">
          Explorar os perfis <ArrowRight size={16} />
        </Link>
      </header>
      <section className="presentation-hero">
        <div>
          <p className="eyebrow">SAÚDE PÚBLICA · APRESENTAÇÃO EXECUTIVA</p>
          <h1>
            Toda a rede.
            <br />
            Mais perto das pessoas.
          </h1>
          <p className="presentation-lead">
            Do acolhimento na unidade ao acompanhamento em casa. Conheça a proposta do Cuidelo para
            conectar pessoas, equipes e gestão municipal.
          </p>
          <div className="presentation-actions">
            <a href="#roteiro" className="button primary" onClick={focusTour}>
              Começar a demonstração <ArrowRight size={18} />
            </a>
            <a href={pdf} className="button secondary" download>
              <Download size={18} /> Apresentação em PDF
            </a>
          </div>
        </div>
        <aside className="presentation-value">
          <span>UMA JORNADA DE CUIDADO</span>
          <h2>
            Acolher.
            <br />
            Cuidar.
            <br />
            Acompanhar.
          </h2>
          <p>UBS e postos · UPA e pronto atendimento · hospitais · farmácia · cidadão</p>
          <small>
            Escopo da plataforma. A operação completa depende da conclusão e validação dos módulos.
          </small>
        </aside>
      </section>
      <section
        id="roteiro"
        className="presentation-tour"
        aria-labelledby="tour-title"
        tabIndex={-1}
      >
        <div className="presentation-section-title">
          <div>
            <p className="eyebrow">ROTEIRO SUGERIDO · 10 MINUTOS</p>
            <h2 id="tour-title">Veja o Cuidelo em ação.</h2>
          </div>
          <p>
            Abra cada etapa nesta mesma aba. Nos módulos da equipe, confirme o perfil sugerido e
            clique em “Entrar na demonstração”. Trocar o perfil encerra a sessão anterior.
          </p>
        </div>
        <div className="presentation-grid">
          {tour.map(({ title, icon: Icon, session, route, detail, result }, i) => (
            <article key={title} className="presentation-card">
              <div className="presentation-card-top">
                <Icon size={24} />
                <span>0{i + 1}</span>
              </div>
              <h3>{title}</h3>
              <p>{detail}</p>
              <strong>{result}</strong>
              <Link
                className="text-link"
                to={route ?? '/acesso?sessao=' + encodeURIComponent(session!)}
              >
                Abrir etapa <ArrowRight size={16} />
              </Link>
            </article>
          ))}
        </div>
        <div className="presentation-devices">
          <span>Também na unidade</span>
          <Link to="/totem?rede=aurora&unidade=aurora-centro">
            Totem por etapas <ArrowRight size={15} />
          </Link>
          <Link to="/painel?rede=aurora&unidade=aurora-centro&previa=1">
            Prévia do painel da TV <ArrowRight size={15} />
          </Link>
          <Link to="/acesso?sessao=aurora-central%3Apharmacy">
            Central de medicamentos <ArrowRight size={15} />
          </Link>
        </div>
      </section>
      <section className="presentation-status" aria-labelledby="status-title">
        <div>
          <p className="eyebrow">ESTÁGIO ATUAL</p>
          <h2 id="status-title">O que esta versão permite demonstrar.</h2>
        </div>
        <div>
          <h3>Fluxos e canais de demonstração</h3>
          <p>
            Os registros assistenciais ficam no navegador. TV pareada, remessas por código,
            compartilhamento com o cidadão e notificações usam serviços online específicos. Isso
            ainda não é um prontuário sincronizado entre computadores.
          </p>
        </div>
        <div>
          <h3>Antes do atendimento real</h3>
          <p>
            Faltam o ambiente protegido, login individual, autorização no servidor, integrações
            oficiais e validação de todo o escopo assistencial. O planejamento considera várias
            prefeituras e até 100 unidades; essa capacidade ainda precisa de testes.
          </p>
        </div>
      </section>
      <footer className="presentation-footer">
        <span>Cuidelo · Toda a rede. Mais perto das pessoas.</span>
        <Link to="/acesso">
          Voltar aos acessos <ArrowRight size={15} />
        </Link>
      </footer>
    </main>
  );
}
