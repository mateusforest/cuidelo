# Cuidelo Plano completo de produto e desenvolvimento

Plataforma para a rede pública com expansão posterior ao setor privado

29 de outubro de 2026 | Versão 2

O Cuidelo terá como foco inicial a rede pública completa: postos de saúde, UBS, UPA, pronto atendimento, hospitais públicos e gestão da rede. A primeira versão operacional deverá entregar esse escopo integrado. A construção terá etapas internas; redes particulares e empresas privadas serão atendidas em uma etapa posterior.

O ponto de partida é o protótipo HTML. Os dois fundadores conduzirão o desenvolvimento e já dispõem de postos para validação. O objetivo inicial de capacidade é atender 100 postos distribuídos entre vários municípios, além dos hospitais e serviços de urgência contratados. O volume hospitalar será dimensionado separadamente por leitos, atendimentos, cirurgias e exames.

### Decisões de produto

- Um núcleo clínico comum, com configurações por organização, unidade e serviço. Prefeituras, consórcios e hospitais públicos têm fronteiras próprias de acesso. A estrutura deve permitir atender clientes privados futuramente.
- Primeira implantação somente após aceite funcional, clínico, técnico e operacional de todos os módulos previstos para a versão. Uma tela ou integração demonstrativa não conta como módulo entregue.
- Cobertura completa pode combinar módulos próprios e componentes especializados integrados. O usuário deverá ter uma jornada coerente, com identificação e dados conciliados.
- Recursos específicos são ativados conforme o serviço existente. Uma UBS não exibirá leitos de UTI, mas a plataforma deverá oferecer o módulo hospitalar validado na primeira versão.
- A estreia cobre a rede pública completa. Convênios, cobrança particular e funções específicas de empresas privadas ficam para a expansão posterior, sem atrasar a primeira entrega pública.

### O que significa buscar o melhor sistema

A liderança será perseguida por segurança do paciente, facilidade de uso, confiabilidade, integração e resultado operacional. A afirmação de superioridade só poderá ser sustentada por comparações verificáveis, realizadas com critérios equivalentes. A aparência das telas não demonstra qualidade clínica ou capacidade de operação.

**Recomendação central:** desenvolver primeiro identidade, isolamento dos clientes, cadastro, encontro clínico e rastreabilidade. Construir sobre essa base os fluxos completos de UBS, urgência e internação. Validar faturamento, integrações e continuidade antes da estreia.

### Como usar o plano

As próximas páginas definem cobertura, arquitetura, dependências, testes, implantação, equipe e primeiros 90 dias. Metas de desempenho são propostas de engenharia a validar. Fontes regulatórias e técnicas estão identificadas por F1 a F14 e reunidas ao final.

<!-- nova pagina -->

## 1 Escopo completo da atenção municipal

Todos os grupos abaixo integram a primeira versão pública, incluindo postos, UBS, ambulatórios especializados, CAPS, centros odontológicos e reabilitação conforme os serviços da rede. A análise de campo definirá regras e testes; os responsáveis assistenciais aprovarão os protocolos.

| Módulo | Capacidades necessárias | Evidência de conclusão |
|---|---|---|
| Cadastro e território | Cidadão, responsáveis, nome social, CPF e CNS quando disponíveis, domicílios, famílias, microáreas e duplicidades | Localizar a pessoa correta e corrigir duplicidade sem perder histórico |
| Recepção e agenda | Agendamento, encaixe, confirmação, cancelamento, faltas, fila, salas, painel e acessibilidade | Mesma vaga não é ocupada duas vezes; percurso e espera rastreáveis |
| Prontuário | Histórico longitudinal, problemas, alergias, medicamentos, SOAP, evolução multiprofissional, documentos e anexos | Registro com autoria, versão, assinatura aplicável e recuperação |
| Enfermagem | Escuta, sinais vitais, processo de enfermagem, procedimentos, curativos e administração de medicamentos | Cada ato vinculado ao atendimento e ao profissional habilitado |
| Odontologia | Odontograma, plano de tratamento, evolução, procedimentos e encaminhamento especializado | Tratamento acompanhado por dente e por sessão |
| Linhas de cuidado | Pré-natal, puerpério, criança, adolescente, condições crônicas, pessoa idosa, saúde mental e reabilitação | Pendências, responsáveis e retornos com protocolo identificado |
| Vacinação | Histórico, doses, lote, validade, aplicação, aprazamento, estoque e registro de perdas | Rastreabilidade entre pessoa, dose, profissional e lote |
| Agentes e domicílio | Cadastro territorial, visitas, atividades, equipe, roteiros e operação sem internet | Visita permanece após reiniciar dispositivo e sincroniza sem duplicar |
| Regulação e transporte | Encaminhamentos, prioridade justificada, vagas, autorizações, contrarreferência, transporte e TFD | Solicitação acompanhada até atendimento e retorno à origem |
| Vigilância e gestão | Agravos, pendências de notificação, campanhas, produção, qualidade e relatórios gerenciais | Informação com origem e competência; envio oficial rastreável |

### Experiência do cidadão

Oferecer confirmação e remarcação, orientações, documentos autorizados, canal de atendimento e ouvidoria. O acesso deve funcionar com apoio presencial e alternativas ao celular. Responsáveis de crianças e pessoas representadas precisam ter vínculos e poderes definidos. Não mostrar informação clínica em painel público ou em mensagem aberta.

### Gestão pública

Disponibilizar indicadores consolidados, acompanhamento de metas e apoio documental ao planejamento e à prestação de contas. Relatórios RAG e PAS exigem revisão dos responsáveis e conciliação com os processos oficiais; uma geração de PDF não substitui sua elaboração e tramitação.

<!-- nova pagina -->

## 2 Escopo hospitalar e de urgência

O hospital terá fluxos próprios sobre o mesmo núcleo de identidade e prontuário. O vínculo de atendimento deverá indicar estabelecimento, setor, episódio e modalidade, sem misturar atendimento ambulatorial, observação e internação.

