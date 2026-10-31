# Cuidelo 0.24 · Auditoria das telas

31 de outubro de 2026 · versão de demonstração com dados fictícios.

## O que foi conferido

Em navegador, abrimos 66 endereços distintos e verificamos 362 combinações de tela, perfil, unidade e largura. O percurso incluiu o catálogo de todos os nove perfis, os 46 itens do Pulso, o acesso, o totem, a TV, o app do cidadão, um prontuário e um atendimento. A unidade de referência foi a UBS Centro. Repetimos os percursos de recepção, fila, leitos e áreas de cada perfil com as sessões da UPA e do hospital. As larguras testadas foram 360 e 1.440 pixels.

As verificações de abertura, bloqueios inesperados em rotas oferecidas, erros de execução, rolagem lateral da página e nomes dos controles visíveis passaram. Tabelas largas podem ter rolagem dentro do próprio quadro. A revisão visual usou capturas das principais estações. Os testes de operação complementam essa passagem com registros fictícios, alterações, cancelamentos, impressões e trocas de perfil.

| Perfil ou área | Verificações de tela |
|---|---:|
| Prefeitura | 42 |
| Administração da unidade | 90 |
| Recepção | 20 |
| Equipe médica | 66 |
| Enfermagem | 38 |
| Farmácia | 14 |
| Regulação | 16 |
| Agente de saúde | 24 |
| Operação Cuidelo | 26 |
| Telas públicas e cidadão | 26 |

## Correções e como testar

1. Entre em **Recepção**. Observe as senhas agrupadas por etapa, as encerradas por último e o total de cada grupo. No celular, toque em **Buscar ou alterar data** para abrir os filtros. O cabeçalho da recepção passou de 250 para 100 pixels a 360 pixels de largura e de 172 para 108 no computador.
2. Na **Agenda**, escolha um horário fictício já encerrado que ainda aguarda chegada. Use **Registrar falta**, informe o motivo e confira **Faltas**. Use **Corrigir falta** para restabelecer a situação anterior. As duas ações ficam no histórico. Na agenda da pessoa compartilhada pela unidade, aparece apenas a situação.
3. Em **Módulos e acompanhamentos**, procure um serviço pelo nome ou grupo. O menu destaca a rotina do perfil. A farmácia tem indicadores de receitas, dispensações e lotes. A administração da unidade recebe indicadores de vacinação do seu próprio contexto.
4. Na visão da **Prefeitura**, filtre por Hospital e exporte o resumo. O arquivo contém as unidades do filtro aplicado.
5. Em **Sobre o projeto → Integrações**, toque em **Verificar conexões**. A TV pareada, o compartilhamento, a caixa de orientações e o serviço de inscrição para avisos têm resultados independentes. O resultado indica a disponibilidade de leitura naquele instante. Pareamento, autorização do aparelho e envio são testados nos fluxos próprios.
6. Em **Comparar com Pulso**, filtre por **Parcial** e abra uma ação oferecida ao perfil. As áreas de outras funções estão identificadas.

## Cobertura dos 46 itens originais

Quatro percursos são demonstráveis, um foi adaptado e 41 continuam parciais. Mais de um item do Pulso pode usar a mesma tela atual. A ordem dos recursos parciais pode ser consultada no próprio Cuidelo.

### Apresentação

| Tela do Pulso | Cobertura | Percurso disponível e pendências |
|---|---|---|
| Um dia em Bacabal | Adaptado | A visão da rede substitui a apresentação “Um dia em Bacabal”. O roteiro narrativo original não foi reproduzido. |

### Acesso

| Tela do Pulso | Cobertura | Percurso disponível e pendências |
|---|---|---|
| Entrar | Parcial | Entrada por sessões fictícias vinculadas a perfil, unidade e prefeitura. Links diretos da equipe pedem escolha de sessão e retomam a tela solicitada. Autenticação real, recuperação de acesso e segundo fator continuam pendentes. |
| Primeiro acesso | Parcial | Cadastro e conferência local de vínculos com histórico de situação. Não cria contas, verifica CNES ou envia convites reais. |
| Onde você atende hoje | Parcial | Cada sessão possui unidade e função vinculadas. Apenas a prefeitura filtra unidades da sua rede. Vínculos reais e autorização no servidor continuam pendentes. |

