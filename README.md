# Cuidelo

**Toda a rede. Mais perto das pessoas.**

Plataforma em desenvolvimento para prefeituras, UBS, postos, UPA, pronto atendimento e hospitais públicos. A expansão para redes privadas é posterior. Esta base organiza o desenvolvimento do escopo público completo; a primeira implantação operacional continua condicionada à entrega e validação desse escopo.

## Estado desta entrega

Versão **0.18.0**, de 31/10/2026. Aplicação local com dados fictícios, identidade aprovada e fluxos navegáveis. **Não é um sistema clínico pronto para atendimento.** Não insira dados reais. A entrada por sessões serve para testar os perfis e não autentica ninguém.

A [auditoria da versão 0.13](docs/auditoria-0.13.md) reúne os percursos verificados e as pendências para a operação real. A recepção concilia as senhas do totem com a agenda e revisa chegadas antigas. O hospital permite transferir de leito com histórico dentro da mesma internação.

A [primeira entrega dos 44 percursos](docs/escuta-fila-salas.md) liga a avaliação da enfermagem à fila, à TV e ao consultório. O mapa **Comparar com Pulso** permite consultar os recursos parciais na ordem de desenvolvimento.

A área **Dia a dia** reúne condições informadas pela pessoa, diário de crises e sintomas, horários de medicação, retirada, renovação e relatório por período. [Roteiro para testar o acompanhamento](docs/dia-a-dia.md).

