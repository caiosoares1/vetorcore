# Vetor Hub

Aplicação web responsiva (PWA) para a Vetor Embalagens. **Versão inicial demonstrativa e simplificada.**

## Conteúdo publicado
- React 18 + TypeScript + Vite
- Layout desktop/mobile com identidade roxo e laranja
- Painel geral e listagem de produtos
- Cadastro simplificado de produtos, clientes, fornecedores e orçamentos
- Entradas e saídas de estoque em modo local
- Manifest PWA e notificação de nova versão
- GitHub Actions para checagem de build
- Esboço de esquema SQL em `supabase/migrations/0001_schema.sql`

**Atenção:** não há login verdadeiro, banco conectado, sincronização entre dispositivos nem validação transacional no servidor. Os dados são fictícios, armazenados apenas no `localStorage` deste navegador. Não use para operações comerciais reais.

## Rodar
Instale Node.js 22 e execute:

```bash
npm install
npm run dev
```

Para testar a compilação:

```bash
npm run build
npm run preview
```

## Deploy automático
Conecte o repositório no Cloudflare Pages. Configure comando de build `npm run build` e diretório de saída `dist`. Um novo push na branch `main` dispara o deploy após a configuração. O navegador recebe a nova versão da PWA de acordo com o ciclo de atualização do service worker.

O workflow `.github/workflows/ci.yml` executa a checagem de build, mas **não publica automaticamente o site** até a hospedagem ser configurada.

## Próximas etapas
- Revisar e executar a compilação num ambiente com dependências instaladas
- Conectar Supabase Auth e PostgreSQL com políticas RLS
- Implementar movimentos de estoque em transações SQL e testes
- Evoluir orçamentos para itens, descontos e PDF
- Substituir cadastros simplificados por formulários validados
- Publicar na hospedagem, ativar URL HTTPS e testar a PWA no Android e no iOS

O pacote demonstrativo mais completo desenvolvido anteriormente não foi incorporado integralmente a este commit.
