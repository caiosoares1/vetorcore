# Testes do Vetorcore

A suíte é executada no GitHub Actions em cada push e pull request para `main`.

## Camadas

| Camada | Comando | Cobertura e estratégia |
|---|---|---|
| Unitária + cobertura | `npm run test:coverage` | Funções realmente importadas pelo app em `src/lib/domain.ts` e `src/lib/quoteMath.ts`. O CI aplica mínimos de 95% de linhas, 80% de branches e 95% de funções. |
| Compilação | `npm run build` | TypeScript estrito, dependências e geração da PWA. |
| Interface e fluxos | `npm run test:e2e` | Playwright/Chromium em viewport desktop e perfil mobile Pixel 7; rede Supabase interceptada. |
| Integração SQL | Testes transacionais manuais no projeto Supabase | Cobrem permissões/RLS, estoque, orçamentos, pedidos e arquivamento usando `BEGIN ... ROLLBACK`. Não fazem parte do CI, pois dependem de instância Postgres/Supabase autorizada. |

## Mapa de cobertura

- **Autenticação:** login válido/inválido, usuário não autorizado, recuperação de senha, saída, criação de conta com convite (validação de senha/código), ativação por código válido/inválido.
- **Usuários (admin):** gerar/revogar convite, alterar papel, remover acesso, proteção do último admin, membro comum sem acesso à tela (`tests/e2e/access.spec.ts`, `tests/auth.test.mjs`).
- **Catálogo:** listar, buscar, cadastrar, editar, tratar erros HTTP, validar custo, preço, SKU, nome e estoque mínimo.
- **Pessoas:** cadastrar/editar clientes e fornecedores, dados de contato e e-mail.
- **Estoque:** entradas, saídas, saldo atualizado, histórico, limite de estoque, rejeição de saldo negativo e quantidades inválidas.
- **Arquivamento:** ocultar, restaurar, manter histórico, impedir operação com registros inativos (na camada SQL).
- **Calculadora de sacolas:** `tests/bag-pricing.test.mjs` reproduz exatamente os 340 preços da planilha 2026 e cobre espessura, R$/kg, cores, margem, lotes e quantidades fora do lote; `tests/e2e/calculator.spec.ts` cobre a tela.
- **Orçamentos:** seleção de cliente/produtos, quantidades, descontos, recusa de duplicados/arquivados, status e geração de PDF.
- **Pedidos:** conversão somente após aprovação, bloqueio de duplicações (SQL), total, conclusão.
- **Dashboard:** indicadores e exclusão de produtos arquivados.
- **Responsividade:** as mesmas jornadas Playwright executadas em desktop e mobile; `tests/e2e/layout.spec.ts` garante que nenhuma tela fica mais larga que 360/412 px; navegação inferior com "Mais".
- **Tema:** `tests/theme-tokens.test.mjs` (contraste AA dos tokens claro/escuro) e `tests/e2e/theme.spec.ts`.

## Como executar

```bash
npm install
npm run test
npm run test:coverage
npm run build
npx playwright install chromium
npm run test:e2e
```

Os testes Playwright usam `https://test.supabase.co` exclusivamente como URL de mock na configuração de desenvolvimento. **Não usam credenciais nem alteram dados reais.** O fixture `tests/e2e/support/mockSupabase.ts` mantém os registros em memória para cada teste e simula apenas o contrato de API necessário para o frontend.

## Como interpretar os percentuais

O indicador de cobertura produzido pelo Node refere-se **somente às bibliotecas puras que o test runner importa** (regras de negócio e cálculos). Não equivale à cobertura global de arquivos React, chamadas remotas ou regras SQL. Para estes módulos, os testes de navegador e as transações SQL dão evidência por cenário, não porcentagem de linhas.

Testes de navegador não substituem uma sessão real com Supabase ou testes de segurança adversariais. Antes de operar com dados empresariais, validar manualmente o login, o fluxo de ponta a ponta em celular físico, o PDF emitido e o processo de backup/restauração. O sistema não tem faturamento, pagamento nem baixa automática de estoque ao concluir um pedido.

## Mantendo a suíte

- Regras de negócio novas devem receber testes unitários de caminho feliz, limites e erros.
- Toda ação de usuário nova deve receber um cenário desktop/mobile com resposta normal e ao menos um cenário de falha quando há rede.
- Nunca usar service-role, senhas reais, tokens nem dados de clientes nos mocks.
- O CI deve falhar quando a compilação, as regras ou uma jornada crítica regressarem.
