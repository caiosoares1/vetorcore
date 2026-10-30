import type {ReactNode} from 'react';
import {AlertTriangle,ArrowDownToLine,ArrowDownUp,ArrowRight,ArrowUpFromLine,CheckCircle2,FilePlus2,Package,PackagePlus,RefreshCw,TrendingUp,UserPlus,Wallet,type LucideIcon} from 'lucide-react';
import type {Movement,Product} from './RecordEditor';
import {Button} from './ui/button';
import {Card,CardHeader,EmptyState,Skeleton} from './ui/display';
import {currency} from './Records';
import {cn} from '../lib/utils';
import {inventoryStats} from '../lib/domain';

function Stat({label,value,caption,Icon,tone='brand',loading}:{label:string;value:ReactNode;caption:ReactNode;Icon:LucideIcon;tone?:'brand'|'orange'|'warning'|'success';loading:boolean}){
 const tones={brand:'bg-brand-soft text-brand',orange:'bg-orange-soft text-orange-text',warning:'bg-warning-soft text-warning',success:'bg-success-soft text-success'};
 return <Card className="relative min-w-0 overflow-hidden p-4 sm:p-5">
  <div className="flex items-center justify-between gap-3">
   <span className="text-[13px] font-semibold text-muted-foreground">{label}</span>
   <span className={cn('grid size-9 place-items-center rounded-xl',tones[tone])}><Icon className="size-[18px]"/></span>
  </div>
  <div className="mt-3">
   {loading?<Skeleton className="h-8 w-24"/>:<strong className="tabular block truncate text-[clamp(18px,5.6vw,26px)] font-extrabold leading-tight tracking-tight text-foreground sm:text-[28px]">{value}</strong>}
   <span className="mt-1 block text-xs text-muted-foreground">{caption}</span>
  </div>
 </Card>;
}

function QuickAction({Icon,title,text,onClick}:{Icon:LucideIcon;title:string;text:string;onClick:()=>void}){
 return <button type="button" onClick={onClick} className="group flex min-w-0 items-center gap-3 rounded-xl border border-border bg-card p-3.5 text-left shadow-card transition-[border-color,transform,box-shadow] hover:-translate-y-0.5 hover:border-brand/40 hover:shadow-pop active:translate-y-0">
  <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary text-primary-foreground transition-colors group-hover:bg-primary-hover"><Icon className="size-[18px]"/></span>
  <span className="min-w-0 flex-1"><strong className="block text-sm font-bold text-foreground">{title}</strong><small className="block truncate text-xs text-muted-foreground">{text}</small></span>
  <ArrowRight aria-hidden className="size-4 text-muted-foreground transition-transform group-hover:translate-x-0.5 group-hover:text-brand"/>
 </button>;
}

