import test from 'node:test';
import assert from 'node:assert/strict';
import {
 normalizeName,validateSku,nonnegativeInteger,positiveInteger,productPayload,partyPayload,
 movementDelta,validateQuoteDraft,quoteCanBecomeOrder,inventoryStats,errorMessage
} from '../src/lib/domain.ts';

const products=[{id:'p1',price:12.5},{id:'p2',price:2.99},{id:'p3',price:88,archivedAt:'2026-01-01'}];
const customers=[{id:'c1'},{id:'c2',archivedAt:'2026-01-01'}];
const item=(productId='p1',quantity='2')=>({productId,quantity});
const product=(extra={})=>({name:'  Caixa  de papelão ',sku:' PAP-1 ',category:'   ',cost:'2,05',price:'6,99',min:'4',supplierId:'',...extra});

test('normaliza espaços no nome',()=>assert.equal(normalizeName('  Cliente   Principal  '),'Cliente Principal'));
test('rejeita nome curto ou vazio',()=>{for(const n of ['',' ','x'])assert.throws(()=>normalizeName(n));});
test('rejeita nome acima do máximo',()=>assert.throws(()=>normalizeName('x'.repeat(151))));
test('normaliza SKU e preserva letras',()=>assert.equal(validateSku(' ABC-1 '),'ABC-1'));
test('rejeita SKU vazio e longo',()=>{for(const sku of ['  ','x'.repeat(51)])assert.throws(()=>validateSku(sku));});

test('valida inteiro não negativo, inclusive zero',()=>{assert.equal(nonnegativeInteger('0','Valor'),0);assert.equal(nonnegativeInteger('0001','Valor'),1);});
test('recusa negativos, decimais, vazio, notação exponencial e limite 32 bits',()=>{for(const n of ['-1','1.4','','1e3','2147483648','NaN'])assert.throws(()=>nonnegativeInteger(n,'Valor'));});
test('valida quantidade positiva',()=>{assert.equal(positiveInteger('1','Qtd'),1);assert.throws(()=>positiveInteger('0','Qtd'));});

test('constrói produto com normalização monetária',()=>{
 assert.deepEqual(productPayload(product()),{name:'Caixa de papelão',sku:'PAP-1',category:'Outros',cost_cents:205,price_cents:699,min_qty:4,supplier_id:null});
});
test('permite fornecedor específico e estoque mínimo zero',()=>{
 const x=productPayload(product({supplierId:'sup-1',min:'0',category:'  Kraft  '}));
 assert.equal(x.supplier_id,'sup-1');assert.equal(x.min_qty,0);assert.equal(x.category,'Kraft');
});
test('bloqueia campos de produto inválidos',()=>{
 for(const patch of [{name:'x'},{sku:' '},{price:'-1'},{cost:'10,001'},{min:'-1'},{min:'2.5'}]){
  assert.throws(()=>productPayload(product(patch)),JSON.stringify(patch));
 }
});

test('normaliza cadastro de cliente e não adiciona categoria',()=>{
 assert.deepEqual(partyPayload({name:'  Maria  Silva ',doc:' 123 ',phone:' (83) 999 ',email:' M@site.com '},false),{
 name:'Maria Silva',doc:'123',phone:'(83) 999',email:'M@site.com'
 });
});
test('categoriza fornecedor',()=>{
 assert.equal(partyPayload({name:' Distribuidora X ',doc:'',phone:'',email:'',category:' Embalagens '},true).category,'Embalagens');
});
test('rejeita e-mail malformado',()=>assert.throws(()=>partyPayload({name:'Empresa',doc:'',phone:'',email:'mail-sem-arroba'},false)));
test('rejeita documentos e telefones longos',()=>{
 for(const patch of [{doc:'x'.repeat(21)},{phone:'x'.repeat(41)}])assert.throws(()=>partyPayload({name:'Empresa',doc:'',phone:'',email:'',...patch},false));
});

