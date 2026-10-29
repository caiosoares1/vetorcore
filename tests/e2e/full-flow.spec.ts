import {test,expect,type Page} from '@playwright/test';
import {mockBackend,loginAsMockUser,seededProduct,seededCustomer,seededSupplier} from './support/mockSupabase';

async function openPage(page:Page,name:string){
 await page.getByRole('button',{name,exact:true}).first().click();
}
async function ready(page:Page, options:Parameters<typeof mockBackend>[1]={}){
 const mock=await mockBackend(page,options);
 await loginAsMockUser(page);
 await expect(page.getByText('Bem-vindo ao Vetor Hub.')).toBeVisible();
 return mock;
}
const row=(page:Page)=>page.locator('.record-product');
const dialog=(page:Page)=>page.getByRole('dialog');
async function createQuote(page:Page,discount='1,00'){
 await openPage(page,'Orçamentos');
 await page.getByRole('button',{name:'Novo orçamento'}).click();
 const d=dialog(page);
 await d.getByLabel('Cliente *').selectOption('b0000000-0000-4000-8000-000000000001');
 await d.getByLabel('Produto *').selectOption('a0000000-0000-4000-8000-000000000001');
 await d.getByLabel('Quantidade *').fill('3');
 await d.getByLabel('Desconto total (R$)').fill(discount);
 await d.getByRole('button',{name:'Criar orçamento'}).click();
 await expect(d).not.toBeVisible();
 await expect(page.getByText('ORÇAMENTO #00001', {exact:false})).toBeVisible();
}

test('rejeita credenciais inválidas e mantém a página protegida',async({page})=>{
 await mockBackend(page,{invalidLogin:true});
 await page.goto('/');
 await page.getByLabel('E-mail').fill('test@example.com');
 await page.getByLabel('Senha').fill('senha-incorreta');
 await page.getByRole('button',{name:'Entrar',exact:true}).click();
 await expect(page.getByText('E-mail ou senha inválidos.')).toBeVisible();
 await expect(page.getByText('Bem-vindo ao Vetor Hub.')).toHaveCount(0);
});

test('nega acesso a usuário autenticado sem autorização',async({page})=>{
 await mockBackend(page,{unauthorized:true});
 await loginAsMockUser(page);
 await expect(page.getByRole('heading',{name:'Acesso não autorizado'})).toBeVisible();
 await expect(page.getByText('Bem-vindo ao Vetor Hub.')).toHaveCount(0);
});

test('recuperação de senha não requer login',async({page})=>{
 const mock=await mockBackend(page);
 await page.goto('/');
 await page.getByRole('button',{name:'Primeiro acesso / Esqueci minha senha'}).click();
 await page.getByLabel('E-mail').fill('test@example.com');
 await page.getByRole('button',{name:'Enviar link'}).click();
 await expect(page.getByText('Confira seu e-mail para definir sua senha.')).toBeVisible();
 expect(mock.calls.some(c=>c.path==='/auth/v1/recover')).toBe(true);
});

test('usuário autorizado consegue sair da conta',async({page})=>{
 await ready(page);
 await page.getByRole('button',{name:'Sair da conta'}).click();
 await expect(page.getByRole('button',{name:'Entrar',exact:true})).toBeVisible();
});

test('dashboard exibe dados ativos e ignora produtos arquivados',async({page})=>{
 await ready(page,{initialProducts:[
  seededProduct(),
  {...seededProduct('a0000000-0000-4000-8000-000000000002','Produto arquivado',2),archived_at:'2026-01-01T00:00:00.000Z'}
 ]});
 await expect(page.getByText('R$ 100,00')).toBeVisible();
 await expect(page.getByText('Itens no catálogo').locator('..').getByText('1',{exact:true})).toBeVisible();
});

