import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {bagQuote,printCostPerThousand,materialPerThousand,lotFor,kgPerThousand,BAG_PRESETS,LOT_SIZES,MATERIAL_SUPPLIERS,DEFAULT_MATERIAL_SUPPLIER} from '../src/lib/bagPricing.ts';

// Parâmetros vigentes quando a fórmula foi transcrita (out/2026). Ficam fixos aqui de propósito:
// os padrões do código podem mudar (tinta, mão de obra, margem…) sem quebrar esta conferência da fórmula.
const PARAMS_2026={costs:{laborMonthly:3500,hoursPerThousand:2,ink:140,solvent:1,energyPerHour:1.2,oneColorExtra:4},margin:0.35,pricePerKg:40};

// 340 preços de referência calculados com PARAMS_2026 (tabela de 2026, já validada pela operação).
const rows=readFileSync(new URL('./fixtures/tabela-sacolas-2026-precos.csv',import.meta.url),'utf8').trim().split('\n').slice(1).map(line=>{
 const [model,size,thickness,quantity,colors,price]=line.split(',');
 const [width,height]=size.split('x').map(Number);
 return {model,width,height,thickness:Number(thickness),quantity:Number(quantity),colors:Number(colors),cents:Math.round(Number(price)*100)};
});

test('a fórmula reproduz exatamente os 340 preços de referência de 2026',()=>{
 assert.equal(rows.length,340);
 for(const r of rows){
  const q=bagQuote({width:r.width,height:r.height,thickness:r.thickness,colors:r.colors,quantity:r.quantity,...PARAMS_2026});
  assert.equal(q.totalCents,r.cents,`${r.model} ${r.width}x${r.height} ${r.colors} cor(es) ${r.quantity} un.: centavos`);
 }
});

test('custo de impressão por mil, com adicional só em 1 cor',()=>{
 assert.equal(printCostPerThousand(1,PARAMS_2026.costs).toFixed(2),'176.57');
 assert.equal(printCostPerThousand(2,PARAMS_2026.costs).toFixed(2),'345.13');
 assert.equal(printCostPerThousand(4,PARAMS_2026.costs).toFixed(2),'690.27');
 assert.ok(printCostPerThousand(1)>0);
 assert.equal(printCostPerThousand(1,{...PARAMS_2026.costs,ink:200}).toFixed(2),'236.57');
 for(const c of [0,5,1.5,NaN])assert.throws(()=>printCostPerThousand(c),/cores/);
});

test('espessura e preço do kg mudam o preço (Alça C 30x40, 1 cor, 1.000 un.)',()=>{
 const base={...PARAMS_2026,width:30,height:40,colors:1,quantity:1000};
 assert.equal(bagQuote({...base,thickness:0.01}).totalCents,91503);
 assert.equal(bagQuote({...base,thickness:0.011}).totalCents,98887);
 assert.equal(bagQuote({...base,thickness:0.012}).totalCents,106272);
 assert.ok(bagQuote({...base,thickness:0.01,pricePerKg:43}).totalCents>91503);
 assert.ok(Math.abs(kgPerThousand(30,40,0.011)-13.2)<1e-9);
});

test('quantidade: maior lote que cabe ÷ tamanho do lote × quantidade',()=>{
 const base={...PARAMS_2026,width:30,height:40,thickness:0.011,colors:1};
 const milheiro=bagQuote({...base,quantity:1000});
 const lote500=milheiro.lots.find(l=>l.size===500).price;
 assert.equal(bagQuote({...base,quantity:3000}).totalCents,Math.round(milheiro.lots[0].price*3*100));
 const q700=bagQuote({...base,quantity:700});
 assert.equal(q700.appliedLot,500);
 assert.equal(q700.totalCents,Math.round(lote500/500*700*100));
 assert.equal(bagQuote({...base,quantity:1500}).appliedLot,1000);
 assert.deepEqual([999,500,499,250,125,124,60].map(lotFor),[500,500,250,250,125,60,60]);
 const small=bagQuote({...base,quantity:30});
 assert.equal(small.appliedLot,60);
 assert.equal(small.belowMinimumLot,true);
 assert.equal(q700.belowMinimumLot,false);
 for(const n of [0,-1,1.5,NaN])assert.throws(()=>lotFor(n),/Quantidade/);
});

