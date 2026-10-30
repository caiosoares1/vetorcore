import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {generateDarkCss,readSources,mapColor,OUTPUT} from '../scripts/gen-dark-theme.mjs';

const luminance=hex=>{
 const [r,g,b]=hex.slice(1).match(/../g).map(x=>parseInt(x,16)/255).map(c=>c<=0.03928?c/12.92:((c+0.055)/1.055)**2.4);
 return 0.2126*r+0.7152*g+0.0722*b;
};
const contrast=(a,b)=>{const[x,y]=[luminance(a),luminance(b)].sort((p,q)=>q-p);return (x+0.05)/(y+0.05);};

test('src/dark.css está atualizado em relação aos estilos claros (rode npm run theme:dark)',()=>{
 assert.equal(readFileSync(OUTPUT,'utf8').replace(/\r\n/g,'\n'),generateDarkCss(readSources().map(([f,css])=>[f,css.replace(/\r\n/g,'\n')])));
});

test('texto principal e secundário mantêm contraste AA sobre painéis e fundo escuros',()=>{
 const panel=mapColor('#fff','bg'),canvas=mapColor('#f7f8fb','bg');
 for(const text of ['#172033','#20263a','#687185','#748097','#a82432','#1f6f43','#b26728'])
  for(const surface of [panel,canvas])
   assert.ok(contrast(mapColor(text,'text'),surface)>=4.5,text+' sobre '+surface);
});

test('cor da marca fica legível como texto e como fundo de botão com texto branco',()=>{
 const brand=mapColor('#373b95','brand'),panel=mapColor('#fff','bg');
 assert.ok(contrast(brand,panel)>=4.5,'marca sobre painel');
 assert.ok(contrast('#ffffff',mapColor('#373b95','bg'))>=4.5,'branco sobre botão');
});

test('painéis ficam acima do fundo da página e bordas aparecem sobre os painéis',()=>{
 const panel=mapColor('#ffffff','bg'),canvas=mapColor('#f7f8fb','bg'),line=mapColor('#e6e9f0','border');
 assert.ok(luminance(panel)>luminance(canvas));
 assert.ok(contrast(line,panel)>=1.3);
});

test('sombras viram preto com opacidade maior e texto claro é preservado',()=>{
 assert.equal(mapColor('#16214706','shadow'),'rgba(0,0,0,0.052)');
 assert.equal(mapColor('white','text'),'#ffffff');
 assert.equal(mapColor('#f58220','keep'),'#f58220');
});