| Módulo | Capacidades necessárias | Evidência de conclusão |
|---|---|---|
| UPA e pronto atendimento | Acolhimento, classificação por protocolo aprovado, reavaliação, atendimento, medicação, observação, transferência, alta e óbito | Prioridade, tempos e mudanças de estado registrados; emergência não bloqueada por cadastro incompleto |
| Internação e leitos | Admissão, reserva, ocupação, transferências, isolamento, bloqueio, higienização e alta | Um leito não recebe ocupações simultâneas incompatíveis |
| Cuidado à beira do leito | Evoluções, prescrição, aprazamento, checagem, balanço hídrico, sinais, dispositivos e passagem de plantão | Ordem prescrita reconciliada com dispensação e administração |
| Farmácia hospitalar | Validação farmacêutica, separação, dispensação, devolução, fracionamento rastreável e medicamentos controlados | Lote e quantidade conciliados por paciente e evento |
| Centro cirúrgico | Agenda, equipe, sala, materiais, OPME, avaliação prévia, checklist, anestesia e recuperação | Procedimento e materiais rastreados até prontuário e conta |
| UTI | Leitos, evolução, prescrição, balanço, dispositivos, acompanhamento e integração de equipamentos contratados | Registros conferidos; dados de equipamentos identificados por origem e horário |
| Maternidade e pediatria | Atendimento obstétrico, parto, vínculo mãe e recém-nascido e identificação segura | Nenhuma troca de identidade; registros e documentos consistentes |
| Laboratório e imagem | Solicitação, coleta, identificação de amostra, processamento, laudo, revisão e comunicação de resultado crítico | Pedido correto retorna ao paciente correto e ao profissional responsável |
| CME e hemoterapia | Ciclos de esterilização, materiais, rastreabilidade e integração com serviço transfusional | Vínculos entre material ou componente, procedimento e paciente |
| Operação hospitalar | Nutrição, dietas, hotelaria, higienização, manutenção, patrimônio e engenharia clínica | Demandas encaminhadas e concluídas com responsável e prazo |

### Especialidades de maior complexidade

Oncologia, diálise, transplantes e outras linhas especializadas exigem regras próprias. A cobertura dessas especialidades deve ser obtida por desenvolvimento ou integração validada antes de operar um hospital que as demande. Não se presume suporte a qualquer especialidade apenas por existir um formulário genérico.

### Qualidade assistencial

Incluir acompanhamento de incidentes, ações corretivas, controle de infecção e apoio ao núcleo de segurança do paciente. O sistema deve permitir investigação sem expor desnecessariamente dados pessoais. Os protocolos de segurança são referência para os cenários de validação, especialmente identificação e medicamentos. [F9]

<!-- nova pagina -->

## 3 Gestão pública e expansão privada

A primeira entrega atenderá produção e faturamento SUS, recursos, suprimentos e gestão da rede pública. O modelo de dados permitirá novos pagadores no futuro, sem exigir implementar convênios ou cobrança particular nesta versão.

| Frente | Entrega da primeira versão | Controle necessário |
|---|---|---|
| Faturamento SUS | Produção, procedimentos, autorizações, contas, AIH, BPA e APAC quando aplicáveis, fechamento e retorno | Competência, versão de tabela, críticas, rejeições e reapresentação [F10] |
| Suprimentos | Requisição, compras, recebimento, estoque, centros de custo, transferências e inventário | Lotes, vencimento, perdas, rastreio e níveis de aprovação |
| Gestão de recursos | Custos, contratos, pagamentos, recebimentos e integração com sistemas contábeis e administrativos existentes | Segregação de funções, conciliação e rastreio da origem dos dados |
| Pessoas e capacidade | Profissionais, credenciais, vínculos, equipes, escalas, salas e equipamentos | Habilitação por função e período; CNES não substitui autorização interna |
| Gestão executiva | Ocupação, espera, produção, estoque, receita, glosas, custos e experiência do usuário | Indicador com fórmula, fonte, data e limites de interpretação |
| Administração Cuidelo | Clientes, contratos, módulos, implantação, faturamento da empresa, suporte e custos | Separação da administração assistencial e dos dados clínicos |

### Expansão posterior ao setor privado

Após consolidar a rede pública, desenvolver elegibilidade, autorizações, guias, contratos e tabelas de operadoras, TISS e TUSS, glosas e recursos. Acrescentar orçamento, cobrança particular e funções próprias de redes e empresas privadas. Esses itens terão plano e aceite separados. [F11]

### Construir e integrar

O Cuidelo deve dominar o núcleo clínico, os fluxos, as permissões e a rastreabilidade. Para imagem, analisadores laboratoriais, assinatura, contabilidade pública e sistemas especializados, avaliar componentes por prova de integração, custo total, portabilidade e suporte.

Uma integração só será aceita com contrato de dados definido, identificação correta do paciente, tratamento de indisponibilidade, reconciliação de resultados, acesso autorizado e responsabilidade pelo suporte. Um botão que abre outro sistema sem continuidade dos dados não satisfaz esse requisito.

### Critério de completude

Manter uma matriz com capacidade, responsável, implementação, dependências, testes e aceite. Todos os itens da primeira versão pública precisam estar concluídos. O escopo privado posterior deve constar separadamente, sem bloquear o aceite da rede pública.

<!-- nova pagina -->

## 4 Arquitetura para vários clientes

Adotar uma plataforma modular com núcleo transacional e serviços especializados. A dupla precisa conseguir entender, testar e operar a base inteira. Recomenda-se começar com módulos bem separados em uma aplicação principal, extraindo serviços quando houver necessidade comprovada de escala ou isolamento.

### Organização dos dados

Representar organização contratante, rede, estabelecimento, setor, equipe e vínculo do profissional. O contexto ativo é definido após autenticação e validado no servidor em cada operação. Nunca confiar somente no município informado pela tela.

Como desenho inicial, separar os dados assistenciais por organização em bancos próprios geridos pela plataforma, mantendo um cadastro central mínimo de clientes e identidade. A escolha final depende da prova técnica de custos, atualizações e recuperação. Mesmo com bancos separados, arquivos, filas, relatórios e caches precisam respeitar a mesma fronteira.

Municípios podem ter arranjos regionais e consórcios. Compartilhamento entre organizações exige finalidade, acordo e autorização específicos. Um CPF coincidente não libera automaticamente o prontuário de outro cliente. A mesma separação será preservada na futura entrada de redes privadas.

### Componentes da plataforma

- Interface web responsiva para unidades, interfaces adequadas à beira do leito e aplicativo de campo com operação local protegida.
- Núcleo de cadastro, atendimento, ordens clínicas, documentos, estoque e faturamento sobre banco transacional.
- Gestão de identidade, permissões por função e contexto, segundo fator e auditoria.
- Processamento em segundo plano para integrações, mensagens, documentos e relatórios demorados, com tentativas controladas.
- Armazenamento de anexos separado do banco; imagem médica em solução própria para imagem, com acesso e ciclo de vida definidos.
- Camada de indicadores que não sobrecarregue a operação clínica; dados consolidados com atualização explicitada.
- Monitoramento, cópias de segurança, gestão de segredos, implantação automatizada e ambientes separados.

### Configuração por cliente

Configurar horários, unidades, medicamentos, formulários, escalas, protocolos aprovados, tabelas SUS e identidade visual. Versionar as mudanças com vigência e responsável. Evitar uma cópia do programa para cada prefeitura ou hospital: isso multiplica correções e torna atualizações inseguras.

### Critério de aceite da base

Criar dois municípios e um hospital público de outra organização, todos fictícios. Tentar cruzar dados por buscas, endereços diretos, anexos, exportações, filas e relatórios. Recusar e registrar os acessos indevidos. Restaurar um cliente em ambiente isolado sem expor nem alterar os demais.

