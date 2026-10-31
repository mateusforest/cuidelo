# Cuidelo Cidadão · demonstração 0.18

## Experimentar no celular

Abra **https://cuidelo.vercel.app/cidadao** no navegador. O exemplo de Ana Clara Martins contém próximos agendamentos, um agendamento cancelado e os três tipos de documento solicitados. O de João Pedro Souza contém uma consulta de enfermagem e mostra a situação de quem ainda não recebeu documentos. Os exemplos são gerados à parte pelos comandos da agenda e do consultório e não alteram os registros da equipe.

Em **Agenda**, alterne entre próximos e histórico. Cada cartão mostra data, horário, duração, serviço, profissional, unidade e situação. Em **Documentos**, filtre por receitas, pedidos de exames ou atestados. O documento emitido abre com o conteúdo, a pessoa, a unidade, a data, o número demonstrativo e o profissional. Use **Imprimir ou salvar PDF** conforme as opções do navegador. Documentos cancelados aparecem identificados e o aplicativo retira o conteúdo e a impressão da tela.

## Usar dados do consultório de teste

1. Na estação, entre como **Equipe médica** ou **Enfermagem** e abra a pessoa em **Pessoas e prontuários**.
2. No quadro **App do cidadão**, escolha **Disponibilizar no celular** e **Gerar link de demonstração**. A ação disponibiliza os agendamentos e os documentos emitidos dessa pessoa nas unidades da mesma prefeitura.
3. Copie o link e abra-o em outro aparelho. O link tem validade de 30 minutos e permite leitura a quem o receber. A pessoa entra diretamente na sua cópia.
4. Mantenha a aba emissora aberta com a mesma sessão assistencial. Alterações salvas nessa estação, inclusive remarcações e cancelamentos, atualizam a cópia enquanto o link estiver válido. O celular consulta novas versões a cada 15 segundos e ao retomar o foco. A tela identifica o horário da última cópia enviada. Quando a estação fecha, a última cópia continua disponível até o vencimento.
5. Para encerrar o acesso antes do prazo, volte ao quadro da mesma pessoa, na mesma aba e sessão, e use **Encerrar link**. A próxima consulta do celular recolhe a cópia. A expiração e o encerramento limitam o acesso pelo link. Uma impressão já salva fica no aparelho que a recebeu.

## Dados e limites

A visualização tem acesso de leitura a uma pessoa por link. A projeção inclui três tipos de documentos do consultório, nas situações emitido e cancelado. Rascunhos, documentos descartados, laudos internos, SOAP, CPF e registros de outras pessoas ficam de fora. A entrada do cidadão funciona separada dos perfis profissionais. O seletor de exemplos e o link temporário servem apenas à demonstração com dados fictícios.

A estação cifra a cópia com AES-GCM antes de enviá-la. O serviço temporário guarda o conteúdo cifrado com expiração, separado do canal público da TV. A chave vai no fragmento do link, e a aplicação a remove da barra de endereços após a abertura. O identificador de leitura permanece na sessão da aba para permitir recarregar. O documento lido permanece em memória. O link do consultório requer internet e o limite desta versão é de aproximadamente 119 KB por cópia em texto. Os exemplos locais podem ser explorados no HTML portátil.

Para uma implantação com cidadãos reais, continuam pendentes identidade verificada, representação de dependentes, autorização e auditoria no servidor, persistência protegida e validação dos documentos.

## Acompanhamento pessoal

A área Dia a dia tem armazenamento próprio no aparelho e reúne os registros feitos pelo cidadão. [Relatos, lembretes e relatório](dia-a-dia.md).
