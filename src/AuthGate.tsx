import {createContext,useEffect,useState,type FormEvent,type ReactNode} from 'react';
import {ArrowLeft,FileText,KeyRound,Loader2,LogOut,PackageCheck,ShieldCheck} from 'lucide-react';
import {supabase} from './lib/supabase';
import ThemeToggle from './components/ThemeToggle';
import {Button} from './components/ui/button';
import {Field,Input} from './components/ui/form';
import type {Session} from '@supabase/supabase-js';
import {authErrorMessage,errorMessage,normalizeInviteCode,signupPayload,validateNewPassword,PASSWORD_MIN_LENGTH,type MemberRole} from './lib/domain';

/** Papel do membro autenticado. A interface usa só para exibir telas; o banco revalida cada operação. */
export const MemberRoleContext=createContext<MemberRole>('member');
/** Conta da sessão atual, para o menu de usuário (e-mail e saída). */
export const AccountContext=createContext<{email:string;signOut:()=>Promise<void>}>({email:'',signOut:async()=>{}});

const PENDING_INVITE_KEY='vetor.pendingInvite';
const readPendingInvite=()=>{try{return localStorage.getItem(PENDING_INVITE_KEY)||''}catch{return ''}};
const writePendingInvite=(code:string)=>{try{if(code)localStorage.setItem(PENDING_INVITE_KEY,code);else localStorage.removeItem(PENDING_INVITE_KEY)}catch{/* armazenamento indisponível: o código é digitado de novo */}};

type Mode='login'|'signup'|'recover'|'set';

function Logo({className='size-11'}:{className?:string}){
 return <img src="/icon.svg" alt="" className={className+' rounded-xl'}/>;
}

/** Tela cheia de espera, com a marca, enquanto a sessão ou o acesso são verificados. */
function Splash({label}:{label:string}){
 return <div className="grid min-h-dvh place-items-center bg-background">
  <div className="flex flex-col items-center gap-4 text-muted-foreground">
   <Logo className="size-14"/>
   <span className="flex items-center gap-2 text-sm font-medium"><Loader2 className="size-4 spinning"/>{label}</span>
  </div>
 </div>;
}

/** Layout das telas de acesso: painel da marca (desktop) + cartão do formulário. */
function AuthLayout({children}:{children:ReactNode}){
 const features=[
  {Icon:PackageCheck,title:'Estoque rastreável',text:'Entradas e saídas com histórico e saldo sempre conferido.'},
  {Icon:FileText,title:'Orçamentos em minutos',text:'Monte propostas, exporte em PDF e converta em pedidos.'},
  {Icon:ShieldCheck,title:'Acesso por convite',text:'Cada pessoa entra com o próprio login e permissão.'}
 ];
 return <div className="grid min-h-dvh bg-background lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]">
  <aside className="relative hidden overflow-hidden bg-sidebar p-12 text-white lg:flex lg:flex-col">
   <div aria-hidden className="absolute -right-32 -top-32 size-[420px] rounded-full bg-[radial-gradient(circle,rgba(255,134,43,0.35),transparent_65%)]"/>
   <div aria-hidden className="absolute -bottom-40 -left-24 size-[480px] rounded-full bg-[radial-gradient(circle,rgba(110,116,255,0.35),transparent_65%)]"/>
   <div className="relative flex items-center gap-3"><Logo/><div><p className="text-lg font-extrabold leading-none">Vetor <span className="text-orange">Hub</span></p><p className="mt-1 text-[11px] font-semibold tracking-[0.16em] text-sidebar-muted">VETOR EMBALAGENS</p></div></div>
   <div className="relative mt-auto max-w-md">
    <h2 className="text-[34px] font-extrabold leading-[1.15] tracking-tight">A operação da Vetor, organizada em um só lugar.</h2>
    <ul className="mt-10 space-y-6">
     {features.map(({Icon,title,text})=><li key={title} className="flex gap-4">
      <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-white/10 text-orange"><Icon className="size-5"/></span>
      <div><p className="font-bold">{title}</p><p className="text-sm text-sidebar-foreground">{text}</p></div>
     </li>)}
    </ul>
   </div>
   <p className="relative mt-12 text-xs text-sidebar-muted">© Vetor Embalagens · Gestão comercial e de estoque</p>
  </aside>
  <main className="relative flex flex-col items-center justify-center px-4 py-16 sm:px-8">
   <ThemeToggle className="absolute right-4 top-4"/>
   <div className="mb-8 flex items-center gap-3 lg:hidden"><Logo/><div><p className="text-lg font-extrabold leading-none text-foreground">Vetor <span className="text-orange">Hub</span></p><p className="mt-1 text-[11px] font-semibold tracking-[0.16em] text-muted-foreground">VETOR EMBALAGENS</p></div></div>
   <div className="w-full max-w-[400px]">{children}</div>
  </main>
 </div>;
}

