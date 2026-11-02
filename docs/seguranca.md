# Segurança da demonstração Cuidelo 0.28

Revisão de 2 de novembro de 2026. O ambiente público e os HTMLs distribuídos são destinados a dados fictícios. O navegador contém a base de demonstração. Quem controla o equipamento pode ler ou alterar essa base, selecionar um perfil e manipular o relógio. A equipe não deve inserir dados de pacientes nem usar este ambiente para atendimento.

## O que mudou e como conferir

| Superfície | Proteção aplicada | Verificação reproduzível |
| --- | --- | --- |
| Estação da equipe | Há encerramento explícito, expiração por 15 minutos de inatividade e duração máxima de 8 horas. A nova versão exige outra entrada para perfis que ficaram abertos na 0.27. | Abra Pessoas em duas abas da mesma estação. Escolha **Encerrar sessão** no menu. As duas abas voltam à entrada. Entre de novo para conferir que o cadastro fictício continua salvo. |
| Prontuário compartilhado | O histórico da mesma prefeitura inclui orientações enviadas. Outra unidade não recebe os códigos de acompanhamento nem os rascunhos do colega. As respostas ao relatório exigem uma unidade médica prevista na rede e a autorização do compartilhamento. | Os testes de domínio consultam o histórico como autor, outra UBS, outra prefeitura e recepção. Os do servidor verificam unidade inventada, central de distribuição e autorização de outro relatório. |
| APIs da TV, remessas, cidadão e avisos | Só aceitam comandos JSON, campos previstos e corpos dentro do limite em bytes. A leitura ou gravação protegida usa credenciais específicas de cada canal. O arquivo portátil precisa da exceção de origem para abrir serviços pela internet. | Os testes de segurança tentam enviar texto livre, campos extras, corpo excessivo, origem externa e recebimento de remessa sem credencial. O teste de remessas usa dois navegadores independentes. |
| Navegador e arquivos | O site restringe scripts à própria origem, bloqueia a exibição dentro de outros sites e evita o envio do endereço de origem na navegação. O HTML portátil permite apenas os scripts previstos na geração do arquivo e os três serviços públicos que utiliza. | O teste abre o HTML e tenta executar um script inserido na página. Também verifica o carregamento da aplicação, da TV, do totem e do guia. |
| Relatórios CSV | Campos livres com início de fórmula, inclusive após espaços, são exportados como texto. | O teste cobre fórmulas, tabulações, aspas, separadores e números negativos. |
| Dependências e publicação | Foram corrigidas as versões transitivas de Zod e minimatch. A integração contínua verifica avisos moderados ou superiores e padrões conhecidos de credenciais. A compilação recusa um modo de dados diferente de demonstração. | Execute `pnpm audit`, `pnpm test`, `pnpm build`, `pnpm build:html`, `node scripts/verify-secrets.mjs` e `pnpm test:e2e`. |

O encerramento vale para a estação profissional. Links já concedidos ao cidadão têm revogação e prazo próprios. Chamadas públicas, remessas e notificações mantêm suas credenciais específicas. Ter acesso ao HTML ou escolher um perfil não comprova a identidade de um profissional.

Os alertas corrigidos tratam de esgotamento de recursos. A auditoria do gerenciador verifica avisos publicados para as versões resolvidas. Consulte os avisos de [Zod](https://github.com/advisories/GHSA-mrhx-c7xc-m3w5) e [minimatch](https://github.com/advisories/GHSA-g3hv-75wg-m249).

## Condições para usar dados reais

| Ordem | Entrega necessária | Evidência para o aceite |
| --- | --- | --- |
| 1 | Criar homologação privada separada da demonstração. Configurar identidade individual, segundo fator, vínculos por município, unidade e função, desligamento e recuperação de conta. | Duas prefeituras fictícias e dois médicos. Registrar entrada, expiração e revogação de sessões no servidor. Uma credencial revogada deve falhar mesmo em outra estação. |
| 2 | Mover as consultas e alterações para um serviço autorizado e uma base protegida. Derivar os vínculos da identidade verificada em cada operação. Separar o acesso do cidadão, do profissional, da gestão e dos dispositivos. | Testar troca de identificadores na própria requisição, leitura individual e em lote, exportação, acesso de outra prefeitura e acesso ao prontuário fora da finalidade prevista. Conferir que o navegador recebe apenas os registros autorizados. |
| 3 | Registrar acessos, alterações e exportações fora do navegador. Definir acesso aos registros, retenção, rotação de chaves e alertas de abuso sem copiar conteúdo clínico para os logs. | Rastrear um acesso e uma correção por responsável. Demonstrar que o perfil assistencial não consegue apagar a trilha. Confirmar um alerta de teste e seu encaminhamento. |
| 4 | Configurar backups protegidos, recuperação e resposta a incidentes com a prefeitura. Definir prazos de recuperação e perda aceitável de dados. | Restaurar uma cópia em ambiente isolado, medir o tempo, conferir a integridade e ensaiar revogação de credencial e contenção de uma estação comprometida. |
| 5 | Fazer teste independente no ambiente autorizado e obter o aceite operacional e de privacidade da instituição. | Retestar os achados e registrar versão, responsáveis e decisão de liberação. |

A equipe de desenvolvimento responde pelas correções e pelas evidências técnicas. A prefeitura precisa indicar os responsáveis pelos acessos, privacidade, contingência e liberação do atendimento. A aprovação para uso clínico permanece pendente.