O [app do cidadão](https://cuidelo.vercel.app/cidadao) permite consultar os próprios agendamentos, receitas, pedidos de exames e atestados no celular. A demonstração tem exemplos prontos e acesso temporário por pessoa a partir da estação assistencial. [Roteiro de teste](docs/app-do-cidadao.md).

A versão 0.16 permite testar a consulta da senha ao prontuário, com codificação manual, atestado, declaração e encerramento em uma única gravação. [Roteiro do consultório](docs/consultorio-0.16.md).

A versão 0.15 amplia a ocupação aos setores de triagem, enfermagem, vacinação e farmácia e conecta a TV de outro equipamento por código. [Roteiro para testar a TV e as salas](docs/html-e-painel-tv.md).

Já é possível testar:

- Recepção, consultório, registro clínico e farmácia com visual unificado, filas organizadas, resumos por etapa e atalhos para receitas e estoque.
- Totem em quatro etapas: identificação → serviço → preferência → conferência. Voltar mantém as escolhas; cancelar limpa a sessão. A senha só é emitida na confirmação final.

- Nova tela de entrada em `/acesso` e `/login`, com nove perfis predefinidos, seleção de prefeitura e unidade, e dois profissionais de demonstração para a equipe médica. Não solicita senha nem simula autenticação real.
- Visual renovado com menu lateral, contexto da unidade e da sessão, painel de indicadores e adaptação para celular. Na primeira abertura do endereço principal, a entrada demonstrativa é exibida antes da visão de trabalho; depois, a escolha é lembrada no navegador.

- Entrada de demonstração com nove perfis: prefeitura, administração local, recepção, equipe médica, enfermagem, farmácia, regulação, agente de saúde e operação da Cuidelo. As sessões operacionais ficam vinculadas à unidade; somente a prefeitura filtra unidades da própria rede.
- Cadastro de pessoas com atualização justificada de identificação e contato, histórico antes/depois e autoria. Busca por nome/CPF e filtros para CPF ou telefone não informados. Documentos emitidos preservam sua identificação original.
- Agenda com busca, filtros por profissional/situação, remarcação justificada com histórico, bloqueio de sobreposição de pessoa/profissional, cancelamento justificado e confirmação de chegada.
- Recepção com senhas do totem, chamada antes da identificação, conferência presencial de CPF ou nome e nascimento, preferência confirmada, cadastro no balcão e encaminhamento à triagem ou serviço. Ausência e retorno preservam a senha.
- Passagem da recepção para a triagem e o consultório, com chamadas na TV e tempos medidos por etapa. Início do atendimento, registro SOAP, rascunho e conclusão imutável na lógica da demonstração.
- Triagem com filas de espera, escuta em andamento e registros concluídos, filtro de data e tempos por etapa. Escuta inicial, sinais vitais, novas aferições e correções justificadas, vinculadas ao atendimento e ao histórico.
- Complementos de notas concluídas, preservando o texto original.
- Observação na urgência, admissão em leito, bloqueio de ocupação duplicada, saída e higienização.
- Farmácia recebe receitas do consultório: entrega total ou parcial, pessoa ou representante, vários lotes por item, saldo restante, baixa vinculada e comprovante para impressão. O histórico fica disponível à equipe assistencial da prefeitura.
- Estoque por lote, cadastro de medicamentos e identificação de lotes anteriores, entradas e saídas, alertas de vencimento e bloqueios de saldo insuficiente, incompatibilidade de apresentação e excesso prescrito.
- Receitas com vários medicamentos, pedidos de exames e encaminhamentos vinculados à consulta: rascunho, revisão, emissão de demonstração, impressão e cancelamento preservado.
- Acompanhamento por exame, agendamento e reagendamento justificado, filtro de datas ultrapassadas, realização, resultado transcrito e revisão médica.
- Encaminhamento do consultório para a regulação, agendamento, reagendamento justificado com valores anteriores e autoria, cancelamento sincronizado e contrarreferência manual. Histórico de documentos e retornos compartilhado na mesma prefeitura.
- Resumo da rede, exportação agregada, diretório de unidades e histórico local de operações.
- Vacinação com caderneta, aplicação e baixa de dose, transcrição, anulação, aprazamentos e histórico. Retornos filtrados por hoje/atraso, com registro manual de tentativas de contato e autoria, sem mensagens automáticas.
- Lotes de imunobiológicos, recebimentos, perdas, quarentena e liberação justificada.
- Produção vacinal agregada por unidade e acompanhamento de retornos para a gestão.
- Mapa de módulos e integrações ainda necessários para a primeira versão pública.
- Emissão de senhas, chamada e rechamada por sala, com TV dedicada, histórico e áudio opcional.
- Totem com identificação por CPF ou nome completo e nascimento, atendimento comum/preferencial, motivos opcionais de preferência e serviços por tipo de unidade. Quem não tem cadastro conclui a identificação na recepção. Emissão e impressão da senha sem dados pessoais.
- Chamada da TV pelo consultório, períodos de consulta por profissional e métricas de recepção, escuta, espera e permanência.
- Pré-natal, encontros, campanhas, lembretes, pendências, revisão operacional e comunicados com cadastro e histórico local.
- Famílias, microáreas, visitas, ausências e produção do agente de saúde.
- Carteira comercial, contratos, recebimentos anotados, implantação, suporte e equipe da Cuidelo, separados dos dados assistenciais.
- Correspondência navegável para as 46 telas do Pulso, mantendo as lacunas de cada percurso explícitas.

## Demonstração na Vercel

Publicação de teste em 30/10/2026: [Cuidelo](https://cuidelo.vercel.app/acesso), [totem da UBS Centro](https://cuidelo.vercel.app/totem?rede=aurora&unidade=aurora-centro) e [painel da TV da UBS Centro](https://cuidelo.vercel.app/painel?rede=aurora&unidade=aurora-centro).

O endereço hospeda a mesma demonstração com dados fictícios. As alterações continuam salvas somente no navegador de cada visitante; abrir o endereço em outro computador não compartilha filas, estoque ou prontuários. O pareamento opcional publica o painel de senhas pela internet. A ocupação e o atendimento dos diferentes perfis continuam na mesma estação. Os dados dos arquivos HTML locais não são transferidos automaticamente para o endereço online.

`vercel.json` configura a compilação Vite, a pasta `dist`, a abertura direta das rotas e o cabeçalho `noindex, nofollow`. Esse cabeçalho orienta buscadores; não é controle de acesso. `.vercelignore` exclui arquivos locais, credenciais e entregas da publicação pela CLI. Os avisos de demonstração permanecem visíveis. A publicação não habilita atendimento real, autenticação ou persistência protegida.

A primeira publicação foi enviada pela Vercel CLI para o projeto `cuidelo`, na equipe `mateus-maraschin-forests-projects`. A tentativa de conexão automática com o repositório privado foi recusada pelo provedor; novos pushes no GitHub ainda não publicam automaticamente. Depois de `pnpm test` e `pnpm build`, uma conta autorizada pode atualizar o projeto com `vercel deploy --prod --scope mateus-maraschin-forests-projects`.

## Abrir como um único HTML

```sh
pnpm build:html
```

Abra `dist-standalone/Cuidelo.html` com dois cliques. A cópia publicada para download fica em https://cuidelo.vercel.app/downloads/Cuidelo.html. O arquivo funciona sem servidor e contém código, estilos, marca e fontes. `Cuidelo-TV.html` abre diretamente a prévia da TV. `Cuidelo-Totem.html` abre a retirada de senha da UBS Centro de demonstração. Para testar chamada entre janelas, use os botões **Abrir totem conectado** e **Abrir TV conectada** na Recepção (ou **Abrir TV desta unidade** no painel de senhas) dentro de um mesmo arquivo, no mesmo navegador. Para a TV em outro aparelho, gere o código em Fila e salas e abra https://cuidelo.vercel.app/tv no navegador da TV. O HTML da estação e a TV precisam de internet para esse modo.

O painel de comparação registra **4 telas demonstráveis, 41 parciais e 1 adaptada**, considerando o catálogo de 46 telas do Pulso. As 30 telas antes sem base agora possuem correspondência local, mas os percursos continuam parciais. Essa contagem não mede conclusão do sistema nem homologação.

As alterações ficam no navegador atual. O histórico é editável por ferramentas do navegador e não constitui auditoria de produção. Supabase, autenticação, autorização no servidor, assinatura digital e integrações SUS ainda não estão conectados. Não houve teste de capacidade para 100 unidades.

## Iniciar no computador

Requer Node.js 22.12 ou superior e pnpm 11.25.0. A versão usada nesta entrega foi Node.js 24.19.0.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Abra **http://127.0.0.1:4173/**. No Windows, `Iniciar-Cuidelo.cmd` também abre a demonstração, utilizando as ferramentas instaladas no computador. Na primeira execução, o download das dependências exige internet. Depois, fontes e dados da demonstração são locais.

Para explorar, escolha um perfil na entrada, confira prefeitura e unidade e clique em **Entrar na demonstração**. Para a equipe médica, selecione também o profissional fictício. Use **Trocar sessão de demonstração** para testar outro vínculo. Essa preferência de navegação não bloqueia rotas diretas e não substitui autenticação. A recepção e a equipe operam na unidade vinculada. A prefeitura acompanha a sua rede. A operação da Cuidelo tem área comercial própria. Em **Plano de entrega**, somente a gestão da prefeitura pode redefinir o cenário da própria rede; as demais redes são preservadas.

## Verificação

```sh
pnpm test
pnpm build
pnpm build:html
pnpm exec playwright install chromium
pnpm test:e2e
```

No Windows os testes de navegador usam Microsoft Edge instalado. Nos demais sistemas usam Chromium. A integração contínua instala o navegador e executa regras de domínio, compilação e percursos completos.

## Organização

| Caminho        | Responsabilidade                                                    |
| -------------- | ------------------------------------------------------------------- |
| `src/domain`   | Regras, permissões demonstrativas, tipos e testes de invariantes    |
| `src/data`     | Contrato de persistência, cenário fictício e adaptador do navegador |
| `src/app`      | Contexto da rede, navegação e proteção de rascunhos                 |
| `src/pages`    | Fluxos de trabalho por módulo                                       |
| `src/styles`   | Cores, tipografia e componentes visuais                             |
| `public/brand` | Marca vetorial, paleta e manual visual                              |
| `tests`        | Percursos completos no navegador                                    |
| `docs`         | Escopo, arquitetura e critérios para evolução                       |

## Documentação

- [Plano completo da rede pública](docs/plano-completo.md)
- [Arquitetura e limites da base atual](docs/arquitetura.md)
- [Próximas entregas e critérios de aceite](docs/desenvolvimento.md)
- [Identidade e aplicação da marca](docs/identidade.md)
- [Comparação das 46 telas do Pulso](docs/comparacao-pulso.md)
- [HTML independente e painel da TV](docs/html-e-painel-tv.md)
- [Vacinação, exames e regulação: roteiro da versão 0.12](docs/vacinacao-exames-regulacao.md)
- [Agenda, cadastro e triagem: roteiro da versão 0.11](docs/agenda-cadastro-triagem.md)
- [Escuta, aferições e complementos](docs/escuta-e-registros.md)
- [Farmácia: entregas por receita, estoque e roteiro de teste](docs/farmacia-dispensacao.md)
- [Consultório: receitas, exames, encaminhamentos e roteiro de teste](docs/consultorio-documentos.md)
- [Vacinação: percursos e pendências](docs/vacinacao.md)
- [Perfis, totem, tempos e novos acompanhamentos](docs/perfis-totem-tempos.md)
- [Manual visual](public/brand/guia.html) - abra pelo link na aplicação ou em um navegador.
- [Licenças e créditos de fontes](public/licenses/LEIA-ME.txt)

O próximo marco é conectar identidade de acesso e persistência protegida, com testes de isolamento entre organizações. As etapas internas de construção não reduzem o compromisso de cobertura da primeira implantação pública.
