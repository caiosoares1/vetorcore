import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

// Os temas claro e escuro são dois conjuntos de tokens em src/index.css (padrão shadcn/ui).
// Estes testes garantem que os pares de texto/fundo usados na interface mantêm contraste AA.
const css=readFileSync(new URL('../src/index.css',import.meta.url),'utf8');
function block(selector){
 const start=css.indexOf(selector+' {');
 assert.ok(start>=0,'bloco '+selector+' não encontrado');
 const body=css.slice(css.indexOf('{',start)+1,css.indexOf('}',start));
 return Object.fromEntries([...body.matchAll(/--([\w-]+):\s*([^;]+);/g)].map(m=>[m[1],m[2].trim()]));
}
const themes={light:block(':root'),dark:block(':root[data-theme="dark"]')};

const luminance=hex=>{
 assert.match(hex,/^#[0-9a-f]{6}$/i,'cor sólida esperada: '+hex);
 const [r,g,b]=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(c=>c<=0.03928?c/12.92:((c+0.055)/1.055)**2.4);
 return 0.2126*r+0.7152*g+0.0722*b;
};
const contrast=(a,b)=>{const[x,y]=[luminance(a),luminance(b)].sort((p,q)=>q-p);return (x+0.05)/(y+0.05);};

// [texto, fundo, contraste mínimo]
const PAIRS=[
 ['foreground','background',4.5],['foreground','card',4.5],['foreground','muted',4.5],['foreground','popover',4.5],
 ['muted-foreground','background',4.5],['muted-foreground','card',4.5],['muted-foreground','muted',4.5],
 ['primary-foreground','primary',4.5],['primary-foreground','primary-hover',4.5],
 ['brand','card',4.5],['brand','background',4.5],['brand','brand-soft',4.5],
 ['secondary-foreground','secondary',4.5],['accent-foreground','accent',4.5],
 ['success','success-soft',4.5],['success','card',4.5],
 ['warning','warning-soft',4.5],['warning','card',4.5],
 ['destructive','destructive-soft',4.5],['destructive','card',4.5],
 ['destructive-foreground','destructive-solid',4.5],
 ['accent-orange-text','accent-orange-soft',4.5],['accent-orange-text','card',4.5],
 ['sidebar-foreground','sidebar',4.5],['sidebar-muted','sidebar',4.5],['sidebar-active','sidebar',4.5]
];

for(const[name,tokens]of Object.entries(themes)){
 test(`tema ${name}: pares de texto e fundo têm contraste AA`,()=>{
  for(const[text,surface,min]of PAIRS){
   const ratio=contrast(tokens[text],tokens[surface]);
   assert.ok(ratio>=min,`${text} (${tokens[text]}) sobre ${surface} (${tokens[surface]}): ${ratio.toFixed(2)} < ${min}`);
  }
 });
 test(`tema ${name}: botão laranja de destaque é legível`,()=>{
  assert.ok(contrast('#1d1004',tokens['accent-orange'])>=4.5);
 });
}

test('o tema escuro define todos os tokens do tema claro',()=>{
 const missing=Object.keys(themes.light).filter(key=>!(key in themes.dark)&&!key.startsWith('radius'));
 assert.deepEqual(missing,[]);
});

test('cartões se destacam do fundo e as cores da logo estão no tema claro',()=>{
 assert.equal(themes.light.primary,'#363890');
 assert.equal(themes.light['accent-orange'],'#ff862b');
 for(const tokens of Object.values(themes))assert.notEqual(tokens.card,tokens.background);
 assert.ok(luminance(themes.dark.card)>luminance(themes.dark.background));
});

test('a cor do navegador (theme-color) acompanha o fundo do tema escuro',()=>{
 const theme=readFileSync(new URL('../src/theme.ts',import.meta.url),'utf8');
 const html=readFileSync(new URL('../index.html',import.meta.url),'utf8');
 assert.ok(theme.includes(`dark:'${themes.dark.background}'`));
 assert.ok(html.includes(`"${themes.dark.background}"`));
});
