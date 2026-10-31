import { useEffect, useState } from 'react';
import { useApp } from '../app/context';
import { clockTime, dateKey, shortDate } from '../domain/dates';
import { normalizedName } from '../domain/identification';
import {
  pendingStockTransfers,
  incomingTransfersForLot,
  type StockLogisticsEvent,
} from '../domain/pharmacy-logistics';
import {
  ActionForm,
  Badge,
  Button,
  EmptyState,
  Field,
  Modal,
  Notice,
  Panel,
  SearchField,
  valueOf,
} from './ui';

type LotAction = 'shipment' | 'inventory' | 'disposal';
type Shipment = Extract<StockLogisticsEvent, { kind: 'shipment' }>;
type Receipt = Extract<StockLogisticsEvent, { kind: 'receipt' }>;
const views = {
  shipment: {
    tab: 'Transferências',
    title: 'Transferências da unidade',
    action: 'Expedir transferência',
    submit: 'Confirmar expedição',
    subtitle: 'Acompanhe cada remessa da saída na origem à conferência no destino.',
  },
  inventory: {
    tab: 'Inventário',
    title: 'Histórico de inventário',
    action: 'Contar lote',
    submit: 'Confirmar contagem',
    subtitle: 'Confira a contagem física de cada lote e as diferenças encontradas.',
  },
  disposal: {
    tab: 'Destinação',
    title: 'Histórico de destinação',
    action: 'Registrar destinação',
    submit: 'Confirmar destinação',
    subtitle: 'Registre o destino documentado do material que saiu do estoque segregado.',
  },
};
const when = (at: string) => shortDate(at) + ' às ' + clockTime(at);

