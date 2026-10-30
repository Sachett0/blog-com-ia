import { buildApp } from "./app.js";

const PORT = process.env.API_PORT || 8080;

const app = buildApp();

app.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Press CTRL+C to stop the server`);
});
