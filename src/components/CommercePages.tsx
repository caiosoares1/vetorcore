import {useCallback,useEffect,useState,type FormEvent} from 'react';
import {Calculator,CalendarDays,Check,CheckCircle2,ClipboardList,Download,FileText,Info,Loader2,Plus,RefreshCw,ShoppingBag,Trash2,Truck} from 'lucide-react';
import {supabase} from '../lib/supabase';
import {Sheet,SheetBody,SheetFooter} from './ui/overlays';
import {Button} from './ui/button';
import {Badge,Card,CardHeader,EmptyState,ListSkeleton,Segmented} from './ui/display';
import {Field,FormError,Input,MoneyInput,NativeSelect,SectionTitle,Textarea} from './ui/form';
import {ErrorBanner} from './ui/toast';
import {SearchBox} from './Records';
import {fmtCents,quoteTotals,toCents,unitPriceLabel} from '../lib/quoteMath';
import {COMPANY} from '../lib/company';
import {validateQuoteDraft,quoteCanBecomeOrder,errorMessage} from '../lib/domain';
import {cn} from '../lib/utils';
import type {Party,Product} from './RecordEditor';
import type {CalculatedLine} from './BagCalculator';

type QuoteLine={id:string;product_id:string|null;product_name:string;quantity:number;unit_price_cents:number;line_total_cents?:number|null};
type Quote={id:string;quote_number:number;customer_id:string;status:string;discount_cents:number;notes:string;created_at:string;delivery_date:string|null;freight_cents:number|null;payment_terms:string|null;quote_items:QuoteLine[]};
type Order={id:string;order_number:number;quote_id:string;customer_id:string;total_cents:number;status:string;created_at:string};
// Linha do editor: produto do catálogo ou sacola calculada (total exato vindo da calculadora, quantidade fixa).
type DraftLine={id:string;kind:'product';productId:string;quantity:string}|{id:string;kind:'custom';description:string;quantity:string;lineTotalCents:number};
type Props={mode:'quotes'|'orders';products:Product[];customers:Party[];onNotice:(msg:string)=>void;startCreating?:boolean;initialLine?:CalculatedLine|null;onCreateHandled?:()=>void};
const newLine=():DraftLine=>({id:crypto.randomUUID(),kind:'product',productId:'',quantity:'1'});
const customLine=(line:CalculatedLine):DraftLine=>({id:crypto.randomUUID(),kind:'custom',description:line.description,quantity:String(line.quantity),lineTotalCents:line.lineTotalCents});
/** Total de um item salvo: total exato (sacola calculada) ou quantidade × unitário. */
const itemTotal=(l:QuoteLine)=>l.line_total_cents??l.unit_price_cents*l.quantity;
const shortDate=(iso:string)=>new Date(iso).toLocaleDateString('pt-BR');
const plainDate=(day:string)=>day.split('-').reverse().join('/');
const quoteTotal=(q:Quote)=>q.quote_items.reduce((sum,l)=>sum+itemTotal(l),0)-q.discount_cents+(q.freight_cents||0);
const quoteNumber=(n:number)=>'#'+String(n).padStart(5,'0');
const friendlyError=(e:unknown)=>errorMessage(e,'Não foi possível concluir a operação.');
const QUOTE_STATUSES=['Rascunho','Enviado','Aprovado','Recusado'] as const;
const statusVariant=(status:string):'neutral'|'default'|'success'|'destructive'|'orange'=>({Rascunho:'neutral',Enviado:'default',Aprovado:'success',Recusado:'destructive','Em separação':'orange','Concluído':'success'} as Record<string,'neutral'|'default'|'success'|'destructive'|'orange'>)[status]||'neutral';

