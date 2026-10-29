import {toCents,quoteTotals} from './quoteMath.ts';

export function normalizeName(value:string,field='Nome'):string {
 const cleaned=value.trim().replace(/\s+/g,' ');
 if(cleaned.length<2)throw new Error(field+' deve ter pelo menos 2 caracteres.');
 if(cleaned.length>150)throw new Error(field+' muito longo.');
 return cleaned;
}

export function validateSku(raw:string):string {
 const sku=raw.trim();
 if(!sku)throw new Error('Informe o código do produto.');
 if(sku.length>50)throw new Error('Código do produto muito longo.');
 return sku;
}

export function nonnegativeInteger(raw:string,field:string):number {
 const value=raw.trim();
 if(!/^\d+$/.test(value))throw new Error(field+' deve ser um inteiro não negativo.');
 const number=Number(value);
 if(!Number.isSafeInteger(number)||number>2147483647)throw new Error(field+' fora do limite.');
 return number;
}

export function positiveInteger(raw:string,field:string):number {
 const n=nonnegativeInteger(raw,field);
 if(!n)throw new Error(field+' deve ser maior que zero.');
 return n;
}

export function optionalDecimal(raw:string|undefined,field:string,maxDecimals:number,max:number,allowZero=false):number|null {
 const value=(raw||'').trim().replace(',','.');
 if(!value)return null;
 if(!new RegExp('^\\d+(?:\\.\\d{1,'+maxDecimals+'})?$').test(value))throw new Error(field+' inválido: use até '+maxDecimals+' casas decimais.');
 const number=Number(value);
 if(number>=max)throw new Error(field+' fora do limite.');
 if(!allowZero&&number===0)throw new Error(field+' deve ser maior que zero.');
 return number;
}

export const optionalCents=(raw:string|undefined)=>(raw||'').trim()?toCents(raw||''):null;

export type BagSpec={model?:string;width?:string;height?:string;gusset?:string;thickness?:string};
export function productPayload(data:{name:string;sku:string;category:string;cost:string;price:string;min:string;supplierId:string}&BagSpec){
 const model=(data.model||'').trim().replace(/\s+/g,' ');
 if(model.length>80)throw new Error('Modelo muito longo.');
 return {
  name:normalizeName(data.name,'Nome do produto'),
  sku:validateSku(data.sku),
  category:data.category.trim()||'Outros',
  cost_cents:toCents(data.cost),
  price_cents:toCents(data.price),
  min_qty:nonnegativeInteger(data.min,'Estoque mínimo'),
  supplier_id:data.supplierId||null,
  model,
  width_cm:optionalDecimal(data.width,'Largura',1,100000),
  height_cm:optionalDecimal(data.height,'Altura',1,100000),
  gusset_cm:optionalDecimal(data.gusset,'Sanfona',1,100000,true),
  thickness_mm:optionalDecimal(data.thickness,'Espessura',4,10)
 };
}

export function partyPayload(data:{name:string;doc:string;phone:string;email:string;address?:string;category?:string;pricePerKg?:string},isSupplier:boolean){
 const email=data.email.trim();
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('E-mail inválido.');
 const doc=data.doc.trim(),phone=data.phone.trim(),address=(data.address||'').trim().replace(/\s+/g,' ');
 if(doc.length>20||phone.length>40)throw new Error('Documento ou telefone muito longo.');
 if(address.length>200)throw new Error('Endereço muito longo.');
 return {
  name:normalizeName(data.name,'Nome'),
  doc,
  phone,
  email,
  address,
  ...(isSupplier?{category:(data.category||'').trim(),price_per_kg_cents:optionalCents(data.pricePerKg)}:{})
 };
}

const fmtNumber=(n:number,digits:number)=>n.toLocaleString('pt-BR',{minimumFractionDigits:digits,maximumFractionDigits:digits});
export function bagSpecLabel(p:{model?:string;width?:number|null;height?:number|null;gusset?:number|null;thickness?:number|null}):string{
 const size=p.width&&p.height?[p.width,p.height,...(p.gusset?[p.gusset]:[])].map(n=>fmtNumber(n,Number.isInteger(n)?0:1)).join(' × ')+' cm':'';
 const thickness=p.thickness?fmtNumber(p.thickness,3)+' mm':'';
 return [size,thickness,(p.model||'').trim()].filter(Boolean).join(' · ');
}

