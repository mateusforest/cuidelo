# Cuidelo

**Toda a rede. Mais perto das pessoas.**

Plataforma em desenvolvimento para prefeituras, UBS, postos, UPA, pronto atendimento e hospitais públicos. A expansão para redes privadas é posterior. Esta base organiza o desenvolvimento do escopo público completo; a primeira implantação operacional continua condicionada à entrega e validação desse escopo.

## Estado desta entrega

Versão **0.10.0**, de 30/10/2026. Aplicação local com dados fictícios, identidade aprovada e fluxos navegáveis. **Não é um sistema clínico pronto para atendimento.** Não insira dados reais. A entrada por sessões serve para testar os perfis e não autentica ninguém.

Já é possível testar:

- Recepção, consultório, registro clínico e farmácia com visual unificado, filas organizadas, resumos por etapa e atalhos para receitas e estoque.
- Totem em quatro etapas: identificação → serviço → preferência → conferência. Voltar mantém as escolhas; cancelar limpa a sessão. A senha só é emitida na confirmação final.

- Nova tela de entrada em `/acesso` e `/login`, com nove perfis predefinidos, seleção de prefeitura e unidade, e dois profissionais de demonstração para a equipe médica. Não solicita senha nem simula autenticação real.
- Visual renovado com menu lateral, contexto da unidade e da sessão, painel de indicadores e adaptação para celular. Na primeira abertura do endereço principal, a entrada demonstrativa é exibida antes da visão de trabalho; depois, a escolha é lembrada no navegador.

- Entrada de demonstração com nove perfis: prefeitura, administração local, recepção, equipe médica, enfermagem, farmácia, regulação, agente de saúde e operação da Cuidelo. As sessões operacionais ficam vinculadas à unidade; somente a prefeitura filtra unidades da própria rede.
- Cadastro de pessoas, busca, nome social e consulta do histórico demonstrativo.
- Agenda com bloqueio de sobreposição, cancelamento justificado e confirmação de chegada.
- Recepção com senhas do totem, chamada antes da identificação, conferência presencial de CPF ou nome e nascimento, preferência confirmada, cadastro no balcão e encaminhamento à triagem ou serviço. Ausência e retorno preservam a senha.
- Passagem da recepção para a triagem e o consultório, com chamadas na TV e tempos medidos por etapa. Início do atendimento, registro SOAP, rascunho e conclusão imutável na lógica da demonstração.
- Escuta inicial, sinais vitais, novas aferições e correções justificadas, vinculadas ao atendimento e ao histórico.
- Complementos de notas concluídas, preservando o texto original.
- Observação na urgência, admissão em leito, bloqueio de ocupação duplicada, saída e higienização.
- Farmácia recebe receitas do consultório: entrega total ou parcial, pessoa ou representante, vários lotes por item, saldo restante, baixa vinculada e comprovante para impressão. O histórico fica disponível à equipe assistencial da prefeitura.
- Estoque por lote, cadastro de medicamentos e identificação de lotes anteriores, entradas e saídas, alertas de vencimento e bloqueios de saldo insuficiente, incompatibilidade de apresentação e excesso prescrito.
- Receitas com vários medicamentos, pedidos de exames e encaminhamentos vinculados à consulta: rascunho, revisão, emissão de demonstração, impressão e cancelamento preservado.
- Acompanhamento por exame, agendamento local, realização, resultado transcrito e revisão médica.
- Encaminhamento do consultório para a regulação, agendamento, cancelamento sincronizado e contrarreferência manual. Histórico de documentos e retornos compartilhado na mesma prefeitura.
- Resumo da rede, exportação agregada, diretório de unidades e histórico local de operações.
- Vacinação com caderneta, aplicação e baixa de dose, transcrição, anulação, aprazamentos e histórico.
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

O endereço hospeda a mesma demonstração com dados fictícios. As alterações continuam salvas somente no navegador de cada visitante; abrir o endereço em outro computador não compartilha filas, estoque ou prontuários. Use abas do mesmo navegador para testar a comunicação entre recepção, consultório, totem e TV. Os dados dos arquivos HTML locais não são transferidos automaticamente para o endereço online.

`vercel.json` configura a compilação Vite, a pasta `dist`, a abertura direta das rotas e o cabeçalho `noindex, nofollow`. Esse cabeçalho orienta buscadores; não é controle de acesso. `.vercelignore` exclui arquivos locais, credenciais e entregas da publicação pela CLI. Os avisos de demonstração permanecem visíveis. A publicação não habilita atendimento real, autenticação ou persistência protegida.

A primeira publicação foi enviada pela Vercel CLI para o projeto `cuidelo`, na equipe `mateus-maraschin-forests-projects`. A tentativa de conexão automática com o repositório privado foi recusada pelo provedor; novos pushes no GitHub ainda não publicam automaticamente. Depois de `pnpm test` e `pnpm build`, uma conta autorizada pode atualizar o projeto com `vercel deploy --prod --scope mateus-maraschin-forests-projects`.

## Abrir como um único HTML

```sh
pnpm build:html
```

Abra `dist-standalone/Cuidelo.html` com dois cliques. O arquivo funciona sem servidor e contém código, estilos, marca e fontes. `Cuidelo-TV.html` abre diretamente a prévia da TV. `Cuidelo-Totem.html` abre a retirada de senha da UBS Centro de demonstração. Para testar chamada entre janelas, use os botões **Abrir totem conectado** e **Abrir TV conectada** na Recepção (ou **Abrir TV desta unidade** no painel de senhas) dentro de um mesmo arquivo, no mesmo navegador. A demonstração não conecta TVs de outros dispositivos.

O painel de comparação registra **1 tela demonstrável, 44 parciais e 1 adaptada**, considerando o catálogo de 46 telas do Pulso. As 30 telas antes sem base agora possuem correspondência local, mas os percursos continuam parciais. Essa contagem não mede conclusão do sistema nem homologação.

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
- [Escuta, aferições e complementos](docs/escuta-e-registros.md)
- [Farmácia: entregas por receita, estoque e roteiro de teste](docs/farmacia-dispensacao.md)
- [Consultório: receitas, exames, encaminhamentos e roteiro de teste](docs/consultorio-documentos.md)
- [Vacinação: percursos e pendências](docs/vacinacao.md)
- [Perfis, totem, tempos e novos acompanhamentos](docs/perfis-totem-tempos.md)
- [Manual visual](public/brand/guia.html) - abra pelo link na aplicação ou em um navegador.
- [Licenças e créditos de fontes](public/licenses/LEIA-ME.txt)

O próximo marco é conectar identidade de acesso e persistência protegida, com testes de isolamento entre organizações. As etapas internas de construção não reduzem o compromisso de cobertura da primeira implantação pública.