<!-- nova pagina -->

## 5 Modelo de informação e permissões

O modelo central deve representar pessoa, vínculo, encontro clínico, problema, observação, alergia, prescrição, administração, solicitação, resultado, internação, transferência, documento, movimento de estoque, conta e evento de integração. Identificadores internos estáveis conectam esses registros, preservando identificadores oficiais e locais.

### Regras de integridade

- Registrar autoria, organização, unidade, data do acontecimento, data da gravação e versão. Diferenciar horário do dispositivo e horário confirmado pelo servidor.
- Distinguir rascunho, registro concluído, documento assinado e retificação. Uma correção preserva o conteúdo anterior e o motivo.
- Usar vocabulários e tabelas versionados. CIAP, CID, SIGTAP e catálogos locais precisam de correspondências explícitas. TUSS será incorporada na expansão privada; não é intercambiável automaticamente com as tabelas SUS.
- Tratar pessoa não identificada, recém-nascido e cadastro incompleto. Identificar e reconciliar depois sem apagar o atendimento inicial.
- Unificar cadastros somente por processo autorizado, com prévia comparação, auditoria e possibilidade de correção da unificação.
- Separar pessoa, atendimento e conta. Um paciente pode ter vários episódios e pagadores sem duplicar sua identidade.

| Perfil | Acesso e responsabilidade | Limite principal |
|---|---|---|
| Recepção | Identificação, contato, agenda e chegada | Sem acesso indiscriminado à evolução clínica |
| Equipe assistencial | Conteúdo necessário ao cuidado, dentro de habilitação e vínculo | Prescrição e atos condicionados à categoria e regras válidas |
| Farmácia e diagnóstico | Ordens e informações necessárias ao serviço | Acesso proporcional à tarefa |
| ACS | Território e dados autorizados para acompanhamento | Dispositivo limitado à microárea e ao trabalho atribuído |
| Regulação e faturamento | Dados necessários à autorização, encaminhamento e conta | Finalidade explícita e exportações controladas |
| Gestor e prefeitura | Indicadores e acompanhamento operacional | Dados nominais apenas quando necessários e autorizados |
| TI e suporte Cuidelo | Configuração e diagnóstico técnico | Sem prontuário por padrão; acesso excepcional temporário e auditado |

### Acesso excepcional

Uma situação assistencial de emergência poderá exigir acesso excepcional conforme política aprovada. Exigir identificação, justificativa e revisão posterior. O mecanismo não atravessa clientes automaticamente. Acesso de suporte é outro fluxo e não recebe privilégios clínicos por conveniência.

Separar representação do paciente de simples contato. Um telefone cadastrado não comprova identidade nem autoriza entrega de resultado. Contas técnicas e integrações também recebem permissões mínimas e credenciais revogáveis. [F6]

<!-- nova pagina -->

## 6 Integrações prioritárias da rede pública

Mapear a fonte oficial de cada dado, o sentido de cada troca, a frequência, a credencial e o responsável por cada conector. Não prometer integração universal antes de confirmar documentação e acesso. A interface LEDI documentada transmite registros ao PEC; não implica leitura irrestrita do prontuário existente. [F1]

| Integração | Finalidade e condição | Aceite necessário |
|---|---|---|
| e-SUS APS e Siaps | Produção da APS por fluxo vigente, com modelos LEDI compatíveis; definir responsabilidade de envio [F1 F2] | Lote conhecido, resposta registrada, conciliação e correção de rejeições |
| RNDS | Troca dos modelos clínicos disponíveis e contratados; credenciamento e homologação [F3] | Evidência do modelo transmitido, retorno e acesso de produção autorizado |
| Cadastros oficiais | CNES, equipes e identificação por serviços e arquivos autorizados | Origem, vigência e divergências tratadas sem conceder acesso automaticamente |
| Assistência farmacêutica | Fluxo BNAFAR e compatibilidade com o arranjo local; e-SUS AF quando utilizado [F4] | Estoques e movimentos conciliados; rejeições visíveis |
| Regulação | SISREG, e-SUS Regulação ou solução estadual e local conforme acesso disponível [F5] | Pedido, vaga e situação reconciliados sem duplicar fila |
| SIA e SIH | Registros, contas e arquivos conforme instrumento e competência [F10] | Importação ou transmissão válida e análise dos retornos oficiais |
| Diagnóstico | Sistemas de laboratório e imagem, padrões suportados pelo fornecedor e equipamentos | Pedido, amostra, paciente, laudo e versão coincidentes |
| Assinatura e receituários | Serviço de assinatura e SNCR conforme tipo de documento e requisitos aplicáveis [F12] | Autenticidade, autoria, validade e cancelamento verificáveis |
| Mensageria e gestão | Provedor oficial de mensagens e sistemas administrativos e contábeis da rede | Retornos, custos, falhas e conciliação documentados |

### Estados que o usuário precisa entender

Separar registro salvo, envio pendente, recebido pelo destino, rejeitado e conciliado. Um recebimento técnico não significa aprovação da produção ou pagamento. Guardar identificador, versão do conteúdo, tentativas, resposta e responsável pela pendência.

Reenvio deve evitar duplicação. Falha em um destino não pode impedir a gravação clínica. Usar filas por cliente, reprocessamento seguro e alertas de atraso. Proibir edição não documentada de bases de terceiros. Conectores de convênios e pagamentos particulares pertencem à expansão privada.

<!-- nova pagina -->

## 7 Continuidade e funcionamento sem internet

Os cenários são diferentes. Um agente em visita pode trabalhar com dados locais e sincronizar depois. Uma enfermaria com vários profissionais precisa de uma visão coordenada das prescrições e administrações. Armazenar cópias independentes em cada navegador não resolve a segurança hospitalar.

### Campo e atenção primária

O aplicativo deverá guardar somente os dados necessários ao trabalho autorizado. Criptografar a informação local, limitar a validade do acesso, controlar dispositivos e mostrar o que está salvo no aparelho e o que já chegou ao servidor. O bloqueio remoto depende de reconexão; por isso a proteção local é obrigatória.

Visitas e anotações usam identificadores únicos para reenvio sem duplicação. Mudanças concorrentes não são sobrescritas silenciosamente. Cadastros conflitantes geram comparação; documentos assinados permanecem imutáveis; agendas e estoques precisam de reconciliação específica. Não permitir alocação offline ilimitada de vagas ou estoque já disputado.

### Hospital e urgência

Para cada estabelecimento, definir redundância de conexão, energia, rede local, estações de contingência e plano de indisponibilidade. Onde necessário, prever um nó local com armazenamento e coordenação transacional durante a perda da conexão externa. Essa alternativa exige projeto, testes e operação próprios.

