import {useEffect,useState} from 'react';
import {Moon,Sun} from 'lucide-react';
import {currentTheme,setTheme} from '../theme';

export default function ThemeToggle({className='button-icon theme-toggle'}:{className?:string}){
 const[theme,setLocalTheme]=useState(currentTheme);
 // O tema também pode mudar pelo aparelho (sem escolha salva) ou por outro botão na tela.
 useEffect(()=>{
  const observer=new MutationObserver(()=>setLocalTheme(currentTheme()));
  observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  return()=>observer.disconnect();
 },[]);
 const next=theme==='dark'?'light':'dark';
 const label=next==='dark'?'Ativar tema escuro':'Ativar tema claro';
 return <button type="button" className={className} title={label} aria-label={label} aria-pressed={theme==='dark'} onClick={()=>setTheme(next)}>{next==='dark'?<Moon size={17}/>:<Sun size={17}/>}</button>;
}
