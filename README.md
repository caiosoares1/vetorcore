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


## Supabase (em andamento)
O projeto remoto `vetorcore` existe na região `sa-east-1`. O frontend usa `@supabase/supabase-js` e autenticação por e-mail/senha.

Na Vercel estão definidas as variáveis públicas `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. **Nunca use uma secret key ou service_role no frontend.**

O banco tem tabelas e políticas RLS. Não existe usuário autorizado por padrão: crie o usuário no painel Supabase Auth e, depois, um administrador deverá cadastrá-lo na tabela `app_members` com seu UUID. O aplicativo não oferece autoinscrição nem registra contas por conta própria.

**Limitação importante:** a autenticação e o banco estão preparados, porém a interface de produtos, estoque, clientes, fornecedores e orçamentos continua usando `localStorage` após o login. Esses dados não são compartilhados entre dispositivos, não aparecem no banco e **não são adequados para produção**. A migração de cada operação para o Supabase, incluindo funções transacionais, ainda é etapa pendente.

O plano gratuito de hospedagem pode ter restrições para uso comercial.
