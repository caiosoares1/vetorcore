import {test,expect,type Page} from '@playwright/test';

const userId='11111111-1111-4111-8111-111111111111';
const productId='22222222-2222-4222-8222-222222222222';
const fakeToken=['eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9',btoa(JSON.stringify({sub:userId,role:'authenticated',aud:'authenticated',exp:4102444800,iat:1700000000})).replaceAll('=','').replaceAll('+','-').replaceAll('/','_'),'fake'].join('.');
const user={id:userId,aud:'authenticated',role:'authenticated',email:'tester@example.com',app_metadata:{provider:'email',providers:['email']},user_metadata:{},created_at:'2026-01-01T00:00:00Z'};
const response=(body:unknown,status=200)=>({status,contentType:'application/json',headers:{'access-control-allow-origin':'*'},body:JSON.stringify(body)});

async function connectMock(page:Page){
 let products:Array<Record<string,unknown>>=[];
 let stock:Array<Record<string,unknown>>=[];
 await page.route('https://test.supabase.co/**',async route=>{
  const request=route.request(),url=new URL(request.url());
  const path=url.pathname,method=request.method();
  if(path==='/auth/v1/token')return route.fulfill(response({access_token:fakeToken,token_type:'bearer',expires_in:3600,expires_at:4102444800,refresh_token:'fake-refresh',user}));
  if(path==='/auth/v1/user')return route.fulfill(response(user));
  if(path.includes('/rest/v1/app_members'))return route.fulfill(response({user_id:userId}));
  if(path==='/rest/v1/products'){
   if(method==='GET')return route.fulfill(response(products));
   if(method==='POST'){const data=request.postDataJSON();products=[...products,{...data,id:productId,qty:0,cost_cents:data.cost_cents||0,price_cents:data.price_cents||0,min_qty:data.min_qty||0}];return route.fulfill({status:201,body:''});}
   if(method==='PATCH'){const patch=request.postDataJSON();products=products.map(p=>p.id===productId?{...p,...patch}:p);return route.fulfill(response({id:productId}));}
  }
  if(path==='/rest/v1/stock_movements'&&method==='GET')return route.fulfill(response(stock));
  if(path==='/rest/v1/rpc/record_stock_movement'&&method==='POST'){
   const data=request.postDataJSON();
   products=products.map(p=>p.id===data.p_product_id?{...p,qty:Number(p.qty)+data.p_delta}:p);
   stock=[{id:'33333333-3333-4333-8333-333333333333',product_id:productId,kind:data.p_delta>0?'Entrada':'Saída',delta:data.p_delta,note:'',created_at:new Date().toISOString()}];
   return route.fulfill(response('33333333-3333-4333-8333-333333333333'));
  }
  if(['/rest/v1/customers','/rest/v1/suppliers','/rest/v1/quotes','/rest/v1/orders'].includes(path)){
   return route.fulfill(response([]));
  }
  return route.fulfill(response({},200));
 });
}

async function login(page:Page){
 await connectMock(page);
 await page.goto('/');
 await page.getByLabel('E-mail').fill('tester@example.com');
 await page.getByLabel('Senha').fill('Example123456!');
 await page.getByRole('button',{name:'Entrar',exact:true}).click();
 await expect(page.getByText('Bem-vindo ao Vetor Hub.')).toBeVisible();
}

