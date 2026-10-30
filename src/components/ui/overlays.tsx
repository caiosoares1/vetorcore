import type {ReactNode} from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import * as AlertDialogPrimitive from '@radix-ui/react-alert-dialog';
import * as DropdownPrimitive from '@radix-ui/react-dropdown-menu';
import {X} from 'lucide-react';
import {cn} from '../../lib/utils';
import {Button} from './button';

const overlay='animate-overlay fixed inset-0 z-50 bg-[#0b0c1d]/45 backdrop-blur-[2px]';

/**
 * Painel lateral (sheet) para formulários: drawer à direita no desktop e tela cheia no celular.
 * Enquanto `busy`, não fecha por Esc, clique fora ou botões de fechar.
 */
export function Sheet({open=true,onClose,busy=false,title,description,eyebrow,children,footer,className}:{
  open?:boolean;onClose:()=>void;busy?:boolean;title:ReactNode;description?:ReactNode;eyebrow?:ReactNode;children:ReactNode;footer?:ReactNode;className?:string;
}){
  return <DialogPrimitive.Root open={open} onOpenChange={next=>{if(!next&&!busy)onClose();}}>
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className={overlay}/>
      <DialogPrimitive.Content
        onEscapeKeyDown={e=>{if(busy)e.preventDefault();}}
        onPointerDownOutside={e=>{if(busy)e.preventDefault();}}
        className={cn('animate-sheet fixed inset-0 z-50 flex flex-col bg-background outline-none sm:inset-y-0 sm:left-auto sm:right-0 sm:w-[560px] sm:max-w-[calc(100vw-48px)] sm:border-l sm:border-border sm:shadow-pop',className)}>
        <div className="flex items-start gap-3 border-b border-border bg-card px-4 pb-4 pt-[max(16px,env(safe-area-inset-top))] sm:px-6 sm:pt-5">
          <div className="min-w-0 flex-1">
            {eyebrow&&<p className="mb-1 text-[11px] font-bold uppercase tracking-[0.12em] text-orange-text">{eyebrow}</p>}
            <DialogPrimitive.Title className="text-lg font-bold leading-tight text-foreground sm:text-xl">{title}</DialogPrimitive.Title>
            {description?<DialogPrimitive.Description className="mt-1 text-sm text-muted-foreground">{description}</DialogPrimitive.Description>:<DialogPrimitive.Description className="sr-only">{title}</DialogPrimitive.Description>}
          </div>
          <DialogPrimitive.Close asChild><Button variant="ghost" size="icon-sm" disabled={busy} aria-label="Fechar" className="-mr-1 text-muted-foreground"><X/></Button></DialogPrimitive.Close>
        </div>
        {children}
        {footer}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  </DialogPrimitive.Root>;
}

/** Corpo rolável e rodapé fixo de um Sheet com formulário. */
export function SheetBody({className,children}:{className?:string;children:ReactNode}){
  return <div className={cn('flex-1 overflow-y-auto overscroll-contain px-4 py-5 sm:px-6',className)}>{children}</div>;
}
export function SheetFooter({children,className}:{children:ReactNode;className?:string}){
  return <div className={cn('flex items-center justify-end gap-2 border-t border-border bg-card px-4 pt-3 pb-[max(12px,env(safe-area-inset-bottom))] sm:px-6 [&>*]:flex-1 sm:[&>*]:flex-none',className)}>{children}</div>;
}

/** Confirmação de ação (role=alertdialog). */
export function ConfirmDialog({open,title,subject,body,confirmLabel,busy,destructive,onCancel,onConfirm,icon}:{
  open:boolean;title:string;subject?:ReactNode;body:ReactNode;confirmLabel:string;busy:boolean;destructive?:boolean;onCancel:()=>void;onConfirm:()=>void;icon?:ReactNode;
}){
  return <AlertDialogPrimitive.Root open={open} onOpenChange={next=>{if(!next&&!busy)onCancel();}}>
    <AlertDialogPrimitive.Portal>
      <AlertDialogPrimitive.Overlay className={overlay}/>
      <AlertDialogPrimitive.Content onEscapeKeyDown={e=>{if(busy)e.preventDefault();}}
        className="animate-pop fixed left-1/2 top-1/2 z-50 w-[calc(100vw-32px)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl border border-border bg-card p-6 shadow-pop outline-none">
        <div className="flex gap-4">
          {icon&&<div className={cn('grid size-10 shrink-0 place-items-center rounded-full [&_svg]:size-5',destructive?'bg-destructive-soft text-destructive':'bg-brand-soft text-brand')}>{icon}</div>}
          <div className="min-w-0 flex-1">
            <AlertDialogPrimitive.Title className="text-lg font-bold text-foreground">{title}</AlertDialogPrimitive.Title>
            {subject&&<p className="mt-1 break-words text-sm font-semibold text-foreground">{subject}</p>}
            <AlertDialogPrimitive.Description className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{body}</AlertDialogPrimitive.Description>
          </div>
        </div>
        <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <AlertDialogPrimitive.Cancel asChild><Button variant="outline" disabled={busy}>Cancelar</Button></AlertDialogPrimitive.Cancel>
          <Button variant={destructive?'destructive':'default'} disabled={busy} onClick={onConfirm}>{busy?'Salvando…':confirmLabel}</Button>
        </div>
      </AlertDialogPrimitive.Content>
    </AlertDialogPrimitive.Portal>
  </AlertDialogPrimitive.Root>;
}

export const DropdownMenu=DropdownPrimitive.Root;
export const DropdownMenuTrigger=DropdownPrimitive.Trigger;
export function DropdownMenuContent({className,align='end',children,...props}:DropdownPrimitive.DropdownMenuContentProps){
  return <DropdownPrimitive.Portal>
    <DropdownPrimitive.Content align={align} sideOffset={6} className={cn('animate-menu z-50 min-w-[200px] overflow-hidden rounded-xl border border-border bg-popover p-1.5 text-popover-foreground shadow-pop',className)} {...props}>{children}</DropdownPrimitive.Content>
  </DropdownPrimitive.Portal>;
}
export function DropdownMenuItem({className,destructive,...props}:DropdownPrimitive.DropdownMenuItemProps&{destructive?:boolean}){
  return <DropdownPrimitive.Item className={cn('flex cursor-pointer select-none items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm font-medium outline-none transition-colors data-[highlighted]:bg-accent data-[disabled]:pointer-events-none data-[disabled]:opacity-50 [&_svg]:size-4 [&_svg]:text-muted-foreground',
    destructive&&'text-destructive data-[highlighted]:bg-destructive-soft [&_svg]:text-destructive',className)} {...props}/>;
}
export function DropdownMenuLabel({className,...props}:DropdownPrimitive.DropdownMenuLabelProps){
  return <DropdownPrimitive.Label className={cn('px-2.5 py-2 text-xs text-muted-foreground',className)} {...props}/>;
}
export function DropdownMenuSeparator(){return <DropdownPrimitive.Separator className="-mx-1.5 my-1.5 h-px bg-border"/>;}