export function PharmacyLogistics() {
  const { data, context, repository, notify } = useApp();
  const [importing, setImporting] = useState(false),
    [shared, setShared] = useState(''),
    [networkError, setNetworkError] = useState(''),
    [sending, setSending] = useState('');
  const hasChannels = data.shipmentChannels.some((ch) => ch.published);
  useEffect(() => {
    if (!hasChannels) return;
    let active = true,
      busy = false;
    async function sync() {
      if (busy || document.hidden) return;
      busy = true;
      try {
        await repository.refreshShipments(context);
        if (active) setNetworkError('');
      } catch (e) {
        if (active) setNetworkError((e as Error).message);
      } finally {
        busy = false;
      }
    }
    void sync();
    const timer = setInterval(sync, 6000);
    window.addEventListener('focus', sync);
    return () => {
      active = false;
      clearInterval(timer);
      window.removeEventListener('focus', sync);
    };
  }, [hasChannels, context, repository]);
  async function publish(id: string) {
    setSending(id);
    setNetworkError('');
    try {
      setShared(await repository.shareShipment(context, id));
    } catch (e) {
      setNetworkError((e as Error).message);
    } finally {
      setSending('');
    }
  }
  const [view, setView] = useState<LotAction>('shipment'),
    [search, setSearch] = useState('');
  const [creating, setCreating] = useState(false),
    [receiving, setReceiving] = useState<Shipment | null>(null);
  const unitName = (id: string) => data.units.find((u) => u.id === id)?.name ?? id;
  const receipts = new Map<string, Receipt[]>();
  for (const e of data.stockLogistics)
    if (e.kind === 'receipt')
      receipts.set(e.shipmentId, [...(receipts.get(e.shipmentId) ?? []), e]);
  const latestCount = new Map(
    data.stockLogistics.filter((e) => e.kind === 'inventory').map((e) => [e.lotId, e.id]),
  );
  const pending = pendingStockTransfers(data.stockLogistics);
  const incoming = pending.filter((e) => e.toUnitId === context.unitId).length;
  const outgoing = pending.filter((e) => e.unitId === context.unitId).length;
  const query = normalizedName(search);
  const rows = data.stockLogistics
    .filter((e): e is Exclude<StockLogisticsEvent, Receipt> => e.kind === view)
    .reverse()
    .filter((e) => {
      const extra =
        e.kind === 'shipment'
          ? [
              unitName(e.unitId),
              unitName(e.toUnitId),
              ...(receipts.get(e.id) ?? []).map((r) => r.reference),
            ]
          : e.kind === 'disposal'
            ? [e.destination]
            : [];
      return normalizedName([e.product, e.lot, e.reference, ...extra].join(' ')).includes(query);
    });
  if (view === 'shipment')
    rows.sort(
      (a, b) =>
        Number(!pending.some((s) => s.id === a.id)) - Number(!pending.some((s) => s.id === b.id)),
    );
  return (
    <>
      <div className="pharmacy-logistics-tabs" role="group" aria-label="Operações de logística">
        {(Object.keys(views) as LotAction[]).map((k) => (
          <button
            type="button"
            key={k}
            aria-pressed={view === k}
            onClick={() => {
              setView(k);
              setSearch('');
            }}
          >
            {views[k].tab}
          </button>
        ))}
      </div>
      <Panel
        className="pharmacy-logistics-panel"
        title={views[view].title}
        subtitle={views[view].subtitle}
        action={<Button onClick={() => setCreating(true)}>{views[view].action}</Button>}
      >
        <section aria-label={views[view].title} className="pharmacy-logistics-history">
          {view === 'shipment' && (
            <div className="pharmacy-transit-summary">
              <div>
                <strong>{incoming}</strong>
                <span>Para receber</span>
              </div>
              <div>
                <strong>{outgoing}</strong>
                <span>Enviadas em trânsito</span>
              </div>
            </div>
          )}
          {view === 'shipment' && (
            <div className="pharmacy-logistics-help">
              <strong>Transferir entre computadores</strong>
              <p>
                Na origem, faça a expedição e gere o código da remessa. No computador da UBS de
                destino, conecte o código para registrar cada parcela recebida.
              </p>
              <Button variant="secondary" onClick={() => setImporting(true)}>
                Conectar remessa por código
              </Button>
              {hasChannels && (
                <Button
                  variant="ghost"
                  onClick={async () => {
                    try {
                      await repository.refreshShipments(context);
                      setNetworkError('');
                      notify('Remessas atualizadas.');
                    } catch (e) {
                      setNetworkError((e as Error).message);
                    }
                  }}
                >
                  Atualizar remessas
                </Button>
              )}
              {networkError && <p role="alert">{networkError}</p>}
            </div>
          )}
          <div className="table-toolbar">
            <SearchField
              placeholder="Buscar lote ou referência"
              value={search}
              onChange={setSearch}
            />
          </div>
          {rows.map((e) => {
            const entries = receipts.get(e.id) ?? [];
            const received = entries.reduce((n, r) => n + r.quantity, 0);
            const remaining = e.kind === 'shipment' ? e.quantity - received : 0;
            const channel = data.shipmentChannels.find((ch) => ch.id === e.id);
            const openCount =
              e.kind === 'inventory' && !e.reconciled && latestCount.get(e.lotId) === e.id;
            return (
              <article key={e.id} className="pharmacy-logistics-record">
                <div className="pharmacy-logistics-heading">
                  <div>
                    <strong>{e.product}</strong>
                    <small>
                      {e.presentation} · lote {e.lot} · validade {shortDate(e.expiresAt)}
                    </small>
                  </div>
                  {e.kind === 'shipment' ? (
                    <Badge tone={remaining === 0 ? 'green' : received ? 'amber' : 'blue'}>
                      {remaining === 0
                        ? 'Recebida'
                        : received
                          ? 'Recebida parcialmente'
                          : 'Em trânsito'}
                    </Badge>
                  ) : e.kind === 'inventory' ? (
                    <Badge tone={e.reconciled ? 'green' : openCount ? 'amber' : 'neutral'}>
                      {e.reconciled
                        ? 'Contagem conciliada'
                        : openCount
                          ? 'Recontagem necessária'
                          : 'Divergência registrada'}
                    </Badge>
                  ) : (
                    <Badge tone="neutral">Destinação registrada</Badge>
                  )}
                </div>
                {e.kind === 'shipment' ? (
                  <>
                    <p>
                      <strong>
                        {e.quantity} {e.quantityUnit}
                      </strong>{' '}
                      · {unitName(e.unitId)} → {unitName(e.toUnitId)}
                    </p>
                    <div className="pharmacy-logistics-stage">
                      <strong>Expedição</strong>
                      <span>
                        Expedida · {e.quantity} · Recebida · {received} · Em trânsito · {remaining}{' '}
                        {e.quantityUnit}
                      </span>
                      <span>
                        {when(e.at)} · {e.author}
                      </span>
                      <span>Referência · {e.reference}</span>
                      <p>{e.reason}</p>
                      {e.unitId === context.unitId && e.before !== undefined && (
                        <span>
                          Saldo na origem · {e.before} → {e.after} {e.quantityUnit}
                        </span>
                      )}
                    </div>
                    {entries.map((receipt) => (
                      <div className="pharmacy-logistics-stage" key={receipt.id}>
                        <strong>
                          Recebimento · {receipt.quantity} {receipt.quantityUnit}
                        </strong>
                        <span>
                          {when(receipt.confirmedAt ?? receipt.at)} · {receipt.author}
                        </span>
                        <span>Referência · {receipt.reference}</span>
                        <span>
                          {receipt.destination === 'segregated'
                            ? 'Entrada em segregação'
                            : 'Entrada no estoque disponível'}
                          {receipt.unitId === context.unitId && receipt.before !== undefined
                            ? ' · ' +
                              receipt.before +
                              ' → ' +
                              receipt.after +
                              ' ' +
                              receipt.quantityUnit
                            : ''}
                        </span>
                      </div>
                    ))}
                    {remaining > 0 &&
                      (e.toUnitId === context.unitId && (!channel || channel.canReceive) ? (
                        <Button variant="secondary" onClick={() => setReceiving(e)}>
                          Receber transferência
                        </Button>
                      ) : (
                        <small>
                          {channel && !channel.canReceive && e.toUnitId === context.unitId
                            ? 'Conecte o código no computador da UBS.'
                            : 'Aguardando conferência pela unidade de destino.'}
                        </small>
                      ))}
                    {e.unitId === context.unitId &&
                      e.before !== undefined &&
                      (channel || received === 0) && (
                        <Button
                          variant="secondary"
                          disabled={!!sending}
                          onClick={() => publish(e.id)}
                        >
                          {sending === e.id
                            ? 'Enviando…'
                            : channel?.published
                              ? 'Ver código da remessa'
                              : channel
                                ? 'Tentar publicar remessa'
                                : 'Enviar para outro computador'}
                        </Button>
                      )}
                    {channel && (
                      <small>
                        {channel.published
                          ? 'Remessa conectada pela internet'
                          : 'Publicação pendente de confirmação'}
                      </small>
                    )}
                  </>
                ) : (
                  <>
                    {e.kind === 'inventory' ? (
                      <>
                        <p>
                          Estoque físico disponível · {e.countedStock} {e.quantityUnit} (registro
                          anterior · {e.before})
                        </p>
                        <p>
                          Estoque físico segregado · {e.countedSegregated} {e.quantityUnit}{' '}
                          (registro anterior · {e.segregatedBefore})
                        </p>
                        <p>
                          {e.reconciled
                            ? 'Saldo registrado após a conferência · ' +
                              e.after +
                              ' ' +
                              e.quantityUnit
                            : openCount
                              ? 'Os saldos foram preservados. Confira o segregado e registre nova contagem.'
                              : 'Os saldos foram preservados nesta contagem. Há uma conferência posterior deste lote.'}
                        </p>
                      </>
                    ) : (
                      <>
                        <p>
                          <strong>
                            {e.quantity} {e.quantityUnit}
                          </strong>{' '}
                          destinados a {e.destination}
                        </p>
                        <p>
                          Saldo segregado · {e.before} → {e.after} {e.quantityUnit}
                        </p>
                      </>
                    )}
                    <p>{e.reason}</p>
                    <small>Referência · {e.reference}</small>
                    <small>
                      {when(e.at)} · {e.author}
                    </small>
                  </>
                )}
              </article>
            );
          })}
          {!rows.length && (
            <EmptyState
              title={search ? 'Nenhum registro encontrado' : 'Sem registros nesta unidade'}
              description={
                search
                  ? 'Revise o lote ou a referência informada.'
                  : view === 'shipment'
                    ? 'As expedições e os recebimentos vinculados a esta unidade aparecem aqui.'
                    : 'As operações confirmadas nesta unidade ficam disponíveis neste histórico.'
              }
            />
          )}
        </section>
      </Panel>
      {importing && (
        <Modal title="Conectar remessa por código" onClose={() => setImporting(false)}>
          <ActionForm
            onClose={() => setImporting(false)}
            submitLabel="Conectar à unidade"
            onSubmit={async (f) => {
              await repository.connectShipment(context, valueOf(f, 'code'));
              setSearch('');
              notify('Remessa conectada a este computador.');
            }}
          >
            <p>
              Use o computador que registrará as entradas desta remessa. Continue neste navegador
              para receber as próximas parcelas.
            </p>
            <Field label="Código da remessa">
              <input
                name="code"
                autoComplete="off"
                required
                maxLength={64}
                placeholder="Cole o código enviado pela origem"
              />
            </Field>
          </ActionForm>
        </Modal>
      )}
      {shared && (
        <Modal title="Enviar código à UBS" onClose={() => setShared('')}>
          <div className="modal-body">
            <p>
              Na farmácia da unidade de destino, abra Logística, selecione{' '}
              <strong>Conectar remessa por código</strong> e cole este código. Guarde-o apenas com a
              equipe responsável.
            </p>
            <Field label="Código da remessa">
              <input
                readOnly
                value={shared.match(/.{1,4}/g)?.join('-') ?? shared}
                onFocus={(e) => e.target.select()}
              />
            </Field>
            <Button
              variant="secondary"
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(shared);
                  notify('Código copiado.');
                } catch {
                  notify('Selecione e copie o código no campo acima.');
                }
              }}
            >
              Copiar código
            </Button>
          </div>
        </Modal>
      )}
      {creating && <LotLogisticsForm kind={view} onClose={() => setCreating(false)} />}
      {receiving && <ReceiveTransfer shipment={receiving} onClose={() => setReceiving(null)} />}
    </>
  );
}

