import {useCallback,useEffect,useState,type FormEvent} from 'react';
import {Check,CheckCircle2,Download,FileText,Plus,RefreshCw,ShoppingBag,Trash2,X} from 'lucide-react';
import {supabase} from '../lib/supabase';
import EditorSheet from './EditorSheet';
import {fmtCents,quoteTotals,toCents} from '../lib/quoteMath';
import type {Party,Product} from './RecordEditor';

type QuoteLine={id:string;product_id:string|null;product_name:string;quantity:number;unit_price_cents:number};
type Quote={id:string;quote_number:number;customer_id:string;status:string;discount_cents:number;notes:string;created_at:string;quote_items:QuoteLine[]};
type Order={id:string;order_number:number;quote_id:string;customer_id:string;total_cents:number;status:string;created_at:string};
type DraftLine={id:string;productId:string;quantity:string};
type Props={mode:'quotes'|'orders';products:Product[];customers:Party[];onNotice:(msg:string)=>void};
const newLine=():DraftLine=>({id:crypto.randomUUID(),productId:'',quantity:'1'});
const shortDate=(iso:string)=>new Date(iso).toLocaleDateString('pt-BR');
const quoteNumber=(n:number)=>'#'+String(n).padStart(5,'0');
const friendlyError=(e:unknown)=>e instanceof Error?e.message:String(e);

async function savePdf(q:Quote,customer?:Party){
 const {jsPDF}=await import('jspdf');
 const pdf=new jsPDF({unit:'mm',format:'a4'});
 let y=23;
 pdf.setFont('helvetica','bold');pdf.setFontSize(20);pdf.setTextColor(55,59,149);pdf.text('VETOR EMBALAGENS',18,y);
 y+=9;pdf.setFont('helvetica','normal');pdf.setFontSize(11);pdf.setTextColor(51,61,80);pdf.text('Orcamento '+quoteNumber(q.quote_number),18,y);
 y+=9;pdf.text('Emissao: '+shortDate(q.created_at),18,y);
 y+=8;pdf.text('Cliente: '+(customer?.name||'Cliente'),18,y);
 if(customer?.doc){y+=7;pdf.text('Documento: '+customer.doc,18,y);}
 y+=14;pdf.setFont('helvetica','bold');pdf.text('Produto',18,y);pdf.text('Qtd.',117,y);pdf.text('Subtotal',153,y);y+=3;
 pdf.setDrawColor(222,226,233);pdf.line(18,y,192,y);y+=7;
 pdf.setFont('helvetica','normal');
 for(const item of q.quote_items){
  if(y>256){pdf.addPage();y=22;}
  const name=pdf.splitTextToSize(item.product_name,93);
  pdf.text(name,18,y);pdf.text(String(item.quantity),119,y);
  pdf.text(fmtCents(item.unit_price_cents*item.quantity),153,y);
  y+=Math.max(9,name.length*5.5);
 }
 if(y>260){pdf.addPage();y=20;}
 pdf.line(18,y,192,y);y+=9;
 const subtotal=q.quote_items.reduce((sum,item)=>sum+item.quantity*item.unit_price_cents,0);
 pdf.text('Subtotal: '+fmtCents(subtotal),18,y);y+=7;
 pdf.text('Desconto: '+fmtCents(q.discount_cents),18,y);y+=8;
 pdf.setFont('helvetica','bold');pdf.setFontSize(14);pdf.text('Total: '+fmtCents(subtotal-q.discount_cents),18,y);y+=13;
 if(q.notes){pdf.setFont('helvetica','normal');pdf.setFontSize(10);pdf.text(pdf.splitTextToSize('Observacoes: '+q.notes,168),18,y);}
 pdf.save('vetorcore-orcamento-'+q.quote_number+'.pdf');
}

