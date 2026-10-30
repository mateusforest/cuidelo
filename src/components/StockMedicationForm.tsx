import { useApp } from '../app/context';
import type { StockLot } from '../domain/model';
import type { MedicationLine } from '../domain/clinical-documents';
import { dateKey } from '../domain/dates';
import { ActionForm, Field, Modal, Notice, valueOf } from './ui';

export function StockMedicationForm({
  lot,
  item,
  onClose,
}: {
  lot?: StockLot;
  item?: MedicationLine;
  onClose: () => void;
}) {
  const { context, repository, notify } = useApp();
  return (
    <Modal
      wide
      title={lot ? 'Identificar apresentação do lote' : 'Cadastrar lote de medicamento'}
      description={
        lot
          ? `${lot.product} · lote ${lot.lot} · descrição anterior: ${lot.presentation}`
          : 'Confira o produto e a unidade usada para contar o estoque.'
      }
      onClose={onClose}
    >
      <ActionForm
        onClose={onClose}
        submitLabel={lot ? 'Confirmar identificação' : 'Cadastrar lote'}
        onSubmit={async (f) => {
          const medication = {
            strength: valueOf(f, 'strength'),
            form: valueOf(f, 'form'),
            quantityUnit: valueOf(f, 'quantityUnit'),
          };
          if (lot)
            await repository.execute(context, {
              type: 'stock.identify',
              id: lot.id,
              medication,
              confirmed: f.get('confirmed') === 'on',
            });
          else
            await repository.execute(context, {
              type: 'stock.register',
              product: valueOf(f, 'product'),
              medication,
              lot: valueOf(f, 'lot'),
              expiresAt: valueOf(f, 'expiresAt'),
              quantity: Number(valueOf(f, 'quantity')),
              minimum: Number(valueOf(f, 'minimum')),
              reason: valueOf(f, 'reason'),
            });
          notify(
            lot
              ? 'Apresentação identificada. O saldo existente foi mantido.'
              : 'Lote cadastrado e saldo inicial registrado.',
          );
        }}
      >
        <Field label="Nome do medicamento no estoque">
          <input
            name="product"
            defaultValue={lot?.product ?? item?.medicine ?? ''}
            readOnly={!!lot}
            required
            maxLength={200}
          />
        </Field>
        <div className="form-grid">
          <Field label="Concentração no estoque">
            <input name="strength" defaultValue={item?.strength ?? ''} required maxLength={100} />
          </Field>
          <Field label="Apresentação no estoque">
            <input name="form" defaultValue={item?.form ?? ''} required maxLength={100} />
          </Field>
        </div>
        <Field label="Unidade de entrega do estoque">
          <input
            name="quantityUnit"
            defaultValue={item?.quantityUnit ?? ''}
            required
            maxLength={100}
            placeholder="Ex.: comprimido; use a mesma unidade da receita"
          />
        </Field>
        {lot ? (
          <>
            <Notice tone="amber">
              Esta identificação não converte o saldo {lot.quantity}. Confira se a unidade informada
              corresponde à forma como esse estoque já está contado. Depois de confirmada, a
              identificação deste lote fica preservada.
            </Notice>
            <label className="document-check">
              <input name="confirmed" type="checkbox" required />
              Conferi a apresentação e a unidade de contagem do saldo existente
            </label>
          </>
        ) : (
          <>
            <div className="form-grid">
              <Field label="Código do lote">
                <input name="lot" required maxLength={100} />
              </Field>
              <Field label="Validade do lote">
                <input name="expiresAt" type="date" min={dateKey()} required />
              </Field>
              <Field label="Quantidade inicial">
                <input
                  name="quantity"
                  type="number"
                  min="0"
                  step="1"
                  max="1000000"
                  defaultValue="0"
                  required
                />
              </Field>
              <Field label="Mínimo de referência">
                <input
                  name="minimum"
                  type="number"
                  min="0"
                  step="1"
                  max="1000000"
                  defaultValue="0"
                  required
                />
              </Field>
            </div>
            <Field label="Origem / referência do recebimento">
              <textarea name="reason" required maxLength={2000} />
            </Field>
            <Notice>
              A quantidade inicial gera uma entrada de estoque. O cadastro não valida equivalência
              entre medicamentos e não importa saldos externos.
            </Notice>
          </>
        )}
      </ActionForm>
    </Modal>
  );
}
