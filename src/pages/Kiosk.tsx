import { useEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { Printer, Ticket, UserRound, ArrowLeft, HandHeart } from 'lucide-react';
import { useApp } from '../app/context';
import { kioskServices, type TicketReceipt } from '../domain/patient-flow';
import { Button, Field, Notice, PageHeader, Panel, UnitRequired } from '../components/ui';
import { displayRoute, externalRoute } from '../app/links';
import { clockTime, shortDate } from '../domain/dates';

export function Kiosk() {
  const { repository } = useApp(),
    [params] = useSearchParams();
  const org = params.get('rede') ?? '',
    unitId = params.get('unidade') ?? '';
  const unit = repository
    .directory()
    .units.find((u) => u.id === unitId && u.organizationId === org);
  const [mode, setMode] = useState<'start' | 'known' | 'guest'>('start'),
    [receipt, setReceipt] = useState<TicketReceipt | null>(null),
    [record, setRecord] = useState(''),
    [birth, setBirth] = useState(''),
    [service, setService] = useState<string>(kioskServices[0]),
    [priority, setPriority] = useState(false),
    [error, setError] = useState(''),
    [busy, setBusy] = useState(false),
    [help, setHelp] = useState(false);
  const requestId = useRef(crypto.randomUUID()),
    pending = useRef(false),
    activity = useRef(Date.now());
  const reset = () => {
    setMode('start');
    setReceipt(null);
    setRecord('');
    setBirth('');
    setService(kioskServices[0]);
    setPriority(false);
    setError('');
    setHelp(false);
    requestId.current = crypto.randomUUID();
    activity.current = Date.now();
  };
  useEffect(() => {
    const timer = setInterval(() => {
      if (!pending.current && Date.now() - activity.current > 60000) reset();
    }, 1000);
    return () => clearInterval(timer);
  }, []);
  const issue = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError('');
    try {
      const r = await repository.issueTicket({
        organizationId: org,
        unitId,
        service,
        priority: priority ? 'priority' : 'routine',
        requestId: requestId.current,
        ...(mode === 'known' ? { record, birthDate: birth } : {}),
      });
      setReceipt(r);
      setRecord('');
      setBirth('');
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
  return (
    <main
      className="kiosk"
      onPointerDown={() => (activity.current = Date.now())}
      onKeyDown={() => (activity.current = Date.now())}
    >
      <header className="kiosk-header">
        <img src="/brand/marca.svg" alt="Cuidelo" />
        <span>
          {unit.name}
          <small>Demonstração · dados fictícios</small>
        </span>
      </header>
      <section className="kiosk-body">
        {receipt ? (
          <div className="ticket-success">
            <span className="kiosk-symbol">
              <Ticket size={38} />
            </span>
            <h1>{receipt.existing ? 'Sua senha já foi emitida' : 'Sua chegada foi registrada'}</h1>
            <div className="ticket-receipt">
              <img src="/brand/marca.svg" alt="Cuidelo" />
              <p>{receipt.unitName}</p>
              <strong>{receipt.ticket}</strong>
              <p>{receipt.service}</p>
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
            <div className="kiosk-actions">
              <Button onClick={() => window.print()}>
                <Printer size={23} />
                Imprimir senha
              </Button>
              <Button variant="secondary" onClick={reset}>
                Próxima pessoa
              </Button>
            </div>
            <p>
              A impressão abre a janela do navegador. Esta tela será limpa após 1 minuto sem uso.
            </p>
          </div>
        ) : (
          <>
            <span className="eyebrow">BEM-VINDO À {unit.name.toLocaleUpperCase('pt-BR')}</span>
            <h1>
              {mode === 'start' ? 'Como podemos cuidar de você?' : 'Vamos registrar sua chegada'}
            </h1>
            <p className="kiosk-lead">
              Retire sua senha. A equipe fará o acolhimento e a avaliação clínica.
            </p>
            {mode === 'start' ? (
              <div className="kiosk-choices">
                <button onClick={() => setMode('known')}>
                  <UserRound size={35} />
                  <strong>Tenho cadastro</strong>
                  <span>Identificar e retirar minha senha</span>
                </button>
                <button onClick={() => setMode('guest')}>
                  <Ticket size={35} />
                  <strong>Preciso da recepção</strong>
                  <span>Retirar senha sem identificação no totem</span>
                </button>
              </div>
            ) : (
              <form
                className="kiosk-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  void issue();
                }}
              >
                <fieldset disabled={busy}>
                  {mode === 'known' && (
                    <div className="access-filters">
                      <Field label="Número do cadastro de demonstração">
                        <input
                          required
                          autoComplete="off"
                          value={record}
                          onChange={(e) => setRecord(e.target.value)}
                          placeholder="DEMO-0001"
                          maxLength={20}
                        />
                      </Field>
                      <Field label="Data de nascimento">
                        <input
                          type="date"
                          required
                          value={birth}
                          onChange={(e) => setBirth(e.target.value)}
                        />
                      </Field>
                    </div>
                  )}
                  <Field label="O que você precisa hoje?">
                    <select value={service} onChange={(e) => setService(e.target.value)}>
                      {kioskServices.map((s) => (
                        <option key={s}>{s}</option>
                      ))}
                    </select>
                  </Field>
                  <label className="priority-check">
                    <input
                      type="checkbox"
                      checked={priority}
                      onChange={(e) => setPriority(e.target.checked)}
                    />
                    Solicitar atendimento preferencial à recepção
                  </label>
                  <p className="muted">
                    A preferência será conferida pela equipe. Este totem não classifica risco
                    clínico.
                  </p>
                  {error && (
                    <div role="alert" className="form-error">
                      {error}
                    </div>
                  )}
                  <div className="kiosk-actions">
                    <Button type="button" variant="secondary" onClick={reset}>
                      <ArrowLeft size={20} />
                      Voltar
                    </Button>
                    <Button type="submit">{busy ? 'Registrando…' : 'Emitir minha senha'}</Button>
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
                Procure um profissional ou o balcão de recepção agora. Este botão orienta você; ele
                não envia um chamado.
              </Notice>
            )}
          </>
        )}
      </section>
      <footer>Retirada de senha e identificação · A avaliação de saúde é feita pela equipe</footer>
    </main>
  );
}
export function Devices() {
  const { context, data } = useApp();
  const unit = data.units.find((u) => u.id === context.unitId);
  return (
    <>
      <PageHeader
        eyebrow="TELAS DA UNIDADE"
        title="Totem e TV"
        description="Abra as telas públicas vinculadas a esta unidade. Nenhum prontuário aparece nesses dispositivos."
      />
      <UnitRequired>
        <Panel title={unit?.name}>
          <div className="panel-body">
            <div className="kiosk-actions">
              <a
                className="button primary"
                target="_blank"
                rel="noreferrer"
                href={externalRoute(
                  `/totem?rede=${context.organizationId}&unidade=${context.unitId}`,
                )}
              >
                Abrir totem de pré-atendimento
              </a>
              <a
                className="button secondary"
                target="_blank"
                rel="noreferrer"
                href={externalRoute(displayRoute(context.organizationId, context.unitId))}
              >
                Abrir painel da TV
              </a>
            </div>
            <p>
              Para testar a chamada ao vivo, abra a TV pelo mesmo HTML ou endereço do sistema e no
              mesmo navegador. Arquivos separados e computadores diferentes ainda não compartilham a
              fila.
            </p>
            <p>
              A senha pode ser impressa pela janela de impressão do navegador. A integração direta
              com a impressora do totem será validada com o equipamento.
            </p>
            <Notice>
              O totem registra a chegada; escuta, sinais vitais e avaliação de risco são
              responsabilidades da equipe. Nunca informe dados reais neste ambiente.
            </Notice>
          </div>
        </Panel>
      </UnitRequired>
    </>
  );
}
