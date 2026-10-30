import {useEffect,useState,type FormEvent} from 'react';
import {Copy,KeyRound,Loader2,RefreshCw,ShieldCheck,Ticket,UserMinus,UserRound,Users} from 'lucide-react';
import {supabase} from '../lib/supabase';
import {Button} from './ui/button';
import {Badge,Card,CardHeader,EmptyState,ListSkeleton} from './ui/display';
import {Field,Input,NativeSelect} from './ui/form';
import {ConfirmDialog} from './ui/overlays';
import {ErrorBanner} from './ui/toast';
import {errorMessage,inviteStatus,memberChangeBlock,type MemberRole} from '../lib/domain';
import {cn} from '../lib/utils';

type Member={user_id:string;email:string;role:MemberRole;created_at:string};
type Invite={invite_id:string;role:MemberRole;note:string;created_at:string;expires_at:string;used_at:string|null;used_by_email:string|null;revoked_at:string|null};
type Confirm={kind:'remove';member:Member}|{kind:'role';member:Member;next:MemberRole}|{kind:'revoke';invite:Invite};
const roleLabel=(role:MemberRole)=>role==='admin'?'Administrador':'Membro';
const when=(iso:string)=>new Date(iso).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});
const inviteVariant={Ativo:'success',Usado:'default',Revogado:'destructive',Expirado:'neutral'} as const;

