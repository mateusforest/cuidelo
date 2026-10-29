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
import { can } from '../domain/model';

type Toast = { id: number; message: string; kind: 'success' | 'error' };
interface AppValue {
  context: Context;
  changeContext: (patch: Partial<Context>) => void;
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
export function AppProvider({ children }: { children: ReactNode }) {
  const [repository] = useState(browserRepository);
  const [context, setContext] = useState<Context>(() => {
    const initial: Context = { organizationId: 'aurora', unitId: 'all', role: 'admin' };
    try {
      const value = localStorage.getItem(preferenceKey);
      if (value) {
        const parsed = JSON.parse(value) as Context;
        repository.snapshot(parsed);
        return parsed;
      }
    } catch {
      /* Preferências inválidas voltam ao contexto inicial. */
    }
    return initial;
  });
  const revision = useSyncExternalStore(repository.subscribe, repository.getRevision);
  const [toast, setToast] = useState<Toast | null>(null);
  const [dirty, setDirty] = useState(false);
  const data = useMemo(() => repository.snapshot(context), [repository, context, revision]);
  const summary = useMemo(() => repository.summary(context), [repository, context, revision]);
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
    if (
      dirty &&
      !window.confirm('Há um rascunho não salvo. Deseja descartá-lo e trocar de contexto?')
    )
      return;
    const next = { ...context, ...patch };
    const units = repository
      .directory()
      .units.filter((u) => u.organizationId === next.organizationId);
    if (patch.organizationId && patch.organizationId !== context.organizationId)
      next.unitId = can(next.role, 'manage') ? 'all' : units[0].id;
    if (next.unitId === 'all' && !can(next.role, 'manage')) next.unitId = units[0].id;
    if (next.unitId !== 'all' && !units.some((u) => u.id === next.unitId))
      next.unitId = units[0].id;
    setDirty(false);
    setContext(next);
  };
  const notify = (message: string, kind: Toast['kind'] = 'success') =>
    setToast({ id: Date.now(), message, kind });
  return (
    <AppContext
      value={{
        context,
        changeContext,
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
