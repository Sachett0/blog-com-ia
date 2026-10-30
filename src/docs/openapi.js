const errorResponse = (description, example) => ({
  description,
  content: {
    "application/json": {
      schema: { $ref: "#/components/schemas/Error" },
      example: { message: example },
    },
  },
});

const postResponse = (description) => ({
  description,
  content: {
    "application/json": {
      schema: {
        type: "object",
        properties: { data: { $ref: "#/components/schemas/Post" } },
      },
    },
  },
});

const postIdParameter = {
  name: "id",
  in: "path",
  required: true,
  description: "ID do post.",
  schema: { type: "string", example: "V1StGXR8_Z5jdHi6B-myT" },
};

export const openApiDocument = {
  openapi: "3.0.3",
  info: {
    title: "Blog com IA",
    version: "1.0.0",
    description:
      "API de um blog em que os posts são escritos por IA. A partir de uma ideia, um agente gera o rascunho do post, que depois é aprovado (e publicado) ou rejeitado.",
  },
  tags: [{ name: "Posts" }],
  paths: {
    "/posts": {
      get: {
        tags: ["Posts"],
        summary: "Lista os posts",
        description:
          "Por padrão, lista apenas os posts publicados. Com `include=all`, lista todos os posts, inclusive rascunhos e rejeitados; nesse caso, é obrigatório enviar a API key.",
        parameters: [
          {
            name: "include",
            in: "query",
            required: false,
            description: "Use `all` para listar todos os posts. Exige API key.",
            schema: { type: "string", enum: ["all"] },
          },
        ],
        security: [{}, { bearerAuth: [] }],
        responses: {
          200: {
            description: "Lista de posts.",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    data: {
                      type: "array",
                      items: { $ref: "#/components/schemas/Post" },
                    },
                  },
                },
              },
            },
          },
          403: errorResponse(
            "`include=all` sem API key ou com API key inválida.",
            "Forbidden",
          ),
          500: errorResponse("Erro ao listar os posts.", "Failed to list posts"),
        },
      },
    },
    "/posts/{id}": {
      get: {
        tags: ["Posts"],
        summary: "Busca um post pelo ID",
        parameters: [postIdParameter],
        responses: {
          200: postResponse("Post encontrado."),
          404: errorResponse("Post não encontrado.", "Post not found"),
          500: errorResponse("Erro ao buscar o post.", "Failed to get post"),
        },
      },
    },
    "/posts/draft": {
      post: {
        tags: ["Posts"],
        summary: "Gera um rascunho com IA",
        description:
          "Gera um post com IA a partir de uma ideia e o salva como rascunho. A geração chama a OpenAI e pode levar alguns segundos.",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["idea"],
                properties: {
                  idea: {
                    type: "string",
                    description: "Ideia do post.",
                    example: "Por que aprender Node.js em 2026",
                  },
                },
              },
            },
          },
        },
        responses: {
          201: postResponse("Rascunho criado."),
          400: errorResponse("O corpo não é um JSON válido.", "Invalid JSON body"),
          500: errorResponse("Erro ao gerar o post.", "Failed to generate post"),
        },
      },
    },
    "/posts/{id}/approve": {
      patch: {
        tags: ["Posts"],
        summary: "Aprova e publica um post",
        description:
          "Define `approved_at` e `published_at` com a data atual e limpa `rejected_at`.",
        parameters: [postIdParameter],
        responses: {
          200: postResponse("Post aprovado."),
          404: errorResponse("Post não encontrado.", "Post not found"),
          500: errorResponse("Erro ao aprovar o post.", "Failed to approve post"),
        },
      },
    },
    "/posts/{id}/reject": {
      delete: {
        tags: ["Posts"],
        summary: "Rejeita um post",
        description:
          "Define `rejected_at` com a data atual e limpa `approved_at` e `published_at`. O post **não** é apagado.",
        parameters: [postIdParameter],
        responses: {
          200: postResponse("Post rejeitado."),
          404: errorResponse("Post não encontrado.", "Post not found"),
          500: errorResponse("Erro ao rejeitar o post.", "Failed to reject post"),
        },
      },
    },
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        description: "API key definida na variável de ambiente `API_KEY`.",
      },
    },
    schemas: {
      Post: {
        type: "object",
        properties: {
          id: { type: "string", example: "V1StGXR8_Z5jdHi6B-myT" },
          title: { type: "string", example: "Por que aprender Node.js em 2026" },
          content: {
            type: "string",
            description: "Conteúdo em Markdown.",
            example: "## Introdução\n\nNode.js é...",
          },
          published_at: { type: "string", format: "date-time", nullable: true },
          approved_at: { type: "string", format: "date-time", nullable: true },
          rejected_at: { type: "string", format: "date-time", nullable: true },
        },
      },
      Error: {
        type: "object",
        properties: { message: { type: "string" } },
      },
    },
  },
};