async function savePdf(q:Quote,customer?:Party){
 const {jsPDF}=await import('jspdf');
 const pdf=new jsPDF({unit:'mm',format:'a4'});
 let y=23;
 pdf.setFont('helvetica','bold');pdf.setFontSize(20);pdf.setTextColor(54,56,144);pdf.text(COMPANY.name,18,y);
 pdf.setDrawColor(255,134,43);pdf.setLineWidth(1.2);pdf.line(18,y+3,52,y+3);pdf.setLineWidth(0.2);
 // Dados da empresa à direita do nome, como no cabeçalho da aba PEDIDO.
 pdf.setFont('helvetica','normal');pdf.setFontSize(9);pdf.setTextColor(102,112,133);
 pdf.text(['CNPJ '+COMPANY.cnpj,COMPANY.address,'Telefone '+COMPANY.phone],192,y-6,{align:'right'});
 y+=11;pdf.setFontSize(11);pdf.setTextColor(51,61,80);pdf.text('Orçamento '+quoteNumber(q.quote_number),18,y);
 y+=9;pdf.text('Emissão: '+shortDate(q.created_at),18,y);
 if(q.delivery_date){y+=7;pdf.text('Entrega prevista: '+plainDate(q.delivery_date),18,y);}
 y+=8;pdf.text('Cliente: '+(customer?.name||'Cliente'),18,y);
 if(customer?.doc){y+=7;pdf.text('Documento: '+customer.doc,18,y);}
 if(customer?.phone){y+=7;pdf.text('Telefone: '+customer.phone,18,y);}
 if(customer?.address){const lines=pdf.splitTextToSize('Endereço: '+customer.address,174);y+=7;pdf.text(lines,18,y);y+=(lines.length-1)*5.5;}
 y+=14;pdf.setFont('helvetica','bold');pdf.text('Produto',18,y);pdf.text('Qtd.',124,y,{align:'right'});pdf.text('Valor unit.',160,y,{align:'right'});pdf.text('Subtotal',192,y,{align:'right'});y+=3;
 pdf.setDrawColor(222,226,233);pdf.line(18,y,192,y);y+=7;
 pdf.setFont('helvetica','normal');
 for(const item of q.quote_items){
  if(y>256){pdf.addPage();y=22;}
  const name=pdf.splitTextToSize(item.product_name,88);
  pdf.text(name,18,y);pdf.text(item.quantity.toLocaleString('pt-BR'),124,y,{align:'right'});
  pdf.text(unitPriceLabel({quantity:item.quantity,unitPriceCents:item.unit_price_cents,lineTotalCents:item.line_total_cents}),160,y,{align:'right'});
  pdf.text(fmtCents(itemTotal(item)),192,y,{align:'right'});
  y+=Math.max(9,name.length*5.5);
 }
 if(y>260){pdf.addPage();y=20;}
 pdf.line(18,y,192,y);y+=9;
 const subtotal=q.quote_items.reduce((sum,item)=>sum+itemTotal(item),0);
 pdf.text('Subtotal: '+fmtCents(subtotal),18,y);y+=7;
 pdf.text('Desconto: '+fmtCents(q.discount_cents),18,y);y+=7;
 if(q.freight_cents){pdf.text('Frete: '+fmtCents(q.freight_cents),18,y);y+=7;}
 y+=1;pdf.setFont('helvetica','bold');pdf.setFontSize(14);pdf.setTextColor(54,56,144);pdf.text('Total: '+fmtCents(subtotal-q.discount_cents+(q.freight_cents||0)),18,y);y+=13;
 pdf.setFont('helvetica','normal');pdf.setFontSize(10);pdf.setTextColor(51,61,80);
 if(q.payment_terms){const lines=pdf.splitTextToSize('Forma de pagamento: '+q.payment_terms,168);pdf.text(lines,18,y);y+=lines.length*5+4;}
 if(q.notes){pdf.text(pdf.splitTextToSize('Observações: '+q.notes,168),18,y);}
 pdf.save('vetorcore-orcamento-'+q.quote_number+'.pdf');
}

