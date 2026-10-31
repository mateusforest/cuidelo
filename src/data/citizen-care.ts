import {
  applyCare,
  careKey,
  freshDiary,
  type CareCommand,
  type CareScope,
  type Diary,
} from '../domain/citizen-care';
import type { PatientGuidance } from '../domain/report-review';
import type { CitizenView } from '../domain/citizen';
let database: Promise<IDBDatabase> | undefined;
function open() {
  if (!database)
    database = new Promise<IDBDatabase>((resolve, reject) => {
      const req = indexedDB.open('cuidelo.citizen.care.v1', 2);
      req.onupgradeneeded = (event) => {
        if (event.oldVersion < 1) {
          req.result.createObjectStore('journals');
          req.result.createObjectStore('subjects');
        }
        req.result.createObjectStore('guidance');
      };
      req.onsuccess = () => {
        const db = req.result;
        db.onversionchange = () => {
          db.close();
          database = undefined;
        };
        resolve(db);
      };
      req.onerror = () => reject(Error('O navegador não conseguiu abrir o diário neste aparelho.'));
      req.onblocked = () => reject(Error('Feche as outras abas do Cuidelo e tente novamente.'));
    }).catch((e) => {
      database = undefined;
      throw e;
    });
  return database;
}
// A leitura, a validação do comando e a gravação pertencem à mesma transação entre abas.
export interface GuidanceInbox {
  handles: { owner: string; expires: number; settled: boolean }[];
  messages: PatientGuidance[];
}
interface Tables {
  guidance: GuidanceInbox;
  journals: Diary;
  subjects: string;
}
async function transaction<K extends keyof Tables, T>(
  store: K,
  key: string,
  mode: IDBTransactionMode,
  work: (value: Tables[K] | undefined, save: (v: Tables[K]) => void) => T,
): Promise<T> {
  const db = await open();
  return new Promise<T>((resolve, reject) => {
    const tx = db.transaction(store, mode),
      table = tx.objectStore(store),
      req = table.get(key);
    let result: T, cause: unknown;
    req.onsuccess = () => {
      try {
        result = work(req.result, (value) => table.put(value, key));
      } catch (e) {
        cause = e;
        tx.abort();
      }
    };
    tx.oncomplete = () => resolve(result);
    tx.onabort = () =>
      reject(cause ?? Error('O diário não foi salvo. Confira o armazenamento do navegador.'));
  });
}
export const guidanceInbox = (scope: CareScope) =>
  transaction('guidance', careKey(scope), 'readonly', (v) => v ?? { handles: [], messages: [] });
export async function trackGuidance(scope: CareScope, owner: string, expires: number) {
  return transaction('guidance', careKey(scope), 'readwrite', (v, save) => {
    const box = v ?? { handles: [], messages: [] };
    if (!box.handles.some((h) => h.owner === owner)) {
      box.handles.push({ owner, expires, settled: false });
      save(box);
    }
  });
}
export async function mergeGuidance(
  scope: CareScope,
  owner: string,
  rows: PatientGuidance[],
  checkedAt: number,
) {
  return transaction('guidance', careKey(scope), 'readwrite', (v, save) => {
    const handle = v?.handles.find((h) => h.owner === owner);
    if (!v || !handle) return;
    const existing = new Set(v.messages.map((m) => m.id));
    for (const row of rows)
      if (!existing.has(row.id)) {
        v.messages.push(row);
        existing.add(row.id);
      }
    if (checkedAt > handle.expires + 120000) handle.settled = true;
    v.messages.sort((a, b) => b.at.localeCompare(a.at));
    save(v);
  });
}
export function subjectFor(organization: string, patient: string) {
  return transaction(
    'subjects',
    JSON.stringify([organization, patient]),
    'readwrite',
    (existing, save) => {
      if (existing !== undefined) {
        if (typeof existing !== 'string' || !/^share:[a-f0-9-]{36}$/.test(existing))
          throw Error('Vínculo local indisponível.');
        return existing;
      }
      const ref = 'share:' + crypto.randomUUID();
      save(ref);
      return ref;
    },
  );
}
function current(value: Diary | undefined) {
  if (value === undefined) return freshDiary();
  if (
    value.version !== 1 ||
    ![value.entries, value.conditions, value.plans, value.doses, value.steps].every(
      Array.isArray,
    ) ||
    !value.notified
  )
    throw Error('Não foi possível ler o diário salvo. Os dados foram preservados.');
  return value;
}
export const readDiary = (scope: CareScope) =>
  transaction('journals', careKey(scope), 'readonly', current);
function openBus() {
  try {
    return typeof BroadcastChannel === 'undefined' ? null : new BroadcastChannel('cuidelo-care');
  } catch {
    return null;
  }
}
export async function writeDiary(scope: CareScope, cmd: CareCommand, view: CitizenView) {
  const key = careKey(scope);
  const changed = await transaction('journals', key, 'readwrite', (stored, save) => {
    const d = current(stored);
    if (!applyCare(scope, d, cmd, view, new Date())) return false;
    save(d);
    return true;
  });
  if (changed) {
    window.dispatchEvent(new CustomEvent('cuidelo-care-change', { detail: key }));
    const bus = openBus();
    try {
      bus?.postMessage(key);
    } catch {
      /* A gravação já foi confirmada. */
    } finally {
      bus?.close();
    }
  }
  return changed;
}
export function watchDiary(scope: CareScope, fn: () => void) {
  const key = careKey(scope),
    event = (e: Event) => {
      if ((e as CustomEvent).detail === key) fn();
    };
  const bus = openBus();
  if (bus)
    bus.onmessage = (e) => {
      if (e.data === key) fn();
    };
  window.addEventListener('cuidelo-care-change', event);
  window.addEventListener('focus', fn);
  return () => {
    window.removeEventListener('cuidelo-care-change', event);
    window.removeEventListener('focus', fn);
    bus?.close();
  };
}
