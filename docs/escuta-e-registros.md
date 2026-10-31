# Escuta, aferições e complementos — versão 0.3

Este documento descreve a entrega 0.3. O [roteiro atual da escuta](escuta-fila-salas.md) inclui classificação manual, reavaliação e encaminhamentos da versão 0.14.

## Percurso para experimentar

1. Selecione uma unidade e o perfil Enfermagem, Equipe médica ou Administração.
2. Abra **Escuta e sinais vitais**, escolha uma pessoa na fila e registre o motivo da procura. O mesmo acesso está disponível em Recepção e atendimento.
3. Preencha apenas as medidas disponíveis: pressão arterial, frequência cardíaca e respiratória, temperatura, saturação, peso e altura. Campos vazios permanecem sem registro; não recebem valores anteriores automaticamente.
4. Salve a escuta. Ela aparece no histórico, com horário de registro e perfil demonstrativo. A consulta ainda não foi iniciada.
5. Para uma nova aferição, use o formulário vazio. Para corrigir um erro anterior, use **Registrar correção** no item correspondente e informe o motivo. O original continua visível e recebe a indicação de substituição.
6. Use **Iniciar atendimento** ou **Continuar atendimento**. A equipe consulta a escuta junto ao SOAP, sem copiar medidas entre documentos.
7. Depois de concluir o SOAP, use **Complementos do registro** para acrescentar informações com justificativa. O texto finalizado continua intacto.

O histórico da pessoa reúne escutas, aferições e complementos da mesma rede, indicando a unidade de origem. A recepção, farmácia, regulação e gestão não recebem esses conteúdos na projeção demonstrativa. A TV continua mostrando somente os dados de chamada.

## Persistência e correções

A base local passa do formato 2 para o 3, acrescentando as coleções de escutas e complementos. Cadastros, agendamentos, notas, chamadas e demais dados existentes são preservados. Bases do formato 1 passam pelas duas migrações. A migração só é gravada na próxima operação bem-sucedida.

Escutas e complementos não têm comando de edição ou exclusão. Uma correção referencia um registro anterior do mesmo atendimento, exige motivo e admite uma única sucessora direta. Uma nova correção parte da versão mais recente. Registros de atendimentos concluídos permitem correções, mas não novas aferições. Complementos são permitidos apenas em notas finalizadas e na unidade de origem.

Cada medida pertence ao seu registro. A hora exibida é a hora de **registro no sistema**, não uma hora de medição retroativa. Há proteção de formulário não salvo, detecção de alteração concorrente e preservação da base quando o armazenamento falha.

## Limites desta entrega

Os limites numéricos verificam formato, precisão e capacidade do campo; não são faixas de normalidade nem regras assistenciais. Não há classificação de risco, alertas clínicos, interpretação dos valores, cálculo de diagnóstico, decisão de conduta ou assinatura digital. O processo de enfermagem e a reavaliação clínica completa permanecem no escopo a desenvolver e validar.

A autoria atual identifica o perfil de demonstração, não um profissional autenticado. O armazenamento continua no navegador, sem sincronização entre computadores. O HTML serve para experimentar os fluxos com dados fictícios.

## Verificação

Testes de domínio cobrem validação, permissões, isolamento de rede e unidade, preservação de originais, cadeias de correção, complementos, migração, conflito entre abas e falha de armazenamento. Os testes de navegador percorrem escuta até complemento, verificam proteção de rascunhos, uso em UPA, layout móvel e persistência no HTML sem internet. Os percursos anteriores de TV, agenda, farmácia, regulação e leitos continuam na suíte.
