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

## Roteiro para testar devolução e estorno

Use a mesma UBS e o mesmo navegador para as sessões de demonstração do consultório e da farmácia. No consultório, emita uma receita de 6 unidades de um medicamento fictício. Na farmácia, cadastre dois lotes válidos com a mesma apresentação da receita e 5 unidades cada. Se já tiver uma entrega de teste, comece pela busca de entregas.

1. Entregue 4 unidades do lote A e 2 do lote B. Anote o número do comprovante.
2. Em **Localizar entrega**, procure pelo lote ou comprovante e abra o histórico da receita. Na entrega original, use **Registrar devolução**. Escolha a saída do lote A, informe 2 unidades, registre o motivo e confirme que recebeu o material.
3. Confira a separação física. O lote A continua com 1 unidade disponível e passa a ter 2 segregadas. A receita continua integralmente atendida.
4. Na mesma entrega, use **Registrar estorno** para corrigir o lançamento de 1 unidade do lote B que permaneceu na farmácia. Confira o lote, a quantidade e o motivo. O disponível do lote B passa de 3 para 4, e a receita volta a ter 1 unidade pendente.
5. Reabra o comprovante original. Confira a quantidade registrada no momento da entrega e os ajustes posteriores com os dois lotes, motivos e responsáveis. A equipe assistencial pode ler o histórico nos perfis autorizados.

| Movimento | Disponível A | Segregado A | Disponível B | Saldo da receita |
|---|---:|---:|---:|---:|
| Antes da entrega | 5 | 0 | 5 | 6 |
| Entrega de 4 A e 2 B | 1 | 0 | 3 | 0 |
| Devolução física de 2 A | 1 | 2 | 3 | 0 |
| Estorno de lançamento de 1 B | 1 | 2 | 4 | 1 |

## Regras da demonstração

- O perfil Farmácia registra o ajuste na sua própria unidade e prefeitura. Médico e enfermagem consultam os registros autorizados. A administração da unidade acompanha estoque e movimentos administrativos.
- Cada ajuste referencia o item, o lote e a saída da entrega original. Quantidades precisam ser inteiras e positivas. Devoluções e estornos disputam o mesmo saldo ajustável daquela saída.
- A devolução física registra a entrada em segregação. A equipe responsável pela assistência farmacêutica ainda precisa validar o procedimento de destinação da rede. O registro local de devolução não autoriza nova dispensação.
- O estorno corrige quantidade lançada como entregue que permaneceu na unidade. A quantidade corrigida volta ao disponível do lote se ele estiver válido. Se estiver vencido, entra em segregação. Receita cancelada continua bloqueada para novas entregas.
- O ajuste é um novo registro com autoria de demonstração, data e motivo. A repetição do mesmo comando e a revisão concorrente do saldo são verificadas. Feche uma conferência desatualizada e revise o histórico antes de tentar outra quantidade.
- Os dados da farmácia ficam no navegador atual. O arquivo HTML é portátil. Levar o arquivo para outro computador leva o programa, e os dados da estação ficam na origem.

## Pendências

A farmácia permanece parcial no mapa de 41 percursos parciais. Para operação municipal, faltam destinação dos segregados, perdas e recolhimento, inventário físico, distribuição entre central e unidades, validação farmacêutica, controlados, catálogo e integrações nacionais. A farmácia hospitalar também precisa de fracionamento e rastreio até a administração no leito. Identidade autenticada e persistência protegida continuam pendentes.
