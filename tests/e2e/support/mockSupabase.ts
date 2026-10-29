import type {Page,Route} from '@playwright/test';

type Row=Record<string,unknown>;
type Entity='products'|'customers'|'suppliers'|'quotes'|'orders'|'stock_movements';
type Options={invalidLogin?:boolean;unauthorized?:boolean;role?:'admin'|'member';initialProducts?:Row[];initialCustomers?:Row[];initialSuppliers?:Row[]};
// Único código aceito pelo resgate simulado; não é segredo real.
export const validInviteCode='1A2B-3C4D-5E6F-7A8B';
const userId='11111111-1111-4111-8111-111111111111';
const jwt=[
 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',
 btoa(JSON.stringify({sub:userId,role:'authenticated',aud:'authenticated',exp:4102444800,iat:1700000000})).replaceAll('=','').replaceAll('+','-').replaceAll('/','_'),
 'fake'
].join('.');
const user={id:userId,aud:'authenticated',role:'authenticated',email:'test@example.com',app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
const asResponse=(data:unknown,status=200)=>({status,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(data)});
const failure=(message:string,status=400)=>asResponse({code:'P0001',message},status);
let counter=1;
const nextId=()=>String(counter++).padStart(8,'0')+'-0000-4000-8000-000000000000';

export async function mockBackend(page:Page,options:Options={}){
 const store:Record<Entity,Row[]>={
  products:[...(options.initialProducts||[])],
  customers:[...(options.initialCustomers||[])],
  suppliers:[...(options.initialSuppliers||[])],
  quotes:[],
  orders:[],
  stock_movements:[]
 };
 const calls:{path:string;method:string;body:unknown}[]=[];
 let failedRequest='';
 let member:Row|null=options.unauthorized?null:{user_id:userId,role:options.role||'admin'};
 const members:Row[]=member?[{user_id:userId,email:user.email,role:member.role,created_at:'2026-01-01T00:00:00Z'},{user_id:'22222222-2222-4222-8222-222222222222',email:'ana@example.com',role:'member',created_at:'2026-02-01T00:00:00Z'}]:[];
 const invites:Row[]=[];
 const mock={store,calls,members,invites,failNext:(path:string)=>{failedRequest=path;}};
 await page.route('https://test.supabase.co/**',async(route:Route)=>{
  const request=route.request(),url=new URL(request.url()),path=url.pathname,method=request.method();
  const body=request.postDataJSON?.()??null;
  calls.push({path,method,body});
  const reply=(data:unknown,status=200)=>route.fulfill(asResponse(data,status));
  if(failedRequest===path){failedRequest='';return route.fulfill(failure('Falha simulada no servidor',500));}
  if(path==='/auth/v1/token'){
   if(options.invalidLogin)return route.fulfill(failure('Invalid login credentials',400));
   return reply({access_token:jwt,token_type:'bearer',expires_in:3600,expires_at:4102444800,refresh_token:'fake-refresh',user});
  }
  if(path==='/auth/v1/user')return reply(user);
  if(path==='/auth/v1/logout')return reply({});
  if(path==='/auth/v1/recover')return reply({});
  if(path==='/auth/v1/signup')return reply({...user,id:'33333333-3333-4333-8333-333333333333',email:(body as Row)?.email,identities:[],confirmation_sent_at:'2026-01-01T00:00:00Z'});
  if(path.includes('/rest/v1/app_members'))return reply(member);
  const match=path.match(/^\/rest\/v1\/(products|customers|suppliers|quotes|orders|stock_movements)$/);
  if(match){
   const table=match[1] as Entity;
   if(method==='GET'){
    const data=table==='quotes'
     ?store.quotes.map(q=>({...q,quote_items:(q.quote_items||[]) as unknown[]}))
     :store[table];
    return reply(data);
   }
   if(method==='POST'){
    const payload=body as Row;
    const item={id:nextId(),...payload,
     ...(table==='products'?{qty:0,min_qty:payload.min_qty??0,price_cents:payload.price_cents??0,cost_cents:payload.cost_cents??0,archived_at:null}:{}),
     ...(table==='customers'||table==='suppliers'?{archived_at:null}:{}),
    };
    store[table].push(item);
    return route.fulfill({status:201,body:''});
   }
   if(method==='PATCH'){
    const payload=body as Row,id=url.searchParams.get('id')?.replace('eq.','');
    const old=store[table].find(row=>row.id===id);
    if(!old)return route.fulfill(failure('Registro não encontrado',404));
    Object.assign(old,payload);
    return reply(old);
   }
  }
  if(path.startsWith('/rest/v1/rpc/')){
   const action=path.split('/').pop()!;
   const data=body as Row;
   const isAdmin=member?.role==='admin';
   const adminOnly=['list_members','list_invite_codes','create_invite_code','revoke_invite_code','set_member_role','remove_member'];
   if(adminOnly.includes(action)&&!isAdmin)return route.fulfill(failure('Apenas administradores podem gerenciar usuários',403));
   if(action==='redeem_invite_code'){
    if(member)return route.fulfill(failure('Esta conta já tem acesso'));
    if(data.p_code!==validInviteCode)return reply(null);
    member={user_id:userId,role:'member'};
    return reply('member');
   }
   if(action==='list_members')return reply(members);
   if(action==='list_invite_codes')return reply(invites);
   if(action==='create_invite_code'){
    const id=nextId(),expires=new Date(Date.now()+Number(data.p_valid_hours)*3600_000).toISOString();
    invites.unshift({invite_id:id,role:data.p_role,note:data.p_note,created_at:new Date().toISOString(),expires_at:expires,used_at:null,used_by_email:null,revoked_at:null});
    return reply([{invite_id:id,invite_code:'9F8E-7D6C-5B4A-3210',invite_expires_at:expires}]);
   }
   if(action==='revoke_invite_code'){
    const invite=invites.find(x=>x.invite_id===data.p_invite_id&&!x.used_at&&!x.revoked_at);
    if(!invite)return route.fulfill(failure('Convite não encontrado ou já utilizado'));
    invite.revoked_at=new Date().toISOString();
    return reply(null);
   }
   if(action==='set_member_role'||action==='remove_member'){
    const target=members.find(x=>x.user_id===data.p_user_id);
    if(!target)return route.fulfill(failure('Membro não encontrado'));
    const next=action==='remove_member'?null:data.p_role;
    if(target.role==='admin'&&next!=='admin'&&members.filter(x=>x.role==='admin').length<=1)return route.fulfill(failure('O sistema precisa de ao menos um administrador'));
    if(next===null)members.splice(members.indexOf(target),1);else target.role=next;
    return reply(null);
   }
   if(action==='record_stock_movement'){
    const p=store.products.find(x=>x.id===data.p_product_id);
    if(!p||p.archived_at)return route.fulfill(failure('Produto não encontrado'));
    const after=Number(p.qty)+Number(data.p_delta);
    if(after<0)return route.fulfill(failure('Saldo insuficiente'));
    if(!Number.isInteger(after))return route.fulfill(failure('Quantidade inválida'));
    const id=nextId();
    if(Number(data.p_delta)<0&&(data.p_unit_cost_cents!=null||data.p_supplier_id!=null))return route.fulfill(failure('Custo e fornecedor só se aplicam a entradas'));
    if(data.p_supplier_id!=null&&!store.suppliers.some(s=>s.id===data.p_supplier_id&&!s.archived_at))return route.fulfill(failure('Fornecedor não encontrado'));
    p.qty=after;
    store.stock_movements.unshift({id,product_id:p.id,delta:data.p_delta,kind:Number(data.p_delta)>0?'Entrada':'Saída',note:data.p_note,created_at:new Date().toISOString(),unit_cost_cents:data.p_unit_cost_cents??null,supplier_id:data.p_supplier_id??null});
    return reply(id);
   }
   if(action==='create_quote_with_items'){
    const lines=data.p_items as {product_id:string;quantity:number}[];
    const customer=store.customers.find(x=>x.id===data.p_customer_id&&!x.archived_at);
    if(!customer)return route.fulfill(failure('Cliente inválido'));
    const quoteItems:Row[]=lines.map(x=>{
     const product=store.products.find(p=>p.id===x.product_id&&!p.archived_at);
     if(!product)throw new Error('Produto de teste ausente');
     return {id:nextId(),product_id:product.id,product_name:product.name,quantity:x.quantity,unit_price_cents:product.price_cents};
    });
    const id=nextId();
    store.quotes.push({id,quote_number:store.quotes.length+1,customer_id:customer.id,status:'Rascunho',discount_cents:data.p_discount_cents,notes:data.p_notes,created_at:new Date().toISOString(),delivery_date:data.p_delivery_date??null,freight_cents:data.p_freight_cents??0,payment_terms:data.p_payment_terms??'',quote_items:quoteItems});
    return reply(id);
   }
   if(action==='set_quote_status'){
    const quote=store.quotes.find(x=>x.id===data.p_quote_id);
    if(!quote)return route.fulfill(failure('Orçamento não encontrado',404));
    if(store.orders.some(x=>x.quote_id===quote.id))return route.fulfill(failure('Orçamento já convertido'));
    quote.status=data.p_status;
    return reply(null);
   }
   if(action==='create_order_from_quote'){
    const quote=store.quotes.find(x=>x.id===data.p_quote_id);
    if(!quote||quote.status!=='Aprovado')return route.fulfill(failure('Aprovação necessária'));
    if(store.orders.some(x=>x.quote_id===quote.id))return route.fulfill(failure('Pedido duplicado'));
    const subtotal=(quote.quote_items as Row[]).reduce((sum,item)=>sum+Number(item.unit_price_cents)*Number(item.quantity),0);
    const id=nextId();
    store.orders.push({id,order_number:store.orders.length+1,quote_id:quote.id,customer_id:quote.customer_id,total_cents:subtotal-Number(quote.discount_cents)+Number(quote.freight_cents||0),status:'Em separação',created_at:new Date().toISOString()});
    return reply(id);
   }
   if(action==='set_order_status'){
    const order=store.orders.find(x=>x.id===data.p_order_id);
    if(!order)return route.fulfill(failure('Pedido não encontrado',404));
    order.status=data.p_status;
    return reply(null);
   }
   return route.fulfill(failure('RPC não simulada: '+action,404));
  }
  return route.fulfill(failure('Rota não simulada: '+method+' '+path,404));
 });
 return mock;
}

export async function loginAsMockUser(page:Page){
 await page.goto('/');
 await page.getByLabel('E-mail').fill('test@example.com');
 await page.getByLabel('Senha').fill('Example123456!');
 await page.getByRole('button',{name:'Entrar',exact:true}).click();
}
export const seededProduct=(id='a0000000-0000-4000-8000-000000000001',name='Caixa Kraft',quantity=20):Row=>({
 id,name,sku:'CX-001',category:'Embalagens',qty:quantity,min_qty:3,cost_cents:500,price_cents:1200,supplier_id:null,archived_at:null
});
export const seededCustomer=(id='b0000000-0000-4000-8000-000000000001',name='Mercado Central'):Row=>({
 id,name,doc:'',phone:'',email:'',archived_at:null
});
export const seededSupplier=(id='c0000000-0000-4000-8000-000000000001',name='Fornecedor Sul'):Row=>({
 id,name,doc:'',phone:'',email:'',category:'Embalagens',archived_at:null
});
