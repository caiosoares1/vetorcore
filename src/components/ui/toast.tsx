import {CheckCircle2,X} from 'lucide-react';

/** Aviso flutuante de sucesso; some sozinho (o tempo é controlado por quem o exibe). */
export function Toast({message,onDismiss}:{message:string;onDismiss:()=>void}){
  if(!message)return null;
  return <div className="pointer-events-none fixed inset-x-4 bottom-[calc(84px+env(safe-area-inset-bottom))] z-[45] flex justify-center lg:inset-x-auto lg:bottom-6 lg:right-6">
    <div role="status" className="animate-toast pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-xl border border-border bg-popover py-3 pl-4 pr-2 text-sm font-medium text-popover-foreground shadow-pop">
      <span className="grid size-7 shrink-0 place-items-center rounded-full bg-success-soft text-success"><CheckCircle2 className="size-4"/></span>
      <span className="flex-1">{message}</span>
      <button type="button" aria-label="Dispensar" onClick={onDismiss} className="grid size-8 place-items-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"><X className="size-4"/></button>
    </div>
  </div>;
}

/** Aviso de erro inline, com botão opcional para fechar. */
export function ErrorBanner({message,onDismiss}:{message:string;onDismiss?:()=>void}){
  if(!message)return null;
  return <div role="alert" className="flex items-start gap-3 rounded-xl border border-destructive/25 bg-destructive-soft px-4 py-3 text-sm font-medium text-destructive">
    <svg aria-hidden viewBox="0 0 24 24" className="mt-0.5 size-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"><circle cx="12" cy="12" r="10"/><path d="M12 8v4M12 16h.01"/></svg>
    <span className="flex-1">{message}</span>
    {onDismiss&&<button type="button" aria-label="Fechar aviso" onClick={onDismiss} className="-my-1 grid size-7 place-items-center rounded-md hover:bg-destructive/10"><X className="size-4"/></button>}
  </div>;
}
