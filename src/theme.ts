// Tema por aparelho. O tema efetivo vai em <html data-theme="light|dark">;
// index.html aplica o mesmo cálculo antes do React para evitar piscar em claro.
// Sem escolha salva, segue o tema do aparelho; depois que a pessoa escolhe, a escolha vale.
export type Theme='light'|'dark';
const KEY='vetor.theme';
const media=()=>window.matchMedia('(prefers-color-scheme: dark)');
const metaColors:Record<Theme,string>={light:'#363890',dark:'#0e0f1a'};

function savedTheme():Theme|null{
 try{const value=localStorage.getItem(KEY);return value==='light'||value==='dark'?value:null;}catch{return null;}
}

function applyTheme(theme:Theme){
 document.documentElement.dataset.theme=theme;
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content',metaColors[theme]);
}

export const currentTheme=():Theme=>document.documentElement.dataset.theme==='dark'?'dark':'light';

export function setTheme(theme:Theme){
 try{localStorage.setItem(KEY,theme);}catch{/* sem armazenamento: vale só nesta sessão */}
 applyTheme(theme);
}

export function initTheme(){
 applyTheme(savedTheme()??(media().matches?'dark':'light'));
 // Enquanto não houver escolha, acompanha a troca de tema do aparelho com o app aberto.
 media().addEventListener('change',event=>{if(!savedTheme())applyTheme(event.matches?'dark':'light');});
}
