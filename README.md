# BeautyFlow OS

Gestão de salões com agenda, clientes, serviços, equipe, faturas, recebimentos, estoque e relatórios CSV. React/TypeScript com banco persistente no Convex e frontend estático no Cloudflare Pages.

## Versão única

Trabalho diretamente na `main`. Projeto Convex existente: `beautyflow-os`, deployment `tame-salmon-877`. Repositório: https://github.com/davidwilliamvibecode/beautyflow-os. Não criar um segundo projeto ou deployment para publicar esta aplicação.

O link final do Pages só deve ser divulgado depois de publicar e validar o acesso. Enquanto o deploy e a autenticação não forem conferidos no serviço real, o produto não está liberado para o primeiro cliente.

## Acesso

E-mail e senha, sem convite e sem serviço de e-mail. Senha de 8 a 128 caracteres, protegida pelo Convex Auth. O cadastro não afirma que o e-mail foi verificado. O MVP não oferece recuperação de senha por e-mail; oriente a pessoa a guardar sua senha em um gerenciador.

Para liberar uma funcionária: ela cria sua conta, abre o menu do perfil e informa seu **código da conta** à proprietária. Em Configurações → Usuários, a proprietária adiciona o código e escolhe o papel. Esse identificador não é uma senha. Saber o identificador não permite entrar na conta. E-mails sem verificação não são usados para conceder acesso a salões.

## Executar e verificar

```sh
npm ci
cp .env.example .env.local
npm run dev
npm run lint
npm test
npm run build
npm audit
```

Os tipos Convex gerados estão versionados: o build do frontend não exige credenciais de deploy. `npm test` usa banco em memória, dados fictícios e identidades isoladas; não modifica dados de clientes.

## Publicar sem domínio próprio

1. Autenticar no Convex e usar o deployment existente. Executar `npx convex dev --once` para publicar o backend. Configurar `JWT_PRIVATE_KEY`, `JWKS` e `SITE_URL` no Convex; chaves nunca são commitadas.
2. No Cloudflare Pages, conectar este repositório, branch `main`, build `npm run build`, saída `dist`, Node.js 24 e `VITE_CONVEX_URL=https://tame-salmon-877.convex.cloud`.
3. O Pages fornece um endereço HTTPS gratuito. Usar a URL realmente atribuída no `SITE_URL` do Convex. Nenhuma compra de domínio é necessária.
4. Testar cadastro, login/logout, criação do salão, cliente, profissional, serviço, agendamento, conclusão, fatura, pagamento e CSV no link publicado. Conferir persistência após atualizar a página e isolamento com duas contas.

O workflow `Verificação e publicação` executa lint, testes, auditoria e build em cada push. Ele só publica automaticamente quando `DEPLOY_ENABLED=true`, `CLOUDFLARE_ACCOUNT_ID` e os secrets `CLOUDFLARE_API_TOKEN` e `CONVEX_DEPLOY_KEY` estiverem configurados. A chave Convex deve pertencer **ao deployment existente**. Se usar a integração Git nativa do Pages, mantenha `DEPLOY_ENABLED` desligado para evitar dois caminhos de deploy do frontend.

## Primeiro cliente e suporte

Siga [o roteiro de operação](docs/OPERACAO.md). O pagamento registrado no aplicativo é controle interno; ele não movimenta dinheiro e não é emissão de nota fiscal. A assinatura do próprio BeautyFlow pode ser combinada e cobrada manualmente, sem gateway.

Os dados ficam no Convex. Limpar o cache do navegador não apaga cadastros; apenas a sessão e a seleção local do salão podem ser perdidas. Galerias exigem autorização no backend. Links de arquivos retornados pelo armazenamento são links de acesso: não divulgue sem consentimento.

Os planos e valores presentes no catálogo interno são referências comerciais, sem cobrança automática e sem bloqueio por quantidade. Não prometa limites ou recursos não configurados. Negocie apenas o escopo já validado do piloto.
