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
