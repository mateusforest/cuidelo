import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { PackageCheck, Plus } from 'lucide-react';
import { useApp } from '../app/context';
import {
  matchesMedication,
  prescriptionProgress,
  type PharmacyPrescription,
} from '../domain/pharmacy';
import type { MedicationLine } from '../domain/clinical-documents';
import { dateKey, shortDate } from '../domain/dates';
import { cpfDigits, formatCpf } from '../domain/identification';
import { Badge, Button, EmptyState, Field, Modal, Notice, Panel, SearchField } from './ui';
import { DocumentBody } from './ClinicalDocuments';
import { DispensationHistory } from './DispensationHistory';
import '../styles/pharmacy.css';

export const pharmacyStatus = {
  waiting: 'Aguardando entrega',
  partial: 'Entrega parcial',
  complete: 'Entregue por completo',
  cancelled: 'Receita cancelada',
};
export function PharmacyDispensing({
  onRegisterLot,
}: {
  onRegisterLot: (item: MedicationLine) => void;
}) {
  const { data } = useApp();
  const [search, setSearch] = useState(''),
    [filter, setFilter] = useState('pending'),
    [editing, setEditing] = useState<PharmacyPrescription | null>(null),
    [detailId, setDetailId] = useState(''),
    [lastReceipt, setLastReceipt] = useState('');
  const rows = data.pharmacyPrescriptions
    .map((doc) => ({ doc, ...prescriptionProgress(doc, data.dispensations) }))
    .sort((a, b) => a.doc.issuedAt.localeCompare(b.doc.issuedAt));
  const list = rows.filter(
    (r) =>
      (filter === 'all' ||
        (filter === 'pending' && ['waiting', 'partial'].includes(r.status)) ||
        r.status === filter) &&
      (`${r.doc.identity.name} ${r.doc.identity.socialName} ${r.doc.number}`
        .toLocaleLowerCase('pt-BR')
        .includes(search.trim().toLocaleLowerCase('pt-BR')) ||
        (/^[\d.\-\s]+$/.test(search) &&
          !!cpfDigits(search) &&
          r.doc.identity.cpf.includes(cpfDigits(search)))),
  );
  const detail = data.pharmacyPrescriptions.find((d) => d.id === detailId);
  return (
    <>
      <div className="pharmacy-stats">
        {(['waiting', 'partial', 'complete', 'cancelled'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            className={filter === status ? 'selected' : ''}
            aria-pressed={filter === status}
          >
            <span>{pharmacyStatus[status]}</span>
            <strong>{rows.filter((r) => r.status === status).length}</strong>
          </button>
        ))}
      </div>
      <Panel
        title="Receitas recebidas do consultório"
        subtitle="Receitas emitidas nesta unidade. A entrega é registrada pelo perfil Farmácia."
      >
        <div className="table-toolbar">
          <SearchField
            value={search}
            onChange={setSearch}
            placeholder="Buscar pessoa, CPF ou receita"
          />
          <Field label="Situação da entrega">
            <select value={filter} onChange={(e) => setFilter(e.target.value)}>
              <option value="pending">Aguardando ou parcial</option>
              <option value="all">Todas</option>
              {Object.entries(pharmacyStatus).map(([v, l]) => (
                <option value={v} key={v}>
                  {l}
                </option>
              ))}
            </select>
          </Field>
        </div>
        {lastReceipt && (
          <div className="pharmacy-receipt-link">
            <PackageCheck size={20} />
            <span>Entrega salva e baixa de estoque registrada.</span>
            <Link to={`/dispensacoes/${lastReceipt}`} target="_blank" className="button secondary">
              Abrir último comprovante
            </Link>
          </div>
        )}
        <div className="pharmacy-prescriptions">
          {list.map(({ doc, items, status, history }) => (
            <article key={doc.id} data-testid={`prescription-${doc.id}`}>
              <div className="clinical-document-heading">
                <span className="document-kind-icon">
                  <PackageCheck size={22} />
                </span>
                <div>
                  <strong>{doc.identity.socialName || doc.identity.name}</strong>
                  <small>
                    {doc.number} · {shortDate(doc.issuedAt)} · {doc.identity.professional}
                  </small>
                  <small>
                    CPF: {doc.identity.cpf ? formatCpf(doc.identity.cpf) : 'não informado'} ·
                    nascimento: {shortDate(doc.identity.birthDate)}
                  </small>
                </div>
                <Badge
                  tone={
                    status === 'complete' ? 'green' : status === 'cancelled' ? 'neutral' : 'amber'
                  }
                >
                  {pharmacyStatus[status]}
                </Badge>
              </div>
              <div className="prescription-balances">
                {items.map(({ item, delivered, remaining }, i) => (
                  <div key={item.id}>
                    <div>
                      <strong>
                        {i + 1}. {item.medicine}
                      </strong>
                      <small>
                        {item.strength} · {item.form} · contagem em {item.quantityUnit}
                      </small>
                    </div>
                    <dl>
                      <div>
                        <dt>Prescrito</dt>
                        <dd>{item.quantity}</dd>
                      </div>
                      <div>
                        <dt>Entregue</dt>
                        <dd>{delivered}</dd>
                      </div>
                      <div>
                        <dt>{status === 'cancelled' ? 'Não entregue' : 'Pendente'}</dt>
                        <dd>{remaining}</dd>
                      </div>
                    </dl>
                    {status !== 'cancelled' &&
                      remaining > 0 &&
                      !data.lots.some(
                        (l) =>
                          matchesMedication(item, l) && l.expiresAt >= dateKey() && l.quantity > 0,
                      ) && (
                        <div className="pharmacy-stock-help">
                          <span>Nenhum lote disponível com a identificação deste item.</span>
                          <button className="text-button" onClick={() => onRegisterLot(item)}>
                            Cadastrar lote para item {i + 1}
                          </button>
                        </div>
                      )}
                  </div>
                ))}
              </div>
              <div className="row-actions">
                <Button variant="secondary" onClick={() => setDetailId(doc.id)}>
                  Ver receita e entregas{history.length ? ` (${history.length})` : ''}
                </Button>
                {['waiting', 'partial'].includes(status) && (
                  <Button onClick={() => setEditing(doc)}>Conferir e entregar</Button>
                )}
              </div>
              {status === 'cancelled' && history.length > 0 && (
                <p className="pharmacy-note">
                  As entregas anteriores permanecem registradas. O cancelamento não devolve
                  medicamentos ao estoque.
                </p>
              )}
            </article>
          ))}
        </div>
        {!list.length && (
          <EmptyState
            title="Nenhuma receita neste filtro"
            description="Emita uma receita no consultório desta unidade ou altere a busca. Rascunhos ainda não entram na farmácia."
          />
        )}
      </Panel>
      <Notice>
        Selecione somente lotes com o mesmo medicamento, concentração, apresentação e unidade de
        entrega da receita. A correspondência do cadastro não substitui a conferência profissional;
        não há conversão de caixas, frascos ou unidades nem substituição automática.
      </Notice>
      {detail && (
        <Modal
          wide
          title={`Receita ${detail.number}`}
          description={`${detail.identity.socialName || detail.identity.name} · ${detail.identity.unit}`}
          onClose={() => setDetailId('')}
        >
          <div className="panel-body">
            <Badge tone={detail.status === 'cancelled' ? 'amber' : 'green'}>
              {detail.status === 'cancelled' ? 'Receita cancelada' : 'Emitida na demonstração'}
            </Badge>
            <DocumentBody content={detail.content} />
            <h3>Entregas registradas</h3>
            <DispensationHistory document={detail} />
          </div>
        </Modal>
      )}
      {editing && (
        <DeliveryEditor
          prescription={editing}
          onClose={() => setEditing(null)}
          onSaved={(id) => {
            setEditing(null);
            setLastReceipt(id);
          }}
        />
      )}
    </>
  );
}