test('login, cadastro e entrada no estoque pela interface',async({page},testInfo)=>{
 await login(page);
 await page.getByRole('button',{name:'Produtos'}).first().click();
 await page.getByRole('button',{name:'Novo produto'}).click();
 const modal=page.getByRole('dialog');
 await expect(modal).toBeVisible();
 const size=await modal.boundingBox();
 expect(size).not.toBeNull();
 if(testInfo.project.name==='mobile')expect(size!.width).toBeGreaterThan(350);
 else expect(size!.width).toBeLessThan(600);
 await modal.getByLabel('Nome do produto').fill('Caixa de papelão de teste');
 await modal.getByLabel('Código / SKU').fill('SMOKE-001');
 await modal.getByLabel('Preço de venda (R$)').fill('19,90');
 await modal.getByRole('button',{name:'Cadastrar produto'}).click();
 await expect(modal).not.toBeVisible();
 await expect(page.getByText('Caixa de papelão de teste')).toBeVisible();
 await page.getByRole('button',{name:'Entrada',exact:true}).click();
 const move=page.getByRole('dialog');
 await move.getByLabel('Quantidade para entrada').fill('4');
 await move.getByRole('button',{name:'Confirmar entrada'}).click();
 await expect(move).not.toBeVisible();
 await expect(page.getByText('4', {exact:false}).first()).toBeVisible();
});
test('formulários podem ser fechados sem salvar',async({page})=>{
 await login(page);
 await page.getByRole('button',{name:'Produtos'}).first().click();
 await page.getByRole('button',{name:'Novo produto'}).click();
 await expect(page.getByRole('dialog')).toBeVisible();
 await page.getByRole('dialog').getByRole('button',{name:'Cancelar'}).click();
 await expect(page.getByRole('dialog')).not.toBeVisible();
});

test('arquivamento é confirmado na interface e pode ser restaurado',async({page})=>{
 await login(page);
 await page.getByRole('button',{name:'Produtos'}).first().click();
 await page.getByRole('button',{name:'Novo produto'}).click();
 const modal=page.getByRole('dialog');
 await modal.getByLabel('Nome do produto').fill('Produto arquivável');
 await modal.getByLabel('Código / SKU').fill('ARCH-01');
 await modal.getByRole('button',{name:'Cadastrar produto'}).click();
 await expect(page.getByText('Produto arquivável')).toBeVisible();
 await page.getByRole('button',{name:'Arquivar',exact:true}).click();
 await page.getByRole('alertdialog').getByRole('button',{name:'Confirmar arquivamento'}).click();
 await expect(page.getByRole('alertdialog')).not.toBeVisible();
 await expect(page.locator('.record-description strong').getByText('Produto arquivável')).toHaveCount(0);
 await page.getByRole('button',{name:'Arquivados'}).click();
 await expect(page.getByText('Produto arquivável')).toBeVisible();
 await page.getByRole('button',{name:'Restaurar',exact:true}).click();
 await page.getByRole('alertdialog').getByRole('button',{name:'Restaurar'}).click();
 await expect(page.getByRole('alertdialog')).not.toBeVisible();
 await expect(page.locator('.record-description strong').getByText('Produto arquivável')).toHaveCount(0);
});

test('mobile exibe formulário próprio e aviso de atualização acima da navegação',async({page},testInfo)=>{
 test.skip(testInfo.project.name!=='mobile','Teste dedicado ao layout mobile.');
 const nativeDialogs:string[]=[];
 page.on('dialog',dialog=>{nativeDialogs.push(dialog.type());void dialog.dismiss();});
 await login(page);
 await page.getByRole('button',{name:'Produtos'}).first().click();
 await page.getByRole('button',{name:'Novo produto'}).click();
 const editor=page.getByRole('dialog');
 await expect(editor).toBeVisible();
 const bounds=await editor.boundingBox();
 const viewport=page.viewportSize();
 expect(bounds).not.toBeNull();
 expect(viewport).not.toBeNull();
 expect(Math.abs(bounds!.width-viewport!.width)).toBeLessThanOrEqual(1);
 expect(Math.abs(bounds!.height-viewport!.height)).toBeLessThanOrEqual(2);
 expect(nativeDialogs).toEqual([]);
 await editor.getByRole('button',{name:'Cancelar'}).click();
 await page.evaluate(()=>{
   const bar=document.createElement('div');
   bar.id='pwa-update-banner';
   bar.className='update-banner';
   bar.textContent='Uma nova versão do Vetor Hub está disponível.';
   document.body.appendChild(bar);
 });
 const bar=page.locator('#pwa-update-banner');
 await expect(bar).toBeInViewport();
 const visibility=await bar.evaluate(el=>{
  const style=getComputedStyle(el);
  return {position:style.position,zIndex:Number(style.zIndex),rect:el.getBoundingClientRect().toJSON()};
 });
 expect(visibility.position).toBe('fixed');
 expect(visibility.zIndex).toBeGreaterThan(2);
 expect(visibility.rect.bottom).toBeLessThanOrEqual(viewport!.height);
});
