# Perfis, totem e acompanhamento — Cuidelo 0.10.0

Esta entrega é um ambiente local de desenvolvimento com dados fictícios. O escopo de lançamento continua incluindo UBS, UPA, pronto atendimento e hospitais. As telas não substituem a implementação e a validação dos percursos clínicos, das integrações e da proteção em servidor.

## Acessos de demonstração

Na nova entrada, escolha o perfil, confira prefeitura e unidade e use **Entrar na demonstração**. A equipe médica possui um seletor com dois profissionais fictícios. O botão **Trocar sessão de demonstração** reabre a entrada e mantém a escolha atual como ponto de partida. Não há senha ou autenticação real nesta versão. A sessão do profissional permanece vinculada à sua unidade. Somente a prefeitura filtra unidades da própria rede; para explorar outra prefeitura é necessário abrir outra sessão no laboratório de acesso.

| Perfil                   | Área de trabalho                                                                                        |
| ------------------------ | ------------------------------------------------------------------------------------------------------- |
| Recepção                 | Cadastro, agenda, chegadas, identificação de senhas e chamadas                                          |
| Equipe médica            | Consultório, SOAP, histórico da prefeitura, chamada na TV e seus tempos                                 |
| Enfermagem               | Escuta, aferições, registros assistenciais, vacinação e seus tempos                                     |
| Farmácia                 | Estoques e lotes autorizados                                                                            |
| Regulação                | Agenda e encaminhamentos da unidade                                                                     |
| Agente de saúde          | Famílias, domicílios, microáreas, visitas e produção local                                              |
| Administração da unidade | Operação, indicadores, pendências e dispositivos da unidade; sem edição clínica                         |
| Prefeitura               | Indicadores agregados, unidades, qualidade, comunicação e vínculos da sua rede; sem edição clínica      |
| Operação da Cuidelo      | Carteira comercial, contratos, recebimentos anotados, implantação, suporte e equipe; sem dados de saúde |

O histórico clínico é compartilhado entre unidades **da mesma prefeitura**, conforme definido para o projeto. A escrita clínica e os comandos operacionais continuam restritos à unidade da sessão. Há dois profissionais médicos fictícios por unidade para testar autoria e bloqueio de atendimento simultâneo. Os controles locais não constituem autenticação ou proteção contra manipulação do navegador.

## Testar chegada, totem, TV e consulta

1. Na administração da unidade, abra **Totem e TV**. Use os links dessa página para testar todas as janelas pelo mesmo arquivo/endereço e navegador.
2. No totem, percorra identificação → serviço → preferência → conferência. Escolha CPF, nome ou atendimento pela recepção, avance com **Continuar** e revise em **Conferir minha senha**. Somente **Emitir minha senha** registra a chegada. Use **Voltar** ou **Alterar** para corrigir as escolhas antes de confirmar. A identificação usa CPF ou nome completo (civil ou social), junto da data de nascimento. Confere apenas o cadastro fictício local, sem consultar a Receita Federal ou CNS. Nomes iguais com o mesmo nascimento exigem conferência na recepção.
3. Quem não se identifica recebe uma senha para o balcão. A recepção seleciona o cadastro correspondente; o horário de chegada do totem é preservado.
4. A senha pode ser impressa pela janela de impressão do navegador, com recibo sem nome ou informação clínica. A comunicação direta com impressora térmica ainda depende do equipamento.
5. Na escuta, registre o início quando a pessoa entrar. Salvar a primeira avaliação registra o fim dessa etapa. Aferições posteriores e correções continuam preservadas.
6. No consultório, escolha o destino e use **Chamar / rechamar na TV**. Essa ação não inicia o tempo de consulta.
7. Use **Pessoa entrou · iniciar** para começar a medir o atendimento. O profissional pode chamar novamente pela própria ficha, preencher o SOAP e concluir.
8. Em UPA/hospital, encaminhar à observação encerra o período de consulta. Retomar cria outro período. A observação não entra na média de duração do profissional.
9. Confira **Tempos e desempenho**. O profissional vê seus próprios períodos; administração vê sua unidade; prefeitura vê a rede ou uma unidade selecionada.

O totem limpa os dados após 1 minuto de inatividade ou ao selecionar **Próxima pessoa**. Ele registra chegada e preferência administrativa; não faz classificação clínica de risco. O botão de ajuda orienta a procurar a equipe e não simula um chamado enviado.

