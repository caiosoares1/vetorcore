import {forwardRef,type InputHTMLAttributes,type LabelHTMLAttributes,type ReactNode,type SelectHTMLAttributes,type TextareaHTMLAttributes} from 'react';
import {ChevronDown} from 'lucide-react';
import {cn} from '../../lib/utils';

const control='w-full min-w-0 rounded-lg border border-input bg-card px-3 text-[15px] text-foreground shadow-xs transition-[border-color,box-shadow] outline-none placeholder:text-muted-foreground/70 hover:border-[color-mix(in_oklab,var(--input),var(--foreground)_18%)] focus-visible:border-ring focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-ring/25 disabled:cursor-not-allowed disabled:opacity-60 aria-invalid:border-destructive sm:text-sm';

export const Input=forwardRef<HTMLInputElement,InputHTMLAttributes<HTMLInputElement>>(({className,type='text',...props},ref)=>
  <input ref={ref} type={type} className={cn(control,'h-10',className)} {...props}/>);
Input.displayName='Input';

export const Textarea=forwardRef<HTMLTextAreaElement,TextareaHTMLAttributes<HTMLTextAreaElement>>(({className,...props},ref)=>
  <textarea ref={ref} className={cn(control,'min-h-[88px] resize-y py-2.5 leading-relaxed',className)} {...props}/>);
Textarea.displayName='Textarea';

/** Select nativo com visual do design system: no celular abre o seletor do sistema, mais confortável. */
export const NativeSelect=forwardRef<HTMLSelectElement,SelectHTMLAttributes<HTMLSelectElement>&{wrapperClassName?:string}>(({className,wrapperClassName,children,...props},ref)=>
  <div className={cn('relative w-full',wrapperClassName)}>
    <select ref={ref} className={cn(control,'h-10 cursor-pointer appearance-none pr-9',className)} {...props}>{children}</select>
    <ChevronDown aria-hidden className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/>
  </div>);
NativeSelect.displayName='NativeSelect';

export function Label({className,...props}:LabelHTMLAttributes<HTMLLabelElement>){
  return <label className={cn('text-[13px] font-semibold text-foreground',className)} {...props}/>;
}

/** Campo com rótulo, controle e ajuda; `required` mostra o asterisco (que também faz parte do rótulo acessível). */
export function Field({id,label,required,help,className,children}:{id:string;label:ReactNode;required?:boolean;help?:ReactNode;className?:string;children:ReactNode}){
  return <div className={cn('flex flex-col gap-1.5',className)}>
    <Label htmlFor={id}>{label}{required&&<> <span className="text-orange-text">*</span></>}</Label>
    {children}
    {help&&<p className="text-xs leading-relaxed text-muted-foreground">{help}</p>}
  </div>;
}

/** Campo monetário: prefixo R$ dentro do controle. */
export const MoneyInput=forwardRef<HTMLInputElement,InputHTMLAttributes<HTMLInputElement>>(({className,...props},ref)=>
  <div className="relative">
    <span aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm font-medium text-muted-foreground">R$</span>
    <Input ref={ref} inputMode="decimal" className={cn('pl-9 tabular',className)} {...props}/>
  </div>);
MoneyInput.displayName='MoneyInput';

export function SectionTitle({icon,children,description}:{icon?:ReactNode;children:ReactNode;description?:ReactNode}){
  return <div className="flex items-start gap-3">
    {icon&&<span className="mt-0.5 grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand [&_svg]:size-4">{icon}</span>}
    <div className="min-w-0">
      <h3 className="text-sm font-bold text-foreground">{children}</h3>
      {description&&<p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
    </div>
  </div>;
}

export function FormError({message}:{message:string}){
  return message?<div className="rounded-lg border border-destructive/30 bg-destructive-soft px-3.5 py-3 text-sm font-medium text-destructive" role="alert">{message}</div>:null;
}
