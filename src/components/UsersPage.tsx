import {useEffect,useState,type FormEvent} from 'react';
import {Copy,KeyRound,RefreshCw,ShieldCheck,UserRound} from 'lucide-react';
import {supabase} from '../lib/supabase';
import {errorMessage,inviteStatus,memberChangeBlock,type MemberRole} from '../lib/domain';

type Member={user_id:string;email:string;role:MemberRole;created_at:string};
type Invite={invite_id:string;role:MemberRole;note:string;created_at:string;expires_at:string;used_at:string|null;used_by_email:string|null;revoked_at:string|null};
type Confirm={kind:'remove';member:Member}|{kind:'role';member:Member;next:MemberRole}|{kind:'revoke';invite:Invite};
const roleLabel=(role:MemberRole)=>role==='admin'?'Administrador':'Membro';
const when=(iso:string)=>new Date(iso).toLocaleString('pt-BR',{dateStyle:'short',timeStyle:'short'});

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

 const confirmText=confirm?confirm.kind==='revoke'?{title:'Revogar convite?',subject:confirm.invite.note||'Convite de '+roleLabel(confirm.invite.role),body:'O código deixará de funcionar imediatamente.',action:'Revogar'}
  :confirm.kind==='remove'?{title:'Remover acesso?',subject:confirm.member.email,body:'A conta continua existindo, mas não verá mais nenhum dado. Para voltar, precisará de um novo convite.',action:'Remover acesso'}
  :{title:'Alterar papel?',subject:confirm.member.email,body:confirm.next==='admin'?'Administradores podem convidar pessoas, alterar papéis e remover acessos.':'A conta deixará de gerenciar usuários, mas continua operando o sistema.',action:'Confirmar'}:null;

 return <div className="content-page users-page">
  <div className="page-heading"><div><h2>Usuários e convites</h2><p>Controle quem acessa o Vetor Hub. Novas contas só ganham acesso com um código de convite.</p></div>
   <button title="Recarregar" type="button" className="button-icon" disabled={loading} onClick={()=>void refresh()}><RefreshCw size={17} className={loading?'spinning':''}/></button></div>
  {error&&<div className="app-error" role="alert"><span>{error}</span></div>}

  <section className="panel">
   <div className="panel-heading"><h2>Convidar pessoa</h2><p>O código vale para uma única conta e expira no prazo escolhido.</p></div>
   <form className="invite-form" onSubmit={createInvite}>
    <label>Papel<select value={form.role} onChange={e=>setForm({...form,role:e.target.value as MemberRole})}><option value="member">Membro</option><option value="admin">Administrador</option></select></label>
    <label>Validade<select value={form.hours} onChange={e=>setForm({...form,hours:e.target.value})}><option value="24">24 horas</option><option value="72">3 dias</option><option value="168">7 dias</option></select></label>
    <label className="invite-note">Para quem (opcional)<input maxLength={120} value={form.note} placeholder="Ex.: Ana — vendas" onChange={e=>setForm({...form,note:e.target.value})}/></label>
    <button className="button-primary" type="submit" disabled={busy}><KeyRound size={16}/>{busy?'Gerando…':'Gerar código'}</button>
   </form>
   {created&&<div className="invite-created" role="status">
    <span>Código gerado (válido até {when(created.expiresAt)})</span>
    <div><code>{created.code}</code><button type="button" className="button-secondary" onClick={()=>void copyCode()}><Copy size={15}/> Copiar</button></div>
    <small>Este código só aparece agora. Envie por um canal privado; a pessoa cria a conta em “Criar conta com convite”.</small>
   </div>}
  </section>

  <section className="panel data-panel">
   <div className="data-heading"><span>Membros com acesso</span><small>{members.length} {members.length===1?'membro':'membros'}</small></div>
   {loading&&!members.length?<p>Carregando…</p>:<div className="records">{members.map(m=><div className="record member-record" key={m.user_id}>
    <div className="record-icon">{m.role==='admin'?<ShieldCheck size={19}/>:<UserRound size={19}/>}</div>
    <div className="record-description"><strong>{m.email}{m.user_id===selfId?' (você)':''}</strong><small>{roleLabel(m.role)} · desde {when(m.created_at)}</small></div>
    <div className="record-actions">
     <button type="button" className="action-edit" onClick={()=>setConfirm({kind:'role',member:m,next:m.role==='admin'?'member':'admin'})}>{m.role==='admin'?'Tornar membro':'Tornar admin'}</button>
     <button type="button" className="action-out" onClick={()=>setConfirm({kind:'remove',member:m})}>Remover acesso</button>
    </div>
   </div>)}</div>}
  </section>

  <section className="panel data-panel">
   <div className="data-heading"><span>Convites</span><small>Últimos 100</small></div>
   {!invites.length?<p>{loading?'Carregando…':'Nenhum convite gerado ainda.'}</p>:<div className="records">{invites.map(i=>{const s=inviteStatus(i);return <div className="record invite-record" key={i.invite_id}>
    <div className="record-description"><strong>{i.note||'Convite sem identificação'}</strong><small>{roleLabel(i.role)} · criado em {when(i.created_at)} · {s==='Usado'?'usado por '+(i.used_by_email||'conta removida'):s==='Ativo'?'expira em '+when(i.expires_at):s}</small></div>
    <span className={'invite-status status-'+s.toLowerCase()}>{s}</span>
    {s==='Ativo'&&<div className="record-actions"><button type="button" className="action-out" onClick={()=>setConfirm({kind:'revoke',invite:i})}>Revogar</button></div>}
   </div>;})}</div>}
  </section>

  {confirm&&confirmText&&<div className="archive-overlay"><section className="archive-dialog" role="alertdialog" aria-modal="true" aria-labelledby="users-confirm-title" aria-describedby="users-confirm-desc"><h2 id="users-confirm-title">{confirmText.title}</h2><p id="users-confirm-desc">{confirmText.subject}</p><p>{confirmText.body}</p><div className="archive-actions"><button className="button-secondary" type="button" disabled={busy} onClick={()=>setConfirm(null)}>Cancelar</button><button className="button-primary" type="button" disabled={busy} onClick={()=>void runConfirm()}>{busy?'Salvando…':confirmText.action}</button></div></section></div>}
 </div>;
}
