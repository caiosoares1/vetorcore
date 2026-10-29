export type Product={id:string;name:string;sku:string;category:string;cost:number;price:number;qty:number;min:number;supplierId:string};
export type Party={id:string;name:string;doc:string;phone:string;email:string;category?:string};
export type Move={id:string;productId:string;type:'Entrada'|'Saída'|'Ajuste';delta:number;date:string;note:string;responsible:string};
export type QuoteItem={productId:string;name:string;quantity:number;unitPrice:number};
export type Quote={id:string;number:number;customerId:string;date:string;status:'Rascunho'|'Enviado'|'Aprovado'|'Recusado';items:QuoteItem[];discount:number;notes:string};
export type Order={id:string;quoteId:string;number:number;date:string;status:'Em separação'|'Concluído';customerId:string;total:number};
export type Store={products:Product[];suppliers:Party[];customers:Party[];moves:Move[];quotes:Quote[];orders:Order[]};
export const uid=()=>crypto.randomUUID?.()||Math.random().toString(36).slice(2);
export const today=()=>new Date().toISOString().slice(0,10);
export const brl=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);
export const dateBR=(v:string)=>{const x=v.split('-');return x.length===3?x[2]+'/'+x[1]+'/'+x[0]:v};
export const seed:Store={
 suppliers:[{id:'s1',name:'Embalagens São Lucas',doc:'12.345.678/0001-90',phone:'(83) 3333-4511',email:'contato@exemplo.com',category:'Caixas e papelão'},{id:'s2',name:'Plásticos Nordeste',doc:'23.456.789/0001-10',phone:'(83) 3333-2200',email:'vendas@exemplo.com',category:'Plásticos e filmes'}],
 customers:[{id:'c1',name:'Mercado Silva',doc:'12.345.678/0001-90',phone:'(83) 98888-1111',email:'mercado@exemplo.com'},{id:'c2',name:'Padaria Central',doc:'23.456.789/0001-10',phone:'(83) 97777-2222',email:'padaria@exemplo.com'}],
 products:[{id:'p1',name:'Caixa de Papelão 30×20×10',sku:'PAP-001',category:'Caixas',cost:1.2,price:2.5,qty:120,min:20,supplierId:'s1'},{id:'p2',name:'Caixa de Papelão 40×30×20',sku:'PAP-002',category:'Caixas',cost:2.7,price:5.5,qty:8,min:25,supplierId:'s1'},{id:'p3',name:'Fita Adesiva Transparente',sku:'FIT-001',category:'Fitas',cost:2.1,price:4.2,qty:45,min:20,supplierId:'s2'},{id:'p4',name:'Plástico Bolha 1,20 m',sku:'PLA-001',category:'Plásticos',cost:19.9,price:32.9,qty:3,min:10,supplierId:'s2'},{id:'p5',name:'Envelope Kraft',sku:'ENV-001',category:'Envelopes',cost:.32,price:.85,qty:200,min:50,supplierId:'s1'}],
 moves:[],quotes:[{id:'q1',number:1008,customerId:'c1',date:'2026-10-22',status:'Enviado',items:[{productId:'p1',name:'Caixa de Papelão 30×20×10',quantity:500,unitPrice:2.5}],discount:0,notes:''}],orders:[]};
export const quoteTotal=(q:Pick<Quote,'items'|'discount'>)=>Math.max(0,q.items.reduce((s,i)=>s+i.unitPrice*i.quantity,0)-q.discount);
export const load=():Store=>{try{const v=localStorage.getItem('vetor-hub-demo-v1');if(v)return JSON.parse(v) as Store;}catch{}return structuredClone(seed)};
