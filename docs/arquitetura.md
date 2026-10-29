# Arquitetura da base Cuidelo

## Decisões desta versão

Interface React e TypeScript, empacotada com Vite. A camada de domínio concentra as operações para evitar que cada tela invente sua própria regra. A persistência usa um contrato substituível; o adaptador atual grava somente dados fictícios no navegador. O backend será conectado em uma etapa seguinte.

O fluxo de escrita é: interface → comando com contexto → validação de domínio → persistência → atualização da interface. A gravação é concluída antes da publicação do novo estado. Uma falha de armazenamento mantém a base anterior. Revisões detectam alterações concorrentes de outras abas; quando disponível, Web Locks coordena gravações no mesmo navegador. Isso não resolve concorrência entre computadores.

## Fronteiras de acesso

Cada contexto contém organização, unidade e função. Pacientes pertencem à organização. Agendas, filas, leitos e estoques pertencem também à unidade. Visões agregadas pertencem à gestão. As regras atuais filtram leituras e comandos para verificar a intenção do produto, mas o usuário pode alterar código ou armazenamento local. **A segurança real deve ser aplicada no servidor e no banco, em todas as consultas e mutações.**

Compartilhamento de informações entre municípios precisa de uma política explícita de finalidade, vínculo assistencial e acesso. Trocar de rede na demonstração não define essa política. Um cadastro nacional não significa prontuário indiscriminadamente aberto entre clientes.

## Entidades iniciais

Organizações, unidades, pessoas, agendamentos, atendimentos, notas, complementos, escutas e aferições, chamadas de senha, leitos, internações, lotes, movimentos de estoque, encaminhamentos e eventos locais. Os identificadores são demonstrativos. CPF, CNS, CNES, vínculos profissionais e nomenclaturas oficiais precisam de validação própria na etapa correspondente.

Agendamentos ainda identificam o profissional por um nome de demonstração. Antes de uso real, profissionais devem ter identificadores estáveis, credenciais, vínculos por unidade, disponibilidade e regras transacionais de agenda.

## Invariantes já exercitadas

- A mesma pessoa ou profissional não ocupa horários sobrepostos na agenda local.
- Confirmar novamente uma chegada não cria outro atendimento.
- Registros finalizados não são editados pelos comandos disponíveis.
- Um leito não recebe duas internações e uma pessoa não recebe duas internações ativas incompatíveis.
- A saída envia o leito para higienização; a liberação é uma operação separada.
- Movimentações de estoque exigem quantidade inteira positiva e não geram saldo negativo; lotes vencidos ficam indisponíveis para movimentação nesta demonstração.
- Operações com outra organização ou unidade são rejeitadas pela camada de domínio.
- Falha de gravação e conflito de revisão não devem ser apresentados como sucesso.

## Construção do backend

O adaptador seguinte deverá implementar sessão autenticada, autorização no servidor, transações e controle de concorrência, sem confiar em organização, função ou identidade enviados pelo navegador. O contrato atual é uma referência de comportamento; não exige carregar uma base completa em memória na implementação real.

As listagens atuais trabalham sobre coleções pequenas. A versão de produção precisará de paginação, busca indexada, consultas por escopo, indicadores agregados e carregamento por módulo. Documentos, imagens e resultados não deverão circular desnecessariamente pela interface de gestão.

Identidade, permissões, auditoria durável, temporalidade e migrações vêm antes da adoção de dados reais. O registro assistencial precisará de autoria, vinculação profissional, assinaturas aplicáveis e adendos rastreáveis. A conclusão de uma nota na demonstração não é uma assinatura digital.

## Limites explícitos

Não há criptografia de armazenamento local, autenticação, sincronização entre computadores, restauração operacional, contingência clínica, monitoramento de produção ou serviço 24 horas. O uso local não implementa o modo offline assistencial previsto no plano. O histórico local pode ser apagado e não é prova de auditoria.

As datas usam America/Sao_Paulo na demonstração. A expansão nacional exige fuso por estabelecimento e armazenamento de instantes com contexto temporal preservado, incluindo regras de competência e virada de dia.

Prioridades na recepção são administrativas. Não existe protocolo validado de classificação de risco, motor de prescrição ou recomendação clínica. Encaminhamentos não reservam vagas em outros sistemas. Indicadores mostram o cenário fictício, não capacidade ou resultados reais.

## Escala

A meta de 100 postos é um requisito de projeto, ainda não comprovado. Dimensionar usuários simultâneos, atendimentos por hora, históricos, documentos e integrações. Dimensionar hospitais separadamente por leitos, episódios, exames, cirurgias e fluxos críticos. Executar testes com distribuição desigual de carga, picos, falhas e restauração antes de contratar níveis de serviço.

## Escuta e complementos no formato 3

Escutas e aferições são registros imutáveis na lógica dos comandos; correções criam sucessoras justificadas. Complementos referenciam notas finalizadas sem substituir o SOAP. A leitura clínica compartilha o histórico dentro da mesma organização, como as notas, e a escrita exige a unidade de origem. A projeção para recepção, gestão, regulação e farmácia exclui escutas e complementos. O DTO da TV continua restrito à chamada. Veja [escuta-e-registros.md](escuta-e-registros.md) para o percurso e os limites.

## Vacinação no formato 4

O domínio separa lotes de imunobiológicos, movimentos, registros de vacinação, anulações e aprazamentos. Uma aplicação local e sua baixa de uma dose são persistidas na mesma gravação. Transcrições não alteram estoque nem produção local. Anulação preserva o registro e não faz reposição automática. A projeção clínica acompanha a pessoa na rede; a visão de estoque não inclui a caderneta e a gestão recebe apenas agregados. A migração acrescenta coleções vazias nas bases existentes. Consulte [vacinacao.md](vacinacao.md) para limites e critérios restantes.
