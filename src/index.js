import http from "node:http";
import { nanoid } from "nanoid";
import { generatePost } from "./agents/post-writer.js";

const PORT = process.env.API_PORT || 8080;

const posts = [];

const server = http.createServer((req, res) => {
  const { method, url } = req;
  const paths = url.split("?");
  const path = paths.at(0) || "/";

  if (path === "/posts" && method === "GET") {
    res.writeHead(200, { "Content-Type": "application/json" });
    return res.end(JSON.stringify({ data: posts }));
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

        const post = {
          id: nanoid(),
          title,
          content,
          published_at: null,
          approved_at: null,
          rejected_at: null,
        };

        posts.push(post);

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
