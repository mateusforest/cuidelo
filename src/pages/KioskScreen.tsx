import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  CreditCard,
  HandHeart,
  Printer,
  Ticket,
  UserRound,
} from 'lucide-react';
import { useApp } from '../app/context';
import { Button, Field, Notice } from '../components/ui';
import { clockTime, dateKey, shortDate } from '../domain/dates';
import { formatCpf, kioskDemoExample, normalizedName, validCpf } from '../domain/identification';
import { preferenceReasons, servicesForUnit, type PreferenceReason } from '../domain/kiosk-options';
import type { TicketReceipt } from '../domain/patient-flow';
import '../styles/kiosk.css';

type Mode = 'start' | 'cpf' | 'name' | 'guest';
const steps = ['Identificação', 'Serviço', 'Preferência', 'Conferência'];
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
    [step, setStep] = useState(0),
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
    serviceChosen = useRef(false),
    activity = useRef(Date.now());
  const titleRef = useRef<HTMLHeadingElement>(null);
  const reset = () => {
    setMode('start');
    setStep(0);
    setReceipt(null);
    setIdentifier('');
    setBirth('');
    setService('Consulta');
    serviceChosen.current = false;
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
  }, [mode, receipt, step]);
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
    if (!serviceChosen.current)
      setService(next === 'guest' ? 'Orientação na recepção' : 'Consulta');
    setStep(next === 'guest' ? 1 : 0);
  };
  const goTo = (next: number) => {
    setError('');
    setStep(next);
    if (next === 0 && mode === 'guest') setMode('start');
  };
  const advance = () => {
    if (step === 1) serviceChosen.current = true;
    if (step === 0) {
      if (mode === 'cpf' && !validCpf(identifier)) {
        setError('Confira o CPF: informe os 11 números e verifique a digitação.');
        return;
      }
      if (mode === 'name' && normalizedName(identifier).split(' ').length < 2) {
        setError('Informe o nome completo, como está no cadastro.');
        return;
      }
    }
    goTo(step + 1);
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
      className="kiosk kiosk-expanded kiosk-wizard"
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
            <nav className="kiosk-progress" aria-label="Etapas para retirar a senha">
              <ol>
                {steps.map((label, index) => (
                  <li
                    key={label}
                    className={index < step ? 'done' : index === step ? 'current' : ''}
                    aria-current={index === step ? 'step' : undefined}
                  >
                    <span aria-hidden="true">{index < step ? <Check size={18} /> : index + 1}</span>
                    <strong>{label}</strong>
                  </li>
                ))}
              </ol>
            </nav>
            <div className="kiosk-step-heading">
              <span className="eyebrow">
                ETAPA {step + 1} DE 4 · {steps[step].toLocaleUpperCase('pt-BR')}
              </span>
              <h1 ref={titleRef} tabIndex={-1}>
                {step === 0
                  ? mode === 'start'
                    ? 'Como podemos cuidar de você?'
                    : 'Vamos identificar seu cadastro'
                  : step === 1
                    ? 'O que você precisa hoje?'
                    : step === 2
                      ? 'Você precisa de preferência?'
                      : 'Confira antes de retirar a senha'}
              </h1>
              <p className="kiosk-lead">
                {step === 0
                  ? 'Escolha como se identificar. Se precisar, a recepção pode ajudar.'
                  : step === 1
                    ? 'Selecione um serviço. A equipe confirma o encaminhamento na recepção.'
                    : step === 2
                      ? 'Escolha o tipo de atendimento. A preferência será conferida pela equipe.'
                      : 'Está tudo certo? Sua senha será emitida ao confirmar abaixo.'}
              </p>
            </div>
            {step === 0 && mode === 'start' ? (
              <div className="kiosk-choices kiosk-identities">
                <button onClick={() => chooseMode('cpf')}>
                  <CreditCard size={30} />
                  <strong>Usar meu CPF</strong>
                  <span>CPF e data de nascimento</span>
                  <ArrowRight size={20} aria-hidden="true" />
                </button>
                <button onClick={() => chooseMode('name')}>
                  <UserRound size={30} />
                  <strong>Usar meu nome</strong>
                  <span>Nome completo e data de nascimento</span>
                  <ArrowRight size={20} aria-hidden="true" />
                </button>
                <button onClick={() => chooseMode('guest')}>
                  <HandHeart size={30} />
                  <strong>Preciso da recepção</strong>
                  <span>Sem cadastro, sem documento ou preciso de ajuda</span>
                  <ArrowRight size={20} aria-hidden="true" />
                </button>
              </div>
            ) : (
              <form
                className="kiosk-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  if (step === 3) void issue();
                  else advance();
                }}
              >
                <fieldset disabled={busy} className="kiosk-form-body">
                  <div className={`kiosk-step-card kiosk-step-${step}`}>
                    {step === 0 && (mode === 'cpf' || mode === 'name') && (
                      <>
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
                                setIdentifier(
                                  mode === 'cpf' ? formatCpf(example.cpf) : example.name,
                                );
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
                      </>
                    )}
                    {step === 1 && (
                      <>
                        {mode === 'guest' && (
                          <p className="kiosk-context-note">
                            <UserRound size={20} /> A recepção fará sua identificação. Você pode
                            continuar sem informar seus dados aqui.
                          </p>
                        )}
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
                                onChange={() => {
                                  serviceChosen.current = true;
                                  setService(s.value);
                                }}
                                aria-label={s.label}
                              />
                              <span>
                                <strong>{s.label}</strong>
                                <small>{s.description}</small>
                              </span>
                            </label>
                          ))}
                        </div>
                      </>
                    )}
                    {step === 2 && (
                      <>
                        <PriorityChoice priority={priority} onChange={selectPriority} />
                        {priority && (
                          <div className="kiosk-preference-detail">
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
                                Informe à recepção para conferir a preferência especial entre
                                pessoas idosas. Situações de emergência são avaliadas pela equipe.
                              </p>
                            )}
                          </div>
                        )}
                        <p className="kiosk-note">
                          O motivo não aparece no recibo nem na TV. A avaliação de risco clínico é
                          feita pela equipe.
                        </p>
                      </>
                    )}
                    {step === 3 && (
                      <div className="kiosk-review">
                        <div>
                          <UserRound size={23} />
                          <div>
                            <small>Identificação informada</small>
                            <strong>
                              {mode === 'guest'
                                ? 'Identificação na recepção'
                                : mode === 'cpf'
                                  ? `CPF final ${identifier.replace(/\D/g, '').slice(-4)}`
                                  : identifier.trim()}
                            </strong>
                            <span>
                              {mode === 'guest'
                                ? 'A equipe ajudará no balcão.'
                                : `Nascimento: ${shortDate(birth)} · cadastro conferido ao emitir`}
                            </span>
                          </div>
                          <button type="button" className="text-button" onClick={() => goTo(0)}>
                            Alterar identificação
                          </button>
                        </div>
                        <div>
                          <Ticket size={23} />
                          <div>
                            <small>Serviço escolhido</small>
                            <strong>{services.find((s) => s.value === service)?.label}</strong>
                            <span>{unit.name}</span>
                          </div>
                          <button type="button" className="text-button" onClick={() => goTo(1)}>
                            Alterar serviço
                          </button>
                        </div>
                        <div>
                          <HandHeart size={23} />
                          <div>
                            <small>Tipo de atendimento</small>
                            <strong>
                              {priority
                                ? 'Atendimento preferencial solicitado'
                                : 'Atendimento comum'}
                            </strong>
                            <span>
                              {priority
                                ? 'O motivo será tratado com a recepção.'
                                : 'Seguir o fluxo habitual da unidade.'}
                            </span>
                          </div>
                          <button type="button" className="text-button" onClick={() => goTo(2)}>
                            Alterar preferência
                          </button>
                        </div>
                      </div>
                    )}
                    {error && (
                      <div role="alert" className="form-error">
                        {error}
                        {step === 3 && mode !== 'guest' && (
                          <button
                            className="text-button"
                            type="button"
                            onClick={() => {
                              setMode('guest');
                              setIdentifier('');
                              setBirth('');
                              setError('');
                            }}
                          >
                            Continuar pela recepção
                          </button>
                        )}
                      </div>
                    )}
                    <div className="kiosk-step-actions">
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => (step === 0 ? chooseMode('start') : goTo(step - 1))}
                      >
                        <ArrowLeft size={20} />
                        Voltar
                      </Button>
                      <Button type="submit">
                        {busy
                          ? 'Emitindo senha…'
                          : step === 3
                            ? 'Emitir minha senha'
                            : step === 2
                              ? 'Conferir minha senha'
                              : 'Continuar'}
                        {step === 3 ? <Ticket size={20} /> : <ArrowRight size={20} />}
                      </Button>
                    </div>
                  </div>
                  <button type="button" className="text-button kiosk-restart" onClick={reset}>
                    Cancelar e recomeçar
                  </button>
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
