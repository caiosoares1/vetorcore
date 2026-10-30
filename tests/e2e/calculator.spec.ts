import {test,expect,type Page} from '@playwright/test';
import {mockBackend,loginAsMockUser,seededSupplier,openPage} from './support/mockSupabase';

const total=(page:Page)=>page.locator('.calc-total');
async function openCalculator(page:Page,options:Parameters<typeof mockBackend>[1]={}){
 await mockBackend(page,options);
 await loginAsMockUser(page);
 await expect(page.getByText('Bem-vindo ao Vetor Hub.')).toBeVisible();
 await openPage(page,'Calculadora');
 await expect(page.getByRole('heading',{name:'Calculadora de sacolas'})).toBeVisible();
}

test('calcula como a planilha: milheiro, quantidade fora do lote e espessura',async({page})=>{
 await openCalculator(page);
 // Padrão: Alça C 30x40, espessura da tabela (0,011), R$ 40/kg, 1 cor, 1.000 un.
 await expect(page.getByLabel('Tamanho')).toHaveValue('alc-30x40');
 await expect(page.getByLabel('Espessura (mm)')).toHaveValue('0,011');
 await expect(total(page)).toHaveText('R$ 988,87');
 await expect(page.locator('.calc-rule')).toContainText('milheiro da tabela');
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

test('usa o preço do kg do fornecedor e o número de cores',async({page})=>{
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
 await expect(page.getByText('Abaixo do menor lote da tabela')).toBeVisible();
});

test('outro tamanho e ajuste de custos recalculam e podem voltar à planilha',async({page})=>{
 await openCalculator(page);
 await page.getByLabel('Tamanho').selectOption('custom');
 await page.getByLabel('Largura (cm)').fill('30');
 await page.getByLabel('Altura (cm)').fill('40');
 await expect(total(page)).toHaveText('R$ 988,87');
 await page.getByRole('button',{name:/Custos e margem/}).click();
 await page.getByLabel('Margem sobre o material (%)').fill('0');
 await expect(total(page)).not.toHaveText('R$ 988,87');
 await page.getByRole('button',{name:'Voltar aos valores da planilha'}).click();
 await expect(total(page)).toHaveText('R$ 988,87');
});