function QuoteEditor({customers,products,onClose,onSaved}:{customers:Party[];products:Product[];onClose:()=>void;onSaved:()=>Promise<void>}){
 const[customerId,setCustomerId]=useState('');
 const[lines,setLines]=useState<DraftLine[]>([newLine()]);
 const[discount,setDiscount]=useState('0');
 const[notes,setNotes]=useState('');
 const[pending,setPending]=useState(false);
 const[error,setError]=useState('');
 const[selected,setSelected]=useState<{quantity:number;unitPriceCents:number}[]>([]);
 useEffect(()=>{
  setSelected(lines.flatMap(l=>{
   const product=products.find(p=>p.id===l.productId);
   const qty=Number(l.quantity);
   return product&&Number.isSafeInteger(qty)&&qty>0?[{quantity:qty,unitPriceCents:Math.round(product.price*100)}]:[];
  }));
 },[lines,products]);
 let total=0;let subtotal=0;
 try{const r=quoteTotals(selected,toCents(discount));subtotal=r.subtotal;total=r.total;}catch{ /* Display inline validation on submit. */ }
 const update=(id:string,patch:Partial<DraftLine>)=>setLines(old=>old.map(l=>l.id===id?{...l,...patch}:l));
 async function submit(event:FormEvent){
  event.preventDefault();const client=supabase;if(!client)return;
  setError('');
  try{
   if(!customerId)throw new Error('Selecione um cliente.');
   if(lines.some(l=>!l.productId||!Number.isSafeInteger(Number(l.quantity))||Number(l.quantity)<1))throw new Error('Selecione um produto e uma quantidade válida em cada item.');
   const ids=lines.map(l=>l.productId);
   if(new Set(ids).size!==ids.length)throw new Error('Um produto não pode aparecer duas vezes no mesmo orçamento.');
   const discountCents=toCents(discount);
   if(selected.length!==lines.length)throw new Error('Revise os itens do orçamento.');
   quoteTotals(selected,discountCents);
   setPending(true);
   const {error}=await client.rpc('create_quote_with_items',{p_customer_id:customerId,p_items:lines.map(l=>({product_id:l.productId,quantity:Number(l.quantity)})),p_discount_cents:discountCents,p_notes:notes});
   if(error)throw error;
   await onSaved();
  }catch(e){setError(friendlyError(e));}
  finally{setPending(false);}
 }
 return <EditorSheet title="Novo orçamento" description="Monte uma proposta com preços registrados e itens definidos." onClose={onClose} busy={pending}>
   <form className="editor-form" onSubmit={submit}>
    <div className="editor-body commerce-form">
     <div className="form-section-title"><FileText size={18}/> Dados da proposta</div>
     <div className="form-field"><label htmlFor="quote-customer">Cliente *</label><select required id="quote-customer" value={customerId} onChange={e=>setCustomerId(e.target.value)}><option value="">Selecione um cliente</option>{customers.filter(c=>!c.archivedAt).map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
     {!customers.length&&<p className="commerce-help">Cadastre um cliente antes de criar orçamentos.</p>}
     <div className="form-divider"/>
     <div className="form-section-title"><ShoppingBag size={18}/> Itens do orçamento</div>
     {lines.map((l,index)=><div className="quote-line" key={l.id}>
      <div className="quote-line-title"><strong>Item {index+1}</strong>{lines.length>1&&<button type="button" onClick={()=>setLines(old=>old.filter(x=>x.id!==l.id))} aria-label={'Remover item '+(index+1)}><Trash2 size={16}/></button>}</div>
      <div className="form-field"><label htmlFor={'item-product-'+l.id}>Produto *</label><select required id={'item-product-'+l.id} value={l.productId} onChange={e=>update(l.id,{productId:e.target.value})}><option value="">Selecione um produto</option>{products.filter(p=>!p.archivedAt).map(p=><option key={p.id} value={p.id}>{p.name} — {fmtCents(Math.round(p.price*100))}</option>)}</select></div>
      <div className="quote-line-bottom"><div className="form-field"><label htmlFor={'item-qty-'+l.id}>Quantidade *</label><input id={'item-qty-'+l.id} required min={1} max={9999999} step={1} type="number" inputMode="numeric" value={l.quantity} onChange={e=>update(l.id,{quantity:e.target.value})}/></div><div className="line-total"><span>Subtotal do item</span><strong>{fmtCents((Number(l.quantity)||0)*Math.round((products.find(p=>p.id===l.productId)?.price||0)*100))}</strong></div></div>
     </div>)}
     <button className="button-secondary commerce-add-line" type="button" onClick={()=>setLines(old=>[...old,newLine()])} disabled={lines.length>=100}><Plus size={17}/> Adicionar produto</button>
     <div className="form-divider"/>
     <div className="form-field"><label htmlFor="quote-discount">Desconto total (R$)</label><input id="quote-discount" inputMode="decimal" type="text" required value={discount} onChange={e=>setDiscount(e.target.value)}/></div>
     <div className="form-field"><label htmlFor="quote-notes">Observações</label><textarea id="quote-notes" rows={3} maxLength={2000} value={notes} onChange={e=>setNotes(e.target.value)} placeholder="Prazo, condições de pagamento, entrega..."/></div>
     <div className="quote-totals"><span>Subtotal <strong>{fmtCents(subtotal)}</strong></span><span className="total-final">Total da proposta <strong>{fmtCents(total)}</strong></span></div>
     {error&&<div className="form-error" role="alert">{error}</div>}
    </div>
    <div className="editor-actions"><button type="button" className="button-secondary editor-cancel" disabled={pending} onClick={onClose}>Cancelar</button><button className="button-primary editor-submit" type="submit" disabled={pending||!products.length||!customers.length}>{pending?'Salvando…':'Criar orçamento'}</button></div>
   </form>
 </EditorSheet>;
}
export default function CommercePages({mode,products,customers,onNotice}:Props){
 const[quotes,setQuotes]=useState<Quote[]>([]);
 const[orders,setOrders]=useState<Order[]>([]);
 const[loading,setLoading]=useState(true);
 const[creating,setCreating]=useState(false);
 const[busy,setBusy]=useState('');
 const[error,setError]=useState('');
 const[filter,setFilter]=useState('');
 const reload=useCallback(async()=>{
  const client=supabase;if(!client)return;
  setLoading(true);setError('');
  const [qs,os]=await Promise.all([
   client.from('quotes').select('id,quote_number,customer_id,status,discount_cents,notes,created_at,quote_items(id,product_id,product_name,quantity,unit_price_cents)').order('created_at',{ascending:false}),
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
 const filteredQuotes=quotes.filter(q=>(name(q.customer_id)+' '+q.quote_number+' '+q.status).toLocaleLowerCase('pt-BR').includes(filter.toLocaleLowerCase('pt-BR')));
 const filteredOrders=orders.filter(o=>(name(o.customer_id)+' '+o.order_number+' '+o.status).toLocaleLowerCase('pt-BR').includes(filter.toLocaleLowerCase('pt-BR')));
 return <div className="content-page">
  <div className="page-heading"><div><h2>{mode==='quotes'?'Orçamentos':'Pedidos'}</h2><p>{mode==='quotes'?'Propostas comerciais, aprovação e conversão em pedidos.':'Acompanhe pedidos aprovados e sua conclusão.'}</p></div>{mode==='quotes'&&<button className="button-primary add-button" type="button" onClick={()=>setCreating(true)}><Plus size={17}/> Novo orçamento</button>}</div>
  <div className="filter-row"><label className="search-control"><span className="commerce-search-label">Buscar</span><input aria-label="Buscar propostas ou pedidos" placeholder="Cliente, número ou status" value={filter} onChange={e=>setFilter(e.target.value)}/></label><button type="button" className="button-icon" onClick={()=>void reload()} aria-label="Atualizar" disabled={loading}><RefreshCw size={18}/></button></div>
  {error&&<div className="app-error" role="alert"><span>{error}</span><button onClick={()=>setError('')} aria-label="Fechar"><X size={17}/></button></div>}
  <section className="panel data-panel"><div className="data-heading"><span>{mode==='quotes'?'Propostas cadastradas':'Pedidos cadastrados'}</span><small>{mode==='quotes'?filteredQuotes.length:filteredOrders.length} registros</small></div>
   {loading?<div className="commerce-loading">Carregando dados…</div>:mode==='quotes'?filteredQuotes.length?filteredQuotes.map(q=>{
    const subtotal=q.quote_items.reduce((sum,l)=>sum+l.unit_price_cents*l.quantity,0);
    const total=subtotal-q.discount_cents;
    const hasOrder=orders.some(o=>o.quote_id===q.id);
    return <div className="commerce-record" key={q.id}>
     <div className="commerce-record-header"><div><small>ORÇAMENTO {quoteNumber(q.quote_number)} · {shortDate(q.created_at)}</small><h3>{name(q.customer_id)}</h3></div><span className={'commerce-status s-'+q.status.toLowerCase()}>{q.status}</span></div>
     <div className="commerce-summary"><span>{q.quote_items.length} {q.quote_items.length===1?'item':'itens'}</span><strong>{fmtCents(total)}</strong></div>
     <div className="commerce-buttons"><button className="button-secondary" type="button" onClick={()=>void savePdf(q,customers.find(c=>c.id===q.customer_id)).catch(e=>setError(friendlyError(e)))}><Download size={16}/> PDF</button>
      {!hasOrder&&<select className="commerce-select" aria-label={'Alterar status '+q.quote_number} value={q.status} disabled={Boolean(busy)} onChange={e=>{const status=e.target.value;void execute(q.id,()=>supabase!.rpc('set_quote_status',{p_quote_id:q.id,p_status:status}),'Status atualizado.');}}><option>Rascunho</option><option>Enviado</option><option>Aprovado</option><option>Recusado</option></select>}
      {q.status==='Aprovado'&&!hasOrder&&<button className="button-primary" type="button" disabled={Boolean(busy)} onClick={()=>void execute(q.id,()=>supabase!.rpc('create_order_from_quote',{p_quote_id:q.id}),'Pedido criado com sucesso.')}><ShoppingBag size={16}/> Gerar pedido</button>}
      {hasOrder&&<span className="commerce-converted"><CheckCircle2 size={16}/> Convertido em pedido</span>}
     </div>
    </div>;
   }):<div className="commerce-loading">Ainda não há orçamentos. Cadastre um cliente e um produto para começar.</div>:filteredOrders.length?filteredOrders.map(o=><div className="commerce-record" key={o.id}>
    <div className="commerce-record-header"><div><small>PEDIDO #{String(o.order_number).padStart(5,'0')} · {shortDate(o.created_at)}</small><h3>{name(o.customer_id)}</h3></div><span className={'commerce-status '+(o.status==='Concluído'?'s-aprovado':'s-enviado')}>{o.status}</span></div>
    <div className="commerce-summary"><span>Gerado a partir de orçamento aprovado</span><strong>{fmtCents(o.total_cents)}</strong></div>
    <div className="commerce-buttons">{o.status!=='Concluído'&&<button className="button-primary" type="button" disabled={Boolean(busy)} onClick={()=>void execute(o.id,()=>supabase!.rpc('set_order_status',{p_order_id:o.id,p_status:'Concluído'}),'Pedido concluído.') }><Check size={16}/> Marcar concluído</button>}<span className="commerce-caption">Pedidos não debitam o estoque automaticamente.</span></div>
   </div>):<div className="commerce-loading">Nenhum pedido ainda. Aprove um orçamento para gerar o primeiro.</div>}
  </section>
  {creating&&<QuoteEditor products={products} customers={customers} onClose={()=>setCreating(false)} onSaved={async()=>{await reload();setCreating(false);onNotice('Orçamento criado com sucesso.');}}/>}
 </div>;
}
