import { useEffect } from 'react';
import { Link, useParams } from 'react-router-dom';
import { Printer } from 'lucide-react';
import { useApp } from '../app/context';
import { clockTime, shortDate } from '../domain/dates';
import { formatCpf } from '../domain/identification';
import { Button, EmptyState } from '../components/ui';
import '../styles/clinical-documents.css';
import '../styles/pharmacy.css';

export function PharmacyReceipt() {
  const { id } = useParams(),
    { data, context, repository } = useApp();
  const delivery = data.dispensations.find((d) => d.id === id),
    doc = [...data.pharmacyPrescriptions, ...data.clinicalDocuments].find(
      (d) => d.id === delivery?.documentId,
    );
  useEffect(() => {
    const timer = setInterval(() => repository.refresh(), 1500);
    return () => clearInterval(timer);
  }, [repository]);
  if (!delivery || !doc || doc.content.kind !== 'prescription' || !doc.identity)
    return (
      <EmptyState
        title="Comprovante não encontrado"
        description="Confira o perfil, a unidade e a prefeitura desta entrega."
        action={
          <Link className="button secondary" to="/">
            Voltar ao início
          </Link>
        }
      />
    );
  const identity = doc.identity,
    partial = delivery.balances.some((b) => b.remaining > 0);
  return (
    <main className="clinical-print-page">
      <nav className="document-print-tools">
        <Link
          className="button secondary"
          to={context.role === 'pharmacy' ? '/farmacia' : `/pessoas/${doc.patientId}`}
        >
          Voltar ao acompanhamento
        </Link>
        <Button onClick={() => window.print()}>
          <Printer size={18} />
          Imprimir / salvar PDF
        </Button>
      </nav>
      <article className="document-sheet pharmacy-receipt">
        <div className="document-print-warning">
          COMPROVANTE DE DEMONSTRAÇÃO · DADOS FICTÍCIOS · NÃO UTILIZAR PARA ATENDIMENTO REAL
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
            <span className="eyebrow">ENTREGA DE MEDICAMENTOS · DEMONSTRAÇÃO</span>
            <h1>Comprovante de entrega</h1>
          </div>
          <div>
            <strong>{delivery.number}</strong>
            <span>
              {shortDate(delivery.at)} · {clockTime(delivery.at)}
            </span>
          </div>
        </div>
        <section className="document-patient">
          <strong>{identity.socialName || identity.name}</strong>
          <span>
            CPF: {identity.cpf ? formatCpf(identity.cpf) : 'não informado'} · nascimento{' '}
            {shortDate(identity.birthDate)}
          </span>
          <span>
            Receita: {doc.number} · {identity.professional}
          </span>
          <span>
            Recebido por: {delivery.recipient.name} ·{' '}
            {delivery.recipient.kind === 'patient' ? 'pessoa da receita' : 'representante'}
          </span>
        </section>
        <p>
          <strong>
            {partial
              ? 'Entrega parcial — saldo registrado no momento desta entrega.'
              : 'Saldo da receita concluído nesta entrega.'}
          </strong>
        </p>
        {doc.status === 'cancelled' && (
          <div className="document-cancelled">
            A receita foi cancelada. Esta entrega anterior permanece no histórico; não houve
            devolução automática ao estoque.
          </div>
        )}
        <div className="document-body">
          {delivery.balances.map((b) => {
            const item =
              doc.content.kind === 'prescription'
                ? doc.content.items.find((i) => i.id === b.itemId)!
                : null;
            if (!item) return null;
            return (
              <section className="receipt-item" key={b.itemId}>
                <h3>
                  {item.medicine} · {item.strength} · {item.form}
                </h3>
                <dl>
                  <div>
                    <dt>Quantidade prescrita</dt>
                    <dd>
                      {b.prescribed} {item.quantityUnit}
                    </dd>
                  </div>
                  <div>
                    <dt>Entregue anteriormente</dt>
                    <dd>{b.before}</dd>
                  </div>
                  <div>
                    <dt>Nesta entrega</dt>
                    <dd>{b.delivered}</dd>
                  </div>
                  <div>
                    <dt>Saldo após esta entrega</dt>
                    <dd>{b.remaining}</dd>
                  </div>
                </dl>
                <ul>
                  {delivery.allocations
                    .filter((a) => a.itemId === b.itemId)
                    .map((a) => (
                      <li key={a.movementId}>
                        Lote {a.lot} · validade {shortDate(a.expiresAt)} · {a.quantity}{' '}
                        {a.quantityUnit}
                      </li>
                    ))}
                </ul>
              </section>
            );
          })}
          {delivery.partialReason && (
            <section>
              <h3>Motivo do saldo pendente</h3>
              <p>{delivery.partialReason}</p>
            </section>
          )}
          {delivery.notes && (
            <section>
              <h3>Observações</h3>
              <p>{delivery.notes}</p>
            </section>
          )}
        </div>
        <footer className="document-sheet-footer">
          <strong>{delivery.author}</strong>
          <p>
            Conferência de identificação e de itens registrada no ambiente de demonstração.
            Comprovante sem assinatura; não substitui a receita.
          </p>
          <p>A entrega e os movimentos de estoque ficam preservados no histórico local.</p>
        </footer>
      </article>
    </main>
  );
}