function QuoteEditor({customers,products,initialLine,onClose,onSaved}:{customers:Party[];products:Product[];initialLine?:CalculatedLine|null;onClose:()=>void;onSaved:()=>Promise<void>}){
 const[customerId,setCustomerId]=useState('');
 const[lines,setLines]=useState<DraftLine[]>(()=>[initialLine?customLine(initialLine):newLine()]);
 const[discount,setDiscount]=useState('0');
 const[notes,setNotes]=useState('');
 const[freight,setFreight]=useState('');
 const[deliveryDate,setDeliveryDate]=useState('');
 const[paymentTerms,setPaymentTerms]=useState('');
 const[pending,setPending]=useState(false);
 const[error,setError]=useState('');
 const activeCustomers=customers.filter(c=>!c.archivedAt);
 const activeProducts=products.filter(p=>!p.archivedAt);
 const hasCustom=lines.some(l=>l.kind==='custom');
 const selected=lines.flatMap(l=>{
  const qty=Number(l.quantity);
  if(!Number.isSafeInteger(qty)||qty<=0)return [];
  if(l.kind==='custom')return [{quantity:qty,unitPriceCents:Math.round(l.lineTotalCents/qty),lineTotalCents:l.lineTotalCents}];
  const product=products.find(p=>p.id===l.productId);
  return product?[{quantity:qty,unitPriceCents:Math.round(product.price*100)}]:[];
 });
 let total=0;let subtotal=0;
 try{const r=quoteTotals(selected,toCents(discount),freight.trim()?toCents(freight):0);subtotal=r.subtotal;total=r.total;}catch{ /* Display inline validation on submit. */ }
 const update=(id:string,patch:{productId?:string;quantity?:string})=>setLines(old=>old.map(l=>l.id===id?{...l,...patch} as DraftLine:l));
 async function submit(event:FormEvent){
  event.preventDefault();const client=supabase;if(!client)return;
  setError('');
  try{
   const draft=validateQuoteDraft(customerId,lines.map(l=>l.kind==='custom'?{description:l.description,quantity:l.quantity,lineTotalCents:l.lineTotalCents}:{productId:l.productId,quantity:l.quantity}),discount,products,customers,{freight,deliveryDate,paymentTerms,today:new Date().toLocaleDateString('sv-SE')});
   setPending(true);
   const {error}=await client.rpc('create_quote_with_items',{p_customer_id:draft.customerId,p_items:draft.items,p_discount_cents:draft.discountCents,p_notes:notes,p_delivery_date:draft.deliveryDate,p_freight_cents:draft.freightCents,p_payment_terms:draft.paymentTerms});
   if(error)throw error;
   await onSaved();
  }catch(e){setError(friendlyError(e));}
  finally{setPending(false);}
 }
 const section='space-y-4 rounded-xl border border-border bg-card p-4 shadow-card sm:p-5';
 return <Sheet title="Novo orçamento" eyebrow="Comercial" description="Monte uma proposta com preços registrados e itens definidos." onClose={onClose} busy={pending} className="sm:w-[640px]">
   <form className="editor-form flex min-h-0 flex-1 flex-col" onSubmit={submit}>
    <SheetBody className="space-y-4">
     {(!activeCustomers.length||(!activeProducts.length&&!hasCustom))&&<div className="flex gap-2.5 rounded-lg border border-warning/30 bg-warning-soft px-3.5 py-3 text-[13px] text-warning"><Info className="mt-0.5 size-4 shrink-0"/><span>{!activeCustomers.length?'Cadastre um cliente antes de criar orçamentos.':'Cadastre um produto antes de criar orçamentos.'}</span></div>}
     <section className={section}>
      <SectionTitle icon={<FileText/>}>Dados da proposta</SectionTitle>
      <Field id="quote-customer" label="Cliente *"><NativeSelect required id="quote-customer" value={customerId} onChange={e=>setCustomerId(e.target.value)}><option value="">Selecione um cliente</option>{activeCustomers.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</NativeSelect></Field>
     </section>
     <section className={section}>
      <div className="flex items-center justify-between gap-3"><SectionTitle icon={<ShoppingBag/>}>Itens do orçamento</SectionTitle><Badge variant="neutral" className="tabular">{lines.length} {lines.length===1?'item':'itens'}</Badge></div>
      <div className="space-y-3">{lines.map((l,index)=>{
       const header=<div className="mb-3 flex items-center justify-between"><span className="text-xs font-bold uppercase tracking-[0.1em] text-muted-foreground">Item {index+1}</span>{lines.length>1&&<Button variant="ghost" size="icon-sm" className="-my-1 text-muted-foreground hover:text-destructive" onClick={()=>setLines(old=>old.filter(x=>x.id!==l.id))} aria-label={'Remover item '+(index+1)}><Trash2/></Button>}</div>;
       if(l.kind==='custom')return <div className="quote-line quote-line-custom rounded-lg border border-brand/30 bg-brand-soft/40 p-3.5" key={l.id}>
        {header}
        <p className="text-sm font-semibold text-foreground">{l.description}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[13px] text-muted-foreground"><span className="tabular">{Number(l.quantity).toLocaleString('pt-BR')} un.</span><Badge><Calculator/>Calculado na calculadora</Badge></div>
        <div className="line-total mt-3 flex items-center justify-between border-t border-dashed border-border pt-2.5 text-[13px]"><span className="text-muted-foreground">Total do item</span><strong className="tabular font-bold text-foreground">{fmtCents(l.lineTotalCents)}</strong></div>
       </div>;
       const product=products.find(p=>p.id===l.productId);const lineTotal=(Number(l.quantity)||0)*Math.round((product?.price||0)*100);
       return <div className="quote-line rounded-lg border border-border bg-background/60 p-3.5" key={l.id}>
       {header}
       <div className="grid gap-3 sm:grid-cols-[minmax(0,1fr)_120px]">
        <Field id={'item-product-'+l.id} label="Produto *"><NativeSelect required id={'item-product-'+l.id} value={l.productId} onChange={e=>update(l.id,{productId:e.target.value})}><option value="">Selecione um produto</option>{activeProducts.map(p=><option key={p.id} value={p.id}>{p.name} — {fmtCents(Math.round(p.price*100))}</option>)}</NativeSelect></Field>
        <Field id={'item-qty-'+l.id} label="Quantidade *"><Input id={'item-qty-'+l.id} className="tabular" required min={1} max={9999999} step={1} type="number" inputMode="numeric" value={l.quantity} onChange={e=>update(l.id,{quantity:e.target.value})}/></Field>
       </div>
       <div className="line-total mt-3 flex items-center justify-between border-t border-dashed border-border pt-2.5 text-[13px]"><span className="text-muted-foreground">{product?fmtCents(Math.round(product.price*100))+' × '+(Number(l.quantity)||0):'Subtotal do item'}</span><strong className="tabular font-bold text-foreground">{fmtCents(lineTotal)}</strong></div>
      </div>;})}</div>
      <Button variant="outline" className="commerce-add-line w-full border-dashed" onClick={()=>setLines(old=>[...old,newLine()])} disabled={lines.length>=100}><Plus/>Adicionar produto</Button>
     </section>
     <section className={section}>
      <SectionTitle icon={<Truck/>}>Condições</SectionTitle>
      <div className="grid gap-4 sm:grid-cols-2">
       <Field id="quote-discount" label="Desconto total (R$)"><MoneyInput id="quote-discount" required value={discount} onChange={e=>setDiscount(e.target.value)}/></Field>
       <Field id="quote-freight" label="Frete (R$)"><MoneyInput id="quote-freight" value={freight} onChange={e=>setFreight(e.target.value)} placeholder="0,00"/></Field>
      </div>
      <Field id="quote-delivery" label="Data de entrega"><Input id="quote-delivery" type="date" value={deliveryDate} onChange={e=>setDeliveryDate(e.target.value)}/></Field>
      <Field id="quote-payment" label="Forma de pagamento"><Input id="quote-payment" list="quote-payment-options" maxLength={500} value={paymentTerms} onChange={e=>setPaymentTerms(e.target.value)} placeholder="Ex.: 50% de entrada e o restante na entrega"/><datalist id="quote-payment-options"><option value="Entrada de 50% e o restante na entrega do pedido"/><option value="3x no cartão com 5% de acréscimo"/><option value="À vista"/></datalist></Field>
      <Field id="quote-notes" label="Observações"><Textarea id="quote-notes" rows={3} maxLength={2000} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Detalhes de impressão, cores, acabamento..."/></Field>
     </section>
     <FormError message={error}/>
    </SheetBody>
    <div className="quote-totals border-t border-border bg-card px-4 pt-3 sm:px-6">
     <div className="flex items-center justify-between text-[13px] text-muted-foreground"><span>Subtotal</span><span className="tabular font-semibold text-foreground">{fmtCents(subtotal)}</span></div>
     <div className="total-final mt-1 flex items-center justify-between"><span className="text-sm font-bold text-foreground">Total da proposta</span><strong className="tabular text-xl font-extrabold text-brand">{fmtCents(total)}</strong></div>
    </div>
    <SheetFooter className="border-t-0"><Button variant="outline" className="editor-cancel" disabled={pending} onClick={onClose}>Cancelar</Button><Button type="submit" className="editor-submit" disabled={pending||(!products.length&&!hasCustom)||!customers.length}>{pending&&<Loader2 className="spinning"/>}{pending?'Salvando…':'Criar orçamento'}</Button></SheetFooter>
   </form>
 </Sheet>;
}

export default function CommercePages({mode,products,customers,onNotice,startCreating=false,initialLine=null,onCreateHandled}:Props){
 const[quotes,setQuotes]=useState<Quote[]>([]);
 const[orders,setOrders]=useState<Order[]>([]);
 const[loading,setLoading]=useState(true);
 const[creating,setCreating]=useState(false);
 const[creatingLine,setCreatingLine]=useState<CalculatedLine|null>(null);
 const[busy,setBusy]=useState('');
 const[error,setError]=useState('');
 const[filter,setFilter]=useState('');
 const[statusFilter,setStatusFilter]=useState('all');
 // O atalho "Novo orçamento" do início abre o formulário uma única vez.
 useEffect(()=>{if(startCreating){setCreatingLine(initialLine);setCreating(true);onCreateHandled?.();}},[startCreating,initialLine,onCreateHandled]);
 const reload=useCallback(async()=>{
  const client=supabase;if(!client)return;
  setLoading(true);setError('');
  const [qs,os]=await Promise.all([
   client.from('quotes').select('id,quote_number,customer_id,status,discount_cents,notes,created_at,delivery_date,freight_cents,payment_terms,quote_items(id,product_id,product_name,quantity,unit_price_cents,line_total_cents)').order('created_at',{ascending:false}),
   client.from('orders').select('id,order_number,quote_id,customer_id,total_cents,status,created_at').order('created_at',{ascending:false})
  ]);
  if(qs.error||os.error)setError(qs.error?.message||os.error?.message||'Falha na consulta');
  else{
   setQuotes((qs.data||[]) as Quote[]);
   setOrders((os.data||[]) as Order[]);
  }
  setLoading(false);
 },[]);
 useEffect(()=>{void reload();},[reload]);
 const name=(id:string)=>customers.find(c=>c.id===id)?.name||'Cliente não encontrado';
 async function execute(label:string,action:()=>PromiseLike<{error: {message:string}|null}>,message:string){
  setBusy(label);setError('');
  try{
   const result=await action();
   if(result.error)throw new Error(result.error.message);
   await reload();
   onNotice(message);
  }catch(e){setError(friendlyError(e));}
  finally{setBusy('');}
 }
 const text=(s:string)=>s.toLocaleLowerCase('pt-BR');
 const matchesQuote=(q:Quote)=>text(name(q.customer_id)+' '+q.quote_number+' '+q.status).includes(text(filter));
 const matchesOrder=(o:Order)=>text(name(o.customer_id)+' '+o.order_number+' '+o.status).includes(text(filter));
 const filteredQuotes=quotes.filter(q=>matchesQuote(q)&&(statusFilter==='all'||q.status===statusFilter));
 const filteredOrders=orders.filter(o=>matchesOrder(o)&&(statusFilter==='all'||(statusFilter==='done'?o.status==='Concluído':o.status!=='Concluído')));
 const quoteOptions=[{value:'all',label:'Todos',count:quotes.length},...QUOTE_STATUSES.map(s=>({value:s,label:s+'s',count:quotes.filter(q=>q.status===s).length}))];
 const orderOptions=[{value:'all',label:'Todos',count:orders.length},{value:'open',label:'Em andamento',count:orders.filter(o=>o.status!=='Concluído').length},{value:'done',label:'Concluídos',count:orders.filter(o=>o.status==='Concluído').length}];
 const shown=mode==='quotes'?filteredQuotes.length:filteredOrders.length;

 return <div className="space-y-5">
  <div className="page-heading flex flex-col gap-3 md:flex-row md:items-center">
   <SearchBox label="Buscar propostas ou pedidos" value={filter} onChange={setFilter} placeholder="Cliente, número ou status"/>
   <div className="flex items-center gap-2">
    <Button variant="outline" size="icon" onClick={()=>void reload()} aria-label="Atualizar" title="Atualizar" disabled={loading}><RefreshCw className={loading?'spinning':''}/></Button>
    {mode==='quotes'&&<Button className="add-button ml-auto md:ml-0" onClick={()=>{setCreatingLine(null);setCreating(true);}}><Plus/>Novo orçamento</Button>}
   </div>
  </div>
  <Segmented label={mode==='quotes'?'Filtrar por status':'Filtrar pedidos'} value={statusFilter} onChange={setStatusFilter} options={mode==='quotes'?quoteOptions:orderOptions}/>
  <ErrorBanner message={error} onDismiss={()=>setError('')}/>
  <Card className="overflow-hidden">
   <CardHeader title={mode==='quotes'?'Propostas cadastradas':'Pedidos cadastrados'} action={<span className="tabular text-xs font-semibold text-muted-foreground">{shown} {shown===1?'registro':'registros'}</span>}/>
   {loading&&!quotes.length&&!orders.length?<ListSkeleton rows={3} label="Carregando dados…"/>:mode==='quotes'?filteredQuotes.length?<div className="divide-y divide-border">{filteredQuotes.map(q=>{
    const total=quoteTotal(q);
    const hasOrder=orders.some(o=>o.quote_id===q.id);
    return <article className="commerce-record px-4 py-4 sm:px-5" key={q.id}>
     <div className="flex items-start gap-3">
      <span className="hidden size-10 shrink-0 place-items-center rounded-xl bg-brand-soft text-brand sm:grid"><FileText className="size-[18px]"/></span>
      <div className="min-w-0 flex-1">
       <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
         <small className="block text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">ORÇAMENTO {quoteNumber(q.quote_number)} · {shortDate(q.created_at)}</small>
         <h3 className="truncate text-[15px] font-bold text-foreground">{name(q.customer_id)}</h3>
        </div>
        <Badge variant={statusVariant(q.status)} className="commerce-status">{q.status}</Badge>
       </div>
       <div className="mt-2 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
        <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground">
         <span className="inline-flex items-center gap-1.5"><ShoppingBag className="size-3.5"/>{q.quote_items.length} {q.quote_items.length===1?'item':'itens'}</span>
         {q.delivery_date&&<span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5"/>entrega {plainDate(q.delivery_date)}</span>}
         {q.freight_cents?<span className="inline-flex items-center gap-1.5"><Truck className="size-3.5"/>frete {fmtCents(q.freight_cents)}</span>:null}
        </span>
        <strong className="tabular text-lg font-extrabold text-foreground">{fmtCents(total)}</strong>
       </div>
       <div className="mt-3 flex flex-wrap items-center gap-2">
        <Button variant="outline" size="sm" onClick={()=>void savePdf(q,customers.find(c=>c.id===q.customer_id)).catch(e=>setError(friendlyError(e)))}><Download/>PDF</Button>
        {!hasOrder&&<NativeSelect wrapperClassName="w-auto" className="commerce-select h-8 w-[150px] text-[13px]" aria-label={'Alterar status '+q.quote_number} value={q.status} disabled={Boolean(busy)} onChange={e=>{const status=e.target.value;void execute(q.id,()=>supabase!.rpc('set_quote_status',{p_quote_id:q.id,p_status:status}),'Status atualizado.');}}>{QUOTE_STATUSES.map(s=><option key={s}>{s}</option>)}</NativeSelect>}
        {quoteCanBecomeOrder(q.status,hasOrder)&&<Button size="sm" disabled={Boolean(busy)} onClick={()=>void execute(q.id,()=>supabase!.rpc('create_order_from_quote',{p_quote_id:q.id}),'Pedido criado com sucesso.')}>{busy===q.id?<Loader2 className="spinning"/>:<ClipboardList/>}Gerar pedido</Button>}
        {hasOrder&&<span className="commerce-converted inline-flex items-center gap-1.5 text-[13px] font-semibold text-success"><CheckCircle2 className="size-4"/>Convertido em pedido</span>}
       </div>
      </div>
     </div>
    </article>;
   })}</div>:<EmptyState icon={<FileText/>} title={quotes.length?'Nenhum orçamento encontrado':'Nenhum orçamento ainda'} description={quotes.length?'Tente outra busca ou outro status.':'Cadastre um cliente e um produto para começar.'}/>
   :filteredOrders.length?<div className="divide-y divide-border">{filteredOrders.map(o=>{const delivery=quotes.find(q=>q.id===o.quote_id)?.delivery_date;const done=o.status==='Concluído';return <article className="commerce-record px-4 py-4 sm:px-5" key={o.id}>
    <div className="flex items-start gap-3">
     <span className={cn('hidden size-10 shrink-0 place-items-center rounded-xl sm:grid',done?'bg-success-soft text-success':'bg-orange-soft text-orange-text')}>{done?<CheckCircle2 className="size-[18px]"/>:<ClipboardList className="size-[18px]"/>}</span>
     <div className="min-w-0 flex-1">
      <div className="flex items-start justify-between gap-3">
       <div className="min-w-0">
        <small className="block text-[11px] font-bold uppercase tracking-[0.1em] text-muted-foreground">PEDIDO #{String(o.order_number).padStart(5,'0')} · {shortDate(o.created_at)}</small>
        <h3 className="truncate text-[15px] font-bold text-foreground">{name(o.customer_id)}</h3>
       </div>
       <Badge variant={statusVariant(o.status)} className="commerce-status">{o.status}</Badge>
      </div>
      <div className="mt-2 flex flex-wrap items-end justify-between gap-x-4 gap-y-2">
       <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-muted-foreground"><span>Gerado a partir de orçamento aprovado</span>{delivery&&<span className="inline-flex items-center gap-1.5"><CalendarDays className="size-3.5"/>entrega {plainDate(delivery)}</span>}</span>
       <strong className="tabular text-lg font-extrabold text-foreground">{fmtCents(o.total_cents)}</strong>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-2">
       {!done&&<Button size="sm" disabled={Boolean(busy)} onClick={()=>void execute(o.id,()=>supabase!.rpc('set_order_status',{p_order_id:o.id,p_status:'Concluído'}),'Pedido concluído.')}>{busy===o.id?<Loader2 className="spinning"/>:<Check/>}Marcar concluído</Button>}
       <span className="commerce-caption inline-flex items-center gap-1.5 text-xs text-muted-foreground"><Info className="size-3.5"/>Pedidos não debitam o estoque automaticamente.</span>
      </div>
     </div>
    </div>
   </article>;})}</div>:<EmptyState icon={<ClipboardList/>} title={orders.length?'Nenhum pedido encontrado':'Nenhum pedido ainda'} description={orders.length?'Tente outra busca ou outro filtro.':'Aprove um orçamento para gerar o primeiro.'}/>}
  </Card>
  {creating&&<QuoteEditor products={products} customers={customers} initialLine={creatingLine} onClose={()=>setCreating(false)} onSaved={async()=>{await reload();setCreating(false);onNotice('Orçamento criado com sucesso.');}}/>}
 </div>;
}