test('lotes menores são o anterior ÷ 1,6',()=>{
 const q=bagQuote({width:20,height:30,thickness:0.01,pricePerKg:40,colors:2,quantity:1000});
 assert.deepEqual(q.lots.map(l=>l.size),[...LOT_SIZES]);
 for(let i=1;i<q.lots.length;i++)assert.ok(Math.abs(q.lots[i-1].price/q.lots[i].price-1.6)<1e-9);
});

test('margem e entradas inválidas são recusadas',()=>{
 assert.ok(Math.abs(materialPerThousand(30,40,0.01,40,0)-480)<1e-9);
 assert.ok(Math.abs(materialPerThousand(30,40,0.01,40)-480/0.65)<1e-9);
 assert.throws(()=>materialPerThousand(0,40,0.01,40),/Largura/);
 assert.throws(()=>materialPerThousand(30,600,0.01,40),/Altura fora do limite/);
 assert.throws(()=>materialPerThousand(30,40,0,40),/Espessura/);
 assert.throws(()=>materialPerThousand(30,40,0.01,-1),/Preço por kg/);
 for(const m of [1,-0.1,NaN])assert.throws(()=>materialPerThousand(30,40,0.01,40,m),/Margem/);
 assert.throws(()=>bagQuote({width:30,height:40,thickness:0.01,pricePerKg:40,colors:1,quantity:1000,margin:1}),/Margem/);
});

test('tamanhos da planilha estão todos cadastrados, sem repetição',()=>{
 assert.equal(BAG_PRESETS.length,17);
 assert.equal(new Set(BAG_PRESETS.map(p=>p.id)).size,17);
 const fromCsv=new Set(rows.map(r=>r.model+r.width+'x'+r.height+r.thickness));
 for(const p of BAG_PRESETS)assert.ok(fromCsv.has(p.model+p.width+'x'+p.height+p.thickness),p.id);
});

test('fornecedores de material de referência e o padrão',()=>{
 assert.deepEqual(MATERIAL_SUPPLIERS.map(s=>s.name+':'+s.pricePerKg),['2 IRMÃO:40','MAIN:40','TECNOPLAST:43','TOTAL MAIS:35']);
 assert.ok(MATERIAL_SUPPLIERS.some(s=>s.id===DEFAULT_MATERIAL_SUPPLIER));
});

test('custos salvos no banco: centavos e % viram reais e fração, e voltam iguais para a RPC',async()=>{
 const {settingsFromRow,settingsToRpc,DEFAULT_SETTINGS}=await import('../src/lib/bagPricing.ts');
 const row={labor_monthly_cents:350000,hours_per_thousand:'2.0000',ink_cents:14000,solvent_cents:100,energy_per_hour_cents:120,one_color_extra_cents:400,margin_pct:'35.00'};
 const s=settingsFromRow(row);
 assert.deepEqual(s,DEFAULT_SETTINGS);
 assert.deepEqual(settingsToRpc(s),{p_labor_monthly_cents:350000,p_hours_per_thousand:2,p_ink_cents:14000,p_solvent_cents:100,p_energy_per_hour_cents:120,p_one_color_extra_cents:400,p_margin_pct:35});
 assert.equal(settingsToRpc({...s,margin:0.3333}).p_margin_pct,33.33);
 assert.throws(()=>settingsFromRow({...row,ink_cents:'abc'}),/tinta/);
 assert.throws(()=>settingsFromRow({...row,margin_pct:-1}),/margem/);
 assert.throws(()=>settingsToRpc({...s,margin:1}),/Margem/);
 assert.throws(()=>settingsToRpc({...s,costs:{...s.costs,hoursPerThousand:0}}),/Horas/);
 assert.throws(()=>settingsToRpc({...s,costs:{...s.costs,ink:-1}}),/Tinta fora do limite/);
 assert.throws(()=>settingsToRpc({...s,costs:{...s.costs,laborMonthly:NaN}}),/Mão de obra/);
});

test('descrição da sacola para o orçamento',async()=>{
 const {bagLineDescription}=await import('../src/lib/bagPricing.ts');
 assert.equal(bagLineDescription({width:30,height:40,thickness:0.011,colors:1},'Alça C / boca de palhaço'),'Sacola alça C / boca de palhaço 30x40 cm, 0,011 mm, 1 cor');
 assert.equal(bagLineDescription({width:40,height:60,thickness:0.006,colors:2},'Camiseta'),'Sacola camiseta 40x60 cm, 0,006 mm, 2 cores');
 assert.equal(bagLineDescription({width:30.5,height:40,thickness:0.0125,colors:4}),'Sacola 30,5x40 cm, 0,0125 mm, 4 cores');
});
