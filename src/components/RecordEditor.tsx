import {useState,type FormEvent} from 'react';
import {ArrowDownCircle,ArrowUpCircle,CheckCircle2,Package,Save,UserRound,Truck} from 'lucide-react';
import EditorSheet from './EditorSheet';
import {supabase} from '../lib/supabase';
import {productPayload,partyPayload,movementDelta,errorMessage} from '../lib/domain';

export type Product={
  id:string; name:string; sku:string; category:string; cost:number;
  price:number; qty:number; min:number; supplierId:string|null; archivedAt?:string|null;
};
export type Party={
  id:string; name:string; doc:string; phone:string; email:string; category?:string; archivedAt?:string|null;
};
export type Movement={
  id:string; productId:string; delta:number; kind:string; note:string; createdAt:string;
};
export type EditorTarget=
  | {kind:'product'; item?:Product}
  | {kind:'party'; table:'customers'|'suppliers'; item?:Party}
  | {kind:'movement'; product:Product; direction:'Entrada'|'Saída'};

type Common={close:()=>void; saved:(message:string)=>Promise<void>};
function FormError({message}:{message:string}){
  return message?<div className="form-error" role="alert">{message}</div>:null;
}
function Actions({pending,cancel,label}:{pending:boolean;cancel:()=>void;label:string}){
  return <div className="editor-actions">
    <button className="button-secondary editor-cancel" type="button" onClick={cancel} disabled={pending}>Cancelar</button>
    <button className="button-primary editor-submit" type="submit" disabled={pending}><Save size={17}/>{pending?'Salvando…':label}</button>
  </div>;
}
function ProductForm({item,suppliers,close,saved}:{item?:Product;suppliers:Party[]} & Common){
  const [name,setName]=useState(item?.name??'');
  const [sku,setSku]=useState(item?.sku??'');
  const [category,setCategory]=useState(item?.category??'Outros');
  const [supplierId,setSupplierId]=useState(item?.supplierId??'');
  const [cost,setCost]=useState(String(item?.cost??'0'));
  const [price,setPrice]=useState(String(item?.price??'0'));
  const [min,setMin]=useState(String(item?.min??5));
  const [pending,setPending]=useState(false);
  const [error,setError]=useState('');
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const client=supabase;if(!client)return;
    setError('');
    try{
      const payload=productPayload({name,sku,category,supplierId,cost,price,min});
      setPending(true);
      const result=item?await client.from('products').update(payload).eq('id',item.id).select('id').single():await client.from('products').insert(payload);
      if(result.error)throw result.error;
      await saved(item?'Produto atualizado com sucesso.':'Produto cadastrado com sucesso.');
    }catch(e){setError(errorMessage(e,'Não foi possível salvar o produto.'));}
    finally{setPending(false);}
  }
  return <EditorSheet title={item?'Editar produto':'Novo produto'} description="Informações de catálogo, preços e controle de estoque." onClose={close} busy={pending}>
    <form className="editor-form" onSubmit={submit}>
      <div className="editor-body">
        <div className="form-section-title"><Package size={18}/><span>Identificação do produto</span></div>
        <div className="form-field"><label htmlFor="product-name">Nome do produto <span>*</span></label><input id="product-name" autoFocus required maxLength={140} value={name} onChange={e=>setName(e.target.value)} placeholder="Ex.: Caixa de papelão 30 × 20 × 10"/></div>
        <div className="form-grid">
          <div className="form-field"><label htmlFor="product-sku">Código / SKU <span>*</span></label><input id="product-sku" required maxLength={50} value={sku} onChange={e=>setSku(e.target.value)} placeholder="PAP-001"/></div>
          <div className="form-field"><label htmlFor="product-category">Categoria</label><input id="product-category" maxLength={80} value={category} onChange={e=>setCategory(e.target.value)} placeholder="Embalagens"/></div>
        </div>
        <div className="form-field"><label htmlFor="product-supplier">Fornecedor</label><select id="product-supplier" value={supplierId} onChange={e=>setSupplierId(e.target.value)}><option value="">Sem fornecedor vinculado</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div>
        <div className="form-divider"/>
        <div className="form-section-title"><span className="section-dot"/> Preços e estoque</div>
        <div className="form-grid">
          <div className="form-field"><label htmlFor="product-cost">Custo unitário (R$)</label><input id="product-cost" type="text" inputMode="decimal" required value={cost} onChange={e=>setCost(e.target.value)} placeholder="0,00"/></div>
          <div className="form-field"><label htmlFor="product-price">Preço de venda (R$)</label><input id="product-price" type="text" inputMode="decimal" required value={price} onChange={e=>setPrice(e.target.value)} placeholder="0,00"/></div>
        </div>
        <div className="form-field"><label htmlFor="product-min">Estoque mínimo</label><input id="product-min" type="number" min="0" step="1" required value={min} onChange={e=>setMin(e.target.value)}/><span className="field-help">Você receberá um alerta quando o saldo atingir esse valor.</span></div>
        <div className="inline-note"><CheckCircle2 size={17}/><span>O saldo atual é alterado somente por entradas e saídas de estoque, registradas no histórico.</span></div>
        <FormError message={error}/>
      </div>
      <Actions pending={pending} cancel={close} label={item?'Salvar alterações':'Cadastrar produto'}/>
    </form>
  </EditorSheet>;
}
function PartyForm({table,item,close,saved}:{table:'customers'|'suppliers';item?:Party}&Common){
  const isSupplier=table==='suppliers';
  const label=isSupplier?'fornecedor':'cliente';
  const [name,setName]=useState(item?.name??'');
  const [doc,setDoc]=useState(item?.doc??'');
  const [phone,setPhone]=useState(item?.phone??'');
  const [email,setEmail]=useState(item?.email??'');
  const [category,setCategory]=useState(item?.category??'');
  const [error,setError]=useState('');
  const [pending,setPending]=useState(false);
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const client=supabase;if(!client)return;
    setError('');
    setPending(true);
    try{
      const payload=partyPayload({name,doc,phone,email,category},isSupplier);
      const result=item?await client.from(table).update(payload).eq('id',item.id).select('id').single():await client.from(table).insert(payload);
      if(result.error)throw result.error;
      await saved((isSupplier?'Fornecedor':'Cliente')+(item?' atualizado':' cadastrado')+' com sucesso.');
    }catch(e){setError(errorMessage(e,'Não foi possível salvar o cadastro.'));}
    finally{setPending(false);}
  }
  return <EditorSheet title={(item?'Editar ':'Novo ')+label} description="Preencha os dados de contato e identificação." onClose={close} busy={pending}>
    <form className="editor-form" onSubmit={submit}>
      <div className="editor-body">
        <div className="form-section-title">{isSupplier?<Truck size={18}/>:<UserRound size={18}/>} <span>Dados do {label}</span></div>
        <div className="form-field"><label htmlFor="party-name">Nome / razão social <span>*</span></label><input id="party-name" autoFocus required maxLength={150} value={name} onChange={e=>setName(e.target.value)} placeholder={isSupplier?'Ex.: Distribuidora de Embalagens':'Ex.: Mercado Central'}/></div>
        <div className="form-field"><label htmlFor="party-doc">CPF / CNPJ</label><input id="party-doc" inputMode="numeric" maxLength={20} value={doc} onChange={e=>setDoc(e.target.value)} placeholder="Somente para identificação"/></div>
        {isSupplier&&<div className="form-field"><label htmlFor="party-category">Categoria de fornecimento</label><input id="party-category" value={category} maxLength={80} onChange={e=>setCategory(e.target.value)} placeholder="Ex.: Caixas e papelão"/></div>}
        <div className="form-divider"/>
        <div className="form-section-title"><span className="section-dot"/> Contato</div>
        <div className="form-field"><label htmlFor="party-phone">Telefone</label><input id="party-phone" type="tel" autoComplete="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="(83) 99999-9999"/></div>
        <div className="form-field"><label htmlFor="party-email">E-mail</label><input id="party-email" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="contato@empresa.com"/></div>
        <FormError message={error}/>
      </div>
      <Actions pending={pending} cancel={close} label={item?'Salvar alterações':'Cadastrar '+label}/>
    </form>
  </EditorSheet>;
}
function MovementForm({product,direction,close,saved}:{product:Product;direction:'Entrada'|'Saída'}&Common){
  const isEntry=direction==='Entrada';
  const [quantity,setQuantity]=useState('');
  const [note,setNote]=useState('');
  const [pending,setPending]=useState(false);
  const [error,setError]=useState('');
  const number=Number(quantity);
  const valid=quantity.trim()!==''&&Number.isSafeInteger(number)&&number>0;
  const after=valid?product.qty+(isEntry?number:-number):null;
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const client=supabase;if(!client)return;
    setError('');setPending(true);
    try{
      const delta=movementDelta(quantity,product.qty,direction);
      const {error}=await client.rpc('record_stock_movement',{p_product_id:product.id,p_delta:delta,p_note:note.trim()});
      if(error)throw error;
      await saved((isEntry?'Entrada':'Saída')+' registrada com sucesso.');
    }catch(e){setError(errorMessage(e,'Não foi possível registrar a movimentação.'));}
    finally{setPending(false);}
  }
  return <EditorSheet title={(isEntry?'Nova entrada':'Nova saída')} description="Movimente o estoque com registro no histórico." onClose={close} busy={pending}>
    <form className="editor-form" onSubmit={submit}>
      <div className="editor-body">
        <div className="movement-product"><div className="movement-icon">{isEntry?<ArrowDownCircle size={25}/>:<ArrowUpCircle size={25}/>}</div><div><span>PRODUTO SELECIONADO</span><strong>{product.name}</strong><small>Código {product.sku}</small></div></div>
        <div className="balance-card"><span>Saldo disponível</span><strong>{product.qty} <small>unidades</small></strong></div>
        <div className="form-field"><label htmlFor="movement-qty">Quantidade para {isEntry?'entrada':'saída'} <span>*</span></label><input id="movement-qty" type="number" min="1" step="1" inputMode="numeric" autoFocus required value={quantity} onChange={e=>setQuantity(e.target.value)} placeholder="0"/></div>
        {after!==null&&<div className={'balance-preview'+(after<0?' is-invalid':'')}><span>Saldo após movimentação</span><strong>{after} un.</strong></div>}
        <div className="form-field"><label htmlFor="movement-note">Observação (opcional)</label><textarea id="movement-note" maxLength={500} rows={4} value={note} onChange={e=>setNote(e.target.value)} placeholder="Ex.: Recebimento do fornecedor, saída para entrega..."/></div>
        <div className="inline-note"><CheckCircle2 size={17}/><span>A operação atualiza o saldo e o histórico de uma só vez, diretamente no banco.</span></div>
        <FormError message={error}/>
      </div>
      <Actions pending={pending} cancel={close} label={isEntry?'Confirmar entrada':'Confirmar saída'}/>
    </form>
  </EditorSheet>;
}
export default function RecordEditor({target,suppliers,onClose,onSaved}:{target:EditorTarget;suppliers:Party[];onClose:()=>void;onSaved:(message:string)=>Promise<void>}){
  if(target.kind==='product')return <ProductForm item={target.item} suppliers={suppliers} close={onClose} saved={onSaved}/>;
  if(target.kind==='party')return <PartyForm table={target.table} item={target.item} close={onClose} saved={onSaved}/>;
  return <MovementForm product={target.product} direction={target.direction} close={onClose} saved={onSaved}/>;
}