function LotLogisticsForm({ kind, onClose }: { kind: LotAction; onClose: () => void }) {
  const { data, context, repository, notify } = useApp();
  const [initial] = useState(() => ({
    revision: repository.getRevision(),
    requestId: crypto.randomUUID(),
    lots: data.lots.filter(
      (l) =>
        kind === 'inventory' ||
        (kind === 'disposal'
          ? (l.segregatedQuantity ?? 0) > 0
          : l.quantity > 0 && l.expiresAt >= dateKey() && !!l.medication),
    ),
    units: data.units.filter(
      (u) => u.organizationId === context.organizationId && u.id !== context.unitId,
    ),
  }));
  const [lotId, setLotId] = useState(''),
    [confirmed, setConfirmed] = useState(false);
  const [counted, setCounted] = useState(''),
    [segregated, setSegregated] = useState('');
  const lot = initial.lots.find((l) => l.id === lotId);
  const incoming =
    kind === 'inventory' && lot ? incomingTransfersForLot(data.stockLogistics, lot) : [];
  const segmentedMatches =
    lot && segregated !== '' && Number(segregated) === (lot.segregatedQuantity ?? 0);
  const blockedIncrease =
    !!lot && incoming.length > 0 && segmentedMatches && Number(counted) > lot.quantity;
  const unit = lot?.medication?.quantityUnit ?? 'unidade de estoque';
  const canCreate = initial.lots.length > 0 && (kind !== 'shipment' || initial.units.length > 0);
  return (
    <Modal title={views[kind].action} onClose={onClose}>
      {!canCreate ? (
        <div className="panel-body">
          <EmptyState
            title={
              kind === 'shipment' && !initial.units.length
                ? 'Sem outra unidade de destino'
                : 'Nenhum lote elegível'
            }
            description={
              kind === 'disposal'
                ? 'A destinação exige material registrado no saldo segregado.'
                : kind === 'shipment'
                  ? 'É preciso um lote identificado, com validade vigente e saldo positivo, e outra unidade desta prefeitura.'
                  : 'Cadastre um lote para registrar a primeira contagem.'
            }
          />
          <Button variant="secondary" onClick={onClose}>
            Voltar ao estoque
          </Button>
        </div>
      ) : (
        <ActionForm
          onClose={onClose}
          submitLabel={views[kind].submit}
          onSubmit={async (f) => {
            if (!lot || !confirmed) throw new Error('Confira o lote e confirme a operação.');
            if (blockedIncrease)
              throw new Error(
                'Receba a remessa pendente deste lote antes de conciliar um aumento no estoque.',
              );
            const common = {
              lotId: lot.id,
              requestId: initial.requestId,
              reason: valueOf(f, 'reason'),
              reference: valueOf(f, 'reference'),
            };
            if (kind === 'disposal')
              await repository.execute(
                context,
                {
                  ...common,
                  type: 'stock.dispose',
                  quantity: Number(valueOf(f, 'quantity')),
                  expectedSegregated: lot.segregatedQuantity ?? 0,
                  destination: valueOf(f, 'destination'),
                },
                initial.revision,
              );
            if (kind === 'inventory')
              await repository.execute(
                context,
                {
                  ...common,
                  type: 'stock.inventory',
                  countedStock: Number(counted),
                  countedSegregated: Number(segregated),
                  expectedStock: lot.quantity,
                  expectedSegregated: lot.segregatedQuantity ?? 0,
                },
                initial.revision,
              );
            if (kind === 'shipment')
              await repository.execute(
                context,
                {
                  ...common,
                  type: 'stock.ship',
                  toUnitId: valueOf(f, 'toUnitId'),
                  quantity: Number(valueOf(f, 'quantity')),
                  expectedStock: lot.quantity,
                },
                initial.revision,
              );
            notify(
              kind === 'shipment'
                ? 'Expedição registrada. A remessa está em trânsito.'
                : kind === 'disposal'
                  ? 'Destinação registrada e saldo segregado atualizado.'
                  : Number(segregated) !== (lot.segregatedQuantity ?? 0)
                    ? 'Contagem registrada para recontagem. Os saldos foram preservados.'
                    : 'Contagem conciliada e histórico atualizado.',
            );
          }}
        >
          <div className="pharmacy-logistics-fields" onChange={() => setConfirmed(false)}>
            <Field label={kind === 'inventory' ? 'Lote contado' : 'Lote de origem'}>
              <select
                value={lotId}
                required
                onChange={(e) => {
                  setLotId(e.target.value);
                  setCounted('');
                  setSegregated('');
                }}
              >
                <option value="">Escolha um lote</option>
                {initial.lots.map((l) => (
                  <option key={l.id} value={l.id}>
                    {l.product} · lote {l.lot} · {l.presentation}
                  </option>
                ))}
              </select>
            </Field>
            {lot && (
              <div className="pharmacy-adjustment-balance">
                <strong>
                  {lot.product} · {lot.lot}
                </strong>
                <span>Validade · {shortDate(lot.expiresAt)}</span>
                <span>
                  {lot.expiresAt < dateKey() ? 'Bloqueado por validade' : 'Disponível'} ·{' '}
                  {lot.quantity} {unit}
                </span>
                <span>
                  Segregado · {lot.segregatedQuantity ?? 0} {unit}
                </span>
              </div>
            )}
            {kind === 'shipment' && (
              <Field label="Unidade de destino">
                <select name="toUnitId" required defaultValue="">
                  <option value="">Escolha a unidade que receberá</option>
                  {initial.units.map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            {kind === 'inventory' ? (
              <>
                {incoming.length > 0 && (
                  <Notice tone="amber">
                    Há remessa pendente de recebimento para este produto e lote. Confira em
                    Transferências antes de aumentar o saldo disponível. Referência da expedição ·{' '}
                    {incoming.map((e) => e.reference).join(', ')}.
                  </Notice>
                )}
                <Field
                  label="Contagem do estoque disponível"
                  hint={
                    lot?.expiresAt && lot.expiresAt < dateKey()
                      ? 'Conte o saldo fora da segregação. O lote continua bloqueado por validade.'
                      : undefined
                  }
                >
                  <input
                    type="number"
                    min={0}
                    max={incoming.length > 0 && segmentedMatches ? lot?.quantity : undefined}
                    step={1}
                    required
                    value={counted}
                    onChange={(e) => setCounted(e.target.value)}
                  />
                </Field>
                <Field label="Contagem do estoque segregado">
                  <input
                    type="number"
                    min={0}
                    step={1}
                    required
                    value={segregated}
                    onChange={(e) => setSegregated(e.target.value)}
                  />
                </Field>
                {lot &&
                segregated !== '' &&
                Number(segregated) !== (lot.segregatedQuantity ?? 0) ? (
                  <Notice tone="amber">
                    Há divergência no segregado. Esta contagem ficará registrada para nova
                    conferência, com os dois saldos preservados.
                  </Notice>
                ) : (
                  lot &&
                  counted !== '' &&
                  segregated !== '' &&
                  !blockedIncrease && (
                    <Notice>
                      O saldo fora da segregação passará de {lot.quantity} para {Number(counted)}{' '}
                      {unit}. A contagem anterior ficará no histórico.
                    </Notice>
                  )
                )}
              </>
            ) : (
              <Field
                label={kind === 'shipment' ? 'Quantidade a expedir' : 'Quantidade a destinar'}
                hint={lot ? 'Unidade de contagem · ' + unit : undefined}
              >
                <input
                  key={lotId}
                  type="number"
                  name="quantity"
                  min={1}
                  max={kind === 'shipment' ? lot?.quantity : lot?.segregatedQuantity}
                  step={1}
                  required
                />
              </Field>
            )}
            {kind === 'disposal' && (
              <Field
                label="Destino do material"
                hint="Identifique quem recebeu ou o local de destinação informado no comprovante."
              >
                <input name="destination" required maxLength={200} />
              </Field>
            )}
            <Field label="Motivo">
              <textarea name="reason" rows={2} maxLength={500} required />
            </Field>
            <Field
              label="Referência do comprovante"
              hint="Use uma referência fictícia para localizar o documento da operação."
            >
              <input name="reference" required maxLength={200} />
            </Field>
          </div>
          {repository.getRevision() !== initial.revision && (
            <Notice tone="amber">
              Os dados mudaram desde a abertura. Feche e reabra a conferência para usar os saldos
              atuais.
            </Notice>
          )}
          <label className="document-check">
            <input
              type="checkbox"
              checked={confirmed}
              required
              onChange={(e) => setConfirmed(e.target.checked)}
            />
            {kind === 'shipment'
              ? 'Conferi o lote, a quantidade e a unidade de destino.'
              : kind === 'disposal'
                ? 'Conferi o lote, a quantidade e o comprovante da destinação realizada.'
                : 'Conferi as quantidades físicas nos dois compartimentos.'}
          </label>
        </ActionForm>
      )}
    </Modal>
  );
}

function ReceiveTransfer({ shipment, onClose }: { shipment: Shipment; onClose: () => void }) {
  const { context, data, repository, notify } = useApp();
  const [initial] = useState(() => ({
    revision: repository.getRevision(),
    received: data.stockLogistics
      .filter((e): e is Receipt => e.kind === 'receipt' && e.shipmentId === shipment.id)
      .reduce((n, r) => n + r.quantity, 0),
    requestId: crypto.randomUUID(),
  }));
  const expired = shipment.expiresAt < dateKey();
  const unitName = (id: string) => data.units.find((u) => u.id === id)?.name ?? id;
  return (
    <Modal
      title="Receber transferência"
      description={unitName(shipment.unitId) + ' → ' + unitName(shipment.toUnitId)}
      onClose={onClose}
    >
      <ActionForm
        onClose={onClose}
        submitLabel="Confirmar recebimento"
        onSubmit={async (f) => {
          await repository.execute(
            context,
            {
              type: 'stock.receive',
              quantity: Number(valueOf(f, 'quantity')),
              expectedReceived: initial.received,
              shipmentId: shipment.id,
              reference: valueOf(f, 'reference'),
              requestId: initial.requestId,
            },
            initial.revision,
          );
          notify('Recebimento registrado no estoque da unidade.');
        }}
      >
        <div className="pharmacy-adjustment-balance">
          <strong>
            {shipment.product} · lote {shipment.lot}
          </strong>
          <span>{shipment.presentation}</span>
          <span>
            {shipment.quantity} {shipment.quantityUnit} · validade {shortDate(shipment.expiresAt)}
          </span>
          <span>
            Expedição · {shipment.reference} · {when(shipment.at)}
          </span>
        </div>
        {expired && (
          <Notice tone="amber">
            O lote venceu durante o trânsito. Esta parcela será registrada em segregação.
          </Notice>
        )}
        <p className="pharmacy-note">
          Informe somente o que chegou nesta conferência. O restante continua em trânsito.
        </p>
        <Field
          label="Quantidade recebida nesta parcela"
          hint={
            'Em trânsito: ' + (shipment.quantity - initial.received) + ' ' + shipment.quantityUnit
          }
        >
          <input
            name="quantity"
            type="number"
            required
            min={1}
            max={shipment.quantity - initial.received}
            step={1}
            defaultValue={shipment.quantity - initial.received}
          />
        </Field>
        <Field label="Referência do comprovante">
          <input name="reference" required maxLength={200} />
        </Field>
        <label className="document-check">
          <input type="checkbox" required />
          Conferi fisicamente o lote, a validade e a quantidade recebida nesta parcela.
        </label>
        {repository.getRevision() !== initial.revision && (
          <Notice tone="amber">
            Os dados mudaram desde a abertura. Feche e reabra a conferência.
          </Notice>
        )}
      </ActionForm>
    </Modal>
  );
}
