import {useEffect,useRef,type ReactNode} from 'react';
import {ArrowLeft,X} from 'lucide-react';

type Props={
  title:string;
  description:string;
  onClose:()=>void;
  busy:boolean;
  children:ReactNode;
};

export default function EditorSheet({title,description,onClose,busy,children}:Props){
  const panelRef=useRef<HTMLElement>(null);
  useEffect(()=>{
    const previous=document.body.style.overflow;
    document.body.style.overflow='hidden';
    panelRef.current?.focus();
    function onKeyDown(event:KeyboardEvent){
      if(event.key==='Escape'&&!busy){event.preventDefault();onClose();}
      if(event.key!=='Tab')return;
      const panel=panelRef.current;
      if(!panel)return;
      const focusable=Array.from(panel.querySelectorAll<HTMLElement>(
        'button:not([disabled]),input:not([disabled]),select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'
      ));
      if(focusable.length===0)return;
      const first=focusable[0],last=focusable[focusable.length-1];
      if(event.shiftKey&&document.activeElement===first){event.preventDefault();last.focus();}
      else if(!event.shiftKey&&document.activeElement===last){event.preventDefault();first.focus();}
    }
    document.addEventListener('keydown',onKeyDown);
    return()=>{document.body.style.overflow=previous;document.removeEventListener('keydown',onKeyDown);};
  },[busy,onClose]);
  return <div className="editor-root">
    <button aria-label="Fechar painel" className="editor-backdrop" disabled={busy} onClick={onClose}/>
    <section className="editor-sheet" role="dialog" aria-modal="true" aria-labelledby="editor-title" aria-describedby="editor-description" tabIndex={-1} ref={panelRef}>
      <div className="editor-top">
        <button className="editor-back" type="button" onClick={onClose} disabled={busy} aria-label="Voltar"><ArrowLeft size={21}/></button>
        <div className="editor-heading">
          <span className="editor-eyebrow">VETORCORE · CADASTRO</span>
          <h2 id="editor-title">{title}</h2>
          <p id="editor-description">{description}</p>
        </div>
        <button className="editor-x" type="button" onClick={onClose} disabled={busy} aria-label="Fechar"><X size={20}/></button>
      </div>
      {children}
    </section>
  </div>;
}
