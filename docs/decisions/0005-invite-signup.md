# ADR-0005 — Criação de conta por código de convite e papéis admin/member

- **Estado:** Proposto (migration `0003_member_access.sql` ainda precisa ser aplicada no Supabase)
- **Data:** 2026-10-29
- **Escopo:** `src/AuthGate.tsx`, `src/components/UsersPage.tsx`, `src/lib/domain.ts`, `supabase/migrations/0003_member_access.sql`
- **Relacionado:** ADR-0001 (Auth, `app_members` e RLS)

## Contexto
Só havia um membro em `public.app_members` e nenhuma forma de dar acesso a outra pessoa sem SQL manual. O app não tem backend próprio, então não pode usar a chave `service_role` (necessária para convites nativos do Supabase).

## Decisão
1. Qualquer pessoa pode criar uma conta no Supabase Auth (e-mail + senha, com confirmação de e-mail), mas **conta não é acesso**: os dados continuam protegidos por `app_members` + RLS.
2. O acesso é concedido pelo resgate de um **código de convite** (`public.redeem_invite_code`), gerado por um administrador:
   - código de 64 bits aleatórios (`gen_random_uuid`), formato `XXXX-XXXX-XXXX-XXXX`, exibido uma única vez;
   - o banco guarda só o SHA-256 (`private.invite_codes`, sem privilégios para `anon`/`authenticated`);
   - uso único, validade de 1 a 720 horas, revogável;
   - exige e-mail confirmado; limite de 5 tentativas por usuário a cada 15 minutos (`private.invite_attempts`);
   - tentativa com código inválido retorna `NULL` em vez de erro para que o registro da tentativa não seja desfeito.
3. `app_members.role` passa a ser `admin` ou `member`. Apenas admins listam membros/convites, geram/revogam convites, alteram papéis e removem acesso. O banco impede ficar sem administrador (bloqueio `FOR UPDATE` contra remoções simultâneas). Na migration, se não houver admin, os membros existentes viram admin.
4. `authenticated` continua só com `SELECT` na própria linha de `app_members`; nenhuma escrita direta — toda mudança passa por funções `SECURITY DEFINER` com `search_path` vazio.
5. Senha: mínimo de 12 caracteres, máximo de 72 bytes (limite do bcrypt), confirmação obrigatória, não igual ao e-mail e não trivialmente repetitiva (validada no frontend; o mínimo deve ser repetido no painel do Supabase).

## Configuração obrigatória no painel do Supabase (não versionada)
- Authentication → Sign In / Providers → Email: **Allow new users to sign up** ligado e **Confirm email** ligado.
- Authentication → Policies/Passwords: tamanho mínimo **12**; se o plano permitir, ligar **leaked password protection**.
- Authentication → URL Configuration: **Site URL** com o domínio de produção e o domínio em **Redirect URLs** (usado em `emailRedirectTo` e na recuperação de senha).
- Rate limits de Auth (padrão do Supabase) mantidos; considerar CAPTCHA (hCaptcha/Turnstile) se houver cadastros abusivos.
- SMTP próprio é recomendado para produção: o SMTP padrão do Supabase tem limite baixo de envio.

## Consequências
- Contas sem convite podem existir em `auth.users`, mas não leem nem gravam dados. Limpeza periódica de contas sem acesso fica a cargo do admin no painel.
- Remover acesso apaga a linha em `app_members`; a conta Auth e o histórico (`stock_movements.actor`) permanecem.
- O papel exibido na interface é só conveniência; cada RPC revalida no banco.
- Os testes Playwright simulam essas RPCs e não provam o comportamento real do SQL (ver bloco de teste em `0003_member_access.sql`).
