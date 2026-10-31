# Consultório 0.16

## Testar o percurso

1. Abra **Meu consultório** com a sessão demonstrativa **Equipe médica**, na **UBS Centro**. Chame a senha para um consultório livre. Confirme a chamada no painel da unidade ou em uma TV pareada. Se a pessoa não entrar, use **Devolver senha à fila** e registre o motivo.
2. Quando a pessoa entrar, clique em **Pessoa entrou · iniciar** e **Continuar registro clínico**. Confira identificação, alergias, escuta e avaliação de fila. O tempo do profissional começa na entrada. A unidade de urgência ou hospital também permite observação e retomada.
3. Preencha o SOAP. Em **Problemas e condições avaliados**, busque por código ou descrição no sistema escolhido. É possível selecionar mais de um problema. Use **Informar outro código** para transcrever uma referência fora da lista local. Para encerrar sem código, registre a justificativa.
4. Teste **Salvar rascunho**, recarregue e confira texto e códigos. No consultório do médico responsável, crie uma receita, pedido de exames, encaminhamento, atestado ou declaração. Para emitir, salve o rascunho do documento, revise e confirme. Atestados registram data inicial e dias de afastamento. Declarações registram o período de comparecimento. Ambos possuem número demonstrativo, autoria, impressão e cancelamento com motivo.
5. Use **Salvar e concluir**. A equipe precisa resolver os documentos em rascunho e informar avaliação e plano. Se a conclusão falhar, a última versão salva, a sala e o cronômetro ficam preservados. Uma conclusão bem-sucedida grava SOAP e codificação, libera a sala e encerra o tempo profissional em uma única operação.
6. Selecione **Ver consulta no prontuário**. A equipe assistencial pode consultar o registro final em outra unidade da mesma prefeitura. Correções posteriores são complementos justificados com autoria e data. Também é possível reabrir a ficha pelo quadro **Minhas consultas concluídas hoje**.

Os HTMLs funcionam no notebook com dados fictícios. O prontuário compartilhado entre perfis e unidades é demonstrado no mesmo navegador. O pareamento da TV continua disponível pela internet.

## Correspondência com o Pulso

O registro manual de problemas no SOAP usa CIAP-2 e CID-10 independentes. A demonstração oferece 71 referências para busca offline e aceita outros códigos transcritos pelo profissional. O catálogo local é limitado. A conferência do formato de um código digitado não confirma a sua existência em uma tabela oficial. As fichas concluídas de versões anteriores permanecem com o conteúdo original.

A lista foi conferida nas terminologias publicadas pelo projeto REDS-GO, edição 1.0.3. Duas referências do HTML original, X37 em CIAP-2 e O09.9 em CID-10, não foram localizadas nessa edição. Elas ficaram fora da lista pesquisável. Não foi criada equivalência automática entre códigos.

Referências dos exemplos e do campo de avaliação. [CIAP-2 da Secretaria de Saúde de Goiás](https://fhir.saude.go.gov.br/r4/reds-go/CodeSystem-BRCIAP2.html), [orientações do Ministério da Saúde para o SOAP](https://sisaps.saude.gov.br/sistemas/esusaps/docs/guias-preenchimento%20Atual/equipeaps/), [CID-10 da Secretaria de Saúde de Goiás](https://fhir.saude.go.gov.br/r4/reds-go/CodeSystem-BRCID10.html).

A demonstração mantém emissão e impressão locais, com identificação visível. Assinatura digital, receituários especiais, conferência clínica automatizada, catálogo oficial integral e transmissão aos sistemas do SUS dependem de implantação e validação próprias.
