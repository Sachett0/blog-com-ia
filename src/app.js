import { createApp } from "./http/app.js";
import { postsRoutes } from "./routes/posts.js";

export function buildApp() {
  const app = createApp();

  app.register(postsRoutes);

  return app;
}
