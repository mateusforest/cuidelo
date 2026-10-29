import { useEffect, useState, type ReactNode } from 'react';
import { useApp } from '../app/context';
import { ActionForm, Field, Modal, Notice, valueOf } from './ui';
import type { Command, VaccineRecall } from '../domain/model';
import { dateKey, shortDate } from '../domain/dates';

export function VaccineForm({
  title,
  description,
  submitLabel,
  children,
  onClose,
  onSubmit,
}: {
  title: string;
  description: string;
  submitLabel: string;
  children: ReactNode;
  onClose: () => void;
  onSubmit: (data: FormData) => Promise<void>;
}) {
  const [dirty, markDirty] = useState(false),
    [busy, setBusy] = useState(false);
  const { setDirty } = useApp();
  useEffect(() => {
    setDirty(dirty);
    return () => setDirty(false);
  }, [dirty, setDirty]);
  const close = () => {
    if (
      !busy &&
      (!dirty || window.confirm('Descartar as informações não salvas deste formulário?'))
    ) {
      setDirty(false);
      onClose();
    }
  };
  return (
    <Modal title={title} description={description} onClose={close} wide>
      <div className="vaccine-form" onChange={() => markDirty(true)}>
        <ActionForm
          submitLabel={submitLabel}
          onClose={() => {
            setDirty(false);
            onClose();
          }}
          onCancel={close}
          onSubmit={async (data) => {
            setBusy(true);
            try {
              await onSubmit(data);
              markDirty(false);
            } finally {
              setBusy(false);
            }
          }}
        >
          {children}
        </ActionForm>
      </div>
    </Modal>
  );
}

