import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { loadConfig } from "./config.ts";

describe("loadConfig", () => {
  it("defaults to x-grok url and vivaldi", () => {
    const config = loadConfig([]);
    assert.equal(config.url, "https://x.com/i/grok");
    assert.equal(config.headless, false);
    assert.equal(config.responseTimeoutMs, 90000);
    assert.equal(config.cdpUrl, undefined);
    assert.equal(config.browser, "vivaldi");
    assert.ok(config.userDataDir?.includes("Vivaldi"));
  });

  it("accepts --headless", () => {
    const config = loadConfig(["--headless"]);
    assert.equal(config.headless, true);
  });

  it("accepts --timeout", () => {
    const config = loadConfig(["--timeout", "120000"]);
    assert.equal(config.responseTimeoutMs, 120000);
  });

  it("accepts --url override", () => {
    const config = loadConfig(["--url", "https://example.com"]);
    assert.equal(config.url, "https://example.com");
  });

  it("accepts --cdp", () => {
    const config = loadConfig(["--cdp", "http://localhost:9222"]);
    assert.equal(config.cdpUrl, "http://localhost:9222");
  });

  it("accepts --browser chrome", () => {
    const config = loadConfig(["--browser", "chrome"]);
    assert.equal(config.browser, "chrome");
    assert.ok(config.userDataDir?.includes("Chrome"));
  });
});
