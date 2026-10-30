import {useCallback,useEffect,useMemo,useState,type ReactNode} from 'react';
import {AlertTriangle,Calculator,Copy,FilePlus2,Layers,Loader2,Palette,RotateCcw,Ruler,Save,Settings2,Truck} from 'lucide-react';
import type {Party} from './RecordEditor';
import {Button} from './ui/button';
import {Badge,Card,CardHeader,Segmented} from './ui/display';
import {ConfirmDialog} from './ui/overlays';
import {Field,Input,MoneyInput,NativeSelect,SectionTitle} from './ui/form';
import {BAG_PRESETS,DEFAULT_SETTINGS,LOT_SIZES,MATERIAL_SUPPLIERS,MAX_COLORS,bagLineDescription,bagQuote,settingsFromRow,settingsToRpc,type PricingSettings,type PricingSettingsRow,type PrintCosts} from '../lib/bagPricing';
import {supabase} from '../lib/supabase';
import type {MemberRole} from '../lib/domain';
import {errorMessage} from '../lib/domain';
import {cn} from '../lib/utils';

const CUSTOM='custom';
const MANUAL='manual';
const brl=(n:number,digits=2)=>n.toLocaleString('pt-BR',{style:'currency',currency:'BRL',minimumFractionDigits:digits,maximumFractionDigits:digits});
const num=(n:number,digits=0)=>n.toLocaleString('pt-BR',{minimumFractionDigits:digits,maximumFractionDigits:digits});
const dec=(n:number)=>String(n).replace('.',',');
/** Converte texto com vírgula em número; vazio ou inválido vira erro com o nome do campo. */
function parse(raw:string,field:string):number{
 const value=raw.trim().replace(/\./g,raw.includes(',')?'':'.').replace(',','.');
 if(!/^\d+(\.\d+)?$/.test(value))throw new Error('Informe '+field+' usando apenas números (ex.: 0,010 ou 40,00).');
 return Number(value);
}
const lotName=(size:number)=>size===1000?'milheiro':'lote de '+num(size);
const COST_FIELDS:{key:keyof PrintCosts;label:string;money:boolean}[]=[
 {key:'laborMonthly',label:'Mão de obra mensal (R$)',money:true},
 {key:'hoursPerThousand',label:'Horas de máquina por mil',money:false},
 {key:'ink',label:'Tinta por mil (R$)',money:true},
 {key:'solvent',label:'Solvente por mil (R$)',money:true},
 {key:'energyPerHour',label:'Energia por hora (R$)',money:true},
 {key:'oneColorExtra',label:'Adicional em 1 cor (R$)',money:true}
];
const costTextOf=(s:PricingSettings)=>Object.fromEntries(COST_FIELDS.map(f=>[f.key,dec(s.costs[f.key])])) as Record<keyof PrintCosts,string>;
const marginTextOf=(s:PricingSettings)=>dec(Math.round(s.margin*10000)/100);
/** Sacola calculada enviada ao orçamento como item personalizado. */
export type CalculatedLine={description:string;quantity:number;lineTotalCents:number};

function Row({label,value,strong}:{label:ReactNode;value:ReactNode;strong?:boolean}){
 return <div className="flex items-baseline justify-between gap-3 py-1.5 text-sm"><span className="text-muted-foreground">{label}</span><span className={cn('tabular text-right text-foreground',strong?'font-bold':'font-medium')}>{value}</span></div>;
}

