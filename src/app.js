import { createApp } from "./http/app.js";
import { docsRoutes } from "./routes/docs.js";
import { postsRoutes } from "./routes/posts.js";

export function buildApp() {
  const app = createApp();

  app.register(postsRoutes);
  app.register(docsRoutes);

  return app;
}
