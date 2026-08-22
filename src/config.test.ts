import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "./config.ts";

describe("loadConfig", () => {
  it("defaults to x-grok url, chrome, headless", () => {
    const c = loadConfig([]);
    assert.equal(c.provider, "x-grok");
    assert.equal(c.url, "https://x.com/i/grok");
    assert.equal(c.browser, "chrome");
    assert.equal(c.headless, true);
  });

  it("accepts --headed", () => {
    const c = loadConfig(["--headed"]);
    assert.equal(c.headless, false);
  });

  it("accepts --timeout", () => {
    const c = loadConfig(["--timeout", "12345"]);
    assert.equal(c.responseTimeoutMs, 12345);
  });

  it("accepts --url override", () => {
    const c = loadConfig(["--url", "https://example.com"]);
    assert.equal(c.url, "https://example.com");
  });

  it("accepts --cdp", () => {
    const c = loadConfig(["--cdp", "http://127.0.0.1:9222"]);
    assert.equal(c.cdpUrl, "http://127.0.0.1:9222");
  });

  it("accepts --browser vivaldi", () => {
    const c = loadConfig(["--browser", "vivaldi"]);
    assert.equal(c.browser, "vivaldi");
  });
});