export function productMargin(costCents:number,priceCents:number){
 const profitCents=priceCents-costCents;
 return {profitCents,marginPct:priceCents>0?Math.round(profitCents*1000/priceCents)/10:null};
}

export function movementDelta(raw:string,stock:number,direction:'Entrada'|'Saída'){
 const quantity=positiveInteger(raw,'Quantidade');
 if(!Number.isSafeInteger(stock)||stock<0)throw new Error('Saldo atual inválido.');
 if(direction==='Saída'&&quantity>stock)throw new Error('Quantidade maior que o estoque disponível.');
 if(direction==='Entrada'&&quantity>2147483647-stock)throw new Error('Saldo excede o limite.');
 return direction==='Entrada'?quantity:-quantity;
}

export function movementPayload(data:{productId:string;quantity:string;note:string;unitCost?:string;supplierId?:string},stock:number,direction:'Entrada'|'Saída'){
 const delta=movementDelta(data.quantity,stock,direction);
 const isEntry=direction==='Entrada';
 return {
  p_product_id:data.productId,
  p_delta:delta,
  p_note:data.note.trim(),
  p_unit_cost_cents:isEntry?optionalCents(data.unitCost):null,
  p_supplier_id:isEntry&&data.supplierId?data.supplierId:null
 };
}

export function validateDeliveryDate(raw:string,today:string):string|null{
 const value=raw.trim();
 if(!value)return null;
 if(!/^\d{4}-\d{2}-\d{2}$/.test(value)||Number.isNaN(Date.parse(value+'T00:00:00Z')))throw new Error('Data de entrega inválida.');
 if(value<today)throw new Error('A data de entrega não pode estar no passado.');
 return value;
}

export type QuoteDraftLine={productId:string;quantity:string};
export type QuoteExtras={freight?:string;deliveryDate?:string;paymentTerms?:string;today?:string};
export function validateQuoteDraft(customerId:string,lines:QuoteDraftLine[],discount:string,products:{id:string;price:number;archivedAt?:string|null}[],customers:{id:string;archivedAt?:string|null}[],extras:QuoteExtras={}){
 if(!customers.some(c=>c.id===customerId&&!c.archivedAt))throw new Error('Selecione um cliente ativo.');
 if(lines.length===0||lines.length>100)throw new Error('Informe de 1 a 100 itens.');
 const used=new Set<string>();
 const mapped=lines.map((line)=>{
  const product=products.find(p=>p.id===line.productId&&!p.archivedAt);
  if(!product)throw new Error('Selecione um produto ativo.');
  if(used.has(product.id))throw new Error('Um produto não pode aparecer duas vezes no mesmo orçamento.');
  used.add(product.id);
  const quantity=positiveInteger(line.quantity,'Quantidade');
  if(quantity>9999999)throw new Error('Quantidade acima do limite do orçamento.');
  return {product_id:product.id,quantity,unitPriceCents:Math.round(product.price*100)};
 });
 const discountCents=toCents(discount);
 const freightCents=optionalCents(extras.freight)??0;
 const paymentTerms=(extras.paymentTerms||'').trim();
 if(paymentTerms.length>500)throw new Error('Forma de pagamento muito longa.');
 const deliveryDate=validateDeliveryDate(extras.deliveryDate||'',extras.today||new Date().toISOString().slice(0,10));
 quoteTotals(mapped.map(x=>({quantity:x.quantity,unitPriceCents:x.unitPriceCents})),discountCents,freightCents);
 return {customerId,items:mapped.map(x=>({product_id:x.product_id,quantity:x.quantity})),discountCents,freightCents,deliveryDate,paymentTerms};
}

export function quoteCanBecomeOrder(status:string,alreadyConverted:boolean):boolean {
 return status==='Aprovado'&&!alreadyConverted;
}

export function inventoryStats(products:{qty:number;min:number;cost:number;archivedAt?:string|null}[]){
 const active=products.filter(p=>!p.archivedAt);
 return {
  activeProducts:active.length,
  lowStock:active.filter(p=>p.qty<=p.min).length,
  inventoryCost:active.reduce((sum,p)=>sum+p.qty*p.cost,0)
 };
}

export function errorMessage(error:unknown,fallback:string):string{
 if(error instanceof Error)return error.message;
 if(error&&typeof error==='object'&&'message' in error&&typeof error.message==='string')return error.message;
 return fallback;
}
