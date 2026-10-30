// Preferência de tema por aparelho. O tema efetivo vai em <html data-theme="light|dark">;
// index.html aplica o mesmo cálculo antes do React para evitar piscar em claro.
export type ThemePreference='system'|'light'|'dark';
const KEY='vetor.theme';
const media=()=>window.matchMedia('(prefers-color-scheme: dark)');
const metaColors={light:'#363890',dark:'#1d1f22'};

export function getThemePreference():ThemePreference{
 try{const value=localStorage.getItem(KEY);return value==='light'||value==='dark'?value:'system';}catch{return 'system';}
}

function applyTheme(preference=getThemePreference()){
 const dark=preference==='dark'||(preference==='system'&&media().matches);
 const theme=dark?'dark':'light';
 document.documentElement.dataset.theme=theme;
 document.querySelector('meta[name="theme-color"]')?.setAttribute('content',metaColors[theme]);
}

export function setThemePreference(preference:ThemePreference){
 try{if(preference==='system')localStorage.removeItem(KEY);else localStorage.setItem(KEY,preference);}catch{/* sem armazenamento: vale só nesta sessão */}
 applyTheme(preference);
}

export function initTheme(){
 applyTheme();
 // Em "Sistema", acompanha a troca de tema do aparelho com o app aberto.
 media().addEventListener('change',()=>{if(getThemePreference()==='system')applyTheme('system');});
}

export const nextThemePreference=(preference:ThemePreference):ThemePreference=>preference==='system'?'light':preference==='light'?'dark':'system';
export const themeLabel=(preference:ThemePreference)=>preference==='system'?'Sistema':preference==='light'?'Claro':'Escuro';