export function VaccinationRecordForm({
  patientId,
  source,
  recall,
  onClose,
}: {
  patientId: string;
  source: 'administered' | 'transcribed';
  recall?: VaccineRecall;
  onClose: () => void;
}) {
  const { data, context, repository, notify } = useApp();
  const p = data.patients.find((p) => p.id === patientId)!;
  const today = dateKey(),
    local = source === 'administered';
  const [lotId, setLotId] = useState('');
  const lot = data.vaccineLots.find((l) => l.id === lotId);
  return (
    <VaccineForm
      title={local ? 'Registrar aplicação' : 'Transcrever caderneta'}
      description={`${p.socialName || p.name} · ${p.record} · dados fictícios`}
      submitLabel={local ? 'Salvar aplicação e baixar 1 dose' : 'Salvar transcrição'}
      onClose={onClose}
      onSubmit={async (f) => {
        const cmd: Command = {
          type: 'vaccine.record',
          patientId,
          source,
          lotId,
          immunobiological: valueOf(f, 'immunobiological'),
          batch: valueOf(f, 'batch'),
          manufacturer: valueOf(f, 'manufacturer'),
          dose: recall?.dose ?? valueOf(f, 'dose'),
          date: local ? today : valueOf(f, 'date'),
          route: valueOf(f, 'route'),
          site: valueOf(f, 'site'),
          strategy: valueOf(f, 'strategy'),
          group: valueOf(f, 'group'),
          professional: valueOf(f, 'professional'),
          institution: valueOf(f, 'institution'),
          observations: valueOf(f, 'observations'),
          ...(recall ? { recallId: recall.id } : {}),
        };
        await repository.execute(context, cmd);
        notify(
          local
            ? 'Aplicação salva e uma dose baixada do lote.'
            : 'Histórico transcrito, sem movimentar o estoque.',
        );
      }}
    >
      {recall && (
        <Notice>
          Retorno vinculado: {recall.immunobiological} · {recall.dose} · previsto para{' '}
          {shortDate(recall.date)}.
        </Notice>
      )}
      {local ? (
        <>
          <Field
            label="Lote para aplicação"
            hint="Somente lotes disponíveis, dentro da validade e com saldo podem ser usados."
          >
            <select name="lotId" value={lotId} onChange={(e) => setLotId(e.target.value)} required>
              <option value="">Selecione o imunobiológico e o lote</option>
              {data.vaccineLots
                .filter(
                  (l) =>
                    !recall ||
                    l.immunobiological.toLocaleLowerCase('pt-BR') ===
                      recall.immunobiological.toLocaleLowerCase('pt-BR'),
                )
                .map((l) => (
                  <option
                    key={l.id}
                    value={l.id}
                    disabled={l.status === 'quarantine' || l.expiresAt < today || l.quantity < 1}
                  >
                    {l.immunobiological} · {l.batch} · {l.quantity} doses
                    {l.status === 'quarantine'
                      ? ' · Quarentena'
                      : l.expiresAt < today
                        ? ' · Vencido'
                        : ''}
                  </option>
                ))}
            </select>
          </Field>
          {lot && (
            <Notice>
              {lot.manufacturer} · validade {shortDate(lot.expiresAt)} · saldo atual: {lot.quantity}{' '}
              doses.
            </Notice>
          )}
        </>
      ) : (
        <>
          <Field label="Imunobiológico informado">
            <input
              name="immunobiological"
              required
              maxLength={160}
              placeholder="Copie a identificação do comprovante fictício"
            />
          </Field>
          <div className="form-grid">
            <Field label="Lote do comprovante (opcional)">
              <input name="batch" maxLength={80} />
            </Field>
            <Field label="Fabricante do comprovante (opcional)">
              <input name="manufacturer" maxLength={160} />
            </Field>
          </div>
          <Field label="Origem do comprovante">
            <input
              name="institution"
              required
              maxLength={160}
              placeholder="Serviço ou documento fictício consultado"
            />
          </Field>
        </>
      )}
      <div className="form-grid">
        <Field
          label="Dose registrada"
          hint="Conforme avaliação e indicação do profissional. Sem sugestão automática."
        >
          <input
            name="dose"
            required
            maxLength={80}
            readOnly={!!recall}
            defaultValue={recall?.dose ?? ''}
            placeholder="Identificação da dose no registro"
          />
        </Field>
        <Field label="Data da aplicação">
          <input
            name="date"
            type="date"
            required
            defaultValue={today}
            min={p.birthDate}
            max={today}
            readOnly={local}
          />
        </Field>
      </div>
      {local && (
        <>
          <div className="form-grid">
            <Field label="Via de administração">
              <select name="route" required defaultValue="">
                <option value="">Selecione</option>
                {[
                  'Intramuscular',
                  'Subcutânea',
                  'Intradérmica',
                  'Oral',
                  'Outra, conforme registro',
                ].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </Field>
            <Field label="Local de aplicação">
              <input name="site" required maxLength={120} placeholder="Local anatômico informado" />
            </Field>
          </div>
          <div className="form-grid">
            <Field label="Estratégia registrada">
              <select name="strategy" required defaultValue="">
                <option value="">Selecione</option>
                {['Rotina', 'Campanha', 'Bloqueio', 'Outra estratégia informada'].map((r) => (
                  <option key={r}>{r}</option>
                ))}
              </select>
            </Field>
            <Field label="Grupo de atendimento">
              <input name="group" required maxLength={160} />
            </Field>
          </div>
          <Field
            label="Vacinador informado (fictício)"
            hint="A identificação será vinculada ao profissional autenticado na versão operacional."
          >
            <input name="professional" required maxLength={160} />
          </Field>
        </>
      )}
      <Field label="Observações (opcional)">
        <textarea name="observations" maxLength={2000} rows={3} />
      </Field>
      <Notice>
        {local
          ? 'Este registro consome uma dose no estoque de demonstração. A escolha da vacina, dose, via e local depende do profissional.'
          : 'A transcrição compõe o histórico. Não conta como uma aplicação realizada nesta unidade e não baixa estoque.'}{' '}
        Nenhum registro é transmitido ao SUS nesta versão.
      </Notice>
    </VaccineForm>
  );
}

export function VaccineRecallForm({
  patientId,
  existing,
  action,
  onClose,
}: {
  patientId: string;
  existing?: VaccineRecall;
  action?: 'reschedule' | 'cancel';
  onClose: () => void;
}) {
  const { data, context, repository, notify } = useApp();
  const p = data.patients.find((p) => p.id === patientId)!;
  return (
    <VaccineForm
      title={
        existing
          ? action === 'cancel'
            ? 'Cancelar aprazamento'
            : 'Reagendar retorno'
          : 'Aprazar retorno'
      }
      description={`${p.socialName || p.name} · data definida pelo profissional`}
      submitLabel={action === 'cancel' ? 'Confirmar cancelamento' : 'Salvar aprazamento'}
      onClose={onClose}
      onSubmit={async (f) => {
        await repository.execute(
          context,
          existing
            ? {
                type: 'vaccine.recall.update',
                id: existing.id,
                action: action!,
                date: valueOf(f, 'date'),
                reason: valueOf(f, 'reason'),
              }
            : {
                type: 'vaccine.recall.create',
                patientId,
                immunobiological: valueOf(f, 'immunobiological'),
                dose: valueOf(f, 'dose'),
                date: valueOf(f, 'date'),
                reason: valueOf(f, 'reason'),
              },
        );
        notify(
          action === 'cancel'
            ? 'Aprazamento cancelado com histórico preservado.'
            : 'Retorno registrado na unidade.',
        );
      }}
    >
      {existing ? (
        <Notice>
          {existing.immunobiological} · {existing.dose} · {shortDate(existing.date)}
        </Notice>
      ) : (
        <>
          <Field label="Imunobiológico do retorno">
            <input
              name="immunobiological"
              list="recall-immunobiological"
              required
              maxLength={160}
            />
          </Field>
          <datalist id="recall-immunobiological">
            {[...new Set(data.vaccineLots.map((l) => l.immunobiological))].map((name) => (
              <option key={name} value={name} />
            ))}
          </datalist>
          <Field label="Dose prevista">
            <input name="dose" required maxLength={80} />
          </Field>
        </>
      )}
      {action !== 'cancel' && (
        <Field
          label="Data do retorno"
          hint="Aprazamento manual; não representa validação do calendário vacinal."
        >
          <input
            name="date"
            type="date"
            required
            min={dateKey()}
            defaultValue={existing?.date ?? ''}
          />
        </Field>
      )}
      <Field label={existing ? 'Motivo da alteração' : 'Orientação para o retorno'}>
        <textarea name="reason" required maxLength={1000} rows={3} />
      </Field>
    </VaccineForm>
  );
}
