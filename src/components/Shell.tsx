import {useContext,useState,type ReactNode} from 'react';
import * as DialogPrimitive from '@radix-ui/react-dialog';
import {ArrowDownUp,ChevronRight,ClipboardList,FileText,LayoutDashboard,LogOut,MoreHorizontal,Package,RefreshCw,ShieldCheck,Truck,Users,type LucideIcon} from 'lucide-react';
import {AccountContext} from '../AuthGate';
import ThemeToggle from './ThemeToggle';
import {Badge} from './ui/display';
import {DropdownMenu,DropdownMenuContent,DropdownMenuItem,DropdownMenuLabel,DropdownMenuSeparator,DropdownMenuTrigger} from './ui/overlays';
import {cn} from '../lib/utils';
import type {MemberRole} from '../lib/domain';

export type Page='home'|'products'|'quotes'|'orders'|'suppliers'|'customers'|'moves'|'users';
type PageInfo={label:string;title:string;description:string;Icon:LucideIcon;group:string};

export const PAGES:Record<Page,PageInfo>={
 home:{label:'Início',title:'Início',description:'Visão geral da operação da Vetor Embalagens.',Icon:LayoutDashboard,group:'Visão geral'},
 quotes:{label:'Orçamentos',title:'Orçamentos',description:'Propostas comerciais, aprovação e conversão em pedidos.',Icon:FileText,group:'Comercial'},
 orders:{label:'Pedidos',title:'Pedidos',description:'Acompanhe pedidos aprovados e sua conclusão.',Icon:ClipboardList,group:'Comercial'},
 customers:{label:'Clientes',title:'Clientes',description:'Cadastre e organize seus contatos comerciais.',Icon:Users,group:'Comercial'},
 products:{label:'Produtos',title:'Produtos',description:'Gerencie preços, categorias, medidas e quantidades.',Icon:Package,group:'Operação'},
 moves:{label:'Estoque',title:'Estoque',description:'Registre cada entrada e saída com rastreabilidade.',Icon:ArrowDownUp,group:'Operação'},
 suppliers:{label:'Fornecedores',title:'Fornecedores',description:'Tenha os dados dos seus parceiros à mão.',Icon:Truck,group:'Operação'},
 users:{label:'Usuários',title:'Usuários e convites',description:'Controle quem acessa o Vetor Hub. Novas contas entram só com convite.',Icon:ShieldCheck,group:'Administração'}
};
const GROUPS:{label:string;pages:Page[]}[]=[
 {label:'Visão geral',pages:['home']},
 {label:'Comercial',pages:['quotes','orders','customers']},
 {label:'Operação',pages:['products','moves','suppliers']},
 {label:'Administração',pages:['users']}
];
// No celular, as quatro telas mais usadas ficam na barra; o resto vai em "Mais".
const MOBILE_PRIMARY:Page[]=['home','products','quotes','moves'];

const initials=(email:string)=>(email.split('@')[0].split(/[._-]+/).filter(Boolean).slice(0,2).map(s=>s[0]).join('')||'VH').toUpperCase();
const time=(d:Date)=>d.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'});

function AccountMenu({role}:{role:MemberRole}){
 const{email,signOut}=useContext(AccountContext);
 return <DropdownMenu>
  <DropdownMenuTrigger asChild>
   <button type="button" aria-label="Menu da conta" className="flex items-center gap-2 rounded-full p-0.5 pr-0.5 transition-colors hover:bg-accent sm:pr-2.5">
    <span className="grid size-9 place-items-center rounded-full bg-primary text-[13px] font-bold text-primary-foreground ring-2 ring-orange/70 ring-offset-2 ring-offset-background">{initials(email)}</span>
    <span className="hidden max-w-[160px] truncate text-sm font-semibold text-foreground sm:block">{email.split('@')[0]}</span>
   </button>
  </DropdownMenuTrigger>
  <DropdownMenuContent className="w-64">
   <DropdownMenuLabel>
    <span className="block truncate text-sm font-semibold text-foreground">{email}</span>
    <Badge variant={role==='admin'?'orange':'neutral'} className="mt-1.5">{role==='admin'?<><ShieldCheck/>Administrador</>:'Membro'}</Badge>
   </DropdownMenuLabel>
   <DropdownMenuSeparator/>
   <DropdownMenuItem destructive onSelect={()=>void signOut()}><LogOut/>Sair da conta</DropdownMenuItem>
  </DropdownMenuContent>
 </DropdownMenu>;
}

