const reject = (status, message) => Object.assign(new Error(message), { status });

// Vercel pode entregar o corpo já interpretado. O servidor local fornece um fluxo de bytes.
export async function readCommand(req, maxBytes, fields) {
  const type = String(req.headers['content-type'] ?? '')
    .split(';', 1)[0]
    .trim()
    .toLowerCase();
  if (type !== 'application/json') throw reject(415, 'Use application/json.');
  if (Number(req.headers['content-length']) > maxBytes) throw reject(413, 'Mensagem muito grande.');
  let data = req.body;
  if (data === undefined) {
    let bytes = 0;
    const parts = [];
    for await (const part of req) {
      const buffer = Buffer.isBuffer(part) ? part : Buffer.from(part);
      bytes += buffer.length;
      if (bytes > maxBytes) throw reject(413, 'Mensagem muito grande.');
      parts.push(buffer);
    }
    data = Buffer.concat(parts);
  }
  const text = Buffer.isBuffer(data)
    ? data.toString('utf8')
    : typeof data === 'string'
      ? data
      : JSON.stringify(data);
  if (!text || Buffer.byteLength(text) > maxBytes) throw reject(413, 'Mensagem muito grande.');
  try {
    data = JSON.parse(text);
  } catch {
    throw reject(400, 'JSON inválido.');
  }
  if (
    !data ||
    typeof data !== 'object' ||
    Array.isArray(data) ||
    typeof data.op !== 'string' ||
    !Object.hasOwn(fields, data.op) ||
    Object.keys(data).some((k) => k !== 'op' && !fields[data.op].includes(k))
  )
    throw reject(400, 'Operação ou campos inválidos.');
  return data;
}
