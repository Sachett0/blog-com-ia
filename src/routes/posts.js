import { nanoid } from "nanoid";
import { generatePost } from "../agents/post-writer.js";
import { db } from "../database/connection.js";

export function postsRoutes(app) {
  app.get("/posts", async (req, res) => {
    try {
      const { rows: posts } = await db.query("SELECT * FROM posts");

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ data: posts }));
    } catch (error) {
      console.error(error);
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ message: "Failed to list posts" }));
    }
  });

  app.get("/posts/:id", async (req, res) => {
    const { id } = req.params;

    try {
      const { rows } = await db.query("SELECT * FROM posts WHERE id = $1", [id]);
      const post = rows[0];

      if (!post) {
        res.writeHead(404, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ message: "Post not found" }));
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ data: post }));
    } catch (error) {
      console.error(error);
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ message: "Failed to get post" }));
    }
  });

  app.patch("/posts/:id/approve", async (req, res) => {
    const { id } = req.params;

    try {
      const { rows } = await db.query(
        `UPDATE posts
         SET approved_at = NOW(), published_at = NOW(), rejected_at = NULL
         WHERE id = $1
         RETURNING *`,
        [id],
      );
      const post = rows[0];

      if (!post) {
        res.writeHead(404, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ message: "Post not found" }));
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ data: post }));
    } catch (error) {
      console.error(error);
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ message: "Failed to approve post" }));
    }
  });

  app.delete("/posts/:id/reject", async (req, res) => {
    const { id } = req.params;

    try {
      const { rows } = await db.query(
        `UPDATE posts
         SET rejected_at = NOW(), approved_at = NULL, published_at = NULL
         WHERE id = $1
         RETURNING *`,
        [id],
      );
      const post = rows[0];

      if (!post) {
        res.writeHead(404, { "Content-Type": "application/json" });
        return res.end(JSON.stringify({ message: "Post not found" }));
      }

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ data: post }));
    } catch (error) {
      console.error(error);
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ message: "Failed to reject post" }));
    }
  });

  app.post("/posts/draft", async (req, res) => {
    try {
      const { title, content } = await generatePost(req.body?.idea);

      const { rows } = await db.query(
        `INSERT INTO posts (id, title, content, published_at, approved_at, rejected_at)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING *`,
        [nanoid(), title, content, null, null, null],
      );
      const post = rows[0];

      res.writeHead(201, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ data: post }));
    } catch (error) {
      console.error(error);
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ message: "Failed to generate post" }));
    }
  });
}