Escolher uma autoridade de escrita por conjunto de operações durante a falha. Evitar que nuvem e unidade confirmem simultaneamente prescrições, administrações ou ocupações incompatíveis. Estado potencialmente desatualizado deve ser indicado com clareza. A equipe clínica definirá quais atos podem continuar no sistema e quais seguem contingência formal.

### Cenários obrigatórios de teste

- Internet cai durante um salvamento: o usuário sabe se foi confirmado, pendente ou não gravado.
- Aplicativo ou estação reinicia: registros confirmados continuam disponíveis.
- Dois profissionais alteram a mesma informação: o conflito é mostrado e resolvido sem perda silenciosa.
- A conexão retorna: sincronização preserva autoria, horário, ordem e identificadores.
- Uma prescrição muda durante contingência: a equipe reconcilia as administrações antes de retomar a rotina.
- Uma unidade é isolada: as demais continuam operando e o suporte identifica a extensão do problema.

### Recuperação

Manter cópias protegidas contra alteração e testar restauração de banco, anexos e configurações. O retorno de um backup pode exigir reconciliação com integrações e registros locais posteriores; restaurar arquivos não encerra a recuperação. Um ensaio assistido de contingência integra o aceite da primeira versão.

<!-- nova pagina -->

## 8 Segurança clínica e proteção de dados

O Cuidelo deve ter uma instância de validação com representantes médicos, de enfermagem, farmácia, diagnóstico, gestão e segurança do paciente. Os fundadores implementam as regras aprovadas; não assumem decisões assistenciais por interpretação do protótipo.

### Barreiras clínicas

- Identificação consistente em todas as telas, pulseiras, etiquetas, pedidos e documentos. Usar os identificadores definidos pelo serviço para confirmar a pessoa antes de cada ato.
- Prescrição estruturada com medicamento, apresentação, dose, unidade, via, frequência e duração quando aplicáveis; validação de campos e versionamento.
- Alergias em destaque; alertas de interação e dose somente com base clínica adequada, atualizada e validada. Alertas justificáveis e monitorados para evitar excesso sem utilidade.
- Administração ligada à ordem e ao profissional, com horário real, omissão, recusa, atraso, suspensão e justificativa. Código de barras apoia a conferência, sem substituir o protocolo clínico.
- Resultado crítico com destinatário, confirmação de ciência e escalonamento. Disponibilizar o laudo não comprova que alguém o avaliou.
- Classificação de risco, protocolos, escores e apoio a decisão com versão e aprovação. Avaliar enquadramento regulatório das funções de software médico pela finalidade. [F8 F9]

### Proteção de dados

Documentar quem controla e quem opera os dados em cada contrato e finalidade, incluindo subcontratados. O paciente é titular dos dados. Bases legais do cuidado, comunicações opcionais e outros usos devem ser tratadas separadamente. O consentimento não será usado como justificativa genérica para todas as operações. [F6]

Exigir criptografia em trânsito e armazenamento, segundo fator para acessos definidos por risco, revogação de vínculos, controle de sessão, gestão de segredos, registro de leitura e alteração e restrição de exportações. Ambientes de teste usarão dados fictícios ou adequadamente desidentificados.

Definir retenção e descarte por categoria documental, preservação por necessidade legal e atendimento aos direitos do titular. Não apagar prontuários automaticamente ao encerrar contrato. A política precisa considerar a Lei 13.787 e demais regras aplicáveis ao documento e à instituição. [F7]

### IA e comunicação

IA pode apoiar busca, resumo e rascunho, com fonte identificável e revisão humana antes de assinar. Não pode alterar prontuário, decidir alta, dose ou prioridade de forma autônoma. Não usar dados clínicos para treinamento de terceiros por padrão. Definir contrato, minimização e avaliação de qualidade antes de ativar cada recurso.

Mensagens devem expor o mínimo necessário, verificar destinatário e oferecer canais alternativos. Assistência e acesso ao serviço não dependerão de aceitar campanhas ou utilizar WhatsApp.

<!-- nova pagina -->

## 9 Experiência e critérios de excelência

O objetivo é permitir que cada profissional conclua o trabalho com clareza, sem repetir informação e sem perder o contexto do paciente. A interface deve apresentar a tarefa prioritária, o estado do atendimento e o próximo passo, com detalhes adicionais sob demanda.

### Requisitos de usabilidade

- Telas por função e situação de trabalho, com paciente, unidade e episódio sempre identificáveis. Troca de contexto evidente para quem atua em mais de uma organização.
- Busca tolerante a variações de grafia, acompanhada de conferência de identidade. Atalhos de teclado, navegação previsível e formulários que reaproveitam dados confirmados.
- Rascunho automático com estado de salvamento visível. A confirmação clínica ou financeira ocorre por ação explícita do responsável.
- Tratamento claro de erro: explicar o que falhou, o que foi preservado e como retomar. Nunca mostrar sucesso antes da confirmação correspondente.
- Contraste, tamanho de texto, foco, navegação por teclado, leitores de tela e informação que não dependa somente de cor. Validar com profissionais com deficiência e aparelhos reais. [F13]
- Impressos legíveis e identificados, com cancelamento ou retificação rastreáveis. Etiquetas e pulseiras testadas nas impressoras do cliente.

### Como avaliar a ambição de liderança

| Dimensão | Como medir | Regra de interpretação |
|---|---|---|
| Facilidade de uso | Tempo, erros e necessidade de ajuda em tarefas representativas | Comparar a mesma tarefa e perfil, sem treinamento desigual |
| Retrabalho | Campos redigitados, duplicidades e conciliações manuais | Medir antes e depois com origem identificada |
| Confiabilidade | Disponibilidade, recuperação, falhas e integridade dos registros | Separar indisponibilidade do Cuidelo, unidade e integrador |
| Segurança clínica | Cenários perigosos bloqueados, incidentes e revisão de alertas | Evitar tratar ausência de notificações como ausência de risco |
| Integração | Pendências, rejeições e tempo até conciliação | Separar envio técnico de aceitação do dado |
| Experiência | Tarefas concluídas e entrevistas com profissionais e pacientes | Contextualizar por serviço, acesso e perfil |

### Indicadores responsáveis

Todo painel deve informar população, período, fonte, atualização e fórmula. Não comparar produtividade clínica sem considerar carga, complexidade e condições de trabalho. Não transformar velocidade em incentivo para encurtar cuidado necessário. Estimativas financeiras precisam mostrar hipóteses; produção enviada não é receita garantida.

Estabelecer uma linha de base com os postos já disponíveis e, para hospital e urgência, obter parceiros representativos. Repetir a avaliação após estabilização. Usar os resultados para priorizar melhorias e para comprovar benefícios comerciais sem alegações não demonstradas.

<!-- nova pagina -->

## 10 Ordem de desenvolvimento da versão completa