test('entrada aumenta saldo e saída retorna delta negativo',()=>{
 assert.equal(movementDelta('5',10,'Entrada'),5);
 assert.equal(movementDelta('5',10,'Saída'),-5);
});
test('saída pode zerar estoque',()=>assert.equal(movementDelta('10',10,'Saída'),-10));
test('bloqueia saída maior que saldo',()=>assert.throws(()=>movementDelta('11',10,'Saída')));
test('bloqueia estoque negativo e entrada acima do limite',()=>{
 assert.throws(()=>movementDelta('1',-1,'Entrada'));
 assert.throws(()=>movementDelta('2',2147483647,'Entrada'));
});
test('bloqueia quantidades inválidas e não inteiras',()=>{
 for(const n of ['0','-1','1.5','abc','Infinity',''])assert.throws(()=>movementDelta(n,10,'Entrada'));
});

test('monta orçamento válido com itens e desconto',()=>{
 assert.deepEqual(validateQuoteDraft('c1',[item('p1','2'),item('p2','3')],'2,25',products,customers),{
  customerId:'c1',discountCents:225,items:[{product_id:'p1',quantity:2},{product_id:'p2',quantity:3}]
 });
});
test('rejeita cliente não selecionado',()=>assert.throws(()=>validateQuoteDraft('',[item()],'0',products,customers)));
test('rejeita cliente arquivado',()=>assert.throws(()=>validateQuoteDraft('c2',[item()],'0',products,customers)));
test('rejeita produto desconhecido',()=>assert.throws(()=>validateQuoteDraft('c1',[item('missing')],'0',products,customers)));
test('rejeita produto arquivado',()=>assert.throws(()=>validateQuoteDraft('c1',[item('p3')],'0',products,customers)));
test('rejeita produtos repetidos',()=>assert.throws(()=>validateQuoteDraft('c1',[item(),item()],'0',products,customers)));
test('rejeita orçamento vazio ou mais de 100 itens',()=>{
 assert.throws(()=>validateQuoteDraft('c1',[],'0',products,customers));
 assert.throws(()=>validateQuoteDraft('c1',Array.from({length:101},()=>item()),'0',products,customers));
});
test('rejeita quantidade zero, decimal ou acima do limite',()=>{
 for(const quantity of ['0','1.2','10000000'])assert.throws(()=>validateQuoteDraft('c1',[item('p1',quantity)],'0',products,customers));
});
test('rejeita desconto que ultrapassa subtotal',()=>assert.throws(()=>validateQuoteDraft('c1',[item('p1','1')],'12,51',products,customers)));

test('conversão de proposta em pedido exige aprovação e ausência de pedido',()=>{
 assert.equal(quoteCanBecomeOrder('Aprovado',false),true);
 for(const status of ['Rascunho','Enviado','Recusado'])assert.equal(quoteCanBecomeOrder(status,false),false);
 assert.equal(quoteCanBecomeOrder('Aprovado',true),false);
});
test('indicadores de estoque ignoram arquivados e reconhecem baixo saldo',()=>{
 const s=inventoryStats([
 {qty:2,min:3,cost:12},{qty:10,min:2,cost:5},{qty:100,min:120,cost:999,archivedAt:'date'}
 ]);
 assert.deepEqual(s,{activeProducts:2,lowStock:1,inventoryCost:74});
});
test('indicadores vazios começam em zero',()=>assert.deepEqual(inventoryStats([]),{activeProducts:0,lowStock:0,inventoryCost:0}));

test('exibe erro de API sem perder a mensagem original',()=>{
 assert.equal(errorMessage({message:'Falha simulada no servidor'},'Erro padrão'),'Falha simulada no servidor');
 assert.equal(errorMessage(new Error('Erro de conexão'),'Erro padrão'),'Erro de conexão');
 assert.equal(errorMessage(null,'Erro padrão'),'Erro padrão');
});
