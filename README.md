# Vetor Hub

Aplicativo de gestão comercial e estoque da **Vetor Embalagens**, com interface responsiva para celular e computador, usando React + TypeScript + Vite.

## Estado

**MVP de demonstração. Não usar para dados reais da empresa.** Os dados são fictícios e persistidos apenas neste navegador por meio de `localStorage`. Não há login/autenticação reais, autorização ou sincronização entre dispositivos. O arquivo SQL é um rascunho de esquema, não um backend conectado.

## Rodar

Requer Node.js 22.

```bash
npm install
npm run dev
```

Validação: `npm run build`.

## Publicação automática (PWA)

1. Conecte este repositório ao Cloudflare Pages.
2. Configure **Build command**: `npm run build`; **Output directory**: `dist`.
3. Configure deploy da branch `main`.
4. Ao concluir o deploy, abra a URL HTTPS no celular, escolha *Adicionar à tela inicial* e utilize como PWA.

Mudanças na branch principal geram novo deploy. O service worker mostra aviso quando identifica atualização; pode haver atraso devido ao cache/navegador. A publicação no GitHub não faz deploy sozinha.

## Próximos passos antes de produção

- Supabase Auth, PostgreSQL e RLS com policies de acesso autenticado;
- Movimentações de estoque transacionais via PostgreSQL, com proteção contra concorrência;
- Auditoria, backups e restauração;
- Testes automatizados e validação do build no CI;
- Dados comerciais reais somente após segurança e persistência na nuvem.

## Identidade visual

Paleta roxo, laranja e branco inspirada na marca Vetor Embalagens. Os ícones SVG são uma adaptação vetorial simplificada. As informações de exemplo não são dados reais.
