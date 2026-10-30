import type { Patient, PatientRegistration } from '../domain/model';
import { useApp } from '../app/context';
import { dateKey, shortDate, clockTime } from '../domain/dates';
import { formatCpf } from '../domain/identification';
import { ActionForm, Field, Modal, valueOf } from './ui';

export const registrationLabels: Record<keyof PatientRegistration, string> = {
  name: 'Nome civil',
  socialName: 'Nome social',
  birthDate: 'Nascimento',
  phone: 'Telefone',
  cpf: 'CPF',
};
export function PatientRegistrationForm({
  patient,
  onClose,
}: {
  patient?: Patient;
  onClose: () => void;
}) {
  const { repository, context, notify } = useApp();
  return (
    <Modal
      title={patient ? 'Atualizar cadastro' : 'Cadastrar pessoa'}
      description={
        patient
          ? 'As alterações ficam registradas com motivo, autoria e valores anteriores.'
          : 'Use apenas informações fictícias neste ambiente.'
      }
      onClose={onClose}
    >
      <ActionForm
        onClose={onClose}
        submitLabel={patient ? 'Salvar atualização' : 'Criar cadastro'}
        onSubmit={async (f) => {
          const values = {
            name: valueOf(f, 'name'),
            socialName: valueOf(f, 'socialName'),
            birthDate: valueOf(f, 'birthDate'),
            phone: valueOf(f, 'phone'),
            cpf: valueOf(f, 'cpf'),
          };
          await repository.execute(
            context,
            patient
              ? {
                  type: 'patient.update',
                  id: patient.id,
                  values,
                  reason: valueOf(f, 'reason'),
                  expectedChangeCount: patient.changes?.length ?? 0,
                }
              : { type: 'patient.create', ...values },
          );
          notify(
            patient
              ? 'Cadastro atualizado. Os valores anteriores foram preservados.'
              : 'Cadastro criado na rede selecionada.',
          );
        }}
      >
        <section className="registration-form-section">
          <h3>
            <span>01</span> Identificação da pessoa
          </h3>
          <Field label="Nome completo">
            <input
              name="name"
              required
              maxLength={120}
              autoComplete="off"
              defaultValue={patient?.name}
              placeholder="Nome da pessoa fictícia"
            />
          </Field>
          <Field label="Nome social (opcional)">
            <input
              name="socialName"
              maxLength={120}
              autoComplete="off"
              defaultValue={patient?.socialName}
            />
          </Field>
          <div className="form-grid">
            <Field
              label="CPF (opcional)"
              hint="Quem não tiver CPF pode se identificar pelo nome e nascimento."
            >
              <input
                name="cpf"
                inputMode="numeric"
                autoComplete="off"
                maxLength={14}
                defaultValue={formatCpf(patient?.cpf ?? '')}
                placeholder="000.000.000-00"
              />
            </Field>
            <Field label="Data de nascimento">
              <input
                name="birthDate"
                type="date"
                required
                min="1850-01-01"
                max={dateKey()}
                defaultValue={patient?.birthDate}
              />
            </Field>
          </div>
        </section>
        <section className="registration-form-section">
          <h3>
            <span>02</span> Contato
          </h3>
          <Field label="Telefone (opcional)">
            <input
              name="phone"
              maxLength={30}
              autoComplete="off"
              defaultValue={patient?.phone}
              placeholder="Contato de demonstração"
            />
          </Field>
        </section>
        {patient && (
          <Field
            label="Motivo da atualização"
            hint="Atualiza o cadastro atual. Documentos já emitidos mantêm sua identificação original."
          >
            <textarea name="reason" required maxLength={1000} rows={3} />
          </Field>
        )}
      </ActionForm>
    </Modal>
  );
}
export function RegistrationHistory({ patient }: { patient: Patient }) {
  const { data } = useApp();
  const changes = patient.changes ?? [];
  const display = (key: keyof PatientRegistration, value: string) =>
    !value
      ? 'Não informado'
      : key === 'cpf'
        ? formatCpf(value)
        : key === 'birthDate'
          ? shortDate(value)
          : value;
  return changes.length ? (
    <div className="registration-history">
      {[...changes].reverse().map((h, index) => (
        <article key={changes.length - index}>
          <div className="record-change-heading">
            <strong>Atualização {changes.length - index}</strong>
            <time>
              {shortDate(h.at)} · {clockTime(h.at)}
            </time>
          </div>
          <p>
            {h.author} · {data.units.find((u) => u.id === h.unitId)?.name}
          </p>
          <p>
            <strong>Motivo:</strong> {h.reason}
          </p>
          <dl>
            {(Object.keys(registrationLabels) as (keyof PatientRegistration)[])
              .filter((key) => h.before[key] !== h.after[key])
              .map((key) => (
                <div key={key}>
                  <dt>{registrationLabels[key]}</dt>
                  <dd>
                    <span>Antes: {display(key, h.before[key])}</span>
                    <strong>Depois: {display(key, h.after[key])}</strong>
                  </dd>
                </div>
              ))}
          </dl>
        </article>
      ))}
    </div>
  ) : (
    <p className="panel-empty">
      Nenhuma atualização registrada. Alterações feitas a partir desta versão aparecem aqui.
    </p>
  );
}
