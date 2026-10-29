import test from 'node:test';
import assert from 'node:assert/strict';
import {toCents,quoteTotals} from '../src/lib/quoteMath.ts';

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