export default function UsersPage({onNotice}:{onNotice:(message:string)=>void}){
 const[members,setMembers]=useState<Member[]>([]);
 const[invites,setInvites]=useState<Invite[]>([]);
 const[selfId,setSelfId]=useState('');
 const[loading,setLoading]=useState(true);
 const[error,setError]=useState('');
 const[busy,setBusy]=useState(false);
 const[form,setForm]=useState({role:'member' as MemberRole,hours:'72',note:''});
 const[created,setCreated]=useState<{code:string;expiresAt:string}|null>(null);
 const[confirm,setConfirm]=useState<Confirm|null>(null);

 async function refresh(){
  const client=supabase;if(!client)return;
  setLoading(true);setError('');
  try{
   const[m,i,s]=await Promise.all([client.rpc('list_members'),client.rpc('list_invite_codes'),client.auth.getSession()]);
   const failure=m.error||i.error;if(failure)throw failure;
   setMembers((m.data||[]) as Member[]);setInvites((i.data||[]) as Invite[]);setSelfId(s.data.session?.user.id||'');
  }catch(e){setError(errorMessage(e,'Falha ao carregar usuários.'));}
  finally{setLoading(false);}
 }
 useEffect(()=>{void refresh();},[]);

 async function createInvite(e:FormEvent){
  e.preventDefault();const client=supabase;if(!client)return;
  setBusy(true);setError('');setCreated(null);
  try{
   const{data,error}=await client.rpc('create_invite_code',{p_role:form.role,p_valid_hours:Number(form.hours),p_note:form.note.trim()});
   if(error)throw error;
   const row=(Array.isArray(data)?data[0]:data) as {invite_code:string;invite_expires_at:string}|undefined;
   if(!row?.invite_code)throw new Error('O servidor não retornou o código.');
   setCreated({code:row.invite_code,expiresAt:row.invite_expires_at});setForm(f=>({...f,note:''}));
   await refresh();
  }catch(err){setError(errorMessage(err,'Falha ao gerar convite.'));}
  finally{setBusy(false);}
 }

 async function copyCode(){if(!created)return;try{await navigator.clipboard.writeText(created.code);onNotice('Código copiado.');}catch{setError('Não foi possível copiar. Selecione o código e copie manualmente.');}}

 async function runConfirm(){
  const client=supabase,target=confirm;if(!client||!target)return;
  if(target.kind!=='revoke'){const block=memberChangeBlock(members,target.member.user_id,target.kind==='remove'?null:target.next);if(block){setError(block);setConfirm(null);return;}}
  setBusy(true);setError('');
  try{
   const{error}=target.kind==='revoke'?await client.rpc('revoke_invite_code',{p_invite_id:target.invite.invite_id})
    :target.kind==='remove'?await client.rpc('remove_member',{p_user_id:target.member.user_id})
    :await client.rpc('set_member_role',{p_user_id:target.member.user_id,p_role:target.next});
   if(error)throw error;
   setConfirm(null);
   onNotice(target.kind==='revoke'?'Convite revogado.':target.kind==='remove'?'Acesso removido.':'Papel atualizado.');
   // Quem se rebaixa ou se remove perde a tela: recarregar reavalia o acesso no AuthGate.
   if(target.kind!=='revoke'&&target.member.user_id===selfId){location.reload();return;}
   await refresh();
  }catch(err){setError(errorMessage(err,'Falha ao salvar alteração.'));setConfirm(null);}
  finally{setBusy(false);}
 }

 const confirmText=confirm?confirm.kind==='revoke'?{title:'Revogar convite?',subject:confirm.invite.note||'Convite de '+roleLabel(confirm.invite.role),body:'O código deixará de funcionar imediatamente.',action:'Revogar',destructive:true}
  :confirm.kind==='remove'?{title:'Remover acesso?',subject:confirm.member.email,body:'A conta continua existindo, mas não verá mais nenhum dado. Para voltar, precisará de um novo convite.',action:'Remover acesso',destructive:true}
  :{title:'Alterar papel?',subject:confirm.member.email,body:confirm.next==='admin'?'Administradores podem convidar pessoas, alterar papéis e remover acessos.':'A conta deixará de gerenciar usuários, mas continua operando o sistema.',action:'Confirmar',destructive:false}:null;
 const activeInvites=invites.filter(i=>inviteStatus(i)==='Ativo').length;

 return <div className="users-page space-y-5">
  <div className="flex items-center justify-between gap-3">
   <div className="flex flex-wrap gap-2"><Badge variant="default"><Users/>{members.length} {members.length===1?'membro':'membros'}</Badge><Badge variant="success"><Ticket/>{activeInvites} {activeInvites===1?'convite ativo':'convites ativos'}</Badge></div>
   <Button variant="outline" size="icon" title="Recarregar" aria-label="Recarregar" disabled={loading} onClick={()=>void refresh()}><RefreshCw className={loading?'spinning':''}/></Button>
  </div>
  <ErrorBanner message={error}/>

  <Card>
   <CardHeader title="Convidar pessoa" description="O código vale para uma única conta e expira no prazo escolhido."/>
   <form className="invite-form grid gap-4 p-4 sm:p-5 md:grid-cols-[160px_150px_minmax(0,1fr)_auto] md:items-end" onSubmit={createInvite}>
    <Field id="invite-role" label="Papel"><NativeSelect id="invite-role" value={form.role} onChange={e=>setForm({...form,role:e.target.value as MemberRole})}><option value="member">Membro</option><option value="admin">Administrador</option></NativeSelect></Field>
    <Field id="invite-hours" label="Validade"><NativeSelect id="invite-hours" value={form.hours} onChange={e=>setForm({...form,hours:e.target.value})}><option value="24">24 horas</option><option value="72">3 dias</option><option value="168">7 dias</option></NativeSelect></Field>
    <Field id="invite-note" label="Para quem (opcional)"><Input id="invite-note" maxLength={120} value={form.note} placeholder="Ex.: Ana — vendas" onChange={e=>setForm({...form,note:e.target.value})}/></Field>
    <Button type="submit" disabled={busy}>{busy?<Loader2 className="spinning"/>:<KeyRound/>}{busy?'Gerando…':'Gerar código'}</Button>
   </form>
   {created&&<div className="invite-created mx-4 mb-4 rounded-xl border border-dashed border-orange/60 bg-orange-soft p-4 sm:mx-5 sm:mb-5" role="status">
    <p className="text-[13px] font-semibold text-orange-text">Código gerado (válido até {when(created.expiresAt)})</p>
    <div className="mt-2 flex flex-wrap items-center gap-3"><code className="rounded-lg bg-card px-3 py-2 font-mono text-lg font-bold tracking-[0.12em] text-foreground shadow-card select-all">{created.code}</code><Button variant="outline" size="sm" onClick={()=>void copyCode()}><Copy/>Copiar</Button></div>
    <small className="mt-2 block text-xs text-muted-foreground">Este código só aparece agora. Envie por um canal privado; a pessoa cria a conta em “Criar conta com convite”.</small>
   </div>}
  </Card>

  <div className="grid gap-5 xl:grid-cols-2">
   <Card className="overflow-hidden">
    <CardHeader title="Membros com acesso" action={<span className="tabular text-xs font-semibold text-muted-foreground">{members.length} {members.length===1?'membro':'membros'}</span>}/>
    {loading&&!members.length?<ListSkeleton rows={2}/>:<div className="divide-y divide-border">{members.map(m=><div className="record member-record flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5" key={m.user_id}>
     <div className={cn('grid size-10 shrink-0 place-items-center rounded-full',m.role==='admin'?'bg-orange-soft text-orange-text':'bg-brand-soft text-brand')}>{m.role==='admin'?<ShieldCheck className="size-[18px]"/>:<UserRound className="size-[18px]"/>}</div>
     <div className="record-description min-w-0 flex-1"><strong className="block truncate text-sm font-semibold text-foreground">{m.email}{m.user_id===selfId?' (você)':''}</strong><small className="block text-[13px] text-muted-foreground">{roleLabel(m.role)} · desde {when(m.created_at)}</small></div>
     <div className="record-actions flex w-full gap-2 sm:w-auto">
      <Button variant="outline" size="sm" className="flex-1 sm:flex-none" onClick={()=>setConfirm({kind:'role',member:m,next:m.role==='admin'?'member':'admin'})}>{m.role==='admin'?'Tornar membro':'Tornar admin'}</Button>
      <Button variant="soft-destructive" size="sm" className="flex-1 sm:flex-none" onClick={()=>setConfirm({kind:'remove',member:m})}><UserMinus/>Remover acesso</Button>
     </div>
    </div>)}</div>}
   </Card>

   <Card className="overflow-hidden">
    <CardHeader title="Convites" action={<span className="text-xs font-semibold text-muted-foreground">Últimos 100</span>}/>
    {!invites.length?(loading?<ListSkeleton rows={2}/>:<EmptyState icon={<Ticket/>} title="Nenhum convite gerado ainda" description="Gere um código acima para convidar alguém."/>):<div className="divide-y divide-border">{invites.map(i=>{const s=inviteStatus(i);return <div className="record invite-record flex flex-wrap items-center gap-3 px-4 py-3.5 sm:px-5" key={i.invite_id}>
     <div className="record-description min-w-0 flex-1"><strong className="block truncate text-sm font-semibold text-foreground">{i.note||'Convite sem identificação'}</strong><small className="block text-[13px] text-muted-foreground">{roleLabel(i.role)} · criado em {when(i.created_at)} · {s==='Usado'?'usado por '+(i.used_by_email||'conta removida'):s==='Ativo'?'expira em '+when(i.expires_at):s}</small></div>
     <Badge variant={inviteVariant[s]} className={'invite-status status-'+s.toLowerCase()}>{s}</Badge>
     {s==='Ativo'&&<div className="record-actions"><Button variant="soft-destructive" size="sm" onClick={()=>setConfirm({kind:'revoke',invite:i})}>Revogar</Button></div>}
    </div>;})}</div>}
   </Card>
  </div>

  <ConfirmDialog open={Boolean(confirm&&confirmText)} busy={busy} onCancel={()=>setConfirm(null)} onConfirm={()=>void runConfirm()}
   title={confirmText?.title||''} subject={confirmText?.subject} body={confirmText?.body||''} confirmLabel={confirmText?.action||''} destructive={confirmText?.destructive}
   icon={confirm?.kind==='role'?<ShieldCheck/>:<UserMinus/>}/>
 </div>;
}
