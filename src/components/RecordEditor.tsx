import {useState,type FormEvent,type ReactNode} from 'react';
import {ArrowDownToLine,ArrowUpFromLine,Info,Loader2,Package,Phone,Ruler,Save,Truck,UserRound,Wallet} from 'lucide-react';
import {Sheet,SheetBody,SheetFooter} from './ui/overlays';
import {Button} from './ui/button';
import {Field,FormError,Input,MoneyInput,NativeSelect,SectionTitle,Textarea} from './ui/form';
import {supabase} from '../lib/supabase';
import {productPayload,partyPayload,movementPayload,errorMessage,productMargin} from '../lib/domain';
import {toCents} from '../lib/quoteMath';
import {cn} from '../lib/utils';

export type Product={
  id:string; name:string; sku:string; category:string; cost:number;
  price:number; qty:number; min:number; supplierId:string|null; archivedAt?:string|null;
  model?:string; width?:number|null; height?:number|null; gusset?:number|null; thickness?:number|null;
};
export type Party={
  id:string; name:string; doc:string; phone:string; email:string; address?:string; category?:string; pricePerKg?:number|null; archivedAt?:string|null;
};
export type Movement={
  id:string; productId:string; delta:number; kind:string; note:string; createdAt:string; unitCost?:number|null; supplierId?:string|null;
};
export type EditorTarget=
  | {kind:'product'; item?:Product}
  | {kind:'party'; table:'customers'|'suppliers'; item?:Party}
  | {kind:'movement'; product:Product; direction:'Entrada'|'Saída'};

type Common={close:()=>void; saved:(message:string)=>Promise<void>};

function Actions({pending,cancel,label}:{pending:boolean;cancel:()=>void;label:string}){
  return <SheetFooter>
    <Button variant="outline" className="editor-cancel" onClick={cancel} disabled={pending}>Cancelar</Button>
    <Button type="submit" className="editor-submit" disabled={pending}>{pending?<Loader2 className="spinning"/>:<Save/>}{pending?'Salvando…':label}</Button>
  </SheetFooter>;
}
function Section({children}:{children:ReactNode}){
  return <section className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-card sm:p-5">{children}</section>;
}
function Note({children}:{children:ReactNode}){
  return <div className="flex gap-2.5 rounded-lg bg-brand-soft px-3.5 py-3 text-[13px] leading-relaxed text-brand"><Info className="mt-0.5 size-4 shrink-0"/><span>{children}</span></div>;
}
const grid='grid gap-4 sm:grid-cols-2';

