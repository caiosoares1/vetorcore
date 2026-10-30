import type {ReactNode} from 'react';
import {Archive,ArrowDownToLine,ArrowUpFromLine,Mail,MapPin,Package,PenLine,Phone,RotateCcw,Search,Truck,Users} from 'lucide-react';
import type {Movement,Party,Product} from './RecordEditor';
import {Button} from './ui/button';
import {Badge} from './ui/display';
import {Input} from './ui/form';
import {bagSpecLabel,productMargin} from '../lib/domain';
import {cn} from '../lib/utils';

export const currency=(amount:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(amount);
const units=(n:number)=>n.toLocaleString('pt-BR');

export function SearchBox({value,onChange,placeholder,label}:{value:string;onChange:(value:string)=>void;placeholder:string;label:string}){
 return <div className="relative min-w-0 flex-1">
  <Search aria-hidden className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"/>
  <Input type="text" enterKeyHint="search" aria-label={label} placeholder={placeholder} value={value} onChange={e=>onChange(e.target.value)} className="h-10 pl-9"/>
 </div>;
}

/** Saldo com barra em relação ao mínimo: vermelho/âmbar quando chega ao mínimo. */
export function StockMeter({qty,min}:{qty:number;min:number}){
 const low=qty<=min;
 const ratio=min>0?Math.min(qty/(min*3),1):qty>0?1:0;
 return <div className="record-stock flex min-w-[120px] flex-col gap-1.5">
  <div className="flex items-baseline justify-between gap-2">
   <b className={cn('tabular text-[15px] font-bold',low?'text-warning':'text-foreground')}>{units(qty)} <small className="text-xs font-medium text-muted-foreground">un.</small></b>
   {low?<Badge variant="warning" className="stock-alert">Estoque baixo</Badge>:<span className="text-xs text-muted-foreground">mín. {units(min)}</span>}
  </div>
  <div className="h-1.5 overflow-hidden rounded-full bg-muted" aria-hidden><div className={cn('h-full rounded-full transition-[width]',low?'bg-orange':'bg-success')} style={{width:Math.max(ratio*100,qty>0?6:0)+'%'}}/></div>
 </div>;
}

function IconAction({label,onClick,children}:{label:string;onClick:()=>void;children:ReactNode}){
 return <Button variant="ghost" size="icon-sm" className="text-muted-foreground hover:text-foreground" aria-label={label} title={label} onClick={onClick}>{children}</Button>;
}

export function ProductRow({product:p,showCatalogActions,onEdit,onArchive,onMove}:{product:Product;showCatalogActions:boolean;onEdit:()=>void;onArchive:()=>void;onMove:(direction:'Entrada'|'Saída')=>void}){
 const spec=bagSpecLabel(p);
 const margin=productMargin(Math.round(p.cost*100),Math.round(p.price*100)).marginPct;
 const archived=Boolean(p.archivedAt);
 return <div className="record record-product grid grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-3 px-4 py-4 transition-colors hover:bg-muted/40 sm:px-5 md:grid-cols-[auto_minmax(0,1fr)_minmax(140px,180px)_auto] md:gap-x-5">
  <div className={cn('grid size-10 place-items-center rounded-xl bg-brand-soft text-brand',archived&&'bg-muted text-muted-foreground')}><Package className="size-[18px]"/></div>
  <div className="record-description min-w-0">
   <strong className="block truncate text-[15px] font-semibold text-foreground">{p.name}</strong>
   <small className="mt-0.5 block text-[13px] text-muted-foreground"><span className="font-mono text-[12px]">{p.sku}</span> · {p.category}{spec&&<> · {spec}</>}</small>
   <span className="record-subvalue mt-1.5 flex flex-wrap items-center gap-2 text-[13px]">
    <span className="tabular font-semibold text-foreground">{currency(p.price)} <span className="font-normal text-muted-foreground">/ un.</span></span>
    {showCatalogActions&&margin!==null&&<Badge variant={margin<0?'destructive':'success'} className="tabular">margem {margin.toLocaleString('pt-BR')}%</Badge>}
   </span>
  </div>
  <div className="col-span-2 md:col-span-1"><StockMeter qty={p.qty} min={p.min}/></div>
  <div className="record-actions col-span-2 flex items-center gap-1.5 md:col-span-1 md:justify-end">
   {!archived&&<>
    <Button variant="soft-success" size="sm" className="flex-1 md:flex-none" onClick={()=>onMove('Entrada')}><ArrowDownToLine/>Entrada</Button>
    <Button variant="soft-destructive" size="sm" className="flex-1 md:flex-none" onClick={()=>onMove('Saída')}><ArrowUpFromLine/>Saída</Button>
   </>}
   {showCatalogActions&&(archived
    ?<Button variant="outline" size="sm" onClick={onArchive}><RotateCcw/>Restaurar</Button>
    :<><span aria-hidden className="mx-0.5 h-5 w-px bg-border"/><IconAction label="Editar" onClick={onEdit}><PenLine/></IconAction><IconAction label="Arquivar" onClick={onArchive}><Archive/></IconAction></>)}
  </div>
 </div>;
}

const initials=(name:string)=>name.split(/\s+/).filter(w=>w.length>2||/^[A-ZÀ-Ú]/.test(w)).slice(0,2).map(w=>w[0]).join('').toUpperCase()||name.slice(0,1).toUpperCase();

export function PartyRow({party:p,kind,onEdit,onArchive}:{party:Party;kind:'customers'|'suppliers';onEdit:()=>void;onArchive:()=>void}){
 const archived=Boolean(p.archivedAt);
 const supplier=kind==='suppliers';
 const contact=[p.phone&&{Icon:Phone,text:p.phone,href:'tel:'+p.phone.replace(/[^\d+]/g,'')},p.email&&{Icon:Mail,text:p.email,href:'mailto:'+p.email}].filter(Boolean) as {Icon:typeof Phone;text:string;href:string}[];
 return <div className="record party-record grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-x-3 px-4 py-4 transition-colors hover:bg-muted/40 sm:px-5 md:items-center md:gap-x-4">
  <div className={cn('grid size-10 place-items-center rounded-full text-[13px] font-bold',archived?'bg-muted text-muted-foreground':supplier?'bg-orange-soft text-orange-text':'bg-brand-soft text-brand')} aria-hidden>{initials(p.name)}</div>
  <div className="record-description min-w-0">
   <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
    <strong className="truncate text-[15px] font-semibold text-foreground">{p.name}</strong>
    {supplier&&p.category&&<Badge variant="neutral">{p.category}</Badge>}
    {supplier&&p.pricePerKg!=null&&<Badge variant="orange" className="tabular">{currency(p.pricePerKg)}/kg</Badge>}
   </div>
   <small className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
    {contact.length?contact.map(({Icon,text,href})=><a key={href} href={href} className="inline-flex items-center gap-1.5 hover:text-brand"><Icon aria-hidden className="size-3.5"/>{text}</a>):<span>Sem contato informado</span>}
    {p.address&&<span className="inline-flex min-w-0 items-center gap-1.5"><MapPin aria-hidden className="size-3.5 shrink-0"/><span className="truncate">{p.address}</span></span>}
   </small>
   {p.doc&&<span className="record-subvalue mt-1 block font-mono text-[12px] text-muted-foreground">{p.doc}</span>}
  </div>
  <div className="record-actions flex items-center gap-1">
   {archived
    ?<Button variant="outline" size="sm" onClick={onArchive}><RotateCcw/>Restaurar</Button>
    :<><IconAction label="Editar" onClick={onEdit}><PenLine/></IconAction><IconAction label="Arquivar" onClick={onArchive}><Archive/></IconAction></>}
  </div>
 </div>;
}

export function HistoryRow({movement:m,productName,supplierName}:{movement:Movement;productName:string;supplierName?:string}){
 const entry=m.delta>0;
 const when=new Date(m.createdAt);
 return <div className="record history-record grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-x-3 px-4 py-3.5 sm:px-5">
  <div className={cn('grid size-9 place-items-center rounded-full',entry?'bg-success-soft text-success':'bg-destructive-soft text-destructive')}>{entry?<ArrowDownToLine className="size-4"/>:<ArrowUpFromLine className="size-4"/>}</div>
  <div className="record-description min-w-0">
   <strong className="block truncate text-sm font-semibold text-foreground">{productName}</strong>
   <small className="block text-[13px] text-muted-foreground">{when.toLocaleDateString('pt-BR')} às {when.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'})}{supplierName?' · '+supplierName:''}{m.unitCost!=null?' · '+currency(m.unitCost)+'/un.':''}{m.note?' · '+m.note:''}</small>
  </div>
  <b className={cn('tabular rounded-lg px-2 py-1 text-sm font-bold',entry?'delta-in bg-success-soft text-success':'delta-out bg-destructive-soft text-destructive')}>{entry?'+':''}{units(m.delta)} un.</b>
 </div>;
}

export const kindIcon={customers:Users,suppliers:Truck};
