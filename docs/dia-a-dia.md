# Dia a dia no Cuidelo Cidadão · versão 0.23

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

### Agir ao tocar no aviso

Abra o app atualizado uma vez para sincronizar os lembretes cadastrados. Para testar, cadastre um medicamento fictício com um horário daqui a dois minutos, ative os avisos e feche o app. O botão **Testar em 1 minuto** serve para testar a entrega de uma notificação genérica.

- Toque na notificação do medicamento. O app abre os cartões das ocorrências daquele horário. A tela bloqueada mantém o texto discreto.
- Para registrar a dose, escolha **Marcar que tomei**. Para receber um novo aviso, escolha **1, 10 ou 30 minutos** e **Adiar lembrete**. O adiamento conserva o horário original da dose e precisa ser sincronizado com a Vercel para chegar com o app fechado.
- Para a farmácia, escolha **Confirmar retirada** ou **Confirmar renovação**. Se a unidade informou a próxima data, preencha-a antes de confirmar. O Dia a dia registra a confirmação na data de hoje e o relatório inclui os adiamentos.
- Ao ativar avisos com um link da unidade, o navegador lembra esse acesso neste aparelho para poder revalidá-lo ao abrir o aviso. **Sair** remove a retomada e **Desativar avisos** cancela a agenda. Uma pessoa que já usava um link antes da versão 0.20 pode desativar e ativar os avisos uma vez para habilitar a retomada. Links encerrados ou expirados impedem o acesso à cópia.
- Os detalhes do aviso ficam disponíveis neste navegador por sete dias. Uma confirmação anterior, um plano encerrado ou uma etapa substituída bloqueiam uma segunda confirmação.

Alterar ou encerrar um lembrete, registrar retirada ou renovação com nova data e receber a atualização de uma receita vinculada sincronizam a agenda da pessoa enquanto o app está conectado. Se a conexão falhar, confira a indicação de pendência e reabra o app com internet. Com o app fechado, a Vercel trabalha com a última agenda confirmada. O calendário continua disponível como exportação opcional.

## Onde ficam as informações

Cada pessoa tem seu próprio diário no navegador deste aparelho. Os exemplos de Ana e João têm espaços separados. Na cópia compartilhada pela equipe, uma referência aleatória por pessoa e prefeitura na estação de origem permite recuperar o mesmo diário ao receber um novo link da mesma estação, no mesmo aparelho e navegador. Um link antigo sem essa referência mantém a leitura de agenda e documentos. O titular deve receber um link atualizado para usar o diário.

O diário completo fica no aparelho. A pessoa pode autorizar uma cópia do relatório para o consultório.

## Compartilhar com o médico

Em **Dia a dia → Relatório**, selecione as datas e confira o conteúdo. Toque em **Compartilhar relatório → Autorizar e gerar código**. Copie o código ou use **Enviar código** se o celular oferecer essa opção. Uma cópia vale por 30 minutos. Mudanças posteriores no diário não alteram essa cópia. É possível encerrar o código e gerar outra.

No perfil **Equipe médica**, abra o atendimento da mesma pessoa, localize **Relatório do cidadão → Abrir relatório com código**, cole o código e toque em **Consultar relatório**. Para testar com Ana Clara no app demonstrativo, use o atendimento de Ana Clara Martins na UBS Centro da Rede Aurora. O médico vê o período, os totais e a linha do tempo de crises, doses, adiamentos, retiradas e renovações. O médico responsável pode registrar a revisão de forma separada do SOAP.

### Registrar a revisão e responder

