import { expect, it } from 'vitest';
import { csvRows } from '../data/csv';
it('exporta texto livre como célula literal, inclusive com espaços e tabulação', () => {
  for (const value of ['=1+1', '  @SUM(A1)', '\tCMD', '\n +1', '\r=1', '\uFF1D1+1', '\u0000-2']) {
    expect(csvRows([[value]])).toBe('"\'' + value + '"');
  }
  expect(csvRows([[-2, 'C; "A"']])).toBe('"-2";"C; ""A"""');
});