export default function BagCalculator({suppliers,role,onNotice,onAddToQuote}:{suppliers:Party[];role:MemberRole;onNotice:(message:string)=>void;onAddToQuote:(line:CalculatedLine)=>void}){
 const[presetId,setPresetId]=useState('alc-30x40');
 const preset=BAG_PRESETS.find(p=>p.id===presetId);
 const[width,setWidth]=useState('30');
 const[height,setHeight]=useState('40');
 const[thickness,setThickness]=useState('0,011');
 const priced=suppliers.filter(s=>!s.archivedAt&&s.pricePerKg!=null);
 const[supplierChoice,setSupplierChoice]=useState<string|null>(null);
 const[manualKg,setManualKg]=useState('40,00');
 const[colors,setColors]=useState('1');
 const[quantity,setQuantity]=useState('1000');
 // Custos em uso: os salvos no banco (bag_pricing_settings) ou, se indisponíveis, os padrões do código.
 const[base,setBase]=useState<PricingSettings>(DEFAULT_SETTINGS);
 const[settingsState,setSettingsState]=useState<'loading'|'saved'|'default'>('loading');
 const[margin,setMargin]=useState(()=>marginTextOf(DEFAULT_SETTINGS));
 const[costText,setCostText]=useState(()=>costTextOf(DEFAULT_SETTINGS));
 const[showCosts,setShowCosts]=useState(false);
 const[confirmSave,setConfirmSave]=useState(false);
 const[saving,setSaving]=useState(false);
 const[saveError,setSaveError]=useState('');

 const loadSettings=useCallback(async()=>{
  const client=supabase;
  if(!client){setSettingsState('default');return;}
  const{data,error}=await client.from('bag_pricing_settings').select('labor_monthly_cents,hours_per_thousand,ink_cents,solvent_cents,energy_per_hour_cents,one_color_extra_cents,margin_pct').eq('id',1).maybeSingle();
  if(error||!data){setSettingsState('default');return;}
  try{const loaded=settingsFromRow(data as PricingSettingsRow);setBase(loaded);setCostText(costTextOf(loaded));setMargin(marginTextOf(loaded));setSettingsState('saved');}
  catch{setSettingsState('default');}
 },[]);
 useEffect(()=>{void loadSettings();},[loadSettings]);

 function choosePreset(id:string){
  setPresetId(id);
  const p=BAG_PRESETS.find(x=>x.id===id);
  if(p){setWidth(String(p.width));setHeight(String(p.height));setThickness(p.thickness.toFixed(3).replace('.',','));}
 }
 // Fornecedores com preço do kg no cadastro; sem nenhum (ex.: antes da migration 0004), usa a lista de referência do código.
 const supplierOptions=priced.length
  ?priced.map(s=>({value:s.id,name:s.name,pricePerKg:s.pricePerKg!,source:'cadastro'}))
  :MATERIAL_SUPPLIERS.map(s=>({value:'ref:'+s.id,name:s.name,pricePerKg:s.pricePerKg as number,source:'referência'}));
 const defaultSupplier=(supplierOptions.find(o=>o.name.toLocaleLowerCase('pt-BR')==='2 irmão')??supplierOptions[0])?.value??MANUAL;
 const supplierId=supplierChoice&&(supplierChoice===MANUAL||supplierOptions.some(o=>o.value===supplierChoice))?supplierChoice:defaultSupplier;
 const supplier=supplierOptions.find(o=>o.value===supplierId)??null;
 const baseText=costTextOf(base);
 const changedCosts=COST_FIELDS.some(f=>costText[f.key]!==baseText[f.key])||margin!==marginTextOf(base);

 const result=useMemo(()=>{
  try{
   const qty=Number(quantity);
   if(!/^\d+$/.test(quantity.trim()))throw new Error('Informe a quantidade em unidades inteiras.');
   const costs=Object.fromEntries(COST_FIELDS.map(f=>[f.key,parse(costText[f.key],f.label.replace(/ \(R\$\)/,'').toLowerCase())])) as PrintCosts;
   const input={width:parse(width,'a largura'),height:parse(height,'a altura'),thickness:parse(thickness,'a espessura'),
    pricePerKg:supplier?supplier.pricePerKg!:parse(manualKg,'o preço do kg'),colors:Number(colors),quantity:qty,margin:parse(margin,'a margem')/100,costs};
   return {ok:true as const,input,quote:bagQuote(input),settings:{costs,margin:input.margin} as PricingSettings};
  }catch(e){return {ok:false as const,error:errorMessage(e,'Verifique os valores informados.')};}
 },[width,height,thickness,supplier,manualKg,colors,quantity,margin,costText]);

 async function saveDefaults(){
  if(!result.ok)return;
  const client=supabase;if(!client)return;
  setSaving(true);setSaveError('');
  try{
   const{error}=await client.rpc('set_bag_pricing_settings',settingsToRpc(result.settings));
   if(error)throw error;
   await loadSettings();
   setConfirmSave(false);
   onNotice('Custos atualizados para todos os cálculos.');
  }catch(e){setSaveError(errorMessage(e,'Não foi possível salvar os custos.'));setConfirmSave(false);}
  finally{setSaving(false);}
 }
 function addToQuote(){
  if(!result.ok)return;
  onAddToQuote({description:bagLineDescription(result.input,preset?.model),quantity:result.input.quantity,lineTotalCents:result.quote.totalCents});
 }

 async function copySummary(){
  if(!result.ok)return;
  const{input,quote}=result;
  const name=(preset?preset.model+' ':'Sacola ')+num(input.width)+'x'+num(input.height)+' cm';
  const text=[`${name}, espessura ${dec(input.thickness)} mm, ${input.colors} ${input.colors===1?'cor':'cores'}`,
   `${num(input.quantity)} unidades: ${brl(quote.total)} (${brl(quote.unitPrice,4)} por unidade)`].join('\n');
  try{await navigator.clipboard.writeText(text);onNotice('Resumo copiado.');}catch{onNotice('Não foi possível copiar automaticamente.');}
 }

 const section='space-y-4 rounded-xl border border-border bg-card p-4 shadow-card sm:p-5';
 return <div className="grid gap-5 pb-20 lg:grid-cols-[minmax(0,1fr)_minmax(320px,400px)] lg:items-start lg:pb-0">
  <div className="min-w-0 space-y-4">
   <section className={section}>
    <SectionTitle icon={<Ruler/>} description="Os tamanhos padrão já vêm com a espessura de referência.">Sacola</SectionTitle>
    <Field id="calc-size" label="Tamanho">
     <NativeSelect id="calc-size" value={presetId} onChange={e=>choosePreset(e.target.value)}>
      {(['Alça C / boca de palhaço','Camiseta'] as const).map(model=><optgroup key={model} label={model}>{BAG_PRESETS.filter(p=>p.model===model).map(p=><option key={p.id} value={p.id}>{p.width} × {p.height} cm</option>)}</optgroup>)}
      <option value={CUSTOM}>Outro tamanho…</option>
     </NativeSelect>
    </Field>
    {presetId===CUSTOM&&<div className="grid grid-cols-2 gap-4">
     <Field id="calc-width" label="Largura (cm)"><Input id="calc-width" className="tabular" inputMode="decimal" value={width} onChange={e=>setWidth(e.target.value)}/></Field>
     <Field id="calc-height" label="Altura (cm)"><Input id="calc-height" className="tabular" inputMode="decimal" value={height} onChange={e=>setHeight(e.target.value)}/></Field>
    </div>}
    <Field id="calc-thickness" label="Espessura (mm)" help={preset?`Referência deste tamanho: ${dec(preset.thickness)} mm. A espessura varia por fornecedor (normal 0,010; até 0,012).`:'Normal 0,010 mm; pode chegar a 0,011 ou 0,012 conforme o fornecedor.'}>
     <div className="flex flex-wrap gap-2">
      <Input id="calc-thickness" className="tabular w-28" inputMode="decimal" value={thickness} onChange={e=>setThickness(e.target.value)}/>
      {['0,010','0,011','0,012'].map(t=><Button key={t} variant="outline" size="sm" className={cn('h-10 tabular',thickness===t&&'border-brand bg-brand-soft text-brand hover:bg-brand-soft hover:text-brand')} aria-pressed={thickness===t} onClick={()=>setThickness(t)}>{t}</Button>)}
     </div>
    </Field>
   </section>

   <section className={section}>
    <SectionTitle icon={<Truck/>} description="Escolha o fornecedor do material ou informe o preço do kg.">Material</SectionTitle>
    <div className="grid gap-4 sm:grid-cols-2">
     <Field id="calc-supplier" label="Fornecedor">
      <NativeSelect id="calc-supplier" value={supplierId} onChange={e=>setSupplierChoice(e.target.value)}>
       {supplierOptions.map(o=><option key={o.value} value={o.value}>{o.name} — {brl(o.pricePerKg)}/kg</option>)}
       <option value={MANUAL}>Informar preço do kg…</option>
      </NativeSelect>
     </Field>
     {supplierId===MANUAL
      ?<Field id="calc-kg" label="Preço do kg (R$)"><MoneyInput id="calc-kg" value={manualKg} onChange={e=>setManualKg(e.target.value)}/></Field>
      :<div className="flex flex-col justify-end"><p className="rounded-lg bg-muted px-3 py-2.5 text-sm text-muted-foreground">Usando <b className="text-foreground">{brl(supplier?.pricePerKg??0)}/kg</b> ({supplier?.source}).</p></div>}
    </div>
    <p className="-mt-1 text-xs text-muted-foreground">{priced.length?'Para atualizar o preço do kg, edite o fornecedor em Fornecedores.':'Cadastre o “Preço por kg” dos fornecedores para usar valores atualizados; por enquanto aparecem os preços de referência.'}</p>
   </section>

   <section className={section}>
    <SectionTitle icon={<Palette/>}>Impressão e quantidade</SectionTitle>
    <div className="flex flex-col gap-1.5">
     <span className="text-[13px] font-semibold text-foreground">Cores</span>
     <Segmented label="Número de cores" value={colors} onChange={setColors} options={Array.from({length:MAX_COLORS},(_,i)=>({value:String(i+1),label:i?`${i+1} cores`:'1 cor'}))}/>
    </div>
    <Field id="calc-qty" label="Quantidade (unidades)">
     <Input id="calc-qty" className="tabular h-12 text-lg font-semibold" type="number" min={1} step={1} inputMode="numeric" value={quantity} onChange={e=>setQuantity(e.target.value)}/>
    </Field>
    <div className="-mt-1 flex flex-wrap gap-2" role="group" aria-label="Quantidades comuns">
     {([...LOT_SIZES].reverse() as number[]).concat([2000,3000,5000]).map(n=><button key={n} type="button" onClick={()=>setQuantity(String(n))} className={cn('tabular h-8 rounded-full border border-border bg-card px-3 text-[13px] font-semibold text-muted-foreground transition-colors hover:border-brand/40 hover:text-brand',quantity===String(n)&&'border-brand bg-brand-soft text-brand')}>{num(n)}</button>)}
    </div>
   </section>

   <section className="rounded-xl border border-border bg-card shadow-card">
    <button type="button" aria-expanded={showCosts} onClick={()=>setShowCosts(v=>!v)} className="flex w-full items-center gap-3 p-4 text-left sm:p-5">
     <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-brand-soft text-brand"><Settings2 className="size-4"/></span>
     <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-foreground">Custos e margem</span><span className="block text-xs text-muted-foreground">{changedCosts?'Valores ajustados nesta simulação.':settingsState==='saved'?'Valores salvos no sistema.':settingsState==='loading'?'Carregando custos salvos…':'Valores padrão (custos salvos indisponíveis).'}</span></span>
     {changedCosts&&<Badge variant="orange">Ajustado</Badge>}
     <span className="text-xs font-semibold text-brand">{showCosts?'Ocultar':'Ajustar'}</span>
    </button>
    {showCosts&&<div className="space-y-4 border-t border-border p-4 sm:p-5">
     <div className="grid gap-4 sm:grid-cols-2">
      <Field id="calc-margin" label="Margem sobre o material (%)"><Input id="calc-margin" className="tabular" inputMode="decimal" value={margin} onChange={e=>setMargin(e.target.value)}/></Field>
      {COST_FIELDS.map(f=><Field key={f.key} id={'calc-'+f.key} label={f.label}>{f.money
       ?<MoneyInput id={'calc-'+f.key} value={costText[f.key]} onChange={e=>setCostText(c=>({...c,[f.key]:e.target.value}))}/>
       :<Input id={'calc-'+f.key} className="tabular" inputMode="decimal" value={costText[f.key]} onChange={e=>setCostText(c=>({...c,[f.key]:e.target.value}))}/>}</Field>)}
     </div>
     {saveError&&<p role="alert" className="rounded-lg border border-destructive/25 bg-destructive-soft px-3.5 py-2.5 text-sm font-medium text-destructive">{saveError}</p>}
     <div className="flex flex-wrap items-center justify-between gap-2">
      <p className="text-xs text-muted-foreground">{role==='admin'?'Ajuste para simular ou salve como novo padrão para todos.':'Os ajustes valem só para esta simulação. Só administradores salvam novos padrões.'}</p>
      <div className="flex flex-wrap gap-2">
       <Button variant="outline" size="sm" disabled={!changedCosts} onClick={()=>{setCostText(costTextOf(base));setMargin(marginTextOf(base));setSaveError('');}}><RotateCcw/>Voltar aos valores salvos</Button>
       {role==='admin'&&<Button size="sm" disabled={!changedCosts||!result.ok||saving} onClick={()=>setConfirmSave(true)}><Save/>Salvar como padrão</Button>}
      </div>
     </div>
    </div>}
   </section>
  </div>

  <div id="calc-result" className="min-w-0 scroll-mt-20 space-y-4 lg:sticky lg:top-24">
   <Card className="overflow-hidden" aria-live="polite">
    <div className="relative overflow-hidden bg-sidebar p-5 text-white">
     <div aria-hidden className="absolute -right-16 -top-20 size-56 rounded-full bg-[radial-gradient(circle,rgba(255,134,43,0.35),transparent_65%)]"/>
     <p className="relative flex items-center gap-2 text-xs font-bold uppercase tracking-[0.14em] text-orange"><Calculator className="size-4"/>Preço calculado</p>
     {result.ok?<>
      <p className="calc-total relative mt-2 text-[34px] font-extrabold leading-none tracking-tight tabular">{brl(result.quote.total)}</p>
      <p className="relative mt-2 text-sm text-sidebar-foreground"><span className="tabular font-semibold text-white">{num(result.input.quantity)}</span> un. · <span className="calc-unit tabular">{brl(result.quote.unitPrice,4)}</span> por unidade</p>
     </>:<p className="relative mt-3 text-sm font-medium text-white">Complete os dados para ver o preço.</p>}
    </div>
    {result.ok?<div className="p-5">
     <p className="calc-rule rounded-lg bg-muted px-3 py-2.5 text-[13px] text-muted-foreground">
      {result.quote.appliedLot===result.input.quantity?<>Preço do {lotName(result.quote.appliedLot)}.</>
       :<>Preço do {lotName(result.quote.appliedLot)} ÷ {num(result.quote.appliedLot)} × {num(result.input.quantity)}.</>}
     </p>
     {result.quote.belowMinimumLot&&<p className="mt-3 flex gap-2 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2.5 text-[13px] text-warning"><AlertTriangle className="mt-0.5 size-4 shrink-0"/>Abaixo do menor lote (60 un.). O valor usa o preço unitário do lote de 60.</p>}
     <div className="mt-3 divide-y divide-border">
      <Row label="Peso" value={num(result.quote.kgPerThousand,2)+' kg por mil'}/>
      <Row label={`Impressão (${result.input.colors} ${result.input.colors===1?'cor':'cores'}) por mil`} value={brl(result.quote.printPerThousand)}/>
      <Row label={`Material + ${num(result.input.margin!*100,1)}% por mil`} value={brl(result.quote.materialPerThousand)}/>
      <Row label="Preço do milheiro" value={brl(result.quote.lots[0].price)} strong/>
     </div>
     <div className="mt-4 grid gap-2">
      <Button onClick={addToQuote}><FilePlus2/>Adicionar ao orçamento</Button>
      <Button variant="outline" onClick={()=>void copySummary()}><Copy/>Copiar resumo</Button>
     </div>
    </div>:<div className="p-5"><p role="alert" className="calc-error rounded-lg border border-destructive/25 bg-destructive-soft px-3.5 py-3 text-sm font-medium text-destructive">{result.error}</p></div>}
   </Card>

   {result.ok&&<Card className="overflow-hidden">
    <CardHeader title="Preço por lote" description="Mesma sacola, cores e material." action={<Layers className="size-4 text-muted-foreground"/>}/>
    <table className="w-full text-sm">
     <thead><tr className="text-left text-xs text-muted-foreground"><th className="px-5 py-2 font-semibold">Lote</th><th className="px-5 py-2 text-right font-semibold">Preço do lote</th><th className="px-5 py-2 text-right font-semibold">Por unidade</th></tr></thead>
     <tbody className="divide-y divide-border">{result.quote.lots.map(l=><tr key={l.size} className={cn(l.size===result.quote.appliedLot&&'bg-brand-soft/60')}>
      <td className="whitespace-nowrap px-5 py-2.5 font-medium text-foreground">{num(l.size)} un.{l.size===result.quote.appliedLot&&<Badge className="ml-2">usado</Badge>}</td>
      <td className="tabular px-5 py-2.5 text-right text-foreground">{brl(l.price)}</td>
      <td className="tabular px-5 py-2.5 text-right text-muted-foreground">{brl(l.price/l.size,4)}</td>
     </tr>)}</tbody>
    </table>
   </Card>}
  </div>

  <ConfirmDialog open={confirmSave} busy={saving} onCancel={()=>setConfirmSave(false)} onConfirm={()=>void saveDefaults()} icon={saving?<Loader2 className="spinning"/>:<Save/>}
   title="Salvar novos custos?" body="Os valores ajustados passam a valer para todos os cálculos da calculadora, para todas as pessoas. Orçamentos já criados não mudam." confirmLabel="Salvar para todos"/>

  <button type="button" onClick={()=>document.getElementById('calc-result')?.scrollIntoView({behavior:'smooth'})}
   className="calc-sticky fixed inset-x-3 bottom-[calc(72px+env(safe-area-inset-bottom))] z-20 flex items-center gap-3 rounded-2xl bg-sidebar px-4 py-3 text-left text-white shadow-pop lg:hidden">
   <Calculator aria-hidden className="size-5 shrink-0 text-orange"/>
   {result.ok?<span className="min-w-0 flex-1"><span className="tabular block text-lg font-extrabold leading-tight">{brl(result.quote.total)}</span><span className="tabular block truncate text-xs text-sidebar-foreground">{num(result.input.quantity)} un. · {brl(result.quote.unitPrice,4)}/un.</span></span>
    :<span className="flex-1 text-sm font-medium">Complete os dados para ver o preço</span>}
   <span className="shrink-0 text-xs font-semibold text-orange">Detalhes</span>
  </button>
 </div>;
}
