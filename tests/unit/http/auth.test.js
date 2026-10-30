import { afterEach, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { hasValidApiKey } from "../../../src/http/auth.js";

function requestWith(authorization) {
  return { headers: authorization === undefined ? {} : { authorization } };
}

describe("hasValidApiKey", () => {
  let originalApiKey;

  beforeEach(() => {
    originalApiKey = process.env.API_KEY;
    process.env.API_KEY = "secret";
  });

  afterEach(() => {
    if (originalApiKey === undefined) {
      delete process.env.API_KEY;
    } else {
      process.env.API_KEY = originalApiKey;
    }
  });

  it("accepts a valid Bearer token", () => {
    assert.equal(hasValidApiKey(requestWith("Bearer secret")), true);
  });

  it("rejects a request without the authorization header", () => {
    assert.equal(hasValidApiKey(requestWith()), false);
  });

  it("rejects an invalid token", () => {
    assert.equal(hasValidApiKey(requestWith("Bearer wrong")), false);
  });

  it("rejects a token with a different length", () => {
    assert.equal(hasValidApiKey(requestWith("Bearer secret-but-longer")), false);
  });

  it("rejects a token without the Bearer scheme", () => {
    assert.equal(hasValidApiKey(requestWith("secret")), false);
    assert.equal(hasValidApiKey(requestWith("Basic secret")), false);
  });

  it("rejects an empty Bearer token", () => {
    assert.equal(hasValidApiKey(requestWith("Bearer ")), false);
  });

  it("rejects every token when API_KEY is not configured", () => {
    delete process.env.API_KEY;

    assert.equal(hasValidApiKey(requestWith("Bearer secret")), false);
    assert.equal(hasValidApiKey(requestWith("Bearer ")), false);
  });
});