## Como os tempos são calculados

- Recepção: chegada até início da escuta. Se não houver registro de escuta, até a primeira entrada em consulta.
- Escuta: início explícito até salvamento da primeira avaliação.
- Espera para consulta após escuta: fim da escuta até a primeira entrada em consulta.
- Consulta por profissional: períodos encerrados entre entrada/retomada e conclusão/observação. O painel informa o número de medições.
- Permanência: chegada até conclusão, incluindo as diferentes etapas.
- O filtro de datas seleciona atendimentos pela data da chegada. Períodos de profissionais são calculados dentro dessa seleção.

As bases antigas são migradas sem inventar horários ou autoria. Assumir um atendimento antigo começa a medir a partir da ação atual; o tempo anterior continua sem atribuição. Duração não é indicador isolado de qualidade clínica.

## Novos acompanhamentos

**Módulos e acompanhamentos** reúne pré-natal e encontros; vínculos; indicadores locais com evidências; preparação de produção; campanhas; lembretes; pendências; revisão humana; rascunhos da gestão; solicitações do cidadão; famílias e visitas. Cada registro tem situação, validações e histórico. Registros encerrados são preservados na lógica da demonstração.

O pré-natal possui vínculo com a pessoa e unicidade de acompanhamento aberto na prefeitura; a gestão recebe apenas contagens. DPP e informações clínicas são preenchidas pelo profissional, sem cálculo de risco ou recomendação automática.

Os agentes podem cadastrar domicílios, planejar visitas, registrar resultado ou ausência, acompanhar microáreas e consultar produção por período. O quadro territorial não é um mapa geográfico. A tela de envios mostra registros locais e a ausência de sincronização remota.

A operação da Cuidelo tem vínculos entre cliente, contrato, recebimento, implantação e suporte. Valores e recebimentos são anotações manuais, sem cobrança ou movimento bancário.

As 46 referências do Pulso agora apontam para uma base correspondente. **44 continuam parciais**. A comparação descreve as pendências específicas; formulários administrativos não substituem integração oficial, protocolo clínico, automação ou autenticação.

## Arquivos e continuidade

- `Cuidelo.html`: sistema e todos os percursos locais.
- `Cuidelo-TV.html`: prévia independente da televisão.
- `Cuidelo-Totem.html`: totem independente de demonstração da UBS Centro.

Arquivos diferentes podem ter armazenamentos separados. Para ver uma chamada atualizada entre janelas, abra TV e totem pelos links do **mesmo Cuidelo.html**, no mesmo navegador. Nada é sincronizado entre computadores.

Não foram conectados Supabase, autenticação, SUS, WhatsApp, assinatura digital ou dispositivos clínicos. Persistência protegida, continuidade de operação, validação profissional e teste de capacidade para 100 unidades continuam necessários antes de atendimento real.

## Atualização do totem em 0.5.1

Atendimento comum e preferencial aparecem como opções grandes; desde a versão 0.10 ficam na terceira etapa, após a escolha do serviço. O motivo é opcional: a pessoa pode escolher informar à recepção. Os exemplos incluem pessoas idosas, pessoas com deficiência, autismo, gestantes, lactantes, criança de colo, obesidade, mobilidade reduzida e doadores de sangue. A interface distingue maiores de 80 anos e orienta o doador a apresentar comprovante de até 120 dias. Não automatiza a ordem entre grupos prioritários nem a classificação clínica de risco; a equipe confere o fluxo.

