# Vacinação — versão 0.4

## O que já pode ser experimentado

Na **Sala de vacinação**, escolha uma pessoa da rede. O histórico reúne aplicações feitas nas unidades e transcrições de comprovantes, mantendo as origens distintas. Também aparece no prontuário da pessoa.

**Registrar aplicação** exige um lote disponível, com saldo e validade, e os dados informados pelo profissional: dose, via, local de aplicação, estratégia, grupo e vacinador. A operação salva o registro e baixa exatamente uma dose em uma única gravação local. Aplicações com baixa nesta versão são registradas no dia; o registro tardio de uma aplicação da própria unidade ainda exige um fluxo de reconciliação a desenvolver. Transcrição não substitui esse fluxo.

**Transcrever caderneta** permite registrar um comprovante anterior, identificando a sua origem. Não baixa estoque e não conta como uma aplicação realizada pela unidade. A data deve estar entre o nascimento da pessoa e a data atual. Não é possível registrar duas vezes, na mesma rede, a mesma pessoa, imunobiológico, dose e data sem antes revisar o registro existente.

**Aprazar retorno** registra vacina, dose, data e orientação informadas pelo profissional. A lista permite consultar pendências e atrasos, reagendar com motivo, cancelar e abrir o histórico das alterações. Uma aplicação pode ser vinculada ao retorno correspondente e concluí-lo. Não há cálculo de esquema ou envio de mensagem.

**Anular registro** exige justificativa e conserva o conteúdo original. A anulação não devolve a dose ao estoque: uma correção documental não comprova que a aplicação física deixou de ocorrer. Um retorno vinculado é reaberto para acompanhamento. Caso outro aprazamento para a mesma pessoa, vacina e dose já esteja pendente, a equipe precisa revisar os retornos antes da reabertura. Correção documental com substituição vinculada e reconciliação de estoque permanece no escopo a completar.

Em **Lotes de vacinas**, cadastre recebimentos e registre entradas, perdas, quarentena e liberação justificada. O estoque é expresso em doses e separado da farmácia geral. Lotes vencidos admitem perda/descarte, mas não novas entradas ou aplicações. A quarentena bloqueia aplicação até uma liberação informada pelo responsável. Não há avaliação automática da conservação.

Em **Vacinação da rede**, a gestão consulta aplicações válidas no mês, registros dessa competência anulados, retornos pendentes e atrasados, com totais por unidade e imunobiológico. A competência usa a data da aplicação, inclusive para identificar registros anulados do mês; a data de anulação pode ser posterior. Transcrições são apresentadas separadamente. A visão gerencial não recebe nomes, prontuários ou conteúdo da caderneta. Esses totais representam produção demonstrativa, não cobertura vacinal populacional.

## Perfis, histórico e dados anteriores

Enfermagem, Equipe médica e Administração acessam a sala e seus registros. Farmácia acessa os lotes e movimentos sem receber a caderneta. Gestão recebe os indicadores agregados. A escrita exige a rede e a unidade corretas; a leitura clínica do histórico acompanha a pessoa dentro da mesma rede. Anulações são permitidas somente na unidade de origem.

A base local migra do formato 3 para o 4, preservando os dados anteriores e acrescentando cinco coleções de vacinação vazias. Nenhum lote é inventado em uma base já existente. Para testar após a atualização, cadastre um lote fictício. Cenários novos têm lotes fictícios de exemplo, incluindo um vencido, para verificar os bloqueios. Não é necessário redefinir a demonstração para acessar o módulo.

Os formulários avisam antes de descartar dados não salvos. Conflitos entre abas e falhas de gravação não publicam uma aplicação sem sua baixa de estoque. O carregamento verifica vínculos e conciliação entre saldos e movimentos.

## Pendências para completar o módulo operacional

- Catálogos e códigos oficiais versionados, identificação CNS/CPF/CNES, vínculo e credenciais do profissional, condição maternal e demais campos condicionais do modelo vigente.
- Calendário vacinal e regras clínicas validados, contraindicações, intervalos, esquemas especiais e tratamento de exceções.
- Registro tardio com reconciliação, correções documentais vinculadas, frascos multidose, validade após abertura, transferências e inventário físico.
- Rede de frio completa: equipamentos, temperaturas, alarmes, ocorrências, avaliação técnica e destinação de lotes.
- Eventos adversos, vigilância, campanhas, coberturas com denominadores e metas revisadas.
- Autenticação real, persistência protegida, autorização no servidor, integração oficial, rejeições, retificações e conciliação. O seletor de perfil e o nome informado não autenticam um profissional.

## Referência de informação

Os campos gerais de vacina, dose, fabricante, lote, data, local e identificação profissional foram conferidos no [Modelo de Informação de Vacinação do Ministério da Saúde](https://sisaps.saude.gov.br/sistemas/siaps/docs/modelos/Procedimentos/miv/), consultado em 29/10/2026. O modelo também distingue a transcrição de caderneta. Esta implementação local não cobre todo o modelo, não usa suas terminologias oficiais e não constitui integração ou homologação.

## Verificação

Os testes cobrem baixa de dose, validade, quarentena, saldo, duplicidades, transcrição, anulação preservada, retorno e reabertura, permissões, isolamento, migração, conflito, falha de gravação e dados inválidos. Os percursos no navegador verificam sala, estoque, prontuário, gestão, formulário não salvo e funcionamento do HTML sem internet em tela móvel.