As etapas abaixo são marcos internos de construção, não versões comerciais incompletas. Cada marco produz fluxos testáveis em ambiente de validação. A primeira entrada em produção ocorre somente após o marco H e o aceite global descrito na seção 12.

| Marco | Entrega interna | Dependência principal |
|---|---|---|
| A Definição e provas | Inventário da rede, mapa de processos, matriz da versão completa, dados, integrações, riscos e parceiros hospitalares | Disponibilidade dos serviços e responsáveis |
| B Fundação | Clientes, identidade, permissões, auditoria, cadastro, ambientes, backups e modelo clínico comum | A; isolamento e recuperação testados |
| C Fluxo clínico central | Agenda, chegada, episódio, evolução, ordens, documentos, assinatura e resultado | B; núcleo reutilizável por UBS e hospital |
| D Atenção municipal | Enfermagem, odontologia, vacinação, linhas de cuidado, ACS, farmácia, regulação, transporte e vigilância | C; catálogos e validação assistencial |
| E Hospital e urgência | Classificação, observação, internação, medicação, UTI, cirurgia, maternidade, apoio e alta | C; enfermagem e farmácia compartilhadas com D |
| F Produção e gestão | Faturamento SUS, suprimentos, recursos, indicadores e administração da empresa | Eventos produzidos por C, D e E |
| G Integração e continuidade | Conectores completos, migração, contingência, segurança, carga, operação e treinamento | Provas iniciadas em A; fechamento depende de C a F |
| H Aceite global | Jornadas completas, ensaios assistenciais, restauração, suporte e plano de implantação aprovados | Todos os marcos anteriores e requisitos da versão |

### Trabalho que começa cedo e acompanha o projeto

As integrações não começam apenas em G. Credenciais, acesso a documentação, amostras e provas de transmissão começam em A. Testes, privacidade, avaliação clínica e monitoramento acompanham cada marco. G encerra e consolida essas frentes.

### Prazo com dois desenvolvedores

Não há base suficiente para prometer uma data de entrega: ainda faltam a carteira de serviços hospitalares, integrações acessíveis, dedicação semanal e experiência da dupla. O escopo corresponde a um programa de produto e operação, com validação por várias profissões.

Nas primeiras quatro semanas, estimar cada pacote após provas técnicas, registrar incerteza e reservar capacidade para revisão, correções e operação. Publicar então cenários de prazo e custo: somente desenvolvimento próprio; núcleo próprio com parceiros; ou ampliação de equipe. Nenhum cenário muda o requisito de estreia completa sem decisão do contratante do projeto.

<!-- nova pagina -->

## 11 Trabalho dos primeiros 90 dias

Este é um plano de execução inicial para a dupla, não uma promessa de versão completa em 90 dias. Ao fim do período, a base deve demonstrar segurança e permitir uma previsão mais confiável do restante. A distribuição entre os fundadores será ajustada às competências reais.

### Dias 1 a 15

- Fundador A acompanha recepção, enfermagem, consultório, farmácia e ACS nos postos disponíveis; registra tarefas, exceções, volumes e impressos.
- Fundador B inventaria conectividade, equipamentos, sistemas, dados, acesso a integrações e limitações de exportação. Nenhum dado real é copiado para ambiente de teste sem tratamento e autorização adequados.
- Ambos obtêm um hospital público e uma UPA ou pronto atendimento para validação; identificam representante de produção e faturamento SUS. Os postos disponíveis não validam sozinhos esses serviços.
- Criar a matriz completa de capacidades, com identificador, usuário, cenário, regra, dependência, risco, responsável, teste e evidência.

### Dias 16 a 30

- Definir modelo de clientes, pessoa, episódio, ordens e documentos. Registrar decisões de arquitetura e estratégia de contingência.
- Fazer prova de isolamento com dois municípios e um hospital público de outra organização, todos fictícios, incluindo anexos e exportação.
- Provar um fluxo de integração APS em ambiente autorizado e obter condições técnicas de RNDS, diagnóstico e SIH/SIA. Quando o acesso depender de terceiro, registrar responsável e data de retorno.
- Comparar componentes especializados por prova funcional, contrato, custos, portabilidade e suporte. Fechar orçamento e cenários de cronograma por pacote.

### Dias 31 a 60

- Implementar autenticação, segundo fator, vínculos, permissões, auditoria, cadastro, busca e recuperação de backup.
- Construir uma jornada interna de agenda, chegada, episódio, evolução e ordem clínica, com dados fictícios.
- Configurar revisão de código entre os dois, testes automatizados dos riscos prioritários e implantação reproduzível em ambiente de validação.

### Dias 61 a 90

- Ampliar a jornada interna para resultado, prescrição, dispensação e administração, mantendo autoria e versões.
- Modelar admissão, ocupação, transferência e alta; testar disputa de vaga e de leito.
- Provar reenvio sem duplicação, falha de conexão e conflito entre alterações.
- Realizar sessões com profissionais dos diferentes serviços. Atualizar estimativas a partir do trabalho concluído, não de percentuais visuais das telas.

**Entrega do período:** matriz do escopo completo, decisões técnicas, base executável, evidências das provas, riscos abertos com responsáveis e plano estimado dos marcos restantes. A primeira implantação continua condicionada ao aceite global.

<!-- nova pagina -->

## 12 Aceite da primeira versão completa

Cada módulo precisa de requisito, implementação, teste, manual e responsável pelo aceite. Validar em ambientes representativos, com dados fictícios e cenários realistas. As simulações devem incluir os profissionais que executarão o trabalho. Teste técnico sozinho não valida adequação assistencial.

| Jornada | Teste de ponta a ponta | Quem valida |
|---|---|---|
| UBS | Agenda, identificação, escuta, consulta, pedido, receita, farmácia, retorno e produção | Recepção, enfermagem, médico, farmácia e gestão APS |
| Território | Visita sem sinal, reinício do aparelho, sincronização, conflito e atualização autorizada | ACS, coordenação e TI |
| Urgência | Identificação provisória, risco, reavaliação, atendimento, observação, medicação e destino | Responsáveis de urgência e enfermagem |
| Internação | Admissão, leito, prescrição, dispensação, administração, transferência e alta | Médico, enfermagem, farmácia e gestão de leitos |
| Cirurgia e UTI | Reserva, equipe, materiais, checklist, anestesia ou acompanhamento intensivo e registro final | Responsáveis especializados |
| Diagnóstico | Pedido, coleta, amostra, resultado, revisão, criticidade e ciência | Laboratório, imagem e assistência |
| Produção SUS | Atendimento, autorização, conta, envio, rejeição, correção e retorno | Faturamento, regulação e gestão |
| Continuidade | Falha de internet e servidor, contingência, recuperação e reconciliação | Assistência, operação e TI |
| Privacidade | Acesso entre organizações, perfil indevido, exportação, revogação e suporte excepcional | Segurança e responsáveis por dados |

### Condições para liberar produção

