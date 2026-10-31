import { DomainError } from './errors';
import type { Soap } from './model';

export type CodingSystem = 'CIAP-2' | 'CID-10';
export interface ClinicalCode {
  system: CodingSystem;
  code: string;
  label: string;
}
export interface AssessmentCoding {
  codes: ClinicalCode[];
  reason: string;
}
export const emptyCoding = (): AssessmentCoding => ({ codes: [], reason: '' });

// Recorte para a demonstração offline. Fontes e limites em docs/consultorio-0.16.md.
export const clinicalCatalog: ClinicalCode[] = [
  {
    system: 'CIAP-2',
    code: 'A03',
    label: 'Febre',
  },
  {
    system: 'CIAP-2',
    code: 'R05',
    label: 'Tosse',
  },
  {
    system: 'CIAP-2',
    code: 'K86',
    label: 'Hipertensão sem complicações',
  },
  {
    system: 'CIAP-2',
    code: 'N01',
    label: 'Cefaléia',
  },
  {
    system: 'CIAP-2',
    code: 'R96',
    label: 'Asma',
  },
  {
    system: 'CIAP-2',
    code: 'R81',
    label: 'Pneumonia',
  },
  {
    system: 'CIAP-2',
    code: 'T82',
    label: 'Obesidade',
  },
  {
    system: 'CIAP-2',
    code: 'T90',
    label: 'Diabetes não insulino-dependente',
  },
  {
    system: 'CID-10',
    code: 'I10',
    label: 'Hipertensão essencial (primária)',
  },
  {
    system: 'CID-10',
    code: 'R05',
    label: 'Tosse',
  },
  {
    system: 'CID-10',
    code: 'R50.9',
    label: 'Febre não especificada',
  },
  {
    system: 'CID-10',
    code: 'R51',
    label: 'Cefaléia',
  },
  {
    system: 'CID-10',
    code: 'M54.5',
    label: 'Dor lombar baixa',
  },
  {
    system: 'CID-10',
    code: 'R10',
    label: 'Dor abdominal e pélvica',
  },
  {
    system: 'CIAP-2',
    code: 'K87',
    label: 'Hipertensão com complicações',
  },
  {
    system: 'CIAP-2',
    code: 'K85',
    label: 'Pressão arterial elevada',
  },
  {
    system: 'CIAP-2',
    code: 'T89',
    label: 'Diabetes insulino-dependente',
  },
  {
    system: 'CIAP-2',
    code: 'F83',
    label: 'Retinopatia',
  },
  {
    system: 'CIAP-2',
    code: 'T93',
    label: 'Alteração no metabolismo dos lípidos',
  },
  {
    system: 'CIAP-2',
    code: 'R80',
    label: 'Gripe',
  },
  {
    system: 'CIAP-2',
    code: 'R74',
    label: 'Infecção aguda do aparelho respiratório superior (IVAS)',
  },
  {
    system: 'CIAP-2',
    code: 'R76',
    label: 'Amigdalite aguda',
  },
  {
    system: 'CIAP-2',
    code: 'R75',
    label: 'Sinusite crónica/aguda',
  },
  {
    system: 'CIAP-2',
    code: 'R95',
    label: 'Doença pulmonar obstrutiva crónica',
  },
  {
    system: 'CIAP-2',
    code: 'L03',
    label: 'Sinais/sintomas da região lombar',
  },
  {
    system: 'CIAP-2',
    code: 'H71',
    label: 'Otite media aguda/miringite',
  },
  {
    system: 'CIAP-2',
    code: 'U71',
    label: 'Cistite/outra infecção urinária',
  },
  {
    system: 'CIAP-2',
    code: 'D11',
    label: 'Diarreia',
  },
  {
    system: 'CIAP-2',
    code: 'D07',
    label: 'Dispepsia/indigestão',
  },
  {
    system: 'CIAP-2',
    code: 'P74',
    label: 'Distúrbio ansioso/estado de ansiedade',
  },
  {
    system: 'CIAP-2',
    code: 'P76',
    label: 'Perturbações depressivas',
  },
  {
    system: 'CIAP-2',
    code: 'P17',
    label: 'Abuso do tabaco',
  },
  {
    system: 'CIAP-2',
    code: 'B80',
    label: 'Anemia por deficiência de ferro',
  },
  {
    system: 'CIAP-2',
    code: 'S88',
    label: 'Dermatite de contato/alérgica',
  },
  {
    system: 'CIAP-2',
    code: 'F70',
    label: 'Conjuntivite infecciosa',
  },
  {
    system: 'CIAP-2',
    code: 'T86',
    label: 'Hipotiroidismo/mixedema',
  },
  {
    system: 'CIAP-2',
    code: 'W78',
    label: 'Gravidez',
  },
  {
    system: 'CIAP-2',
    code: 'W84',
    label: 'Gravidez de alto risco',
  },
  {
    system: 'CIAP-2',
    code: 'W81',
    label: 'Toxemia gravídica/ DHEG',
  },
  {
    system: 'CIAP-2',
    code: 'A98',
    label: 'Medicina preventiva/manutenção da saúde',
  },
  {
    system: 'CIAP-2',
    code: 'A85',
    label: 'Efeito adverso de fármaco dose correta',
  },
  {
    system: 'CID-10',
    code: 'I11.9',
    label: 'Doença cardíaca hipertensiva sem insuficiência cardíaca (congestiva)',
  },
  {
    system: 'CID-10',
    code: 'R03.0',
    label: 'Valor elevado da pressão arterial sem o diagnóstico de hipertensão',
  },
  {
    system: 'CID-10',
    code: 'E11',
    label: 'Diabetes mellitus não-insulino-dependente',
  },
  {
    system: 'CID-10',
    code: 'E10',
    label: 'Diabetes mellitus insulino-dependente',
  },
  {
    system: 'CID-10',
    code: 'H36.0',
    label: 'Retinopatia diabética',
  },
  {
    system: 'CID-10',
    code: 'E78.5',
    label: 'Hiperlipidemia não especificada',
  },
  {
    system: 'CID-10',
    code: 'E66.9',
    label: 'Obesidade não especificada',
  },
  {
    system: 'CID-10',
    code: 'J11',
    label: 'Influenza (gripe) devida a vírus não identificado',
  },
  {
    system: 'CID-10',
    code: 'J06.9',
    label: 'Infecção aguda das vias aéreas superiores não especificada',
  },
  {
    system: 'CID-10',
    code: 'J18.9',
    label: 'Pneumonia não especificada',
  },
  {
    system: 'CID-10',
    code: 'J03.9',
    label: 'Amigdalite aguda não especificada',
  },
  {
    system: 'CID-10',
    code: 'J32.9',
    label: 'Sinusite crônica não especificada',
  },
  {
    system: 'CID-10',
    code: 'J45',
    label: 'Asma',
  },
  {
    system: 'CID-10',
    code: 'J44.9',
    label: 'Doença pulmonar obstrutiva crônica não especificada',
  },
  {
    system: 'CID-10',
    code: 'H66.9',
    label: 'Otite média não especificada',
  },
  {
    system: 'CID-10',
    code: 'N39.0',
    label: 'Infecção do trato urinário de localização não especificada',
  },
  {
    system: 'CID-10',
    code: 'A09',
    label: 'Diarréia e gastroenterite de origem infecciosa presumível',
  },
  {
    system: 'CID-10',
    code: 'K30',
    label: 'DISPEPSIA',
  },
  {
    system: 'CID-10',
    code: 'F41.9',
    label: 'Transtorno ansioso não especificado',
  },
  {
    system: 'CID-10',
    code: 'F32.9',
    label: 'Episódio depressivo não especificado',
  },
  {
    system: 'CID-10',
    code: 'F17.1',
    label: 'Transtornos mentais e comport. dev. uso fumo - uso nocivo para a saúde',
  },
  {
    system: 'CID-10',
    code: 'D50.9',
    label: 'Anemia por deficiência de ferro não especificada',
  },
  {
    system: 'CID-10',
    code: 'L23.9',
    label: 'Dermatite alérgica de contato, de causa não especificada',
  },
  {
    system: 'CID-10',
    code: 'H10.9',
    label: 'Conjuntivite não especificada',
  },
  {
    system: 'CID-10',
    code: 'E03.9',
    label: 'Hipotireoidismo não especificado',
  },
  {
    system: 'CID-10',
    code: 'Z34.9',
    label: 'Supervisão de gravidez normal, não especificada',
  },
  {
    system: 'CID-10',
    code: 'O13',
    label: 'HIPERTENSAO GESTACIONAL (INDUZIDA PELA GRAVIDEZ) SEM PROTEINURIA SIGNIFICATIVA',
  },
  {
    system: 'CID-10',
    code: 'Z00.1',
    label: 'Exame de rotina de saúde da criança',
  },
  {
    system: 'CID-10',
    code: 'Z12.4',
    label: 'Exame especial de rastreamento de neoplasia do colo do útero',
  },
  {
    system: 'CID-10',
    code: 'T88.7',
    label: 'Efeito adverso não especificado de droga ou medicamento',
  },
];
export function assessmentCoding(value: AssessmentCoding, final = false): AssessmentCoding {
  if (
    !value ||
    !Array.isArray(value.codes) ||
    value.codes.length > 20 ||
    typeof value.reason !== 'string' ||
    value.reason.length > 500
  )
    throw new DomainError('Revise os códigos ou a justificativa da avaliação.');
  const seen = new Set<string>();
  const codes = value.codes.map((item) => {
    if (!item || typeof item.code !== 'string' || typeof item.label !== 'string')
      throw new DomainError('Informe o código e sua descrição.');
    const { system } = item,
      rawCode = item.code.trim().toUpperCase(),
      code =
        system === 'CID-10' && /^[A-Z]\d{3}$/.test(rawCode)
          ? rawCode.slice(0, 3) + '.' + rawCode.slice(3)
          : rawCode,
      label = item.label.trim();
    const valid =
      system === 'CIAP-2'
        ? /^[ABDFHKLNPRSTUWXYZ]\d{2}$/.test(code)
        : system === 'CID-10' && /^[A-Z]\d{2}(\.\d)?$/.test(code);
    if (!valid || !label || label.length > 180)
      throw new DomainError('Confira o formato do código e informe sua descrição.');
    const key = system + ':' + code;
    if (seen.has(key)) throw new DomainError('Este código já está na avaliação.');
    seen.add(key);
    return (
      clinicalCatalog.find((c) => c.system === system && c.code === code) ?? { system, code, label }
    );
  });
  const reason = value.reason.trim();
  if (codes.length && reason)
    throw new DomainError('Use a justificativa somente ao concluir sem código.');
  if (final && !codes.length && !reason)
    throw new DomainError(
      'Inclua um código CIAP-2 ou CID-10 na avaliação ou justifique o encerramento sem código.',
    );
  return { codes, reason };
}
export function normalizeSoap(value: Soap): Soap {
  const soap: Soap = { subjective: '', objective: '', assessment: '', plan: '' };
  for (const field of Object.keys(soap) as (keyof Soap)[]) {
    if (typeof value?.[field] !== 'string' || value[field].length > 10000)
      throw new DomainError('Cada campo SOAP permite até 10.000 caracteres.');
    soap[field] = value[field].trim();
  }
  return soap;
}
