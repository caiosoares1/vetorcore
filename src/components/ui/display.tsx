import type {HTMLAttributes,ReactNode} from 'react';
import {cva,type VariantProps} from 'class-variance-authority';
import {cn} from '../../lib/utils';

export const badgeVariants=cva('inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold [&_svg]:size-3.5',{
  variants:{
    variant:{
      default:'bg-brand-soft text-brand',
      neutral:'bg-muted text-muted-foreground',
      success:'bg-success-soft text-success',
      warning:'bg-warning-soft text-warning',
      destructive:'bg-destructive-soft text-destructive',
      orange:'bg-orange-soft text-orange-text',
      outline:'border border-border text-muted-foreground'
    }
  },
  defaultVariants:{variant:'default'}
});

export function Badge({className,variant,...props}:HTMLAttributes<HTMLSpanElement>&VariantProps<typeof badgeVariants>){
  return <span className={cn(badgeVariants({variant}),className)} {...props}/>;
}

export function Card({className,...props}:HTMLAttributes<HTMLDivElement>){
  return <div className={cn('min-w-0 rounded-xl border border-border bg-card text-card-foreground shadow-card',className)} {...props}/>;
}

export function CardHeader({title,description,action,className}:{title:ReactNode;description?:ReactNode;action?:ReactNode;className?:string}){
  return <div className={cn('flex items-start justify-between gap-4 border-b border-border px-4 py-3.5 sm:px-5',className)}>
    <div className="min-w-0">
      <h2 className="text-[15px] font-bold leading-6 text-foreground">{title}</h2>
      {description&&<p className="text-[13px] text-muted-foreground">{description}</p>}
    </div>
    {action&&<div className="flex shrink-0 items-center gap-2">{action}</div>}
  </div>;
}

export function Skeleton({className,...props}:HTMLAttributes<HTMLDivElement>){
  return <div className={cn('animate-pulse rounded-md bg-muted',className)} {...props}/>;
}

/** Lista de carregamento com linhas fantasmas, no lugar de um texto solto. */
export function ListSkeleton({rows=4,label='Carregando…'}:{rows?:number;label?:string}){
  return <div className="divide-y divide-border" aria-busy="true" aria-label={label}>
    {Array.from({length:rows},(_,i)=><div key={i} className="flex items-center gap-3 px-4 py-4 sm:px-5">
      <Skeleton className="size-10 rounded-lg"/>
      <div className="flex-1 space-y-2"><Skeleton className="h-3.5 w-2/5"/><Skeleton className="h-3 w-3/5"/></div>
      <Skeleton className="hidden h-8 w-24 sm:block"/>
    </div>)}
  </div>;
}

export function EmptyState({icon,title,description,action}:{icon:ReactNode;title:string;description:string;action?:ReactNode}){
  return <div className="flex flex-col items-center px-6 py-12 text-center">
    <div className="relative mb-4 grid size-14 place-items-center rounded-2xl bg-brand-soft text-brand [&_svg]:size-6">
      {icon}
      <span aria-hidden className="absolute -right-1 -top-1 size-3 rounded-full bg-orange ring-4 ring-card"/>
    </div>
    <h3 className="text-base font-bold text-foreground">{title}</h3>
    <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>
    {action&&<div className="mt-5">{action}</div>}
  </div>;
}

/** Botões segmentados (role=button + aria-pressed), usados como filtros rápidos. */
export function Segmented<T extends string>({value,onChange,options,label,className}:{value:T;onChange:(value:T)=>void;options:{value:T;label:string;count?:number}[];label:string;className?:string}){
  return <div role="group" aria-label={label} className={cn('inline-flex max-w-full items-center gap-1 overflow-x-auto rounded-lg bg-muted p-1 [scrollbar-width:none]',className)}>
    {options.map(o=><button key={o.value} type="button" aria-pressed={value===o.value} onClick={()=>onChange(o.value)}
      className={cn('inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md px-3 text-[13px] font-semibold text-muted-foreground transition-colors hover:text-foreground',
        value===o.value&&'bg-card text-foreground shadow-card')}>
      {o.label}{o.count!=null&&<span className={cn('tabular rounded-full px-1.5 text-[11px]',value===o.value?'bg-brand-soft text-brand':'bg-background/70')}>{o.count}</span>}
    </button>)}
  </div>;
}
