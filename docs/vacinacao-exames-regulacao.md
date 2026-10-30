# Vacinação, exames e regulação — versão 0.12

Use somente dados fictícios. Os acessos são sessões de demonstração; os registros ficam no navegador. Não há autenticação real, sincronização entre dispositivos nem auditoria protegida de produção.

## Vacinação

1. Entre como **Enfermagem**, Rede Aurora, UBS Centro, e abra **Sala de vacinação**.
2. Busque uma pessoa pelo nome, CPF com ou sem pontuação ou cadastro. A caderneta e as ações de aplicação, transcrição e aprazamento permanecem disponíveis.
3. Em **Aprazar retorno**, preencha imunobiológico e dose fictícios, data e orientação. Para testar o filtro, use a data de hoje.
4. Clique no cartão **Previstos hoje**. Em um retorno pendente, escolha **Registrar contato**, selecione o resultado e descreva o contato fictício. Salve.
5. Abra **Contatos registrados** e confira resultado, nota, autoria e horário. Recarregue a página: o registro permanece. Data e situação do retorno não mudam; nenhum estoque é movimentado.
6. Use a busca por pessoa ou vacina e os filtros de pendentes, hoje e atraso. Retornos cancelados ou concluídos preservam contatos anteriores e não recebem novos contatos.

O registro é manual e não dispara telefone, WhatsApp, SMS ou e-mail. Um formulário aberto antes de outro contato ou reagendamento é recusado, evitando sobrescrita. Calendário vacinal validado, rede de frio completa e integração oficial continuam pendentes.

## Exames

1. Entre como **Equipe médica** e emita um pedido fictício pelo consultório: iniciar atendimento, **Pedir exames**, salvar rascunho, revisar e **Emitir demonstração**.
2. Abra **Exames e resultados**. No pedido, escolha **Registrar agendamento** e informe data, horário e local fictícios.
3. Use **Reagendar**. Altere pelo menos data, horário ou local e preencha **Motivo do reagendamento**. O agendamento mais recente fica destacado no cartão; os anteriores permanecem no histórico.
4. Confira os filtros por etapa. **Data prevista ultrapassada** mostra exames ainda agendados com data anterior à atual; não presume ausência ou realização. A lista de cancelados é separada.
5. O percurso de realização, transcrição de resultado e revisão médica permanece disponível. Documentos emitidos e resultados anteriores não são reescritos.

O agendamento é local e não reserva vaga em laboratório. Integração com prestadores, laudos assinados, protocolos e validação clínica continuam pendentes.

## Regulação

1. Entre como **Regulação**, na mesma prefeitura e unidade. Abra **Regulação**.
2. Escolha um encaminhamento solicitado e registre seu agendamento com data, horário e destino. Também é possível criar uma solicitação fictícia pelo botão **Novo encaminhamento**.
3. Em **Reagendar**, altere data, horário ou destino e informe o motivo. Em **Detalhes**, confira os valores anteriores e novos, autoria, horário e justificativa.
4. Recarregue a página para conferir a persistência. Use os cartões e a lista de situação para localizar solicitações, agendados, datas ultrapassadas e retornos registrados.
5. Registre a contrarreferência fictícia em **Registrar retorno**. O encaminhamento concluído conserva o histórico e deixa de permitir reagendamento. Cancelados também não podem ser reagendados.

A remarcação não altera o documento clínico emitido no consultório, não notifica a pessoa e não reserva vagas externas. Autorização, integração oficial e recebimento automático de contrarreferência continuam pendentes.

## Verificação técnica

Testes verificam contexto de prefeitura/unidade/perfil, estado pendente/finalizado, motivos obrigatórios, mudança efetiva, formulários desatualizados, preservação documental e rejeição de histórico inválido. Os percursos de navegador cobrem gravação, recarga, filtros, busca por CPF com pontuação e os HTMLs offline em tela móvel. Executar `pnpm test`, `pnpm build`, `pnpm build:html` e `pnpm test:e2e` antes de publicar.

A comparação com o Pulso continua com 1 tela demonstrável, 44 percursos parciais e 1 tela adaptada. Esta entrega avança esses módulos; não os declara completos ou homologados.