- Todos os itens obrigatórios da versão completa aceitos e integrações contratadas operacionais. Impedimentos externos não podem ser apresentados como funcionalidades entregues.
- Nenhum defeito crítico de segurança, identidade, gravação, prescrição, administração, leito ou faturamento conhecido e sem resolução.
- Migração reconciliada; divergências resolvidas ou tratadas em procedimento formal que não comprometa o cuidado.
- Ensaios de recuperação e contingência aprovados; capacidade medida; monitoramento e plantão em funcionamento.
- Profissionais treinados por função, responsáveis locais designados e plano de reversão ensaiado.

Registrar resultado, versão testada, instituição, responsáveis e data. Se uma atualização muda regra clínica ou integração crítica, repetir os testes afetados. O aceite não é uma autorização genérica para qualquer uso futuro.

**Ambientes de demonstração e validação não são produção.** A primeira implantação pode abranger poucas unidades, mas recebe a versão completa. Acompanhamento intensivo não substitui a conclusão dos requisitos.

<!-- nova pagina -->

## 13 Capacidade e metas de serviço

O objetivo de 100 postos será tratado como quantidade de unidades, não como quantidade de prefeituras. A carga dos hospitais será somada conforme porte real. Os números abaixo são hipóteses para dimensionar testes, e não medições do produto ou do mercado.

### Modelo inicial de carga

Para os postos, assumir inicialmente 100 unidades, 10 estações por unidade e 60% de uso simultâneo: 600 usuários ativos. Assumir 150 atendimentos por unidade por dia: 15 mil atendimentos diários. Uma ação a cada 10 segundos por usuário resulta em 60 ações por segundo, antes de consultas automáticas, integrações e anexos.

Testar a carga estimada e um pico de três vezes a taxa, com mistura realista de buscas, gravações, impressão, relatórios e sincronização. Medir também as consultas geradas por cada ação. O tráfego técnico pode ser muito maior que o número de cliques.

Nos hospitais, levantar leitos instalados e ocupados, usuários por turno, doses administradas, exames, imagens, cirurgias e retenção. Imagens médicas e sinais de equipamentos não cabem em uma estimativa baseada apenas em consultas. Nenhuma capacidade hospitalar será anunciada antes desse dimensionamento.

| Meta proposta | Alvo inicial para validação | Como comprovar |
|---|---|---|
| Tela frequente | 95% das operações em até 2 segundos no ambiente de referência | Teste com volume, equipamentos e rede documentados |
| Gravação confirmada | Sem perda ou duplicação nos cenários de operação e testes definidos | Reinício, reenvio, falha e concorrência |
| Disponibilidade hospitalar | 99,95% mensal para o serviço contratado | Medição externa; cerca de 22 minutos em mês de 30 dias |
| Recuperação de desastre | Objetivo inicial de até 30 minutos; perda potencial de até 5 minutos conforme arquitetura | Ensaio e medição; contingência clínica cobre o intervalo |
| Integrações | Toda pendência com idade, causa e responsável | Painel e alertas; prazos por destino |
| Isolamento | Nenhum cruzamento indevido nos testes de clientes | Testes automatizados e avaliação independente |

A meta de perda potencial em desastre não autoriza perder registros rotineiramente. Se o risco assistencial exigir perda zero, o desenho precisa de replicação e contingência compatíveis e novo orçamento. As metas só entram em contrato após demonstração e definição de fronteiras e exclusões.

Testar ainda três distribuições: um cliente com 100 postos, dez com dez e 25 com quatro. Limitar relatórios e integrações de um cliente para não prejudicar os demais.

<!-- nova pagina -->

## 14 Implantação completa e expansão

A escala será ampliada após comprovação de estabilidade. Todos os grupos recebem a versão completa; a configuração mostra os módulos correspondentes ao serviço. As quantidades abaixo são uma proposta de expansão, sujeita à disponibilidade dos clientes e à capacidade de suporte.

| Etapa de operação | Abrangência | Condição para avançar |
|---|---|---|
| Primeira implantação | 2 a 3 postos e serviços hospitalar e de urgência parceiros | Aceite global anterior à entrada; acompanhamento presencial ou remoto intensivo |
| Até 10 postos | Incluir uma segunda organização e manter hospital e urgência acompanhados | Confirmar isolamento, configuração, treinamento e operação sem correções locais improvisadas |
| Até 25 postos | Redes com conectividade e perfis distintos | Suporte estável, migração repetível e carga validada |
| Até 50 postos | Mais municípios ou grupos contratados | Rotina de atualização e recuperação comprovada; equipe de operação dimensionada |
| Até 100 postos | Expansão da base com hospitais dimensionados separadamente | Capacidade, custos, plantão e indicadores dentro das metas contratadas |

### Preparação de cada cliente

Inventariar sistemas, bases, contratos, equipamentos, impressoras, rede, horários e carteira de serviços. Nomear patrocinador, responsável clínico, TI e representantes por setor. Fazer análise de qualidade dos dados e confirmar direitos e mecanismos de exportação do fornecedor anterior.

Executar migração de teste com contagem de registros, amostra clínica e reconciliação de saldos e documentos. Preservar o original, a origem e as decisões de transformação. Definir como consultar históricos que não possam ser migrados integralmente. Um histórico incompleto deve estar claramente identificado.

### Entrada em operação

Definir janela, congelamento quando necessário, responsabilidades, canais de incidente e critérios de interromper a mudança. Ensaiar o plano de reversão antes. Se houver retorno ao sistema anterior, reconciliar o que foi registrado durante o período no Cuidelo; não basta religar o sistema antigo.

Treinar por função e turno, com usuários multiplicadores. Confirmar entendimento por tarefas executadas, e não somente por presença no treinamento. No hospital, incluir noite, fins de semana, contingência e troca de plantão.

### Período de estabilização

Propor pelo menos quatro semanas de observação e um ciclo completo de fechamento de produção ou faturamento, ampliando conforme o risco. Não expandir com falhas críticas abertas, dados sem conciliação ou suporte sem capacidade. A qualidade da implantação integra o produto entregue.

<!-- nova pagina -->

## 15 Equipe e operação permanente

Os dois fundadores podem conduzir produto, arquitetura e desenvolvimento, com revisão cruzada. O plano exige participação de profissionais das áreas operadas. Os postos facilitam a validação da APS; hospital público e urgência exigem interlocutores próprios. Especialistas de saúde suplementar entram na etapa privada.

| Responsabilidade | Organização proposta | Entrega esperada |
|---|---|---|
| Produto e experiência | Um fundador lidera processos e interface; ambos decidem escopo | Requisitos testáveis e sessões com usuários |
| Plataforma e integração | Outro fundador lidera dados e conectores; ambos revisam código | Isolamento, integridade, contratos de dados e recuperação |
| Validação clínica | Profissionais designados de cada serviço | Protocolos, cenários críticos e aceite assistencial |
| Produção e faturamento | Especialista SUS e responsáveis da rede | Contas e retornos testados em competências reais autorizadas |
| Segurança e privacidade | Apoio especializado e responsáveis das instituições | Revisão independente, contratos de tratamento e resposta a incidentes |
| Implantação e suporte | Estrutura própria ou parceira conforme volume e horário | Treinamento, acompanhamento, canais e escalonamento |