export default function Dashboard({products,movements,loading,refreshing,syncedAt,onRefresh,onNewProduct,onOpenStock,onNewCustomer,onNewQuote,onRestock,onSeeProducts}:{
 products:Product[];movements:Movement[];loading:boolean;refreshing:boolean;syncedAt:Date|null;
 onRefresh:()=>void;onNewProduct:()=>void;onOpenStock:()=>void;onNewCustomer:()=>void;onNewQuote:()=>void;onRestock:(product:Product)=>void;onSeeProducts:()=>void;
}){
 const active=products.filter(p=>!p.archivedAt);
 const low=active.filter(p=>p.qty<=p.min).sort((a,b)=>a.qty-a.min-(b.qty-b.min));
 const {activeProducts,lowStock,inventoryCost}=inventoryStats(products);
 const saleValue=active.reduce((sum,p)=>sum+Math.round(p.price*100)*p.qty,0)/100;
 const byId=new Map(products.map(p=>[p.id,p]));
 const hour=new Date().getHours();
 const greeting=hour<12?'Bom dia':hour<18?'Boa tarde':'Boa noite';
 return <div className="space-y-6">
  <section className="relative overflow-hidden rounded-2xl bg-sidebar p-5 text-white shadow-card sm:p-7">
   <div aria-hidden className="absolute -right-20 -top-24 size-72 rounded-full bg-[radial-gradient(circle,rgba(255,134,43,0.38),transparent_65%)]"/>
   <div aria-hidden className="absolute -bottom-32 left-1/3 size-80 rounded-full bg-[radial-gradient(circle,rgba(110,116,255,0.32),transparent_65%)]"/>
   <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
    <div>
     <p className="text-xs font-bold uppercase tracking-[0.14em] text-orange">{greeting}</p>
     <h2 className="mt-1.5 text-2xl font-extrabold tracking-tight sm:text-[28px]">Bem-vindo ao Vetor Hub.</h2>
     <p className="mt-1 text-sm text-sidebar-foreground">Acompanhe sua operação em um só lugar.</p>
     <p className="mt-3 text-xs text-sidebar-muted">Última sincronização: {syncedAt?syncedAt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'carregando...'}</p>
    </div>
    <div className="flex gap-2">
     <Button variant="ghost" className="bg-white/10 text-white hover:bg-white/15 hover:text-white" disabled={refreshing} onClick={onRefresh}><RefreshCw className={refreshing?'spinning':''}/>Atualizar</Button>
     <Button variant="accent" onClick={onNewQuote}><FilePlus2/>Novo orçamento</Button>
    </div>
   </div>
  </section>

  <div className="grid grid-cols-2 gap-3 sm:gap-4 xl:grid-cols-4">
   <Stat label="Produtos ativos" value={loading?'—':activeProducts} caption="Itens no catálogo" Icon={Package} loading={loading}/>
   <Stat label="Estoque baixo" value={loading?'—':lowStock} caption={<span className={low.length?'stat-warning font-semibold text-warning':''}>{low.length?'Precisam de atenção':'Tudo em dia'}</span>} Icon={low.length?AlertTriangle:CheckCircle2} tone={low.length?'warning':'success'} loading={loading}/>
   <Stat label="Valor em estoque (custo)" value={loading?'—':currency(inventoryCost)} caption="Estimativa pelo custo cadastrado" Icon={Wallet} tone="orange" loading={loading}/>
   <Stat label="Potencial de venda" value={loading?'—':currency(saleValue)} caption="Saldo × preço de venda" Icon={TrendingUp} tone="success" loading={loading}/>
  </div>

  <section aria-labelledby="quick-title">
   <h2 id="quick-title" className="mb-3 text-[15px] font-bold text-foreground">Acesso rápido</h2>
   <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
    <QuickAction Icon={PackagePlus} title="Cadastrar produto" text="Adicionar ao catálogo" onClick={onNewProduct}/>
    <QuickAction Icon={ArrowDownUp} title="Movimentar estoque" text="Registrar entrada ou saída" onClick={onOpenStock}/>
    <QuickAction Icon={UserPlus} title="Novo cliente" text="Cadastrar contato" onClick={onNewCustomer}/>
    <QuickAction Icon={FilePlus2} title="Criar orçamento" text="Montar proposta para cliente" onClick={onNewQuote}/>
   </div>
  </section>

  <div className="grid gap-4 lg:grid-cols-2">
   <Card>
    <CardHeader title="Atenção ao estoque" description="Produtos no mínimo ou abaixo dele." action={<Button variant="ghost" size="sm" className="text-brand" onClick={onSeeProducts}>Ver produtos<ArrowRight/></Button>}/>
    {loading?<div className="space-y-3 p-5"><Skeleton className="h-10"/><Skeleton className="h-10"/></div>:!low.length?<EmptyState icon={<CheckCircle2/>} title="Estoque em dia" description="Nenhum produto ativo está abaixo do estoque mínimo."/>:
     <ul className="divide-y divide-border">{low.slice(0,6).map(p=><li key={p.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
      <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-warning-soft text-warning"><AlertTriangle className="size-4"/></span>
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-foreground">{p.name}</p><p className="tabular text-xs text-muted-foreground">{p.qty.toLocaleString('pt-BR')} un. em estoque · mínimo {p.min.toLocaleString('pt-BR')}</p></div>
      <Button variant="outline" size="sm" onClick={()=>onRestock(p)}><ArrowDownToLine/>Repor</Button>
     </li>)}</ul>}
   </Card>
   <Card>
    <CardHeader title="Últimas movimentações" description="Entradas e saídas mais recentes." action={<Button variant="ghost" size="sm" className="text-brand" onClick={onOpenStock}>Ver histórico<ArrowRight/></Button>}/>
    {loading?<div className="space-y-3 p-5"><Skeleton className="h-10"/><Skeleton className="h-10"/></div>:!movements.length?<EmptyState icon={<ArrowDownUp/>} title="Sem movimentações ainda" description="As entradas e saídas registradas aparecerão aqui."/>:
     <ul className="divide-y divide-border">{movements.slice(0,6).map(m=>{const entry=m.delta>0;return <li key={m.id} className="flex items-center gap-3 px-4 py-3 sm:px-5">
      <span className={cn('grid size-9 shrink-0 place-items-center rounded-full',entry?'bg-success-soft text-success':'bg-destructive-soft text-destructive')}>{entry?<ArrowDownToLine className="size-4"/>:<ArrowUpFromLine className="size-4"/>}</span>
      <div className="min-w-0 flex-1"><p className="truncate text-sm font-semibold text-foreground">{byId.get(m.productId)?.name||'Produto não encontrado'}</p><p className="text-xs text-muted-foreground">{new Date(m.createdAt).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'})}</p></div>
      <span className={cn('tabular text-sm font-bold',entry?'text-success':'text-destructive')}>{entry?'+':''}{m.delta.toLocaleString('pt-BR')} un.</span>
     </li>;})}</ul>}
   </Card>
  </div>
 </div>;
}
