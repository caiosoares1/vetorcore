import {test,expect,type Page} from '@playwright/test';
import {mockBackend,loginAsMockUser,seededSupplier,seededCustomer,openPage} from './support/mockSupabase';

const total=(page:Page)=>page.locator('.calc-total');
async function openCalculator(page:Page,options:Parameters<typeof mockBackend>[1]={}){
 await mockBackend(page,options);
 await loginAsMockUser(page);
 await expect(page.getByText('Bem-vindo ao Vetor Hub.')).toBeVisible();
 await openPage(page,'Calculadora');
 await expect(page.getByRole('heading',{name:'Calculadora de sacolas'})).toBeVisible();
}

test('calcula milheiro, quantidade fora do lote e espessura',async({page})=>{
 await openCalculator(page);
 // Padrão: Alça C 30x40, espessura de referência (0,011), 2 IRMÃO a R$ 40/kg, 1 cor, 1.000 un.
 await expect(page.getByLabel('Tamanho')).toHaveValue('alc-30x40');
 await expect(page.getByLabel('Espessura (mm)')).toHaveValue('0,011');
 await expect(total(page)).toHaveText('R$ 988,87');
 await expect(page.locator('.calc-rule')).toContainText('Preço do milheiro.');
 // 700 un. = lote de 500 ÷ 500 × 700
 await page.getByLabel('Quantidade (unidades)').fill('700');
 await expect(total(page)).toHaveText('R$ 865,27');
 await expect(page.locator('.calc-rule')).toContainText('lote de 500 ÷ 500 × 700');
 // 3.000 un. = milheiro × 3
 await page.getByRole('group',{name:'Quantidades comuns'}).getByRole('button',{name:'3.000'}).click();
 await expect(total(page)).toHaveText('R$ 2.966,62');
 // Espessura 0,010 reduz o peso e o preço
 await page.getByRole('button',{name:'1.000',exact:true}).click();
 await page.getByRole('button',{name:'0,010',exact:true}).click();
 await expect(total(page)).toHaveText('R$ 915,03');
});

test('fornecedores de referência e preço digitado',async({page})=>{
 await openCalculator(page);
 await expect(page.getByLabel('Fornecedor')).toHaveValue('ref:2irmao');
 await page.getByLabel('Fornecedor').selectOption({label:'TOTAL MAIS — R$ 35,00/kg'});
 await expect(total(page)).toHaveText('R$ 887,34');
 await page.getByLabel('Fornecedor').selectOption({label:'Informar preço do kg…'});
 await page.getByLabel('Preço do kg (R$)').fill('43,00');
 await expect(total(page)).toHaveText('R$ 1.049,80');
});

test('usa o preço do kg do fornecedor cadastrado e o número de cores',async({page})=>{
 await openCalculator(page,{initialSuppliers:[{...seededSupplier(),name:'Tecnoplast',price_per_kg_cents:4300}]});
 await page.getByLabel('Fornecedor').selectOption({label:'Tecnoplast — R$ 43,00/kg'});
 await expect(total(page)).toHaveText('R$ 1.049,80');
 await page.getByRole('button',{name:'0,010',exact:true}).click();
 await page.getByRole('group',{name:'Número de cores'}).getByRole('button',{name:'2 cores'}).click();
 await page.getByLabel('Quantidade (unidades)').fill('700');
 await expect(total(page)).toHaveText('R$ 996,61');
});

test('valores inválidos mostram erro em vez de preço',async({page})=>{
 await openCalculator(page);
 await page.getByLabel('Espessura (mm)').fill('abc');
 await expect(page.locator('.calc-error')).toContainText('espessura');
 await expect(total(page)).toHaveCount(0);
 await page.getByLabel('Espessura (mm)').fill('0,011');
 await page.getByLabel('Quantidade (unidades)').fill('0');
 await expect(page.locator('.calc-error')).toContainText('Quantidade');
 await page.getByLabel('Quantidade (unidades)').fill('30');
 await expect(page.getByText('Abaixo do menor lote')).toBeVisible();
});

test('outro tamanho e ajuste de custos recalculam e podem voltar aos valores salvos',async({page})=>{
 await openCalculator(page);
 await page.getByLabel('Tamanho').selectOption('custom');
 await page.getByLabel('Largura (cm)').fill('30');
 await page.getByLabel('Altura (cm)').fill('40');
 await expect(total(page)).toHaveText('R$ 988,87');
 await page.getByRole('button',{name:/Custos e margem/}).click();
 await page.getByLabel('Margem sobre o material (%)').fill('0');
 await expect(total(page)).not.toHaveText('R$ 988,87');
 await page.getByRole('button',{name:'Voltar aos valores salvos'}).click();
 await expect(total(page)).toHaveText('R$ 988,87');
});

