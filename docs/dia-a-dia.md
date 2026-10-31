# Dia a dia no Cuidelo Cidadão · versão 0.19

Abra [o app do cidadão](https://cuidelo.vercel.app/cidadao), escolha Ana Clara e toque em **Dia a dia**. Use dados fictícios.

1. Em **Diário**, registre uma crise, sintoma ou observação de bem-estar. Informe quando aconteceu, descreva o episódio e, se quiser, associe uma condição, a intensidade percebida e a duração. Também é possível cadastrar uma condição separadamente. Os relatos ficam disponíveis na linha do tempo.
2. Em **Medicação**, crie um lembrete digitando o nome ou selecionando um item de receita emitida. Informe os horários e o período combinados com a equipe. Para acompanhar só a farmácia, preencha retirada ou renovação e deixe os horários em branco.
3. Informe as próximas datas de retirada e renovação passadas pela unidade e a antecedência desejada. Em **Hoje**, confira os horários e avisos. Um horário decorrido pode ser marcado como tomado ou não tomado. A correção exige motivo e preserva a declaração anterior. Horários sem resposta ficam sem registro.
4. Após retirar o medicamento ou renovar a documentação, registre a data ocorrida e a próxima data informada. A farmacoterapia, o prazo da receita e a disponibilidade de estoque não são calculados pelo diário. Encerrar um lembrete preserva o histórico. Uma receita vinculada que for cancelada ou retirada da cópia da unidade suspende os lembretes derivados assim que o aplicativo recebe a alteração.
5. Em **Relatório**, escolha o período e confira os relatos, declarações de tomada, retiradas e renovações, além da agenda e dos documentos disponíveis na cópia. O histórico diferencia o que a pessoa informou do que veio da unidade. Use **Imprimir ou salvar relatório em PDF** para levar o resumo à consulta.

## Avisos com o app fechado

1. No celular, abra o Cuidelo Cidadão em **Dia a dia → Medicação**. No iPhone com iOS 16.4 ou posterior, abra o endereço no Safari, escolha **Compartilhar → Adicionar à Tela de Início** e depois abra o ícone instalado. [Web Push em apps na Tela de Início do iOS](https://webkit.org/blog/13878/web-push-for-web-apps-on-ios-and-ipados/).
2. Toque em **Ativar avisos do aparelho**, permita notificações e aguarde **Inscrição ativa neste aparelho**. Quem usava os avisos locais da versão anterior precisa ativar o novo envio uma vez.
3. Escolha **Testar em 1 minuto** e feche a janela do app. Esse teste funciona mesmo sem medicamento cadastrado. Ao tocar no aviso, o aparelho abre o acompanhamento, respeitando a sessão disponível. A tela informa o último aviso apresentado pelo navegador quando houver registro local.
4. Cadastre os horários diários conforme a orientação recebida. Retirada e renovação usam 9h no dia informado e 9h na data de antecedência, quando maior que zero. O fuso é o do aparelho na última sincronização. Avisos no mesmo instante são agrupados. O texto na tela bloqueada é genérico.
5. Para parar os envios desta pessoa no aparelho, use **Desativar avisos** e aguarde a confirmação. O navegador e o sistema precisam permitir notificações e o aparelho precisa de conexão. O horário de agendamento não é garantia de entrega pontual. Os avisos não servem como alarme clínico de segurança.

Alterar ou encerrar um lembrete, registrar retirada ou renovação com nova data e receber a atualização de uma receita vinculada sincronizam a agenda da pessoa enquanto o app está conectado. Se a conexão falhar, confira a indicação de pendência e reabra o app com internet. Com o app fechado, a Vercel trabalha com a última agenda confirmada. O calendário continua disponível como exportação opcional.

## Onde ficam as informações

Cada pessoa tem seu próprio diário no navegador deste aparelho. Os exemplos de Ana e João têm espaços separados. Na cópia compartilhada pela equipe, uma referência aleatória por pessoa e prefeitura na estação de origem permite recuperar o mesmo diário ao receber um novo link da mesma estação, no mesmo aparelho e navegador. Um link antigo sem essa referência mantém a leitura de agenda e documentos. O titular deve receber um link atualizado para usar o diário.

O diário não é transmitido ao consultório ou à prefeitura. Apagar os dados do site ou trocar de navegador pode retirar o acesso aos registros locais. O acompanhamento demonstra registros feitos pela pessoa e lembretes informativos. A operação clínica requer identidade verificada, armazenamento protegido, autorização e validação assistencial.

Para verificar a implementação dos alarmes de calendário e das notificações do navegador, consulte o [padrão iCalendar](https://www.rfc-editor.org/rfc/rfc5545) e a [documentação de notificações do navegador](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification).

## Operação da demonstração

O projeto usa uma fila da Vercel em São Paulo e Web Push com VAPID. A fila contém identificadores opacos e o instante de disparo. A inscrição do navegador, o fuso e as regras de datas e horários ficam cifrados em um armazenamento privado do projeto. O diário, as condições e os nomes dos medicamentos continuam no aparelho. Cada agenda tem sua credencial aleatória de alteração. O cancelamento descarta a inscrição armazenada para essa agenda.

A chave privada permanece na variável sensível CUIDELO_PUSH_KEY do ambiente Production. É necessário manter a chave estável e planejar a migração antes de uma rotação. O armazenamento usa a credencial de Blob do projeto. Um consumidor privado acorda no próximo horário ou em um ponto intermediário para esperas longas, confere a versão vigente, descarta avisos mais de cinco minutos atrasados e programa a próxima ocorrência. Uma inscrição rejeitada como expirada pelo serviço do navegador é desativada. [Filas da Vercel](https://vercel.com/docs/queues) e [armazenamento privado](https://vercel.com/docs/vercel-blob/private-storage).

O teste optativo de entrega real é executado com `node scripts/verify-closed-push.mjs`. Ele usa um perfil descartável, fecha as páginas do app, confere os registros de apresentação do service worker e desativa a agenda ao final.