### UBS e assistência

| Tela do Pulso | Cobertura | Percurso disponível e pendências |
|---|---|---|
| Recepção | Parcial | Senha do totem identificada ou anônima, busca por CPF/nome, cadastro e atualização justificada com valores anteriores/autoria, conferência presencial, preferência confirmada e encaminhamento à triagem/serviço. Ausência e retorno preservam a senha. A equipe pode encerrar chegadas antigas sem atendimento com motivo rastreável. Faltam conciliação cadastral nacional, validação documental e operação entre dispositivos. |
| Fila e salas | Demonstrável | Reserva ao chamar, entrada, devolução e liberação de consultórios, triagem, enfermagem, vacinação e farmácia conforme a unidade. O quadro impede dupla ocupação na estação e mantém o histórico. TVs pareadas em outros equipamentos recebem apenas o painel de senhas. A ocupação compartilhada entre estações clínicas depende de persistência e autorização no servidor. |
| TV da sala de espera | Demonstrável | Painel de senha, destino, horário, histórico e áudio opcional. Pode abrir localmente ou receber chamadas de uma estação pareada pela internet em outro equipamento. A falta de sinal retira a chamada da tela. Dados pessoais e clínicos ficam na estação. |
| Escuta inicial | Demonstrável | Percurso manual demonstrável: escuta e sinais vitais, classificação com referência e justificativa, reavaliação com prazo e histórico, encaminhamento para consulta, enfermagem, vacinação ou farmácia e encerramento após orientação confirmada. O setor recebe, devolve ou conclui a passagem. A classificação é profissional; sugestões automáticas do Pulso e homologação dos protocolos locais não estão incluídas. |
| Consultório | Demonstrável | Chamada e rechamada, devolução, entrada em sala e cronômetro. SOAP com CIAP-2 ou CID-10 selecionados pelo profissional ou justificativa sem código. Receitas, exames, encaminhamentos, atestados e declarações demonstrativos. Conclusão preservada com liberação da sala, histórico da prefeitura e adendos. A equipe pode revisar o relatório do Dia a dia, enviar orientação e consultar a confirmação de leitura. Catálogo integral, receituários especiais, validações clínicas, assinatura e envio oficial seguem pendentes. |
| Sala de vacina | Parcial | Há caderneta, aplicação com baixa de dose por lote, transcrição, anulação preservada, aprazamentos, perdas e quarentena. Retornos têm filtros de hoje/atraso e registros manuais de contato com autoria e horário, sem envio automático. Faltam calendário validado, registro tardio e correções com reconciliação, rede de frio completa e integração oficial. |
| Pré-natal | Parcial | Acompanhamento por pessoa e encontros vinculados, edição com histórico e encerramento preservado. DPP é informada pelo profissional; protocolos, risco, exames e integração materna continuam pendentes. |
| Farmácia | Parcial | Recebe receitas emitidas no consultório da unidade; conferência da pessoa ou representante, entrega total/parcial com saldo por item, múltiplos lotes, baixa vinculada, comprovante e histórico. Cadastro e identificação de lotes; bloqueios de vencimento, incompatibilidade e excesso. Faltam devoluções e estornos vinculados, perdas/quarentena, validação farmacêutica completa, controlados e integração e-SUS AF. |
| Agenda da UBS | Parcial | Agenda organizada por data, profissional, busca e situação, com criação, remarcação justificada e histórico de horários/autoria, conflitos de pessoa e profissional, cancelamento e chegada. Chegadas identificadas pelo totem podem ser vinculadas ao horário confirmado. A falta pode ser registrada após o fim do horário e corrigida com autoria e motivo. O app do cidadão exibe a situação. Faltam a oferta de vagas por escala e o envio de lembretes de agendamento. |

### Gestão municipal

