# Arquitetura do Vetorcore

## Limites do sistema

Vetor Hub é uma **PWA React 18/TypeScript/Vite 6** implantada na Vercel. Não há servidor HTTP próprio, React Router ou estrutura de APIs Node no repositório. O navegador usa o SDK `@supabase/supabase-js` para acessar **Supabase Auth e PostgreSQL**. O app não é offline-first: o service worker pode armazenar a interface, mas não há mecanismo documentado para sincronizar escritas offline.

Arquivos de entrada: `index.html` → `src/main.tsx` → `src/AuthGate.tsx` → `src/App.tsx`. `src/main.tsx` registra o service worker via `virtual:pwa-register`, com notificação de atualização. `src/App.tsx` mantém a página escolhida em estado React, com navegação desktop/mobile; não existem arquivos de rotas.

## Fluxo de dados

```text
Navegador (React / PWA)
  ├── AuthGate → Supabase Auth → Session
  │                  └── public.app_members (permissão de acesso)
  ├── App / RecordEditor → domínio (validação, centavos)
  │     └── Supabase PostgREST → tabelas com RLS
  ├── App (estoque) → public.record_stock_movement(...)
  │     └── private.stock_movement(...) → products + stock_movements (transação)
  ├── CommercePages → public.create_quote_with_items(...)
  │     └── private.create_quote(...) → quotes + quote_items (transação)
  ├── CommercePages → set_quote_status / create_order_from_quote / set_order_status
  │     └── funções private → quotes / orders
  └── CommercePages → jsPDF no navegador → arquivo PDF local
```

Os nomes de RPC e o esquema exato são verificáveis em `supabase/schema_snapshot.sql`; as tabelas iniciais aparecem em `supabase/migrations/0001_schema.sql`.

## Autenticação e autorização

`src/lib/supabase.ts` cria o cliente com `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. `AuthGate` gerencia login por e-mail/senha, recuperação/definição de senha e sessão; consulta `public.app_members` para permitir acesso à interface. O banco aplica RLS às tabelas, e as funções privilegiadas `private.*` verificam `auth.uid()` e associação ao sistema. A verificação da interface **não substitui** a segurança do banco.

Criação de conta e papéis (ADR-0005, migration `0003_member_access.sql`): qualquer pessoa cria conta com e-mail confirmado, mas só entra em `app_members` ao resgatar um código de convite de uso único via `redeem_invite_code`. `app_members.role` distingue `admin` de `member`; somente admins veem a página **Usuários** (`src/components/UsersPage.tsx`) e executam `create_invite_code`, `list_invite_codes`, `revoke_invite_code`, `list_members`, `set_member_role` e `remove_member`. O banco garante ao menos um admin. `AuthGate` expõe o papel via `MemberRoleContext`.

## Cadastros e estoque

`src/App.tsx` carrega produtos, clientes, fornecedores e movimentos via `.from(...).select(...)`. `RecordEditor.tsx` envia `insert`/`update`; entradas e saídas invocam `record_stock_movement`, responsável por impedir estoque negativo e escrever histórico junto com o saldo.

`archived_at` marca arquivamento reversível de produtos, clientes e fornecedores; os filtros de interface separam ativos e arquivados. As funções do banco também recusam itens/cliente arquivados em novas operações relevantes. O componente `EditorSheet` renderiza drawer no desktop e tela cheia no mobile; estilos em `src/editor.css`.

## Orçamentos, pedidos e PDF

`CommercePages.tsx` lista `quotes` com `quote_items` e `orders`. `src/lib/domain.ts` valida clientes/produtos ativos, quantidades, descontos e duplicatas; `quoteMath.ts` manipula centavos. A criação é transacional no banco e congela os nomes/preços dos itens no orçamento. A proposta pode mudar de status; somente orçamento aprovado e ainda não convertido permite criar pedido. O pedido pode ser concluído. **Nenhum desses passos baixa o estoque automaticamente.** jsPDF gera o PDF no navegador, sem serviço de armazenamento externo.

## Tema claro/escuro

O tema efetivo fica em `<html data-theme="light|dark">`. A preferência (Sistema, Claro ou Escuro) é por aparelho, em `localStorage` (`vetor.theme`), e é alternada pelo botão no cabeçalho e na tela de login (`src/components/ThemeToggle.tsx`, `src/theme.ts`). Um script em `index.html` aplica o tema antes do React para não piscar em claro. `src/dark.css` é gerado por `scripts/gen-dark-theme.mjs` a partir dos três CSS claros: cada cor é remapeada em OKLCH conforme o papel (fundo, texto, borda, sombra) e as declarações são copiadas sob `:root[data-theme="dark"]` para preservar a cascata. `tests/dark-theme.test.mjs` falha se o arquivo estiver desatualizado e verifica contraste AA dos textos principais.

## Infraestrutura, testes e segurança

- `vite.config.ts`: React + `vite-plugin-pwa`; `vercel.json`: build `npm run build`/saída `dist` e fallback de navegação.
- `.github/workflows/ci.yml`: Node 22, `npm install`, `npm run test:coverage`, `npm run build`, Playwright Chromium e `npm run test:e2e`.
- `tests/*.test.mjs`: funções puras; `tests/e2e/`: jornadas desktop/mobile com servidor Vite e Supabase interceptado por `tests/e2e/support/mockSupabase.ts`.
- Resultados Playwright são **simulados**; testes transacionais reais do SQL foram executados manualmente, mas não são um job do CI (detalhes em `TESTING.md`).
- `dist/` e `node_modules/` são gerados. Não incluir credenciais no frontend. Consulte `AGENTS.md` antes de alteração em banco.

## Estrutura derivada das planilhas (migration 0002)

`supabase/migrations/0002_planilhas_estrutura.sql` adiciona os campos que a operação controlava nas planilhas "Sis Tema" e "Tabela de sacolas plásticas 2026": endereço e data de cadastro em clientes/fornecedores, preço por kg do fornecedor, modelo e medidas da sacola no produto, custo e fornecedor por entrada (parâmetros opcionais de `record_stock_movement`) e frete, data de entrega e forma de pagamento no orçamento (parâmetros opcionais de `create_quote_with_items`). O total do pedido passa a ser `subtotal − desconto + frete`. O frontend seleciona essas colunas, então **a migration precisa estar aplicada antes do deploy do frontend**. A calculadora de preço por kg/cores/tiragem da tabela de sacolas ainda não foi implementada.

## Limitações e pontos em aberto

Não há lint, formatter, lockfile ou script combinado de checagens versionados. Não há pasta de services/repositories separada; a UI chama o cliente Supabase diretamente. `src/data.ts` contém um modelo/dados de demonstração local anterior; seu papel atual não foi formalmente esclarecido. O snapshot do banco representa alterações posteriores à migration inicial, mas não constitui sequência incremental completa para reprovisionar ambientes. Backup/restauração, dispositivos físicos e integrações reais ainda carecem de validação documentada.
