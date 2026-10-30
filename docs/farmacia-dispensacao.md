# Farmácia — entregas por receita e lote

Cuidelo 0.8.0 · 29/10/2026 · teste local com dados fictícios.

## Roteiro no HTML

1. Entre como **Equipe médica**, na **UBS Centro / Aurora**, inicie um atendimento e emita uma receita de demonstração. O rascunho ainda não entra na farmácia. A quantidade prescrita deve ser inteira, com a unidade de entrega preenchida.
2. Troque para o perfil **Farmácia** da mesma unidade e abra **Farmácia e estoque**. A receita aparece em **Receitas recebidas do consultório**. Busque por pessoa, CPF ou número e filtre aguardando, parcial, concluída ou cancelada.
3. Confira medicamento, concentração, apresentação e unidade. Se não houver lote disponível, use **Cadastrar lote para item 1** na receita ou **Novo lote de medicamento**. O cadastro a partir do item preenche a identificação; registre lote, validade, quantidade inicial e origem do recebimento.
4. Lotes anteriores sem identificação estruturada exibem **Identificar lote** na tabela de estoque. Informe concentração, apresentação e unidade real da contagem e confirme. O saldo existente não é convertido nem modificado. Não há equivalência automática entre caixa, frasco, comprimido ou outras unidades.
5. Clique em **Conferir e entregar**. Consulte as orientações da receita, escolha o lote e digite somente a quantidade efetivamente entregue. É possível dividir um item entre vários lotes. Linhas totalmente vazias não movimentam o estoque.
6. Para entrega parcial, informe o motivo do saldo pendente. Identifique se quem recebe é a pessoa ou um representante e marque as duas conferências. Confirme a entrega.
7. Abra o comprovante para imprimir ou salvar como PDF. Volte à receita para completar o saldo em outra entrega. Depois da conclusão, encontre-a no filtro **Entregue por completo** ou **Todas**.
8. Consulte **Ver receita e entregas**. No perfil médico ou enfermagem, abra o histórico da pessoa e **Entregas da farmácia**; os registros são compartilhados apenas dentro da mesma prefeitura.

## Exemplo fictício de teste

Crie um medicamento chamado “Medicamento fictício Alfa”, com concentração, apresentação, dose, via, frequência e duração explicitamente fictícias. Prescreva 6 “unidades de teste”. Na farmácia, cadastre dois lotes com a mesma identificação: ALFA-01 com 3 unidades e ALFA-02 com 7, ambos com validade futura. Entregue primeiro 2 unidades do ALFA-01. Depois complete usando 1 do ALFA-01 e 3 do ALFA-02. O saldo da receita será zero; o estoque ficará em 0 e 4, respectivamente. O primeiro comprovante continuará mostrando que havia 4 unidades pendentes naquele momento.

## Regras implementadas

- Somente Farmácia registra entregas vinculadas. Médico e enfermagem consultam o histórico; administração local acompanha estoque sem receber documentos clínicos ou identidade de quem recebeu a entrega.
- Receita e lotes precisam pertencer à mesma unidade e prefeitura. Não há dispensação entre unidades nesta versão.
- Cadastro de medicamento, concentração, apresentação e unidade precisam corresponder. Diferenças simples de maiúsculas, acentos e espaços são normalizadas; não há substituição terapêutica ou conversão de quantidade.
- Lote vencido, quantidade acima do estoque ou acima do saldo prescrito, frações, quantidades zero/negativas, linhas duplicadas e itens alheios à receita são recusados.
- Todas as baixas de uma entrega são gravadas juntas, vinculadas à receita, ao item, ao lote e ao comprovante. Falha de gravação não confirma a entrega nem altera o saldo em memória.
- Duas conferências concorrentes não podem duplicar a baixa. Se os dados mudarem, feche e reabra a conferência para revisar os saldos. Uma repetição da mesma solicitação não gera outra entrega.
- Entregas confirmadas são preservadas. Cancelar a receita impede novas entregas, conserva o que já foi entregue e não repõe estoque automaticamente. Saída avulsa de estoque não quita receita.
- A migração para o formato 9 preserva receitas e registros anteriores. Lotes antigos não recebem unidades de contagem presumidas.

## Pendências do módulo

Esta é uma demonstração de percurso, sem validade para operação clínica. Faltam validação farmacêutica completa, assinatura, receituários especiais e controlados, catálogo validado, regras de cobertura, devoluções e estornos vinculados, perdas e quarentena, transferências entre unidades, fracionamento/conversão controlada, administração de medicamentos e integração e-SUS AF. Os 44 percursos do Pulso continuam classificados como parciais.

O armazenamento e a sincronização são locais ao mesmo navegador e arquivo. Não há autenticação real nem ligação entre computadores. Substitua os três HTMLs pela mesma versão e feche as abas antigas antes de testar. Copiar o HTML para outro computador não copia os registros salvos no navegador.
