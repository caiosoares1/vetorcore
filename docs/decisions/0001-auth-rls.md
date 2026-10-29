# ADR-0001 — Supabase Auth, associação de membros e RLS

- **Estado:** Vigente (implementação observada)
- **Data:** Não documentada
- **Escopo:** `src/AuthGate.tsx`, `src/lib/supabase.ts`, `supabase/schema_snapshot.sql`
- **Evidências:** `AuthGate` consulta `app_members`; políticas RLS e funções SQL verificam usuário autorizado.

## Contexto observado
O frontend é uma PWA sem backend HTTP próprio, conectada diretamente a Supabase Auth/PostgreSQL. O app possui cadastro autorizado por associação explícita na tabela `public.app_members`.

## Decisão observada
A interface só é liberada para sessão autenticada com registro em `app_members`. O acesso aos dados é controlado por políticas RLS. Funções SQL privadas com privilégios elevados verificam `auth.uid()` e a associação do membro. O frontend utiliza a chave publishable, não a `service_role`.

## Consequências verificadas
Login bem-sucedido sem registro em `app_members` não autoriza a interface; a permissão real precisa continuar protegida no PostgreSQL. Alterações em RLS/`SECURITY DEFINER` têm impacto de segurança e exigem revisão cuidadosa.

## Dúvidas
A motivação original e eventual plano para múltiplos papéis/organizações não estão documentados. Não presumir novo modelo de autorização.

## Referências
- `src/AuthGate.tsx`
- `src/lib/supabase.ts`
- `supabase/schema_snapshot.sql`
