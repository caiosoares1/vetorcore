import {useCallback,useContext,useEffect,useMemo,useState} from 'react';
import {Archive,ArrowDownUp,Package,Plus,RefreshCw,RotateCcw,Truck,Users} from 'lucide-react';
import {supabase} from './lib/supabase';
import RecordEditor,{type Product,type Party,type Movement,type EditorTarget} from './components/RecordEditor';
import CommercePages from './components/CommercePages';
import UsersPage from './components/UsersPage';
import Dashboard from './components/Dashboard';
import BagCalculator from './components/BagCalculator';
import Shell,{type Page} from './components/Shell';
import {HistoryRow,PartyRow,ProductRow,SearchBox} from './components/Records';
import {Button} from './components/ui/button';
import {Card,CardHeader,EmptyState,ListSkeleton,Segmented} from './components/ui/display';
import {ConfirmDialog} from './components/ui/overlays';
import {ErrorBanner,Toast} from './components/ui/toast';
import {MemberRoleContext} from './AuthGate';
import {errorMessage} from './lib/domain';
import {cn} from './lib/utils';

type ArchiveTarget={table:'products'|'customers'|'suppliers';id:string;name:string;archived:boolean};
const count=(n:number,one:string,many:string)=>n+' '+(n===1?one:many);

export default function App(){
 const role=useContext(MemberRoleContext);
 const [page,setPage]=useState<Page>('home');
 const [products,setProducts]=useState<Product[]>([]);
 const [customers,setCustomers]=useState<Party[]>([]);
 const [suppliers,setSuppliers]=useState<Party[]>([]);
 const [movements,setMovements]=useState<Movement[]>([]);
 const [loading,setLoading]=useState(true);
 const [refreshing,setRefreshing]=useState(false);
 const [error,setError]=useState('');
 const [toast,setToast]=useState('');
 const [search,setSearch]=useState('');
 const [editor,setEditor]=useState<EditorTarget|null>(null);
 const [showArchived,setShowArchived]=useState(false);
 const [lowOnly,setLowOnly]=useState(false);
 const [historyFilter,setHistoryFilter]=useState<'all'|'in'|'out'>('all');
 const [archiveTarget,setArchiveTarget]=useState<ArchiveTarget|null>(null);
 const [archiveBusy,setArchiveBusy]=useState(false);
 const [syncedAt,setSyncedAt]=useState<Date|null>(null);
 const [pendingQuote,setPendingQuote]=useState(false);
 const quoteHandled=useCallback(()=>setPendingQuote(false),[]);

 async function refresh(isManual=false){
   const client=supabase;
   if(!client){setError('O Supabase não está configurado.');setLoading(false);return;}
   if(isManual)setRefreshing(true);else setLoading(true);
   setError('');
   try{
     const [p,c,s,m]=await Promise.all([
       client.from('products').select('id,name,sku,category,cost_cents,price_cents,qty,min_qty,supplier_id,archived_at,model,width_cm,height_cm,gusset_cm,thickness_mm').order('name'),
       client.from('customers').select('id,name,doc,phone,email,address,archived_at').order('name'),
       client.from('suppliers').select('id,name,doc,phone,email,address,category,price_per_kg_cents,archived_at').order('name'),
       client.from('stock_movements').select('id,product_id,kind,delta,note,created_at,unit_cost_cents,supplier_id').order('created_at',{ascending:false}).limit(100)
     ]);
     const failure=[p.error,c.error,s.error,m.error].find(Boolean);
     if(failure)throw failure;
     const num=(v:unknown)=>v==null||v===''?null:Number(v);
     setProducts((p.data||[]).map(x=>({id:x.id,name:x.name,sku:x.sku,category:x.category,cost:x.cost_cents/100,price:x.price_cents/100,qty:x.qty,min:x.min_qty,supplierId:x.supplier_id,archivedAt:x.archived_at,model:x.model||'',width:num(x.width_cm),height:num(x.height_cm),gusset:num(x.gusset_cm),thickness:num(x.thickness_mm)})));
     setCustomers((c.data||[]).map(x=>({id:x.id,name:x.name,doc:x.doc||'',phone:x.phone||'',email:x.email||'',address:x.address||'',archivedAt:x.archived_at})));
     setSuppliers((s.data||[]).map(x=>({id:x.id,name:x.name,doc:x.doc||'',phone:x.phone||'',email:x.email||'',address:x.address||'',category:x.category||'',pricePerKg:x.price_per_kg_cents==null?null:x.price_per_kg_cents/100,archivedAt:x.archived_at})));
     setMovements((m.data||[]).map(x=>({id:x.id,productId:x.product_id,kind:x.kind,delta:x.delta,note:x.note||'',createdAt:x.created_at,unitCost:x.unit_cost_cents==null?null:x.unit_cost_cents/100,supplierId:x.supplier_id})));
     setSyncedAt(new Date());
   }catch(e){setError(errorMessage(e,'Falha ao atualizar os dados.'));}
   finally{setLoading(false);setRefreshing(false);}
 }
 useEffect(()=>{void refresh();},[]);
 useEffect(()=>{if(!toast)return;const timer=window.setTimeout(()=>setToast(''),4400);return()=>window.clearTimeout(timer);},[toast]);

 const filtered=useMemo(()=>{
   const q=search.toLocaleLowerCase('pt-BR').trim();
   const has=(text:string)=>text.toLocaleLowerCase('pt-BR').includes(q);
   const state=(item:{archivedAt?:string|null})=>Boolean(item.archivedAt)===showArchived;
   return {
     products:products.filter(p=>state(p)&&(!lowOnly||p.qty<=p.min)&&has(p.name+' '+p.sku+' '+p.category+' '+(p.model||''))),
     customers:customers.filter(p=>state(p)&&has(p.name+' '+p.doc+' '+p.phone+' '+p.email+' '+(p.address||''))),
     suppliers:suppliers.filter(p=>state(p)&&has(p.name+' '+p.doc+' '+(p.category||'')))
   };
 },[products,customers,suppliers,search,showArchived,lowOnly]);

 function navigate(next:Page){setPage(next);setSearch('');setShowArchived(false);setLowOnly(false);setHistoryFilter('all');window.scrollTo({top:0,behavior:'smooth'});}
 function create(){if(page==='products')setEditor({kind:'product'});if(page==='customers')setEditor({kind:'party',table:'customers'});if(page==='suppliers')setEditor({kind:'party',table:'suppliers'});}
 async function saved(message:string){await refresh(true);setEditor(null);setToast(message);}
 async function archiveRecord(){const target=archiveTarget,client=supabase;if(!target||!client)return;setArchiveBusy(true);setError('');try{const {error}=await client.from(target.table).update({archived_at:target.archived?null:new Date().toISOString()}).eq('id',target.id).select('id').single();if(error)throw error;await refresh(true);setArchiveTarget(null);setToast(target.archived?'Cadastro restaurado.':'Cadastro arquivado.');}catch(e){setError(errorMessage(e,'Falha ao alterar cadastro.'));setArchiveTarget(null);}finally{setArchiveBusy(false);}}

 const move=(product:Product,direction:'Entrada'|'Saída')=>setEditor({kind:'movement',product,direction});
 const editorKey=editor?.kind==='product'?'product-'+(editor.item?.id||'new'):editor?.kind==='party'?editor.table+'-'+(editor.item?.id||'new'):editor?.kind==='movement'?'move-'+editor.product.id+'-'+editor.direction:'';
 const productById=new Map(products.map(p=>[p.id,p]));
 const supplierById=new Map(suppliers.map(s=>[s.id,s]));
 const catalog=page==='products'||page==='customers'||page==='suppliers';
 const all={products,customers,suppliers}[page as 'products'|'customers'|'suppliers']||[];
 const activeCount=all.filter(x=>!x.archivedAt).length;
 const lowCount=products.filter(p=>!p.archivedAt&&p.qty<=p.min).length;
 const history=movements.filter(m=>historyFilter==='all'||(historyFilter==='in'?m.delta>0:m.delta<0));
 const addLabel=page==='products'?'Novo produto':page==='customers'?'Novo cliente':'Novo fornecedor';
 const reload=<Button variant="outline" size="icon" title="Recarregar" aria-label="Recarregar" disabled={refreshing} onClick={()=>void refresh(true)}><RefreshCw className={refreshing?'spinning':''}/></Button>;

 let content;
 if(page==='home'){
   content=<Dashboard products={products} movements={movements} loading={loading} refreshing={refreshing} syncedAt={syncedAt} onRefresh={()=>void refresh(true)}
     onNewProduct={()=>{navigate('products');setEditor({kind:'product'});}} onOpenStock={()=>navigate('moves')} onNewCustomer={()=>{navigate('customers');setEditor({kind:'party',table:'customers'});}}
     onNewQuote={()=>{navigate('quotes');setPendingQuote(true);}} onRestock={p=>move(p,'Entrada')} onSeeProducts={()=>{navigate('products');setLowOnly(true);}}/>;
 }else if(page==='calculator'){
   content=<BagCalculator suppliers={suppliers} onNotice={setToast}/>;
 }else if(page==='users'&&role==='admin'){
   content=<UsersPage onNotice={setToast}/>;
 }else if(page==='quotes'||page==='orders'){
   content=<CommercePages key={page} mode={page} products={products} customers={customers} onNotice={setToast} startCreating={page==='quotes'&&pendingQuote} onCreateHandled={quoteHandled}/>;
 }else{
   const productList=(page==='products'||page==='moves')&&<Card className="overflow-hidden">
     <CardHeader title={page==='products'?(showArchived?'Produtos arquivados':'Produtos cadastrados'):'Produtos disponíveis'} description={page==='moves'?'Escolha um produto para registrar entrada ou saída.':undefined} action={<span className="tabular text-xs font-semibold text-muted-foreground">{count(filtered.products.length,'registro','registros')}</span>}/>
     {loading&&!products.length?<ListSkeleton/>:filtered.products.length===0
       ?<EmptyState icon={<Package/>} title={products.length?'Nenhum resultado encontrado':'Seu catálogo começa aqui'} description={products.length?'Tente outro termo de busca ou ajuste os filtros.':'Cadastre um produto para começar a controlar entradas e saídas.'}
          action={page==='products'&&!products.length?<Button onClick={()=>setEditor({kind:'product'})}><Plus/>Cadastrar produto</Button>:undefined}/>
       :<div className="divide-y divide-border">{filtered.products.map(p=><ProductRow key={p.id} product={p} showCatalogActions={page==='products'}
          onEdit={()=>setEditor({kind:'product',item:p})} onArchive={()=>setArchiveTarget({table:'products',id:p.id,name:p.name,archived:Boolean(p.archivedAt)})} onMove={direction=>move(p,direction)}/>)}</div>}
   </Card>;
   const partyKind=page==='customers'||page==='suppliers'?page:null;
   content=<div className="space-y-5">
     <div className="page-heading flex flex-col gap-3 md:flex-row md:items-center">
       <SearchBox label="Buscar registros" value={search} onChange={setSearch} placeholder={page==='products'||page==='moves'?'Buscar por produto, código ou categoria':page==='customers'?'Buscar por nome, documento, telefone ou endereço':'Buscar por nome, documento ou categoria'}/>
       <div className="flex flex-wrap items-center gap-2">
         {catalog&&<Segmented label="Situação do cadastro" value={showArchived?'archived':'active'} onChange={v=>{setShowArchived(v==='archived');setLowOnly(false);}}
           options={[{value:'active',label:'Ativos',count:activeCount},{value:'archived',label:'Arquivados',count:all.length-activeCount}]}/>}
         {(page==='products'||page==='moves')&&!showArchived&&<Button variant="outline" aria-pressed={lowOnly} onClick={()=>setLowOnly(v=>!v)}
           className={cn(lowOnly&&'border-warning/50 bg-warning-soft text-warning hover:bg-warning-soft hover:text-warning')}>Estoque baixo{lowCount>0&&<span className="tabular rounded-full bg-orange px-1.5 text-[11px] text-[#1d1004]">{lowCount}</span>}</Button>}
         {reload}
         {catalog&&<Button className="add-button ml-auto md:ml-0" onClick={create}><Plus/><span>{addLabel}</span></Button>}
       </div>
     </div>
     {productList}
     {page==='moves'&&<Card className="movement-history overflow-hidden">
       <CardHeader title="Movimentações recentes" description="Últimas 100 entradas e saídas." action={<Segmented label="Tipo de movimentação" value={historyFilter} onChange={setHistoryFilter}
         options={[{value:'all',label:'Todas'},{value:'in',label:'Entradas'},{value:'out',label:'Saídas'}]}/>} className="flex-col sm:flex-row"/>
       {loading&&!movements.length?<ListSkeleton rows={3}/>:!history.length?<EmptyState icon={<ArrowDownUp/>} title={movements.length?'Nada neste filtro':'Sem movimentações ainda'} description={movements.length?'Mude o filtro para ver outras movimentações.':'As entradas e saídas realizadas no app aparecerão aqui.'}/>
         :<div className="divide-y divide-border">{history.map(m=><HistoryRow key={m.id} movement={m} productName={productById.get(m.productId)?.name||'Produto não encontrado'} supplierName={m.supplierId?supplierById.get(m.supplierId)?.name:undefined}/>)}</div>}
     </Card>}
     {partyKind&&<Card className="overflow-hidden">
       <CardHeader title={(partyKind==='customers'?'Clientes':'Fornecedores')+(showArchived?' arquivados':' cadastrados')} action={<span className="tabular text-xs font-semibold text-muted-foreground">{count(filtered[partyKind].length,'registro','registros')}</span>}/>
       {loading&&!all.length?<ListSkeleton/>:filtered[partyKind].length===0
         ?<EmptyState icon={partyKind==='customers'?<Users/>:<Truck/>} title={all.length?'Nenhum resultado encontrado':'Nenhum cadastro ainda'} description={all.length?'Tente outra busca.':'Comece adicionando seu primeiro cadastro.'}
            action={!all.length?<Button onClick={create}><Plus/>{partyKind==='customers'?'Cadastrar cliente':'Cadastrar fornecedor'}</Button>:undefined}/>
         :<div className="divide-y divide-border">{filtered[partyKind].map(p=><PartyRow key={p.id} party={p} kind={partyKind}
            onEdit={()=>setEditor({kind:'party',table:partyKind,item:p})} onArchive={()=>setArchiveTarget({table:partyKind,id:p.id,name:p.name,archived:Boolean(p.archivedAt)})}/>)}</div>}
     </Card>}
   </div>;
 }

 return <Shell page={page} role={role} onNavigate={navigate} syncedAt={syncedAt} refreshing={refreshing} onRefresh={()=>void refresh(true)}>
   {error&&<div className="mb-5"><ErrorBanner message={error} onDismiss={()=>setError('')}/></div>}
   {content}
   <Toast message={toast} onDismiss={()=>setToast('')}/>
   <ConfirmDialog open={Boolean(archiveTarget)} busy={archiveBusy} onCancel={()=>setArchiveTarget(null)} onConfirm={()=>void archiveRecord()}
     icon={archiveTarget?.archived?<RotateCcw/>:<Archive/>}
     title={archiveTarget?.archived?'Restaurar cadastro?':'Arquivar cadastro?'} subject={archiveTarget?.name}
     body={archiveTarget?.archived?'O cadastro voltará à lista de ativos.':'O cadastro será ocultado, mas seu histórico será preservado.'}
     confirmLabel={archiveTarget?.archived?'Restaurar':'Confirmar arquivamento'}/>
   {editor&&<RecordEditor key={editorKey} target={editor} suppliers={suppliers.filter(p=>!p.archivedAt)} onClose={()=>setEditor(null)} onSaved={saved}/>}
 </Shell>;
}
