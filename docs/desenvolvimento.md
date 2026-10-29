# Desenvolvimento e critérios de entrega

O escopo público completo está em [plano-completo.md](plano-completo.md). Esta lista ordena dependências de construção, sem autorizar uma implantação incompleta. A primeira operação em UBS, UPA, pronto atendimento e hospital depende do aceite dos módulos e integrações exigidos pela rede contratada.

## Marco atual: base local 0.4

Identidade aprovada, estrutura de interface, domínio separado da persistência e fluxos demonstráveis de cadastro, agenda, recepção, escuta, sinais vitais, correções, SOAP com complementos, painel de senhas, observação, leitos, estoque, encaminhamentos e vacinação com caderneta, lotes, aprazamentos e visão gerencial. Testes automatizados verificam regras e percursos críticos. Os módulos presentes não estão homologados para uso clínico.

## 1. Identidade de acesso e persistência

Conectar o backend acordado com os fundadores em etapa posterior. Modelar organizações, unidades, usuários, vínculos, funções e permissões. Definir representação do cidadão, identificação de duplicidade e compartilhamento entre redes. Substituir o adaptador local por operações autenticadas e transacionais.

**Aceite:** um usuário real só acessa as organizações e ações permitidas, inclusive por requisições diretas; tentativas de trocar identificadores são rejeitadas; conflitos não perdem dados; migrações, backup e restauração são demonstrados; nenhum segredo fica no navegador ou repositório.

## 2. Núcleo assistencial e operação dos serviços

Completar cadastro e território, profissionais, agendas e prontuário longitudinal. Desenvolver enfermagem, prescrição, validação farmacêutica, dispensação, administração, documentos e adendos. Validar acolhimento, classificação de risco, reavaliações, observação, internação, transferências e saídas com responsáveis assistenciais.

**Aceite:** cada etapa tem autor, horário, contexto, estados válidos e recuperação; percurso entre prescrição, dispensação e administração é conciliado; urgência dispõe de contingência e identificação segura; nenhuma tela genérica é considerada substituta de uma especialidade.

## 3. Cobertura completa da rede pública

Construir e validar odontologia, vacinação, agentes e domicílio, saúde mental, linhas de cuidado, especialidades, regulação, transporte, vigilância e comunicação com o cidadão. No hospital: UTI, centro cirúrgico, maternidade, pediatria, diagnóstico, CME, hemoterapia, nutrição, hotelaria e manutenção, por desenvolvimento próprio ou integração especializada validada.

**Aceite:** jornadas reais de cada serviço aprovadas pelos responsáveis, incluindo correções, cancelamentos, retornos, transferências, exceções e falhas. Equipamentos e terceiros têm comportamento verificado em ambientes de homologação apropriados.

## 4. Gestão pública e integrações

Completar suprimentos, compras, custos, contratos, equipes e escalas, produção e faturamento SUS. Implementar os conectores oficiais aplicáveis com identificação, versão, credenciais, filas, conciliação e tratamento de rejeições. O plano completo reúne as referências; revalidar a documentação vigente no início de cada integração.

**Aceite:** transmitir, receber e conciliar dados de ponta a ponta, com rastreamento e reprocessamento sem duplicidade. Painéis oficiais e prestação de contas devem ser conferidos pelos responsáveis. A tela de integração só passa a indicar conexão quando existir evidência verificável.

## 5. Validação antes da primeira implantação

- Cobertura acordada comprovada para UBS, UPA, pronto atendimento e hospital.
- Revisão dos fluxos assistenciais pelos profissionais responsáveis e validação dos protocolos aplicados.
- Isolamento de clientes, autorização, rastreabilidade, gestão de acessos e resposta a incidentes exercitados.
- Migração de dados, reconciliação, treinamento, suporte e operação contínua preparados.
- Testes de carga para 100 postos e volume hospitalar definido, incluindo gargalos de banco e integrações.
- Falhas de conectividade, indisponibilidade, recuperação e restauração testadas com tempos medidos.
- Acessibilidade, equipamentos utilizados nos serviços e ergonomia verificados em campo.
- Plano de entrada e reversão aprovado pelos responsáveis de cada rede.

## Organização entre os dois fundadores

Uma frente pode conduzir fluxos, interface e validação com unidades; outra pode conduzir dados, integrações e infraestrutura. Revisar em conjunto alterações de identidade do paciente, acesso, medicação, estado clínico e faturamento. A equipe de desenvolvimento precisa de participação assistencial e operacional dos serviços para homologar os módulos. Não é possível assumir um prazo de conclusão confiável apenas a partir desta base.

Os próximos incrementos locais incluem profissionais e vínculos, pré-natal, território e agentes, além de completar as pendências operacionais da vacinação. Em paralelo, preparar os contratos de acesso e persistência. A conexão do backend permanece para a etapa acordada com os fundadores, antes de qualquer uso com dados reais.
