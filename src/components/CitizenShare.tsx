import { useState, useEffect } from 'react';
import { Smartphone, Link2 } from 'lucide-react';
import { useApp } from '../app/context';
import {
  publishCitizenLink,
  stopCitizenLink,
  savedShare,
  shareHandle,
  type SharedCitizenLink,
} from '../data/citizen-links';
import { clockTime } from '../domain/dates';
import { Button, Panel, Field } from './ui';

export function CitizenShare({ patientId, name }: { patientId: string; name: string }) {
  const { repository, context } = useApp();
  const handle = shareHandle(context, patientId);
  const [link, setLink] = useState<SharedCitizenLink | null>(() => savedShare(handle));
  const [open, setOpen] = useState(!!link),
    [busy, setBusy] = useState(false),
    [feedback, setFeedback] = useState('');
  useEffect(() => {
    try {
      if (link) sessionStorage.setItem(handle, JSON.stringify(link));
      else sessionStorage.removeItem(handle);
    } catch {
      /* sessão em memória */
    }
  }, [handle, link]);
  useEffect(() => {
    if (!link) return;
    const timer = setTimeout(
      () => {
        setLink(null);
        setFeedback('O link expirou. Gere outro para compartilhar uma nova cópia.');
      },
      Math.max(0, link.expires - Date.now()),
    );
    return () => clearTimeout(timer);
  }, [link]);
  const act = async () => {
    if (busy) return;
    setBusy(true);
    setFeedback('');
    try {
      if (link) {
        await stopCitizenLink(link.writer);
        setLink(null);
        setFeedback('Acesso encerrado.');
      } else setLink(await publishCitizenLink(repository.citizenView(context, patientId)));
    } catch (e) {
      setFeedback((e as Error).message);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Panel
      title="App do cidadão"
      subtitle="Acesso de leitura pelo celular"
      action={<Smartphone size={19} />}
    >
      <div className="panel-body citizen-share">
        {!open ? (
          <Button variant="secondary" onClick={() => setOpen(true)}>
            Disponibilizar no celular
          </Button>
        ) : (
          <>
            <p>
              Compartilhe uma cópia da agenda e dos documentos emitidos de <strong>{name}</strong>.
              Quem receber o link poderá ler a cópia por 30 minutos. Durante esse período, esta aba
              envia as alterações enquanto a sessão assistencial estiver aberta. Use somente dados
              fictícios.
            </p>
            {link && (
              <>
                <Field label="Link de leitura para o celular">
                  <input readOnly value={link.url} onFocus={(e) => e.target.select()} />
                </Field>
                <p>
                  Válido até {clockTime(new Date(link.expires).toISOString())}. O celular confere se
                  há atualizações enquanto o link estiver válido.
                </p>
                <div className="row-actions">
                  <Button
                    variant="secondary"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(link.url);
                        setFeedback('Link copiado.');
                      } catch {
                        setFeedback('Selecione e copie o endereço acima.');
                      }
                    }}
                  >
                    <Link2 size={16} /> Copiar link
                  </Button>
                  <a className="button secondary" href={link.url} target="_blank" rel="noreferrer">
                    Abrir cópia
                  </a>
                </div>
              </>
            )}
            <Button disabled={busy} variant={link ? 'secondary' : 'primary'} onClick={act}>
              {busy ? 'Aguarde…' : link ? 'Encerrar link' : 'Gerar link de demonstração'}
            </Button>
          </>
        )}
        {feedback && <p role="status">{feedback}</p>}
      </div>
    </Panel>
  );
}
