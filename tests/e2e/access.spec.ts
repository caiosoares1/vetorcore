import {test,expect,type Page} from '@playwright/test';
import {mockBackend,loginAsMockUser,validInviteCode,openPage} from './support/mockSupabase';

const strong='Caixa-Kraft-2026';
async function openUsers(page:Page){
 await openPage(page,'Usuários');
 await expect(page.getByRole('heading',{name:'Usuários e convites'})).toBeVisible();
}

test('cria conta com código de convite e orienta a confirmar o e-mail',async({page})=>{
 const mock=await mockBackend(page,{unauthorized:true});
 await page.goto('/');
 await page.getByRole('button',{name:'Criar conta com convite'}).click();
 await page.getByLabel('E-mail').fill('Nova@Example.com');
 await page.getByLabel('Senha',{exact:true}).fill(strong);
 await page.getByLabel('Confirmar senha').fill(strong);
 await page.getByLabel('Código de convite').fill('1a2b3c4d5e6f7a8b');
 await page.getByRole('button',{name:'Criar conta',exact:true}).click();
 await expect(page.getByText('Se o e-mail puder ser cadastrado',{exact:false})).toBeVisible();
 const signup=mock.calls.find(c=>c.path==='/auth/v1/signup');
 expect((signup?.body as {email:string}).email).toBe('nova@example.com');
 await expect(page.getByRole('button',{name:'Entrar',exact:true})).toBeVisible();
});

test('cadastro valida senha, confirmação e código antes de chamar o servidor',async({page})=>{
 const mock=await mockBackend(page,{unauthorized:true});
 await page.goto('/');
 await page.getByRole('button',{name:'Criar conta com convite'}).click();
 await page.getByLabel('E-mail').fill('nova@example.com');
 await page.getByLabel('Senha',{exact:true}).fill('curta');
 await page.getByLabel('Confirmar senha').fill('curta');
 await page.getByLabel('Código de convite').fill(validInviteCode);
 await page.getByRole('button',{name:'Criar conta',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('12 caracteres');
 await page.getByLabel('Senha',{exact:true}).fill(strong);
 await page.getByLabel('Confirmar senha').fill(strong+'x');
 await page.getByRole('button',{name:'Criar conta',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('não conferem');
 await page.getByLabel('Confirmar senha').fill(strong);
 await page.getByLabel('Código de convite').fill('123');
 await page.getByRole('button',{name:'Criar conta',exact:true}).click();
 await expect(page.getByRole('alert')).toContainText('Código de convite inválido');
 expect(mock.calls.some(c=>c.path==='/auth/v1/signup')).toBe(false);
});

test('conta sem acesso ativa com código válido e recusa código inválido',async({page})=>{
 await mockBackend(page,{unauthorized:true});
 await loginAsMockUser(page);
 await expect(page.getByRole('heading',{name:'Acesso não autorizado'})).toBeVisible();
 await page.getByLabel('Código de convite').fill('FFFF-FFFF-FFFF-FFFF');
 await page.getByRole('button',{name:'Ativar acesso'}).click();
 await expect(page.getByRole('alert')).toContainText('inválido, expirado ou já utilizado');
 await expect(page.getByText('Bem-vindo ao Vetor Hub.')).toHaveCount(0);
 await page.getByLabel('Código de convite').fill(validInviteCode.toLowerCase());
 await page.getByRole('button',{name:'Ativar acesso'}).click();
 await expect(page.getByText('Bem-vindo ao Vetor Hub.')).toBeVisible();
 // Membro comum não vê a gestão de usuários.
 await expect(page.getByRole('button',{name:'Usuários',exact:true})).toHaveCount(0);
});

test('membro comum não vê a tela de usuários',async({page})=>{
 await mockBackend(page,{role:'member'});
 await loginAsMockUser(page);
 await expect(page.getByText('Bem-vindo ao Vetor Hub.')).toBeVisible();
 await expect(page.getByRole('button',{name:'Usuários',exact:true})).toHaveCount(0);
});

test('admin gera convite, vê o código uma vez e pode revogá-lo',async({page})=>{
 const mock=await mockBackend(page,{role:'admin'});
 await loginAsMockUser(page);
 await openUsers(page);
 await expect(page.getByText('test@example.com (você)')).toBeVisible();
 await page.getByLabel('Para quem (opcional)').fill('Ana — vendas');
 await page.getByLabel('Validade').selectOption('24');
 await page.getByRole('button',{name:'Gerar código'}).click();
 await expect(page.getByText('9F8E-7D6C-5B4A-3210')).toBeVisible();
 const created=mock.calls.find(c=>c.path==='/rest/v1/rpc/create_invite_code');
 expect(created?.body).toEqual({p_role:'member',p_valid_hours:24,p_note:'Ana — vendas'});
 const invite=page.locator('.invite-record').filter({hasText:'Ana — vendas'});
 await expect(invite.getByText('Ativo',{exact:true})).toBeVisible();
 await invite.getByRole('button',{name:'Revogar'}).click();
 await page.getByRole('alertdialog').getByRole('button',{name:'Revogar'}).click();
 await expect(invite.getByText('Revogado',{exact:true})).toBeVisible();
});

test('admin altera papel e remove acesso; último admin é protegido',async({page})=>{
 const mock=await mockBackend(page,{role:'admin'});
 await loginAsMockUser(page);
 await openUsers(page);
 const self=page.locator('.member-record').filter({hasText:'test@example.com'});
 await self.getByRole('button',{name:'Remover acesso'}).click();
 await page.getByRole('alertdialog').getByRole('button',{name:'Remover acesso'}).click();
 await expect(page.getByRole('alert')).toContainText('ao menos um administrador');
 expect(mock.calls.some(c=>c.path==='/rest/v1/rpc/remove_member')).toBe(false);
 const ana=page.locator('.member-record').filter({hasText:'ana@example.com'});
 await ana.getByRole('button',{name:'Tornar admin'}).click();
 await page.getByRole('alertdialog').getByRole('button',{name:'Confirmar'}).click();
 await expect(ana.getByText('Administrador',{exact:false})).toBeVisible();
 await ana.getByRole('button',{name:'Remover acesso'}).click();
 await page.getByRole('alertdialog').getByRole('button',{name:'Remover acesso'}).click();
 await expect(page.locator('.member-record').filter({hasText:'ana@example.com'})).toHaveCount(0);
 await expect(page.getByText('Acesso removido.')).toBeVisible();
});

test('falha do servidor ao gerar convite aparece na tela',async({page})=>{
 const mock=await mockBackend(page,{role:'admin'});
 await loginAsMockUser(page);
 await openUsers(page);
 mock.failNext('/rest/v1/rpc/create_invite_code');
 await page.getByRole('button',{name:'Gerar código'}).click();
 await expect(page.getByRole('alert')).toContainText('Falha simulada no servidor');
 await expect(page.locator('.invite-created')).toHaveCount(0);
});