function MoreSheet({pages,current,onNavigate}:{pages:Page[];current:Page;onNavigate:(page:Page)=>void}){
 const[open,setOpen]=useState(false);
 const active=pages.includes(current);
 return <DialogPrimitive.Root open={open} onOpenChange={setOpen}>
  <DialogPrimitive.Trigger asChild>
   <button type="button" className={cn('nav-tab',active&&'is-active')} aria-current={active?'page':undefined}><MoreHorizontal className="size-[21px]"/><span>Mais</span></button>
  </DialogPrimitive.Trigger>
  <DialogPrimitive.Portal>
   <DialogPrimitive.Overlay className="animate-overlay fixed inset-0 z-50 bg-[#0b0c1d]/45 backdrop-blur-[2px]"/>
   <DialogPrimitive.Content className="animate-sheet-bottom fixed inset-x-0 bottom-0 z-50 rounded-t-3xl border-t border-border bg-card px-4 pt-3 pb-[max(20px,env(safe-area-inset-bottom))] shadow-pop outline-none">
    <div aria-hidden className="mx-auto mb-4 h-1.5 w-10 rounded-full bg-border"/>
    <DialogPrimitive.Title className="px-2 text-base font-bold text-foreground">Mais opções</DialogPrimitive.Title>
    <DialogPrimitive.Description className="px-2 text-sm text-muted-foreground">Outras áreas do Vetor Hub.</DialogPrimitive.Description>
    <div className="mt-3 grid gap-1">
     {pages.map(key=>{const{label,Icon,description}=PAGES[key];return <button key={key} type="button" aria-current={current===key?'page':undefined} aria-label={label} aria-describedby={'more-desc-'+key} onClick={()=>{setOpen(false);onNavigate(key);}}
      className={cn('flex items-center gap-3 rounded-xl px-2 py-2.5 text-left transition-colors hover:bg-accent',current===key&&'bg-brand-soft')}>
      <span className={cn('grid size-10 shrink-0 place-items-center rounded-xl bg-muted text-muted-foreground',current===key&&'bg-primary text-primary-foreground')}><Icon className="size-5"/></span>
      <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold text-foreground">{label}</span><span id={'more-desc-'+key} className="block truncate text-xs text-muted-foreground">{description}</span></span>
      <ChevronRight aria-hidden className="size-4 text-muted-foreground"/>
     </button>;})}
    </div>
   </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
 </DialogPrimitive.Root>;
}