function ProductForm({item,suppliers,close,saved}:{item?:Product;suppliers:Party[]} & Common){
  const [name,setName]=useState(item?.name??'');
  const [sku,setSku]=useState(item?.sku??'');
  const [category,setCategory]=useState(item?.category??'Outros');
  const [supplierId,setSupplierId]=useState(item?.supplierId??'');
  const [cost,setCost]=useState(String(item?.cost??'0'));
  const [price,setPrice]=useState(String(item?.price??'0'));
  const [min,setMin]=useState(String(item?.min??5));
  const decimal=(n:number|null|undefined)=>n==null?'':String(n).replace('.',',');
  const [model,setModel]=useState(item?.model??'');
  const [width,setWidth]=useState(decimal(item?.width));
  const [height,setHeight]=useState(decimal(item?.height));
  const [gusset,setGusset]=useState(decimal(item?.gusset));
  const [thickness,setThickness]=useState(decimal(item?.thickness));
  const [pending,setPending]=useState(false);
  const [error,setError]=useState('');
  // Margem ao vivo enquanto digita (só exibição; a validação real acontece no envio).
  let margin:number|null=null;
  try{margin=productMargin(toCents(cost),toCents(price)).marginPct;}catch{/* valor incompleto */}
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const client=supabase;if(!client)return;
    setError('');
    try{
      const payload=productPayload({name,sku,category,supplierId,cost,price,min,model,width,height,gusset,thickness});
      setPending(true);
      const result=item?await client.from('products').update(payload).eq('id',item.id).select('id').single():await client.from('products').insert(payload);
      if(result.error)throw result.error;
      await saved(item?'Produto atualizado com sucesso.':'Produto cadastrado com sucesso.');
    }catch(e){setError(errorMessage(e,'Não foi possível salvar o produto.'));}
    finally{setPending(false);}
  }
  return <Sheet title={item?'Editar produto':'Novo produto'} eyebrow="Catálogo" description="Informações de catálogo, preços e controle de estoque." onClose={close} busy={pending}>
    <form className="editor-form flex min-h-0 flex-1 flex-col" onSubmit={submit}>
      <SheetBody className="space-y-4">
        <Section>
          <SectionTitle icon={<Package/>}>Identificação do produto</SectionTitle>
          <Field id="product-name" label="Nome do produto" required><Input id="product-name" autoFocus required maxLength={140} value={name} onChange={e=>setName(e.target.value)} placeholder="Ex.: Caixa de papelão 30 × 20 × 10"/></Field>
          <div className={grid}>
            <Field id="product-sku" label="Código / SKU" required><Input id="product-sku" className="font-mono" required maxLength={50} value={sku} onChange={e=>setSku(e.target.value)} placeholder="PAP-001"/></Field>
            <Field id="product-category" label="Categoria"><Input id="product-category" maxLength={80} value={category} onChange={e=>setCategory(e.target.value)} placeholder="Embalagens"/></Field>
          </div>
          <Field id="product-supplier" label="Fornecedor"><NativeSelect id="product-supplier" value={supplierId} onChange={e=>setSupplierId(e.target.value)}><option value="">Sem fornecedor vinculado</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</NativeSelect></Field>
        </Section>
        <Section>
          <SectionTitle icon={<Ruler/>} description="Opcional — usado para sacolas e embalagens sob medida.">Modelo e medidas</SectionTitle>
          <Field id="product-model" label="Modelo"><Input id="product-model" list="product-model-options" maxLength={80} value={model} onChange={e=>setModel(e.target.value)} placeholder="Ex.: Boca de palhaço"/><datalist id="product-model-options"><option value="Boca de palhaço"/><option value="Alça camiseta"/><option value="Off-set 180g"/><option value="Saco cristal"/></datalist></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field id="product-width" label="Largura (cm)"><Input id="product-width" inputMode="decimal" value={width} onChange={e=>setWidth(e.target.value)} placeholder="30"/></Field>
            <Field id="product-height" label="Altura (cm)"><Input id="product-height" inputMode="decimal" value={height} onChange={e=>setHeight(e.target.value)} placeholder="40"/></Field>
            <Field id="product-gusset" label="Sanfona (cm)"><Input id="product-gusset" inputMode="decimal" value={gusset} onChange={e=>setGusset(e.target.value)} placeholder="0"/></Field>
            <Field id="product-thickness" label="Espessura (mm)"><Input id="product-thickness" inputMode="decimal" value={thickness} onChange={e=>setThickness(e.target.value)} placeholder="0,010"/></Field>
          </div>
        </Section>
        <Section>
          <SectionTitle icon={<Wallet/>}>Preços e estoque</SectionTitle>
          <div className={grid}>
            <Field id="product-cost" label="Custo unitário (R$)"><MoneyInput id="product-cost" required value={cost} onChange={e=>setCost(e.target.value)} placeholder="0,00"/></Field>
            <Field id="product-price" label="Preço de venda (R$)"><MoneyInput id="product-price" required value={price} onChange={e=>setPrice(e.target.value)} placeholder="0,00"/></Field>
          </div>
          {margin!==null&&<p className={cn('-mt-1 text-[13px] font-semibold',margin<0?'text-destructive':'text-success')}>Margem sobre o preço: {margin.toLocaleString('pt-BR')}%</p>}
          <Field id="product-min" label="Estoque mínimo" help="Você recebe um alerta quando o saldo atingir esse valor."><Input id="product-min" className="tabular" type="number" min="0" step="1" required value={min} onChange={e=>setMin(e.target.value)}/></Field>
        </Section>
        <Note>O saldo atual é alterado somente por entradas e saídas de estoque, registradas no histórico.</Note>
        <FormError message={error}/>
      </SheetBody>
      <Actions pending={pending} cancel={close} label={item?'Salvar alterações':'Cadastrar produto'}/>
    </form>
  </Sheet>;
}

