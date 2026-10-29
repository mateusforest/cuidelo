import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { ArrowLeft, CreditCard, HandHeart, Printer, Ticket, UserRound } from 'lucide-react';
import { useApp } from '../app/context';
import { Button, Field, Notice } from '../components/ui';
import { clockTime, dateKey, shortDate } from '../domain/dates';
import { formatCpf, kioskDemoExample } from '../domain/identification';
import { preferenceReasons, servicesForUnit, type PreferenceReason } from '../domain/kiosk-options';
import type { TicketReceipt } from '../domain/patient-flow';
import '../styles/kiosk.css';

type Mode = 'start' | 'cpf' | 'name' | 'guest';
function PriorityChoice({
  priority,
  onChange,
}: {
  priority: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <fieldset className="kiosk-priority">
      <legend>Tipo de atendimento</legend>
      <div className="kiosk-priority-options">
        <label className={!priority ? 'selected' : ''}>
          <input
            type="radio"
            name="priority"
            checked={!priority}
            onChange={() => onChange(false)}
            aria-label="Atendimento comum"
          />
          <span>
            <strong>Atendimento comum</strong>
            <small>Seguir o fluxo habitual da unidade</small>
          </span>
        </label>
        <label className={priority ? 'selected' : ''}>
          <input
            type="radio"
            name="priority"
            checked={priority}
            onChange={() => onChange(true)}
            aria-label="Atendimento preferencial"
          />
          <span>
            <strong>Atendimento preferencial</strong>
            <small>Solicitar preferência à recepção</small>
          </span>
          <HandHeart size={26} />
        </label>
      </div>
    </fieldset>
  );
}
export function Kiosk() {
  const { repository } = useApp(),
    [params] = useSearchParams();
  const org = params.get('rede') ?? '',
    unitId = params.get('unidade') ?? '';
  const unit = repository
    .directory()
    .units.find((u) => u.id === unitId && u.organizationId === org);
  const [mode, setMode] = useState<Mode>('start'),
    [receipt, setReceipt] = useState<TicketReceipt | null>(null),
    [identifier, setIdentifier] = useState(''),
    [birth, setBirth] = useState(''),
    [service, setService] = useState('Consulta'),
    [priority, setPriority] = useState(false),
    [reason, setReason] = useState<PreferenceReason>('reception'),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [help, setHelp] = useState(false);
  const requestId = useRef(crypto.randomUUID()),
    pending = useRef(false),
    activity = useRef(Date.now());
  const titleRef = useRef<HTMLHeadingElement>(null);
  const reset = () => {
    setMode('start');
    setReceipt(null);
    setIdentifier('');
    setBirth('');
    setService('Consulta');
    setPriority(false);
    setReason('reception');
    setError('');
    setHelp(false);
    requestId.current = crypto.randomUUID();
    activity.current = Date.now();
  };
  useEffect(() => {
    reset();
  }, [org, unitId]);
  useEffect(() => {
    const timer = setInterval(() => {
      if (!pending.current && Date.now() - activity.current > 60000) reset();
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  useEffect(() => {
    titleRef.current?.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }, [mode, receipt]);
  const selectPriority = (value: boolean) => {
    setPriority(value);
    if (!value) setReason('reception');
    setError('');
  };
  const chooseMode = (next: Mode) => {
    setMode(next);
    setIdentifier('');
    setBirth('');
    setError('');
    setService(next === 'guest' ? 'Orientação na recepção' : 'Consulta');
  };
  const issue = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const next = await repository.issueTicket({
        organizationId: org,
        unitId,
        service,
        priority: priority ? 'priority' : 'routine',
        ...(priority ? { preferenceReason: reason } : {}),
        requestId: requestId.current,
        ...(mode === 'cpf' || mode === 'name'
          ? { identification: { kind: mode, value: identifier, birthDate: birth } }
          : {}),
      });
      setReceipt(next);
      setIdentifier('');
      setBirth('');
      setReason('reception');
      activity.current = Date.now();
    } catch (e) {
      setError((e as Error).message);
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };
  if (!unit)
    return (
      <main className="kiosk">
        <h1>Totem sem unidade configurada</h1>
        <p>Abra o endereço em “Totem e TV”, na administração da unidade.</p>
      </main>
    );
  const services = servicesForUnit(unit.kind),
    example = kioskDemoExample(org);
  return (
    <main
      className="kiosk kiosk-expanded"
      onPointerDown={() => (activity.current = Date.now())}
      onKeyDown={() => (activity.current = Date.now())}
    >
      <header className="kiosk-header">
        <img src="/brand/marca.svg" alt="Cuidelo" />
        <span>
          {unit.name}
          <small>Demonstração · use somente dados fictícios</small>
        </span>
      </header>
      <section className="kiosk-body">
        {receipt ? (
          <div className="ticket-success">
            <span className="kiosk-symbol">
              <Ticket size={38} />
            </span>
            <h1 ref={titleRef} tabIndex={-1}>
              {receipt.existing ? 'Sua senha já foi emitida' : 'Sua chegada foi registrada'}
            </h1>
            <div className="ticket-receipt">
              <img src="/brand/marca.svg" alt="Cuidelo" />
              <p>{receipt.unitName}</p>
              <strong>{receipt.ticket}</strong>
              <p>{receipt.service}</p>
              <p>
                {receipt.priority === 'priority'
                  ? 'Atendimento preferencial solicitado'
                  : 'Atendimento comum'}
              </p>
              <small>
                {shortDate(receipt.issuedAt.slice(0, 10))} · {clockTime(receipt.issuedAt)}
              </small>
              <p>
                {receipt.needsIdentification
                  ? 'Apresente esta senha à recepção para identificação.'
                  : 'Aguarde sua senha no painel da unidade.'}
              </p>
              <small>DEMONSTRAÇÃO · sem dados pessoais</small>
            </div>
            {receipt.preferenceNeedsReview && (
              <Notice tone="amber">
                A preferência já foi conferida ou seu atendimento começou. Qualquer alteração
                precisa ser conferida diretamente com a recepção.
              </Notice>
            )}
            {receipt.existing && (
              <p>
                Foi mantida a senha do atendimento que já estava aberto. Para outro serviço ou
                alteração, procure a recepção.
              </p>
            )}
            <div className="kiosk-actions">
              <Button onClick={() => window.print()}>
                <Printer size={23} />
                Imprimir senha
              </Button>
              <Button variant="secondary" onClick={reset}>
                Próxima pessoa
              </Button>
            </div>
            <p>A impressão abre a janela do navegador. A tela é limpa após 1 minuto sem uso.</p>
          </div>
        ) : (
          <>
            <span className="eyebrow">BEM-VINDO À {unit.name.toLocaleUpperCase('pt-BR')}</span>
            <h1 ref={titleRef} tabIndex={-1}>
              {mode === 'start'
                ? 'Como podemos cuidar de você?'
                : mode === 'guest'
                  ? 'Vamos ajudar na recepção'
                  : 'Vamos identificar seu cadastro'}
            </h1>
            <p className="kiosk-lead">
              {mode === 'start'
                ? 'Escolha o tipo de atendimento e a forma de identificação.'
                : 'Confira as opções abaixo para retirar sua senha.'}
            </p>
            {mode === 'start' ? (
              <>
                <PriorityChoice priority={priority} onChange={selectPriority} />
                <h2 className="kiosk-section-title">Como deseja se identificar?</h2>
                <div className="kiosk-choices kiosk-identities">
                  <button onClick={() => chooseMode('cpf')}>
                    <CreditCard size={33} />
                    <strong>Usar meu CPF</strong>
                    <span>CPF e data de nascimento</span>
                  </button>
                  <button onClick={() => chooseMode('name')}>
                    <UserRound size={33} />
                    <strong>Usar meu nome</strong>
                    <span>Nome completo e data de nascimento</span>
                  </button>
                  <button onClick={() => chooseMode('guest')}>
                    <Ticket size={33} />
                    <strong>Preciso da recepção</strong>
                    <span>Sem cadastro, sem documento ou preciso de ajuda</span>
                  </button>
                </div>
              </>
            ) : (
              <form
                className="kiosk-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void issue();
                }}
              >
                <fieldset disabled={busy} className="kiosk-form-body">
                  {mode !== 'guest' ? (
                    <section className="kiosk-form-section">
                      <h2>
                        <span>1</span>Identificação
                      </h2>
                      <div
                        className="kiosk-methods"
                        role="group"
                        aria-label="Forma de identificação"
                      >
                        <button
                          type="button"
                          aria-pressed={mode === 'cpf'}
                          onClick={() => chooseMode('cpf')}
                        >
                          Por CPF
                        </button>
                        <button
                          type="button"
                          aria-pressed={mode === 'name'}
                          onClick={() => chooseMode('name')}
                        >
                          Por nome completo
                        </button>
                      </div>
                      <div className="access-filters">
                        <Field
                          label={mode === 'cpf' ? 'CPF' : 'Nome completo'}
                          hint={
                            mode === 'cpf'
                              ? 'Digite os 11 números.'
                              : 'Use o nome completo ou nome social registrado.'
                          }
                        >
                          <input
                            key={mode}
                            value={identifier}
                            onChange={(e) =>
                              setIdentifier(
                                mode === 'cpf' ? formatCpf(e.target.value) : e.target.value,
                              )
                            }
                            required
                            inputMode={mode === 'cpf' ? 'numeric' : 'text'}
                            autoComplete="off"
                            maxLength={mode === 'cpf' ? 14 : 120}
                            placeholder={mode === 'cpf' ? '000.000.000-00' : 'Nome e sobrenomes'}
                          />
                        </Field>
                        <Field
                          label="Data de nascimento"
                          hint="Confirmação para evitar troca de cadastros."
                        >
                          <input
                            type="date"
                            min="1850-01-01"
                            max={dateKey()}
                            required
                            value={birth}
                            onChange={(e) => setBirth(e.target.value)}
                            autoComplete="off"
                          />
                        </Field>
                      </div>
                      {example && (
                        <details className="kiosk-example">
                          <summary>Dados fictícios para testar</summary>
                          <p>
                            {example.name} · CPF {formatCpf(example.cpf)} · nascimento{' '}
                            {shortDate(example.birthDate)}
                          </p>
                          <button
                            type="button"
                            onClick={() => {
                              setIdentifier(mode === 'cpf' ? formatCpf(example.cpf) : example.name);
                              setBirth(example.birthDate);
                              setError('');
                            }}
                          >
                            Preencher exemplo fictício
                          </button>
                        </details>
                      )}
                      <button
                        type="button"
                        className="text-button kiosk-fallback"
                        onClick={() => chooseMode('guest')}
                      >
                        Não tenho cadastro ou não consigo me identificar
                      </button>
                    </section>
                  ) : (
                    <section className="kiosk-form-section">
                      <h2>
                        <span>1</span>Identificação na recepção
                      </h2>
                      <p>
                        Você pode retirar a senha sem informar CPF ou nome aqui. A equipe fará seu
                        cadastro ou ajudará a encontrá-lo no balcão.
                      </p>
                    </section>
                  )}
                  <div className="kiosk-service-priority">
                    <section className="kiosk-form-section">
                      <h2>
                        <span>2</span>O que você precisa hoje?
                      </h2>
                      <div
                        className="kiosk-service-options"
                        role="radiogroup"
                        aria-label="Serviço desejado"
                      >
                        {services.map((s) => (
                          <label className={service === s.value ? 'selected' : ''} key={s.value}>
                            <input
                              type="radio"
                              name="service"
                              value={s.value}
                              checked={service === s.value}
                              onChange={() => setService(s.value)}
                              aria-label={s.label}
                            />
                            <span>
                              <strong>{s.label}</strong>
                              <small>{s.description}</small>
                            </span>
                          </label>
                        ))}
                      </div>
                      <p className="kiosk-note">
                        A recepção confirma a disponibilidade e o encaminhamento para cada serviço.
                      </p>
                    </section>
                    <section className="kiosk-form-section">
                      <h2>
                        <span>3</span>Preferência de atendimento
                      </h2>
                      <PriorityChoice priority={priority} onChange={selectPriority} />
                      {priority && (
                        <>
                          <Field
                            label="Motivo da preferência"
                            hint="Você também pode informar somente à recepção."
                          >
                            <select
                              value={reason}
                              onChange={(e) => setReason(e.target.value as PreferenceReason)}
                            >
                              {preferenceReasons.map((r) => (
                                <option value={r.id} key={r.id}>
                                  {r.label}
                                </option>
                              ))}
                            </select>
                          </Field>
                          {reason === 'blood-donor' && (
                            <p className="kiosk-note">
                              Apresente à recepção o comprovante de doação dos últimos 120 dias. A
                              equipe confere o atendimento após os demais grupos prioritários.
                            </p>
                          )}
                          {reason === 'elderly-special' && (
                            <p className="kiosk-note">
                              Informe à recepção para conferir a preferência especial entre pessoas
                              idosas. Situações de emergência são avaliadas pela equipe.
                            </p>
                          )}
                        </>
                      )}
                      <p className="kiosk-note">
                        A preferência é solicitada à recepção. O motivo não aparece no recibo nem na
                        TV. A avaliação de risco clínico é feita pela equipe.
                      </p>
                    </section>
                  </div>
                  {error && (
                    <div role="alert" className="form-error">
                      {error}
                      {mode !== 'guest' && (
                        <button
                          className="text-button"
                          type="button"
                          onClick={() => chooseMode('guest')}
                        >
                          Continuar pela recepção
                        </button>
                      )}
                    </div>
                  )}
                  <div className="kiosk-confirmation">
                    <div>
                      <small>Sua solicitação</small>
                      <strong>
                        {services.find((s) => s.value === service)?.label} ·{' '}
                        {priority ? 'Preferencial' : 'Comum'}
                      </strong>
                    </div>
                    <div className="kiosk-actions">
                      <Button type="button" variant="secondary" onClick={() => chooseMode('start')}>
                        <ArrowLeft size={20} />
                        Voltar
                      </Button>
                      <Button type="submit">
                        <Ticket size={22} />
                        {busy ? 'Registrando…' : 'Emitir minha senha'}
                      </Button>
                    </div>
                  </div>
                </fieldset>
              </form>
            )}
            <button className="kiosk-help" onClick={() => setHelp(!help)}>
              <HandHeart size={25} />
              Preciso de ajuda da equipe
            </button>
            {help && (
              <Notice>
                Procure um profissional ou o balcão de recepção. Este botão orienta você; ele não
                envia um chamado.
              </Notice>
            )}
          </>
        )}
      </section>
      <footer>
        Se precisar de atendimento imediato, procure a equipe presencialmente. O totem não faz
        avaliação clínica.
      </footer>
    </main>
  );
}
