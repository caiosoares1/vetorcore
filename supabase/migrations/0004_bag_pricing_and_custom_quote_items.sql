-- 0004 — Custos de sacola editáveis pelo app e itens personalizados (calculadora) no orçamento.
-- Aplicar sobre o estado atual do banco (0001 + snapshot + 0002 + 0003), SOMENTE após revisão e teste em ambiente
-- isolado (BEGIN ... ROLLBACK). Não aplicar automaticamente em produção.
-- O frontend lê bag_pricing_settings e quote_items.line_total_cents: aplicar esta migration ANTES de publicar o frontend.
-- Ver docs/decisions/0008-custos-e-itens-personalizados.md. Rollback: bloco comentado no fim do arquivo.

begin;

-- 1) Custos de impressão e margem da calculadora de sacolas (linha única).
--    Membros leem; só administradores alteram, e apenas pela RPC set_bag_pricing_settings.
create table if not exists public.bag_pricing_settings(
 id smallint primary key default 1 check (id=1),
 labor_monthly_cents bigint not null check (labor_monthly_cents between 0 and 100000000),
 hours_per_thousand numeric(8,4) not null check (hours_per_thousand>0 and hours_per_thousand<=100),
 ink_cents bigint not null check (ink_cents between 0 and 100000000),
 solvent_cents bigint not null check (solvent_cents between 0 and 100000000),
 energy_per_hour_cents bigint not null check (energy_per_hour_cents between 0 and 100000000),
 one_color_extra_cents bigint not null check (one_color_extra_cents between 0 and 100000000),
 margin_pct numeric(5,2) not null check (margin_pct>=0 and margin_pct<100),
 updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id) on delete set null
);
-- Valores de 2026 (os mesmos de DEFAULT_PRINT_COSTS/DEFAULT_MARGIN em src/lib/bagPricing.ts).
insert into public.bag_pricing_settings(id,labor_monthly_cents,hours_per_thousand,ink_cents,solvent_cents,energy_per_hour_cents,one_color_extra_cents,margin_pct)
values(1,350000,2,14000,100,120,400,35) on conflict (id) do nothing;
alter table public.bag_pricing_settings enable row level security;
revoke all on table public.bag_pricing_settings from public,anon,authenticated;
grant select on table public.bag_pricing_settings to authenticated;
drop policy if exists "members can read bag pricing settings" on public.bag_pricing_settings;
create policy "members can read bag pricing settings" on public.bag_pricing_settings
 for select to authenticated using ((select public.is_vetor_member()));

create or replace function private.set_bag_pricing(
 p_labor_monthly_cents bigint, p_hours_per_thousand numeric, p_ink_cents bigint, p_solvent_cents bigint,
 p_energy_per_hour_cents bigint, p_one_color_extra_cents bigint, p_margin_pct numeric)
 returns void
 language plpgsql
 security definer
 set search_path to ''
as $function$
begin
if (select auth.uid()) is null or not exists(select 1 from public.app_members where user_id=(select auth.uid()) and role='admin') then
 raise exception 'Apenas administradores podem alterar os custos' using errcode='42501';
end if;
if p_labor_monthly_cents is null or p_hours_per_thousand is null or p_ink_cents is null or p_solvent_cents is null
 or p_energy_per_hour_cents is null or p_one_color_extra_cents is null or p_margin_pct is null then
 raise exception 'Informe todos os custos';
end if;
-- As faixas válidas são garantidas pelos CHECKs da tabela.
update public.bag_pricing_settings set
 labor_monthly_cents=p_labor_monthly_cents, hours_per_thousand=p_hours_per_thousand, ink_cents=p_ink_cents,
 solvent_cents=p_solvent_cents, energy_per_hour_cents=p_energy_per_hour_cents, one_color_extra_cents=p_one_color_extra_cents,
 margin_pct=p_margin_pct, updated_at=now(), updated_by=(select auth.uid())
where id=1;
if not found then raise exception 'Configuração de custos ausente';end if;
end;
$function$;

create or replace function public.set_bag_pricing_settings(
 p_labor_monthly_cents bigint, p_hours_per_thousand numeric, p_ink_cents bigint, p_solvent_cents bigint,
 p_energy_per_hour_cents bigint, p_one_color_extra_cents bigint, p_margin_pct numeric)
 returns void
 language sql
 set search_path to ''
