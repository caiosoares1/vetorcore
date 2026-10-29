import {useEffect,useMemo,useState} from 'react';
import {AlertCircle,ArrowDownCircle,ArrowUpCircle,ArrowDownUp,Box,CheckCircle2,ChevronRight,FileText,LayoutDashboard,Package,PenLine,Plus,RefreshCw,Search,Truck,Users,X} from 'lucide-react';
import {supabase} from './lib/supabase';
import RecordEditor,{type Product,type Party,type Movement,type EditorTarget} from './components/RecordEditor';

type Page='home'|'products'|'quotes'|'suppliers'|'customers'|'moves';
const navItems=[
  {key:'home',label:'Início',Icon:LayoutDashboard},
  {key:'products',label:'Produtos',Icon:Package},
  {key:'quotes',label:'Orçamentos',Icon:FileText},
  {key:'suppliers',label:'Fornecedores',Icon:Truck},
  {key:'customers',label:'Clientes',Icon:Users},
  {key:'moves',label:'Estoque',Icon:ArrowDownUp}
] as const;
const currency=(amount:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(amount);

function EmptyState({title,description,onAction,actionLabel}:{title:string;description:string;onAction?:()=>void;actionLabel?:string}){
  return <div className="empty-state"><div className="empty-icon"><Box size={26}/></div><h3>{title}</h3><p>{description}</p>{onAction&&<button className="button-primary" type="button" onClick={onAction}><Plus size={17}/>{actionLabel||'Adicionar'}</button>}</div>;
}

export default function App(){
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
 const [syncedAt,setSyncedAt]=useState<Date|null>(null);

 async function refresh(isManual=false){
   const client=supabase;
   if(!client){setError('O Supabase não está configurado.');setLoading(false);return;}
   if(isManual)setRefreshing(true);else setLoading(true);
   setError('');
   try{
     const [p,c,s,m]=await Promise.all([
       client.from('products').select('id,name,sku,category,cost_cents,price_cents,qty,min_qty,supplier_id').order('name'),
       client.from('customers').select('id,name,doc,phone,email').order('name'),
       client.from('suppliers').select('id,name,doc,phone,email,category').order('name'),
       client.from('stock_movements').select('id,product_id,kind,delta,note,created_at').order('created_at',{ascending:false}).limit(100)
     ]);
     const failure=[p.error,c.error,s.error,m.error].find(Boolean);
     if(failure)throw failure;
     setProducts((p.data||[]).map(x=>({id:x.id,name:x.name,sku:x.sku,category:x.category,cost:x.cost_cents/100,price:x.price_cents/100,qty:x.qty,min:x.min_qty,supplierId:x.supplier_id})));
     setCustomers((c.data||[]).map(x=>({id:x.id,name:x.name,doc:x.doc||'',phone:x.phone||'',email:x.email||''})));
     setSuppliers((s.data||[]).map(x=>({id:x.id,name:x.name,doc:x.doc||'',phone:x.phone||'',email:x.email||'',category:x.category||''})));
     setMovements((m.data||[]).map(x=>({id:x.id,productId:x.product_id,kind:x.kind,delta:x.delta,note:x.note||'',createdAt:x.created_at})));
     setSyncedAt(new Date());
   }catch(e){setError(e instanceof Error?e.message:'Falha ao atualizar os dados.');}
   finally{setLoading(false);setRefreshing(false);}
 }
 useEffect(()=>{void refresh();},[]);
 useEffect(()=>{if(!toast)return;const timer=window.setTimeout(()=>setToast(''),4400);return()=>window.clearTimeout(timer);},[toast]);

 const lowStock=products.filter(p=>p.qty<=p.min).length;
 const inventoryValue=products.reduce((total,p)=>total+p.qty*p.cost,0);
 const filtered=useMemo(()=>{
   const q=search.toLocaleLowerCase('pt-BR').trim();
   return {
     products:products.filter(p=>(p.name+' '+p.sku+' '+p.category).toLocaleLowerCase('pt-BR').includes(q)),
     customers:customers.filter(p=>(p.name+' '+p.doc+' '+p.phone).toLocaleLowerCase('pt-BR').includes(q)),
     suppliers:suppliers.filter(p=>(p.name+' '+p.doc+' '+p.category).toLocaleLowerCase('pt-BR').includes(q))
   };
 },[products,customers,suppliers,search]);
 function navigate(next:Page){setPage(next);setSearch('');window.scrollTo({top:0,behavior:'smooth'});}
 function create(){if(page==='products')setEditor({kind:'product'});if(page==='customers')setEditor({kind:'party',table:'customers'});if(page==='suppliers')setEditor({kind:'party',table:'suppliers'});}
 async function saved(message:string){await refresh(true);setEditor(null);setToast(message);}
 const current=navItems.find(x=>x.key===page)!;
 const hasSearch=page==='products'||page==='customers'||page==='suppliers'||page==='moves';
 const canCreate=page==='products'||page==='customers'||page==='suppliers';
 const move=(product:Product,direction:'Entrada'|'Saída')=>setEditor({kind:'movement',product,direction});
 const editorKey=editor?.kind==='product'?'product-'+(editor.item?.id||'new'):editor?.kind==='party'?editor.table+'-'+(editor.item?.id||'new'):editor?.kind==='movement'?'move-'+editor.product.id+'-'+editor.direction:'';
 const productById=new Map(products.map(p=>[p.id,p]));
 const sidebar=navItems.map(({key,label,Icon})=><button key={key} className={page===key?'active':''} aria-current={page===key?'page':undefined} onClick={()=>navigate(key)}><Icon size={19}/><span>{label}</span></button>);

 return <div className="shell">
   <aside>
     <div className="brand"><img src="/icon.svg" alt="Vetor"/><div><b>Vetor <em>Hub</em></b><small>VETOR EMBALAGENS</small></div></div>
     <p className="nav-label">ESPAÇO DE TRABALHO</p>
     <nav aria-label="Navegação principal">{sidebar}</nav>
     <div className="sidebar-note"><span className="sync-indicator"/> Dados conectados ao Supabase<br/>Acesso protegido</div>
   </aside>
   <div className="main">
     <header><div><span className="overline">VETOR EMBALAGENS / GESTÃO</span><h1>{current.label}</h1></div><span className="avatar" title="Vetor Hub">VH</span></header>
     <main className="workspace">
       {error&&<div className="app-error" role="alert"><AlertCircle size={19}/><span>{error}</span><button type="button" onClick={()=>setError('')} aria-label="Fechar aviso"><X size={16}/></button></div>}
       {toast&&<div className="app-toast" role="status"><CheckCircle2 size={19}/><span>{toast}</span><button type="button" aria-label="Dispensar" onClick={()=>setToast('')}><X size={16}/></button></div>}
       {page==='home'?<>
         <div className="welcome"><div><span className="eyebrow">VISÃO GERAL</span><h2>Bem-vindo ao Vetor Hub.</h2><p>Acompanhe sua operação em um só lugar.</p></div><button className="button-secondary refresh-button" type="button" disabled={refreshing} onClick={()=>void refresh(true)}><RefreshCw size={16} className={refreshing?'spinning':''}/> Atualizar</button></div>
         <div className="stats">
           <article><span>Produtos ativos</span><strong>{loading?'—':products.length}</strong><span className="stat-bottom">Itens no catálogo</span></article>
           <article><span>Estoque baixo</span><strong>{loading?'—':lowStock}</strong><span className={'stat-bottom'+(lowStock?' stat-warning':'')}>{lowStock?'Precisam de atenção':'Tudo em dia'}</span></article>
           <article><span>Valor em estoque (custo)</span><strong className="money-stat">{loading?'—':currency(inventoryValue)}</strong><span className="stat-bottom">Estimativa pelo custo cadastrado</span></article>
         </div>
         <section className="panel quick-panel"><div className="panel-heading"><h2>Acesso rápido</h2><p>O que você precisa fazer hoje?</p></div><div className="quick-grid">
           <button type="button" onClick={()=>{navigate('products');setEditor({kind:'product'});}}><div className="quick-icon"><Plus size={19}/></div><span><strong>Cadastrar produto</strong><small>Adicionar ao catálogo</small></span><ChevronRight size={18}/></button>
           <button type="button" onClick={()=>navigate('moves')}><div className="quick-icon"><ArrowDownUp size={19}/></div><span><strong>Movimentar estoque</strong><small>Registrar entrada ou saída</small></span><ChevronRight size={18}/></button>
           <button type="button" onClick={()=>{navigate('customers');setEditor({kind:'party',table:'customers'});}}><div className="quick-icon"><Users size={19}/></div><span><strong>Novo cliente</strong><small>Cadastrar contato</small></span><ChevronRight size={18}/></button>
         </div></section>
         <div className="sync-caption">Última sincronização: {syncedAt?syncedAt.toLocaleTimeString('pt-BR',{hour:'2-digit',minute:'2-digit'}):'carregando...'}</div>
       </>:<div className="content-page">
         <div className="page-heading">
           <div><h2>{page==='products'?'Catálogo de produtos':page==='customers'?'Seus clientes':page==='suppliers'?'Rede de fornecedores':page==='moves'?'Controle de estoque':'Orçamentos'}</h2><p>{page==='products'?'Gerencie preços, categorias e quantidades.':page==='customers'?'Cadastre e organize seus contatos comerciais.':page==='suppliers'?'Tenha os dados dos seus parceiros à mão.':page==='moves'?'Registre cada entrada e saída com rastreabilidade.':'Em breve: crie propostas e transforme-as em pedidos.'}</p></div>
           {canCreate&&<button className="button-primary add-button" type="button" onClick={create}><Plus size={18}/><span>{page==='products'?'Novo produto':page==='customers'?'Novo cliente':'Novo fornecedor'}</span></button>}
         </div>
         {hasSearch&&<div className="filter-row"><label className="search-control"><Search size={18}/><input aria-label="Buscar registros" placeholder={page==='products'||page==='moves'?'Buscar por produto ou código':page==='customers'?'Buscar cliente':'Buscar fornecedor'} value={search} onChange={e=>setSearch(e.target.value)}/></label><button title="Recarregar" type="button" className="button-icon" disabled={refreshing} onClick={()=>void refresh(true)}><RefreshCw size={17} className={refreshing?'spinning':''}/></button></div>}
         {(page==='products'||page==='moves')&&<section className="panel data-panel">
           <div className="data-heading"><span>{page==='products'?'Produtos cadastrados':'Produtos disponíveis'}</span><small>{filtered.products.length} {filtered.products.length===1?'registro':'registros'}</small></div>
           {filtered.products.length===0?<EmptyState title={loading?'Carregando produtos…':products.length?'Nenhum resultado encontrado':'Seu catálogo começa aqui'} description={products.length?'Tente outro termo de busca.':'Cadastre um produto para começar a controlar entradas e saídas.'} onAction={page==='products'&&!products.length?()=>setEditor({kind:'product'}):undefined} actionLabel="Cadastrar produto"/>:
             <div className="records">{filtered.products.map(p=><div className="record record-product" key={p.id}>
               <div className="record-icon"><Package size={19}/></div>
               <div className="record-description"><strong>{p.name}</strong><small>{p.sku} <span className="record-divider">·</span> {p.category}</small><span className="record-subvalue">{currency(p.price)} / un.</span></div>
               <div className="record-stock"><b>{p.qty} <small>un.</small></b>{p.qty<=p.min&&<span className="stock-alert">Estoque baixo</span>}</div>
               <div className="record-actions">
                 {page==='products'&&<button type="button" className="action-edit" onClick={()=>setEditor({kind:'product',item:p})}><PenLine size={15}/> Editar</button>}
                 <button type="button" className="action-in" onClick={()=>move(p,'Entrada')}><ArrowDownCircle size={16}/> Entrada</button>
                 <button type="button" className="action-out" onClick={()=>move(p,'Saída')}><ArrowUpCircle size={16}/> Saída</button>
               </div>
             </div>)}</div>}
         </section>}
         {page==='moves'&&<section className="panel data-panel movement-history"><div className="data-heading"><span>Movimentações recentes</span><small>Últimas 100</small></div>
           {!movements.length?<EmptyState title="Sem movimentações ainda" description="As entradas e saídas realizadas no app aparecerão aqui."/>:<div className="records">{movements.map(m=><div className="record history-record" key={m.id}><div className={'history-icon '+(m.delta>0?'in':'out')}>{m.delta>0?<ArrowDownCircle size={20}/>:<ArrowUpCircle size={20}/>}</div><div className="record-description"><strong>{productById.get(m.productId)?.name||'Produto não encontrado'}</strong><small>{new Date(m.createdAt).toLocaleString('pt-BR')}{m.note?' · '+m.note:''}</small></div><b className={m.delta>0?'delta-in':'delta-out'}>{m.delta>0?'+':''}{m.delta} un.</b></div>)}</div>}
         </section>}
         {(page==='customers'||page==='suppliers')&&<section className="panel data-panel">
           <div className="data-heading"><span>{page==='customers'?'Clientes cadastrados':'Fornecedores cadastrados'}</span><small>{filtered[page].length} {filtered[page].length===1?'registro':'registros'}</small></div>
           {filtered[page].length===0?<EmptyState title={loading?'Carregando…':(page==='customers'?customers:suppliers).length?'Nenhum resultado encontrado':'Nenhum cadastro ainda'} description={(page==='customers'?customers:suppliers).length?'Tente outra busca.':'Comece adicionando seu primeiro cadastro.'} onAction={!(page==='customers'?customers:suppliers).length?create:undefined} actionLabel={page==='customers'?'Novo cliente':'Novo fornecedor'}/>:
           <div className="records">{filtered[page].map(p=><div className="record party-record" key={p.id}>
             <div className="record-icon">{page==='customers'?<Users size={19}/>:<Truck size={19}/>}</div>
             <div className="record-description"><strong>{p.name}</strong><small>{p.phone||p.email||'Sem contato informado'}</small>{p.doc&&<span className="record-subvalue">{p.doc}</span>}</div>
             <div className="record-actions"><button type="button" className="action-edit" onClick={()=>setEditor({kind:'party',table:page,item:p})}><PenLine size={15}/> Editar</button></div>
           </div>)}</div>}
         </section>}
         {page==='quotes'&&<section className="panel data-panel"><div className="feature-pending"><div className="empty-icon"><FileText size={26}/></div><span className="feature-label">EM DESENVOLVIMENTO</span><h3>Orçamentos e pedidos</h3><p>Esta área será conectada ao Supabase com itens, descontos e geração de PDF. O cadastro está indisponível até ficar pronto para uso.</p></div></section>}
       </div>}
     </main>
     <footer>Vetor Hub · Gestão conectada ao Supabase</footer>
   </div>
   <nav className="bottom-nav" aria-label="Navegação mobile">{navItems.map(({key,label,Icon})=><button type="button" key={key} className={page===key?'active':''} aria-current={page===key?'page':undefined} onClick={()=>navigate(key)}><Icon size={20}/><span>{label}</span></button>)}</nav>
   {editor&&<RecordEditor key={editorKey} target={editor} suppliers={suppliers} onClose={()=>setEditor(null)} onSaved={saved}/>}
 </div>;
}
