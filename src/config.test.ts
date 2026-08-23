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
    assert.equal(loadConfig(["--headed"]).headless, false);
  });

  it("accepts --timeout", () => {
    assert.equal(loadConfig(["--timeout", "12345"]).responseTimeoutMs, 12345);
  });

  it("accepts --url override", () => {
    assert.equal(loadConfig(["--url", "https://example.com"]).url, "https://example.com");
  });

  it("accepts --cdp", () => {
    assert.equal(loadConfig(["--cdp", "http://127.0.0.1:9222"]).cdpUrl, "http://127.0.0.1:9222");
  });

  it("accepts --browser vivaldi", () => {
    assert.equal(loadConfig(["--browser", "vivaldi"]).browser, "vivaldi");
  });

  it("throws on unknown browser", () => {
    assert.throws(() => loadConfig(["--browser", "nope"]), /Unknown browser/);
  });
});