### Capacidade da dupla

Registrar dedicação semanal real e distribuir trabalho entre desenvolvimento, testes, reuniões e suporte. A estimativa deve usar a capacidade líquida, não todas as horas do calendário. Reduzir trabalho simultâneo e demonstrar fluxos inteiros com frequência.

Se houver necessidade de acelerar, ampliar capacidade com competências específicas ou integrar componentes validados. Não trocar testes clínicos, isolamento ou recuperação por velocidade. A equipe de dois desenvolvedores não equivale, por si só, a uma operação de suporte 24 horas.

### Operação hospitalar contínua

Antes da produção, definir plantão com cobertura, substituição, escalonamento e comunicação de incidentes. Separar indisponibilidade geral, falha de cliente, defeito clínico, integração atrasada e dúvida de uso. Incidentes com risco ao paciente ou exposição de dados exigem tratamento prioritário e responsáveis específicos.

Monitorar filas, rejeições, espaço, banco, certificados, backups, dispositivos e disponibilidade. Propor simulado de restauração antes da estreia e periodicamente; revisar a frequência conforme risco e contrato. Toda mudança de infraestrutura deve preservar a trilha de validação.

### Desenvolvimento sustentável

Código versionado, revisão entre os dois, ambientes separados, testes de riscos, migrações de banco verificadas e documentação operacional. Para atualizações, usar mudanças compatíveis, liberação controlada e reversão ensaiada. Componentes de terceiros precisam de inventário, atualização e tratamento de vulnerabilidades.

<!-- nova pagina -->

## 16 Custos contratos e riscos do programa

O orçamento deve separar construção, implantação e operação. Sem dimensionamento hospitalar e propostas de fornecedores, apresentar um preço fechado criaria precisão artificial. Orçar por pacote, com premissas, dependências e margem de incerteza.

### Estrutura do orçamento

- Construção: horas dos fundadores, apoio técnico, design, validação clínica, segurança, integrações e testes. Registrar também o valor do trabalho próprio.
- Implantação: levantamento, limpeza e migração, treinamento, viagens, equipamentos locais e acompanhamento por turno.
- Operação: infraestrutura, banco, anexos e imagens, recuperação, monitoramento, suporte e manutenção de integrações.
- Terceiros: assinatura, mensagens, serviços especializados, licenças, conectores, pagamentos e eventual uso de IA.
- Comercial e administração: contratação, faturamento, gestão de contratos, proteção de dados e suporte jurídico conforme necessidade.

Calcular custo mensal por cliente e por unidade, separando componentes fixos e consumo. Para hospitais, incluir leitos, exames, imagens, transações e suporte. Avaliar cenários de 10, 25, 50 e 100 postos e cenários hospitalares próprios. Não usar valores demonstrativos do HTML como referência comercial.

### Contrato e portabilidade

O contrato deve definir escopo público, módulos próprios e integrados, responsabilidades, disponibilidade, suporte, implantação, atualizações, dados, subcontratados, integração e encerramento. Prever exportação documentada, preservação de assinaturas e auxílio à transição. As exigências da contratação pública devem ser verificadas pelo responsável jurídico, sem pressupor uma modalidade específica.

| Risco | Prevenção e resposta | Responsável proposto |
|---|---|---|
| Escopo crescer sem controle | Matriz da versão e avaliação de impacto de cada mudança | Fundadores |
| Integração sem acesso | Prova e credenciais antecipadas; alternativa validada ou impedimento explícito | Líder de integração e cliente |
| Erro clínico ou identidade | Testes de risco, protocolos aprovados e correção prioritária | Responsável clínico e engenharia |
| Migração incompleta | Amostra clínica, conciliação e preservação do original | Implantação e cliente |
| Sobrecarga de suporte | Medir demanda e contratar capacidade antes da expansão | Operação |
| Dependência de parceiro | Portabilidade, contrato, testes de indisponibilidade e substituição | Fundadores |

Uma pendência crítica impede a estreia ou a expansão. A matriz de riscos deverá registrar impacto, probabilidade, ação, evidência e prazo, com revisão frequente até a primeira operação.

<!-- nova pagina -->

## 17 Decisões e entregas imediatas

As decisões abaixo tornam a primeira versão pública completa verificável e dimensionável, incluindo UBS, postos, UPA, pronto atendimento, hospitais e gestão da rede. A expansão privada será planejada posteriormente.

| Decisão | Informação a levantar | Entrega concreta |
|---|---|---|
| Instituições de referência | Postos e UBS disponíveis, hospital público, UPA e pronto atendimento | Lista de parceiros e responsáveis por setor |
| Porte hospitalar | Leitos, UTI, centro cirúrgico, maternidade, especialidades e volumes | Perfil de capacidade e matriz de módulos especializados |
| Sistemas existentes | Prontuários, farmácia, diagnóstico, regulação, financeiro e equipamentos | Mapa de integrações e fontes de dados |
| Capacidade de desenvolvimento | Experiência e horas semanais de cada fundador | Plano de trabalho e cenários de prazo |
| Componentes especializados | Necessidade, acesso técnico, custo, contrato e suporte | Decisão de construir ou integrar por módulo |
| Continuidade | Conectividade, energia, rede local e tolerância de cada serviço | Projeto de contingência por tipo de unidade |
| Sustentação | Cobertura, orçamento e fornecedores de operação | Plano de suporte e recuperação antes da produção |

### Primeiro pacote a desenvolver

Criar três organizações fictícias: dois municípios e um hospital público com gestão independente. Cada uma terá unidades, setores, usuários e vínculos distintos. Implementar autenticação, contexto, autorização, auditoria, cadastro de pessoa e episódio clínico.

Em seguida, demonstrar a mesma pessoa percorrendo, dentro de uma rede autorizada, uma consulta, um atendimento de urgência e uma internação, com episódios separados e histórico acessível conforme a função. Nenhum dado poderá atravessar organizações sem fluxo autorizado.

Completar esse pacote com restauração de backup, revogação de usuário, conflito de alterações e rastreabilidade de uma correção. Essa fundação permite desenvolver os demais módulos com coerência e reduz a necessidade de refazer a base depois.

### Entregáveis para conduzir o projeto

- Matriz da primeira versão com identificadores e critérios de aceite.
- Desenho de dados, arquitetura, integrações e contingência.
- Lista de trabalho ordenada por dependência e risco, com responsável e estimativa revisável.
- Plano de testes técnicos, clínicos, de migração e operação.
- Orçamento por cenário, plano de implantação e contrato de serviço.
- Evidências de aceite reunidas por versão antes de qualquer operação real.

