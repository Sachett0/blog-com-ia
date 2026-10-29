import { Agent } from "@mastra/core/agent";
import { z } from "zod";

export const postSchema = z.object({
  title: z.string().describe("Título do post"),
  content: z.string().describe("Conteúdo completo do post em Markdown"),
});

export const postWriterAgent = new Agent({
  id: "post-writer",
  name: "Post Writer",
  instructions: `
    Você é um redator especialista em criar posts para blog.
    A partir de uma ideia enviada pelo usuário, escreva um post completo em português.
    - Crie um título claro e atrativo.
    - Escreva o conteúdo em Markdown, com introdução, seções com subtítulos (##) e conclusão.
    - Não repita o título dentro do conteúdo.
  `,
  model: "openai/gpt-4o-mini",
});

export async function generatePost(idea) {
  const result = await postWriterAgent.generate(
    `Crie um post completo a partir desta ideia: ${idea}`,
    { structuredOutput: { schema: postSchema } },
  );

  return result.object;
}