function AuthCard({title,description,onSubmit,noValidate,children}:{title:string;description:ReactNode;onSubmit:(e:FormEvent)=>void;noValidate?:boolean;children:ReactNode}){
 return <form className="login-card flex flex-col gap-4 rounded-2xl border border-border bg-card p-6 shadow-card sm:p-8" onSubmit={onSubmit} noValidate={noValidate}>
  <div className="mb-1">
   <h1 className="text-2xl font-extrabold tracking-tight text-foreground">{title}</h1>
   <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{description}</p>
  </div>
  {children}
 </form>;
}

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

 const alert=error&&<p role="alert" className="login-error rounded-lg border border-destructive/25 bg-destructive-soft px-3.5 py-2.5 text-sm font-medium text-destructive">{error}</p>;
 const status=notice&&<p role="status" className="login-notice rounded-lg border border-success/25 bg-success-soft px-3.5 py-2.5 text-sm font-medium text-success">{notice}</p>;
 const emailField=<Field id="auth-email" label="E-mail"><Input id="auth-email" type="email" autoComplete="username" required value={email} onChange={e=>setEmail(e.target.value)} placeholder="voce@vetorembalagens.com.br"/></Field>;
 const passwordFields=<>
  <Field id="auth-new-password" label="Senha"><Input id="auth-new-password" type="password" autoComplete="new-password" required minLength={PASSWORD_MIN_LENGTH} maxLength={72} value={password} onChange={e=>setPassword(e.target.value)}/></Field>
  <Field id="auth-confirm" label="Confirmar senha" help={`Mínimo de ${PASSWORD_MIN_LENGTH} caracteres. Prefira uma frase longa e única.`}><Input id="auth-confirm" type="password" autoComplete="new-password" required minLength={PASSWORD_MIN_LENGTH} maxLength={72} value={confirm} onChange={e=>setConfirm(e.target.value)}/></Field>
 </>;
 const codeField=<Field id="auth-code" label="Código de convite"><Input id="auth-code" className="font-mono tracking-wider uppercase" autoComplete="off" autoCapitalize="characters" spellCheck={false} required placeholder="XXXX-XXXX-XXXX-XXXX" maxLength={24} value={code} onChange={e=>setCode(e.target.value)}/></Field>;
 const back=(label:string)=><Button variant="ghost" className="text-muted-foreground" onClick={()=>switchMode('login')}><ArrowLeft/>{label}</Button>;

 if(!supabase)return <div className="grid min-h-dvh place-items-center bg-background p-6"><div className="max-w-md rounded-2xl border border-border bg-card p-8 shadow-card"><h2 className="text-xl font-bold text-foreground">Configuração necessária</h2><p className="mt-2 text-sm text-muted-foreground">Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no ambiente da aplicação.</p></div></div>;
 if(!ready)return <Splash label="Carregando…"/>;
 if(mode==='set'&&session)return <AuthLayout><AuthCard title="Crie sua senha" description="Defina a nova senha da sua conta." onSubmit={setNewPassword}>{passwordFields}{alert}<Button type="submit" size="lg" disabled={busy}>{busy?<><Loader2 className="spinning"/>Salvando…</>:'Salvar senha'}</Button></AuthCard></AuthLayout>;
 if(mode==='recover'&&!session)return <AuthLayout><AuthCard title="Recuperar senha" description="Enviaremos um link para você definir uma nova senha." onSubmit={reset}>{emailField}{alert}{status}<Button type="submit" size="lg" disabled={busy}>{busy?<><Loader2 className="spinning"/>Enviando…</>:'Enviar link'}</Button>{back('Voltar')}</AuthCard></AuthLayout>;
 if(mode==='signup'&&!session)return <AuthLayout><AuthCard title="Criar conta" description="Use o código de convite enviado por um administrador do Vetor Hub." onSubmit={signup} noValidate>{emailField}{passwordFields}{codeField}{alert}<Button type="submit" size="lg" disabled={busy}>{busy?<><Loader2 className="spinning"/>Criando…</>:'Criar conta'}</Button>{back('Já tenho conta')}</AuthCard></AuthLayout>;
 if(!session)return <AuthLayout><AuthCard title="Entrar no Vetor Hub" description="Acesse a gestão comercial e de estoque da Vetor Embalagens." onSubmit={login}>
  {emailField}
  <Field id="auth-password" label="Senha"><Input id="auth-password" type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/></Field>
  <div className="-mt-2 flex justify-end"><Button variant="link" size="sm" onClick={()=>switchMode('recover')}>Esqueci minha senha</Button></div>
  {alert}{status}
  <Button type="submit" size="lg" disabled={busy}>{busy?<><Loader2 className="spinning"/>Entrando…</>:'Entrar'}</Button>
  <div className="relative my-1 text-center text-xs text-muted-foreground before:absolute before:inset-x-0 before:top-1/2 before:h-px before:bg-border"><span className="relative bg-card px-3">Recebeu um convite?</span></div>
  <Button variant="outline" size="lg" onClick={()=>switchMode('signup')}><KeyRound/>Criar conta com convite</Button>
 </AuthCard></AuthLayout>;
 if(role===undefined)return <Splash label="Verificando acesso…"/>;
 if(role===null)return <AuthLayout><AuthCard title="Acesso não autorizado" description={<>A conta <b className="text-foreground">{session.user.email}</b> ainda não tem acesso aos dados. Informe o código de convite recebido de um administrador.</>} onSubmit={redeem}>{codeField}{alert}<Button type="submit" size="lg" disabled={busy}>{busy?<><Loader2 className="spinning"/>Ativando…</>:'Ativar acesso'}</Button><Button variant="ghost" className="text-muted-foreground" onClick={()=>void signOut()}><LogOut/>Sair</Button></AuthCard></AuthLayout>;
 return <MemberRoleContext.Provider value={role}><AccountContext.Provider value={{email:session.user.email||'',signOut}}>{children}</AccountContext.Provider></MemberRoleContext.Provider>;
}
