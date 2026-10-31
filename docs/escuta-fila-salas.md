# Escuta, fila e consultórios — entrega 0.14

O primeiro percurso acompanha uma pessoa desde a avaliação na escuta até a liberação do consultório. Use dados fictícios da mesma prefeitura e unidade, no mesmo navegador.

## Roteiro de teste

1. Entre em **Enfermagem**, Rede Aurora, UBS Centro. Em **Escuta e sinais vitais**, abra uma pessoa aguardando, inicie a escuta, preencha o motivo e salve. Em uma base antiga, a recepção pode registrar uma nova chegada fictícia para o dia de hoje.
2. Em **Classificação e destino**, escolha **Classificar e encaminhar**. Informe uma referência fictícia, a denominação da avaliação, a faixa para chamada, o consultório e a justificativa. O prazo em minutos é opcional. Os campos representam a decisão de quem registra.
3. Use o filtro **Reavaliação pendente** na escuta para localizar os prazos atingidos. **Registrar reavaliação** acrescenta um registro com autoria e horário. O consultório e o histórico assistencial da pessoa mostram as avaliações anteriores.
4. Entre como **Recepção** e abra **Fila e salas**. Localize a senha pelo nome ou número. Solicitações classificadas seguem a faixa registrada, com preferência administrativa e ordem de chegada nos empates. O balcão vê o destino e a ordem operacional. A justificativa e a classificação textual só aparecem nas sessões assistenciais.
5. Abra a TV pelo botão da unidade e volte à fila. Clique em **Chamar senha** e confirme a sala. O cartão passa a **Reservado** e a TV mostra a senha e o destino. Rechamar conserva a reserva. Outra pessoa precisa aguardar ou usar uma sala livre.
6. Para testar um imprevisto, escolha **Devolver à fila** e informe o motivo. A chegada original permanece, a TV recolhe a chamada atual e o consultório fica livre. A recepção encontra o movimento em **Ver percurso**. Faça uma nova chamada.
7. Em **Equipe médica**, abra **Fila e salas** e escolha **Confirmar entrada**. O cartão passa a **Em atendimento** e o período da consulta começa. Abra o atendimento, confira a avaliação da escuta e conclua o registro fictício. A sala fica livre. Na UPA ou hospital, encaminhar à observação também encerra o período de ocupação.
8. Para testar o HTML offline, abra **Cuidelo.html** no notebook. Abra a TV pelo botão desse mesmo arquivo para compartilhar a base entre as abas.

## Outros destinos da escuta

- Para **Enfermagem**, **Sala de vacina** ou **Farmácia**, selecione o destino na avaliação. Abra a estação correspondente com o perfil do setor. Em **Encaminhamentos da escuta**, chame a senha na TV e confirme o recebimento. Conclua com um resultado ou devolva com motivo. Doses e entregas têm registros próprios.
- Em **Escuta e sinais vitais**, o filtro **Devolvidos à escuta** localiza quem precisa de nova avaliação. A ficha conserva a decisão anterior e o motivo da devolução.
- Para **Orientação e encerramento na escuta**, descreva a avaliação e confirme expressamente a orientação. O percurso encerra sem criar consulta médica ou SOAP.

## Ordem de desenvolvimento

O botão **Ver percursos parciais em ordem de entrega** na tela **Comparar com Pulso** ordena os 43 itens que continuam parciais, preservando suas posições na lista original de 44. Cada linha conserva a descrição das capacidades e pendências. O item 1, Escuta inicial, passou a demonstrável no percurso manual após teste de consulta, reavaliação, encaminhamento, devolução e encerramento. O item 2, Fila e salas, continua parcial. As próximas são consultório, farmácia e agenda. Entram depois os demais percursos assistenciais, acesso e operação da rede, território, gestão municipal e operação da Cuidelo. A implantação clínica exige o aceite da rede completa.

## Limites da demonstração

Esta entrega controla a ocupação de dois consultórios por unidade no navegador. A recepção, a triagem e outros destinos podem aparecer na fila. A ocupação física desses outros setores ainda requer desenvolvimento. O circuito manual usa a denominação e a referência registradas pelo profissional. A sugestão automática de risco presente no Pulso ainda dependerá de regras e validações das unidades. O Cuidelo não deduz classificação, tratamento ou tempo clínico seguro a partir dos sinais vitais.

A base passa ao formato 11. Dados anteriores continuam acessíveis. Um atendimento iniciado antes desta versão não recebe uma sala ou horário retroativo. A comunicação da TV entre equipamentos, a autenticação e a proteção no servidor dependem da próxima etapa de infraestrutura. A homologação dos protocolos e dos fluxos assistenciais depende das unidades participantes.
