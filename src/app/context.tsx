import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import type { Context, Snapshot, Summary } from '../domain/model';
import type { CareRepository } from '../data/repository';
import { browserRepository } from '../data/demo-repository';
import { storageKey } from '../data/demo-repository';
import { demoContext, demoIdentities, identityFor } from '../domain/access';

type Toast = { id: number; message: string; kind: 'success' | 'error' };
interface AppValue {
  context: Context;
  changeContext: (patch: Partial<Context>) => void;
  chooseSession: (sessionId: string) => void;
  demoEntered: boolean;
  data: Snapshot;
  summary: Summary;
  repository: CareRepository;
  revision: number;
  toast: Toast | null;
  notify: (message: string, kind?: Toast['kind']) => void;
  dirty: boolean;
  setDirty: (value: boolean) => void;
}
const AppContext = createContext<AppValue | null>(null);
const preferenceKey = 'cuidelo.demo.context.v1';
const entryKey = 'cuidelo.demo.entry.v1';
export function AppProvider({ children }: { children: ReactNode }) {
  const [repository] = useState(browserRepository);
  const [context, setContext] = useState<Context>(() => {
    const initial = demoContext('aurora', 'all', 'manager');
    try {
      const value = localStorage.getItem(preferenceKey);
      if (value) {
        let parsed = JSON.parse(value) as Context;
        if (!parsed.sessionId)
          parsed = demoContext(
            parsed.organizationId,
            parsed.unitId === 'all' && parsed.role !== 'manager'
              ? repository
                  .directory()
                  .units.find((u) => u.organizationId === parsed.organizationId)!.id
              : parsed.unitId,
            parsed.role,
          );
        repository.snapshot(parsed);
        return parsed;
      }
    } catch {
      /* Preferências inválidas voltam ao contexto inicial. */
    }
    return initial;
  });
  // Preferência de navegação da demonstração; não representa autenticação.
  const [demoEntered, setDemoEntered] = useState(() => {
    try {
      return localStorage.getItem(entryKey) === context.sessionId;
    } catch {
      return false;
    }
  });
  const storageWarning = useSyncExternalStore(
    repository.subscribe,
    () => repository.recoveryMessage,
  );
  const revision = useSyncExternalStore(repository.subscribe, repository.getRevision);
  useEffect(() => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === null || event.key === storageKey) repository.refresh();
    };
    const onFocus = () => repository.refresh();
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', onFocus);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', onFocus);
    };
  }, [repository]);
  const [toast, setToast] = useState<Toast | null>(null);
  const [dirty, setDirty] = useState(false);
  const data = useMemo(
    () => repository.snapshot(context),
    [repository, context, revision, storageWarning],
  );
  const summary = useMemo(
    () => repository.summary(context),
    [repository, context, revision, storageWarning],
  );
  useEffect(() => {
    try {
      localStorage.setItem(preferenceKey, JSON.stringify(context));
    } catch {
      /* A sessão permanece utilizável sem preferências persistentes. */
    }
  }, [context]);
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);
  const changeContext = (patch: Partial<Context>) => {
    if (Object.keys(patch).some((key) => key !== 'unitId')) {
      notify('Troque de sessão pela entrada de demonstração.', 'error');
      return;
    }
    if (
      dirty &&
      !window.confirm('Há um rascunho não salvo. Deseja descartá-lo e trocar de contexto?')
    )
      return;
    const next = { ...context, ...patch };
    try {
      identityFor(repository.directory(), next);
      repository.snapshot(next);
    } catch (e) {
      notify((e as Error).message, 'error');
      return;
    }
    setDirty(false);
    setContext(next);
  };
  const notify = (message: string, kind: Toast['kind'] = 'success') =>
    setToast({ id: Date.now(), message, kind });
  const chooseSession = (sessionId: string) => {
    const identity = demoIdentities(repository.directory()).find((i) => i.sessionId === sessionId);
    if (!identity) return;
    setDirty(false);
    setContext(identity);
    setDemoEntered(true);
    try {
      localStorage.setItem(entryKey, identity.sessionId);
    } catch {
      /* A escolha continua válida nesta aba sem armazenamento. */
    }
  };
  return (
    <AppContext
      value={{
        context,
        changeContext,
        chooseSession,
        demoEntered,
        data,
        summary,
        repository,
        revision,
        toast,
        notify,
        dirty,
        setDirty,
      }}
    >
      {children}
    </AppContext>
  );
}
export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('AppProvider ausente');
  return value;
}
