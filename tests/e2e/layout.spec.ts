import {test,expect} from '@playwright/test';
import {mockBackend,loginAsMockUser,seededProduct,seededCustomer,seededSupplier,openPage} from './support/mockSupabase';
// Nenhuma tela pode ficar mais larga que o celular (isso amplia a viewport e esconde a barra inferior).
for(const width of [360,412]){
 test('sem rolagem horizontal em '+width+'px',async({page},info)=>{
  test.skip(info.project.name!=='mobile');
  await page.setViewportSize({width,height:800});
  await mockBackend(page,{role:'admin',initialProducts:[{...seededProduct(),qty:123456,cost_cents:99999,price_cents:999999,name:'Sacola alça camiseta 30×40 branca reforçada'},{...seededProduct('a0000000-0000-4000-8000-000000000002','Sacola boca de palhaço 40×50 kraft reforçada extra',2),min_qty:300,sku:'SAC-4050-KRAFT-EXTRA'}],initialCustomers:[{...seededCustomer(),address:'Av. Epitácio Pessoa, 1200 - Tambaú, João Pessoa/PB',email:'compras.departamento@mercadocentral.com.br',phone:'(83) 98877-1122'}],initialSuppliers:[{...seededSupplier(),price_per_kg_cents:4300}]});
  await loginAsMockUser(page);
  await expect(page.getByText('Bem-vindo ao Vetor Hub.')).toBeVisible();
  for(const name of ['Início','Produtos','Estoque','Orçamentos','Pedidos','Clientes','Fornecedores','Usuários']){
   if(name!=='Início')await openPage(page,name);
   await page.waitForTimeout(250);
   const r=await page.evaluate(()=>({w:document.documentElement.scrollWidth,iw:innerWidth,offenders:[...document.querySelectorAll('main *')].filter(e=>{const b=e.getBoundingClientRect();return b.right>innerWidth+1&&!e.closest('.overflow-hidden,.overflow-x-auto')}).slice(0,5).map(e=>e.tagName+'.'+String(e.className).slice(0,70))}));
   expect(r,name).toEqual({w:width,iw:width,offenders:[]});
  }
 });
}
