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

export function productPayload(data:{name:string;sku:string;category:string;cost:string;price:string;min:string;supplierId:string}){
 return {
  name:normalizeName(data.name,'Nome do produto'),
  sku:validateSku(data.sku),
  category:data.category.trim()||'Outros',
  cost_cents:toCents(data.cost),
  price_cents:toCents(data.price),
  min_qty:nonnegativeInteger(data.min,'Estoque mínimo'),
  supplier_id:data.supplierId||null
 };
}

export function partyPayload(data:{name:string;doc:string;phone:string;email:string;category?:string},isSupplier:boolean){
 const email=data.email.trim();
 if(email&&!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))throw new Error('E-mail inválido.');
 const doc=data.doc.trim(),phone=data.phone.trim();
 if(doc.length>20||phone.length>40)throw new Error('Documento ou telefone muito longo.');
 return {
  name:normalizeName(data.name,'Nome'),
  doc,
  phone,
  email,
  ...(isSupplier?{category:(data.category||'').trim()}:{})
 };
}

export function movementDelta(raw:string,stock:number,direction:'Entrada'|'Saída'){
 const quantity=positiveInteger(raw,'Quantidade');
 if(!Number.isSafeInteger(stock)||stock<0)throw new Error('Saldo atual inválido.');
 if(direction==='Saída'&&quantity>stock)throw new Error('Quantidade maior que o estoque disponível.');
 if(direction==='Entrada'&&quantity>2147483647-stock)throw new Error('Saldo excede o limite.');
 return direction==='Entrada'?quantity:-quantity;
}

export type QuoteDraftLine={productId:string;quantity:string};
export function validateQuoteDraft(customerId:string,lines:QuoteDraftLine[],discount:string,products:{id:string;price:number;archivedAt?:string|null}[],customers:{id:string;archivedAt?:string|null}[]){
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
 quoteTotals(mapped.map(x=>({quantity:x.quantity,unitPriceCents:x.unitPriceCents})),discountCents);
 return {customerId,items:mapped.map(x=>({product_id:x.product_id,quantity:x.quantity})),discountCents};
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
