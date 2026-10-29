import http from "node:http";
import { nanoid } from "nanoid";
import { generatePost } from "./agents/post-writer.js";
import { db } from "./database/connection.js";

const PORT = process.env.API_PORT || 8080;

const server = http.createServer(async (req, res) => {
  const { method, url } = req;
  const paths = url.split("?");
  const path = paths.at(0) || "/";

  if (path === "/posts" && method === "GET") {
    try {
      const { rows: posts } = await db.query("SELECT * FROM posts");

      res.writeHead(200, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ data: posts }));
    } catch (error) {
      console.error(error);
      res.writeHead(500, { "Content-Type": "application/json" });
      return res.end(JSON.stringify({ message: "Failed to list posts" }));
    }
  }

  if (path === "/posts/draft" && method === "POST") {
    const bodyBuffer = [];
    let body = null;

    req.on("data", (chunk) => bodyBuffer.push(chunk));
    req.on("end", async () => {
      const bodyString = Buffer.concat(bodyBuffer).toString();
      body = JSON.parse(bodyString);

      try {
        const { title, content } = await generatePost(body.idea);

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
    return;
  }
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Press CTRL+C to stop the server`);
});
