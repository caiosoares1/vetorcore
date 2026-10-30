// Gera src/dark.css a partir dos estilos claros, sem alterar o tema claro.
// Cada cor é convertida para OKLCH e tem a luminosidade remapeada conforme o papel
// da propriedade (fundo, texto, borda, sombra). Rode `npm run theme:dark` após mudar
// cores em src/style.css, src/editor.css ou src/commerce.css; o teste
// tests/dark-theme.test.mjs falha se o arquivo gerado estiver desatualizado.
import {readFileSync,writeFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';

export const SOURCES=['src/style.css','src/editor.css','src/commerce.css'];
export const OUTPUT='src/dark.css';
const PREFIX=':root[data-theme="dark"]';

// Papel de cada variável CSS. Variável nova sem papel definido interrompe a geração.
const VARIABLE_ROLES={'--brand':'brand','--brand-soft':'bg','--accent':'keep','--ink':'text','--muted':'text','--line':'border','--canvas':'bg'};
// Ajustes que o remapeamento automático não resolve bem.
const MANUAL=`${PREFIX}{color-scheme:dark}
${PREFIX} .login-card input,${PREFIX} .invite-form select,${PREFIX} .invite-form input{color:inherit}
`;

// --- cor: sRGB <-> OKLCH ---
const toLinear=c=>c<=0.04045?c/12.92:((c+0.055)/1.055)**2.4;
const fromLinear=c=>c<=0.0031308?12.92*c:1.055*c**(1/2.4)-0.055;
function rgbToOklch([r,g,b]){
 const[lr,lg,lb]=[r,g,b].map(v=>toLinear(v/255));
 const l=Math.cbrt(0.4122214708*lr+0.5363325363*lg+0.0514459929*lb);
 const m=Math.cbrt(0.2119034982*lr+0.6806995451*lg+0.1073969566*lb);
 const s=Math.cbrt(0.0883024619*lr+0.2817188376*lg+0.6299787005*lb);
 const L=0.2104542553*l+0.793617785*m-0.0040720468*s;
 const a=1.9779984951*l-2.428592205*m+0.4505937099*s;
 const bb=0.0259040371*l+0.7827717662*m-0.808675766*s;
 return{L,C:Math.hypot(a,bb),h:Math.atan2(bb,a)};
}
function oklchToRgb({L,C,h}){
 const a=C*Math.cos(h),b=C*Math.sin(h);
 const l=(L+0.3963377774*a+0.2158037573*b)**3;
 const m=(L-0.1055613458*a-0.0638541728*b)**3;
 const s=(L-0.0894841775*a-1.291485548*b)**3;
 return[4.0767416621*l-3.3077115913*m+0.2309699292*s,-1.2684380046*l+2.6097574011*m-0.3413193965*s,-0.0041960863*l-0.7034186147*m+1.707614701*s].map(fromLinear);
}
function inGamut(color){
 // Reduz o croma até a cor caber em sRGB.
 let c={...color};
 for(let i=0;i<30;i++){const rgb=oklchToRgb(c);if(rgb.every(v=>v>=-0.0005&&v<=1.0005))return rgb.map(v=>Math.round(Math.min(1,Math.max(0,v))*255));c.C*=0.9;}
 return oklchToRgb({...c,C:0}).map(v=>Math.round(Math.min(1,Math.max(0,v))*255));
}
function parseColor(token){
 const t=token.toLowerCase();
 if(t==='white')return{rgb:[255,255,255],alpha:1};
 if(t==='black')return{rgb:[0,0,0],alpha:1};
 if(t.startsWith('#')){
  let hex=t.slice(1);
  if(hex.length<=4)hex=[...hex].map(ch=>ch+ch).join('');
  const n=hex.match(/../g).map(x=>parseInt(x,16));
  return{rgb:n.slice(0,3),alpha:n.length===4?n[3]/255:1};
 }
 const parts=t.slice(t.indexOf('(')+1,-1).split(/[\s,/]+/).filter(Boolean).map(Number);
 return{rgb:parts.slice(0,3),alpha:parts.length>3?parts[3]:1};
}
const hex2=n=>n.toString(16).padStart(2,'0');
function formatColor(rgb,alpha){
 if(alpha>=0.999)return '#'+rgb.map(hex2).join('');
 return `rgba(${rgb.join(',')},${Math.round(alpha*1000)/1000})`;
}

export function mapColor(token,role){
 const{rgb,alpha}=parseColor(token);
 if(role==='shadow')return formatColor([0,0,0],Math.min(0.6,alpha*2.2));
 if(role==='keep')return token;
 const c=rgbToOklch(rgb);
 let{L,C}=c;
 if(role==='bg'){
  // Véus translúcidos escuros (fundo de modal) continuam escuros.
  if(alpha<0.9&&L<0.5)return formatColor([0,0,0],Math.min(0.72,alpha*1.4));
  // Superfícies claras mantêm a ordem: branco (painéis) fica um pouco acima do fundo da página;
  // tons de hover/seleção ficam abaixo, com o matiz reforçado para continuarem visíveis.
  if(L>=0.8){L=0.13+(L-0.8)*0.6;C=Math.min(C*1.6,0.06);}
  else if(L<0.5)L=0.92-L; // fundos fortes (botão, avatar) clareiam; o hover, mais escuro no claro, fica mais claro aqui
 }else if(role==='text'){
  if(L<0.72){L=Math.min(0.95,1-0.55*L);C=Math.min(C,0.15);}
 }else if(role==='border'){
  if(L>=0.7)L=0.3+(1-L)*0.55;
  else if(L<0.5)L=0.56;
 }else if(role==='brand'){L=0.7;C=Math.min(C,0.14);} // marca como texto/ícone; fundos usam a versão 'bg'
 return formatColor(inGamut({L,C,h:c.h}),alpha);
}

function roleOf(property){
 if(property.startsWith('--')){
  const role=VARIABLE_ROLES[property];
  if(!role)throw new Error('Variável sem papel no tema escuro: '+property+' (adicione em VARIABLE_ROLES).');
  return role;
 }
 if(/^background(-color|-image)?$/.test(property))return 'bg';
 if(/^(color|fill|stroke|caret-color|text-decoration-color|-webkit-text-fill-color)$/.test(property))return 'text';
 if(/^(border|outline|column-rule)/.test(property))return 'border';
 if(/^(box-shadow|text-shadow)$/.test(property))return 'shadow';
 return null;
}

const COLOR=/#[0-9a-f]{3,8}\b|rgba?\([^)]*\)|\b(?:white|black)\b/gi;

// --- parser mínimo de CSS (regras, @media/@supports aninhados) ---
function splitTop(text,separator){
 const out=[];let depth=0,quote='',start=0;
 for(let i=0;i<text.length;i++){
  const ch=text[i];
  if(quote){if(ch===quote&&text[i-1]!=='\\')quote='';continue;}
  if(ch==='"'||ch==="'")quote=ch;
  else if(ch==='(')depth++;
  else if(ch===')')depth--;
  else if(ch===separator&&depth===0){out.push(text.slice(start,i));start=i+1;}
 }
 out.push(text.slice(start));
 return out.map(s=>s.trim()).filter(Boolean);
}
// Fim de uma at-rule sem bloco (ex.: @import url('...;...');), ignorando ';' dentro de aspas/parênteses.
function statementEnd(css,from){
 let depth=0,quote='';
 for(let i=from;i<css.length;i++){
  const ch=css[i];
  if(quote){if(ch===quote)quote='';continue;}
  if(ch==='"'||ch==="'")quote=ch;else if(ch==='(')depth++;else if(ch===')')depth--;
  else if(ch===';'&&depth===0)return i+1;
 }
 return css.length;
}
function parseBlocks(css){
 const blocks=[];let i=0;
 while(i<css.length){
  while(i<css.length&&/\s/.test(css[i]))i++;
  if(/^@(import|charset|namespace)/.test(css.slice(i,i+10))){i=statementEnd(css,i);continue;}
  const open=css.indexOf('{',i);
  if(open<0)break;
  const head=css.slice(i,open).trim();
  let depth=1,j=open+1;
  for(;j<css.length&&depth;j++){if(css[j]==='{')depth++;else if(css[j]==='}')depth--;}
  const body=css.slice(open+1,j-1);
  blocks.push(head.startsWith('@')?{type:'at',head,children:/^@(media|supports)/.test(head)?parseBlocks(body):null}:{type:'rule',head,body});
  i=j;
 }
 return blocks;
}
function prefixSelector(selector){
 if(selector.startsWith(':root'))return PREFIX+selector.slice(5);
 if(/^html\b/.test(selector))return PREFIX+selector.slice(4);
 return PREFIX+' '+selector;
}
// Valores declarados das variáveis de marca, para resolver var(--brand) usada como fundo/borda.
const brandValues={};
function collectBrandValues(blocks){
 for(const block of blocks){
  if(block.type==='at'){if(block.children)collectBrandValues(block.children);continue;}
  for(const declaration of splitTop(block.body,';')){
   const[name,...rest]=declaration.split(':');
   if(VARIABLE_ROLES[name.trim()]==='brand')brandValues[name.trim()]=rest.join(':').trim();
  }
 }
}
function convertRule(head,body){
 const declarations=[];
 for(const declaration of splitTop(body,';')){
  const colon=declaration.indexOf(':');
  if(colon<0)continue;
  const property=declaration.slice(0,colon).trim().toLowerCase();
  const value=declaration.slice(colon+1).trim();
  const role=roleOf(property);
  if(!role)continue;
  let converted=value.replace(/url\([^)]*\)/g,'')===value?value.replace(COLOR,token=>mapColor(token,role)):value;
  // A variável da marca fica clara (texto); como fundo/borda usa a versão mais escura, legível com texto branco.
  if(role==='bg'||role==='border')converted=converted.replace(/var\((--[\w-]+)\)/g,(all,name)=>brandValues[name]?mapColor(brandValues[name],'bg'):all);
  // Mesmo sem cor literal (transparent, inherit, 0, var...), a declaração é copiada com o mesmo prefixo
  // para manter a ordem da cascata do tema claro (ex.: .login-link sobrescrevendo .login-card button).
  declarations.push(property+':'+converted);
 }
 if(!declarations.length)return '';
 return splitTop(head,',').map(prefixSelector).join(',')+'{'+declarations.join(';')+'}';
}
function convertBlocks(blocks){
 const out=[];
 for(const block of blocks){
  if(block.type==='rule'){const rule=convertRule(block.head,block.body);if(rule)out.push(rule);}
  else if(block.children){const inner=convertBlocks(block.children);if(inner.length)out.push(block.head+'{\n'+inner.join('\n')+'\n}');}
 }
 return out;
}

export function generateDarkCss(sources){
 const parts=['/* GERADO por scripts/gen-dark-theme.mjs — não editar à mão. Rode `npm run theme:dark`. */',MANUAL.trim()];
 const parsed=sources.map(([name,css])=>[name,parseBlocks(css.replace(/\/\*[\s\S]*?\*\//g,''))]);
 for(const[,blocks]of parsed)collectBrandValues(blocks);
 for(const[name,blocks]of parsed){
  const rules=convertBlocks(blocks);
  if(rules.length)parts.push('/* '+name+' */\n'+rules.join('\n'));
 }
 return parts.join('\n\n')+'\n';
}

export function readSources(root='.'){
 return SOURCES.map(file=>[file,readFileSync(root+'/'+file,'utf8')]);
}

if(process.argv[1]&&fileURLToPath(import.meta.url)===process.argv[1]){
 writeFileSync(OUTPUT,generateDarkCss(readSources()));
 console.log('Gerado '+OUTPUT);
}
