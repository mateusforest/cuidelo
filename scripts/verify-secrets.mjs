import { execFileSync } from 'node:child_process';
import { readFile, readdir } from 'node:fs/promises';
import { join, extname } from 'node:path';

const tracked = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' })
  .split('\0')
  .filter(Boolean);
const patterns = [
  /-----BEGIN (?:RSA |EC |OPENSSH |ENCRYPTED )?PRIVATE KEY-----/,
  /\bgh[pousr]_[a-zA-Z0-9]{36,}\b/,
  /\bvercel_blob_rw_[a-zA-Z0-9_]{24,}\b/,
  /\bsk_live_[a-zA-Z0-9]{20,}\b/,
  /\bAKIA[0-9A-Z]{16}\b/,
];
const privateValues = [
  'CUIDELO_PUSH_KEY',
  'BLOB_READ_WRITE_TOKEN',
  'VERCEL_TOKEN',
  'SUPABASE_SERVICE_ROLE_KEY',
]
  .map((k) => process.env[k])
  .filter((v) => v && v.length >= 16);
const issues = new Set();
async function inspect(file, built) {
  if (/(^|[\\/])\.env($|\.)/.test(file) && !file.endsWith('.env.example')) {
    issues.add(file);
    return;
  }
  if (['.png', '.woff2', '.ico', '.pdf', '.jpg', '.zip'].includes(extname(file).toLowerCase()))
    return;
  const text = await readFile(file, 'utf8');
  if (
    patterns.some((re) => re.test(text)) ||
    (built && privateValues.some((v) => text.includes(v)))
  )
    issues.add(file);
}
async function inspectOutput(dir) {
  for (const e of await readdir(dir, { withFileTypes: true })) {
    const file = join(dir, e.name);
    if (e.isDirectory()) await inspectOutput(file);
    else if (e.isFile()) await inspect(file, true);
  }
}
for (const file of tracked) await inspect(file, false);
for (const dir of ['dist', 'dist-standalone']) await inspectOutput(dir);
if (issues.size)
  throw Error('Possível credencial. Revise somente estes caminhos: ' + [...issues].join(', '));
console.log(
  'Arquivos versionados, site e HTMLs verificados para padrões conhecidos de credenciais.',
);