test('cadastro, busca e edição de produto persistem na API simulada',async({page})=>{
 const mock=await ready(page);
 await openPage(page,'Produtos');
 await page.getByRole('button',{name:'Novo produto'}).click();
 let d=dialog(page);
 await d.getByLabel('Nome do produto').fill('Caixa Premium');
 await d.getByLabel('Código / SKU').fill('PRE-100');
 await d.getByLabel('Custo unitário (R$)').fill('5,75');
 await d.getByLabel('Preço de venda (R$)').fill('12,80');
 await d.getByRole('button',{name:'Cadastrar produto'}).click();
 await expect(d).not.toBeVisible();
 expect(mock.store.products[0]).toMatchObject({name:'Caixa Premium',sku:'PRE-100',cost_cents:575,price_cents:1280});
 await page.getByRole('textbox',{name:'Buscar registros'}).fill('Inexistente');
 await expect(page.locator('.record-product')).toHaveCount(0);
 await page.getByRole('textbox',{name:'Buscar registros'}).fill('PRE-100');
 await expect(row(page)).toHaveCount(1);
 await row(page).getByRole('button',{name:'Editar'}).click();
 d=dialog(page);
 await d.getByLabel('Preço de venda (R$)').fill('14,00');
 await d.getByRole('button',{name:'Salvar alterações'}).click();
 await expect(d).not.toBeVisible();
 expect(mock.store.products[0].price_cents).toBe(1400);
});

test('produto com preço inválido não envia cadastro ao Supabase',async({page})=>{
 const mock=await ready(page);
 await openPage(page,'Produtos');
 await page.getByRole('button',{name:'Novo produto'}).click();
 const d=dialog(page);
 await d.getByLabel('Nome do produto').fill('Caixa Teste');
 await d.getByLabel('Código / SKU').fill('TEST-1');
 await d.getByLabel('Preço de venda (R$)').fill('1,999');
 await d.getByRole('button',{name:'Cadastrar produto'}).click();
 await expect(d.getByRole('alert')).toContainText('Valor inválido');
 expect(mock.store.products).toHaveLength(0);
});

test('falha do Supabase ao salvar não fecha o formulário nem altera dados',async({page})=>{
 const mock=await ready(page);
 await openPage(page,'Produtos');
 await page.getByRole('button',{name:'Novo produto'}).click();
 const d=dialog(page);
 await d.getByLabel('Nome do produto').fill('Caixa Erro');
 await d.getByLabel('Código / SKU').fill('ERRO-1');
 mock.failNext('/rest/v1/products');
 await d.getByRole('button',{name:'Cadastrar produto'}).click();
 await expect(d.getByRole('alert')).toContainText('Falha simulada no servidor');
 await expect(d).toBeVisible();
 expect(mock.store.products).toHaveLength(0);
});

test('clientes e fornecedores são cadastrados e editados',async({page})=>{
 const mock=await ready(page);
 await openPage(page,'Clientes');
 await page.getByRole('button',{name:'Novo cliente'}).click();
 let d=dialog(page);
 await d.getByLabel('Nome / razão social').fill('Mercado Bairro');
 await d.getByLabel('E-mail').fill('mercado@example.com');
 await d.getByRole('button',{name:'Cadastrar cliente'}).click();
 await expect(d).not.toBeVisible();
 expect(mock.store.customers).toHaveLength(1);
 await page.locator('.party-record').getByRole('button',{name:'Editar'}).click();
 d=dialog(page);
 await d.getByLabel('Telefone').fill('(83) 99999-9999');
 await d.getByRole('button',{name:'Salvar alterações'}).click();
 await expect(d).not.toBeVisible();
 expect(mock.store.customers[0].phone).toBe('(83) 99999-9999');
 await openPage(page,'Fornecedores');
 await page.getByRole('button',{name:'Novo fornecedor'}).click();
 d=dialog(page);
 await d.getByLabel('Nome / razão social').fill('Distribuidora Central');
 await d.getByLabel('Categoria de fornecimento').fill('Papel');
 await d.getByRole('button',{name:'Cadastrar fornecedor'}).click();
 await expect(d).not.toBeVisible();
 expect(mock.store.suppliers[0]).toMatchObject({name:'Distribuidora Central',category:'Papel'});
});

test('entrada, saída e histórico atualizam estoque corretamente',async({page})=>{
 const mock=await ready(page,{initialProducts:[seededProduct()]});
 await openPage(page,'Estoque');
 await page.getByRole('button',{name:'Entrada',exact:true}).click();
 let d=dialog(page);
 await d.getByLabel('Quantidade para entrada').fill('5');
 await d.getByLabel('Observação (opcional)').fill('Compra');
 await d.getByRole('button',{name:'Confirmar entrada'}).click();
 await expect(d).not.toBeVisible();
 expect(mock.store.products[0].qty).toBe(25);
 await page.getByRole('button',{name:'Saída',exact:true}).click();
 d=dialog(page);
 await d.getByLabel('Quantidade para saída').fill('3');
 await d.getByRole('button',{name:'Confirmar saída'}).click();
 await expect(d).not.toBeVisible();
 expect(mock.store.products[0].qty).toBe(22);
 await expect(page.getByText('Movimentações recentes')).toBeVisible();
 await expect(page.locator('.history-record')).toHaveCount(2);
});