| Tela do Pulso | Cobertura | Percurso disponível e pendências |
|---|---|---|
| Visão geral | Parcial | Indicadores locais por rede/unidade, com acompanhamento agregado de recepção, triagem, espera e ausência. Faltam mapa territorial, séries históricas, financiamento e decisões gerenciais vinculadas a dados reais. |
| Lotação ao vivo | Parcial | Gestão vê contagens locais de senhas na recepção (incluindo anônimas), espera e atendimento na triagem, espera pelo cuidado e ausências, sem dados pessoais. Falta telemetria entre estabelecimentos e dispositivos. |
| Cofinanciamento | Parcial | Indicadores locais com numerador, denominador, meta, período e evidências. Cálculo oficial de cofinanciamento e regras versionadas continuam pendentes. |
| Desempenho | Parcial | Mede espera pelo balcão, duração da conferência, espera pela triagem, escuta, consulta e permanência. Inclui autoria da conferência, períodos por profissional, percurso da senha e exportação. Registros antigos não recebem horários inventados; telemetria remota e gestão completa de trocas de profissionais continuam pendentes. |
| Pré-natal do município | Parcial | Agregados de acompanhamentos abertos e encontros concluídos por unidade, sem prontuários para a gestão. Cobertura populacional, estratificação validada e dados externos continuam pendentes. |
| Vacinação do município | Parcial | Há produção válida por unidade e imunobiológico, retornos pendentes e atrasados, com transcrições separadas. Faltam cobertura populacional, denominadores por faixa e território, metas e dados oficiais conciliados. |
| Regulação | Parcial | Recebe encaminhamentos emitidos no consultório; agendamento local e reagendamento justificado com valores anteriores/autoria, filtro de datas ultrapassadas, cancelamento sincronizado e contrarreferência manual preservada no histórico da pessoa. Faltam vagas externas, autorização, devolução, contrarreferência recebida automaticamente e integração oficial. |
| Envio ao SUS | Parcial | Preparação de competências e pendências com conferência e histórico local. Não gera arquivos oficiais nem transmite lotes ao SUS. |
| Relatórios | Parcial | Exportação CSV inclui etapas da recepção/triagem, médias com quantidade de medições, profissionais do balcão e consulta, além de contagens por unidade. Relatórios oficiais e produção faturável continuam pendentes. |
| Configurações | Parcial | Separação de sessões, conferência de vínculos, diretório e abertura de telas de totem/TV. Cadastro CNES, políticas autenticadas e configurações clínicas continuam pendentes. |

### IA e comunicação

| Tela do Pulso | Cobertura | Percurso disponível e pendências |
|---|---|---|
| Campanhas | Parcial | Campanhas com público, objetivo, datas, responsável, rascunho e acompanhamento de situação. Seleção automática de pessoas e disparo real continuam pendentes. |
| Nova campanha | Parcial | Formulário de campanha, validação de datas, revisão, edição com histórico e encerramento. Não contrata ou envia comunicações. |
| Lembretes de consulta | Parcial | Tarefas de contato com data, referência, responsável e registro do resultado. Sem disparos D-10/D-2 ou alteração automática da agenda. |
| Alertas automáticos | Parcial | Pendências operacionais com prioridade, responsável, prazo e resolução rastreada. Alertas clínicos e monitoramento automático continuam pendentes. |
| Auditoria da IA | Parcial | Achados operacionais, responsáveis e revisão humana com histórico. Não executa auditoria clínica por IA nem expõe prontuários à administração. |
| WhatsApp da gestão | Parcial | Rascunhos de comunicados, público, responsável e revisão registrada. Sem conexão ou envio por WhatsApp. |
| WhatsApp do cidadão | Parcial | Registro manual de solicitações, prazo e acompanhamento de resposta. Portal autenticado, representação e WhatsApp do cidadão continuam pendentes. |

### Agentes de saúde

