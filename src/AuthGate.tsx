import {createContext,useEffect,useState,type FormEvent,type ReactNode} from 'react';
import {supabase} from './lib/supabase';
import type {Session} from '@supabase/supabase-js';
import {authErrorMessage,errorMessage,normalizeInviteCode,signupPayload,validateNewPassword,PASSWORD_MIN_LENGTH,type MemberRole} from './lib/domain';

/** Papel do membro autenticado. A interface usa só para exibir telas; o banco revalida cada operação. */
export const MemberRoleContext=createContext<MemberRole>('member');

const PENDING_INVITE_KEY='vetor.pendingInvite';
const readPendingInvite=()=>{try{return localStorage.getItem(PENDING_INVITE_KEY)||''}catch{return ''}};
const writePendingInvite=(code:string)=>{try{if(code)localStorage.setItem(PENDING_INVITE_KEY,code);else localStorage.removeItem(PENDING_INVITE_KEY)}catch{/* armazenamento indisponível: o código é digitado de novo */}};

type Mode='login'|'signup'|'recover'|'set';

export default function AuthGate({children}:{children:ReactNode}){
 const[session,setSession]=useState<Session|null>(null);
 const[ready,setReady]=useState(false);
 // undefined = verificando; null = sem acesso; papel = membro.
 const[role,setRole]=useState<MemberRole|null|undefined>(undefined);
 const[email,setEmail]=useState('');const[password,setPassword]=useState('');const[confirm,setConfirm]=useState('');const[code,setCode]=useState(readPendingInvite);
 const[error,setError]=useState('');const[busy,setBusy]=useState(false);const[mode,setMode]=useState<Mode>('login');const[notice,setNotice]=useState('');
 const userId=session?.user.id;

 useEffect(()=>{if(!supabase){setReady(true);return}if(location.hash.includes('type=invite')||location.hash.includes('type=recovery'))setMode('set');let live=true;supabase.auth.getSession().then(({data})=>{if(live){setSession(data.session);setReady(true)}});const{data:{subscription}}=supabase.auth.onAuthStateChange((event,s)=>{setSession(s);if(event==='PASSWORD_RECOVERY')setMode('set')});return()=>{live=false;subscription.unsubscribe()}},[]);
 useEffect(()=>{if(!supabase||!userId){setRole(undefined);return}let active=true;setRole(undefined);supabase.from('app_members').select('user_id,role').eq('user_id',userId).maybeSingle().then(({data,error})=>{if(!active)return;if(error){setRole(null);setError('Não foi possível verificar sua permissão.');return}setRole(data?(data.role==='admin'?'admin':'member'):null)});return()=>{active=false}},[userId]);

 function switchMode(next:Mode){setMode(next);setError('');setNotice('');setPassword('');setConfirm('')}
 async function signOut(){setError('');setNotice('');await supabase?.auth.signOut()}

 async function login(e:FormEvent){e.preventDefault();if(!supabase)return;setBusy(true);setError('');setNotice('');const{error}=await supabase.auth.signInWithPassword({email:email.trim(),password});if(error)setError(authErrorMessage(error));else setPassword('');setBusy(false)}

 async function signup(e:FormEvent){
  e.preventDefault();const client=supabase;if(!client)return;setError('');setNotice('');
  let payload;try{payload=signupPayload({email,password,confirm,code})}catch(err){setError(errorMessage(err,'Dados inválidos.'));return}
  setBusy(true);
  const{data,error}=await client.auth.signUp({email:payload.email,password:payload.password,options:{emailRedirectTo:location.origin}});
  setBusy(false);
  if(error){setError(authErrorMessage(error));return}
  writePendingInvite(payload.code);setCode(payload.code);setPassword('');setConfirm('');
  // Com confirmação de e-mail ativa não há sessão; a mensagem é a mesma para e-mail novo ou já cadastrado.
  if(!data.session){setMode('login');setNotice('Se o e-mail puder ser cadastrado, você receberá um link de confirmação. Depois de confirmar, entre com sua senha para ativar o acesso com o código.')}
 }

 async function redeem(e:FormEvent){
  e.preventDefault();const client=supabase;if(!client)return;setError('');
  let normalized;try{normalized=normalizeInviteCode(code)}catch(err){setError(errorMessage(err,'Código inválido.'));return}
  setBusy(true);
  const{data,error}=await client.rpc('redeem_invite_code',{p_code:normalized});
  setBusy(false);
  if(error){setError(authErrorMessage(error));return}
  if(data!=='admin'&&data!=='member'){setError('Código inválido, expirado ou já utilizado.');return}
  writePendingInvite('');setCode('');setRole(data);
 }

 async function reset(e:FormEvent){e.preventDefault();const client=supabase;if(!client)return;setBusy(true);setError('');const{error}=await client.auth.resetPasswordForEmail(email.trim(),{redirectTo:location.origin});setBusy(false);if(error)setError(authErrorMessage(error));else setNotice('Se o e-mail estiver cadastrado, enviaremos um link para definir sua senha.')}
 async function setNewPassword(e:FormEvent){e.preventDefault();const client=supabase;if(!client)return;setError('');try{validateNewPassword(password,confirm,session?.user.email||'')}catch(err){setError(errorMessage(err,'Senha inválida.'));return}setBusy(true);const{error}=await client.auth.updateUser({password});setBusy(false);if(error)setError(authErrorMessage(error));else{switchMode('login');setNotice('Senha cadastrada.');history.replaceState({},'',location.pathname)}}

 const alert=error&&<p role="alert" className="login-error">{error}</p>;
 const status=notice&&<p role="status" className="login-notice">{notice}</p>;
 const passwordFields=<>
  <label>Senha<input type="password" autoComplete="new-password" required minLength={PASSWORD_MIN_LENGTH} maxLength={72} value={password} onChange={e=>setPassword(e.target.value)}/></label>
  <label>Confirmar senha<input type="password" autoComplete="new-password" required minLength={PASSWORD_MIN_LENGTH} maxLength={72} value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>
  <p className="login-hint">Mínimo de {PASSWORD_MIN_LENGTH} caracteres. Prefira uma frase longa e única.</p>
 </>;
 const codeField=<label>Código de convite<input autoComplete="off" autoCapitalize="characters" spellCheck={false} required placeholder="XXXX-XXXX-XXXX-XXXX" maxLength={24} value={code} onChange={e=>setCode(e.target.value)}/></label>;

 if(!supabase)return <div style={{padding:32,fontFamily:'Inter,Arial,sans-serif'}}><h2>Configuração necessária</h2><p>Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no ambiente da aplicação.</p></div>;
 if(!ready)return <div style={{padding:32}}>Carregando…</div>;
 if(mode==='set'&&session)return <div className="login-shell"><form className="login-card" onSubmit={setNewPassword}><h1>Crie sua senha</h1><p>Defina a nova senha da sua conta.</p>{passwordFields}{alert}<button disabled={busy}>{busy?'Salvando…':'Salvar senha'}</button></form></div>;
 if(mode==='recover'&&!session)return <div className="login-shell"><form className="login-card" onSubmit={reset}><h1>Recuperar senha</h1><p>Enviaremos um link para definir uma nova senha.</p><label>E-mail<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label>{alert}{status}<button disabled={busy}>Enviar link</button><button type="button" className="login-link" onClick={()=>switchMode('login')}>Voltar</button></form></div>;
 if(mode==='signup'&&!session)return <div className="login-shell"><form className="login-card" onSubmit={signup} noValidate><div className="login-mark">V</div><h1>Criar conta</h1><p>Use o código de convite enviado por um administrador do Vetor Hub.</p><label>E-mail<input type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)}/></label>{passwordFields}{codeField}{alert}<button type="submit" disabled={busy}>{busy?'Criando…':'Criar conta'}</button><button type="button" className="login-link" onClick={()=>switchMode('login')}>Já tenho conta</button></form></div>;
 if(!session)return <div className="login-shell"><form className="login-card" onSubmit={login}><div className="login-mark">V</div><h1>Vetor Hub</h1><p>Entre para acessar a gestão da Vetor Embalagens.</p><label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="username"/></label><label>Senha<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/></label>{alert}{status}<button type="submit" disabled={busy}>{busy?'Entrando…':'Entrar'}</button><button type="button" className="login-link" onClick={()=>switchMode('signup')}>Criar conta com convite</button><button type="button" className="login-link" onClick={()=>switchMode('recover')}>Esqueci minha senha</button></form></div>;
 if(role===undefined)return <div style={{padding:32}}>Verificando acesso…</div>;
 if(role===null)return <div className="login-shell"><form className="login-card" onSubmit={redeem}><h2>Acesso não autorizado</h2><p>A conta {session.user.email} ainda não tem acesso aos dados. Informe o código de convite recebido de um administrador.</p>{codeField}{alert}<button type="submit" disabled={busy}>{busy?'Ativando…':'Ativar acesso'}</button><button type="button" className="login-link" onClick={()=>void signOut()}>Sair</button></form></div>;
 return <MemberRoleContext.Provider value={role}>{children}<button className="logout-fixed" onClick={()=>void signOut()}>Sair da conta</button></MemberRoleContext.Provider>;
}
