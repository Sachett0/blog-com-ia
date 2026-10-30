import { describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { createApp } from "../../../src/http/app.js";

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function echo(req, res) {
  sendJson(res, 200, {
    method: req.method,
    params: req.params,
    query: req.query,
    body: req.body,
  });
}

describe("createApp", () => {
  it("routes each HTTP method to its handler", async () => {
    const app = createApp();
    app.get("/items", echo);
    app.post("/items", echo);
    app.put("/items", echo);
    app.patch("/items", echo);
    app.delete("/items", echo);

    for (const method of ["get", "post", "put", "patch", "delete"]) {
      const response = await request(app.server)[method]("/items");

      assert.equal(response.status, 200);
      assert.equal(response.body.method, method.toUpperCase());
    }
  });

  it("extracts path params", async () => {
    const app = createApp();
    app.get("/users/:userId/posts/:postId", echo);

    const response = await request(app.server).get("/users/1/posts/abc");

    assert.deepEqual(response.body.params, { userId: "1", postId: "abc" });
  });

  it("decodes path params", async () => {
    const app = createApp();
    app.get("/posts/:id", echo);

    const response = await request(app.server).get("/posts/hello%20world");

    assert.equal(response.body.params.id, "hello world");
  });

  it("keeps malformed path params as received", async () => {
    const app = createApp();
    app.get("/posts/:id", echo);

    const response = await request(app.server).get("/posts/%E0");

    assert.equal(response.status, 200);
    assert.equal(response.body.params.id, "%E0");
  });

  it("parses the query string", async () => {
    const app = createApp();
    app.get("/posts", echo);

    const response = await request(app.server).get("/posts?include=all&page=2");

    assert.deepEqual(response.body.query, { include: "all", page: "2" });
  });

  it("ignores a trailing slash", async () => {
    const app = createApp();
    app.get("/posts", echo);

    const response = await request(app.server).get("/posts/");

    assert.equal(response.status, 200);
  });

  it("parses a JSON body", async () => {
    const app = createApp();
    app.post("/posts", echo);

    const response = await request(app.server)
      .post("/posts")
      .send({ idea: "Node.js" });

    assert.deepEqual(response.body.body, { idea: "Node.js" });
  });

  it("sets body to null when the request has no body", async () => {
    const app = createApp();
    app.post("/posts", echo);

    const response = await request(app.server).post("/posts");

    assert.equal(response.body.body, null);
  });

  it("returns 400 for an invalid JSON body", async () => {
    const app = createApp();
    const handler = mock.fn(echo);
    app.post("/posts", handler);

    const response = await request(app.server)
      .post("/posts")
      .set("Content-Type", "application/json")
      .send("{invalid");

    assert.equal(response.status, 400);
    assert.deepEqual(response.body, { message: "Invalid JSON body" });
    assert.equal(handler.mock.callCount(), 0);
  });

  it("returns 404 for an unknown path", async () => {
    const app = createApp();
    app.get("/posts", echo);

    const response = await request(app.server).get("/unknown");

    assert.equal(response.status, 404);
    assert.deepEqual(response.body, { message: "Route not found" });
  });

  it("returns 404 when the method does not match", async () => {
    const app = createApp();
    app.get("/posts", echo);

    const response = await request(app.server).delete("/posts");

    assert.equal(response.status, 404);
  });

  it("uses the first registered route that matches", async () => {
    const app = createApp();
    app.get("/posts/draft", (req, res) => sendJson(res, 200, { route: "static" }));
    app.get("/posts/:id", (req, res) => sendJson(res, 200, { route: "param" }));

    const response = await request(app.server).get("/posts/draft");

    assert.equal(response.body.route, "static");
  });

  it("returns 500 when a handler throws", async (t) => {
    const consoleError = t.mock.method(console, "error", () => {});
    const app = createApp();
    app.get("/boom", () => {
      throw new Error("boom");
    });

    const response = await request(app.server).get("/boom");

    assert.equal(response.status, 500);
    assert.deepEqual(response.body, { message: "Internal server error" });
    assert.equal(consoleError.mock.callCount(), 1);
  });

  it("passes the app to registered plugins", () => {
    const app = createApp();
    const plugin = mock.fn();

    app.register(plugin);

    assert.equal(plugin.mock.calls[0].arguments[0], app);
  });
});
