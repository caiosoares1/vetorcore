// Preço de sacolas plásticas impressas, reproduzindo a planilha
// docs/planilhas/tabela-sacolas-plasticas-2026.xlsx (ver docs/planilhas/tabela-sacolas-2026.md).
//
// Preço do milheiro = custo de impressão por mil (Plan1) + material por mil com margem (Plan2).
// Lotes menores (500, 250, 125, 60) = lote anterior ÷ 1,6 (Plan3).
// Quantidade qualquer = preço do maior lote que caiba na quantidade ÷ tamanho do lote × quantidade
// (ex.: 3.000 = milheiro × 3; 700 = lote de 500 ÷ 500 × 700).

export type PrintCosts={
 /** Salário mensal usado no rateio da mão de obra (R$). */
 laborMonthly:number;
 /** Horas de máquina para imprimir 1.000 sacolas. */
 hoursPerThousand:number;
 /** Tinta por mil (R$). */
 ink:number;
 /** Solvente por mil (R$). */
 solvent:number;
 /** Energia por hora de máquina (R$). */
 energyPerHour:number;
 /** Adicional de energia cobrado só na impressão de 1 cor, como na planilha (R$). */
 oneColorExtra:number;
};

/** Valores da planilha 2026 (Plan1). */
export const DEFAULT_PRINT_COSTS:PrintCosts={laborMonthly:3500,hoursPerThousand:2,ink:140,solvent:1,energyPerHour:1.2,oneColorExtra:4};
/** Margem aplicada sobre o preço do material: preço = custo ÷ (1 − margem). */
export const DEFAULT_MARGIN=0.35;
export const LOT_SIZES=[1000,500,250,125,60] as const;
export const LOT_DIVISOR=1.6;
export const MAX_COLORS=4;

export type BagModel='Alça C / boca de palhaço'|'Camiseta';
export type BagPreset={id:string;model:BagModel;width:number;height:number;thickness:number};
const preset=(model:BagModel,width:number,height:number,thickness:number):BagPreset=>({id:(model==='Camiseta'?'cam':'alc')+'-'+width+'x'+height,model,width,height,thickness});
/** Tamanhos da planilha, com a espessura usada no cálculo de cada linha (referência; varia por fornecedor). */
export const BAG_PRESETS:BagPreset[]=[
 preset('Alça C / boca de palhaço',17,24,0.011),
 preset('Alça C / boca de palhaço',15,25,0.01),
 preset('Alça C / boca de palhaço',20,30,0.01),
 preset('Alça C / boca de palhaço',25,35,0.01),
 preset('Alça C / boca de palhaço',30,40,0.011),
 preset('Alça C / boca de palhaço',30,45,0.01),
 preset('Alça C / boca de palhaço',35,50,0.01),
 preset('Alça C / boca de palhaço',40,50,0.01),
 preset('Alça C / boca de palhaço',40,60,0.01),
 preset('Alça C / boca de palhaço',45,60,0.01),
 preset('Camiseta',30,32,0.006),
 preset('Camiseta',30,45,0.006),
 preset('Camiseta',40,50,0.006),
 preset('Camiseta',40,60,0.006),
 preset('Camiseta',50,70,0.005),
 preset('Camiseta',60,80,0.005),
 preset('Camiseta',45,60,0.006)
];

export type BagQuoteInput={
 width:number;height:number;thickness:number;pricePerKg:number;colors:number;quantity:number;
 margin?:number;costs?:PrintCosts;
};
export type BagQuote={
 kgPerThousand:number;printPerThousand:number;materialPerThousand:number;
 lots:{size:number;price:number}[];
 appliedLot:number;belowMinimumLot:boolean;
 unitPrice:number;total:number;totalCents:number;
};

function positive(value:number,field:string,max:number){
 if(!Number.isFinite(value)||value<=0)throw new Error(field+' deve ser maior que zero.');
 if(value>max)throw new Error(field+' fora do limite.');
}

/** Custo de impressão de 1.000 sacolas (Plan1 C10:C13). */
export function printCostPerThousand(colors:number,costs:PrintCosts=DEFAULT_PRINT_COSTS):number{
 if(!Number.isInteger(colors)||colors<1||colors>MAX_COLORS)throw new Error('Número de cores deve ser de 1 a '+MAX_COLORS+'.');
 const hours=costs.hoursPerThousand;
 const base=costs.laborMonthly/30/8*hours+costs.ink+costs.solvent+costs.energyPerHour*hours;
 return colors===1?base+costs.oneColorExtra:base*colors;
}

/** Peso de 1.000 sacolas em kg: largura (cm) × altura (cm) × espessura (mm). */
export const kgPerThousand=(width:number,height:number,thickness:number)=>width*height*thickness;

/** Material de 1.000 sacolas com margem (Plan2 G): kg × R$/kg ÷ (1 − margem). */
export function materialPerThousand(width:number,height:number,thickness:number,pricePerKg:number,margin=DEFAULT_MARGIN):number{
 positive(width,'Largura',500);positive(height,'Altura',500);positive(thickness,'Espessura',1);positive(pricePerKg,'Preço por kg',100000);
 if(!Number.isFinite(margin)||margin<0||margin>=1)throw new Error('Margem deve ser de 0% a menos de 100%.');
 return kgPerThousand(width,height,thickness)*pricePerKg/(1-margin);
}

/** Lote usado para uma quantidade: o maior lote que caiba nela (ou o menor lote, abaixo dele). */
export function lotFor(quantity:number):number{
 if(!Number.isSafeInteger(quantity)||quantity<1)throw new Error('Quantidade deve ser um inteiro maior que zero.');
 return LOT_SIZES.find(size=>quantity>=size)??LOT_SIZES[LOT_SIZES.length-1];
}

export function bagQuote(input:BagQuoteInput):BagQuote{
 const margin=input.margin??DEFAULT_MARGIN;
 const costs=input.costs??DEFAULT_PRINT_COSTS;
 const appliedLot=lotFor(input.quantity);
 const printPerThousand=printCostPerThousand(input.colors,costs);
 const material=materialPerThousand(input.width,input.height,input.thickness,input.pricePerKg,margin);
 const lots:{size:number;price:number}[]=[];
 let price=printPerThousand+material;
 for(const size of LOT_SIZES){lots.push({size,price});price/=LOT_DIVISOR;}
 const lotPrice=lots.find(l=>l.size===appliedLot)!.price;
 const unitPrice=lotPrice/appliedLot;
 const total=unitPrice*input.quantity;
 return {
  kgPerThousand:kgPerThousand(input.width,input.height,input.thickness),
  printPerThousand,materialPerThousand:material,lots,appliedLot,
  belowMinimumLot:input.quantity<LOT_SIZES[LOT_SIZES.length-1],
  unitPrice,total,totalCents:Math.round(total*100)
 };
}
