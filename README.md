# Vetorcore · Vetor Hub

PWA de gestão comercial e estoque para a Vetor Embalagens. Código em React + TypeScript + Vite, hospedado na Vercel, com Supabase Auth e PostgreSQL.

**Aplicação:** https://vetorcore.vercel.app

## Recursos implementados

- Login por e-mail/senha e recuperação de acesso (Supabase Auth).
- Acesso restrito aos usuários explicitamente cadastrados em `public.app_members` (RLS).
- Dashboard com quantidade de produtos ativos, estoque baixo e custo estimado do estoque.
- Produtos: cadastro, edição, fornecedor associado, preços e estoque mínimo.
- Clientes e fornecedores: cadastro, edição, contato e documento.
- Arquivamento/restauração de produtos, clientes e fornecedores sem apagar históricos.
- Estoque: entrada e saída transacionais via RPC, recusa de saldo negativo e histórico.
- Orçamentos: seleção de cliente, itens, quantidades, desconto, observações, histórico, status e exportação em PDF com jsPDF.
- Pedidos: converter orçamento aprovado em pedido uma única vez; acompanhar e concluir.
- Experiência responsiva: drawers desktop e telas de cadastro em tela cheia no mobile.
- PWA instalável, com aviso para atualização de nova versão, e deploy automático na Vercel após push na `main`.

**Regra atual:** criar ou concluir um pedido **não debita o estoque automaticamente**. Registre a saída na área Estoque no momento da expedição. Não há pagamento, faturamento fiscal ou emissão de nota fiscal.

## Rodar no computador

Requer Node.js 22+.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Configure em `.env.local` a URL do projeto Supabase e sua chave **publishable** (`VITE_SUPABASE_URL`, `VITE_SUPABASE_PUBLISHABLE_KEY`). Nunca coloque uma `service_role` ou chave secreta no navegador.

## Testes

```bash
npm run test
npm run build
npx playwright install chromium
npm run test:e2e
```

O GitHub Actions executa testes de cálculo, compilação TypeScript/Vite e testes de navegador com Playwright em tamanhos mobile/desktop. Os testes de navegador simulam Auth e a API, sem acessar os dados reais.

As funções de estoque, orçamento, pedidos, autorizações e arquivamento também foram testadas contra o projeto Supabase com transações descartadas por `ROLLBACK`. Essas verificações **não substituem** um teste manual completo com a sessão real do usuário em produção.

## Estrutura do banco

- `supabase/migrations/0001_schema.sql` — esquema inicial.
- `supabase/schema_snapshot.sql` — reconciliação dos privilégios, policies RLS, RPCs e arquivamento, extraída do estado do projeto remoto.

O projeto remoto já possui as alterações; o snapshot é uma referência de reprodução, não deve ser executado novamente sem revisão. Não copie usuários ou credenciais de produção para ambientes de teste.

## Implantação

O projeto da Vercel é `vetorcore`, com framework Vite, build `npm run build`, saída `dist`, ligado à branch `main`. A chave publishable do Supabase é destinada ao frontend; segurança de dados depende de autenticação e políticas RLS no servidor.

**Atenção às condições de serviço:** o plano Vercel Hobby é destinado a uso pessoal/não comercial. Antes de operar a empresa nesse ambiente, verifique o enquadramento do projeto e migre para um plano autorizado ou outra hospedagem adequada.

## Limitações e cuidados

- Sem processamento de pagamentos, NF-e, integração com transportadoras ou contabilização automática de expedição.
- Controle de estoque e pedidos usam fluxos distintos, por decisão atual do produto.
- Não há modo offline com sincronização de edição (a PWA pode fazer cache da interface).
- Rotina de backup/restauração e testes de recuperação de desastre ainda precisam ser verificados para dados empresariais.
- Proteção do Supabase contra senhas vazadas depende do plano Pro ou superior; defina requisitos fortes de senha no Auth.
- Testes automatizados não garantem ausência de bugs: valide também os fluxos reais no celular e no computador antes de registrar estoque da empresa.
