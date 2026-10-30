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

test('alterna Sistema → Claro → Escuro e lembra a escolha após recarregar',async({page})=>{
 await page.emulateMedia({colorScheme:'light'});
 await mockBackend(page);
 await loginAsMockUser(page);
 await expect(page.getByText('Bem-vindo ao Vetor Hub.')).toBeVisible();
 const toggle=page.locator('header').getByRole('button',{name:/^Tema:/});
 await expect(toggle).toHaveAttribute('aria-label',/Tema: Sistema/);
 await toggle.click();
 await expect(toggle).toHaveAttribute('aria-label',/Tema: Claro/);
 expect(await theme(page)).toBe('light');
 await toggle.click();
 await expect(toggle).toHaveAttribute('aria-label',/Tema: Escuro/);
 expect(await theme(page)).toBe('dark');
 await expect(page.locator('meta[name="theme-color"]')).toHaveAttribute('content','#1d1f22');
 await page.reload();
 expect(await theme(page)).toBe('dark');
 await toggle.click();
 await expect(toggle).toHaveAttribute('aria-label',/Tema: Sistema/);
 expect(await theme(page)).toBe('light');
});