Referências consultadas em 29/10/2026: [Lei 10.048, texto atualizado na Câmara](https://www2.camara.leg.br/legin/fed/lei/2000/lei-10048-8-novembro-2000-376937-normaatualizada-pl.html) e [Estatuto da Pessoa Idosa, art. 15, § 7º](https://www2.camara.leg.br/legin/fed/lei/2003/lei-10741-1-outubro-2003-497511-normaatualizada-pl.html). Regras locais e protocolos assistenciais precisam ser validados antes de implantação.

O motivo chega à recepção, inclusive quando uma senha sem identificação é vinculada ao cadastro. O recibo mostra somente serviço, senha, unidade, horário e solicitação comum/preferencial; CPF, nome, nascimento e motivo não aparecem nele ou na TV. Recuperar uma senha aberta não cria outro atendimento. Uma preferência já registrada não é rebaixada pelo totem; alterações após o início do cuidado exigem conferência presencial.

O cadastro de pessoas aceita CPF opcional, valida seus dígitos e impede duplicidade na mesma prefeitura. Cadastros sem CPF continuam acessíveis por nome e nascimento. A migração preserva os dados anteriores e inclui CPFs sintéticos somente nos exemplos originais reconhecidos. O próprio totem oferece “Dados fictícios para testar”.

Os serviços exibidos variam conforme o cenário UBS, UPA ou hospital. São opções demonstrativas; a oferta de cada estabelecimento será configurada e validada na implantação.

## Recepção e triagem em 0.6

A recepção recebe senhas identificadas e anônimas no mesmo quadro, com atualização local a cada dois segundos. A chamada ao guichê funciona antes de identificar o cadastro. Ao chegar ao balcão, a ação Conferir chegada registra o início da conferência. A equipe seleciona o cadastro, confirma CPF ou nome e nascimento, confere a preferência e escolhe triagem ou serviço direto. Cadastro sem CPF e cadastro novo no balcão estão disponíveis.

O encaminhamento preserva senha e chegada. Chamadas não iniciam cronômetros de atendimento: o profissional registra a entrada na sala. Para as senhas novas do totem, a consulta aguarda conferência e conclusão da triagem quando prevista. Registros antigos sem controle dessas etapas continuam utilizáveis sem horários inventados para essas etapas. A recepção não acessa avaliações clínicas.

Ajustes de conferência exigem justificativa e acrescentam histórico; depois do início da triagem ou consulta, o registro anterior é preservado. Ausência exige chamada anterior e justificativa; o retorno restaura a mesma senha, preservando horário e histórico. A ordem dos grupos preferenciais e a classificação clínica de risco não são automatizadas.

O percurso da senha mostra chegada, chamadas, conferências, triagem e consulta. Os indicadores separam espera até o balcão, tempo de conferência, espera até a triagem, escuta e consulta. Métricas de balcão são agrupadas por quem iniciou a conferência; trocas completas de profissionais ainda precisam de controle por períodos. As exportações incluem contagens e médias sem nomes de pacientes. A gestão vê agregados por unidade, incluindo senhas ainda anônimas.

Para testar o percurso completo, abra Cuidelo.html, escolha a sessão Recepção da UBS Centro e entre em Recepção e atendimento. Use Abrir totem conectado e Abrir TV conectada nessa tela. Arquivos diferentes e computadores diferentes não compartilham uma base nesta versão. Não há conexão com servidor ou impressora térmica dedicada.

## Consultório e documentos em 0.7

O médico responsável pelo atendimento cria, revisa e emite documentos de demonstração; apenas o autor cancela documentos emitidos. A enfermagem consulta documentos e registra acompanhamento de exames, com revisão final exclusiva do perfil médico nesta versão. A regulação recebe os encaminhamentos e registra agendamento, cancelamento e contrarreferência manual. A administração local acompanha situação e agenda, sem acessar conteúdo clínico originado no consultório.

Documentos emitidos, resultados e contrarreferências ficam disponíveis à equipe assistencial da mesma prefeitura, inclusive de outras unidades. Escritas continuam restritas à unidade de origem. Rascunhos ficam na unidade, não são impressos e precisam ser emitidos ou descartados antes de concluir a consulta. Ver [roteiro do consultório](consultorio-documentos.md).

## Farmácia e entregas em 0.8

O perfil Farmácia recebe apenas receitas emitidas da própria unidade e os dados necessários à conferência e entrega, sem acesso ao SOAP, exames ou encaminhamentos. Registra entrega total/parcial por lote, com identidade de quem recebe, confirmações, histórico e comprovante. A equipe médica e a enfermagem consultam as entregas no histórico compartilhado da prefeitura, sem registrar a baixa. Administração local mantém acesso ao estoque; recebe movimentos operacionais sem a vinculação clínica das entregas.

Cancelamento da receita bloqueia novas entregas e preserva as anteriores, sem estorno automático. Veja o [roteiro da farmácia](farmacia-dispensacao.md).

## Organização visual em 0.10

A recepção destaca os contadores da fila e mantém os links de totem e TV em uma faixa compacta. O consultório apresenta o resumo da fila, o atendimento ativo e cartões individuais com chamada e início de consulta. A farmácia separa visualmente receitas/entregas e estoque/movimentações, com atalhos que funcionam também no HTML. Os formulários, conferências, permissões e dados existentes são preservados.
