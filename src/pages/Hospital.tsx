import { useState } from 'react';
import { BedDouble, Plus, LogOut, Sparkles, LockKeyhole } from 'lucide-react';
import { useApp } from '../app/context';
import type { Admission, Bed, BedStatus } from '../domain/model';
import { demoIdentities } from '../domain/access';
import { shortDate, clockTime } from '../domain/dates';
import {
  ActionForm,
  Avatar,
  Badge,
  Button,
  EmptyState,
  Field,
  Modal,
  PageHeader,
  Panel,
  UnitRequired,
  valueOf,
} from '../components/ui';

const labels: Record<BedStatus, string> = {
  available: 'Disponível',
  occupied: 'Ocupado',
  cleaning: 'Higienização',
  blocked: 'Bloqueado',
};
export function Hospital() {
  const { data, context, repository, notify } = useApp();
  const [filter, setFilter] = useState<BedStatus | 'all'>('all'),
    [admit, setAdmit] = useState<string | null>(null),
    [transfer, setTransfer] = useState<Admission | null>(null),
    [discharge, setDischarge] = useState<Admission | null>(null),
    [changeBed, setChangeBed] = useState<Bed | null>(null);
  const unit = data.units.find((u) => u.id === context.unitId),
    beds = data.beds.filter((b) => filter === 'all' || b.status === filter),
    available = data.beds.filter((b) => b.status === 'available');
  const people = new Map(
    data.patients.map((person) => [person.id, person.socialName || person.name]),
  );
  const staff = new Map(
    demoIdentities(repository.directory()).map((person) => [person.sessionId, person.name]),
  );
  const bedNames = new Map(data.beds.map((bed) => [bed.id, bed.name]));
  return (
    <>
      <PageHeader
        eyebrow="CUIDADO HOSPITALAR"
        title="Internação e leitos"
        description="Acompanhe admissões, saídas e a disponibilidade de cada leito."
        action={
          <Button
            disabled={unit?.kind !== 'hospital' || available.length === 0}
            onClick={() => setAdmit('')}
          >
            <Plus size={18} />
            Nova admissão
          </Button>
        }
      />
      <UnitRequired>
        {unit?.kind !== 'hospital' ? (
          <Panel>
            <EmptyState
              title="Esta unidade não possui internação no cenário"
              description="Na entrada de demonstração, escolha um acesso vinculado a um hospital para testar o mapa de leitos."
            />
          </Panel>
        ) : (
          <>
            <div className="queue-stats">
              {(['available', 'occupied', 'cleaning', 'blocked'] as const).map((s) => (
                <button
                  key={s}
                  className={filter === s ? 'selected' : ''}
                  onClick={() => setFilter(filter === s ? 'all' : s)}
                >
                  <span>{labels[s]}</span>
                  <strong>{data.beds.filter((b) => b.status === s).length}</strong>
                </button>
              ))}
            </div>
            <Panel
              title="Mapa de leitos"
              subtitle="A ocupação é atualizada pelos registros de admissão e saída."
              action={
                <button className="text-button" onClick={() => setFilter('all')}>
                  Todos os leitos
                </button>
              }
            >
              <div className="bed-grid">
                {beds.map((b) => {
                  const a = data.admissions.find((a) => a.bedId === b.id && !a.dischargedAt),
                    p = data.patients.find((p) => p.id === a?.patientId);
                  return (
                    <article className={`bed-card ${b.status}`} key={b.id}>
                      <div className="bed-card-heading">
                        <span>
                          <BedDouble size={19} />
                          <strong>{b.name}</strong>
                        </span>
                        <Badge
                          tone={
                            b.status === 'available'
                              ? 'green'
                              : b.status === 'occupied'
                                ? 'blue'
                                : b.status === 'cleaning'
                                  ? 'amber'
                                  : 'neutral'
                          }
                        >
                          {labels[b.status]}
                        </Badge>
                      </div>
                      <p className="bed-ward">{b.ward}</p>
                      {a && p ? (
                        <>
                          <div className="bed-person">
                            <Avatar name={p.name} small />
                            <div>
                              <strong>{p.socialName || p.name}</strong>
                              <small>Admissão em {shortDate(a.admittedAt)}</small>
                            </div>
                          </div>
                          <Button
                            variant="secondary"
                            disabled={!available.length}
                            onClick={() => setTransfer(a)}
                          >
                            Transferir de leito
                          </Button>
                          <Button variant="secondary" onClick={() => setDischarge(a)}>
                            <LogOut size={15} />
                            Registrar saída
                          </Button>
                        </>
                      ) : (
                        <>
                          <div className="bed-availability">
                            {b.status === 'available' ? (
                              <>
                                <BedDouble size={26} />
                                <span>Pronto para receber</span>
                              </>
                            ) : b.status === 'cleaning' ? (
                              <>
                                <Sparkles size={26} />
                                <span>Aguardando higienização</span>
                              </>
                            ) : (
                              <>
                                <LockKeyhole size={25} />
                                <span>{b.reason || 'Leito indisponível'}</span>
                              </>
                            )}
                          </div>
                          {b.status === 'available' ? (
                            <div className="bed-buttons">
                              <Button variant="secondary" onClick={() => setAdmit(b.id)}>
                                <Plus size={15} />
                                Admitir
                              </Button>
                              <button className="text-button" onClick={() => setChangeBed(b)}>
                                Gerenciar
                              </button>
                            </div>
                          ) : (
                            <Button variant="secondary" onClick={() => setChangeBed(b)}>
                              Atualizar situação
                            </Button>
                          )}
                        </>
                      )}
                    </article>
                  );
                })}
              </div>
              {!beds.length && (
                <EmptyState
                  title="Nenhum leito neste filtro"
                  description="Escolha outra situação ou exiba todos os leitos."
                />
              )}
            </Panel>
            {data.admissions.some((a) => a.transfers?.length || a.dischargedAt) && (
              <Panel
                title="Histórico de movimentações"
                subtitle="Transferências e saídas registradas nesta unidade."
              >
                <div className="panel-body">
                  {data.admissions
                    .filter((a) => a.transfers?.length || a.dischargedAt)
                    .map((a) => (
                      <details key={a.id} className="document-history">
                        <summary>
                          {people.get(a.patientId)} ·{' '}
                          {a.dischargedAt ? 'Internação encerrada' : bedNames.get(a.bedId)}
                        </summary>
                        <ol>
                          {a.transfers?.map((m, i) => (
                            <li key={i}>
                              <strong>
                                {bedNames.get(m.fromBedId)} → {bedNames.get(m.toBedId)}
                              </strong>
                              <p>{m.reason}</p>
                              <small>
                                {shortDate(m.at)} às {clockTime(m.at)} · {staff.get(m.actorId)}
                              </small>
                            </li>
                          ))}
                          {a.dischargedAt && (
                            <li>
                              Saída em {shortDate(a.dischargedAt)} às {clockTime(a.dischargedAt)} ·{' '}
                              {a.dischargeReason}
                            </li>
                          )}
                        </ol>
                      </details>
                    ))}
                </div>
              </Panel>
            )}
          </>
        )}
      </UnitRequired>
      {admit !== null && (
        <Modal
          title="Nova admissão"
          description="Registra a ocupação de um leito disponível neste ambiente."
          onClose={() => setAdmit(null)}
        >
          <ActionForm
            onClose={() => setAdmit(null)}
            submitLabel="Registrar admissão"
            onSubmit={async (f) => {
              await repository.execute(context, {
                type: 'admission.create',
                patientId: valueOf(f, 'patient'),
                bedId: valueOf(f, 'bed'),
              });
              notify('Admissão registrada e leito ocupado.');
            }}
          >
            <Field label="Pessoa">
              <select name="patient" required defaultValue="">
                <option value="" disabled>
                  Selecione uma pessoa fictícia
                </option>
                {data.patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name} · {p.record}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Leito">
              <select name="bed" required defaultValue={admit || ''}>
                <option value="" disabled>
                  Selecione um leito disponível
                </option>
                {available.map((b) => (
                  <option value={b.id} key={b.id}>
                    {b.name} · {b.ward}
                  </option>
                ))}
              </select>
            </Field>
          </ActionForm>
        </Modal>
      )}
      {transfer && (
        <Modal
          title="Transferir de leito"
          description={people.get(transfer.patientId)}
          onClose={() => setTransfer(null)}
        >
          <ActionForm
            onClose={() => setTransfer(null)}
            submitLabel="Confirmar transferência"
            onSubmit={async (f) => {
              await repository.execute(context, {
                type: 'admission.transfer',
                id: transfer.id,
                fromBedId: transfer.bedId,
                toBedId: valueOf(f, 'bed'),
                expectedTransfers: transfer.transfers?.length ?? 0,
                reason: valueOf(f, 'reason'),
              });
              notify('Transferência registrada. O leito anterior aguarda higienização.');
            }}
          >
            <p>
              Leito atual: <strong>{bedNames.get(transfer.bedId)}</strong>
            </p>
            <Field label="Leito de destino">
              <select name="bed" required defaultValue="">
                <option value="" disabled>
                  Selecione um leito disponível
                </option>
                {available.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} · {b.ward}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Motivo da transferência">
              <textarea required name="reason" maxLength={1000} rows={3} />
            </Field>
          </ActionForm>
        </Modal>
      )}
      {discharge && (
        <Modal
          title="Registrar saída da internação"
          description="O leito passará para higienização, sem liberação automática para nova admissão."
          onClose={() => setDischarge(null)}
        >
          <ActionForm
            onClose={() => setDischarge(null)}
            submitLabel="Registrar saída"
            onSubmit={async (f) => {
              await repository.execute(context, {
                type: 'admission.discharge',
                id: discharge.id,
                reason: valueOf(f, 'reason'),
              });
              notify('Saída registrada. O leito aguarda higienização.');
            }}
          >
            <Field label="Motivo e observação da saída">
              <textarea
                name="reason"
                required
                rows={3}
                maxLength={2000}
                placeholder="Informação fictícia para testar a saída administrativa"
              />
            </Field>
          </ActionForm>
        </Modal>
      )}
      {changeBed && (
        <Modal
          title={`Atualizar ${changeBed.name.toLowerCase()}`}
          description="Toda mudança de situação exige uma justificativa."
          onClose={() => setChangeBed(null)}
        >
          <ActionForm
            onClose={() => setChangeBed(null)}
            submitLabel="Atualizar leito"
            onSubmit={async (f) => {
              await repository.execute(context, {
                type: 'bed.status',
                id: changeBed.id,
                status: valueOf(f, 'status') as 'available' | 'cleaning' | 'blocked',
                reason: valueOf(f, 'reason'),
              });
              notify('Situação do leito atualizada.');
            }}
          >
            <Field label="Nova situação">
              <select
                name="status"
                defaultValue={changeBed.status === 'available' ? 'blocked' : 'available'}
              >
                <option value="available">Disponível</option>
                <option value="cleaning">Higienização</option>
                <option value="blocked">Bloqueado</option>
              </select>
            </Field>
            <Field label="Justificativa">
              <textarea name="reason" required rows={3} maxLength={2000} />
            </Field>
          </ActionForm>
        </Modal>
      )}
    </>
  );
}
