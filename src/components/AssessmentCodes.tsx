import { useState } from 'react';
import {
  assessmentCoding,
  clinicalCatalog,
  type AssessmentCoding,
  type ClinicalCode,
  type CodingSystem,
} from '../domain/consultation';
import { normalizedName } from '../domain/identification';
import { Button, Field } from './ui';

export function RecordedCodes({ value }: { value?: AssessmentCoding }) {
  if (!value?.codes.length)
    return (
      <p>
        {value?.reason ? 'Encerrado sem código · ' + value.reason : 'Sem codificação registrada.'}
      </p>
    );
  return (
    <ul className="recorded-codes">
      {value.codes.map((c) => (
        <li key={c.system + c.code}>
          <strong>
            {c.system} · {c.code}
          </strong>{' '}
          {c.label}
          {!clinicalCatalog.some((item) => item.system === c.system && item.code === c.code) && (
            <small> · informado manualmente</small>
          )}
        </li>
      ))}
    </ul>
  );
}
export function AssessmentCodes({
  value,
  onChange,
}: {
  value: AssessmentCoding;
  onChange: (v: AssessmentCoding) => void;
}) {
  const [system, setSystem] = useState<CodingSystem>('CIAP-2'),
    [query, setQuery] = useState(''),
    [code, setCode] = useState(''),
    [label, setLabel] = useState(''),
    [error, setError] = useState('');
  const found = clinicalCatalog.filter(
    (c) =>
      c.system === system &&
      normalizedName(c.code + ' ' + c.label)
        .replaceAll('.', '')
        .includes(normalizedName(query).replaceAll('.', '')),
  );
  const add = (item: ClinicalCode) => {
    try {
      onChange(assessmentCoding({ codes: [...value.codes, item], reason: '' }));
      setError('');
      setCode('');
      setLabel('');
    } catch (e) {
      setError((e as Error).message);
    }
  };
  return (
    <section className="assessment-coding" aria-label="Codificação da avaliação">
      <h3>Problemas e condições avaliados</h3>
      <p>
        Escolha CIAP-2 ou CID-10 para registrar sua avaliação. Cada classificação é selecionada pelo
        profissional.
      </p>
      <div className="coding-fields">
        <Field label="Classificação">
          <select
            value={system}
            onChange={(e) => {
              setSystem(e.target.value as CodingSystem);
              setQuery('');
              setCode('');
              setLabel('');
              setError('');
            }}
          >
            <option>CIAP-2</option>
            <option>CID-10</option>
          </select>
        </Field>
        <Field label="Buscar código ou descrição">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Ex.: tosse"
          />
        </Field>
      </div>
      <div className="coding-options">
        {(query.trim() ? found : found.slice(0, 6)).map((c) => (
          <Button
            key={c.code}
            variant="secondary"
            disabled={value.codes.some((v) => v.system === c.system && v.code === c.code)}
            onClick={() => add(c)}
          >
            {c.code} · {c.label}
          </Button>
        ))}
      </div>
      {!query.trim() && found.length > 6 && (
        <p>
          Exibindo 6 de {found.length} referências de {system}. Digite um código ou descrição para
          buscar nas demais.
        </p>
      )}
      {!found.length && <p>Nenhum resultado na lista demonstrativa.</p>}
      <details>
        <summary>Informar outro código</summary>
        <p>
          Para um código fora da lista, confira a referência e informe a descrição. A demonstração
          confere apenas o formato.
        </p>
        <div className="coding-fields">
          <Field label={'Código ' + system}>
            <input
              value={code}
              onChange={(e) => setCode(e.target.value.toUpperCase())}
              maxLength={8}
            />
          </Field>
          <Field label="Descrição do código">
            <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={180} />
          </Field>
        </div>
        <Button variant="secondary" onClick={() => add({ system, code, label })}>
          Adicionar código informado
        </Button>
      </details>
      {!!value.codes.length && (
        <ul className="recorded-codes">
          {value.codes.map((c) => (
            <li key={c.system + c.code}>
              <strong>
                {c.system} · {c.code}
              </strong>{' '}
              {c.label}{' '}
              <button
                className="text-button"
                aria-label={'Remover ' + c.system + ' ' + c.code}
                onClick={() => onChange({ ...value, codes: value.codes.filter((v) => v !== c) })}
              >
                Remover
              </button>
            </li>
          ))}
        </ul>
      )}
      {!value.codes.length && (
        <Field
          label="Justificativa para concluir sem código"
          hint="Preencha somente se decidir concluir sem CIAP-2 ou CID-10."
        >
          <input
            value={value.reason}
            onChange={(e) => onChange({ ...value, reason: e.target.value })}
            maxLength={500}
          />
        </Field>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}
