-- Teste da migration 0004 em ambiente ISOLADO (nunca em produção): tudo roda dentro de BEGIN ... ROLLBACK.
-- Pré-requisito: banco com o schema atual + 0004 aplicada. Cada verificação que falha interrompe com erro.
begin;

-- Usuários e membros de teste.
insert into auth.users(id,email) values
 ('00000000-0000-4000-8000-0000000000a1','admin-teste@example.com'),
 ('00000000-0000-4000-8000-0000000000b1','membro-teste@example.com'),
 ('00000000-0000-4000-8000-0000000000c1','sem-acesso@example.com');
insert into public.app_members(user_id,role) values
 ('00000000-0000-4000-8000-0000000000a1','admin'),('00000000-0000-4000-8000-0000000000b1','member');
insert into public.customers(id,name) values ('00000000-0000-4000-8000-00000000c001','Cliente Teste');
insert into public.products(id,sku,name,price_cents) values ('00000000-0000-4000-8000-00000000d001','T-1','Caixa Teste',1200);

-- 1) Fornecedores de material cadastrados com preço do kg.
do $$ begin
 if (select count(*) from public.suppliers where lower(name) in ('2 irmão','main','tecnoplast','total mais') and price_per_kg_cents is not null)<>4 then raise exception 'FALHA: fornecedores de material'; end if;
 if (select price_per_kg_cents from public.suppliers where name='TECNOPLAST')<>4300 then raise exception 'FALHA: preço TECNOPLAST'; end if;
end $$;

-- 2) Membro comum: lê os custos, não altera (nem pela RPC, nem direto na tabela).
select set_config('request.jwt.claims',json_build_object('sub','00000000-0000-4000-8000-0000000000b1','role','authenticated')::text,true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.bag_pricing_settings)<>1 then raise exception 'FALHA: membro não lê custos'; end if;
 if (select ink_cents from public.bag_pricing_settings)<>14000 then raise exception 'FALHA: valor inicial da tinta'; end if;
 begin perform public.set_bag_pricing_settings(1,2,1,1,1,1,10); raise exception 'FALHA: membro alterou custos';
 exception when insufficient_privilege then null; end;
 begin update public.bag_pricing_settings set ink_cents=1; raise exception 'FALHA: membro alterou tabela';
 exception when insufficient_privilege then null; end;
end $$;
reset role;

-- 3) Sem acesso (autenticado, mas fora de app_members): não lê custos.
select set_config('request.jwt.claims',json_build_object('sub','00000000-0000-4000-8000-0000000000c1','role','authenticated')::text,true);
set local role authenticated;
do $$ begin
 if (select count(*) from public.bag_pricing_settings)<>0 then raise exception 'FALHA: não membro lê custos'; end if;
end $$;
reset role;

-- 4) Anônimo: sem permissão na tabela.
set local role anon;
do $$ begin
 begin perform 1 from public.bag_pricing_settings; raise exception 'FALHA: anon leu custos';
 exception when insufficient_privilege then null; end;
end $$;
reset role;

-- 5) Admin: altera custos; valores fora da faixa são recusados.
select set_config('request.jwt.claims',json_build_object('sub','00000000-0000-4000-8000-0000000000a1','role','authenticated')::text,true);
set local role authenticated;
do $$ begin
 perform public.set_bag_pricing_settings(360000,2,15000,100,120,400,35);
 if (select ink_cents from public.bag_pricing_settings)<>15000 then raise exception 'FALHA: admin não alterou tinta'; end if;
 if (select updated_by from public.bag_pricing_settings)<>'00000000-0000-4000-8000-0000000000a1' then raise exception 'FALHA: updated_by'; end if;
 begin perform public.set_bag_pricing_settings(360000,2,15000,100,120,400,100); raise exception 'FALHA: margem 100%% aceita';
 exception when check_violation then null; end;
 begin perform public.set_bag_pricing_settings(360000,0,15000,100,120,400,35); raise exception 'FALHA: horas zero aceitas';
 exception when check_violation then null; end;
 begin perform public.set_bag_pricing_settings(null,2,15000,100,120,400,35); raise exception 'FALHA: nulo aceito';
 exception when raise_exception then null; end;
end $$;
reset role;