1. Inicie o atendimento da pessoa no **Consultório**. Após conferir o relatório compartilhado, escolha **Registrar revisão no prontuário**. A revisão informa profissional, unidade, data e período da cópia.
2. Em **Orientação para a pessoa**, escreva um texto fictício e toque em **Registrar e enviar orientação**. A estação salva primeiro o registro clínico. Se o envio não for confirmado, use **Tentar enviar novamente**. O prontuário da pessoa reúne as revisões e orientações da rede.
3. No app, abra **Dia a dia → Orientações**. A caixa busca mensagens com internet, inclusive depois de encerrar o código de leitura. As orientações recebidas ficam neste navegador, associadas à pessoa que compartilhou. Um link válido emitido pela estação médica também inclui as orientações com envio confirmado que constam na cópia da pessoa.
4. Um código ativo autoriza novos envios. Encerrar o código bloqueia novos envios e preserva orientações já aceitas. “Envio confirmado” indica que o serviço recebeu a orientação. A confirmação de leitura tem data própria e depende do toque da pessoa em **Confirmar que li**. A caixa de retorno utiliza envelopes cifrados no armazenamento privado da Vercel, separados por compartilhamento.

A cópia é cifrada e o serviço temporário verifica o código, o vínculo e o prazo. Fechar o relatório retira o código da sessão médica. **Encerrar compartilhamento** no app bloqueia novas leituras, e a tela aberta confere o acesso a cada cinco segundos enquanto estiver ativa. O compartilhamento precisa de internet no endereço publicado. Versões antigas do link da unidade sem o vínculo estável podem ser conferidas na estação que emitiu o link.

Apagar os dados do site ou trocar de navegador pode retirar o acesso aos registros locais. O acompanhamento demonstra registros feitos pela pessoa e lembretes informativos. A operação clínica requer identidade verificada, armazenamento protegido, autorização e validação assistencial.

Para verificar a implementação dos alarmes de calendário e das notificações do navegador, consulte o [padrão iCalendar](https://www.rfc-editor.org/rfc/rfc5545) e a [documentação de notificações do navegador](https://developer.mozilla.org/en-US/docs/Web/API/ServiceWorkerRegistration/showNotification).

## Nova orientação no celular

Em **Dia a dia → Orientações**, ative os avisos do aparelho e permita as notificações. Quem já ativou os avisos dos medicamentos usa a mesma inscrição. No iPhone, abra pelo ícone da Tela de Início. Reabra a versão atualizada do app e compartilhe o relatório. Com avisos desativados, a caixa continua recebendo as mensagens.

O consultório registra e envia a orientação durante o compartilhamento. A fila da Vercel aciona o navegador mesmo com o app fechado. A tela bloqueada exibe um aviso discreto. Ao tocar, o aparelho que compartilhou abre aquela orientação. A pessoa pode tocar em **Confirmar que li**. O serviço registra o primeiro horário de confirmação, inclusive após o encerramento do código. O consultório atualiza a situação enquanto está aberto e preserva o horário no prontuário. Uma cópia nova emitida pela unidade também permite confirmar mensagens quando o vínculo está válido.

## Operação da demonstração

O projeto usa uma fila da Vercel em São Paulo e Web Push com VAPID. A fila contém identificadores opacos e o instante de disparo. A inscrição do navegador, as referências aleatórias dos planos, o fuso e as regras de datas e horários ficam cifrados em um armazenamento privado do projeto. O diário, as condições e os nomes dos medicamentos continuam no aparelho. Cada agenda tem sua credencial aleatória de alteração. O cancelamento descarta a inscrição armazenada para essa agenda.

A chave privada permanece na variável sensível CUIDELO_PUSH_KEY do ambiente Production. É necessário manter a chave estável e planejar a migração antes de uma rotação. O armazenamento usa a credencial de Blob do projeto. Um consumidor privado acorda no próximo horário ou em um ponto intermediário para esperas longas, confere a versão vigente, descarta avisos mais de cinco minutos atrasados e programa a próxima ocorrência. Uma inscrição rejeitada como expirada pelo serviço do navegador é desativada. [Filas da Vercel](https://vercel.com/docs/queues) e [armazenamento privado](https://vercel.com/docs/vercel-blob/private-storage).

O teste optativo de entrega real é executado com `node scripts/verify-closed-push.mjs`. Ele usa um perfil descartável, fecha as páginas do app, confere os registros de apresentação do service worker e desativa a agenda ao final.
