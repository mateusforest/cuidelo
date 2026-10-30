import { PharmacyDispensing } from '../components/PharmacyDispensing';
import { StockMedicationForm } from '../components/StockMedicationForm';
import type { MedicationLine } from '../domain/clinical-documents';
import { useState } from 'react';
import { ArrowDownToLine, ArrowUpFromLine, Package, AlertTriangle } from 'lucide-react';
import { useApp } from '../app/context';
import type { StockLot } from '../domain/model';
import { addDays, dateKey, shortDate } from '../domain/dates';
import {
  ActionForm,
  Badge,
  Button,
  EmptyState,
  Field,
  Modal,
  Notice,
  PageHeader,
  Panel,
  SearchField,
  UnitRequired,
  valueOf,
} from '../components/ui';

export function Pharmacy() {
  const { data, context, repository, notify } = useApp();
  const [search, setSearch] = useState(''),
    [attention, setAttention] = useState(false),
    [movement, setMovement] = useState<{ lot: StockLot; kind: 'entry' | 'exit' } | null>(null);
  const [stockForm, setStockForm] = useState<{ lot?: StockLot; item?: MedicationLine } | null>(
    null,
  );
  const today = dateKey(),
    alert = (l: StockLot) => l.quantity < l.minimum || l.expiresAt <= addDays(today, 30);
  const lots = data.lots.filter(
    (l) =>
      `${l.product} ${l.lot}`
        .toLocaleLowerCase('pt-BR')
        .includes(search.toLocaleLowerCase('pt-BR')) &&
      (!attention || alert(l)),
  );
  return (
    <>
      <PageHeader
        eyebrow="SUPRIMENTOS E RASTREABILIDADE"
        title="Farmácia e estoque"
        description="Receitas, entregas e movimentações por lote, vinculadas à sua unidade."
        action={<Button onClick={() => setStockForm({})}>Novo lote de medicamento</Button>}
      />
      <UnitRequired>
        {context.role === 'pharmacy' && (
          <PharmacyDispensing onRegisterLot={(item) => setStockForm({ item })} />
        )}
        <div className="inventory-summary">
          <div>
            <Package size={22} />
            <span>
              <strong>{data.lots.length}</strong> lotes cadastrados
            </span>
          </div>
          <div>
            <AlertTriangle size={22} />
            <span>
              <strong>{data.lots.filter(alert).length}</strong> lotes precisam de atenção
            </span>
          </div>
        </div>
        <Panel
          title="Estoque por lote"
          subtitle="Para entregar uma receita à pessoa, use a conferência acima. Saídas avulsas não quitam receitas."
        >
          <div className="table-toolbar">
            <SearchField value={search} onChange={setSearch} placeholder="Buscar produto ou lote" />
            <label className="check-label">
              <input
                type="checkbox"
                checked={attention}
                onChange={(e) => setAttention(e.target.checked)}
              />
              Somente pendências
            </label>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Produto</th>
                  <th>Lote</th>
                  <th>Validade</th>
                  <th>Saldo</th>
                  <th>Movimentar</th>
                </tr>
              </thead>
              <tbody>
                {lots.map((l) => {
                  const expired = l.expiresAt < today;
                  return (
                    <tr key={l.id}>
                      <td>
                        <strong>{l.product}</strong>
                        <small className="cell-secondary">
                          {l.medication
                            ? `${l.medication.strength} · ${l.medication.form}`
                            : l.presentation}
                        </small>
                        {l.medication ? (
                          <small className="cell-secondary">
                            Unidade de entrega: {l.medication.quantityUnit}
                          </small>
                        ) : (
                          <div className="stock-identity-help">
                            Apresentação ainda não identificada para receita.
                            <br />
                            <button
                              className="text-button"
                              onClick={() => setStockForm({ lot: l })}
                            >
                              Identificar lote {l.lot}
                            </button>
                          </div>
                        )}
                      </td>
                      <td className="record-number">{l.lot}</td>
                      <td>
                        {shortDate(l.expiresAt)}
                        {expired ? (
                          <small className="cell-secondary">
                            <Badge tone="red">Vencido · uso bloqueado</Badge>
                          </small>
                        ) : l.expiresAt <= addDays(today, 30) ? (
                          <small className="cell-secondary">
                            <Badge tone="amber">Validade próxima</Badge>
                          </small>
                        ) : null}
                      </td>
                      <td>
                        <strong className={l.quantity < l.minimum ? 'warning-text' : ''}>
                          {l.quantity}
                        </strong>
                        <small className="cell-secondary">Mínimo de referência: {l.minimum}</small>
                      </td>
                      <td>
                        <div className="row-actions">
                          <Button
                            variant="secondary"
                            onClick={() => setMovement({ lot: l, kind: 'entry' })}
                            aria-label={`Entrada de ${l.product}`}
                            disabled={expired}
                          >
                            <ArrowDownToLine size={16} />
                            Entrada
                          </Button>
                          <Button
                            variant="secondary"
                            onClick={() => setMovement({ lot: l, kind: 'exit' })}
                            aria-label={`Saída de ${l.product}`}
                            disabled={expired || l.quantity === 0}
                          >
                            <ArrowUpFromLine size={16} />
                            Saída
                          </Button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {!lots.length && (
            <EmptyState
              title="Nenhum lote encontrado"
              description="Altere os filtros para consultar o estoque desta unidade."
            />
          )}
        </Panel>
        <Notice>
          Lotes vencidos permanecem visíveis para segregação e não podem ser entregues. Entregas
          confirmadas preservam os movimentos; devoluções, perdas e estornos vinculados ainda
          precisam de fluxo próprio.
        </Notice>
        <Panel title="Últimas movimentações">
          {data.movements.length ? (
            <div className="compact-list">
              {[...data.movements]
                .reverse()
                .slice(0, 8)
                .map((m) => (
                  <div key={m.id}>
                    <span className={`movement-icon ${m.kind}`}>
                      {m.kind === 'entry' ? (
                        <ArrowDownToLine size={18} />
                      ) : (
                        <ArrowUpFromLine size={18} />
                      )}
                    </span>
                    <div>
                      <strong>
                        {data.lots.find((l) => l.id === m.lotId)?.product} ·{' '}
                        {m.kind === 'entry' ? '+' : '−'}
                        {m.quantity}
                      </strong>
                      <small>
                        {shortDate(m.at)} · {m.reason}
                      </small>
                    </div>
                  </div>
                ))}
            </div>
          ) : (
            <p className="panel-empty">As entradas e saídas registradas aparecerão aqui.</p>
          )}
        </Panel>
      </UnitRequired>
      {stockForm && <StockMedicationForm {...stockForm} onClose={() => setStockForm(null)} />}
      {movement && (
        <Modal
          title={`${movement.kind === 'entry' ? 'Entrada' : 'Saída'} de estoque`}
          description={`${movement.lot.product} · ${movement.lot.lot} · saldo ${movement.lot.quantity}`}
          onClose={() => setMovement(null)}
        >
          <ActionForm
            onClose={() => setMovement(null)}
            submitLabel="Registrar movimento"
            onSubmit={async (f) => {
              await repository.execute(context, {
                type: 'stock.move',
                id: movement.lot.id,
                kind: movement.kind,
                quantity: Number(valueOf(f, 'quantity')),
                reason: valueOf(f, 'reason'),
              });
              notify('Movimentação registrada e saldo atualizado.');
            }}
          >
            <Field label="Quantidade">
              <input
                type="number"
                name="quantity"
                min="1"
                step="1"
                max={movement.kind === 'exit' ? movement.lot.quantity : 1000000}
                required
              />
            </Field>
            <Field label="Motivo e referência">
              <textarea
                name="reason"
                required
                rows={3}
                maxLength={2000}
                placeholder="Ex.: reposição de demonstração para o setor"
              />
            </Field>
          </ActionForm>
        </Modal>
      )}
    </>
  );
}
