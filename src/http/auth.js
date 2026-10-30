import { createHash, timingSafeEqual } from "node:crypto";

function hash(value) {
  return createHash("sha256").update(value).digest();
}

export function hasValidApiKey(req) {
  const apiKey = process.env.API_KEY;

  if (!apiKey) {
    return false;
  }

  const [scheme, token] = (req.headers.authorization || "").split(" ");

  if (scheme !== "Bearer" || !token) {
    return false;
  }

  return timingSafeEqual(hash(token), hash(apiKey));
}
