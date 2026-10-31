const alphabet = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
const digest = async (value) =>
  new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value)));
const hex = (bytes) => Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
export async function reportCode(owner) {
  const bytes = await digest('cuidelo-report-code-v1:' + owner);
  return Array.from(bytes.slice(0, 24), (b) => alphabet[b & 31]).join('');
}
export function normalizeReportCode(code) {
  const clean = code.toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
  if (clean.length !== 24 || [...clean].some((c) => !alphabet.includes(c)))
    throw Error('Confira os seis grupos do código de acesso.');
  return clean;
}
export const reportReader = async (code) => hex(await digest('cuidelo-report-read-v1:' + code));
export const reportCipherKey = async (code) => digest('cuidelo-report-aes-v1:' + code);
export const reportBinding = async (org, subject, legacy = false) =>
  hex(await digest(JSON.stringify(['cuidelo-report-binding-v1', legacy, org, subject])));

export const reportReference = async (code) => hex(await digest('cuidelo-review-ref-v1:' + code));
export const replyProof = async (code) => hex(await digest('cuidelo-guidance-write-v1:' + code));
