import {useEffect,useState,type FormEvent,type ReactNode} from 'react';
import {supabase} from './lib/supabase';
import type {Session} from '@supabase/supabase-js';
export default function AuthGate({children}:{children:ReactNode}){
 const[session,setSession]=useState<Session|null>(null);
 const[ready,setReady]=useState(false);
 const[authorized,setAuthorized]=useState(false);
 const[email,setEmail]=useState('');const[password,setPassword]=useState('');
 const[error,setError]=useState('');const[busy,setBusy]=useState(false);
 useEffect(()=>{if(!supabase){setReady(true);return}let live=true;supabase.auth.getSession().then(({data})=>{if(live){setSession(data.session);setReady(true)}});const{data:{subscription}}=supabase.auth.onAuthStateChange((_event,s)=>{setSession(s);setAuthorized(false)});return()=>{live=false;subscription.unsubscribe()}},[]);
 useEffect(()=>{if(!supabase||!session){setAuthorized(false);return}let active=true;supabase.from('app_members').select('user_id').eq('user_id',session.user.id).maybeSingle().then(({data,error})=>{if(active){setAuthorized(Boolean(data)&&!error);if(error)setError('Não foi possível verificar sua permissão.')}});return()=>{active=false}},[session]);
 async function login(e:FormEvent){e.preventDefault();if(!supabase)return;setBusy(true);setError('');const{error}=await supabase.auth.signInWithPassword({email,password});if(error)setError('E-mail ou senha inválidos.');setBusy(false)}
 if(!supabase)return <div style={{padding:32,fontFamily:'Inter,Arial,sans-serif'}}><h2>Configuração necessária</h2><p>Configure VITE_SUPABASE_URL e VITE_SUPABASE_PUBLISHABLE_KEY no ambiente da aplicação.</p></div>;
 if(!ready)return <div style={{padding:32}}>Carregando…</div>;
 if(!session)return <div className="login-shell"><form className="login-card" onSubmit={login}><div className="login-mark">V</div><h1>Vetor Hub</h1><p>Entre para acessar a gestão da Vetor Embalagens.</p><label>E-mail<input type="email" value={email} onChange={e=>setEmail(e.target.value)} required autoComplete="username"/></label><label>Senha<input type="password" value={password} onChange={e=>setPassword(e.target.value)} required autoComplete="current-password"/></label>{error&&<p role="alert" className="login-error">{error}</p>}<button type="submit" disabled={busy}>{busy?'Entrando…':'Entrar'}</button></form></div>;
 if(!authorized)return <div className="login-shell"><div className="login-card"><h2>Acesso não autorizado</h2><p>Este usuário ainda não recebeu permissão para acessar os dados do Vetor Hub.</p>{error&&<p role="alert">{error}</p>}<button onClick={()=>supabase.auth.signOut()}>Sair</button></div></div>;
 return <>{children}<button className="logout-fixed" onClick={()=>supabase.auth.signOut()}>Sair da conta</button></>;
}
