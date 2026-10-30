import test from 'node:test';
import assert from 'node:assert/strict';
import {
 normalizeName,validateSku,nonnegativeInteger,positiveInteger,productPayload,partyPayload,
 movementDelta,validateQuoteDraft,quoteCanBecomeOrder,inventoryStats,errorMessage,
 optionalDecimal,optionalCents,bagSpecLabel,productMargin,movementPayload,validateDeliveryDate
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
 assert.deepEqual(productPayload(product()),{name:'Caixa de papelão',sku:'PAP-1',category:'Outros',cost_cents:205,price_cents:699,min_qty:4,supplier_id:null,
 model:'',width_cm:null,height_cm:null,gusset_cm:null,thickness_mm:null});
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
 name:'Maria Silva',doc:'123',phone:'(83) 999',email:'M@site.com',address:''
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
  customerId:'c1',discountCents:225,items:[{product_id:'p1',quantity:2},{product_id:'p2',quantity:3}],
  freightCents:0,deliveryDate:null,paymentTerms:''
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

test('produto aceita modelo e medidas de sacola com vírgula decimal',()=>{
 const x=productPayload(product({model:'  Boca de  palhaço ',width:'30',height:'40,5',gusset:'0',thickness:'0,010'}));
 assert.deepEqual([x.model,x.width_cm,x.height_cm,x.gusset_cm,x.thickness_mm],['Boca de palhaço',30,40.5,0,0.01]);
});
test('rejeita medidas de sacola inválidas',()=>{
 for(const patch of [{width:'0'},{height:'-3'},{width:'1,25'},{thickness:'0,00001'},{thickness:'10'},{model:'x'.repeat(81)}]){
  assert.throws(()=>productPayload(product(patch)),JSON.stringify(patch));
 }
});
test('decimal opcional vazio vira nulo e respeita zero permitido',()=>{
 assert.equal(optionalDecimal('  ','X',1,10),null);
 assert.equal(optionalDecimal(undefined,'X',1,10),null);
 assert.equal(optionalDecimal('0','X',1,10,true),0);
 assert.throws(()=>optionalDecimal('0','X',1,10));
});
test('centavos opcionais',()=>{
 assert.equal(optionalCents(''),null);
 assert.equal(optionalCents(undefined),null);
 assert.equal(optionalCents('43,00'),4300);
 assert.throws(()=>optionalCents('4,001'));
});
test('cliente e fornecedor guardam endereço; fornecedor guarda preço por kg',()=>{
 assert.equal(partyPayload({name:'Loja',doc:'',phone:'',email:'',address:'  Rua A,   10 '},false).address,'Rua A, 10');
 const s=partyPayload({name:'Tecnoplast',doc:'',phone:'',email:'',pricePerKg:'43'},true);
 assert.equal(s.price_per_kg_cents,4300);
 assert.equal(partyPayload({name:'Tecnoplast',doc:'',phone:'',email:''},true).price_per_kg_cents,null);
 assert.equal('price_per_kg_cents' in partyPayload({name:'Loja',doc:'',phone:'',email:'',pricePerKg:'1'},false),false);
 assert.throws(()=>partyPayload({name:'Loja',doc:'',phone:'',email:'',address:'x'.repeat(201)},false));
});
test('descreve medidas da sacola',()=>{
 assert.equal(bagSpecLabel({width:30,height:40,thickness:0.01,model:'Boca de palhaço'}),'30 × 40 cm · 0,010 mm · Boca de palhaço');
 assert.equal(bagSpecLabel({width:24,height:36,gusset:9}),'24 × 36 × 9 cm');
 assert.equal(bagSpecLabel({width:22.5,height:30}),'22,5 × 30 cm');
 assert.equal(bagSpecLabel({width:30,height:null,thickness:null,model:''}),'');
});
test('calcula lucro bruto e margem como na aba PRODUTOS',()=>{
 assert.deepEqual(productMargin(48,99),{profitCents:51,marginPct:51.5});
 assert.deepEqual(productMargin(100,0),{profitCents:-100,marginPct:null});
});
test('entrada leva custo e fornecedor; saída descarta ambos',()=>{
 assert.deepEqual(movementPayload({productId:'p1',quantity:'500',note:' Compra ',unitCost:'0,19',supplierId:'s1'},0,'Entrada'),
  {p_product_id:'p1',p_delta:500,p_note:'Compra',p_unit_cost_cents:19,p_supplier_id:'s1'});
 assert.deepEqual(movementPayload({productId:'p1',quantity:'5',note:'',unitCost:'1',supplierId:'s1'},10,'Saída'),
  {p_product_id:'p1',p_delta:-5,p_note:'',p_unit_cost_cents:null,p_supplier_id:null});
 assert.equal(movementPayload({productId:'p1',quantity:'1',note:''},0,'Entrada').p_unit_cost_cents,null);
 assert.throws(()=>movementPayload({productId:'p1',quantity:'1',note:'',unitCost:'abc'},0,'Entrada'));
});
test('valida data de entrega',()=>{
 assert.equal(validateDeliveryDate('','2026-10-29'),null);
 assert.equal(validateDeliveryDate('2026-10-29','2026-10-29'),'2026-10-29');
 for(const d of ['2026-10-28','29/10/2026','2026-13-45'])assert.throws(()=>validateDeliveryDate(d,'2026-10-29'),d);
});
test('orçamento inclui frete, entrega e forma de pagamento',()=>{
 const x=validateQuoteDraft('c1',[item('p1','2')],'0',products,customers,{freight:'15,00',deliveryDate:'2026-11-20',paymentTerms:' 50% entrada ',today:'2026-10-29'});
 assert.deepEqual([x.freightCents,x.deliveryDate,x.paymentTerms],[1500,'2026-11-20','50% entrada']);
 assert.throws(()=>validateQuoteDraft('c1',[item()],'0',products,customers,{freight:'-1'}));
 assert.throws(()=>validateQuoteDraft('c1',[item()],'0',products,customers,{paymentTerms:'x'.repeat(501)}));
 assert.throws(()=>validateQuoteDraft('c1',[item()],'0',products,customers,{deliveryDate:'2020-01-01',today:'2026-10-29'}));
});

test('orçamento aceita sacola calculada como item personalizado',async()=>{
 const {validateQuoteDraft}=await import('../src/lib/domain.ts');
 const customers=[{id:'c1'}];const products=[{id:'p1',price:12}];
 const draft=validateQuoteDraft('c1',[{description:'  Sacola   30x40 ',quantity:'700',lineTotalCents:86527},{productId:'p1',quantity:'3'}],'5,00',products,customers,{today:'2026-10-30'});
 assert.deepEqual(draft.items,[{description:'Sacola 30x40',quantity:700,line_total_cents:86527},{product_id:'p1',quantity:3}]);
 assert.throws(()=>validateQuoteDraft('c1',[{description:'X',quantity:'1',lineTotalCents:100}],'0',products,customers),/Descrição/);
 assert.throws(()=>validateQuoteDraft('c1',[{description:'x'.repeat(201),quantity:'1',lineTotalCents:100}],'0',products,customers),/Descrição/);
 for(const v of [0,-5,1.5,1e13])assert.throws(()=>validateQuoteDraft('c1',[{description:'Sacola',quantity:'1',lineTotalCents:v}],'0',products,customers),/Valor do item/);
 assert.throws(()=>validateQuoteDraft('c1',[{description:'Sacola',quantity:'0',lineTotalCents:100}],'0',products,customers),/Quantidade/);
 // Desconto considera o total exato da linha.
 assert.throws(()=>validateQuoteDraft('c1',[{description:'Sacola',quantity:'700',lineTotalCents:86527}],'865,28',products,customers),/Desconto maior/);
});
