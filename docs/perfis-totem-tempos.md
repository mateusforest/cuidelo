# Perfis, totem e acompanhamento — Cuidelo 0.5.1

Esta entrega é um ambiente local de desenvolvimento com dados fictícios. O escopo de lançamento continua incluindo UBS, UPA, pronto atendimento e hospitais. As telas não substituem a implementação e a validação dos percursos clínicos, das integrações e da proteção em servidor.

## Acessos de demonstração

Em **Trocar sessão de demonstração**, escolha prefeitura, unidade e vínculo fictício. A sessão do profissional permanece vinculada à sua unidade. Somente a prefeitura filtra unidades da própria rede; para explorar outra prefeitura é necessário abrir outra sessão no laboratório de acesso.

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
2. No totem, escolha cadastro existente ou atendimento pela recepção. A identificação usa CPF ou nome completo (civil ou social), junto da data de nascimento. Confere apenas o cadastro fictício local, sem consultar a Receita Federal ou CNS. Nomes iguais com o mesmo nascimento exigem conferência na recepção.
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

Atendimento comum e preferencial aparecem como opções grandes na entrada e durante a emissão. O motivo é opcional: a pessoa pode escolher informar à recepção. Os exemplos incluem pessoas idosas, pessoas com deficiência, autismo, gestantes, lactantes, criança de colo, obesidade, mobilidade reduzida e doadores de sangue. A interface distingue maiores de 80 anos e orienta o doador a apresentar comprovante de até 120 dias. Não automatiza a ordem entre grupos prioritários nem a classificação clínica de risco; a equipe confere o fluxo.

Referências consultadas em 29/10/2026: [Lei 10.048, texto atualizado na Câmara](https://www2.camara.leg.br/legin/fed/lei/2000/lei-10048-8-novembro-2000-376937-normaatualizada-pl.html) e [Estatuto da Pessoa Idosa, art. 15, § 7º](https://www2.camara.leg.br/legin/fed/lei/2003/lei-10741-1-outubro-2003-497511-normaatualizada-pl.html). Regras locais e protocolos assistenciais precisam ser validados antes de implantação.

O motivo chega à recepção, inclusive quando uma senha sem identificação é vinculada ao cadastro. O recibo mostra somente serviço, senha, unidade, horário e solicitação comum/preferencial; CPF, nome, nascimento e motivo não aparecem nele ou na TV. Recuperar uma senha aberta não cria outro atendimento. Uma preferência já registrada não é rebaixada pelo totem; alterações após o início do cuidado exigem conferência presencial.

O cadastro de pessoas aceita CPF opcional, valida seus dígitos e impede duplicidade na mesma prefeitura. Cadastros sem CPF continuam acessíveis por nome e nascimento. A migração preserva os dados anteriores e inclui CPFs sintéticos somente nos exemplos originais reconhecidos. O próprio totem oferece “Dados fictícios para testar”.

Os serviços exibidos variam conforme o cenário UBS, UPA ou hospital. São opções demonstrativas; a oferta de cada estabelecimento será configurada e validada na implantação.
