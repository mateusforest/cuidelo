import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import {
  ArrowUpRight,
  Users,
  Clock3,
  BedDouble,
  PackageCheck,
  Building2,
  HeartPulse,
  Stethoscope,
  Download,
  ArrowRight,
  CalendarDays,
  ClipboardList,
  Monitor,
} from 'lucide-react';
import { useApp } from '../app/context';
import { can, unitKindNames, type UnitKind } from '../domain/model';
import { dateKey, shortDate } from '../domain/dates';
import { Badge, Button, PageHeader, Panel, TextLink } from '../components/ui';
import { displayRoute } from '../app/links';

const kindIcons = { ubs: Stethoscope, upa: HeartPulse, hospital: Building2 };
export function Dashboard() {
  const { summary, context, changeContext, data } = useApp();
  const navigate = useNavigate();
  const [kind, setKind] = useState<UnitKind | 'all'>('all');
  const units = summary.units.filter((u) => kind === 'all' || u.unit.kind === kind);
  const currentUnit = data.units.find((u) => u.id === context.unitId);
  const exportSummary = () => {
    const cell = (v: unknown) =>
      `"${String(v)
        .replace(/^[=+@-]/, "'$&")
        .replaceAll('"', '""')}"`;
    const rows = [
      [
        'Unidade',
        'Data',
        'Atendimentos do dia',
        'Em espera',
        'Em cuidado',
        'Leitos ocupados',
        'Total de leitos',
      ],
      ...summary.units.map((s) => [
        s.unit.name,
        dateKey(),
        s.today,
        s.waiting,
        s.inCare,
        s.occupied,
        s.totalBeds,
      ]),
    ];
    const url = URL.createObjectURL(
      new Blob(['\uFEFF' + rows.map((r) => r.map(cell).join(';')).join('\r\n')], {
        type: 'text/csv;charset=utf-8',
      }),
    );
    const link = document.createElement('a');
    link.href = url;
    link.download = `cuidelo-resumo-${dateKey()}.csv`;
    link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };
  const stats = [
    {
      label: 'Atendimentos hoje',
      value: summary.today,
      description: 'Registros na recepção',
      icon: Users,
    },
    {
      label: 'Pessoas em espera',
      value: summary.waiting,
      description: 'Aguardando atendimento',
      icon: Clock3,
    },
    {
      label: 'Leitos ocupados',
      value: `${summary.occupied}/${summary.totalBeds}`,
      description: summary.totalBeds ? 'Ocupação neste contexto' : 'Sem leitos neste contexto',
      icon: BedDouble,
    },
    {
      label: 'Lotes que precisam de atenção',
      value: summary.stockAlerts,
      description: 'Saldo baixo ou validade próxima',
      icon: PackageCheck,
    },
  ];
  const openUnit = (unitId: string, type: UnitKind) => {
    changeContext({ unitId });
    navigate(
      type === 'hospital' && can(context.role, 'beds')
        ? '/hospital'
        : can(context.role, 'queue')
          ? '/recepcao'
          : '/',
    );
  };
  return (
    <>
      <PageHeader
        eyebrow={shortDate(dateKey())}
        title={
          context.unitId === 'all' ? 'Visão da rede' : (currentUnit?.name ?? 'Visão da unidade')
        }
        description="Uma visão do cuidado, da capacidade e das próximas ações."
        action={
          can(context.role, 'manage') ? (
            <Button variant="secondary" onClick={exportSummary}>
              <Download size={17} />
              Exportar resumo
            </Button>
          ) : undefined
        }
      />
      <div className="review-banner">
        <Monitor size={27} />
        <div>
          <strong>A sala de espera também faz parte do cuidado.</strong>
          <p>Conheça o painel de senhas e confira a cobertura do protótipo original.</p>
        </div>
        <Link
          className="button primary"
          to={displayRoute(context.organizationId, (currentUnit ?? data.units[0]).id, true)}
        >
          Ver tela da TV
          <ArrowUpRight size={16} />
        </Link>
        <Link className="button secondary" to="/comparacao">
          Comparar com Pulso
        </Link>
      </div>
      <div className="overview-banner">
        <div className="banner-icon">
          <img src="/brand/simbolo.svg" alt="" />
        </div>
        <div>
          <span className="eyebrow">CUIDAR É CONECTAR</span>
          <h2>Toda a rede, mais perto das pessoas.</h2>
          <p>Acompanhe suas unidades e dê continuidade a cada atendimento.</p>
        </div>
        <span className="banner-network">
          {data.units.length}
          <small>unidades nesta rede</small>
        </span>
      </div>
      <div className="metric-grid">
        {stats.map(({ label, value, description, icon: Icon }) => (
          <div className="metric-card" key={label}>
            <div className="metric-top">
              <span>{label}</span>
              <Icon size={19} />
            </div>
            <strong>{value}</strong>
            <p>{description}</p>
          </div>
        ))}
      </div>
      <div className="dashboard-grid">
        <Panel
          title="Unidades em foco"
          subtitle="Selecione uma unidade para abrir seu ambiente de trabalho."
          action={
            can(context.role, 'manage') ? <TextLink to="/unidades">Ver rede</TextLink> : undefined
          }
        >
          <div className="segmented" aria-label="Filtrar unidades">
            {[
              ['all', 'Todas'],
              ['ubs', 'UBS'],
              ['upa', 'UPA'],
              ['hospital', 'Hospital'],
            ].map(([key, label]) => (
              <button
                key={key}
                aria-pressed={kind === key}
                onClick={() => setKind(key as UnitKind | 'all')}
              >
                {label}
              </button>
            ))}
          </div>
          <div className="unit-list">
            {units.map(({ unit, today, waiting, occupied, totalBeds }) => {
              const Icon = kindIcons[unit.kind];
              return (
                <button
                  className="unit-row"
                  key={unit.id}
                  onClick={() => openUnit(unit.id, unit.kind)}
                >
                  <span className={`unit-icon ${unit.kind}`}>
                    <Icon size={22} />
                  </span>
                  <span className="unit-row-name">
                    <strong>{unit.name}</strong>
                    <small>
                      {unitKindNames[unit.kind]} · {unit.district}
                    </small>
                  </span>
                  <span className="unit-count">
                    <strong>{unit.kind === 'hospital' ? `${occupied}/${totalBeds}` : today}</strong>
                    <small>
                      {unit.kind === 'hospital' ? 'leitos ocupados' : 'atendimentos hoje'}
                    </small>
                  </span>
                  <span className="unit-state">
                    <Badge tone={waiting ? 'amber' : 'green'}>
                      {unit.kind === 'hospital' ? 'Internação' : `${waiting} em espera`}
                    </Badge>
                  </span>
                  <ArrowUpRight size={18} className="row-arrow" />
                </button>
              );
            })}
            {units.length === 0 && (
              <p className="inline-empty">Nenhuma unidade deste tipo no contexto selecionado.</p>
            )}
          </div>
        </Panel>
        <div className="dashboard-aside">
          <Panel title="O cuidado hoje" subtitle="Movimento do contexto selecionado.">
            <div className="care-flow">
              {[
                { name: 'Aguardando', value: summary.waiting, color: 'amber' },
                { name: 'Em atendimento ou observação', value: summary.inCare, color: 'blue' },
                { name: 'Concluídos hoje', value: summary.completed, color: 'green' },
              ].map((s, i) => (
                <div className="care-flow-row" key={s.name}>
                  <span className={`flow-dot ${s.color}`}>{i + 1}</span>
                  <span>{s.name}</span>
                  <strong>{s.value}</strong>
                </div>
              ))}
            </div>
            <div className="care-flow-footer">
              <span>Encaminhamentos solicitados</span>
              <strong>{summary.pendingReferrals}</strong>
            </div>
          </Panel>
          <div className="quiet-callout">
            <span className="small-icon">
              <ShieldIcon />
            </span>
            <h3>Um contexto de cada vez</h3>
            <p>A rede, a unidade e o perfil ativos permanecem visíveis durante todo o trabalho.</p>
            <TextLink to="/integracoes">Ver conexões previstas</TextLink>
          </div>
        </div>
      </div>
      <Panel title="Continue por aqui" subtitle="Acesso aos fluxos disponíveis para este perfil.">
        <div className="quick-actions">
          {[
            {
              name: 'Recepção e atendimento',
              desc: 'Acompanhar chegadas e iniciar o cuidado.',
              to: '/recepcao',
              icon: ClipboardList,
              p: 'queue',
            },
            {
              name: 'Agenda da unidade',
              desc: 'Organizar horários e confirmar chegadas.',
              to: '/agenda',
              icon: CalendarDays,
              p: 'schedule',
            },
            {
              name: 'Internação e leitos',
              desc: 'Acompanhar admissões e disponibilidade.',
              to: '/hospital',
              icon: BedDouble,
              p: 'beds',
            },
          ]
            .filter((x) => can(context.role, x.p as 'queue'))
            .map(({ name, desc, to, icon: Icon }) => (
              <button key={to} onClick={() => navigate(to)}>
                <Icon size={21} />
                <span>
                  <strong>{name}</strong>
                  <small>{desc}</small>
                </span>
                <ArrowRight size={17} />
              </button>
            ))}
          <button onClick={() => navigate('/desenvolvimento')}>
            <Building2 size={21} />
            <span>
              <strong>Plano de entrega</strong>
              <small>Escopo completo e próximas dependências.</small>
            </span>
            <ArrowRight size={17} />
          </button>
        </div>
      </Panel>
    </>
  );
}
function ShieldIcon() {
  return <Building2 size={20} />;
}