as $function$
select private.set_bag_pricing(p_labor_monthly_cents,p_hours_per_thousand,p_ink_cents,p_solvent_cents,p_energy_per_hour_cents,p_one_color_extra_cents,p_margin_pct);
$function$;

-- 2) Fornecedores de material com preço do kg (antes fixos no código), editáveis no cadastro de fornecedores.
insert into public.suppliers(name,category,price_per_kg_cents)
select v.name,'Sacolas plásticas',v.cents
from (values ('2 IRMÃO',4000),('MAIN',4000),('TECNOPLAST',4300),('TOTAL MAIS',3500)) as v(name,cents)
where not exists(select 1 from public.suppliers s where lower(s.name)=lower(v.name));

-- 3) Item personalizado no orçamento: sacola calculada, sem produto do catálogo.
--    line_total_cents guarda o total exato da linha (o unitário de sacola tem mais de 2 casas: R$ 0,98887).
alter table public.quote_items add column if not exists line_total_cents bigint;
alter table public.quote_items drop constraint if exists quote_items_line_total_cents_check;
alter table public.quote_items add constraint quote_items_line_total_cents_check check (line_total_cents is null or line_total_cents>=0);

create or replace function private.create_quote(p_customer_id uuid, p_items jsonb, p_discount_cents bigint DEFAULT 0, p_notes text DEFAULT ''::text, p_delivery_date date DEFAULT NULL::date, p_freight_cents bigint DEFAULT 0, p_payment_terms text DEFAULT ''::text)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_quote uuid;v_item jsonb;v_product record;v_qty integer;v_subtotal bigint:=0;v_count integer:=0;v_name text;v_total bigint;
begin
if (select auth.uid()) is null or not exists(select 1 from public.app_members where user_id=(select auth.uid())) then raise exception 'Acesso não autorizado' using errcode='42501';end if;
if not exists(select 1 from public.customers where id=p_customer_id and archived_at is null) then raise exception 'Selecione um cliente válido';end if;
if p_items is null or jsonb_typeof(p_items)<>'array' or jsonb_array_length(p_items)=0 or jsonb_array_length(p_items)>100 then raise exception 'Informe de 1 a 100 itens';end if;
if p_discount_cents is null or p_discount_cents<0 then raise exception 'Desconto inválido';end if;
if p_freight_cents is null or p_freight_cents<0 then raise exception 'Frete inválido';end if;
if p_delivery_date is not null and p_delivery_date<current_date-1 then raise exception 'Data de entrega no passado';end if;
insert into public.quotes(customer_id,status,discount_cents,notes,delivery_date,freight_cents,payment_terms)
values(p_customer_id,'Rascunho',p_discount_cents,left(coalesce(p_notes,''),2000),p_delivery_date,p_freight_cents,left(coalesce(p_payment_terms,''),500)) returning id into v_quote;
for v_item in select value from jsonb_array_elements(p_items) loop
v_count:=v_count+1;
if jsonb_typeof(v_item)<>'object' then raise exception 'Item % inválido',v_count;end if;
if v_item->>'quantity' is null or (v_item->>'quantity') !~ '^[1-9][0-9]{0,6}$' then raise exception 'Quantidade inválida no item %',v_count;end if;
v_qty:=(v_item->>'quantity')::integer;
if v_item ? 'product_id' then
 -- Produto do catálogo: nome e preço congelados a partir do cadastro (comportamento anterior).
 select id,name,price_cents into v_product from public.products where id=(v_item->>'product_id')::uuid and archived_at is null;
 if not found then raise exception 'Produto do item % não encontrado',v_count;end if;
 v_subtotal:=v_subtotal+(v_qty::bigint*v_product.price_cents);
 insert into public.quote_items(quote_id,product_id,product_name,quantity,unit_price_cents) values(v_quote,v_product.id,v_product.name,v_qty,v_product.price_cents);