-- 6) Orçamento com produto do catálogo + sacola calculada (membro comum).
select set_config('request.jwt.claims',json_build_object('sub','00000000-0000-4000-8000-0000000000b1','role','authenticated')::text,true);
set local role authenticated;
do $$ declare v_quote uuid; r record; begin
 v_quote:=public.create_quote_with_items('00000000-0000-4000-8000-00000000c001',
  jsonb_build_array(
   jsonb_build_object('product_id','00000000-0000-4000-8000-00000000d001','quantity',3),
   jsonb_build_object('description','  Sacola Alça C   30x40 cm, 0,011 mm, 1 cor ','quantity',1000,'line_total_cents',98887)),
  500,'',null,1500,'');
 select * into r from public.quote_items where quote_id=v_quote and product_id is null;
 if r.product_name<>'Sacola Alça C 30x40 cm, 0,011 mm, 1 cor' then raise exception 'FALHA: descrição normalizada (%)',r.product_name; end if;
 if r.line_total_cents<>98887 or r.unit_price_cents<>99 or r.quantity<>1000 then raise exception 'FALHA: valores da linha personalizada'; end if;
 if (select line_total_cents from public.quote_items where quote_id=v_quote and product_id is not null) is not null then raise exception 'FALHA: linha de produto com total'; end if;
 perform set_config('teste.quote_id',v_quote::text,true);
end $$;
reset role;
update public.quotes set status='Aprovado' where id=current_setting('teste.quote_id')::uuid;
set local role authenticated;
do $$ declare v_order uuid; begin
 v_order:=public.create_order_from_quote(current_setting('teste.quote_id')::uuid);
 -- 3 × R$ 12,00 + R$ 988,87 − R$ 5,00 + R$ 15,00 = R$ 1.034,87 (exato, sem arredondar o unitário)
 if (select total_cents from public.orders where id=v_order)<>103487 then raise exception 'FALHA: total do pedido %',(select total_cents from public.orders where id=v_order); end if;
end $$;

-- 7) Validações do item personalizado.
do $$ begin
 begin perform public.create_quote_with_items('00000000-0000-4000-8000-00000000c001',jsonb_build_array(jsonb_build_object('description','X','quantity',1,'line_total_cents',100)),0,'',null,0,'');
  raise exception 'FALHA: descrição curta aceita'; exception when raise_exception then if sqlerrm not like 'Descrição inválida%' then raise; end if; end;
 begin perform public.create_quote_with_items('00000000-0000-4000-8000-00000000c001',jsonb_build_array(jsonb_build_object('description','Sacola','quantity',1,'line_total_cents',0)),0,'',null,0,'');
  raise exception 'FALHA: total zero aceito'; exception when raise_exception then if sqlerrm not like 'Valor inválido%' then raise; end if; end;
 begin perform public.create_quote_with_items('00000000-0000-4000-8000-00000000c001',jsonb_build_array(jsonb_build_object('description','Sacola','quantity',1,'line_total_cents','12.5')),0,'',null,0,'');
  raise exception 'FALHA: total decimal aceito'; exception when raise_exception then if sqlerrm not like 'Valor inválido%' then raise; end if; end;
 begin perform public.create_quote_with_items('00000000-0000-4000-8000-00000000c001',jsonb_build_array(jsonb_build_object('quantity',1)),0,'',null,0,'');
  raise exception 'FALHA: item vazio aceito'; exception when raise_exception then if sqlerrm not like '%sem produto nem descrição%' then raise; end if; end;
 begin perform public.create_quote_with_items('00000000-0000-4000-8000-00000000c001',jsonb_build_array(jsonb_build_object('description','Sacola','quantity',1,'line_total_cents',100)),101,'',null,0,'');
  raise exception 'FALHA: desconto acima do subtotal aceito'; exception when raise_exception then if sqlerrm not like 'Desconto maior%' then raise; end if; end;
 begin perform public.create_quote_with_items('00000000-0000-4000-8000-00000000c001','["x"]'::jsonb,0,'',null,0,'');
  raise exception 'FALHA: item não objeto aceito'; exception when raise_exception then if sqlerrm not like 'Item 1 inválido%' then raise; end if; end;
 -- O comportamento antigo (só produto) continua igual.
 perform public.create_quote_with_items('00000000-0000-4000-8000-00000000c001',jsonb_build_array(jsonb_build_object('product_id','00000000-0000-4000-8000-00000000d001','quantity',2)),0,'',null,0,'');
end $$;
reset role;

select 'OK: todos os testes da 0004 passaram' as resultado;
rollback;
