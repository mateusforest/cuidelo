// Uma planilha pode interpretar fórmulas mesmo quando a célula está entre aspas.
export function csvRows(rows: unknown[][]) {
  return rows
    .map((row) =>
      row
        .map((value) => {
          const text = String(value ?? '');
          const formula =
            typeof value === 'string' &&
            /^(?:[\t\r\n]|[\s\u0000-\u001f]*[=+@\-\uFF1D\uFF0B\uFF20\uFF0D])/.test(text);
          return '"' + (formula ? "'" : '') + text.replaceAll('"', '""') + '"';
        })
        .join(';'),
    )
    .join('\r\n');
}
