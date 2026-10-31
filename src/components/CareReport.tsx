import { useState } from 'react';
import { Printer } from 'lucide-react';
import { reportSnapshot } from '../domain/shared-care-report';
import { CareReportContent } from './CareReportContent';
import { OfferReport } from './ReportSharing';
import { localDay, type CareScope, type Diary } from '../domain/citizen-care';
import { addDays, validDay } from '../domain/dates';
import type { CitizenView } from '../domain/citizen';
import { Button, Field } from './ui';
export function CareReport({
  diary,
  view,
  scope,
}: {
  diary: Diary;
  view: CitizenView;
  scope: CareScope;
}) {
  const today = localDay(new Date()),
    [from, setFrom] = useState(addDays(today, -29)),
    [to, setTo] = useState(today);
  const report =
    validDay(from) && validDay(to) && from <= to ? reportSnapshot(diary, view, from, to) : null;
  return (
    <>
      <div className="care-form care-period">
        <Field label="De">
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
        </Field>
        <Field label="Até">
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
        </Field>
      </div>
      <OfferReport scope={scope} view={view} report={report} />
      {!report ? (
        <p role="alert">Confira o início e o fim do período.</p>
      ) : (
        <article className="cit-sheet care-report">
          <CareReportContent snapshot={report} />
          <Button className="cit-print" onClick={() => window.print()}>
            <Printer size={16} /> Imprimir ou salvar relatório em PDF
          </Button>
        </article>
      )}
    </>
  );
}
