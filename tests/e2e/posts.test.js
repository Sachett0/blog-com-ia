import {
  API_KEY,
  closeDatabase,
  resetDatabase,
  setupDatabase,
} from "./helpers.js";
import { after, before, beforeEach, describe, it, mock } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import { buildApp } from "../../src/app.js";
import { postWriterAgent } from "../../src/agents/post-writer.js";

const generatedPost = {
  title: "Por que aprender Node.js",
  content: "## Introdução\n\nNode.js é...",
};

describe("posts (E2E)", () => {
  const app = buildApp();

  before(async () => {
    await setupDatabase();
  });

  beforeEach(async () => {
    await resetDatabase();
    mock.method(postWriterAgent, "generate", async () => ({
      object: generatedPost,
    }));
  });

  after(async () => {
    mock.restoreAll();
    await closeDatabase();
  });

  async function createDraft() {
    const response = await request(app.server)
      .post("/posts/draft")
      .send({ idea: "Node.js" });

    assert.equal(response.status, 201);

    return response.body.data;
  }

  function listPublished() {
    return request(app.server).get("/posts");
  }

  function listAll() {
    return request(app.server)
      .get("/posts?include=all")
      .set("Authorization", `Bearer ${API_KEY}`);
  }

  it("creates a draft that is not published", async () => {
    const draft = await createDraft();

    assert.equal(draft.title, generatedPost.title);
    assert.equal(draft.content, generatedPost.content);
    assert.equal(draft.published_at, null);
    assert.equal(draft.approved_at, null);
    assert.equal(draft.rejected_at, null);

    const published = await listPublished();
    assert.deepEqual(published.body.data, []);

    const all = await listAll();
    assert.deepEqual(
      all.body.data.map((post) => post.id),
      [draft.id],
    );
  });

  it("gets a post by id", async () => {
    const draft = await createDraft();

    const response = await request(app.server).get(`/posts/${draft.id}`);

    assert.equal(response.status, 200);
    assert.deepEqual(response.body.data, draft);
  });

  it("returns 404 for a post that does not exist", async () => {
    const response = await request(app.server).get("/posts/does-not-exist");

    assert.equal(response.status, 404);
  });

  it("approves a post and publishes it", async () => {
    const draft = await createDraft();

    const response = await request(app.server).patch(
      `/posts/${draft.id}/approve`,
    );

    assert.equal(response.status, 200);
    assert.ok(response.body.data.approved_at);
    assert.equal(response.body.data.published_at, response.body.data.approved_at);
    assert.equal(response.body.data.rejected_at, null);

    const published = await listPublished();
    assert.deepEqual(
      published.body.data.map((post) => post.id),
      [draft.id],
    );
  });

  it("rejects an approved post and unpublishes it", async () => {
    const draft = await createDraft();
    await request(app.server).patch(`/posts/${draft.id}/approve`);

    const response = await request(app.server).delete(
      `/posts/${draft.id}/reject`,
    );

    assert.equal(response.status, 200);
    assert.ok(response.body.data.rejected_at);
    assert.equal(response.body.data.approved_at, null);
    assert.equal(response.body.data.published_at, null);

    const published = await listPublished();
    assert.deepEqual(published.body.data, []);
  });

  it("approves a previously rejected post", async () => {
    const draft = await createDraft();
    await request(app.server).delete(`/posts/${draft.id}/reject`);

    const response = await request(app.server).patch(
      `/posts/${draft.id}/approve`,
    );

    assert.equal(response.status, 200);
    assert.equal(response.body.data.rejected_at, null);
    assert.ok(response.body.data.published_at);
  });

  it("returns 404 when approving or rejecting a missing post", async () => {
    const approve = await request(app.server).patch("/posts/missing/approve");
    const reject = await request(app.server).delete("/posts/missing/reject");

    assert.equal(approve.status, 404);
    assert.equal(reject.status, 404);
  });

  it("forbids include=all without a valid API key", async () => {
    const withoutKey = await request(app.server).get("/posts?include=all");
    const withWrongKey = await request(app.server)
      .get("/posts?include=all")
      .set("Authorization", "Bearer wrong");

    assert.equal(withoutKey.status, 403);
    assert.equal(withWrongKey.status, 403);
  });
});
