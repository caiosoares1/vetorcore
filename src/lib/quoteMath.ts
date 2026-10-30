/** Item de orçamento. lineTotalCents, quando presente, é o total exato da linha (sacola calculada, unitário com mais de 2 casas). */
export type LinePrice={quantity:number;unitPriceCents:number;lineTotalCents?:number|null};
/** Total de uma linha em centavos: total exato informado ou quantidade × unitário. */
export function lineTotal(item:LinePrice):number{
 if(!Number.isSafeInteger(item.quantity)||item.quantity<=0||!Number.isSafeInteger(item.unitPriceCents)||item.unitPriceCents<0)throw new Error('Item inválido.');
 if(item.lineTotalCents!=null){
  if(!Number.isSafeInteger(item.lineTotalCents)||item.lineTotalCents<0)throw new Error('Item inválido.');
  return item.lineTotalCents;
 }
 const total=item.quantity*item.unitPriceCents;
 if(!Number.isSafeInteger(total))throw new Error('Total acima do limite.');
 return total;
}
export function toCents(raw:string):number{
 const normalized=raw.trim().replace(',','.');
 if(!/^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/.test(normalized))throw new Error('Valor inválido: use até duas casas decimais.');
 const [units,decimals='']=normalized.split('.');
 const cents=Number(units)*100+Number(decimals.padEnd(2,'0'));
 if(!Number.isSafeInteger(cents))throw new Error('Valor acima do limite.');
 return cents;
}
export function quoteTotals(items:LinePrice[],discountCents:number,freightCents=0){
 if(!Number.isSafeInteger(discountCents)||discountCents<0)throw new Error('Desconto inválido.');
 if(!Number.isSafeInteger(freightCents)||freightCents<0)throw new Error('Frete inválido.');
 const subtotal=items.reduce((sum,item)=>{
  const next=sum+lineTotal(item);
  if(!Number.isSafeInteger(next))throw new Error('Total acima do limite.');
  return next;
 },0);
 if(discountCents>subtotal)throw new Error('Desconto maior que o subtotal.');
 const total=subtotal-discountCents+freightCents;
 if(!Number.isSafeInteger(total))throw new Error('Total acima do limite.');
 return {subtotal,total};
}
export const fmtCents=(cents:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
