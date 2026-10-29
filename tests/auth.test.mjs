import test from 'node:test';
import assert from 'node:assert/strict';
import {
 validateNewPassword,normalizeInviteCode,signupPayload,inviteStatus,memberChangeBlock,authErrorMessage,PASSWORD_MIN_LENGTH
} from '../src/lib/domain.ts';

const strong='Caixa-Kraft-2026';

test('aceita senha forte e confirmada',()=>assert.equal(validateNewPassword(strong,strong,'a@b.com'),strong));
test('exige tamanho mínimo da senha',()=>{
 const short='Ab1-'.repeat(3).slice(0,PASSWORD_MIN_LENGTH-1);
 assert.throws(()=>validateNewPassword(short,short),/12 caracteres/);
});
test('recusa senha acima de 72 bytes, contando acentos em UTF-8',()=>{
 const ascii='a1B-x9Q!'.repeat(9);
 assert.equal(validateNewPassword(ascii,ascii),ascii);
 const accented='çãõé'.repeat(10);
 assert.throws(()=>validateNewPassword(accented,accented),/72 bytes/);
});
test('recusa senha só de espaços, igual ao e-mail ou repetitiva',()=>{
 assert.throws(()=>validateNewPassword(' '.repeat(14),' '.repeat(14)),/espaços/);
 assert.throws(()=>validateNewPassword('Ana@Vetor.com.br','Ana@Vetor.com.br','ana@vetor.com.br'),/e-mail/);
 assert.throws(()=>validateNewPassword('aaaaaaaaaaaa','aaaaaaaaaaaa'),/previsível/);
 assert.throws(()=>validateNewPassword('abababab1212','abababab1212'),/previsível/);
});
test('recusa confirmação diferente',()=>assert.throws(()=>validateNewPassword(strong,strong+'x'),/não conferem/));

test('normaliza código de convite com espaços, minúsculas e sem traços',()=>{
 assert.equal(normalizeInviteCode(' 1a2b 3c4d-5e6f 7a8b '),'1A2B-3C4D-5E6F-7A8B');
 assert.equal(normalizeInviteCode('1a2b3c4d5e6f7a8b'),'1A2B-3C4D-5E6F-7A8B');
});
test('recusa código curto, longo ou fora do alfabeto hexadecimal',()=>{
 for(const code of ['','1A2B-3C4D','1A2B-3C4D-5E6F-7A8B-9','ZZZZ-3C4D-5E6F-7A8B'])assert.throws(()=>normalizeInviteCode(code),/Código de convite/);
});

test('monta cadastro com e-mail normalizado e código formatado',()=>{
 assert.deepEqual(signupPayload({email:'  Ana@Vetor.COM ',password:strong,confirm:strong,code:'1a2b3c4d5e6f7a8b'}),
  {email:'ana@vetor.com',password:strong,code:'1A2B-3C4D-5E6F-7A8B'});
});
test('cadastro recusa e-mail inválido ou longo',()=>{
 for(const email of ['ana','ana@vetor',' @x.com','a'.repeat(250)+'@x.com'])
  assert.throws(()=>signupPayload({email,password:strong,confirm:strong,code:'1A2B3C4D5E6F7A8B'}),/E-mail inválido/);
});
test('cadastro exige código válido antes de validar senha',()=>{
 assert.throws(()=>signupPayload({email:'ana@vetor.com',password:'x',confirm:'y',code:'123'}),/Código de convite/);
});

test('classifica status do convite com precedência usado > revogado > expirado',()=>{
 const now=new Date('2026-10-29T12:00:00Z');
 assert.equal(inviteStatus({expires_at:'2026-10-30T00:00:00Z'},now),'Ativo');
 assert.equal(inviteStatus({expires_at:'2026-10-29T12:00:00Z'},now),'Expirado');
 assert.equal(inviteStatus({expires_at:'2026-10-28T00:00:00Z',revoked_at:'2026-10-27T00:00:00Z'},now),'Revogado');
 assert.equal(inviteStatus({expires_at:'2026-10-28T00:00:00Z',used_at:'2026-10-27T00:00:00Z',revoked_at:null},now),'Usado');
 assert.equal(typeof inviteStatus({expires_at:'2999-01-01T00:00:00Z'}),'string');
});

test('impede remover ou rebaixar o último administrador',()=>{
 const members=[{user_id:'a',role:'admin'},{user_id:'m',role:'member'}];
 assert.match(memberChangeBlock(members,'a',null),/ao menos um administrador/);
 assert.match(memberChangeBlock(members,'a','member'),/ao menos um administrador/);
 assert.equal(memberChangeBlock(members,'m',null),null);
 assert.equal(memberChangeBlock(members,'m','admin'),null);
});
test('permite rebaixar admin quando há outro e recusa mudanças inócuas',()=>{
 const members=[{user_id:'a',role:'admin'},{user_id:'b',role:'admin'}];
 assert.equal(memberChangeBlock(members,'a','member'),null);
 assert.match(memberChangeBlock(members,'a','admin'),/já tem esse papel/);
 assert.match(memberChangeBlock(members,'x',null),/não encontrado/);
});

test('traduz erros de autenticação sem revelar se o e-mail existe',()=>{
 assert.match(authErrorMessage({status:429,message:'x'}),/Muitas tentativas/);
 assert.match(authErrorMessage(new Error('Email rate limit exceeded')),/Muitas tentativas/);
 assert.match(authErrorMessage(new Error('Email not confirmed')),/Confirme seu e-mail/);
 assert.equal(authErrorMessage(new Error('Invalid login credentials')),'E-mail ou senha inválidos.');
 assert.match(authErrorMessage(new Error('Signups not allowed for this instance')),/desativada/);
 assert.match(authErrorMessage({message:'Password is known to be weak and easy to guess'}),/fraca/);
 assert.equal(authErrorMessage(new Error('User already registered')),'Não foi possível criar a conta com esses dados.');
 assert.equal(authErrorMessage(new Error('Outro erro')),'Outro erro');
 assert.equal(authErrorMessage(null),'Não foi possível concluir a operação.');
});
