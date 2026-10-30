import http from "node:http";

function sendJson(res, statusCode, payload) {
  res.writeHead(statusCode, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

function splitPath(path) {
  return path.split("/").filter(Boolean);
}

function decodeSegment(segment) {
  try {
    return decodeURIComponent(segment);
  } catch {
    return segment;
  }
}

function matchRoute(route, segments) {
  if (route.segments.length !== segments.length) {
    return null;
  }

  const params = {};

  for (let i = 0; i < segments.length; i++) {
    const routeSegment = route.segments[i];

    if (routeSegment.startsWith(":")) {
      params[routeSegment.slice(1)] = decodeSegment(segments[i]);
    } else if (routeSegment !== segments[i]) {
      return null;
    }
  }

  return params;
}

async function readBody(req) {
  const chunks = [];

  for await (const chunk of req) {
    chunks.push(chunk);
  }

  const raw = Buffer.concat(chunks).toString();

  return raw ? JSON.parse(raw) : null;
}

export function createApp() {
  const routes = [];

  function addRoute(method, path, handler) {
    routes.push({ method, path, segments: splitPath(path), handler });
  }

  const server = http.createServer(async (req, res) => {
    const { pathname, searchParams } = new URL(req.url, "http://localhost");
    const segments = splitPath(pathname);

    let route = null;
    let params = null;

    for (const candidate of routes) {
      if (candidate.method !== req.method) continue;

      params = matchRoute(candidate, segments);
      if (params) {
        route = candidate;
        break;
      }
    }

    if (!route) {
      return sendJson(res, 404, { message: "Route not found" });
    }

    req.params = params;
    req.query = Object.fromEntries(searchParams);

    try {
      req.body = await readBody(req);
    } catch {
      return sendJson(res, 400, { message: "Invalid JSON body" });
    }

    try {
      await route.handler(req, res);
    } catch (error) {
      console.error(error);
      if (!res.headersSent) {
        sendJson(res, 500, { message: "Internal server error" });
      }
    }
  });

  const app = {
    server,
    get routes() {
      return routes.map(({ method, path }) => ({ method, path }));
    },
    get: (path, handler) => addRoute("GET", path, handler),
    post: (path, handler) => addRoute("POST", path, handler),
    put: (path, handler) => addRoute("PUT", path, handler),
    patch: (path, handler) => addRoute("PATCH", path, handler),
    delete: (path, handler) => addRoute("DELETE", path, handler),
    register: (plugin) => plugin(app),
    listen: (port, callback) => server.listen(port, callback),
  };

  return app;
}
