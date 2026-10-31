import { PharmacyReceipt } from './pages/PharmacyReceipt';
import { ClinicalDocumentPrint } from './pages/ClinicalDocumentPrint';
import { UnitQueue } from './pages/UnitQueue';
import { ExamFollowUp } from './pages/ExamFollowUp';
import { StrictMode, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, createHashRouter, RouterProvider, Link } from 'react-router-dom';
import { AppProvider, useApp } from './app/context';
import { Shell } from './app/Shell';
import { can, type Permission } from './domain/model';
import { EmptyState } from './components/ui';
import { Dashboard } from './pages/Dashboard';
import { Patients, PatientDetails } from './pages/Patients';
import { Agenda } from './pages/Agenda';
import { Reception } from './pages/Reception';
import { EncounterPage } from './pages/Encounter';
import { IntakePage, IntakeQueue } from './pages/Intake';
import { Vaccination } from './pages/Vaccination';
import { VaccineStock } from './pages/VaccineStock';
import { VaccinationManagement } from './pages/VaccinationManagement';
import { Hospital } from './pages/Hospital';
import { Pharmacy } from './pages/Pharmacy';
import { Referrals } from './pages/Referrals';
import { Units, Audit, Integrations, Development } from './pages/Management';
import { QueueControl, QueueDisplay } from './pages/QueueDisplay';
import { Coverage } from './pages/Coverage';
import { isPortable } from './app/links';
import './styles/tokens.css';
import './styles/app.css';
import './styles/patient-flow.css';
import './styles/refinement.css';
import './styles/access.css';
import './styles/operations.css';
import './styles/care-workspaces.css';
import './styles/continuity-workspaces.css';
import './styles/unit-queue.css';
import './styles/paired-tv.css';
import { Access, WorkspaceHome } from './pages/Access';
import { Devices, Kiosk } from './pages/Kiosk';
import { ConsultingRoom, Performance } from './pages/PatientFlow';
import { ModulesHub, WorkPage, WorkReport } from './pages/WorkModules';

function Home() {
  const { context } = useApp();
  return context.role === 'manager' ? (
    <Dashboard />
  ) : context.role === 'business' || context.role === 'acs' ? (
    <ModulesHub />
  ) : (
    <WorkspaceHome />
  );
}

function Gate({ permission, children }: { permission: Permission; children: ReactNode }) {
  const { context, demoEntered } = useApp();
  if (!demoEntered) return <Access resume />;
  return can(context.role, permission) ? (
    children
  ) : (
    <EmptyState
      title="Este módulo não faz parte do perfil selecionado"
      description="Sua sessão não permite acessar este módulo. Para testar outro perfil, use a entrada de demonstração."
      action={
        <Link className="button secondary" to="/acesso">
          Escolher acesso de demonstração
        </Link>
      }
    />
  );
}
const protect = (permission: Permission, node: ReactNode) => (
  <Gate permission={permission}>{node}</Gate>
);
const router = (isPortable() ? createHashRouter : createBrowserRouter)([
  { path: '/tv', element: <QueueDisplay paired /> },
  { path: '/painel', element: <QueueDisplay /> },
  { path: '/totem', element: <Kiosk /> },
  { path: '/acesso', element: <Access /> },
  { path: '/login', element: <Access /> },
  { path: '/dispensacoes/:id', element: protect('dispensation.read', <PharmacyReceipt />) },
  { path: '/documentos/:id', element: protect('clinical', <ClinicalDocumentPrint />) },
  {
    path: '/',
    element: <Shell />,
    errorElement: (
      <div className="app-error">
        <img src="/brand/marca.svg" alt="Cuidelo" />
        <h1>Não foi possível abrir esta tela</h1>
        <p>
          Recarregue o ambiente. Se o problema continuar, preserve os dados locais e informe o que
          estava fazendo.
        </p>
        <a className="button primary" href={isPortable() ? '#/' : '/'}>
          Voltar ao início
        </a>
      </div>
    ),
    children: [
      { index: true, element: <Home /> },
      { path: 'modulos', element: <ModulesHub /> },
      { path: 'modulos/:module', element: <WorkPage /> },
      { path: 'paineis/:report', element: <WorkReport /> },
      { path: 'exames', element: protect('clinical', <ExamFollowUp />) },
      { path: 'fila', element: protect('queue', <UnitQueue />) },
      { path: 'consultorio', element: protect('clinical', <ConsultingRoom />) },
      { path: 'desempenho', element: protect('performance', <Performance />) },
      { path: 'dispositivos', element: protect('devices', <Devices />) },
      { path: 'pessoas', element: protect('patients.read', <Patients />) },
      { path: 'pessoas/:id', element: protect('patients.read', <PatientDetails />) },
      { path: 'agenda', element: protect('schedule', <Agenda />) },
      { path: 'recepcao', element: protect('queue', <Reception />) },
      { path: 'escuta', element: protect('clinical', <IntakeQueue />) },
      { path: 'escuta/:id', element: protect('clinical', <IntakePage />) },
      { path: 'vacinacao', element: protect('vaccination', <Vaccination />) },
      { path: 'vacinas-estoque', element: protect('vaccine.stock', <VaccineStock />) },
      { path: 'vacinacao-rede', element: protect('manage', <VaccinationManagement />) },
      { path: 'senhas', element: protect('queue', <QueueControl />) },
      { path: 'comparacao', element: <Coverage /> },
      { path: 'atendimento/:id', element: protect('clinical', <EncounterPage />) },
      { path: 'hospital', element: protect('beds', <Hospital />) },
      { path: 'farmacia', element: protect('stock', <Pharmacy />) },
      { path: 'regulacao', element: protect('regulation', <Referrals />) },
      { path: 'unidades', element: protect('network', <Units />) },
      { path: 'auditoria', element: protect('manage', <Audit />) },
      { path: 'integracoes', element: <Integrations /> },
      { path: 'desenvolvimento', element: <Development /> },
      {
        path: '*',
        element: (
          <EmptyState
            title="Página não encontrada"
            description="Escolha um módulo pelo menu para continuar."
            action={
              <Link className="button secondary" to="/">
                Voltar ao início
              </Link>
            }
          />
        ),
      },
    ],
  },
]);

if (import.meta.env.VITE_DATA_MODE && import.meta.env.VITE_DATA_MODE !== 'demo')
  throw new Error('Este build suporta apenas o adaptador de demonstração.');
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProvider>
      <RouterProvider router={router} />
    </AppProvider>
  </StrictMode>,
);
