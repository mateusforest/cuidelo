# Agenda, cadastro e triagem — versão 0.11

Use somente dados fictícios. Os acessos continuam sendo sessões de demonstração; alterações ficam no navegador. O histórico local não constitui auditoria protegida de produção.

## Agenda

1. Entre como **Recepção**, Rede Aurora, UBS Centro. Abra **Agenda**.
2. Use data, profissional, busca e cartões de situação para localizar um horário pendente. Em uma base recém-criada, Beatriz Fernandes tem consulta às 09:00 do dia da criação.
3. Clique em **Remarcar**, escolha outro horário disponível e informe o motivo. Após salvar, a agenda exibe a nova data e mantém **Histórico de remarcações**, com horário anterior, novo horário, autoria e motivo.
4. Tente usar um horário ocupado pela mesma pessoa ou profissional, inclusive em outra unidade da prefeitura: a operação é recusada. Intervalos adjacentes são aceitos. Outra prefeitura tem agenda independente.
5. Confirme a chegada. O atendimento mantém o vínculo com o agendamento, que passa a **Chegadas confirmadas**. Agendamentos com chegada registrada ou cancelados não podem ser remarcados.

A remarcação não envia avisos nem verifica escala ou disponibilidade contratada do profissional. Gestão de faltas, lista de espera e lembretes enviados ainda dependem de desenvolvimento. Um formulário antigo não sobrescreve uma remarcação já salva em outra aba.

## Cadastro de pacientes

1. Em **Pessoas e prontuários**, busque por nome civil, nome social, CPF ou cadastro. Os cartões permitem localizar quem não informou CPF ou telefone; a ausência desses campos não impede o cadastro.
2. Abra uma pessoa e clique em **Atualizar cadastro**. Recepção e administração da unidade possuem essa ação. A equipe médica consulta os dados sem editar a identificação.
3. Altere nome, nome social, CPF, nascimento ou contato e preencha **Motivo da atualização**. CPF informado precisa ser válido e único dentro da prefeitura.
4. Confira **Histórico cadastral**: antes, depois, motivo, autoria, unidade e data. Recarregue para confirmar a persistência.
5. Abra o mesmo cadastro em duas abas e deixe ambos os formulários abertos. Salve uma alteração na primeira; a tentativa de salvar o formulário antigo da segunda é recusada, orientando reabrir com os dados atuais.

O cadastro e seu histórico são compartilhados entre unidades da mesma prefeitura, conforme o perfil. Documentos já emitidos e registros clínicos finalizados não são reescritos. A atualização cadastral não une cadastros, não confirma documentos oficiais e não integra o cadastro nacional.

## Triagem / escuta

1. Entre como **Enfermagem**, na mesma unidade, e abra **Escuta e sinais vitais**.
2. Use os cartões **Aguardando escuta**, **Em escuta** e **Com escuta registrada**. Busca e data de chegada refinam a lista; a data é opcional.
3. Em uma pessoa aguardando, abra **Registrar escuta**. Chame a senha na TV e registre a entrada para iniciar a medição.
4. Volte à fila: a pessoa aparece em **Em escuta**, com **Continuar escuta**. A duração conta desde a entrada registrada.
5. Preencha a escuta e salve. O atendimento passa ao grupo com registro; chegada, início e duração permanecem visíveis. Novas aferições e correções justificadas preservam os registros anteriores.

As durações refletem os horários registrados na demonstração. Bases antigas sem início/fim completos exibem a ausência da medição. O filtro por etapa não é classificação de risco; protocolos, reavaliação clínica completa e homologação continuam pendentes. A TV se comunica apenas entre abas da mesma demonstração e navegador.

## Verificação técnica

Os testes cobrem isolamento de prefeitura/unidade, perfis, CPF duplicado, preservação documental, conflitos de agenda, estados após chegada/cancelamento, alterações simultâneas e recuperação de histórico inválido. Percursos de navegador verificam gravação, recarga, filtros, escuta em andamento e HTML offline em tela móvel. Executar `pnpm test`, `pnpm build`, `pnpm build:html` e `pnpm test:e2e` antes da publicação.
