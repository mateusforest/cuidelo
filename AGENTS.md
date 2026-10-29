# Cuidelo

Produto para a rede pública completa. A primeira implantação operacional depende do aceite de todos os módulos previstos; os incrementos internos não reduzem esse escopo. Expansão privada posterior.

- Manter a marca Cuidelo, a paleta aprovada e os textos em português brasileiro.
- Esta versão é de desenvolvimento, exclusivamente com dados fictícios. Manter a identificação de demonstração visível. Não apresentar seletores de perfil como autenticação.
- Regras de domínio ficam em src/domain. Persistência fica atrás do contrato em src/data. Componentes de interface não alteram diretamente a base.
- Toda leitura e comando recebe o contexto de organização, unidade e função. Testar isolamento, permissões e invariantes ao alterar essas regras. Proteções no navegador não substituem autorização no servidor.
- Nunca adicionar segredos, dados reais de pacientes ou chaves de serviço ao repositório.
- Não simular integração concluída, assinatura digital ou homologação clínica. Exibir dependências indisponíveis com clareza.
- Preservar registros finalizados; futuras correções devem gerar adendos rastreáveis.
- Executar pnpm test e pnpm build antes de publicar alterações. Validar no navegador os fluxos alterados.
- Não publicar a aplicação como serviço clínico sem autenticação, autorização no servidor, persistência protegida e validações descritas nos documentos do projeto.
