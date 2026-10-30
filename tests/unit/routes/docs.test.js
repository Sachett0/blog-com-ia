import { describe, it } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { buildApp } from "../../../src/app.js";

describe("docs routes", () => {
  const app = buildApp();

  describe("GET /api/docs", () => {
    it("serves the Swagger UI page", async () => {
      const response = await request(app.server).get("/api/docs");

      assert.equal(response.status, 200);
      assert.match(response.headers["content-type"], /^text\/html/);
      assert.match(response.text, /SwaggerUIBundle/);
      assert.match(response.text, /url: "\/api\/docs\/json"/);
    });
  });

  describe("GET /api/docs/json", () => {
    it("serves the OpenAPI document", async () => {
      const response = await request(app.server).get("/api/docs/json");

      assert.equal(response.status, 200);
      assert.match(response.headers["content-type"], /^application\/json/);
      assert.equal(response.body.openapi, "3.0.3");
      assert.equal(response.body.info.title, "Blog com IA");
    });

    it("documents every API route", async () => {
      const response = await request(app.server).get("/api/docs/json");

      const documented = Object.entries(response.body.paths).flatMap(
        ([path, methods]) =>
          Object.keys(methods).map((method) => `${method.toUpperCase()} ${path}`),
      );

      const registered = app.routes
        .filter(({ path }) => !path.startsWith("/api/docs"))
        .map(
          ({ method, path }) =>
            `${method} ${path.replace(/:(\w+)/g, "{$1}")}`,
        );

      assert.ok(registered.length > 0);
      assert.deepEqual(documented.sort(), registered.sort());
    });

    it("resolves every $ref to an existing schema", async () => {
      const response = await request(app.server).get("/api/docs/json");
      const refs = JSON.stringify(response.body).match(/"#\/components\/schemas\/\w+"/g);

      for (const ref of new Set(refs)) {
        const name = ref.split("/").at(-1).replace('"', "");
        assert.ok(response.body.components.schemas[name], `missing schema ${name}`);
      }
    });
  });

  describe("GET /api/docs/assets/:file", () => {
    it("serves the Swagger UI assets", async () => {
      const css = await request(app.server).get("/api/docs/assets/swagger-ui.css");
      const js = await request(app.server).get(
        "/api/docs/assets/swagger-ui-bundle.js",
      );

      assert.equal(css.status, 200);
      assert.match(css.headers["content-type"], /^text\/css/);
      assert.equal(js.status, 200);
      assert.match(js.headers["content-type"], /^text\/javascript/);
    });

    it("returns 404 for files that are not allowed", async () => {
      const unknown = await request(app.server).get("/api/docs/assets/index.html");
      const traversal = await request(app.server).get(
        "/api/docs/assets/..%2F..%2Fpackage.json",
      );

      assert.equal(unknown.status, 404);
      assert.equal(traversal.status, 404);
    });
  });
});