O HTML será preservado como referência de experiência e fluxos. As telas de demonstração serão convertidas gradualmente em módulos reais durante o desenvolvimento, mas a disponibilização operacional seguirá o compromisso de primeira versão completa.

<!-- nova pagina -->

## 18 Fontes técnicas e regulatórias

Referências consultadas em 29 de outubro de 2026. Revalidar versões, modelos, prazos e requisitos antes de implementar ou contratar cada integração. As metas de produto, arquitetura e capacidade deste plano são propostas do projeto, não obrigações extraídas dessas fontes.

**F1 Ministério da Saúde** - API de transmissão de registros LEDI ao PEC e-SUS APS. Documenta transmissão de sistemas próprios, credenciais, HTTPS e respostas. [Acessar documentação](https://sisaps.saude.gov.br/sistemas/esusaps/docs/manual/APOIO/API_transmissao/).

**F2 Ministério da Saúde** - Orientações sobre versões compatíveis e validação de dados no Siaps. Sustenta a necessidade de manutenção dos modelos e versões. [Acessar orientação](https://www.gov.br/saude/pt-br/assuntos/noticias/2025/dezembro/ministerio-da-saude-publica-normativas-que-orientam-atualizacao-do-e-sus-aps-e-reforcam-qualidade-dos-dados-da-atencao-primaria).

**F3 RNDS** - Guia de integração e ambientes de homologação e produção. A disponibilidade depende do modelo, credenciamento e condições do serviço. [Guia](https://rnds-guia.saude.gov.br/) e [ambientes](https://rnds-guia.saude.gov.br/docs/rnds/ambientes/).

**F4 Ministério da Saúde** - Perguntas frequentes do e-SUS AF, uso de sistemas próprios e transmissão à BNAFAR. [Acessar orientação](https://webatendimento.saude.gov.br/faq/esusaf).

**F5 Ministério da Saúde** - Sistemas de informação para regulação do acesso. Apresenta SISREG, e-SUS Regulação e arranjos existentes. [Acessar página](https://www.gov.br/saude/pt-br/composicao/saes/drac/regulacao-do-acesso/sistemas-de-informacao/sistemas-de-informacao/).

**F6 ANPD** - Guia de tratamento de dados pessoais pelo poder público e definições de titular, controlador e operador. [Guia](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes/guia-poder-publico-anpd-versao-final.pdf) e [definições](https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados).

**F7 Presidência da República** - Lei 13.787 de 2018, sobre digitalização, guarda, armazenamento e manuseio de prontuários. A política de retenção exige análise do documento e das normas aplicáveis. [Acessar lei](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13787.htm).

**F8 Anvisa** - Perguntas e respostas sobre software como dispositivo médico. O enquadramento depende das funções e da finalidade; não se presume dispensa para apoio clínico. [Acessar publicação](https://www.gov.br/anvisa/pt-br/centraisdeconteudo/publicacoes/produtos-para-a-saude/manuais/software-como-dispositivo-medico-perguntas-e-respostas).

**F9 Ministério da Saúde e Anvisa** - Segurança na prescrição, uso e administração de medicamentos, e núcleos de segurança do paciente. [Protocolo](https://www.gov.br/saude/pt-br/composicao/saes/seguranca-do-paciente/publicacoes/protocolos-de-seguranca-do-paciente/protocolo-seguraca-na-prescricao-uso-e-administracao-de-medicamentos.pdf/view) e [núcleos](https://www.gov.br/anvisa/pt-br/acessoainformacao/perguntasfrequentes/servicos-de-saude/nucleos-de-seguranca-do-paciente).

<!-- nova pagina -->

## 19 Referências de faturamento e padrões

**F10 Ministério da Saúde** - Sistema de Informações Hospitalares e catálogo de dados de controle e avaliação. Referências para SIH, AIH, SIA e SIGTAP, conforme cada fluxo. [SIH](https://wiki.saude.gov.br/sih/index.php/P%C3%A1gina_principal) e [catálogo DRAC](https://controleavaliacao.saude.gov.br/).

**F11 ANS** - Referência reservada à expansão privada posterior: TISS e componentes de representação de conceitos, incluindo TUSS. Revalidar versões quando essa etapa começar. Não integra o aceite da primeira versão pública. [Acessar padrão](https://www.gov.br/ans/pt-br/assuntos/prestadores/padrao-para-troca-de-informacao-de-saude-suplementar-2013-tiss).

**F12 Anvisa** - Integração de sistemas de prescrição ao Sistema Nacional de Controle de Receituários e perguntas sobre documentos eletrônicos. Requisitos variam conforme receituário e etapa de implantação. [Documentação de integração](https://www.gov.br/anvisa/pt-br/assuntos/noticias-anvisa/anvisa-publica-documentacao-tecnica-para-integracao-de-sistemas-de-prescricao-eletronica-ao-sncr) e [perguntas sobre receituários](https://www.gov.br/anvisa/pt-br/assuntos/medicamentos/controlados/sncr/perguntas-e-respostas/perguntas-e-respostas-rdc-1000-2025-1-ed).

**F13 Governo Digital** - Modelo de Acessibilidade em Governo Eletrônico. Referência para acessibilidade de interfaces e serviços. [Acessar eMAG](https://emag.governoeletronico.gov.br/).

**F14 RNDS** - Guia de implementação FHIR. Define os modelos de interoperabilidade disponibilizados, que devem ser confirmados por caso de uso. [Acessar guia de implementação](https://rnds-fhir.saude.gov.br/index.html).

### Vocabulário utilizado

| Termo | Significado no plano |
|---|---|
| APS e UBS | Atenção Primária à Saúde e Unidade Básica de Saúde |
| Episódio clínico | Encontro ou período de cuidado, como consulta, urgência ou internação |
| LEDI e RNDS | Padrão de integração da APS e Rede Nacional de Dados em Saúde |
| CNES e CNS | Cadastro Nacional de Estabelecimentos de Saúde e Cartão Nacional de Saúde |
| SIH e SIA | Sistemas de informações hospitalares e ambulatoriais do SUS |
| AIH BPA e APAC | Instrumentos de autorização ou registro de produção conforme o atendimento |
| TISS e TUSS | Padrão de troca de informação e terminologia da saúde suplementar |
| OPME e CME | Órteses, próteses e materiais especiais; Central de Material e Esterilização |
| Homologação | Verificação formal de que o fluxo atende aos requisitos definidos |
| Conciliação | Comparação dos registros de origem e destino para resolver divergências |

Cada conector e documento clínico deverá manter sua referência normativa ou técnica, versão e responsável por atualização. A adoção de um padrão não substitui testes do fluxo completo nem autoriza acesso a bases de terceiros.
