/**
 * Flow Prompt Studio — Ana modül birim testleri
 *
 * Çalıştırma: node --test tests/index.test.js
 */

const { describe, it, beforeEach, after, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");

// Mock fetch
let originalFetch;

function mockFetch(response) {
  return async (...args) => {
    return {
      ok: response.ok ?? true,
      status: response.status ?? 200,
      statusText: "OK",
      headers: {
        get: (name) => {
          if (name === "content-type") return "application/json";
          if (name === "retry-after") return null;
          return null;
        },
      },
      json: async () => response.body ?? {},
      text: async () => JSON.stringify(response.body ?? {}),
      blob: async () => new Blob([]),
    };
  };
}

function setupFetch(response) {
  originalFetch = globalThis.fetch;
  globalThis.fetch = mockFetch(response);
}

function restoreFetch() {
  if (originalFetch) {
    globalThis.fetch = originalFetch;
    originalFetch = null;
  }
}

describe("FlowPromptStudio", () => {
  let FlowPromptStudio;

  beforeEach(() => {
    delete require.cache[require.resolve("../src/index")];
    delete require.cache[require.resolve("../src/client")];
    FlowPromptStudio = require("../src/index").FlowPromptStudio;
  });

  after(() => {
    restoreFetch();
  });

  afterEach(() => {
    restoreFetch();
  });

  it("version string döner", () => {
    const fps = new FlowPromptStudio("http://test.local/api/v1");
    assert.equal(fps.version, "1.0.1");
  });

  it("client özelliği FlowPromptStudioClient instance'ıdır", () => {
    const fps = new FlowPromptStudio("http://test.local/api/v1");
    assert.ok(fps.client);
    assert.equal(fps.client.baseUrl, "http://test.local/api/v1");
  });

  it("varsayılan baseUrl kullanır", () => {
    const fps = new FlowPromptStudio();
    assert.ok(fps.client.baseUrl.includes("/api/v1"));
  });

  it("getExportUrl client'a delege eder", async () => {
    const fps = new FlowPromptStudio("http://test.local/api/v1");
    const url = await fps.getExportUrl("markdown");
    assert.ok(url.includes("/export/markdown"));
  });

  it("workflow tüm adımları sırayla çağırır (generate olmadan)", async () => {
    // Test için geçici dosya oluştur
    const tmpDir = fs.mkdtempSync(path.join(require("os").tmpdir(), "fps-test-"));
    const tmpFile = path.join(tmpDir, "test-script.txt");
    fs.writeFileSync(tmpFile, "SAHNE 1\nAli yürüdü.", "utf-8");

    // Retry'siz client için env ayarla
    setupFetch({
      body: {
        success: true,
        filename: "test-script.txt",
        scene_count: 1,
        char_count: 10,
        scenes: [{ scene_id: "SCENE_01" }],
        characters: [{ name: "Ali", count: 1 }],
        locations: [{ name: "Sokak", count: 1, source: "script" }],
        props: [],
        detected: true,
        mode: "AI",
        settings: {},
        shot_rows: [{ "Shot Türü": "Wide" }],
        asset_plan: { collections: [] },
        repair_markdown: "",
        model_used: "test",
        issues: [],
        summary: { critical: 0, warning: 0, info: 0 },
      },
    });

    try {
      const fps = new FlowPromptStudio("http://test.local/api/v1");
      const result = await fps.workflow(tmpFile, { generate: false });

      assert.ok(result.upload);
      assert.ok(result.analysis);
      assert.ok(result.style);
      assert.ok(result.bundle);
      assert.ok(result.validation);
      assert.ok(result.exports);
      assert.equal(result.generate, undefined);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
