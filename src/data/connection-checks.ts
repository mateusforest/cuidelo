export const connectionLabels = [
  { key: 'tv', title: 'Painel de senhas', detail: 'Serviço usado pelas TVs pareadas.' },
  {
    key: 'sharing',
    title: 'Compartilhamento do cidadão',
    detail: 'Serviço de acesso aos documentos e relatórios compartilhados.',
  },
  {
    key: 'inbox',
    title: 'Caixa de orientações',
    detail: 'Leitura do armazenamento usado nas respostas do consultório.',
  },
  {
    key: 'push',
    title: 'Notificações no celular',
    detail: 'Chave pública usada para habilitar os avisos no aparelho.',
  },
] as const;
export type ConnectionState = Record<
  (typeof connectionLabels)[number]['key'],
  'ok' | 'error' | 'web'
>;

async function probe(path: string, portable: boolean, post: boolean) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch((portable ? 'https://cuidelo.vercel.app' : '') + path, {
      method: post ? 'POST' : 'GET',
      cache: 'no-store',
      credentials: 'omit',
      signal: controller.signal,
      ...(post
        ? {
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ op: 'health' }),
          }
        : {}),
    });
    return response.ok ? await response.json() : null;
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}
export async function checkConnections(): Promise<ConnectionState> {
  const portable = location.protocol === 'file:';
  const [tv, citizen, push] = await Promise.all([
    probe('/api/tv', portable, true),
    probe('/api/cidadao', portable, true),
    portable ? null : probe('/api/care-push', false, false),
  ]);
  return {
    tv: tv?.service === 'tv' && tv.available === true ? 'ok' : 'error',
    sharing: citizen?.service === 'citizen' && citizen.sharing === true ? 'ok' : 'error',
    inbox: citizen?.service === 'citizen' && citizen.inbox === true ? 'ok' : 'error',
    push: portable
      ? 'web'
      : typeof push?.key === 'string' && /^B[A-Za-z0-9_-]{86}$/.test(push.key)
        ? 'ok'
        : 'error',
  };
}
