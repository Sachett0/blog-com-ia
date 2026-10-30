import { afterEach, beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { buildApp } from "../../../src/app.js";
import { postWriterAgent } from "../../../src/agents/post-writer.js";
import { db } from "../../../src/database/connection.js";

const post = {
  id: "post-1",
  title: "Título",
  content: "Conteúdo",
  published_at: null,
  approved_at: null,
  rejected_at: null,
};

function mockQuery(rows = []) {
  return mock.method(db, "query", async () => ({ rows }));
}

function mockQueryFailure() {
  mock.method(console, "error", () => {});
  return mock.method(db, "query", async () => {
    throw new Error("database is down");
  });
}

function normalizeSql(sql) {
  return sql.replace(/\s+/g, " ").trim();
}

describe("posts routes", () => {
  let app;
  let originalApiKey;

  beforeEach(() => {
    app = buildApp();
    originalApiKey = process.env.API_KEY;
    process.env.API_KEY = "secret";
  });

  afterEach(() => {
    mock.restoreAll();

    if (originalApiKey === undefined) {
      delete process.env.API_KEY;
    } else {
      process.env.API_KEY = originalApiKey;
    }
  });

  describe("GET /posts", () => {
    it("lists only published posts by default", async () => {
      const query = mockQuery([post]);

      const response = await request(app.server).get("/posts");

      assert.equal(response.status, 200);
      assert.deepEqual(response.body, { data: [post] });
      assert.equal(
        query.mock.calls[0].arguments[0],
        "SELECT * FROM posts WHERE published_at IS NOT NULL",
      );
    });

    it("lists every post with include=all and a valid API key", async () => {
      const query = mockQuery([post]);

      const response = await request(app.server)
        .get("/posts?include=all")
        .set("Authorization", "Bearer secret");

      assert.equal(response.status, 200);
      assert.equal(query.mock.calls[0].arguments[0], "SELECT * FROM posts");
    });

    it("returns 403 with include=all and no API key", async () => {
      const query = mockQuery();

      const response = await request(app.server).get("/posts?include=all");

      assert.equal(response.status, 403);
      assert.deepEqual(response.body, { message: "Forbidden" });
      assert.equal(query.mock.callCount(), 0);
    });

    it("returns 403 with include=all and an invalid API key", async () => {
      const query = mockQuery();

      const response = await request(app.server)
        .get("/posts?include=all")
        .set("Authorization", "Bearer wrong");

      assert.equal(response.status, 403);
      assert.equal(query.mock.callCount(), 0);
    });

    it("returns 500 when the database fails", async () => {
      mockQueryFailure();

      const response = await request(app.server).get("/posts");

      assert.equal(response.status, 500);
      assert.deepEqual(response.body, { message: "Failed to list posts" });
    });
  });

  describe("GET /posts/:id", () => {
    it("returns the post", async () => {
      const query = mockQuery([post]);

      const response = await request(app.server).get("/posts/post-1");

      assert.equal(response.status, 200);
      assert.deepEqual(response.body, { data: post });
      assert.deepEqual(query.mock.calls[0].arguments[1], ["post-1"]);
    });

    it("returns 404 when the post does not exist", async () => {
      mockQuery([]);

      const response = await request(app.server).get("/posts/missing");

      assert.equal(response.status, 404);
      assert.deepEqual(response.body, { message: "Post not found" });
    });

    it("returns 500 when the database fails", async () => {
      mockQueryFailure();

      const response = await request(app.server).get("/posts/post-1");

      assert.equal(response.status, 500);
      assert.deepEqual(response.body, { message: "Failed to get post" });
    });
  });

  describe("POST /posts/draft", () => {
    it("generates a post from the idea and saves it as a draft", async () => {
      const generate = mock.method(postWriterAgent, "generate", async () => ({
        object: { title: "Título", content: "Conteúdo" },
      }));
      const query = mockQuery([post]);

      const response = await request(app.server)
        .post("/posts/draft")
        .send({ idea: "Node.js" });

      assert.equal(response.status, 201);
      assert.deepEqual(response.body, { data: post });
      assert.match(generate.mock.calls[0].arguments[0], /Node\.js/);

      const [id, title, content, ...dates] = query.mock.calls[0].arguments[1];
      assert.equal(typeof id, "string");
      assert.equal(id.length, 21);
      assert.equal(title, "Título");
      assert.equal(content, "Conteúdo");
      assert.deepEqual(dates, [null, null, null]);
    });

    it("returns 500 when the agent fails", async () => {
      mock.method(console, "error", () => {});
      mock.method(postWriterAgent, "generate", async () => {
        throw new Error("OpenAI is down");
      });
      const query = mockQuery();

      const response = await request(app.server)
        .post("/posts/draft")
        .send({ idea: "Node.js" });

      assert.equal(response.status, 500);
      assert.deepEqual(response.body, { message: "Failed to generate post" });
      assert.equal(query.mock.callCount(), 0);
    });
  });

  describe("PATCH /posts/:id/approve", () => {
    it("approves and publishes the post, clearing the rejection", async () => {
      const query = mockQuery([post]);

      const response = await request(app.server).patch("/posts/post-1/approve");

      assert.equal(response.status, 200);
      assert.deepEqual(response.body, { data: post });

      const [sql, params] = query.mock.calls[0].arguments;
      assert.match(
        normalizeSql(sql),
        /SET approved_at = NOW\(\), published_at = NOW\(\), rejected_at = NULL/,
      );
      assert.deepEqual(params, ["post-1"]);
    });

    it("returns 404 when the post does not exist", async () => {
      mockQuery([]);

      const response = await request(app.server).patch("/posts/missing/approve");

      assert.equal(response.status, 404);
    });

    it("returns 500 when the database fails", async () => {
      mockQueryFailure();

      const response = await request(app.server).patch("/posts/post-1/approve");

      assert.equal(response.status, 500);
      assert.deepEqual(response.body, { message: "Failed to approve post" });
    });
  });

  describe("DELETE /posts/:id/reject", () => {
    it("rejects the post, clearing approval and publication", async () => {
      const query = mockQuery([post]);

      const response = await request(app.server).delete("/posts/post-1/reject");

      assert.equal(response.status, 200);
      assert.deepEqual(response.body, { data: post });

      const [sql, params] = query.mock.calls[0].arguments;
      assert.match(
        normalizeSql(sql),
        /SET rejected_at = NOW\(\), approved_at = NULL, published_at = NULL/,
      );
      assert.deepEqual(params, ["post-1"]);
    });

    it("returns 404 when the post does not exist", async () => {
      mockQuery([]);

      const response = await request(app.server).delete("/posts/missing/reject");

      assert.equal(response.status, 404);
    });

    it("returns 500 when the database fails", async () => {
      mockQueryFailure();

      const response = await request(app.server).delete("/posts/post-1/reject");

      assert.equal(response.status, 500);
      assert.deepEqual(response.body, { message: "Failed to reject post" });
    });
  });
});
