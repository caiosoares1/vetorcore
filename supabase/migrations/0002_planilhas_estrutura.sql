-- 0002 — Estrutura derivada das planilhas "Sis Tema.xlsx" e "TABELA DE SACOLAS PLÁSTICAS 2026.xlsx".
-- Aplicar sobre o estado descrito em schema_snapshot.sql, SOMENTE após revisão e teste em ambiente isolado
-- (BEGIN ... ROLLBACK). Não aplicar automaticamente em produção.
-- O frontend correspondente seleciona as novas colunas: aplicar esta migration ANTES de publicar o frontend.
-- Rollback: ver bloco comentado no fim do arquivo.

begin;

-- Clientes e fornecedores: ENDEREÇO e DATA de cadastro (abas CLIENTES / FORNECEDORES).
alter table public.customers add column if not exists address text not null default '';
alter table public.customers add column if not exists created_at timestamptz not null default now();
alter table public.suppliers add column if not exists address text not null default '';
alter table public.suppliers add column if not exists created_at timestamptz not null default now();
-- Preço do material por kg cobrado pelo fornecedor (Plan3!K30:L33 da tabela de sacolas).
alter table public.suppliers add column if not exists price_per_kg_cents bigint check (price_per_kg_cents is null or price_per_kg_cents>=0);

-- Produtos: DATA, modelo e medidas da sacola (ex.: "SACOLA 30X40X0,010 BOCA DE PALHAÇO").
alter table public.products add column if not exists created_at timestamptz not null default now();
alter table public.products add column if not exists model text not null default '' check (char_length(model)<=80);
alter table public.products add column if not exists width_cm numeric(6,1) check (width_cm is null or width_cm>0);
alter table public.products add column if not exists height_cm numeric(6,1) check (height_cm is null or height_cm>0);
alter table public.products add column if not exists gusset_cm numeric(6,1) check (gusset_cm is null or gusset_cm>=0);
alter table public.products add column if not exists thickness_mm numeric(6,4) check (thickness_mm is null or (thickness_mm>0 and thickness_mm<10));
grant update(model,width_cm,height_cm,gusset_cm,thickness_mm) on public.products to authenticated;

-- Entradas: CUSTO UNID e FORNECEDOR por recebimento (aba ENTRADAS).
alter table public.stock_movements add column if not exists unit_cost_cents bigint check (unit_cost_cents is null or unit_cost_cents>=0);
alter table public.stock_movements add column if not exists supplier_id uuid references public.suppliers(id);

-- Orçamentos: data de entrega, frete e forma de pagamento (abas SAIDAS / PEDIDO).
alter table public.quotes add column if not exists delivery_date date;
alter table public.quotes add column if not exists freight_cents bigint not null default 0 check (freight_cents>=0);
alter table public.quotes add column if not exists payment_terms text not null default '';

-- RPC de estoque: novos parâmetros opcionais. Chamadas antigas com 3 argumentos continuam válidas pelos defaults.
drop function if exists public.record_stock_movement(uuid,integer,text);
drop function if exists private.stock_movement(uuid,integer,text);

create function private.stock_movement(p_product_id uuid, p_delta integer, p_note text default '', p_unit_cost_cents bigint default null, p_supplier_id uuid default null)
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_qty integer;v_id uuid;
begin
if (select auth.uid()) is null or not exists(select 1 from public.app_members where user_id=(select auth.uid())) then raise exception 'Acesso não autorizado' using errcode='42501'; end if;
if p_product_id is null or p_delta is null or p_delta=0 then raise exception 'Quantidade inválida';end if;
if p_delta<0 and (p_unit_cost_cents is not null or p_supplier_id is not null) then raise exception 'Custo e fornecedor só se aplicam a entradas';end if;
if p_unit_cost_cents is not null and p_unit_cost_cents<0 then raise exception 'Custo inválido';end if;
if p_supplier_id is not null and not exists(select 1 from public.suppliers where id=p_supplier_id and archived_at is null) then raise exception 'Fornecedor não encontrado';end if;
select qty into v_qty from public.products where id=p_product_id and archived_at is null for update;
if not found then raise exception 'Produto não encontrado';end if;
if v_qty::bigint+p_delta::bigint<0 or v_qty::bigint+p_delta::bigint>2147483647 then raise exception 'Saldo insuficiente ou quantidade inválida';end if;
update public.products set qty=qty+p_delta where id=p_product_id;
insert into public.stock_movements(product_id,delta,kind,note,actor,unit_cost_cents,supplier_id)
values(p_product_id,p_delta,case when p_delta>0 then 'Entrada' else 'Saída' end,left(coalesce(p_note,''),500),(select auth.uid()),p_unit_cost_cents,p_supplier_id) returning id into v_id;
return v_id;
end;$function$;

create function public.record_stock_movement(p_product_id uuid, p_delta integer, p_note text default '', p_unit_cost_cents bigint default null, p_supplier_id uuid default null)
 returns uuid
 language sql
 set search_path to ''
