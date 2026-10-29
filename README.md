# Cuidelo

**Toda a rede. Mais perto das pessoas.**

Plataforma em desenvolvimento para prefeituras, UBS, postos, UPA, pronto atendimento e hospitais públicos. A expansão para redes privadas é posterior. Esta base organiza o desenvolvimento do escopo público completo; a primeira implantação operacional continua condicionada à entrega e validação desse escopo.

## Estado desta entrega

Versão **0.1.0**, de 29/10/2026. Aplicação local com dados fictícios, identidade aprovada e fluxos navegáveis. **Não é um sistema clínico pronto para atendimento.** Não insira dados reais. O seletor de perfil serve para demonstrar a interface e não autentica ninguém.

Já é possível testar:

- Alternância entre três redes fictícias, sete unidades e sete perfis.
- Cadastro de pessoas, busca, nome social e consulta do histórico demonstrativo.
- Agenda com bloqueio de sobreposição, cancelamento justificado e confirmação de chegada.
- Recepção, início do atendimento, registro SOAP, rascunho e conclusão imutável na lógica da demonstração.
- Observação na urgência, admissão em leito, bloqueio de ocupação duplicada, saída e higienização.
- Estoque por lote, entradas e saídas, alertas de vencimento e bloqueio de saldo negativo.
- Encaminhamento, registro local de agendamento e cancelamento.
- Resumo da rede, exportação agregada, diretório de unidades e histórico local de operações.
- Mapa de módulos e integrações ainda necessários para a primeira versão pública.

As alterações ficam no navegador atual. O histórico é editável por ferramentas do navegador e não constitui auditoria de produção. Supabase, autenticação, autorização no servidor, assinatura digital e integrações SUS ainda não estão conectados. Não houve teste de capacidade para 100 unidades.

## Iniciar no computador

Requer Node.js 22.12 ou superior e pnpm 11.25.0. A versão usada nesta entrega foi Node.js 24.19.0.

```sh
pnpm install --frozen-lockfile
pnpm dev
```

Abra **http://127.0.0.1:4173/**. No Windows, `Iniciar-Cuidelo.cmd` também abre a demonstração, utilizando as ferramentas instaladas no computador. Na primeira execução, o download das dependências exige internet. Depois, fontes e dados da demonstração são locais.

Para explorar: escolha uma rede, selecione uma unidade e use o perfil **Administração**. Em **Plano de entrega**, esse perfil pode redefinir o cenário fictício. Isso apaga todas as alterações da demonstração naquele navegador.

## Verificação

```sh
pnpm test
pnpm build
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
- [Manual visual](public/brand/guia.html) - abra pelo link na aplicação ou em um navegador.
- [Licenças e créditos de fontes](public/licenses/LEIA-ME.txt)

O próximo marco é conectar identidade de acesso e persistência protegida, com testes de isolamento entre organizações. As etapas internas de construção não reduzem o compromisso de cobertura da primeira implantação pública.
