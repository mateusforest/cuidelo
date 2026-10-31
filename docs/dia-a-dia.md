# Dia a dia no Cuidelo Cidadão · versão 0.18

Abra [o app do cidadão](https://cuidelo.vercel.app/cidadao), escolha Ana Clara e toque em **Dia a dia**. Use dados fictícios.

1. Em **Diário**, registre uma crise, sintoma ou observação de bem-estar. Informe quando aconteceu, descreva o episódio e, se quiser, associe uma condição, a intensidade percebida e a duração. Também é possível cadastrar uma condição separadamente. Os relatos ficam disponíveis na linha do tempo.
2. Em **Medicação**, crie um lembrete digitando o nome ou selecionando um item de receita emitida. Informe os horários e o período combinados com a equipe. Para acompanhar só a farmácia, preencha retirada ou renovação e deixe os horários em branco.
3. Informe as próximas datas de retirada e renovação passadas pela unidade e a antecedência desejada. Em **Hoje**, confira os horários e avisos. Um horário decorrido pode ser marcado como tomado ou não tomado. A correção exige motivo e preserva a declaração anterior. Horários sem resposta ficam sem registro.
4. Após retirar o medicamento ou renovar a documentação, registre a data ocorrida e a próxima data informada. A farmacoterapia, o prazo da receita e a disponibilidade de estoque não são calculados pelo diário. Encerrar um lembrete preserva o histórico. Uma receita vinculada que for cancelada ou retirada da cópia da unidade suspende os lembretes derivados assim que o aplicativo recebe a alteração.
5. Em **Relatório**, escolha o período e confira os relatos, declarações de tomada, retiradas e renovações, além da agenda e dos documentos disponíveis na cópia. O histórico diferencia o que a pessoa informou do que veio da unidade. Use **Imprimir ou salvar relatório em PDF** para levar o resumo à consulta.

## Avisos

Os lembretes na tela seguem o relógio local do aparelho. A pessoa pode autorizar notificações do navegador nos aparelhos compatíveis. O aviso de horário usa uma janela de cinco minutos, tem texto discreto e fica restrito à sessão aberta. A agenda da farmácia destaca as datas a partir da antecedência informada. Registros concluídos e lembretes encerrados deixam de gerar avisos.

Para usar os avisos com o app fechado, abra o lembrete e escolha **Receber avisos com o app fechado → Baixar para o calendário**. Importe o arquivo .ics no calendário do aparelho e confira os alarmes e permissões. O arquivo contém o nome do medicamento, horários locais, eventos diários e datas informadas de retirada e renovação. Para a farmácia, o arquivo inclui um alarme às 9h no dia informado e outro com a antecedência escolhida, quando maior que zero. O comportamento dos avisos depende do calendário utilizado. Se a receita ou o plano mudar, altere ou remova também os eventos já importados.

## Onde ficam as informações

Cada pessoa tem seu próprio diário no navegador deste aparelho. Os exemplos de Ana e João têm espaços separados. Na cópia compartilhada pela equipe, uma referência aleatória por pessoa e prefeitura na estação de origem permite recuperar o mesmo diário ao receber um novo link da mesma estação, no mesmo aparelho e navegador. Um link antigo sem essa referência mantém a leitura de agenda e documentos. O titular deve receber um link atualizado para usar o diário.

O diário não é transmitido ao consultório ou à prefeitura. Apagar os dados do site ou trocar de navegador pode retirar o acesso aos registros locais. O acompanhamento demonstra registros feitos pela pessoa e lembretes informativos. A operação clínica requer identidade verificada, armazenamento protegido, autorização e validação assistencial.

Para verificar a implementação dos alarmes de calendário e das notificações do navegador, consulte o [padrão iCalendar](https://www.rfc-editor.org/rfc/rfc5545) e a [documentação de notificações do navegador](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification).
