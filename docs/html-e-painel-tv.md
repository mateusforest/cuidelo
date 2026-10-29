# HTML independente e painel de senhas

## Abrir sem instalar

`pnpm build:html` gera `dist-standalone/Cuidelo.html` e `dist-standalone/Cuidelo-TV.html`. Cada arquivo contém aplicação, estilos, fontes e marca; pode ser aberto diretamente no navegador, sem instalar Node ou iniciar servidor. O primeiro abre a visão da rede. O segundo abre diretamente uma chamada de exemplo na TV. O guia da marca também é incorporado.

Os dois arquivos são demonstrações independentes. Para testar a ligação entre recepção e TV, use **um único arquivo**: abra Cuidelo.html, selecione uma unidade, entre em Painel de senhas e clique em Abrir TV desta unidade. Mantenha as duas janelas desse mesmo arquivo no mesmo navegador. A persistência e a comunicação local dependem do suporte do navegador a armazenamento de arquivos locais. Não existe sincronização entre computadores ou televisores diferentes.

## Recepção e TV

Uma chegada recebe um número por dia, organização e unidade. Na tela de senhas, a equipe escolhe o destino e chama ou repete a chamada. Chamar não inicia nem conclui a consulta. O histórico de chamadas é persistido com as demais alterações locais. Registros da versão anterior recebem números sem apagar cadastros, notas ou outros dados.

A TV mostra somente senha, local, orientação e horário. A projeção de exibição exclui nome, prontuário, identificador do paciente, prioridade e informações clínicas. As salas e os caminhos desta versão são exemplos. A ordenação de chamada continua sob decisão da equipe; não há classificação clínica automática.

Em Ver prévia da TV, a senha A-023 e as chamadas anteriores são exemplos visuais. Simular chamada altera apenas essa prévia. Em Ver chamadas da recepção, a tela passa a mostrar o que foi chamado na unidade escolhida. Os dois modos são identificados na tela.

Clique em Ativar som para autorizar o áudio. O sinal sonoro e a leitura da senha dependem do navegador e das vozes instaladas; a informação visual continua disponível. Tela cheia usa a função do navegador, com F11 como alternativa no computador. Os controles somem após alguns segundos de inatividade e reaparecem ao mover o mouse ou usar o teclado.

## Para conectar TVs de verdade

O HTML é uma demonstração, não uma instalação de painel operacional. A próxima implementação deve ter canal de exibição por unidade e área, credencial específica para o dispositivo, projeção pública servida por endpoint separado, publicação de eventos após confirmação de gravação, sequência/idempotência, reconhecimento de chamada e reconexão. O dispositivo deve detectar falta de atualizações e sinalizar indisponibilidade, sem apresentar conteúdo antigo como chamada atual.

Também serão necessários cadastro dos locais e orientações reais, impressão ou entrega da senha, separação de filas por serviço, revisão assistencial das regras, acessibilidade em campo, volume de áudio, modo quiosque, suspensão da tela, gerenciamento do dispositivo e contingência. Nenhum dado clínico deve ser enviado ao dispositivo de TV.

## Comparação com o original

A opção Comparar com Pulso mantém o inventário de 46 telas com evidência e lacunas. Veja também [comparacao-pulso.md](comparacao-pulso.md). A existência dessa lista não significa que os itens pendentes foram implementados.
