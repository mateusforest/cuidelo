export { Kiosk } from './KioskScreen';
import { useApp } from '../app/context';
import { Notice, PageHeader, Panel, UnitRequired } from '../components/ui';
import { displayRoute, externalRoute } from '../app/links';

export function Devices() {
  const { context, data } = useApp();
  const unit = data.units.find((u) => u.id === context.unitId);
  return (
    <>
      <PageHeader
        eyebrow="TELAS DA UNIDADE"
        title="Totem e TV"
        description="Abra as telas públicas vinculadas a esta unidade. Nenhum prontuário aparece nesses dispositivos."
      />
      <UnitRequired>
        <Panel title={unit?.name}>
          <div className="panel-body">
            <div className="kiosk-actions">
              <a
                className="button primary"
                target="_blank"
                rel="noreferrer"
                href={externalRoute(
                  `/totem?rede=${context.organizationId}&unidade=${context.unitId}`,
                )}
              >
                Abrir totem de pré-atendimento
              </a>
              <a
                className="button secondary"
                target="_blank"
                rel="noreferrer"
                href={externalRoute(displayRoute(context.organizationId, context.unitId))}
              >
                Abrir painel da TV
              </a>
            </div>
            <p>
              Para testar a chamada ao vivo, abra a TV pelo mesmo HTML ou endereço do sistema e no
              mesmo navegador. Arquivos separados e computadores diferentes ainda não compartilham a
              fila.
            </p>
            <p>
              A senha pode ser impressa pela janela de impressão do navegador. A integração direta
              com a impressora do totem será validada com o equipamento.
            </p>
            <Notice>
              O totem registra a chegada; escuta, sinais vitais e avaliação de risco são
              responsabilidades da equipe. Nunca informe dados reais neste ambiente.
            </Notice>
          </div>
        </Panel>
      </UnitRequired>
    </>
  );
}
