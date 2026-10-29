export const isPortable = () => window.location.protocol === 'file:';
export function externalRoute(route: string) {
  if (isPortable()) return window.location.href.split('#')[0] + '#' + route;
  return new URL(route, window.location.origin).href;
}
export function displayRoute(organizationId: string, unitId: string, preview = false) {
  const query = new URLSearchParams({ rede: organizationId, unidade: unitId });
  if (preview) query.set('previa', '1');
  return '/painel?' + query;
}
