import {useEffect,useState} from 'react';
import {supabase} from './lib/supabase';
import {Package,LayoutDashboard,FileText,Truck,Users,ArrowDownUp,Plus,Search} from 'lucide-react';
type Item={id:string;name:string;sku:string;qty:number;min:number;price:number};
type Client={id:string;name:string;phone:string};
type Quote={id:string;client:string;value:number;status:string};
const seeded:Item[]=[];
const brl=(v:number)=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(v);
const pages=[['home','Início',LayoutDashboard],['products','Produtos',Package],['quotes','Orçamentos',FileText],['suppliers','Fornecedores',Truck],['customers','Clientes',Users],['moves','Movimentações',ArrowDownUp]] as const;
function App(){
 const[page,setPage]=useState('home');
 const[products,setProducts]=useState<Item[]>(seeded);
 const[clients,setClients]=useState<Client[]>([]);
 const[suppliers,setSuppliers]=useState<Client[]>([]);
 const[quotes]=useState<Quote[]>([]);
 const[moves,setMoves]=useState<string[]>([]);
 const[search,setSearch]=useState('');
 const [error,setError]=useState('');
 const [loading,setLoading]=useState(true);
 async function refresh(){
  const client=supabase;if(!client)return;
  setError('');setLoading(true);
  const [p,c,s,m]=await Promise.all([
   client.from('products').select('id,name,sku,qty,min_qty,price_cents').order('name'),
   client.from('customers').select('id,name,phone').order('name'),
   client.from('suppliers').select('id,name,phone').order('name'),
   client.from('stock_movements').select('created_at,kind,delta,product_id').order('created_at',{ascending:false}).limit(100)
  ]);
  const bad=[p,c,s,m].find(x=>x.error);
  if(bad?.error)setError(bad.error.message);
  else{
   setProducts((p.data||[]).map(x=>({id:x.id,name:x.name,sku:x.sku,qty:x.qty,min:x.min_qty,price:x.price_cents/100})));
   setClients((c.data||[]).map(x=>({id:x.id,name:x.name,phone:x.phone||''})));
   setSuppliers((s.data||[]).map(x=>({id:x.id,name:x.name,phone:x.phone||''})));
   setMoves((m.data||[]).map(x=>new Date(x.created_at).toLocaleString('pt-BR')+' · '+x.kind+' · '+x.delta+' un. · '+x.product_id));
  }
  setLoading(false);
 }
 useEffect(()=>{void refresh()},[]);

 async function add(){
  const client=supabase;if(!client)return;
  try{
   if(page==='products'){
    const name=prompt('Nome do produto')?.trim();if(!name)return;
    const sku=prompt('Código (SKU)')?.trim();if(!sku)return;
    const price=Number(prompt('Preço de venda (R$)')||'0');
    if(!Number.isFinite(price)||price<0)throw new Error('Preço inválido');
    const {error}=await client.from('products').insert({name,sku,category:'Outros',price_cents:Math.round(price*100),min_qty:5});
    if(error)throw error;
   }else if(page==='customers'||page==='suppliers'){
    const name=prompt('Nome / razão social')?.trim();if(!name)return;
    const phone=prompt('Telefone')||'';
    const {error}=await client.from(page).insert({name,phone});
    if(error)throw error;
   }else if(page==='quotes'){alert('Orçamentos ainda não estão sincronizados. Cadastro temporariamente indisponível.');return}
   await refresh();
  }catch(e){setError(e instanceof Error?e.message:String(e))}
 }
 async function move(p:Item,kind:'Entrada'|'Saída'){
  const client=supabase;if(!client)return;
  const amount=Number(prompt('Quantidade')||0);
  if(!Number.isSafeInteger(amount)||amount<=0){setError('Quantidade inválida');return}
  const delta=kind==='Entrada'?amount:-amount;
  const {error}=await client.rpc('record_stock_movement',{p_product_id:p.id,p_delta:delta,p_note:''});
  if(error)setError(error.message);else await refresh();
 }
 const title=pages.find(([key])=>key===page)?.[1]||'Início';
 const nav=pages.map(([key,name,Icon])=><button key={key} className={page===key?'active':''} onClick={()=>{setPage(key);setSearch('')}}><Icon size={19}/><span>{name}</span></button>);
 return <div className="shell"><aside><div className="brand"><img src="/icon.svg" alt="Vetor"/><div><b>Vetor <em>Hub</em></b><small>VETOR EMBALAGENS</small></div></div><p className="nav-label">ESPAÇO DE TRABALHO</p><nav>{nav}</nav><div className="sidebar-note">Sincronizado com Supabase · acesso protegido</div></aside><div className="main"><header><div><span className="overline">VETOR EMBALAGENS</span><h1>{title}</h1></div><span className="avatar">VH</span></header><main>{error&&<div role="alert" style={{background:"#fff1f2",color:"#991b1b",padding:14,borderRadius:8,marginBottom:15}}>{error} <button onClick={()=>setError("")}>Fechar</button></div>}{loading&&<p>Atualizando dados do banco…</p>}{page==='home'?<><h2>Bom trabalho! 👋</h2><p>Confira o panorama da operação.</p><div className="stats"><article><span>Produtos cadastrados</span><strong>{products.length}</strong></article><article><span>Itens com estoque baixo</span><strong>{products.filter(p=>p.qty<=p.min).length}</strong></article><article><span>Orçamentos</span><strong>{quotes.length}</strong></article></div><section className="panel"><h2>Ações rápidas</h2><div className="actions"><button onClick={()=>setPage('products')}>Gerenciar produtos</button><button onClick={()=>setPage('quotes')}>Ver orçamentos</button><button onClick={()=>setPage('moves')}>Movimentar estoque</button></div></section></>:<><div className="tools"><label><Search size={16}/><input placeholder="Buscar..." value={search} onChange={e=>setSearch(e.target.value)}/></label>{['products','quotes','suppliers','customers'].includes(page)&&<button className="primary" onClick={add}><Plus size={17}/> Novo cadastro</button>}</div><section className="panel">{page==='products'||page==='moves'?<div className="table">{products.filter(p=>(p.name+' '+p.sku).toLowerCase().includes(search.toLowerCase())).map(p=><div className="record" key={p.id}><div><strong>{p.name}</strong><small>{p.sku} · {brl(p.price)}</small></div><div className="stock"><b>{p.qty} un.</b>{p.qty<=p.min&&<span className="warning">Estoque baixo</span>}</div><div className="record-actions"><button onClick={()=>move(p,'Entrada')}>+ Entrada</button><button onClick={()=>move(p,'Saída')}>− Saída</button></div></div>)}</div>:page==='quotes'?quotes.filter(q=>q.client.toLowerCase().includes(search.toLowerCase())).map(q=><div className="record" key={q.id}><div><strong>{q.client}</strong><small>{q.status}</small></div><b>{brl(q.value)}</b></div>):page==='customers'||page==='suppliers'?(page==='customers'?clients:suppliers).filter(c=>c.name.toLowerCase().includes(search.toLowerCase())).map(c=><div className="record" key={c.id}><div><strong>{c.name}</strong><small>{c.phone}</small></div></div>):null}{page==='moves'&&<><h2>Histórico de movimentações</h2>{moves.map((m,i)=><div className="record" key={i}>{m}</div>)}</>}</section></>}</main><footer>Vetor Hub · Produtos, fornecedores, clientes e estoque sincronizados. Orçamentos ainda em desenvolvimento.</footer></div><div className="bottom-nav">{nav.slice(0,4)}</div></div>
}
export default App;