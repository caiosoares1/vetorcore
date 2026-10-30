import {useState} from 'react';
import {Monitor,Moon,Sun} from 'lucide-react';
import {getThemePreference,nextThemePreference,setThemePreference,themeLabel} from '../theme';

export default function ThemeToggle({className='button-icon theme-toggle'}:{className?:string}){
 const[preference,setPreference]=useState(getThemePreference);
 const Icon=preference==='system'?Monitor:preference==='light'?Sun:Moon;
 const label='Tema: '+themeLabel(preference)+'. Trocar para '+themeLabel(nextThemePreference(preference));
 return <button type="button" className={className} title={label} aria-label={label} onClick={()=>{const next=nextThemePreference(preference);setThemePreference(next);setPreference(next);}}><Icon size={17}/></button>;
}
