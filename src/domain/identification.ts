export function cpfDigits(value: string) {
  return value.replace(/[.\-\s]/g, '');
}
export function validCpf(value: string) {
  const digits = cpfDigits(value);
  if (!/^\d{11}$/.test(digits) || /^(\d)\1{10}$/.test(digits)) return false;
  for (const size of [9, 10]) {
    const sum = [...digits.slice(0, size)].reduce((n, d, i) => n + Number(d) * (size + 1 - i), 0);
    const check = ((sum * 10) % 11) % 10;
    if (check !== Number(digits[size])) return false;
  }
  return true;
}
export function formatCpf(value: string) {
  const d = value.replace(/\D/g, '').slice(0, 11);
  return d
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3}\.\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3}\.\d{3}\.\d{3})(\d)/, '$1-$2');
}
export function normalizedName(value: string) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLocaleLowerCase('pt-BR');
}
// Identificadores sintéticos somente para os cadastros fictícios do cenário inicial.
export function demoCpf(sequence: number) {
  let digits = String(sequence).padStart(9, '0');
  for (const size of [9, 10])
    digits += String(
      (([...digits].reduce((n, d, i) => n + Number(d) * (size + 1 - i), 0) * 10) % 11) % 10,
    );
  return digits;
}
export function kioskDemoExample(organizationId: string) {
  const index = ['aurora', 'horizonte', 'regional'].indexOf(organizationId);
  return index < 0
    ? null
    : {
        cpf: demoCpf(index * 12 + 1),
        name: organizationId === 'horizonte' ? 'Ana Monteiro' : 'Ana Clara Martins',
        birthDate: '1988-03-14',
      };
}