function PartyForm({table,item,close,saved}:{table:'customers'|'suppliers';item?:Party}&Common){
  const isSupplier=table==='suppliers';
  const label=isSupplier?'fornecedor':'cliente';
  const [name,setName]=useState(item?.name??'');
  const [doc,setDoc]=useState(item?.doc??'');
  const [phone,setPhone]=useState(item?.phone??'');
  const [email,setEmail]=useState(item?.email??'');
  const [address,setAddress]=useState(item?.address??'');
  const [category,setCategory]=useState(item?.category??'');
  const [pricePerKg,setPricePerKg]=useState(item?.pricePerKg==null?'':item.pricePerKg.toFixed(2).replace('.',','));
  const [error,setError]=useState('');
  const [pending,setPending]=useState(false);
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const client=supabase;if(!client)return;
    setError('');
    setPending(true);
    try{
      const payload=partyPayload({name,doc,phone,email,address,category,pricePerKg},isSupplier);
      const result=item?await client.from(table).update(payload).eq('id',item.id).select('id').single():await client.from(table).insert(payload);
      if(result.error)throw result.error;
      await saved((isSupplier?'Fornecedor':'Cliente')+(item?' atualizado':' cadastrado')+' com sucesso.');
    }catch(e){setError(errorMessage(e,'Não foi possível salvar o cadastro.'));}
    finally{setPending(false);}
  }
  return <Sheet title={(item?'Editar ':'Novo ')+label} eyebrow={isSupplier?'Fornecedores':'Clientes'} description="Preencha os dados de contato e identificação." onClose={close} busy={pending}>
    <form className="editor-form flex min-h-0 flex-1 flex-col" onSubmit={submit}>
      <SheetBody className="space-y-4">
        <Section>
          <SectionTitle icon={isSupplier?<Truck/>:<UserRound/>}>Dados do {label}</SectionTitle>
          <Field id="party-name" label="Nome / razão social" required><Input id="party-name" autoFocus required maxLength={150} value={name} onChange={e=>setName(e.target.value)} placeholder={isSupplier?'Ex.: Distribuidora de Embalagens':'Ex.: Mercado Central'}/></Field>
          <Field id="party-doc" label="CPF / CNPJ"><Input id="party-doc" className="font-mono" inputMode="numeric" maxLength={20} value={doc} onChange={e=>setDoc(e.target.value)} placeholder="Somente para identificação"/></Field>
          {isSupplier&&<div className={grid}>
            <Field id="party-category" label="Categoria de fornecimento"><Input id="party-category" value={category} maxLength={80} onChange={e=>setCategory(e.target.value)} placeholder="Ex.: Caixas e papelão"/></Field>
            <Field id="party-price-kg" label="Preço por kg (R$)"><MoneyInput id="party-price-kg" value={pricePerKg} onChange={e=>setPricePerKg(e.target.value)} placeholder="43,00"/></Field>
          </div>}
          {isSupplier&&<p className="-mt-2 text-xs text-muted-foreground">Preço por kg: valor do quilo de sacola plástica cobrado por este fornecedor.</p>}
        </Section>
        <Section>
          <SectionTitle icon={<Phone/>}>Contato</SectionTitle>
          <div className={grid}>
            <Field id="party-phone" label="Telefone"><Input id="party-phone" type="tel" autoComplete="tel" value={phone} onChange={e=>setPhone(e.target.value)} placeholder="(83) 99999-9999"/></Field>
            <Field id="party-email" label="E-mail"><Input id="party-email" type="email" autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)} placeholder="contato@empresa.com"/></Field>
          </div>
          <Field id="party-address" label="Endereço"><Input id="party-address" autoComplete="street-address" maxLength={200} value={address} onChange={e=>setAddress(e.target.value)} placeholder="Rua, número, bairro, cidade - UF"/></Field>
        </Section>
        <FormError message={error}/>
      </SheetBody>
      <Actions pending={pending} cancel={close} label={item?'Salvar alterações':'Cadastrar '+label}/>
    </form>
  </Sheet>;
}