export default function Shell({page,role,onNavigate,syncedAt,refreshing,onRefresh,children}:{page:Page;role:MemberRole;onNavigate:(page:Page)=>void;syncedAt:Date|null;refreshing:boolean;onRefresh:()=>void;children:ReactNode}){
 const visible=(key:Page)=>key!=='users'||role==='admin';
 const info=PAGES[page];
 const more=(Object.keys(PAGES) as Page[]).filter(key=>visible(key)&&!MOBILE_PRIMARY.includes(key));
 return <div className="min-h-dvh bg-background lg:pl-[264px]">
  <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col bg-sidebar text-sidebar-foreground lg:flex">
   <div className="flex items-center gap-3 px-6 pb-6 pt-7">
    <img src="/icon.svg" alt="Vetor" className="size-10 rounded-xl shadow-[0_6px_16px_-6px_rgba(0,0,0,0.5)]"/>
    <div><p className="text-[19px] font-extrabold leading-none text-white">Vetor <span className="text-orange">Hub</span></p><p className="mt-1.5 text-[10px] font-semibold tracking-[0.18em] text-sidebar-muted">VETOR EMBALAGENS</p></div>
   </div>
   <nav aria-label="Navegação principal" className="flex-1 overflow-y-auto px-3 pb-4">
    {GROUPS.map(group=>{const pages=group.pages.filter(visible);if(!pages.length)return null;return <div key={group.label} className="mb-5">
     <p className="px-3 pb-2 text-[10.5px] font-bold uppercase tracking-[0.14em] text-sidebar-muted">{group.label}</p>
     <div className="grid gap-0.5">{pages.map(key=>{const{label,Icon}=PAGES[key];const active=page===key;return <button key={key} type="button" aria-current={active?'page':undefined} onClick={()=>onNavigate(key)}
      className={cn('group relative flex h-10 items-center gap-3 rounded-lg px-3 text-left text-sm font-semibold transition-colors hover:bg-sidebar-hover hover:text-white',active&&'bg-white/[0.09] text-sidebar-active')}>
      {active&&<span aria-hidden className="absolute -left-3 top-2 bottom-2 w-1 rounded-r-full bg-orange"/>}
      <Icon className={cn('size-[18px] shrink-0',active?'text-orange':'text-sidebar-muted group-hover:text-sidebar-foreground')}/>
      <span>{label}</span>
     </button>;})}</div>
    </div>;})}
   </nav>
   <div className="m-3 rounded-xl bg-white/[0.06] p-3">
    <div className="flex items-center gap-3">
     <span className="relative flex size-2.5 shrink-0"><span className="absolute inline-flex size-full animate-ping rounded-full bg-emerald-400 opacity-50"/><span className="relative inline-flex size-2.5 rounded-full bg-emerald-400"/></span>
     <div className="min-w-0 flex-1 text-xs leading-snug"><p className="font-semibold text-white">Conectado ao Supabase</p><p className="text-sidebar-muted">{syncedAt?'Sincronizado às '+time(syncedAt):'Sincronizando…'}</p></div>
     <button type="button" onClick={onRefresh} disabled={refreshing} aria-label="Sincronizar dados" title="Sincronizar dados" className="grid size-8 place-items-center rounded-lg text-sidebar-foreground transition-colors hover:bg-white/10 hover:text-white disabled:opacity-50"><RefreshCw className={cn('size-4',refreshing&&'spinning')}/></button>
    </div>
   </div>
  </aside>

  <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur-md supports-[backdrop-filter]:bg-background/70">
   <div className="mx-auto flex h-16 max-w-[1280px] items-center gap-3 px-4 sm:px-6 lg:px-8">
    <img src="/icon.svg" alt="" className="size-8 rounded-lg lg:hidden"/>
    <div className="min-w-0 flex-1">
     <p className="hidden text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground sm:block">{info.group}</p>
     <h1 className="truncate text-lg font-extrabold leading-tight tracking-tight text-foreground sm:text-xl">{info.title}</h1>
    </div>
    <ThemeToggle/>
    <AccountMenu role={role}/>
   </div>
  </header>

  <main className="mx-auto w-full max-w-[1280px] px-4 pb-[calc(96px+env(safe-area-inset-bottom))] pt-5 sm:px-6 sm:pt-6 lg:px-8 lg:pb-12">
   {page!=='home'&&<p className="mb-5 hidden text-sm text-muted-foreground sm:block">{info.description}</p>}
   {children}
  </main>

  <nav aria-label="Navegação mobile" className="fixed inset-x-0 bottom-0 z-30 flex flex-row border-t border-border bg-card/95 px-1 pb-[env(safe-area-inset-bottom)] backdrop-blur-md lg:hidden">
   {MOBILE_PRIMARY.map(key=>{const{label,Icon}=PAGES[key];return <button key={key} type="button" className={cn('nav-tab',page===key&&'is-active')} aria-current={page===key?'page':undefined} onClick={()=>onNavigate(key)}><Icon className="size-[21px]"/><span>{label}</span></button>;})}
   <MoreSheet pages={more} current={page} onNavigate={onNavigate}/>
  </nav>
 </div>;
}
