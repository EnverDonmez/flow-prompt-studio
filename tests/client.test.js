/**
 * Flow Prompt Studio — Client birim testleri
 *
 * Çalıştırma: node --test tests/client.test.js
 */

const { describe, it, after, afterEach } = require("node:test");
const assert = require("node:assert/strict");

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
  mockFetchCalls.length = 0; // önceki test kalıntılarını temizle
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
    it("başarılı JSON yanıtı parse eder", async () => {
      const client = makeClient();
      setupFetch({ body: { success: true, data: "test" } });
      const result = await client._request("/test");
      assert.equal(result.success, true);
      assert.equal(result.data, "test");
    });

    it("başarılı text yanıtı döner", async () => {
      const client = makeClient();
      setupFetch({ contentType: "text/plain", body: null, textBody: "merhaba" });
      const result = await client._request("/test");
      assert.equal(result, "merhaba");
    });

    it("HTTP hatasını throw eder", async () => {
      const client = makeClient();
      setupFetch({ ok: false, status: 500, textBody: "Sunucu hatası" });
      await assert.rejects(
        () => client._request("/test"),
        /API 500: Sunucu hatası/
      );
    });

    it("404 hatası doğru mesajla throw eder", async () => {
      const client = makeClient();
      setupFetch({ ok: false, status: 404, textBody: "Bulunamadı" });
      await assert.rejects(
        () => client._request("/test"),
        /API 404: Bulunamadı/
      );
    });
  });

  /* ── Retry ── */
  describe("retry mekanizması", () => {
    it("retryable statüde tekrar dener ve başarılı olur", async () => {
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
            text: async () => "geçici hata",
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

    it("tüm denemeler tükenince en son hatayı throw eder", async () => {
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
        /deneme sonrası başarısız: API 502: Bad Gateway/
      );
    });
  });

  /* ── API metodları ── */
  describe("screenplay metodları", () => {
    it("getAnalysis doğru endpoint'e istek atar", async () => {
      const client = makeClient();
      setupFetch({ body: { characters: [], locations: [], props: [] } });
      const result = await client.getAnalysis();
      assert.deepEqual(result, { characters: [], locations: [], props: [] });
      assert.equal(mockFetchCalls[0].url, "http://test.local/api/v1/screenplay/analysis");
    });

    it("getStats doğru endpoint'e istek atar", async () => {
      const client = makeClient();
      setupFetch({ body: { scene_count: 5, char_count: 100, estimated_segments: 20 } });
      const result = await client.getStats();
      assert.equal(result.scene_count, 5);
      assert.equal(mockFetchCalls[0].url, "http://test.local/api/v1/screenplay/stats");
    });
  });

  describe("style metodları", () => {
    it("detectStyle POST isteği atar", async () => {
      const client = makeClient();
      setupFetch({ body: { detected: true, mode: "AI", settings: {} } });
      const result = await client.detectStyle();
      assert.equal(result.detected, true);
      assert.equal(mockFetchCalls[0].options.method, "POST");
    });

    it("getStyle mevcut ayarları döner", async () => {
      const client = makeClient();
      setupFetch({ body: { visual_style: "dark", camera_language: "cinematic" } });
      const result = await client.getStyle();
      assert.equal(result.visual_style, "dark");
    });
  });

  describe("generation metodları", () => {
    it("generate varsayılan scope ile çalışır", async () => {
      const client = makeClient();
      setupFetch({ body: { success: true, model_used: "test-model" } });
      const result = await client.generate();
      assert.equal(result.success, true);
      const body = JSON.parse(mockFetchCalls[0].options.body);
      assert.equal(body.scope, "full_pack");
      assert.equal(body.force_ultra, false);
    });

    it("generate ultra modda çalışır", async () => {
      const client = makeClient();
      setupFetch({ body: { success: true } });
      await client.generate("full_pack", true);
      const body = JSON.parse(mockFetchCalls[0].options.body);
      assert.equal(body.force_ultra, true);
    });
  });

  describe("validation metodları", () => {
    it("validate markdown metni gönderir", async () => {
      const client = makeClient();
      setupFetch({ body: { issues: [], summary: { critical: 0, warning: 0, info: 0 } } });
      const result = await client.validate("test markdown");
      assert.deepEqual(result.summary, { critical: 0, warning: 0, info: 0 });
      const body = JSON.parse(mockFetchCalls[0].options.body);
      assert.equal(body.markdown_text, "test markdown");
    });
  });

  describe("export", () => {
    it("getExportUrl doğru URL üretir", () => {
      const client = makeClient();
      const url = client.getExportUrl("markdown");
      assert.equal(url, "http://test.local/api/v1/export/markdown");
    });
  });

  describe("repair metodları", () => {
    it("generateRepair parametreleri doğru gönderir", async () => {
      const client = makeClient();
      setupFetch({ body: { repair: { flow_agent_prompt: "fix..." } } });
      const result = await client.generateRepair("color_error", "SCENE_01A", "seg1", "renk bozuk");
      assert.ok(result.repair);
      const body = JSON.parse(mockFetchCalls[0].options.body);
      assert.equal(body.error_type, "color_error");
      assert.equal(body.scene_id, "SCENE_01A");
      assert.equal(body.segment_id, "seg1");
      assert.equal(body.problem_description, "renk bozuk");
    });
  });
});
