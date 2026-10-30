import {useEffect,useState} from 'react';
import {Moon,Sun} from 'lucide-react';
import {currentTheme,setTheme} from '../theme';
import {Button} from './ui/button';
import {cn} from '../lib/utils';

export default function ThemeToggle({className}:{className?:string}){
 const[theme,setLocalTheme]=useState(currentTheme);
 // O tema também pode mudar pelo aparelho (sem escolha salva) ou por outro botão na tela.
 useEffect(()=>{
  const observer=new MutationObserver(()=>setLocalTheme(currentTheme()));
  observer.observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});
  return()=>observer.disconnect();
 },[]);
 const next=theme==='dark'?'light':'dark';
 const label=next==='dark'?'Ativar tema escuro':'Ativar tema claro';
 return <Button variant="ghost" size="icon" className={cn('text-muted-foreground hover:text-foreground',className)} title={label} aria-label={label} aria-pressed={theme==='dark'} onClick={()=>setTheme(next)}>{next==='dark'?<Moon className="size-[18px]"/>:<Sun className="size-[18px]"/>}</Button>;
}
