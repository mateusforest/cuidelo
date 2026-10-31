export function reportCode(owner: string): Promise<string>;
export function normalizeReportCode(code: string): string;
export function reportReader(code: string): Promise<string>;
export function reportCipherKey(code: string): Promise<Uint8Array<ArrayBuffer>>;
export function reportBinding(org: string, subject: string, legacy?: boolean): Promise<string>;
