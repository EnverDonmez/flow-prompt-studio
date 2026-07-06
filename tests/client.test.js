/**
 * Flow Prompt Studio — Client unit tests
 *
 * Usage: node --test tests/client.test.js
 */

const { describe, it, after, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");

// Mock fetch
let originalFetch;
const mockFetchCalls = [];

function mockFetch(responseFactory) {
  return async (...args) => {
    mockFetchCalls.push({ url: args[0], options: args[1] });
    const response = typeof responseFactory === "function"
      ? responseFactory(...args)
      : responseFactory;
    return {
      ok: response.ok ?? true,
      status: response.status ?? 200,
      statusText: response.statusText ?? "OK",
      headers: {
        get: (name) => {
          if (name === "content-type") return response.contentType ?? "application/json";
          if (name === "retry-after") return response.retryAfter ?? null;
          return null;
        },
      },
      json: async () => response.body ?? {},
      text: async () => response.textBody ?? JSON.stringify(response.body ?? {}),
      blob: async () => new Blob([]),
    };
  };
}

function setupFetch(responseFactory) {
  mockFetchCalls.length = 0;
  originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch(responseFactory);
}

function restoreFetch() {
  if (originalFetch) {
    globalThis.fetch = originalFetch;
    originalFetch = null;
  }
  mockFetchCalls.length = 0;
}

describe("FlowPromptStudioClient", () => {
  after(() => {
    restoreFetch();
  });

  afterEach(() => {
    restoreFetch();
  });

  function makeClient(retryOverrides = {}) {
    const { FlowPromptStudioClient } = require("../src/client");
    const client = new FlowPromptStudioClient("http://test.local/api/v1");
    client.retryConfig = {
      maxRetries: 0,
      initialDelayMs: 10,
      backoffMultiplier: 1,
      maxDelayMs: 100,
      timeoutMs: 5000,
      retryableStatuses: [],
      ...retryOverrides,
    };
    return client;
  }

  /* ── _request ── */
  describe("_request", () => {
    it("parses successful JSON response", async () => {
      const client = makeClient();
      setupFetch({ body: { success: true, data: "test" } });
      const result = await client._request("/test");
      assert.equal(result.success, true);
      assert.equal(result.data, "test");
    });

    it("returns text response", async () => {
      const client = makeClient();
      setupFetch({ contentType: "text/plain", body: null, textBody: "hello" });
      const result = await client._request("/test");
      assert.equal(result, "hello");
    });

    it("throws on HTTP error", async () => {
      const client = makeClient();
      setupFetch({ ok: false, status: 500, textBody: "Server error" });
      await assert.rejects(
        () => client._request("/test"),
        /API 500: Server error/
      );
    });

    it("throws with correct message for 404", async () => {
      const client = makeClient();
      setupFetch({ ok: false, status: 404, textBody: "Not found" });
      await assert.rejects(
        () => client._request("/test"),
        /API 404: Not found/
      );
    });
  });

  /* ── Retry mechanism ── */
  describe("retry mechanism", () => {
    it("retries on retryable status and succeeds on 3rd attempt", async () => {
      const client = makeClient({
        maxRetries: 2,
        initialDelayMs: 5,
        backoffMultiplier: 2,
        maxDelayMs: 50,
        timeoutMs: 5000,
        retryableStatuses: [503],
      });

      let callCount = 0;
      globalThis.fetch = async (...args) => {
        callCount++;
        mockFetchCalls.push({ url: args[0], options: args[1] });
        if (callCount < 3) {
          return {
            ok: false,
            status: 503,
            statusText: "Service Unavailable",
            headers: { get: () => null },
            text: async () => "temporary error",
          };
        }
        return {
          ok: true,
          status: 200,
          statusText: "OK",
          headers: { get: () => "application/json" },
          json: async () => ({ success: true }),
        };
      };

      const result = await client._request("/retry-test");
      assert.equal(result.success, true);
      assert.equal(callCount, 3);
    });

    it("throws aggregate error after all retries exhausted", async () => {
      const client = makeClient({
        maxRetries: 2,
        initialDelayMs: 5,
        backoffMultiplier: 1,
        maxDelayMs: 50,
        timeoutMs: 5000,
        retryableStatuses: [502, 503],
      });

      setupFetch({ ok: false, status: 502, textBody: "Bad Gateway" });

      await assert.rejects(
        () => client._request("/fail"),
        /Failed after 3 attempts: API 502: Bad Gateway/
      );
    });
  });

  /* ── API methods ── */
  describe("screenplay methods", () => {
    it("getAnalysis calls correct endpoint", async () => {
      const client = makeClient();
      setupFetch({ body: { characters: [], locations: [], props: [] } });
      const result = await client.getAnalysis();
      assert.deepEqual(result, { characters: [], locations: [], props: [] });
      assert.equal(mockFetchCalls[0].url, "http://test.local/api/v1/screenplay/analysis");
    });

    it("getStats calls correct endpoint", async () => {
      const client = makeClient();
      setupFetch({ body: { scene_count: 5, char_count: 100, estimated_segments: 20 } });
      const result = await client.getStats();
      assert.equal(result.scene_count, 5);
      assert.equal(mockFetchCalls[0].url, "http://test.local/api/v1/screenplay/stats");
    });
  });

  describe("style methods", () => {
    it("detectStyle sends POST request", async () => {
      const client = makeClient();
      setupFetch({ body: { detected: true, mode: "AI", settings: {} } });
      const result = await client.detectStyle();
      assert.equal(result.detected, true);
      assert.equal(mockFetchCalls[0].options.method, "POST");
    });

    it("getStyle returns current settings", async () => {
      const client = makeClient();
      setupFetch({ body: { visual_style: "dark", camera_language: "cinematic" } });
      const result = await client.getStyle();
      assert.equal(result.visual_style, "dark");
    });
  });

  describe("generation methods", () => {
    it("generate uses default scope", async () => {
      const client = makeClient();
      setupFetch({ body: { success: true, model_used: "test-model" } });
      const result = await client.generate();
      assert.equal(result.success, true);
      const body = JSON.parse(mockFetchCalls[0].options.body);
      assert.equal(body.scope, "full_pack");
      assert.equal(body.force_ultra, false);
    });

    it("generate passes ultra flag", async () => {
      const client = makeClient();
      setupFetch({ body: { success: true } });
      await client.generate("full_pack", true);
      const body = JSON.parse(mockFetchCalls[0].options.body);
      assert.equal(body.force_ultra, true);
    });
  });

  describe("validation methods", () => {
    it("validate sends markdown text", async () => {
      const client = makeClient();
      setupFetch({ body: { issues: [], summary: { critical: 0, warning: 0, info: 0 } } });
      const result = await client.validate("test markdown");
      assert.deepEqual(result.summary, { critical: 0, warning: 0, info: 0 });
      const body = JSON.parse(mockFetchCalls[0].options.body);
      assert.equal(body.markdown_text, "test markdown");
    });
  });

  describe("export", () => {
    it("getExportUrl produces correct URL", () => {
      const client = makeClient();
      const url = client.getExportUrl("markdown");
      assert.equal(url, "http://test.local/api/v1/export/markdown");
    });
  });

  describe("repair methods", () => {
    it("generateRepair sends all parameters correctly", async () => {
      const client = makeClient();
      setupFetch({ body: { repair: { flow_agent_prompt: "fix..." } } });
      const result = await client.generateRepair("color_error", "SCENE_01A", "seg1", "bad color");
      assert.ok(result.repair);
      const body = JSON.parse(mockFetchCalls[0].options.body);
      assert.equal(body.error_type, "color_error");
      assert.equal(body.scene_id, "SCENE_01A");
      assert.equal(body.segment_id, "seg1");
      assert.equal(body.problem_description, "bad color");
    });
  });

  /* ── ping ── */
  describe("ping", () => {
    it("returns reachable true when backend responds", async () => {
      const client = makeClient();
      setupFetch({ body: { has_api_key: true, fast_model: "test" } });
      const result = await client.ping();
      assert.equal(result.reachable, true);
    });

    it("returns reachable false when backend is down", async () => {
      // Simulate connection refused
      const client = makeClient();
      globalThis.fetch = async () => {
        throw new Error("ECONNREFUSED");
      };
      const result = await client.ping();
      assert.equal(result.reachable, false);
      assert.ok(result.error);
    });
  });

  /* ── estimate ── */
  describe("estimate", () => {
    it("estimates shots from a screenplay file", async () => {
      const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fps-test-"));
      const tmpFile = path.join(tmpDir, "script.txt");
      // File with scene markers
      const content = "SCENE 1\nContent here\nSCENE 2\nMore content\nSCENE: 3\nEven more";
      fs.writeFileSync(tmpFile, content, "utf-8");

      try {
        const client = makeClient();
        const est = await client.estimate(tmpFile);
        assert.equal(est.filename, "script.txt");
        assert.ok(est.fileSizeKb >= 0);
        assert.ok(est.estimatedScenes >= 1);
        assert.ok(est.estimatedShots >= 1);
        assert.ok(est.estimatedDurationMinutes >= 0);
      } finally {
        fs.rmSync(tmpDir, { recursive: true, force: true });
      }
    });

    it("throws for missing file", async () => {
      const client = makeClient();
      await assert.rejects(
        () => client.estimate("/nonexistent/file.pdf"),
        /File not found/
      );
    });
  });

  /* ── cache ── */
  describe("cache", () => {
    it("caches GET responses and returns cached data on second call", async () => {
      const client = makeClient();
      setupFetch({ body: { cached: true } });

      // First call — should hit fetch
      await client._request("/cache-test");
      assert.equal(mockFetchCalls.length, 1);

      // Second call — should return from cache (same URL, GET)
      await client._request("/cache-test");
      assert.equal(mockFetchCalls.length, 1, "second call should use cache, not fetch again");

      // After clearing cache, should fetch again
      client.clearCache();
      await client._request("/cache-test");
      assert.equal(mockFetchCalls.length, 2, "after clearing cache, should fetch again");
    });
  });
});
