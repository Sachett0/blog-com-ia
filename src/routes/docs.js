import { readFile } from "node:fs/promises";
import { join } from "node:path";
import swaggerUiDist from "swagger-ui-dist";
import { openApiDocument } from "../docs/openapi.js";

const swaggerUiPath = swaggerUiDist.getAbsoluteFSPath();

// Only these files from swagger-ui-dist are served, so the :file param can
// never be used to read anything else from disk.
const assets = {
  "swagger-ui.css": "text/css",
  "swagger-ui-bundle.js": "text/javascript",
  "swagger-ui-standalone-preset.js": "text/javascript",
  "favicon-32x32.png": "image/png",
  "favicon-16x16.png": "image/png",
};

const html = `<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="UTF-8" />
    <title>Blog com IA - API Docs</title>
    <link rel="stylesheet" href="/api/docs/assets/swagger-ui.css" />
    <link rel="icon" type="image/png" href="/api/docs/assets/favicon-32x32.png" sizes="32x32" />
    <link rel="icon" type="image/png" href="/api/docs/assets/favicon-16x16.png" sizes="16x16" />
  </head>
  <body>
    <div id="swagger-ui"></div>
    <script src="/api/docs/assets/swagger-ui-bundle.js"></script>
    <script src="/api/docs/assets/swagger-ui-standalone-preset.js"></script>
    <script>
      window.ui = SwaggerUIBundle({
        url: "/api/docs/json",
        dom_id: "#swagger-ui",
        presets: [SwaggerUIBundle.presets.apis, SwaggerUIStandalonePreset],
        layout: "StandaloneLayout",
      });
    </script>
  </body>
</html>`;

export function docsRoutes(app) {
  app.get("/api/docs", (req, res) => {
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    return res.end(html);
  });

  app.get("/api/docs/json", (req, res) => {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify(openApiDocument));
  });

  app.get("/api/docs/assets/:file", async (req, res) => {
    const { file } = req.params;
    const contentType = assets[file];

    if (!contentType) {
      res.writeHead(404, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ message: "Asset not found" }));
    }

    const content = await readFile(join(swaggerUiPath, file));

    res.writeHead(200, {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=86400",
    });
    return res.end(content);
  });
}
