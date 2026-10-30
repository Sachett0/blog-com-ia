import { createApp } from "./http/app.js";
import { postsRoutes } from "./routes/posts.js";

const PORT = process.env.API_PORT || 8080;

const app = createApp();

app.register(postsRoutes);

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Press CTRL+C to stop the server`);
});
