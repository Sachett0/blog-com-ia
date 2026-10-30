# Blog com IA

API HTTP de um blog em que os posts são escritos por IA. A partir de uma ideia, um agente gera o rascunho do post, que depois é aprovado (e publicado) ou rejeitado.

## Tecnologias

- **Node.js 24**, servidor HTTP com o módulo nativo `node:http` e um roteador próprio ([src/http/app.js](src/http/app.js))
- **PostgreSQL 17** com [node-postgres](https://node-postgres.com/) (`pg`)
- **[Mastra](https://mastra.ai/)** com o modelo `openai/gpt-4o-mini` para gerar os posts
- **Zod** para definir o formato da resposta do agente
- **Docker** para o banco local e para a imagem de produção

## Estrutura

```
src/
├── index.js               # Inicia o servidor
├── app.js                 # Cria o app e registra as rotas
├── http/
│   ├── app.js             # Roteador minimalista (estilo Fastify)
│   └── auth.js            # Validação da API key (Bearer token)
├── routes/
│   ├── posts.js           # Rotas de posts
│   └── docs.js            # Swagger UI e especificação OpenAPI
├── docs/
│   └── openapi.js         # Especificação OpenAPI da API
├── agents/
│   └── post-writer.js     # Agente de IA que escreve os posts
└── database/
    ├── connection.js      # Pool de conexões com o PostgreSQL
    ├── schema.sql         # Schema da tabela posts
    └── migrate.js         # Aplica o schema no banco
tests/
├── unit/                  # Testes unitários (sem banco e sem OpenAI)
└── e2e/                   # Testes E2E (com PostgreSQL real)
```

## Variáveis de ambiente

| Variável         | Obrigatória | Descrição                                                                 |
| ---------------- | ----------- | ------------------------------------------------------------------------- |
| `API_PORT`       | Não         | Porta do servidor. Padrão: `8080`.                                        |
| `DATABASE_URL`   | Sim         | URL de conexão com o PostgreSQL.                                          |
| `OPENAI_API_KEY` | Sim         | Chave da OpenAI, usada pelo agente que gera os posts.                     |
| `API_KEY`        | Sim         | Chave exigida para listar todos os posts (`GET /posts?include=all`). Se não estiver definida, essa listagem sempre responde `403`. |

O modelo está em [.env.example](.env.example). Os arquivos `.env*` (exceto o `.env.example`) são ignorados pelo Git e não entram na imagem Docker.

## Setup local

Pré-requisitos: Node.js 24 e Docker.

1. Instale as dependências:

   ```bash
   npm install
   ```

2. Crie o `.env.local` a partir do `.env.example`:

   ```bash
   npm run env:setup
   ```

   > Atenção: esse comando **sobrescreve** o `.env.local`, se ele já existir.

3. Preencha `OPENAI_API_KEY` e `API_KEY` no `.env.local`. A `DATABASE_URL` padrão já aponta para o banco do `docker-compose.yml`.

4. Suba o PostgreSQL e crie a tabela:

   ```bash
   npm run db:up
   npm run db:migrate
   ```

5. Inicie o servidor em modo de desenvolvimento, que reinicia a cada alteração:

   ```bash
   npm run dev
   ```

   A API fica disponível em `http://localhost:8080`.

### Scripts

| Script                | O que faz                                                        |
| --------------------- | ---------------------------------------------------------------- |
| `npm run dev`         | Inicia o servidor com `--watch`, lendo o `.env.local`.           |
| `npm run env:setup`   | Copia o `.env.example` para `.env.local`.                        |
| `npm run local:setup` | Roda `env:setup` e depois `dev`.                                 |
| `npm run db:up`       | Sobe o PostgreSQL com Docker Compose.                            |
| `npm run db:migrate`  | Aplica o [schema.sql](src/database/schema.sql) no banco.         |
| `npm run build`       | Gera a imagem Docker `blog-com-ia`.                              |
| `npm test`            | Roda os testes unitários e depois os E2E.                        |
| `npm run test:unit`   | Roda só os testes unitários.                                     |
| `npm run test:e2e`    | Roda só os testes E2E.                                           |

## Testes

Os testes usam o test runner nativo do Node.js (`node --test`) e o [supertest](https://github.com/ladjs/supertest) para fazer as requisições HTTP.

- **Unitários** ([tests/unit](tests/unit)): testam o roteador, a validação da API key e as rotas de posts. O banco e o agente de IA são substituídos por mocks, então não precisam de nenhum serviço rodando.

  ```bash
  npm run test:unit
  ```

- **E2E** ([tests/e2e](tests/e2e)): sobem a aplicação e testam o fluxo completo contra um PostgreSQL real. Só a chamada à OpenAI é simulada, para os testes não terem custo nem depender de rede.

  ```bash
  npm run db:up
  npm run test:e2e
  ```

  Os testes usam o banco `blog_test`, criado automaticamente no mesmo PostgreSQL do `docker-compose.yml`, e limpam a tabela `posts` antes de cada teste. Para usar outro banco, defina `TEST_DATABASE_URL`. Por segurança, os testes se recusam a rodar se o nome do banco não terminar em `_test`.

## Modelo de dados

Tabela `posts`:

| Coluna         | Tipo          | Descrição                                     |
| -------------- | ------------- | --------------------------------------------- |
| `id`           | `VARCHAR(21)` | ID gerado com `nanoid`.                       |
| `title`        | `TEXT`        | Título do post.                               |
| `content`      | `TEXT`        | Conteúdo em Markdown.                         |
| `published_at` | `TIMESTAMPTZ` | Data de publicação. `null` se não publicado.  |
| `approved_at`  | `TIMESTAMPTZ` | Data de aprovação. `null` se não aprovado.    |
| `rejected_at`  | `TIMESTAMPTZ` | Data de rejeição. `null` se não rejeitado.    |

Ciclo de vida de um post:

1. **Rascunho:** criado pelo agente, com as três datas em `null`.
2. **Aprovado:** `approved_at` e `published_at` recebem a data atual e `rejected_at` é limpo.
3. **Rejeitado:** `rejected_at` recebe a data atual e `approved_at` e `published_at` são limpos.

Um post pode ser aprovado ou rejeitado novamente a qualquer momento; o estado anterior é substituído.

## Documentação da API (Swagger)

Com o servidor rodando, a documentação interativa fica disponível em:

- **[http://localhost:8080/api/docs](http://localhost:8080/api/docs)**: Swagger UI, onde é possível ver e testar os endpoints. Para usar o `include=all`, clique em **Authorize** e informe a API key.
- **[http://localhost:8080/api/docs/json](http://localhost:8080/api/docs/json)**: especificação OpenAPI 3 em JSON, para importar no Postman, Insomnia, etc.

A especificação fica em [src/docs/openapi.js](src/docs/openapi.js). Ao criar ou alterar uma rota, atualize-a também; o teste [docs.test.js](tests/unit/routes/docs.test.js) falha se uma rota não estiver documentada.

## Endpoints

Todas as respostas são JSON. Em caso de sucesso, os dados vêm em `data`; em caso de erro, a resposta tem uma `message`.

| Método   | Rota                 | Descrição                                     |
| -------- | -------------------- | --------------------------------------------- |
| `GET`    | `/posts`             | Lista os posts publicados.                    |
| `GET`    | `/posts?include=all` | Lista todos os posts. Exige API key.          |
| `GET`    | `/posts/:id`         | Busca um post pelo ID.                        |
| `POST`   | `/posts/draft`       | Gera um rascunho com IA a partir de uma ideia.|
| `PATCH`  | `/posts/:id/approve` | Aprova e publica um post.                     |
| `DELETE` | `/posts/:id/reject`  | Rejeita um post.                              |

### `GET /posts`

Lista os posts publicados (`published_at` preenchido).

```bash
curl http://localhost:8080/posts
```

```json
{
  "data": [
    {
      "id": "V1StGXR8_Z5jdHi6B-myT",
      "title": "Título do post",
      "content": "## Introdução\n...",
      "published_at": "2026-10-30T12:00:00.000Z",
      "approved_at": "2026-10-30T12:00:00.000Z",
      "rejected_at": null
    }
  ]
}
```

### `GET /posts?include=all`

Lista todos os posts, inclusive rascunhos e rejeitados. Exige a API key no header `Authorization`:

```bash
curl -H "Authorization: Bearer <API_KEY>" "http://localhost:8080/posts?include=all"
```

Responde `403` com `{ "message": "Forbidden" }` se o header estiver ausente, se não usar o esquema `Bearer` ou se a chave for inválida.

### `GET /posts/:id`

```bash
curl http://localhost:8080/posts/V1StGXR8_Z5jdHi6B-myT
```

Responde `200` com `{ "data": post }`, ou `404` com `{ "message": "Post not found" }`.

### `POST /posts/draft`

Gera um post com IA a partir de uma ideia e o salva como rascunho.

```bash
curl -X POST http://localhost:8080/posts/draft \
  -H "Content-Type: application/json" \
  -d '{ "idea": "Por que aprender Node.js em 2026" }'
```

Responde `201` com `{ "data": post }`. A geração chama a OpenAI, então pode levar alguns segundos.

### `PATCH /posts/:id/approve`

Aprova e publica o post.

```bash
curl -X PATCH http://localhost:8080/posts/V1StGXR8_Z5jdHi6B-myT/approve
```

Responde `200` com o post atualizado, ou `404` se o post não existir.

### `DELETE /posts/:id/reject`

Rejeita o post. O registro **não** é apagado, apenas marcado como rejeitado.

```bash
curl -X DELETE http://localhost:8080/posts/V1StGXR8_Z5jdHi6B-myT/reject
```

Responde `200` com o post atualizado, ou `404` se o post não existir.

### Erros gerais

| Status | Quando                                                  |
| ------ | ------------------------------------------------------- |
| `400`  | O corpo da requisição não é um JSON válido.             |
| `403`  | `include=all` sem API key válida.                       |
| `404`  | Rota inexistente ou post não encontrado.                |
| `500`  | Erro inesperado no servidor, no banco ou na OpenAI.     |

## Build

A imagem de produção é definida no [Dockerfile](Dockerfile): usa `node:24-alpine`, instala só as dependências de produção e roda com o usuário `node`, sem privilégios de root.

```bash
npm run build
```

Isso gera a imagem `blog-com-ia`. Para testá-la localmente:

```bash
docker run --rm -p 8080:8080 --env-file .env.local blog-com-ia
```

> Dentro do container, `localhost` é o próprio container. Para acessar o PostgreSQL da sua máquina, troque o host da `DATABASE_URL` por `host.docker.internal`.

## Publicação para produção

1. **Gere a imagem** com uma tag de versão:

   ```bash
   docker build -t <registry>/blog-com-ia:<versao> .
   ```

2. **Envie a imagem** para o registry usado pela sua hospedagem (Docker Hub, GitHub Container Registry, etc.):

   ```bash
   docker login <registry>
   docker push <registry>/blog-com-ia:<versao>
   ```

3. **Configure as variáveis de ambiente** no ambiente de produção: `DATABASE_URL`, `OPENAI_API_KEY`, `API_KEY` e, se necessário, `API_PORT`. A imagem não contém nenhuma delas; use o gerenciador de segredos da sua hospedagem. Use uma `API_KEY` longa e aleatória, por exemplo:

   ```bash
   node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"
   ```

4. **Rode a migration** no banco de produção antes de subir a nova versão:

   ```bash
   docker run --rm \
     -e DATABASE_URL="<url-do-banco-de-producao>" \
     <registry>/blog-com-ia:<versao> \
     node src/database/migrate.js
   ```

   O schema usa `CREATE TABLE IF NOT EXISTS`, então pode ser executado mais de uma vez com segurança.

5. **Suba o container** expondo a porta da aplicação (`8080` por padrão):

   ```bash
   docker run -d -p 8080:8080 \
     -e DATABASE_URL="<url-do-banco-de-producao>" \
     -e OPENAI_API_KEY="<chave-openai>" \
     -e API_KEY="<api-key>" \
     <registry>/blog-com-ia:<versao>
   ```