test('admin salva novos custos como padrão para todos',async({page})=>{
 const mock=await mockBackend(page,{role:'admin'});
 await loginAsMockUser(page);
 await expect(page.getByText('Bem-vindo ao Vetor Hub.')).toBeVisible();
 await openPage(page,'Calculadora');
 await expect(total(page)).toHaveText('R$ 988,87');
 await page.getByRole('button',{name:/Custos e margem/}).click();
 await expect(page.getByText('Valores salvos no sistema.')).toBeVisible();
 await page.getByLabel('Tinta por mil (R$)').fill('150');
 await expect(total(page)).toHaveText('R$ 998,87');
 await page.getByRole('button',{name:'Salvar como padrão'}).click();
 await page.getByRole('alertdialog').getByRole('button',{name:'Salvar para todos'}).click();
 await expect(page.getByText('Custos atualizados para todos os cálculos.')).toBeVisible();
 expect(mock.pricing).toMatchObject({ink_cents:15000,labor_monthly_cents:350000,margin_pct:'35'});
 // Depois de recarregar, o novo padrão continua valendo.
 await page.reload();
 await openPage(page,'Calculadora');
 await expect(total(page)).toHaveText('R$ 998,87');
});

test('membro comum simula custos mas não salva como padrão',async({page})=>{
 await openCalculator(page,{role:'member'});
 await page.getByRole('button',{name:/Custos e margem/}).click();
 await page.getByLabel('Tinta por mil (R$)').fill('150');
 await expect(total(page)).toHaveText('R$ 998,87');
 await expect(page.getByRole('button',{name:'Salvar como padrão'})).toHaveCount(0);
 await expect(page.getByText('Só administradores salvam novos padrões.')).toBeVisible();
});

test('sem a tabela de custos no banco, usa os valores padrão do código',async({page})=>{
 await openCalculator(page,{pricingSettings:null});
 await expect(total(page)).toHaveText('R$ 988,87');
 await page.getByRole('button',{name:/Custos e margem/}).click();
 await expect(page.getByText('Valores padrão (custos salvos indisponíveis).')).toBeVisible();
});

test('sacola calculada vai para o orçamento com o total exato e vira pedido',async({page})=>{
 const mock=await mockBackend(page,{initialCustomers:[seededCustomer()]});
 await loginAsMockUser(page);
 await expect(page.getByText('Bem-vindo ao Vetor Hub.')).toBeVisible();
 await openPage(page,'Calculadora');
 await page.getByLabel('Quantidade (unidades)').fill('700');
 await expect(total(page)).toHaveText('R$ 865,27');
 await page.getByRole('button',{name:'Adicionar ao orçamento'}).click();
 const d=page.getByRole('dialog');
 await expect(d.getByRole('heading',{name:'Novo orçamento'})).toBeVisible();
 await expect(d.locator('.quote-line-custom')).toContainText('Sacola alça C / boca de palhaço 30x40 cm, 0,011 mm, 1 cor');
 await expect(d.locator('.quote-line-custom')).toContainText('700 un.');
 await expect(d.locator('.total-final')).toContainText('R$ 865,27');
 await d.getByLabel('Cliente *').selectOption('b0000000-0000-4000-8000-000000000001');
 await d.getByRole('button',{name:'Criar orçamento'}).click();
 await expect(d).not.toBeVisible();
 expect(mock.store.quotes[0].quote_items).toMatchObject([{product_id:null,quantity:700,line_total_cents:86527}]);
 const sent=mock.calls.find(c=>c.path.endsWith('/rpc/create_quote_with_items'))?.body as {p_items:unknown[]};
 expect(sent.p_items).toEqual([{description:'Sacola alça C / boca de palhaço 30x40 cm, 0,011 mm, 1 cor',quantity:700,line_total_cents:86527}]);
 await expect(page.locator('.commerce-record')).toContainText('R$ 865,27');
 await page.getByRole('combobox',{name:'Alterar status 1'}).selectOption('Aprovado');
 await page.getByRole('button',{name:'Gerar pedido'}).click();
 await expect(page.getByText('Convertido em pedido')).toBeVisible();
 expect(mock.store.orders[0].total_cents).toBe(86527);
 // PDF continua sendo gerado com o item personalizado.
 const downloadEvent=page.waitForEvent('download');
 await page.getByRole('button',{name:'PDF'}).click();
 expect((await downloadEvent).suggestedFilename()).toBe('vetorcore-orcamento-1.pdf');
});