function DeliveryEditor({
  prescription,
  onClose,
  onSaved,
}: {
  prescription: PharmacyPrescription;
  onClose: () => void;
  onSaved: (id: string) => void;
}) {
  const { data, context, repository, notify, setDirty } = useApp();
  const [initial] = useState(() => ({
    revision: repository.getRevision(),
    progress: prescriptionProgress(prescription, data.dispensations),
    requestId: crypto.randomUUID(),
  }));
  const [lines, setLines] = useState(() =>
      initial.progress.items
        .filter((i) => i.remaining > 0)
        .map(({ item }) => ({
          key: crypto.randomUUID(),
          itemId: item.id,
          lotId: '',
          quantity: '',
        })),
    ),
    [recipientKind, setRecipientKind] = useState<'patient' | 'representative'>('patient'),
    [recipientName, setRecipientName] = useState(''),
    [partialReason, setPartialReason] = useState(''),
    [notes, setNotes] = useState(''),
    [identityConfirmed, setIdentityConfirmed] = useState(false),
    [itemsConfirmed, setItemsConfirmed] = useState(false),
    [error, setError] = useState(''),
    [pending, setPending] = useState(false);
  const dirty =
    lines.some((l) => l.lotId || l.quantity) ||
    !!(recipientName || partialReason || notes || identityConfirmed || itemsConfirmed);
  useEffect(() => {
    setDirty(dirty);
    return () => setDirty(false);
  }, [dirty, setDirty]);
  const close = () => {
    if (
      !pending &&
      (!dirty || window.confirm('Descartar a conferência de entrega ainda não salva?'))
    )
      onClose();
  };
  const quantity = (id: string) =>
    lines.filter((l) => l.itemId === id).reduce((total, l) => total + (Number(l.quantity) || 0), 0);
  const partial = initial.progress.items.some((i) => quantity(i.item.id) < i.remaining);
  const patch = (key: string, field: 'lotId' | 'quantity', value: string) =>
    setLines((ls) => ls.map((l) => (l.key === key ? { ...l, [field]: value } : l)));
  return (
    <Modal
      wide
      title="Conferir e registrar entrega"
      description={`${prescription.identity.socialName || prescription.identity.name} · ${prescription.number}`}
      onClose={close}
    >
      <form
        onSubmit={async (e) => {
          e.preventDefault();
          if (pending) return;
          setPending(true);
          setError('');
          try {
            const selected = lines.filter((l) => l.lotId || l.quantity);
            if (selected.some((l) => !l.lotId || !l.quantity))
              throw new Error(
                'Preencha lote e quantidade nas linhas utilizadas, ou remova a linha.',
              );
            const id = await repository.execute(
              context,
              {
                type: 'pharmacy.dispense',
                documentId: prescription.id,
                expectedDocumentVersion: prescription.version,
                expectedDeliveries: initial.progress.history.length,
                requestId: initial.requestId,
                allocations: selected.map((l) => ({
                  itemId: l.itemId,
                  lotId: l.lotId,
                  quantity: Number(l.quantity),
                })),
                recipient: {
                  kind: recipientKind,
                  name:
                    recipientKind === 'patient'
                      ? prescription.identity.socialName || prescription.identity.name
                      : recipientName,
                },
                identityConfirmed,
                itemsConfirmed,
                partialReason: partial ? partialReason : '',
                notes,
              },
              initial.revision,
            );
            notify('Entrega registrada com baixa por lote. O histórico foi preservado.');
            setDirty(false);
            onSaved(id);
          } catch (e) {
            setError((e as Error).message);
          } finally {
            setPending(false);
          }
        }}
      >
        <fieldset disabled={pending} className="form-fields delivery-form">
          <Notice>
            Registre somente a quantidade efetivamente entregue. Linhas em branco não movimentam o
            estoque. As entregas confirmadas ficam preservadas.
          </Notice>
          {repository.getRevision() !== initial.revision && (
            <Notice tone="amber">
              Os dados foram atualizados desde a abertura. Feche e reabra esta conferência para
              revisar os saldos.
            </Notice>
          )}
          <details className="document-history">
            <summary>Conferir a receita completa e suas orientações</summary>
            <DocumentBody content={prescription.content} />
          </details>
          {initial.progress.items.map(({ item, delivered, remaining }, index) => {
            const lots = data.lots
              .filter((l) => matchesMedication(item, l))
              .sort((a, b) => a.expiresAt.localeCompare(b.expiresAt) || a.lot.localeCompare(b.lot));
            return (
              <section className="delivery-item" key={item.id}>
                <h3>
                  {index + 1}. {item.medicine}
                </h3>
                <p>
                  {item.strength} · {item.form} · unidade de entrega:{' '}
                  <strong>{item.quantityUnit}</strong>
                </p>
                <div className="delivery-balance">
                  <span>
                    Prescrito: <strong>{item.quantity}</strong>
                  </span>
                  <span>
                    Já entregue: <strong>{delivered}</strong>
                  </span>
                  <span>
                    Pendente: <strong>{remaining}</strong>
                  </span>
                </div>
                {remaining > 0 ? (
                  <>
                    {!lots.length && (
                      <Notice tone="amber">
                        Nenhum lote identificado para este item. Cadastre um lote correspondente ou
                        identifique a apresentação de um lote existente no estoque.
                      </Notice>
                    )}
                    {lines
                      .filter((l) => l.itemId === item.id)
                      .map((line, lineIndex) => (
                        <div className="delivery-lot-line" key={line.key}>
                          <Field label={`Lote · item ${index + 1} · linha ${lineIndex + 1}`}>
                            <select
                              value={line.lotId}
                              onChange={(e) => patch(line.key, 'lotId', e.target.value)}
                            >
                              <option value="">Selecione um lote</option>
                              {lots.map((l) => (
                                <option
                                  value={l.id}
                                  key={l.id}
                                  disabled={l.expiresAt < dateKey() || l.quantity === 0}
                                >
                                  {l.lot} · saldo {l.quantity} · vence {shortDate(l.expiresAt)}
                                  {l.expiresAt < dateKey() ? ' · VENCIDO' : ''}
                                </option>
                              ))}
                            </select>
                          </Field>
                          <Field label={`Entregar · item ${index + 1} · linha ${lineIndex + 1}`}>
                            <input
                              type="number"
                              min="1"
                              step="1"
                              value={line.quantity}
                              onChange={(e) => patch(line.key, 'quantity', e.target.value)}
                            />
                          </Field>
                          <button
                            type="button"
                            className="text-button"
                            onClick={() => setLines((ls) => ls.filter((l) => l.key !== line.key))}
                          >
                            Remover linha {lineIndex + 1} do item {index + 1}
                          </button>
                        </div>
                      ))}
                    <Button
                      type="button"
                      variant="secondary"
                      disabled={lines.length >= 60}
                      onClick={() =>
                        setLines((ls) => [
                          ...ls,
                          { key: crypto.randomUUID(), itemId: item.id, lotId: '', quantity: '' },
                        ])
                      }
                    >
                      <Plus size={15} />
                      Adicionar lote ao item {index + 1}
                    </Button>
                    <p className={quantity(item.id) > remaining ? 'form-error' : 'pharmacy-note'}>
                      Nesta entrega: {quantity(item.id)} {item.quantityUnit} ·{' '}
                      {quantity(item.id) > remaining
                        ? 'quantidade acima do saldo prescrito'
                        : `restará ${remaining - quantity(item.id)}`}
                    </p>
                  </>
                ) : (
                  <Badge tone="green">Item já entregue por completo</Badge>
                )}
              </section>
            );
          })}
          <Field label="Quem recebe">
            <select
              value={recipientKind}
              onChange={(e) => setRecipientKind(e.target.value as 'patient' | 'representative')}
            >
              <option value="patient">Pessoa da receita</option>
              <option value="representative">Representante da pessoa</option>
            </select>
          </Field>
          {recipientKind === 'representative' ? (
            <Field label="Nome de quem recebe">
              <input
                value={recipientName}
                onChange={(e) => setRecipientName(e.target.value)}
                maxLength={200}
                required
              />
            </Field>
          ) : (
            <p className="pharmacy-note">
              {prescription.identity.socialName || prescription.identity.name} · CPF{' '}
              {prescription.identity.cpf ? formatCpf(prescription.identity.cpf) : 'não informado'} ·
              nascimento {shortDate(prescription.identity.birthDate)}
            </p>
          )}
          {partial && (
            <Field label="Motivo do saldo pendente">
              <textarea
                value={partialReason}
                onChange={(e) => setPartialReason(e.target.value)}
                required
                maxLength={2000}
                placeholder="Ex.: parte do estoque indisponível; retorno combinado para buscar o restante."
              />
            </Field>
          )}
          <Field label="Observações da entrega">
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} maxLength={2000} />
          </Field>
          <label className="document-check">
            <input
              type="checkbox"
              checked={identityConfirmed}
              onChange={(e) => setIdentityConfirmed(e.target.checked)}
              required
            />
            Conferi a identificação da pessoa ou representante que recebe
          </label>
          <label className="document-check">
            <input
              type="checkbox"
              checked={itemsConfirmed}
              onChange={(e) => setItemsConfirmed(e.target.checked)}
              required
            />
            Conferi a receita, os medicamentos, as unidades, as quantidades e os lotes
          </label>
        </fieldset>
        {error && (
          <div role="alert" className="form-error">
            {error} Reabra a conferência se os dados mudaram.
          </div>
        )}
        <div className="modal-actions">
          <Button type="button" variant="secondary" onClick={close} disabled={pending}>
            Voltar sem registrar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending
              ? 'Registrando…'
              : partial
                ? 'Confirmar entrega parcial'
                : 'Confirmar entrega e concluir'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
