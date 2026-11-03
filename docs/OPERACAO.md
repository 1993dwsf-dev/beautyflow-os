# Operação do primeiro cliente

## Implantação acompanhada

- Criar a conta da proprietária e cadastrar o salão com dados reais. Usar o espaço de demonstração apenas para apresentação; ele é separado dos dados reais.
- Cadastrar profissionais e horários, serviços e preços, clientes e meios de pagamento. Confirmar as pessoas que terão acesso antes de adicioná-las.
- Fazer um atendimento de teste combinado com a proprietária. Concluir o atendimento, gerar a fatura e registrar o recebimento uma vez. Conclusão registra execução/comissão; somente o pagamento registra entrada de dinheiro.
- Exportar um CSV e conferir no Excel. Revisar o saldo da fatura após recebimento e estorno.
- Validar no celular e após recarregar a página. Encerrar a sessão e entrar novamente para conferir os dados.

## Oferta inicial

Oferecer um piloto acompanhado com agenda, cadastro de clientes, serviços, equipe e controle de recebimentos. O catálogo contém referências de planos, mas o pagamento da assinatura é combinado fora do sistema. Não ativar gateway, WhatsApp automático ou envio de e-mail: nenhum deles é necessário para esse fluxo.

## Suporte

Registrar descrição do problema, horário aproximado e tela envolvida. Nunca solicitar a senha da cliente. Informações sensíveis devem ser omitidas de capturas e de issues públicas. Se alguém esquecer a senha, não use somente o e-mail informado para liberar a conta: o MVP não tem recuperação automática, e a identidade precisa ser confirmada antes de qualquer manutenção por uma pessoa administradora do serviço.

## Dados e backup

A proprietária pode exportar os relatórios CSV disponíveis. CSV é uma cópia legível dos relatórios e não substitui um backup completo. Para contingência, a pessoa que administra a implantação deve exportar o deployment pelo painel Convex ou `npx convex export --path backup.zip`, armazenando-o em local privado. O ZIP contém as tabelas em JSONL. A restauração usa o import do Convex no mesmo deployment depois de validar o arquivo e fazer uma cópia do estado atual. Não execute import destrutivo como rotina de suporte.

## Escopo de segurança verificado

A suíte automatizada cobre autenticação obrigatória, acesso cruzado entre salões, proteção de fichas sensíveis, papéis, gestão de proprietários, pagamentos, estornos repetidos, referências estrangeiras, fotos e neutralização de fórmulas no CSV. Ela usa Convex Test; não substitui validar login e navegação no deployment publicado.

A formalização de termos, privacidade e contato de suporte precisa usar os dados verdadeiros de quem oferece o serviço e os procedimentos do salão. Esses dados não foram inventados nem marcados como concluídos neste repositório.
