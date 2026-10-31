# HTML independente e painel de senhas

## Abrir sem instalar

`pnpm build:html` gera `dist-standalone/Cuidelo.html`, `dist-standalone/Cuidelo-TV.html` e `dist-standalone/Cuidelo-Totem.html`. Cada arquivo contém aplicação, estilos, fontes e marca; pode ser aberto diretamente no navegador, sem instalar Node ou iniciar servidor. O primeiro abre a visão da rede. O segundo abre diretamente uma chamada de exemplo na TV. O guia da marca também é incorporado.

Os três arquivos são demonstrações independentes. O arquivo de totem abre a retirada de senhas da UBS Centro. Para testar a ligação entre recepção e TV, use **um único arquivo**: abra Cuidelo.html, entre na sessão da unidade, acesse Painel de senhas e clique em Abrir TV desta unidade. Mantenha as duas janelas desse mesmo arquivo no mesmo navegador. A persistência e a comunicação local dependem do suporte do navegador a armazenamento de arquivos locais. Para transmitir a uma TV em outro equipamento, use o pareamento abaixo.

## Recepção e TV

Uma chegada recebe um número por dia, organização e unidade. Na tela de senhas, a equipe escolhe o destino e chama ou repete a chamada. Chamar não inicia nem conclui a consulta. O histórico de chamadas é persistido com as demais alterações locais. Registros da versão anterior recebem números sem apagar cadastros, notas ou outros dados.

A TV mostra somente senha, local, orientação e horário. A projeção de exibição exclui nome, prontuário, identificador do paciente, prioridade e informações clínicas. As salas e os caminhos desta versão são exemplos. A ordenação de chamada continua sob decisão da equipe; não há classificação clínica automática.

Em Ver prévia da TV, a senha A-023 e as chamadas anteriores são exemplos visuais. Simular chamada altera apenas essa prévia. Em Ver chamadas da recepção, a tela passa a mostrar o que foi chamado na unidade escolhida. Os dois modos são identificados na tela.

Clique em Ativar som para autorizar o áudio. O sinal sonoro e a leitura da senha dependem do navegador e das vozes instaladas; a informação visual continua disponível. Tela cheia usa a função do navegador, com F11 como alternativa no computador. Os controles somem após alguns segundos de inatividade e reaparecem ao mover o mouse ou usar o teclado.

## Parear uma TV em outro equipamento

1. Na estação de demonstração, abra o HTML principal ou o Cuidelo na Vercel. Entre como Recepção na UBS Centro e abra **Fila e salas**.
2. Em **TV em outro equipamento**, clique em **Gerar código para a TV**. Mantenha o sistema da unidade aberto nessa estação.
3. No navegador da TV, abra **https://cuidelo.vercel.app/tv**, digite o código e selecione **Conectar ao painel**. Também é possível copiar o link de leitura e abri-lo no segundo aparelho.
4. Na estação, chame uma senha. Confira na TV o número e o destino. Para autorizar o áudio, use **Ativar som** na própria TV. **Encerrar transmissão** na estação invalida o pareamento.
5. Com o perfil de Enfermagem, chame uma senha para a triagem, inicie e salve a escuta. Encaminhe a pessoa para enfermagem, vacinação ou farmácia, conforme os serviços da unidade. Abra o destino com o perfil correspondente, chame a senha e confirme o recebimento. Confira **Reservado**, **Em atendimento** e **Livre** em Fila e salas. Concluir ou devolver a passagem libera a sala. A devolução mantém o percurso para nova escuta.

O código permite visualizar as chamadas dessa estação e unidade. A TV recebe por HTTPS o número da senha, o identificador do local e o horário de cada chamada. Duas estações independentes mantêm dados e códigos próprios. As telas de operação da mesma estação compartilham o quadro no navegador.

A TV verifica as chamadas aproximadamente a cada três segundos enquanto está conectada. Ao perder a rede ela retira a chamada e tenta reconectar. Se a estação parar de transmitir, o quadro remoto expira em até 90 segundos, mais o intervalo de consulta. O HTML continua utilizável sem internet para os percursos locais. A projeção temporária da TV usa o cache regional da Vercel, sem guardar cadastros ou prontuários.

Esta entrega usa dados fictícios. Para operação clínica entre vários postos ainda são necessários autenticação, autorização no servidor, persistência protegida e validação dos equipamentos e protocolos municipais.

## Comparação com o original

A opção Comparar com Pulso mantém o inventário de 46 telas com evidência e lacunas. Veja também [comparacao-pulso.md](comparacao-pulso.md). A existência dessa lista não significa que os itens pendentes foram implementados.
