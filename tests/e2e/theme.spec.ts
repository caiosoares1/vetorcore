import {test,expect} from '@playwright/test';
import {mockBackend,loginAsMockUser} from './support/mockSupabase';

const theme=(page:import('@playwright/test').Page)=>page.locator('html').getAttribute('data-theme');

test('segue o tema escuro do aparelho desde a tela de login',async({page})=>{
 await page.emulateMedia({colorScheme:'dark'});
 await mockBackend(page);
 await page.goto('/');
 expect(await theme(page)).toBe('dark');
 const background=await page.locator('.login-card').evaluate(el=>getComputedStyle(el).backgroundColor);
 expect(background).not.toBe('rgb(255, 255, 255)');
});

test('alterna entre claro e escuro e lembra a escolha após recarregar',async({page})=>{
 await page.emulateMedia({colorScheme:'light'});
 await mockBackend(page);
 await loginAsMockUser(page);
 await expect(page.getByText('Bem-vindo ao Vetor Hub.')).toBeVisible();
 expect(await theme(page)).toBe('light');
 await page.locator('header').getByRole('button',{name:'Ativar tema escuro'}).click();
 expect(await theme(page)).toBe('dark');
 await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content','#0e0f1a');
 await page.reload();
 expect(await theme(page)).toBe('dark');
 // A escolha salva vale mesmo que o aparelho esteja em claro.
 await page.locator('header').getByRole('button',{name:'Ativar tema claro'}).click();
 expect(await theme(page)).toBe('light');
 await page.emulateMedia({colorScheme:'dark'});
 await page.reload();
 expect(await theme(page)).toBe('light');
});

test('tela de login também permite trocar o tema',async({page})=>{
 await page.emulateMedia({colorScheme:'dark'});
 await mockBackend(page);
 await page.goto('/');
 await page.getByRole('button',{name:'Ativar tema claro'}).click();
 expect(await theme(page)).toBe('light');
 await expect(page.getByRole('button',{name:'Ativar tema escuro'})).toBeVisible();
});
