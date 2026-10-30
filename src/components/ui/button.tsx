import {forwardRef,type ButtonHTMLAttributes} from 'react';
import {Slot} from '@radix-ui/react-slot';
import {cva,type VariantProps} from 'class-variance-authority';
import {cn} from '../../lib/utils';

export const buttonVariants=cva(
  'inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-semibold transition-[color,background-color,border-color,box-shadow,transform] duration-150 active:scale-[0.98] disabled:pointer-events-none disabled:opacity-55 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*=size-])]:size-4 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-ring',
  {
    variants:{
      variant:{
        default:'bg-primary text-primary-foreground shadow-sm hover:bg-primary-hover',
        accent:'bg-orange text-[#1d1004] shadow-sm hover:brightness-105',
        secondary:'bg-secondary text-secondary-foreground hover:bg-accent',
        outline:'border border-input bg-card text-foreground shadow-xs hover:bg-accent hover:text-accent-foreground',
        ghost:'text-foreground hover:bg-accent hover:text-accent-foreground',
        destructive:'bg-destructive-solid text-destructive-foreground shadow-sm hover:brightness-110',
        'soft-success':'bg-success-soft text-success hover:brightness-[0.97] dark:hover:brightness-125',
        'soft-destructive':'bg-destructive-soft text-destructive hover:brightness-[0.97] dark:hover:brightness-125',
        link:'h-auto px-0 text-brand underline-offset-4 hover:underline active:scale-100'
      },
      size:{
        default:'h-10 px-4',
        sm:'h-8 rounded-md px-3 text-[13px]',
        lg:'h-11 px-5 text-[15px]',
        icon:'size-10',
        'icon-sm':'size-8 rounded-md'
      }
    },
    defaultVariants:{variant:'default',size:'default'}
  }
);

export type ButtonProps=ButtonHTMLAttributes<HTMLButtonElement>&VariantProps<typeof buttonVariants>&{asChild?:boolean};

export const Button=forwardRef<HTMLButtonElement,ButtonProps>(({className,variant,size,asChild=false,type,...props},ref)=>{
  const Comp=asChild?Slot:'button';
  return <Comp ref={ref} type={asChild?undefined:type??'button'} className={cn(buttonVariants({variant,size}),className)} {...props}/>;
});
Button.displayName='Button';