test('não permite saída maior que o saldo, nem envia RPC',async({page})=>{
 const mock=await ready(page,{initialProducts:[seededProduct(undefined,'Caixa Kraft',4)]});
 await openPage(page,'Estoque');
 await page.getByRole('button',{name:'Saída',exact:true}).click();
 const d=dialog(page);
 await d.getByLabel('Quantidade para saída').fill('5');
 await d.getByRole('button',{name:'Confirmar saída'}).click();
 await expect(d.getByRole('alert')).toContainText('Quantidade maior que o estoque disponível');
 expect(mock.calls.filter(x=>x.path.endsWith('/rpc/record_stock_movement'))).toHaveLength(0);
});

test('monta orçamento, aprova, converte em pedido e conclui',async({page})=>{
 const mock=await ready(page,{initialProducts:[seededProduct()],initialCustomers:[seededCustomer()]});
 await createQuote(page,'2,00');
 expect(mock.store.quotes).toHaveLength(1);
 expect(mock.store.quotes[0]).toMatchObject({status:'Rascunho',discount_cents:200});
 await expect(page.getByText('R$ 34,00')).toBeVisible();
 await page.getByRole('combobox',{name:'Alterar status 1'}).selectOption('Aprovado');
 await expect(page.getByRole('button',{name:'Gerar pedido'})).toBeVisible();
 await page.getByRole('button',{name:'Gerar pedido'}).click();
 await expect(page.getByText('Convertido em pedido')).toBeVisible();
 expect(mock.store.orders).toHaveLength(1);
 expect(mock.store.orders[0].total_cents).toBe(3400);
 await openPage(page,'Pedidos');
 await expect(page.getByText('PEDIDO #00001',{exact:false})).toBeVisible();
 await page.getByRole('button',{name:'Marcar concluído'}).click();
 await expect(page.getByText('Concluído')).toBeVisible();
 expect(mock.store.orders[0].status).toBe('Concluído');
});

test('não aceita produto duplicado em um orçamento',async({page})=>{
 const mock=await ready(page,{initialProducts:[seededProduct()],initialCustomers:[seededCustomer()]});
 await openPage(page,'Orçamentos');
 await page.getByRole('button',{name:'Novo orçamento'}).click();
 const d=dialog(page);
 await d.getByLabel('Cliente *').selectOption(String(mock.store.customers[0].id));
 await d.getByLabel('Produto *').selectOption(String(mock.store.products[0].id));
 await d.getByRole('button',{name:'Adicionar produto'}).click();
 await d.getByLabel('Produto *').nth(1).selectOption(String(mock.store.products[0].id));
 await d.getByRole('button',{name:'Criar orçamento'}).click();
 await expect(d.getByRole('alert')).toContainText('duas vezes');
 expect(mock.store.quotes).toHaveLength(0);
});

test('exporta PDF com nome esperado',async({page})=>{
 await ready(page,{initialProducts:[seededProduct()],initialCustomers:[seededCustomer()]});
 await createQuote(page);
 const downloadEvent=page.waitForEvent('download');
 await page.getByRole('button',{name:'PDF'}).click();
 const download=await downloadEvent;
 expect(download.suggestedFilename()).toBe('vetorcore-orcamento-1.pdf');
});

test('produtos arquivados não podem ser selecionados em novos orçamentos',async({page})=>{
 await ready(page,{initialProducts:[{...seededProduct(),archived_at:'2026-01-01'}],initialCustomers:[seededCustomer()]});
 await openPage(page,'Orçamentos');
 await page.getByRole('button',{name:'Novo orçamento'}).click();
 const d=dialog(page);
 await expect(d.getByLabel('Produto *').getByRole('option',{name:/Caixa Kraft/})).toHaveCount(0);
});

test('erro na API de orçamentos é apresentado sem lista falsa de registros',async({page})=>{
 const mock=await ready(page);
 mock.failNext('/rest/v1/quotes');
 await openPage(page,'Orçamentos');
 await expect(page.getByRole('alert')).toContainText('Falha simulada no servidor');
});