| Tela do Pulso | Cobertura | Percurso disponível e pendências |
|---|---|---|
| Entrar | Parcial | Sessão própria de agente de saúde, restrita à unidade. Autenticação, identidade no dispositivo e sincronização segura continuam pendentes. |
| Hoje | Parcial | Visitas planejadas, agenda do dia e pendências por data. Priorização informada pela equipe; sem protocolo automático. |
| Mapa | Parcial | Quadro de domicílios por microárea com acesso ao planejamento de visitas. Não é mapa geográfico; GPS e otimização de rota continuam pendentes. |
| Família | Parcial | Domicílio, referência familiar, moradores declarados, microárea, agente e necessidades com histórico. Vinculação individual completa e cadastro nacional continuam pendentes. |
| Registrar visita | Parcial | Visita vinculada à família, data, objetivo, prioridade e resultado; ausência, retorno ao planejamento e conclusão preservada. Sem geolocalização ou envio remoto. |
| Novo cadastro | Parcial | Formulário domiciliar com validação de moradores, edição rastreada e preservação após encerramento. Conciliação cadastral externa continua pendente. |
| Envios | Parcial | Conferência de registros locais e últimas alterações. Sincronização remota explicitamente indisponível; não há fila protegida de envio entre dispositivos. |
| Meu mês | Parcial | Produção por período da data planejada: visitas registradas, ausências, famílias visitadas e agenda. Indicadores oficiais continuam pendentes. |

### Gestão da empresa

| Tela do Pulso | Cobertura | Percurso disponível e pendências |
|---|---|---|
| Resumo | Parcial | Área exclusiva da operação Cuidelo, com carteira, contratos, valores declarados e implantação. Sem dados assistenciais ou conciliação financeira automática. |
| Municípios | Parcial | Carteira comercial com município, contato, responsável e unidades previstas. Não cria redes assistenciais nem libera acessos. |
| Contratos | Parcial | Contratos vinculados ao cliente, vigência, valor e escopo, com alterações rastreadas. Sem assinatura, cobrança ou contratação real. |
| Recebimentos | Parcial | Faturas vinculadas ao contrato, vencimento, valores e recebimento anotado manualmente com justificativa. Sem conexão bancária ou pagamento. |
| Implantação | Parcial | Etapas vinculadas ao cliente, responsáveis, prazo, evidência e conclusão. Não libera operação clínica automaticamente. |
| Uso e custos | Parcial | Acompanhamento da carteira, unidades previstas, etapas concluídas e chamados abertos. Telemetria de uso real e disponibilidade continuam pendentes. |
| Suporte | Parcial | Chamados vinculados ao cliente, prioridade, responsável, prazo e solução com histórico. Sem canal externo, SLA automatizado ou acesso a prontuários. |
| Equipe | Parcial | Diretório da equipe comercial, implantação, suporte e desenvolvimento. Não cria credenciais ou muda permissões reais. |

## Pendências fora do catálogo original

- **Hospital e urgência.** Admissão, transferência de leito, saída e higienização têm fluxo demonstrativo. Ainda faltam operação de UTI, centro cirúrgico e maternidade, medicação à beira-leito, passagem de plantão e validação institucional dos protocolos.
- **Dados e capacidade.** A operação clínica da estação ainda depende do armazenamento do navegador. A implantação precisa de identidade autenticada, autorização no servidor por rede e unidade, persistência protegida, recuperação de dados, auditoria protegida e teste de carga para 100 postos simultâneos.
- **Conexões oficiais.** O painel separa oito frentes de implantação, incluindo os sistemas do SUS e parceiros de diagnóstico. Conferimos as referências públicas. A referência de faturamento usa o diretório do Ministério da Saúde para SIA e SIH. [Sistemas do DRAC](https://www.gov.br/saude/pt-br/composicao/saes/drac/sistemas/sistemas/).
- **Campo e dispositivos.** Permanecem a validação com as equipes nas unidades, acessibilidade com tecnologias assistivas e ensaios em aparelhos físicos, impressoras de senhas e TVs do local.

## Reproduzir a verificação

Com a aplicação de desenvolvimento em execução, informe a origem em `CUIDELO_AUDIT_ORIGIN` e execute `node scripts/audit-screens.mjs`. Para guardar as medições e capturas em uma pasta, informe `CUIDELO_AUDIT_DIR`. Os cenários usam sessões e dados fictícios isolados.
