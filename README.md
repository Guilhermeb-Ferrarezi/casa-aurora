# Casa Aurora

Base inicial em `Next.js 16` com `Bun`, `Tailwind`, `shadcn/ui`, `Radix`, `Prisma` e autenticacao por `JWT` em cookie `HttpOnly`.
Agora tambem inclui uma home em formato de chat com historico real no banco e mensagens criptografadas em repouso.

## O que ja esta pronto

- rota `/auth` com abas de `Entrar` e `Cadastrar`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/chat/bootstrap`
- `POST /api/chat/messages`
- `GET /api/chat/threads/[threadId]`
- `Prisma` configurado para `PostgreSQL`
- interface em `JetBrains Mono` com visual customizado
- historico de chat criptografado antes de persistir no banco

## Variaveis de ambiente

Copie os valores necessarios para o seu `.env`:

```bash
DATABASE_URL="postgresql://USER:PASSWORD@HOST:5432/postgres"
DIRECT_URL="postgresql://USER:PASSWORD@HOST:5432/postgres"
AUTH_JWT_SECRET="troque-por-um-segredo-forte"
AUTH_COOKIE_NAME="auth_token"
CHAT_ENCRYPTION_KEY="troque-por-uma-chave-longa-e-aleatoria"
GROQ_API_KEY=""
GROQ_MODEL="llama-3.1-8b-instant"
```

`DIRECT_URL` e opcional, mas e recomendado para migrations em provedores com pooler, como Supabase.

## Rodando o projeto

```bash
bun install
bun run prisma:generate
bun run dev
```

Abra `http://localhost:3000`.

## Prisma

Validar schema:

```bash
bun run prisma:validate
```

Gerar client:

```bash
bun run prisma:generate
```

Se o banco estiver acessivel e voce quiser aplicar a estrutura inicial:

```bash
bunx --bun prisma migrate deploy --config prisma.config.ts
```
