import { SectorHandoffs } from '../components/SectorHandoffs';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { CalendarPlus, ClipboardList, Package, Plus, PhoneCall } from 'lucide-react';
import { useApp } from '../app/context';
import type { Immunization, VaccineRecall } from '../domain/model';
import { contactLabels } from '../domain/continuity';
import { normalizedName, formatCpf } from '../domain/identification';
import { dateKey, shortDate, ageAt, clockTime } from '../domain/dates';
import {
  Avatar,
  Badge,
  Button,
  EmptyState,
  Field,
  Notice,
  PageHeader,
  Panel,
  SearchField,
  UnitRequired,
  valueOf,
} from '../components/ui';
import { VaccineHistory } from '../components/VaccineHistory';
import { VaccineForm, VaccinationRecordForm, VaccineRecallForm } from '../components/VaccineForms';
import '../styles/vaccination.css';

type Form =
  | {
      kind: 'record';
      patientId: string;
      source: 'administered' | 'transcribed';
      recall?: VaccineRecall;
    }
  | {
      kind: 'recall';
      patientId: string;
      existing?: VaccineRecall;
      action?: 'reschedule' | 'cancel';
    }
  | { kind: 'contact'; recall: VaccineRecall }
  | { kind: 'void'; record: Immunization };
export function Vaccination() {
  const { data, context, repository, notify } = useApp();
  const [params] = useSearchParams();
  const [patientId, setPatientId] = useState(params.get('pessoa') ?? data.patients[0]?.id ?? ''),
    [search, setSearch] = useState(''),
    [tab, setTab] = useState('card'),
    [returnFilter, setReturnFilter] = useState('pending'),
    [returnSearch, setReturnSearch] = useState(''),
    [form, setForm] = useState<Form | null>(null);
  const p = data.patients.find((p) => p.id === patientId),
    today = dateKey();
  const people = data.patients.filter((p) =>
    normalizedName(
      `${p.name} ${p.socialName} ${p.record} ${p.cpf ?? ''} ${formatCpf(p.cpf ?? '')}`,
    ).includes(normalizedName(search)),
  );
  const records = data.immunizations.filter((i) => i.patientId === patientId),
    voidIds = new Set(data.vaccineVoids.map((v) => v.applicationId));
  const returns = data.vaccineRecalls.filter((r) => r.unitId === context.unitId);
  const filteredReturns = returns
    .filter(
      (r) =>
        returnFilter === 'all' ||
        (r.status === 'scheduled' &&
          (returnFilter !== 'overdue' || r.date < today) &&
          (returnFilter !== 'today' || r.date === today)),
    )
    .filter((r) => {
      const person = data.patients.find((p) => p.id === r.patientId);
      return normalizedName(
        `${person?.name} ${person?.socialName} ${r.immunobiological} ${r.dose}`,
      ).includes(normalizedName(returnSearch));
    })
    .sort((a, b) => a.date.localeCompare(b.date));
  const unitNames = Object.fromEntries(data.units.map((u) => [u.id, u.name]));
  return (
    <div className="operations-page vaccination-workspace">
      <PageHeader
        eyebrow="IMUNIZAÇÃO E ACOMPANHAMENTO"
        title="Sala de vacinação"
        description="Da aplicação ao próximo retorno, com o histórico da pessoa sempre por perto."
        action={
          <Link className="button secondary" to="/vacinas-estoque">
            <Package size={17} />
            Lotes e estoque
          </Link>
        }
      />
      <UnitRequired>
        <SectorHandoffs roomId="vacina-1" />
        <div className="continuity-metrics" aria-label="Resumo da vacinação da unidade">
          <article>
            <span>Aplicações hoje</span>
            <strong>
              {
                data.immunizations.filter(
                  (i) =>
                    i.unitId === context.unitId &&
                    i.source === 'administered' &&
                    i.date === today &&
                    !voidIds.has(i.id),
                ).length
              }
            </strong>
            <small>Registradas nesta unidade</small>
          </article>
          {(
            [
              [
                'pending',
                'Retornos pendentes',
                returns.filter((r) => r.status === 'scheduled').length,
              ],
              [
                'today',
                'Previstos hoje',
                returns.filter((r) => r.status === 'scheduled' && r.date === today).length,
              ],
              [
                'overdue',
                'Em atraso',
                returns.filter((r) => r.status === 'scheduled' && r.date < today).length,
              ],
            ] as const
          ).map(([key, label, count]) => (
            <button
              key={key}
              aria-pressed={tab === 'returns' && returnFilter === key}
              onClick={() => {
                setTab('returns');
                setReturnFilter(key);
                setReturnSearch('');
              }}
            >
              <span>{label}</span>
              <strong>{count}</strong>
              <small>Ver aprazamentos</small>
            </button>
          ))}
        </div>
        <div className="vaccine-tabs" aria-label="Seções de vacinação">
          <button
            aria-pressed={tab === 'card'}
            className={tab === 'card' ? 'active' : ''}
            onClick={() => setTab('card')}
          >
            <ClipboardList size={17} />
            Caderneta da pessoa
          </button>
          <button
            aria-pressed={tab === 'returns'}
            className={tab === 'returns' ? 'active' : ''}
            onClick={() => setTab('returns')}
          >
            <CalendarPlus size={17} />
            Aprazamentos da unidade{' '}
            <span>{returns.filter((r) => r.status === 'scheduled').length}</span>
          </button>
        </div>
        {tab === 'card' ? (
          <div className="vaccination-grid">
            <Panel className="vaccine-person-picker" title="Encontrar pessoa">
              <div className="panel-body">
                <SearchField
                  value={search}
                  onChange={setSearch}
                  placeholder="Nome, CPF ou cadastro"
                />
              </div>
              <div className="vaccine-people">
                {people.map((person) => (
                  <button
                    key={person.id}
                    className={patientId === person.id ? 'selected' : ''}
                    aria-pressed={patientId === person.id}
                    onClick={() => setPatientId(person.id)}
                  >
                    <Avatar small name={person.socialName || person.name} />
                    <span>
                      <strong>{person.socialName || person.name}</strong>
                      <small>{person.record}</small>
                    </span>
                  </button>
                ))}
                {!people.length && <p className="panel-empty">Nenhuma pessoa encontrada.</p>}
              </div>
            </Panel>
            <div>
              {p ? (
                <>
                  <div className="vaccine-patient">
                    <div className="vaccine-patient-heading">
                      <Avatar name={p.socialName || p.name} />
                      <div>
                        <span className="eyebrow">{p.record} · PESSOA FICTÍCIA</span>
                        <h2>{p.socialName || p.name}</h2>
                        <p>
                          {ageAt(p.birthDate)} anos · {shortDate(p.birthDate)}
                        </p>
                      </div>
                      <Badge tone="green">Histórico da rede</Badge>
                    </div>
                    <div className="row-actions">
                      <Button
                        onClick={() =>
                          setForm({ kind: 'record', patientId, source: 'administered' })
                        }
                      >
                        <Plus size={16} />
                        Registrar aplicação
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() =>
                          setForm({ kind: 'record', patientId, source: 'transcribed' })
                        }
                      >
                        Transcrever caderneta
                      </Button>
                      <Button
                        variant="secondary"
                        onClick={() => setForm({ kind: 'recall', patientId })}
                      >
                        <CalendarPlus size={16} />
                        Aprazar retorno
                      </Button>
                    </div>
                  </div>
                  {!data.vaccineLots.some(
                    (l) => l.status === 'available' && l.expiresAt >= today && l.quantity > 0,
                  ) && (
                    <Notice>
                      Cadastre um lote disponível em{' '}
                      <Link to="/vacinas-estoque">Lotes e estoque</Link> para registrar aplicações.
                      A transcrição de comprovantes continua disponível.
                    </Notice>
                  )}
                  <Panel
                    title="Caderneta registrada"
                    subtitle="Aplicações e transcrições da mesma rede. O histórico não comprova esquema vacinal completo."
                  >
                    <VaccineHistory
                      records={records}
                      voids={data.vaccineVoids}
                      unitNames={unitNames}
                      onVoid={(record) => {
                        if (record.unitId !== context.unitId) {
                          notify(
                            'Selecione a unidade de origem para anular este registro.',
                            'error',
                          );
                          return;
                        }
                        setForm({ kind: 'void', record });
                      }}
                    />
                  </Panel>
                  <Link className="text-link" to={`/pessoas/${p.id}`}>
                    Abrir prontuário da pessoa
                  </Link>
                </>
              ) : (
                <EmptyState
                  title="Selecione uma pessoa"
                  description="Escolha um cadastro fictício para consultar a caderneta."
                />
              )}
            </div>
          </div>
        ) : (
          <Panel
            title="Próximos retornos"
            subtitle="Datas informadas pela equipe. Nenhuma mensagem é enviada automaticamente."
          >
            <div className="table-toolbar">
              <SearchField
                value={returnSearch}
                onChange={setReturnSearch}
                placeholder="Buscar pessoa ou vacina nos retornos"
              />
              <Field label="Exibir aprazamentos">
                <select value={returnFilter} onChange={(e) => setReturnFilter(e.target.value)}>
                  <option value="pending">Pendentes</option>
                  <option value="today">Previstos hoje</option>
                  <option value="overdue">Em atraso</option>
                  <option value="all">Todos, incluindo concluídos</option>
                </select>
              </Field>
              <span className="result-count">{filteredReturns.length} registros</span>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Pessoa / retorno</th>
                    <th>Data prevista</th>
                    <th>Situação</th>
                    <th>Ações e histórico</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredReturns.map((r) => {
                    const person = data.patients.find((p) => p.id === r.patientId);
                    return (
                      <tr key={r.id}>
                        <td>
                          <strong>{person?.socialName || person?.name}</strong>
                          <small className="cell-secondary">
                            {r.immunobiological} · {r.dose}
                          </small>
                        </td>
                        <td>{shortDate(r.date)}</td>
                        <td>
                          <Badge
                            tone={
                              r.status === 'completed'
                                ? 'green'
                                : r.status === 'scheduled' && r.date < today
                                  ? 'amber'
                                  : 'neutral'
                            }
                          >
                            {r.status === 'completed'
                              ? 'Atendido'
                              : r.status === 'cancelled'
                                ? 'Cancelado'
                                : r.date < today
                                  ? 'Em atraso'
                                  : 'Pendente'}
                          </Badge>
                        </td>
                        <td>
                          {r.status === 'scheduled' && (
                            <div className="row-actions">
                              <Button
                                variant="secondary"
                                onClick={() => setForm({ kind: 'contact', recall: r })}
                              >
                                <PhoneCall size={15} /> Registrar contato
                              </Button>
                              <Button
                                onClick={() =>
                                  setForm({
                                    kind: 'record',
                                    patientId: r.patientId,
                                    source: 'administered',
                                    recall: r,
                                  })
                                }
                              >
                                Registrar aplicação
                              </Button>
                              <Button
                                variant="secondary"
                                onClick={() =>
                                  setForm({
                                    kind: 'recall',
                                    patientId: r.patientId,
                                    existing: r,
                                    action: 'reschedule',
                                  })
                                }
                              >
                                Reagendar
                              </Button>
                              <Button
                                variant="ghost"
                                onClick={() =>
                                  setForm({
                                    kind: 'recall',
                                    patientId: r.patientId,
                                    existing: r,
                                    action: 'cancel',
                                  })
                                }
                              >
                                Cancelar retorno
                              </Button>
                            </div>
                          )}
                          {!!r.contacts?.length && (
                            <details className="vaccine-contact-history">
                              <summary>Contatos registrados ({r.contacts.length})</summary>
                              {[...r.contacts].reverse().map((c) => (
                                <article key={c.id}>
                                  <strong>{contactLabels[c.outcome]}</strong>
                                  <p>{c.note}</p>
                                  <small>
                                    {shortDate(c.at)} às {clockTime(c.at)} · {c.author}
                                  </small>
                                </article>
                              ))}
                            </details>
                          )}
                          <details className="vaccine-return-history">
                            <summary>Histórico do aprazamento</summary>
                            {r.events.map((e, index) => (
                              <div key={index}>
                                <strong>
                                  {e.action} · {shortDate(e.recordedAt)}
                                </strong>
                                <p>{e.reason}</p>
                                <small>
                                  Data prevista: {shortDate(e.date)} · {e.author}
                                </small>
                              </div>
                            ))}
                          </details>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            {!filteredReturns.length && (
              <EmptyState
                title="Nenhum retorno neste filtro"
                description="Apraze um retorno pela caderneta da pessoa ou altere o filtro."
              />
            )}
          </Panel>
        )}
        <Notice>
          Ambiente de demonstração: doses e datas dependem de avaliação profissional. Calendário
          oficial, rede de frio completa e transmissão ao SUS ainda não estão conectados.
        </Notice>
      </UnitRequired>
      {form?.kind === 'record' && <VaccinationRecordForm {...form} onClose={() => setForm(null)} />}
      {form?.kind === 'recall' && <VaccineRecallForm {...form} onClose={() => setForm(null)} />}
      {form?.kind === 'contact' && (
        <VaccineForm
          title="Registrar contato do retorno"
          description="Anote uma tentativa já realizada pela equipe. Nenhuma ligação ou mensagem é enviada pelo sistema."
          submitLabel="Salvar contato"
          onClose={() => setForm(null)}
          onSubmit={async (f) => {
            await repository.execute(context, {
              type: 'vaccine.recall.contact',
              id: form.recall.id,
              outcome: valueOf(f, 'outcome') as 'reached' | 'unanswered' | 'unavailable',
              note: valueOf(f, 'note'),
              expectedContacts: form.recall.contacts?.length ?? 0,
              expectedEvents: form.recall.events.length,
            });
            notify('Contato registrado. A data e a situação do retorno foram mantidas.');
          }}
        >
          <div className="followup-summary">
            <strong>{data.patients.find((p) => p.id === form.recall.patientId)?.name}</strong>
            <span>
              {form.recall.immunobiological} · {form.recall.dose} · previsto para{' '}
              {shortDate(form.recall.date)}
            </span>
          </div>
          <Field label="Resultado do contato">
            <select name="outcome">
              {Object.entries(contactLabels).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Registro do contato">
            <textarea
              name="note"
              required
              maxLength={1000}
              rows={4}
              placeholder="Descreva a tentativa ou as orientações repassadas. Use dados fictícios."
            />
          </Field>
        </VaccineForm>
      )}
      {form?.kind === 'void' && (
        <VaccineForm
          title="Anular registro vacinal"
          description={`${form.record.immunobiological} · ${form.record.dose} · ${shortDate(form.record.date)}`}
          submitLabel="Confirmar anulação"
          onClose={() => setForm(null)}
          onSubmit={async (f) => {
            await repository.execute(context, {
              type: 'vaccine.void',
              applicationId: form.record.id,
              reason: valueOf(f, 'reason'),
            });
            notify('Registro anulado. O conteúdo original foi preservado.');
          }}
        >
          <Notice>
            O registro permanece no histórico com a justificativa. A anulação não devolve doses ao
            estoque. Se houver um retorno vinculado, ele será reaberto para acompanhamento.
          </Notice>
          <Field label="Motivo da anulação">
            <textarea name="reason" required maxLength={1000} rows={4} />
          </Field>
        </VaccineForm>
      )}
    </div>
  );
}
