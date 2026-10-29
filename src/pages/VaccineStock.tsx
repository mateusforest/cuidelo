import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Package, Syringe } from 'lucide-react';
import { useApp } from '../app/context';
import { can, type VaccineLot } from '../domain/model';
import { dateKey, shortDate, addDays } from '../domain/dates';
import {
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
import { VaccineForm } from '../components/VaccineForms';

const movementNames = {
  receipt: 'Recebimento',
  application: 'Aplicação',
  loss: 'Perda / descarte',
  quarantine: 'Quarentena',
  release: 'Liberação',
};
export function VaccineStock() {
  const { data, context, repository, notify } = useApp();
  const [search, setSearch] = useState(''),
    [filter, setFilter] = useState('all'),
    [create, setCreate] = useState(false),
    [selected, setSelected] = useState<VaccineLot | null>(null);
  const today = dateKey(),
    available = (l: VaccineLot) =>
      l.status === 'available' && l.expiresAt >= today && l.quantity > 0;
  const list = data.vaccineLots.filter(
    (l) =>
      `${l.immunobiological} ${l.batch} ${l.manufacturer}`
        .toLocaleLowerCase('pt-BR')
        .includes(search.toLocaleLowerCase('pt-BR')) &&
      (filter === 'all' ||
        (filter === 'available' ? available(l) : l.status === 'quarantine' || l.expiresAt < today)),
  );
  return (
    <>
      <PageHeader
        eyebrow="SALA DE VACINA · ESTOQUE EM DOSES"
        title="Lotes de imunobiológicos"
        description="Acompanhe recebimentos, aplicações, perdas e bloqueios de cada lote."
        action={
          <div className="row-actions">
            {can(context.role, 'vaccination') && (
              <Link className="button secondary" to="/vacinacao">
                <Syringe size={17} />
                Sala de vacinação
              </Link>
            )}
            <Button disabled={context.unitId === 'all'} onClick={() => setCreate(true)}>
              <Plus size={17} />
              Cadastrar lote
            </Button>
          </div>
        }
      />
      <UnitRequired>
        <div className="vaccine-metrics">
          <div>
            <Package size={21} />
            <span>Lotes na unidade</span>
            <strong>{data.vaccineLots.length}</strong>
          </div>
          <div>
            <span>Doses disponíveis</span>
            <strong>
              {data.vaccineLots.filter(available).reduce((sum, l) => sum + l.quantity, 0)}
            </strong>
          </div>
          <div>
            <span>Lotes em quarentena</span>
            <strong>{data.vaccineLots.filter((l) => l.status === 'quarantine').length}</strong>
          </div>
          <div>
            <span>Lotes vencidos com saldo</span>
            <strong>
              {data.vaccineLots.filter((l) => l.expiresAt < today && l.quantity > 0).length}
            </strong>
          </div>
        </div>
        <Panel
          title="Rastreabilidade por lote"
          subtitle="Saldo expresso em doses, separado do estoque geral da farmácia."
        >
          <div className="table-toolbar">
            <SearchField
              value={search}
              onChange={setSearch}
              placeholder="Buscar imunobiológico, lote ou fabricante"
            />
            <Field label="Filtrar lotes">
              <select value={filter} onChange={(e) => setFilter(e.target.value)}>
                <option value="all">Todos os lotes</option>
                <option value="available">Disponíveis para aplicação</option>
                <option value="blocked">Vencidos ou em quarentena</option>
              </select>
            </Field>
          </div>
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Imunobiológico</th>
                  <th>Lote / validade</th>
                  <th>Saldo</th>
                  <th>Situação</th>
                  <th>Ação</th>
                </tr>
              </thead>
              <tbody>
                {list.map((l) => (
                  <tr key={l.id}>
                    <td>
                      <strong>{l.immunobiological}</strong>
                      <small className="cell-secondary">{l.manufacturer}</small>
                    </td>
                    <td>
                      <span className="record-number">{l.batch}</span>
                      <small className="cell-secondary">{shortDate(l.expiresAt)}</small>
                    </td>
                    <td>
                      <strong>{l.quantity} doses</strong>
                    </td>
                    <td>
                      <Badge
                        tone={
                          l.expiresAt < today
                            ? 'red'
                            : l.status === 'quarantine'
                              ? 'amber'
                              : 'green'
                        }
                      >
                        {l.expiresAt < today
                          ? 'Vencido'
                          : l.status === 'quarantine'
                            ? 'Quarentena'
                            : 'Disponível'}
                      </Badge>
                      {l.expiresAt >= today && l.expiresAt <= addDays(today, 30) && (
                        <small className="cell-secondary">Validade nos próximos 30 dias</small>
                      )}
                    </td>
                    <td>
                      <Button variant="secondary" onClick={() => setSelected(l)}>
                        Movimentar lote
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!list.length && (
            <EmptyState
              title="Nenhum lote neste filtro"
              description="Cadastre um lote fictício ou ajuste a busca para continuar."
            />
          )}
        </Panel>
        <Notice>
          A quarentena bloqueia aplicações até uma liberação justificada. Este controle manual não
          substitui sensores, avaliação de conservação, controle de frascos abertos ou a gestão
          completa da rede de frio.
        </Notice>
        <Panel
          title="Movimentações do estoque"
          subtitle="Aplicações baixam uma dose. Perdas e recebimentos exigem justificativa."
        >
          <div className="table-scroll">
            <table>
              <thead>
                <tr>
                  <th>Data</th>
                  <th>Lote</th>
                  <th>Movimento</th>
                  <th>Doses</th>
                  <th>Motivo / registro</th>
                </tr>
              </thead>
              <tbody>
                {[...data.vaccineMovements].reverse().map((m) => (
                  <tr key={m.id}>
                    <td>{shortDate(m.recordedAt)}</td>
                    <td>{data.vaccineLots.find((l) => l.id === m.lotId)?.batch}</td>
                    <td>{movementNames[m.kind]}</td>
                    <td>
                      {m.kind === 'receipt'
                        ? '+'
                        : m.kind === 'application' || m.kind === 'loss'
                          ? '−'
                          : ''}
                      {m.quantity || '—'}
                    </td>
                    <td>
                      {m.reason}
                      <small className="cell-secondary">{m.author}</small>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!data.vaccineMovements.length && (
            <p className="panel-empty">Nenhuma movimentação registrada.</p>
          )}
        </Panel>
      </UnitRequired>
      {create && (
        <VaccineForm
          title="Cadastrar lote de imunobiológico"
          description="Use dados fictícios. O recebimento inicial ficará no histórico."
          submitLabel="Cadastrar lote e recebimento"
          onClose={() => setCreate(false)}
          onSubmit={async (f) => {
            await repository.execute(context, {
              type: 'vaccine.lot.create',
              immunobiological: valueOf(f, 'immunobiological'),
              manufacturer: valueOf(f, 'manufacturer'),
              batch: valueOf(f, 'batch'),
              expiresAt: valueOf(f, 'expiresAt'),
              quantity: Number(valueOf(f, 'quantity')),
            });
            notify('Lote cadastrado com recebimento inicial.');
          }}
        >
          <Field label="Imunobiológico">
            <input
              name="immunobiological"
              required
              maxLength={160}
              placeholder="Imunizante fictício para demonstração"
            />
          </Field>
          <Field label="Fabricante">
            <input name="manufacturer" required maxLength={160} />
          </Field>
          <div className="form-grid">
            <Field label="Número do lote">
              <input name="batch" required maxLength={80} />
            </Field>
            <Field label="Validade do lote">
              <input name="expiresAt" type="date" required min={today} />
            </Field>
          </div>
          <Field label="Quantidade recebida (doses)">
            <input name="quantity" type="number" required min={1} max={1000000} step={1} />
          </Field>
        </VaccineForm>
      )}
      {selected && <StockMovementForm lot={selected} onClose={() => setSelected(null)} />}
    </>
  );
}
function StockMovementForm({ lot, onClose }: { lot: VaccineLot; onClose: () => void }) {
  const { context, repository, notify } = useApp();
  const expired = lot.expiresAt < dateKey();
  const [kind, setKind] = useState<'receipt' | 'loss' | 'quarantine' | 'release'>(
    expired ? 'loss' : 'receipt',
  );
  return (
    <VaccineForm
      title="Movimentar lote de vacina"
      description={`${lot.immunobiological} · ${lot.batch} · ${lot.quantity} doses`}
      submitLabel="Registrar movimentação"
      onClose={onClose}
      onSubmit={async (f) => {
        await repository.execute(context, {
          type: 'vaccine.stock',
          lotId: lot.id,
          kind,
          quantity: Number(valueOf(f, 'quantity')),
          reason: valueOf(f, 'reason'),
        });
        notify('Movimentação registrada. Estoque atualizado.');
      }}
    >
      <Field label="Tipo de movimentação">
        <select value={kind} onChange={(e) => setKind(e.target.value as typeof kind)}>
          <option value="receipt" disabled={expired}>
            Recebimento de doses
          </option>
          <option value="loss">Perda / descarte</option>
          <option value="quarantine" disabled={lot.status === 'quarantine'}>
            Colocar em quarentena
          </option>
          <option value="release" disabled={expired || lot.status !== 'quarantine'}>
            Liberar da quarentena
          </option>
        </select>
      </Field>
      {(kind === 'receipt' || kind === 'loss') && (
        <Field label="Quantidade de doses">
          <input
            name="quantity"
            type="number"
            min={1}
            max={kind === 'loss' ? lot.quantity : 1000000}
            step={1}
            required
          />
        </Field>
      )}
      <Field label="Justificativa da movimentação">
        <textarea name="reason" required maxLength={1000} rows={3} />
      </Field>
      <Notice>
        {kind === 'quarantine'
          ? 'Novas aplicações deste lote ficarão bloqueadas.'
          : kind === 'release'
            ? 'A liberação deve ser informada pelo responsável após avaliar o lote; não há avaliação automática de conservação.'
            : kind === 'loss'
              ? 'O saldo será reduzido. A perda ficará registrada com a justificativa.'
              : 'O recebimento aumenta o saldo deste lote. Confira os dados e a quantidade informada.'}
      </Notice>
    </VaccineForm>
  );
}
