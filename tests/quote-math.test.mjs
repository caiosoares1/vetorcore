import test from 'node:test';
import assert from 'node:assert/strict';
import {toCents,quoteTotals,fmtCents} from '../src/lib/quoteMath.ts';

test('converte reais em centavos sem erros de float',()=>{
 assert.equal(toCents('5,99'),599);
 assert.equal(toCents('0.01'),1);
 assert.equal(toCents('100'),10000);
});
test('recusa dinheiro inválido',()=>{
 for (const value of ['-1','abc','1.999','','1,234','1e3'])assert.throws(()=>toCents(value));
});
test('calcula subtotal e total com desconto',()=>{
 assert.deepEqual(quoteTotals([{quantity:3,unitPriceCents:1299},{quantity:2,unitPriceCents:430}],700),{subtotal:4757,total:4057});
});
test('recusa desconto superior ao subtotal',()=>{assert.throws(()=>quoteTotals([{quantity:1,unitPriceCents:100}],101));});
test('recusa itens com quantidade inválida',()=>{assert.throws(()=>quoteTotals([{quantity:-1,unitPriceCents:100}],0));});

test('formata centavos em moeda brasileira',()=>{
 assert.match(fmtCents(123456),/1\.234,56/);
 assert.match(fmtCents(0),/0,00/);
});
test('permite orçamento sem desconto e sem itens somente na função aritmética',()=>{
 assert.deepEqual(quoteTotals([],0),{subtotal:0,total:0});
});
test('rejeita desconto negativo',()=>{
 assert.throws(()=>quoteTotals([{quantity:1,unitPriceCents:100}],-1));
});
test('rejeita preço unitário negativo, fracionário e subtotal fora do limite',()=>{
 assert.throws(()=>quoteTotals([{quantity:1,unitPriceCents:-1}],0));
 assert.throws(()=>quoteTotals([{quantity:1,unitPriceCents:1.2}],0));
 assert.throws(()=>quoteTotals([{quantity:999999999,unitPriceCents:Number.MAX_SAFE_INTEGER}],0));
});
test('frete soma ao total e não entra no limite do desconto',()=>{
 assert.deepEqual(quoteTotals([{quantity:2,unitPriceCents:1000}],500,1500),{subtotal:2000,total:3000});
 assert.throws(()=>quoteTotals([{quantity:1,unitPriceCents:100}],0,-1));
 assert.throws(()=>quoteTotals([{quantity:1,unitPriceCents:100}],0,1.5));
 assert.throws(()=>quoteTotals([{quantity:1,unitPriceCents:100}],0,Number.MAX_SAFE_INTEGER));
});

test('linha com total exato (sacola calculada) usa o total, não quantidade × unitário',async()=>{
 const {lineTotal}=await import('../src/lib/quoteMath.ts');
 assert.equal(lineTotal({quantity:1000,unitPriceCents:99,lineTotalCents:98887}),98887);
 assert.equal(lineTotal({quantity:3,unitPriceCents:1200}),3600);
 assert.equal(lineTotal({quantity:3,unitPriceCents:1200,lineTotalCents:null}),3600);
 assert.deepEqual(quoteTotals([{quantity:700,unitPriceCents:124,lineTotalCents:86527},{quantity:3,unitPriceCents:1200}],500,1500),{subtotal:90127,total:91127});
 for(const bad of [-1,1.5,Number.MAX_SAFE_INTEGER+1])assert.throws(()=>lineTotal({quantity:1,unitPriceCents:1,lineTotalCents:bad}),/Item inválido/);
 assert.throws(()=>lineTotal({quantity:Number.MAX_SAFE_INTEGER,unitPriceCents:2}),/limite/);
});

test('valor unitário: produto do catálogo usa o preço em centavos',async()=>{
 const {unitPriceLabel}=await import('../src/lib/quoteMath.ts');
 assert.equal(unitPriceLabel({quantity:1000,unitPriceCents:42}),fmtCents(42));
 assert.equal(unitPriceLabel({quantity:3,unitPriceCents:1200,lineTotalCents:null}),fmtCents(1200));
});
test('valor unitário: sacola calculada mostra até 4 casas quando não fecha em centavos',async()=>{
 const {unitPriceLabel}=await import('../src/lib/quoteMath.ts');
 const nbsp=s=>s.replace(/\s/g,' ');
 assert.equal(nbsp(unitPriceLabel({quantity:1000,unitPriceCents:99,lineTotalCents:98887})),'R$ 0,9889');
 assert.equal(nbsp(unitPriceLabel({quantity:500,unitPriceCents:150,lineTotalCents:75000})),'R$ 1,50');
 assert.equal(nbsp(unitPriceLabel({quantity:3,unitPriceCents:33,lineTotalCents:100})),'R$ 0,3333');
 assert.throws(()=>unitPriceLabel({quantity:0,unitPriceCents:1,lineTotalCents:1}));
});
