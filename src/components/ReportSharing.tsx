import { useEffect, useState } from 'react';
import { Share2, Clipboard, FileText } from 'lucide-react';
import type { CitizenView } from '../domain/citizen';
import { careKey, type CareScope } from '../domain/citizen-care';
import type { SharedCareReport } from '../domain/shared-care-report';
import { normalizeReportCode } from '../domain/report-code.mjs';
import { shortDate } from '../domain/dates';
import {
  activeReport,
  shareReport,
  stopReport,
  readReport,
  tabReportCode,
  type ReportGrant,
} from '../data/report-sharing';
import { CitizenLinkError } from '../data/citizen-links';
import { useApp } from '../app/context';
import { Button, Field, Panel } from './ui';
import { ClinicalFollowUp } from './ReportFollowUp';
import type { RevisionChange } from '../data/report-guidance';
import { CareReportContent } from './CareReportContent';

const clock = (n: number) =>
  new Date(n).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
export function OfferReport({
  scope,
  view,
  report,
}: {
  scope: CareScope;
  view: CitizenView;
  report: SharedCareReport | null;
}) {
  const [grant, setGrant] = useState<ReportGrant | null>(null),
    [review, setReview] = useState(false),
    [busy, setBusy] = useState(false),
    [msg, setMsg] = useState('');
  const k = careKey(scope);
  useEffect(() => {
    let here = true;
    const load = () => {
      void activeReport(scope)
        .then((g) => {
          if (here) setGrant(g);
        })
        .catch(() => {
          if (here) setMsg('Não foi possível conferir os códigos neste aparelho.');
        });
    };
    load();
    window.addEventListener('storage', load);
    return () => {
      here = false;
      window.removeEventListener('storage', load);
    };
  }, [k]);
  useEffect(() => {
    setReview(false);
    setMsg('');
  }, [report?.from, report?.to, k]);
  useEffect(() => {
    if (!grant) return;
    const timer = setTimeout(
      () => {
        setGrant(null);
        setMsg('O código expirou.');
      },
      Math.max(0, grant.expires - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [grant]);
  const code = grant?.code.match(/.{4}/g)?.join('-') ?? '';
  const act = async () => {
    setBusy(true);
    setMsg('');
    try {
      if (grant) {
        await stopReport(scope, grant);
        setGrant(null);
        setMsg('Acesso encerrado.');
      } else if (report) {
        setGrant(await shareReport(scope, view, report));
        setReview(false);
        setMsg('Código pronto para entregar ao médico.');
      }
    } catch (e) {
      setMsg((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <section className="cit-sheet report-offer">
      <span className="cit-kicker">Para a consulta</span>
      <h2>Compartilhar com o médico</h2>
      {grant ? (
        <>
          <p>
            Cópia de {shortDate(grant.from)} a {shortDate(grant.to)}. Código válido até{' '}
            <strong>{clock(grant.expires)}</strong>. Os registros feitos depois ficam no diário.
          </p>
          <Field label="Código do relatório">
            <input readOnly value={code} onFocus={(e) => e.target.select()} />
          </Field>
          <p>
            Entregue este código ao médico. No atendimento da mesma pessoa, ele pode abrir{' '}
            <strong>Relatório do cidadão</strong>.
          </p>
          <div className="care-actions">
            <Button
              onClick={async () => {
                try {
                  await navigator.clipboard.writeText(code);
                  setMsg('Código copiado.');
                } catch {
                  setMsg('Selecione o código acima e copie.');
                }
              }}
            >
              <Clipboard size={16} />
              Copiar código
            </Button>
            {typeof navigator.share === 'function' && (
              <Button
                variant="secondary"
                onClick={async () => {
                  try {
                    await navigator.share({
                      title: 'Relatório do Dia a dia',
                      text: 'Código do relatório no Cuidelo: ' + code,
                    });
                  } catch (e) {
                    if ((e as Error).name !== 'AbortError')
                      setMsg('Use Copiar código para compartilhar.');
                  }
                }}
              >
                <Share2 size={16} />
                Enviar código
              </Button>
            )}
            <Button variant="secondary" disabled={busy} onClick={act}>
              Encerrar compartilhamento
            </Button>
          </div>
        </>
      ) : review && report ? (
        <>
          <p>
            Você autoriza a leitura do relatório de{' '}
            <strong>
              {shortDate(report.from)} a {shortDate(report.to)}
            </strong>{' '}
            no consultório por 30 minutos? O médico poderá registrar a revisão no prontuário e
            enviar orientações ao seu app. A cópia inclui as condições, os medicamentos e a linha do
            tempo que você vê abaixo. Você pode encerrar o acesso neste aparelho.
          </p>
          <div className="care-actions">
            <Button disabled={busy} onClick={act}>
              Autorizar e gerar código
            </Button>
            <Button variant="secondary" disabled={busy} onClick={() => setReview(false)}>
              Cancelar
            </Button>
          </div>
        </>
      ) : (
        <>
          <p>Escolha o período acima e confira o relatório antes de dar acesso.</p>
          <Button
            disabled={!report || busy}
            onClick={() => {
              setMsg('');
              setReview(true);
            }}
          >
            <Share2 size={16} />
            Compartilhar relatório
          </Button>
        </>
      )}
      {msg && (
        <p className="cit-notice" role="status">
          {msg}
        </p>
      )}
    </section>
  );
}
export function ConsultReport({
  encounterId,
  changed,
}: {
  encounterId: string;
  changed: RevisionChange;
}) {
  const { context, repository } = useApp();
  const [code, setCode] = useState(() => tabReportCode(context, encounterId)),
    [input, setInput] = useState(''),
    [open, setOpen] = useState(!!code);
  const [data, setData] = useState<{
      report: SharedCareReport;
      expires: number;
      ref: string;
      canReply: boolean;
    } | null>(null),
    [msg, setMsg] = useState('');
  useEffect(() => {
    if (!code) return;
    let live = true,
      busy = false,
      expired = false,
      expiry: ReturnType<typeof setTimeout>;
    const end = (s: string) => {
      expired = true;
      setData(null);
      setMsg(s);
      tabReportCode(context, encounterId, null);
      setCode('');
    };
    const load = async () => {
      if (!live || busy || expired) return;
      busy = true;
      try {
        const r = await readReport(repository, context, encounterId, code);
        if (!live || expired) return;
        setData(r);
        setMsg('');
        setInput('');
        tabReportCode(context, encounterId, code);
        clearTimeout(expiry);
        expiry = setTimeout(
          () => end('O acesso ao relatório expirou.'),
          Math.max(0, r.expires - Date.now()),
        );
      } catch (e) {
        if (live && !expired) {
          setData(null);
          setMsg((e as Error).message);
          if (
            !(e instanceof CitizenLinkError) ||
            e.unavailable ||
            /não corresponde/.test(e.message)
          )
            end((e as Error).message);
        }
      } finally {
        busy = false;
      }
    };
    void load();
    const t = setInterval(load, 5000);
    window.addEventListener('focus', load);
    return () => {
      live = false;
      clearInterval(t);
      clearTimeout(expiry);
      window.removeEventListener('focus', load);
    };
  }, [code, context, repository, encounterId]);
  return (
    <Panel
      title="Relatório do cidadão"
      subtitle="Acompanhamento compartilhado pela pessoa"
      action={<FileText size={18} />}
    >
      <div className="panel-body consultation-report">
        {!open ? (
          <Button variant="secondary" onClick={() => setOpen(true)}>
            Abrir relatório com código
          </Button>
        ) : (
          <>
            {!code && (
              <form
                className="care-form"
                onSubmit={(e) => {
                  e.preventDefault();
                  try {
                    setCode(normalizeReportCode(input));
                    setMsg('Conferindo o acesso…');
                  } catch (err) {
                    setMsg((err as Error).message);
                  }
                }}
              >
                <Field label="Código compartilhado pela pessoa">
                  <input
                    value={input}
                    onChange={(e) => setInput(e.target.value)}
                    autoComplete="off"
                    spellCheck={false}
                    maxLength={55}
                    placeholder="Cole ou digite os seis grupos"
                    required
                  />
                </Field>
                <Button type="submit">Consultar relatório</Button>
              </form>
            )}
            {msg && <p role="status">{msg}</p>}
            {code && data && (
              <div className="care-report">
                <p>
                  Acesso até {clock(data.expires)}. Doses e ocorrências pessoais foram informadas
                  pela pessoa.
                </p>
                <CareReportContent snapshot={data.report} />
              </div>
            )}
            <Button
              variant="ghost"
              onClick={() => {
                setData(null);
                setOpen(false);
                setCode('');
                setInput('');
                setMsg('');
                tabReportCode(context, encounterId, null);
              }}
            >
              Fechar relatório
            </Button>
          </>
        )}
        <ClinicalFollowUp
          encounterId={encounterId}
          code={code}
          refId={code && data ? data.ref : undefined}
          canReply={!!data?.canReply}
          changed={changed}
        />
      </div>
    </Panel>
  );
}