function MovementForm({product,direction,suppliers,close,saved}:{product:Product;direction:'Entrada'|'Saída';suppliers:Party[]}&Common){
  const isEntry=direction==='Entrada';
  const [quantity,setQuantity]=useState('');
  const [note,setNote]=useState('');
  const [unitCost,setUnitCost]=useState('');
  const [supplierId,setSupplierId]=useState(suppliers.some(s=>s.id===product.supplierId)?product.supplierId!:'');
  const [pending,setPending]=useState(false);
  const [error,setError]=useState('');
  const number=Number(quantity);
  const valid=quantity.trim()!==''&&Number.isSafeInteger(number)&&number>0;
  const after=valid?product.qty+(isEntry?number:-number):null;
  async function submit(e:FormEvent<HTMLFormElement>){
    e.preventDefault();const client=supabase;if(!client)return;
    setError('');setPending(true);
    try{
      const payload=movementPayload({productId:product.id,quantity,note,unitCost,supplierId},product.qty,direction);
      const {error}=await client.rpc('record_stock_movement',payload);
      if(error)throw error;
      await saved((isEntry?'Entrada':'Saída')+' registrada com sucesso.');
    }catch(e){setError(errorMessage(e,'Não foi possível registrar a movimentação.'));}
    finally{setPending(false);}
  }
  const quick=isEntry?[10,50,100,500]:[1,5,10,product.qty].filter((n,i,a)=>n>0&&a.indexOf(n)===i);
  return <Sheet title={isEntry?'Nova entrada':'Nova saída'} eyebrow="Estoque" description="Movimente o estoque com registro no histórico." onClose={close} busy={pending}>
    <form className="editor-form flex min-h-0 flex-1 flex-col" onSubmit={submit}>
      <SheetBody className="space-y-4">
        <div className="flex items-center gap-3.5 rounded-xl border border-border bg-card p-4 shadow-card">
          <span className={cn('grid size-12 shrink-0 place-items-center rounded-xl',isEntry?'bg-success-soft text-success':'bg-destructive-soft text-destructive')}>{isEntry?<ArrowDownToLine className="size-5"/>:<ArrowUpFromLine className="size-5"/>}</span>
          <div className="min-w-0"><p className="text-[11px] font-bold uppercase tracking-[0.12em] text-muted-foreground">Produto selecionado</p><p className="truncate text-[15px] font-bold text-foreground">{product.name}</p><p className="text-xs text-muted-foreground">Código <span className="font-mono">{product.sku}</span></p></div>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="rounded-xl bg-muted p-4"><p className="text-xs font-semibold text-muted-foreground">Saldo disponível</p><p className="tabular mt-1 text-2xl font-extrabold text-foreground">{product.qty.toLocaleString('pt-BR')} <span className="text-sm font-semibold text-muted-foreground">un.</span></p></div>
          <div className={cn('balance-preview rounded-xl p-4 transition-colors',after===null?'bg-muted':after<0?'is-invalid bg-destructive-soft':'bg-brand-soft')}>
            <p className="text-xs font-semibold text-muted-foreground">Saldo após movimentação</p>
            <p className={cn('tabular mt-1 text-2xl font-extrabold',after===null?'text-muted-foreground':after<0?'text-destructive':'text-brand')}>{after===null?'—':after.toLocaleString('pt-BR')} <span className="text-sm font-semibold opacity-70">un.</span></p>
          </div>
        </div>
        <Section>
          <Field id="movement-qty" label={'Quantidade para '+(isEntry?'entrada':'saída')} required>
            <Input id="movement-qty" className="tabular h-12 text-lg font-semibold" type="number" min="1" step="1" inputMode="numeric" autoFocus required value={quantity} onChange={e=>setQuantity(e.target.value)} placeholder="0"/>
          </Field>
          <div className="-mt-1 flex flex-wrap gap-2" role="group" aria-label="Quantidades sugeridas">
            {quick.map(n=><button key={n} type="button" onClick={()=>setQuantity(String(n))} className="tabular h-8 rounded-full border border-border bg-card px-3 text-[13px] font-semibold text-muted-foreground transition-colors hover:border-brand/40 hover:text-brand">{!isEntry&&n===product.qty?'Tudo ('+n.toLocaleString('pt-BR')+')':'+'+n.toLocaleString('pt-BR')}</button>)}
          </div>
          {isEntry&&<div className={grid}>
            <Field id="movement-cost" label="Custo unitário (R$)"><MoneyInput id="movement-cost" value={unitCost} onChange={e=>setUnitCost(e.target.value)} placeholder="Opcional"/></Field>
            <Field id="movement-supplier" label="Fornecedor"><NativeSelect id="movement-supplier" value={supplierId} onChange={e=>setSupplierId(e.target.value)}><option value="">Não informado</option>{suppliers.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</NativeSelect></Field>
          </div>}
          <Field id="movement-note" label="Observação (opcional)"><Textarea id="movement-note" maxLength={500} rows={3} value={note} onChange={e=>setNote(e.target.value)} placeholder="Ex.: Recebimento do fornecedor, saída para entrega..."/></Field>
        </Section>
        <Note>A operação atualiza o saldo e o histórico de uma só vez, diretamente no banco.</Note>
        <FormError message={error}/>
      </SheetBody>
      <Actions pending={pending} cancel={close} label={isEntry?'Confirmar entrada':'Confirmar saída'}/>
    </form>
  </Sheet>;
}

export default function RecordEditor({target,suppliers,onClose,onSaved}:{target:EditorTarget;suppliers:Party[];onClose:()=>void;onSaved:(message:string)=>Promise<void>}){
  if(target.kind==='product')return <ProductForm item={target.item} suppliers={suppliers} close={onClose} saved={onSaved}/>;
  if(target.kind==='party')return <PartyForm table={target.table} item={target.item} close={onClose} saved={onSaved}/>;
  return <MovementForm product={target.product} direction={target.direction} suppliers={suppliers} close={onClose} saved={onSaved}/>;
}
