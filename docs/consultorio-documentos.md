# Consultório — receitas, exames e encaminhamentos

Cuidelo 0.8.0 · 29/10/2026 · exclusivamente para testes com dados fictícios.

## O que testar no HTML

1. Abra **Cuidelo.html**, escolha **Equipe médica**, prefeitura **Aurora**, unidade **UBS Centro**.
2. Em **Meu consultório**, abra uma pessoa da fila. Registre **Pessoa entrou · iniciar** ou assuma um atendimento anterior disponível.
3. No bloco **Receitas, exames e encaminhamentos**, escolha **Nova receita**, **Pedir exames** ou **Encaminhar**.
4. Preencha dados fictícios e salve o documento em rascunho. Revise os itens e marque a confirmação para emitir a demonstração. Campos incompletos impedem a emissão, mas permitem guardar o rascunho.
5. Abra **Abrir impressão**. O navegador oferece impressão ou **Salvar como PDF**. O documento mostra a identificação congelada na emissão e o aviso de demonstração sem assinatura.
6. Preencha avaliação e plano no SOAP e conclua a consulta. Antes de concluir, emita ou descarte com justificativa todos os documentos em rascunho.

## Receitas

- De 1 a 20 medicamentos, com nome, concentração, apresentação, dose, via, frequência, duração, quantidade, unidade e orientação individual. Orientações gerais são opcionais.
- Não há dose sugerida, cálculo terapêutico, catálogo validado ou avaliação automática de alergias e interações. A revisão exibe as informações de alergias do cadastro, sem interpretar ausência de registro como ausência de alergia.
- É possível editar rascunhos, copiar um documento para um novo rascunho e cancelar com justificativa. Emissão preserva conteúdo, identificação, número e autoria; cancelamento não apaga o original.
- A receita emitida aparece na farmácia da mesma unidade para entrega total ou parcial por lote. Entregas e comprovantes entram no histórico da pessoa; cancelar a receita bloqueia novas entregas e preserva as anteriores. Receituários especiais e assinatura profissional continuam pendentes.

## Exames e resultados

- Um pedido pode conter até 20 exames, com indicação, material ou região, observações e prioridade informada pelo médico. Prioridade urgente exige justificativa; o sistema não atribui prioridade clínica automaticamente.
- Em **Exames e resultados**, cada item tem acompanhamento independente: solicitado, agendado, realizado, resultado registrado e revisado pelo médico.
- Médico e enfermagem podem registrar agendamento, realização e resultado transcrito. A revisão nesta versão é exclusiva do perfil médico e exige resultado anterior. Complementos antes da revisão preservam as entradas anteriores.
- Resultados podem ser acompanhados depois de encerrada a consulta. Não é permitido cancelar um pedido que já tenha realização ou resultado registrado.
- Agendamento é local e não reserva vaga. Não há integração com laboratório, imagem, anexos de laudos, resultado automático ou assinatura de laudo.

## Encaminhamentos e retorno

- A emissão no consultório cria uma solicitação na regulação da unidade, com especialidade, destino, justificativa e prioridade. O rascunho ainda não entra na fila da regulação.
- Registre o agendamento na regulação. Depois do atendimento, médico ou regulação pode registrar a contrarreferência recebida manualmente, com data e resumo. Para testar no mesmo dia, agende para hoje.
- Cancelar o documento cancela a solicitação; cancelar na regulação também marca o documento como cancelado. Solicitações concluídas com contrarreferência permanecem preservadas.
- Vagas, autorizações, devoluções e comunicação com serviços externos ainda não estão conectadas.

## Perfis, histórico e preservação

- O médico responsável pelo atendimento cria e emite; só o autor cancela o documento. Um médico que assuma o atendimento pode descartar um rascunho anterior com justificativa, preservando seu conteúdo.
- A equipe assistencial lê documentos emitidos, resultados e retornos de todas as unidades da mesma prefeitura em **Pessoas e prontuários**. Operações continuam restritas à unidade de origem; outras prefeituras não recebem esses dados nas telas.
- Administração local recebe situação operacional e agenda dos encaminhamentos originados no consultório, sem justificativas clínicas ou contrarreferências. Recepção e prefeitura não recebem documentos clínicos.
- Os documentos usam números sequenciais de demonstração por prefeitura e tipo. Rascunhos não têm numeração de emissão nem impressão.
- Edições concorrentes são recusadas para revisão. Atualizar um documento não apaga o texto SOAP ainda não salvo. O armazenamento anterior é migrado para o formato 9, preservando os registros existentes.

## Limites desta entrega

Os arquivos funcionam localmente no navegador, sem autenticação real ou banco protegido. Use somente dados fictícios. A preservação é uma regra da demonstração, não proteção contra alteração pelas ferramentas do navegador. Emissão não equivale a assinatura ou autorização clínica.

Substitua os três HTMLs pela mesma versão e feche abas antigas antes de testar. O estado fica no navegador e no caminho do arquivo; copiar o HTML para outro computador não leva os registros. Para compartilhar a demonstração, envie **Cuidelo_HTMLs.zip** e extraia os arquivos no notebook.

O mapa do Pulso continua com 44 percursos parciais. Esta entrega avança consultório, exames, regulação e histórico; não conclui os demais módulos nem reduz o escopo público e hospitalar previsto para a primeira operação.