elsif v_item ? 'description' then
 -- Item personalizado (calculadora de sacolas): descrição e total da linha informados; unitário arredondado só para exibição.
 v_name:=btrim(regexp_replace(coalesce(v_item->>'description',''),'\s+',' ','g'));
 if char_length(v_name)<2 or char_length(v_name)>200 then raise exception 'Descrição inválida no item %',v_count;end if;
 if v_item->>'line_total_cents' is null or (v_item->>'line_total_cents') !~ '^[1-9][0-9]{0,11}$' then raise exception 'Valor inválido no item %',v_count;end if;
 v_total:=(v_item->>'line_total_cents')::bigint;
 v_subtotal:=v_subtotal+v_total;
 insert into public.quote_items(quote_id,product_id,product_name,quantity,unit_price_cents,line_total_cents)
 values(v_quote,null,v_name,v_qty,round(v_total::numeric/v_qty)::bigint,v_total);
else
 raise exception 'Item % sem produto nem descrição',v_count;
end if;
end loop;
if p_discount_cents>v_subtotal then raise exception 'Desconto maior que o subtotal';end if;
return v_quote;
end;$function$;

create or replace function private.create_order(p_quote_id uuid)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_quote record;v_order_id uuid;v_total bigint;
begin
if (select auth.uid()) is null or not exists(select 1 from public.app_members where user_id=(select auth.uid())) then raise exception 'Acesso não autorizado' using errcode='42501';end if;
select id,customer_id,status,discount_cents,freight_cents into v_quote from public.quotes where id=p_quote_id for update;
if not found then raise exception 'Orçamento não encontrado';end if;
if v_quote.status<>'Aprovado' then raise exception 'Aprove o orçamento antes de criar o pedido';end if;
if exists(select 1 from public.orders where quote_id=p_quote_id) then raise exception 'Já existe pedido para este orçamento';end if;
-- Total da linha: line_total_cents quando informado (item personalizado); senão quantidade × unitário.
select coalesce(sum(coalesce(line_total_cents,quantity::bigint*unit_price_cents)),0)-v_quote.discount_cents+v_quote.freight_cents into v_total from public.quote_items where quote_id=p_quote_id;
if v_total<0 then raise exception 'Total inválido';end if;
insert into public.orders(quote_id,customer_id,total_cents,status) values(p_quote_id,v_quote.customer_id,v_total,'Em separação') returning id into v_order_id;
return v_order_id;
end;$function$;

revoke all on function private.set_bag_pricing(bigint,numeric,bigint,bigint,bigint,bigint,numeric) from public,anon;
grant execute on function private.set_bag_pricing(bigint,numeric,bigint,bigint,bigint,bigint,numeric) to authenticated;
revoke all on function public.set_bag_pricing_settings(bigint,numeric,bigint,bigint,bigint,bigint,numeric) from public,anon;
grant execute on function public.set_bag_pricing_settings(bigint,numeric,bigint,bigint,bigint,bigint,numeric) to authenticated;
-- create_quote/create_order mantêm assinatura; reforça os privilégios existentes.
revoke all on function private.create_quote(uuid,jsonb,bigint,text,date,bigint,text) from public,anon;
grant execute on function private.create_quote(uuid,jsonb,bigint,text,date,bigint,text) to authenticated;
revoke all on function private.create_order(uuid) from public,anon;
grant execute on function private.create_order(uuid) to authenticated;

commit;

-- Teste: scripts/sql/test_0004.sql (Postgres descartável; não usar em produção).
--
-- Rollback (revisar antes de executar). Antes, apague itens personalizados ou converta-os,
-- pois a função antiga não sabe somar line_total_cents:
-- begin;
-- drop function if exists public.set_bag_pricing_settings(bigint,numeric,bigint,bigint,bigint,bigint,numeric);
-- drop function if exists private.set_bag_pricing(bigint,numeric,bigint,bigint,bigint,bigint,numeric);
-- drop table if exists public.bag_pricing_settings;
-- -- Recriar private.create_quote e private.create_order com as definições anteriores (supabase/schema_snapshot.sql + 0002).
-- alter table public.quote_items drop constraint if exists quote_items_line_total_cents_check;
-- alter table public.quote_items drop column if exists line_total_cents;
-- -- Os 4 fornecedores inseridos podem ser mantidos (são cadastros comuns) ou arquivados pelo app.
-- commit;
