import http from "node:http";

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
});

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Press CTRL+C to stop the server`);
});
