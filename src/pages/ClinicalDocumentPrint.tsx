import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { useApp } from '../app/context';
import { documentNames } from '../domain/clinical-documents';
import { formatCpf } from '../domain/identification';
import { clockTime, shortDate } from '../domain/dates';
import { Button, EmptyState } from '../components/ui';
import { DocumentBody } from '../components/ClinicalDocuments';

export function ClinicalDocumentPrint() {
  const { id } = useParams();
  const { data, repository } = useApp();
  const doc = data.clinicalDocuments.find((d) => d.id === id && d.issuedAt),
    identity = doc?.identity;
  useEffect(() => {
    const timer = setInterval(() => repository.refresh(), 1500);
    return () => clearInterval(timer);
  }, [repository]);
  if (!doc || !identity)
    return (
      <EmptyState
        title="Documento emitido não encontrado"
        description="Confira o perfil, a prefeitura e se o documento já foi emitido."
        action={
          <Link className="button secondary" to="/consultorio">
            Voltar ao consultório
          </Link>
        }
      />
    );
  return (
    <main className="clinical-print-page">
      <nav className="document-print-tools">
        <Link className="button secondary" to={`/pessoas/${doc.patientId}`}>
          Voltar ao histórico
        </Link>
        <Button onClick={() => window.print()}>
          <Printer size={18} />
          Imprimir / salvar PDF
        </Button>
      </nav>
      <article className={`document-sheet ${doc.status === 'cancelled' ? 'cancelled' : ''}`}>
        <div className="document-print-warning">
          DEMONSTRAÇÃO · SEM ASSINATURA · NÃO UTILIZAR PARA ATENDIMENTO REAL
        </div>
        <header className="document-sheet-header">
          <img src="/brand/marca.svg" alt="Cuidelo" />
          <div>
            <strong>{identity.unit}</strong>
            <span>{identity.organization}</span>
          </div>
        </header>
        <div className="document-sheet-title">
          <div>
            <span className="eyebrow">DOCUMENTO FICTÍCIO</span>
            <h1>{documentNames[doc.content.kind]}</h1>
          </div>
          <div>
            <strong>{doc.number}</strong>
            <span>
              {shortDate(doc.issuedAt!)} · {clockTime(doc.issuedAt!)}
            </span>
          </div>
        </div>
        {doc.status === 'cancelled' && (
          <div className="document-cancelled">
            CANCELADO — {doc.history.filter((h) => h.action === 'cancelled').at(-1)?.reason}
          </div>
        )}
        <section className="document-patient">
          <strong>{identity.socialName || identity.name}</strong>
          {identity.socialName && <span>Nome civil: {identity.name}</span>}
          <span>
            Nascimento: {shortDate(identity.birthDate)} · CPF:{' '}
            {identity.cpf ? formatCpf(identity.cpf) : 'não informado'}
          </span>
          <span>Cadastro fictício: {identity.record}</span>
        </section>
        <DocumentBody content={doc.content} />
        <footer className="document-sheet-footer">
          <strong>{identity.professional}</strong>
          <p>
            Autoria registrada somente na demonstração. Sem assinatura digital ou identificação
            profissional verificada.
          </p>
          <p>
            Conteúdo preservado na emissão. Este arquivo serve exclusivamente para testar o sistema.
          </p>
        </footer>
      </article>
    </main>
  );
}