as $function$
select private.stock_movement(p_product_id,p_delta,p_note,p_unit_cost_cents,p_supplier_id);
$function$;

revoke all on function private.stock_movement(uuid,integer,text,bigint,uuid) from public,anon;
grant execute on function private.stock_movement(uuid,integer,text,bigint,uuid) to authenticated;
revoke all on function public.record_stock_movement(uuid,integer,text,bigint,uuid) from public,anon;
grant execute on function public.record_stock_movement(uuid,integer,text,bigint,uuid) to authenticated;

-- RPC de orçamento: entrega, frete e pagamento opcionais.
drop function if exists public.create_quote_with_items(uuid,jsonb,bigint,text);
drop function if exists private.create_quote(uuid,jsonb,bigint,text);

create function private.create_quote(p_customer_id uuid, p_items jsonb, p_discount_cents bigint default 0, p_notes text default '', p_delivery_date date default null, p_freight_cents bigint default 0, p_payment_terms text default '')
 returns uuid
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare v_quote uuid;v_item jsonb;v_product record;v_qty integer;v_subtotal bigint:=0;v_count integer:=0;
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
if v_item->>'quantity' is null or (v_item->>'quantity') !~ '^[1-9][0-9]{0,6}$' then raise exception 'Quantidade inválida no item %',v_count;end if;
v_qty:=(v_item->>'quantity')::integer;
select id,name,price_cents into v_product from public.products where id=(v_item->>'product_id')::uuid and archived_at is null;
if not found then raise exception 'Produto do item % não encontrado',v_count;end if;
v_subtotal:=v_subtotal+(v_qty::bigint*v_product.price_cents);
insert into public.quote_items(quote_id,product_id,product_name,quantity,unit_price_cents) values(v_quote,v_product.id,v_product.name,v_qty,v_product.price_cents);
end loop;
if p_discount_cents>v_subtotal then raise exception 'Desconto maior que o subtotal';end if;
return v_quote;
end;$function$;

create function public.create_quote_with_items(p_customer_id uuid, p_items jsonb, p_discount_cents bigint default 0, p_notes text default '', p_delivery_date date default null, p_freight_cents bigint default 0, p_payment_terms text default '')
 returns uuid
 language sql
 set search_path to ''
as $function$
select private.create_quote(p_customer_id,p_items,p_discount_cents,p_notes,p_delivery_date,p_freight_cents,p_payment_terms);
$function$;

revoke all on function private.create_quote(uuid,jsonb,bigint,text,date,bigint,text) from public,anon;
grant execute on function private.create_quote(uuid,jsonb,bigint,text,date,bigint,text) to authenticated;
revoke all on function public.create_quote_with_items(uuid,jsonb,bigint,text,date,bigint,text) from public,anon;
grant execute on function public.create_quote_with_items(uuid,jsonb,bigint,text,date,bigint,text) to authenticated;

-- Pedido: total passa a incluir o frete do orçamento (subtotal - desconto + frete). Assinatura inalterada.
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
select coalesce(sum(quantity::bigint*unit_price_cents),0)-v_quote.discount_cents+v_quote.freight_cents into v_total from public.quote_items where quote_id=p_quote_id;
if v_total<0 then raise exception 'Total inválido';end if;
insert into public.orders(quote_id,customer_id,total_cents,status) values(p_quote_id,v_quote.customer_id,v_total,'Em separação') returning id into v_order_id;
return v_order_id;
end;$function$;

notify pgrst, 'reload schema';

commit;

-- Plano de teste (ambiente isolado, como membro autenticado):
--   begin;
--   select public.record_stock_movement('<produto>',5,'Compra',12,'<fornecedor>');   -- entrada com custo/fornecedor
--   select public.record_stock_movement('<produto>',-1,'',12,null);                -- deve falhar: custo em saída
--   select public.record_stock_movement('<produto>',1);                            -- assinatura antiga continua válida
--   select public.create_quote_with_items('<cliente>','[{"product_id":"<produto>","quantity":2}]',0,'',current_date+7,1500,'50% entrada');
--   -- aprovar e converter: orders.total_cents deve incluir freight_cents
--   rollback;
--
-- Rollback (após avaliar dados gravados nas novas colunas):
--   recriar private/public stock_movement, create_quote e create_order conforme schema_snapshot.sql
--   (drop das versões novas antes), depois:
--   alter table public.quotes drop column payment_terms, drop column freight_cents, drop column delivery_date;
--   alter table public.stock_movements drop column supplier_id, drop column unit_cost_cents;
--   alter table public.products drop column thickness_mm, drop column gusset_cm, drop column height_cm, drop column width_cm, drop column model, drop column created_at;
--   alter table public.suppliers drop column price_per_kg_cents, drop column created_at, drop column address;
--   alter table public.customers drop column created_at, drop column address;
