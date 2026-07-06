/**
 * Flow Prompt Studio — Main module unit tests
 *
 * Usage: node --test tests/index.test.js
 */

const { describe, it, beforeEach, after, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");

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

  it("returns version", () => {
    const fps = new FlowPromptStudio("http://test.local/api/v1");
    assert.equal(fps.version, "1.1.0");
  });

  it("client property is a FlowPromptStudioClient instance", () => {
    const fps = new FlowPromptStudio("http://test.local/api/v1");
    assert.ok(fps.client);
    assert.equal(fps.client.baseUrl, "http://test.local/api/v1");
  });

  it("uses default baseUrl when none provided", () => {
    const fps = new FlowPromptStudio();
    assert.ok(fps.client.baseUrl.includes("/api/v1"));
  });

  it("getExportUrl delegates to client", async () => {
    const fps = new FlowPromptStudio("http://test.local/api/v1");
    const url = await fps.getExportUrl("markdown");
    assert.ok(url.includes("/export/markdown"));
  });

  it("workflow runs all steps in order (without generate)", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fps-test-"));
    const tmpFile = path.join(tmpDir, "test-script.txt");
    fs.writeFileSync(tmpFile, "SCENE 1\nAli walked.", "utf-8");

    setupFetch({
      body: {
        success: true,
        filename: "test-script.txt",
        scene_count: 1,
        char_count: 10,
        scenes: [{ scene_id: "SCENE_01" }],
        characters: [{ name: "Ali", count: 1 }],
        locations: [{ name: "Street", count: 1, source: "script" }],
        props: [],
        detected: true,
        mode: "AI",
        settings: {},
        shot_rows: [{ "Shot Type": "Wide" }],
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
      assert.equal(result.upload.scene_count, 1);
      assert.ok(result.analysis);
      assert.equal(result.analysis.characters[0].name, "Ali");
      assert.ok(result.style);
      assert.ok(result.bundle);
      assert.ok(result.validation);
      assert.ok(result.exports);
      assert.equal(result.generate, undefined);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("ping checks backend reachability", async () => {
    setupFetch({ body: { has_api_key: true, fast_model: "test" } });
    const fps = new FlowPromptStudio("http://test.local/api/v1");
    const result = await fps.ping();
    assert.equal(result.reachable, true);
  });

  it("estimate analyzes a local screenplay", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fps-test-"));
    const tmpFile = path.join(tmpDir, "script.txt");
    fs.writeFileSync(tmpFile, "SCENE 1\nContent\nSCENE 2\nMore", "utf-8");

    try {
      const fps = new FlowPromptStudio("http://test.local/api/v1");
      const est = await fps.estimate(tmpFile);
      assert.ok(est.estimatedScenes >= 1);
      assert.ok(est.estimatedShots >= 1);
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });

  it("workflow with onProgress callback fires progress events", async () => {
    const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fps-test-"));
    const tmpFile = path.join(tmpDir, "script.txt");
    fs.writeFileSync(tmpFile, "SCENE 1\nTest", "utf-8");

    const progressCalls = [];
    setupFetch({
      body: {
        success: true,
        filename: "script.txt",
        scene_count: 1,
        char_count: 5,
        scenes: [{ scene_id: "SCENE_01" }],
        characters: [],
        locations: [],
        props: [],
        detected: false,
        mode: "fallback",
        settings: {},
        shot_rows: [],
        asset_plan: { collections: [] },
        repair_markdown: "",
        issues: [],
        summary: { critical: 0, warning: 0, info: 0 },
      },
    });

    try {
      const fps = new FlowPromptStudio("http://test.local/api/v1");
      await fps.workflow(tmpFile, {
        generate: false,
        onProgress: (step, msg) => progressCalls.push({ step, msg }),
      });

      assert.ok(progressCalls.length >= 6, "should have at least 6 progress calls");
      const steps = progressCalls.map(p => p.step);
      assert.ok(steps.includes("upload"));
      assert.ok(steps.includes("analyze"));
      assert.ok(steps.includes("style"));
      assert.ok(steps.includes("coverage"));
      assert.ok(steps.includes("validate"));
      assert.ok(steps.includes("export"));
      // generate should not be called
      assert.ok(!steps.includes("generate"));
    } finally {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    }
  });
});
