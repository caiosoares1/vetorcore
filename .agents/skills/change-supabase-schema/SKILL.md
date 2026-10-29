---
name: change-supabase-schema
description: "Usar quando for necessário alterar SQL, esquema PostgreSQL, tabelas, RLS, privilégios, funções RPC ou migrations Supabase do Vetorcore. Inclui preparação segura, revisão e validação sem escrever em produção automaticamente."
---

# Alterar esquema e segurança Supabase

## Descoberta e limite
1. Ler `AGENTS.md`, `docs/architecture.md`, `docs/decisions/0001-auth-rls.md` e ADR pertinente.
2. Ler `supabase/migrations/0001_schema.sql` e `supabase/schema_snapshot.sql`: **não são duas migrations sequenciais**. O segundo é retrato de conciliação do banco remoto.
3. Verificar se mudanças recentes já existem no banco/na documentação. Não presumir que um Supabase local esteja configurado; repositório não possui script de migration/CLI documentado.

## Procedimento seguro
1. Descrever objetivo, tabelas/funções afetadas, impacto em RLS e riscos de acesso/destruição de dados.
2. Propor arquivo novo em `supabase/migrations/` com nome e ordem a confirmar com mantenedor (só `0001_schema.sql` oferece precedente). Não editar o snapshot como se fosse migration de produção.
3. Para política/coluna, atualizar regras de `authenticated` e manter o princípio de menor privilégio (inclusive `TRUNCATE`, `UPDATE(qty)`).
4. Para RPCs `SECURITY DEFINER`, conferir `auth.uid()`, `app_members`, `search_path` explícito e permissões `EXECUTE`; usar qualificações de schema e transações.
5. Considerar `archived_at`, integridade referencial, concorrência, prevenção de estoque negativo e conversão única de proposta.
6. Escrever plano de teste SQL com transação descartável (`BEGIN` ... `ROLLBACK`) em **ambiente isolado**; não executar em produção por padrão.
7. Ajustar cliente `supabase.rpc` ou `.from` e os mocks Playwright somente quando contrato real mudar.
8. Solicitar autorização explícita antes de aplicar migrations no projeto remoto; registrar resultado e eventual rollback.
9. Rodar `npm run test:coverage`, `npm run build` e `npm run test:e2e` para conferir impacto no frontend.

## Não fazer
- Não executar `supabase/schema_snapshot.sql` automaticamente.
- Não usar `service_role` no browser, expor segredos ou modificar usuários reais.
- Não assumir a presença de CLI, script npm ou ambiente de teste que não estão no repositório.
- Não tratar mock de Supabase como prova de migração SQL bem-sucedida.

## Exemplos
- `supabase/migrations/0001_schema.sql`
- `supabase/schema_snapshot.sql`
- `src/lib/supabase.ts`
