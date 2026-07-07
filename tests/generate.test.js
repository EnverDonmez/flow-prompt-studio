/**
 * Flow Prompt Studio — AI Generate Module Tests
 */

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { AIPromptGenerator, PROVIDERS, PROMPTS } = require("../src/generate");
const { ScreenplayParser } = require("../src/parser");
const { CoverageGenerator } = require("../src/coverage");

let originalFetch;

function setupFetch(responseFactory) {
  originalFetch = globalThis.fetch;
  globalThis.fetch = responseFactory;
}

function restoreFetch() {
  if (originalFetch) {
    globalThis.fetch = originalFetch;
    originalFetch = null;
  }
}

describe("AIPromptGenerator", () => {
  const parseResult = ScreenplayParser.parseText(
    "SCENE 1\nINT. ROOM - DAY\nJOHN\nHello world.\nMARY\nHi John.",
    "test.txt"
  );
  const coverageResult = CoverageGenerator.generate(parseResult, "drama");

  afterEach(() => {
    restoreFetch();
    delete process.env.DEEPSEEK_API_KEY;
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
  });

  /* ── Constructor ── */
  describe("constructor", () => {
    it("creates with valid provider", () => {
      const gen = new AIPromptGenerator({ provider: "deepseek", apiKey: "sk-test1234" });
      assert.equal(gen.provider, "deepseek");
      assert.equal(gen.apiKey, "sk-t...1234"); // sanitized
    });

    it("throws for unknown provider", () => {
      assert.throws(
        () => new AIPromptGenerator({ provider: "google", apiKey: "x" }),
        /Unknown provider/
      );
    });

    it("defaults to deepseek", () => {
      const gen = new AIPromptGenerator({ apiKey: "sk-test" });
      assert.equal(gen.provider, "deepseek");
    });

    it("sanitizes API key for safe display", () => {
      const gen = new AIPromptGenerator({ provider: "openai", apiKey: "sk-1234567890abcdef" });
      assert.ok(gen.apiKey.includes("..."));
      assert.ok(!gen.apiKey.includes("1234567890abcdef"));
    });

    it("handles short keys", () => {
      const gen = new AIPromptGenerator({ apiKey: "short" });
      assert.equal(gen.apiKey, "***");
    });

    it("handles empty key", () => {
      const gen = new AIPromptGenerator({ apiKey: "" });
      assert.equal(gen.apiKey, "");
    });
  });

  /* ── resolveApiKey ── */
  describe("resolveApiKey", () => {
    it("reads from environment variable", () => {
      process.env.DEEPSEEK_API_KEY = "sk-env-test";
      const key = AIPromptGenerator.resolveApiKey("deepseek");
      assert.equal(key, "sk-env-test");
    });

    it("returns null when not configured", () => {
      const key = AIPromptGenerator.resolveApiKey("openai");
      assert.equal(key, null);
    });

    it("returns null for unknown provider", () => {
      assert.equal(AIPromptGenerator.resolveApiKey("unknown"), null);
    });
  });

  /* ── getProvidersStatus ── */
  describe("getProvidersStatus", () => {
    it("returns all 3 providers", () => {
      const status = AIPromptGenerator.getProvidersStatus();
      assert.equal(status.length, 3);
      assert.ok(status.find((s) => s.key === "deepseek"));
      assert.ok(status.find((s) => s.key === "openai"));
      assert.ok(status.find((s) => s.key === "anthropic"));
    });

    it("reports correct configured status", () => {
      process.env.DEEPSEEK_API_KEY = "sk-test";
      const status = AIPromptGenerator.getProvidersStatus();
      const ds = status.find((s) => s.key === "deepseek");
      assert.equal(ds.configured, true);
      const oa = status.find((s) => s.key === "openai");
      assert.equal(oa.configured, false);
    });
  });

  /* ── generate (without real API) ── */
  describe("generate", () => {
    it("throws when no API key configured", async () => {
      const gen = new AIPromptGenerator({ provider: "deepseek", apiKey: "" });
      await assert.rejects(
        () => gen.generate(parseResult, coverageResult, "full_pack"),
        /No API key/
      );
    });

    it("throws for unknown scope", async () => {
      process.env.DEEPSEEK_API_KEY = "sk-fake";
      const gen = new AIPromptGenerator({ provider: "deepseek", apiKey: "sk-fake" });
      await assert.rejects(
        () => gen.generate(parseResult, coverageResult, "invalid_scope"),
        /Unknown scope/
      );
    });

    it("builds correct request for deepseek", async () => {
      process.env.DEEPSEEK_API_KEY = "sk-real";
      let capturedBody = null;

      setupFetch(async (url, init) => {
        capturedBody = JSON.parse(init.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({ choices: [{ message: { content: "# Generated Prompt\n\nTest output." } }] }),
        };
      });

      const gen = new AIPromptGenerator({ provider: "deepseek", apiKey: "sk-real" });
      const result = await gen.generate(parseResult, coverageResult, "full_pack");

      assert.equal(result.success, true);
      assert.equal(result.markdown, "# Generated Prompt\n\nTest output.");
      assert.equal(result.provider, "deepseek");
      assert.equal(result.scope, "full_pack");
      assert.ok(capturedBody.messages.length === 2);
      assert.equal(capturedBody.messages[0].role, "system");
      assert.equal(capturedBody.messages[1].role, "user");
      assert.ok(capturedBody.messages[1].content.includes("SCENE 1"));
      assert.ok(capturedBody.messages[1].content.includes("JOHN"));
      assert.ok(capturedBody.messages[1].content.includes("MARY"));
    });

    it("handles 401 authentication error", async () => {
      process.env.OPENAI_API_KEY = "sk-bad";
      setupFetch(async () => ({
        ok: false,
        status: 401,
        text: async () => "Unauthorized",
      }));

      const gen = new AIPromptGenerator({ provider: "openai", apiKey: "sk-bad" });
      await assert.rejects(
        () => gen.generate(parseResult, null, "scene_breakdown"),
        /authentication failed/
      );
    });

    it("handles 429 rate limit error", async () => {
      process.env.DEEPSEEK_API_KEY = "sk-ok";
      setupFetch(async () => ({
        ok: false,
        status: 429,
        text: async () => "Rate limited",
      }));

      const gen = new AIPromptGenerator({ provider: "deepseek", apiKey: "sk-ok" });
      await assert.rejects(
        () => gen.generate(parseResult, null, "full_pack"),
        /rate limit/
      );
    });

    it("supports anthropic provider format", async () => {
      process.env.ANTHROPIC_API_KEY = "sk-ant-test";
      let capturedBody = null;

      setupFetch(async (url, init) => {
        capturedBody = JSON.parse(init.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({ content: [{ text: "Claude output" }] }),
        };
      });

      const gen = new AIPromptGenerator({ provider: "anthropic", apiKey: "sk-ant-test" });
      const result = await gen.generate(parseResult, null, "character_bible");

      assert.equal(result.success, true);
      assert.equal(result.markdown, "Claude output");
      // Anthropic uses x-api-key header, not Authorization
      assert.ok(capturedBody.system, "Anthropic should have system field");
      assert.equal(capturedBody.messages[0].role, "user");
    });

    it("all prompts include screenplay context", () => {
      Object.entries(PROMPTS).forEach(([scope, prompt]) => {
        const userContent = prompt.buildUser(parseResult, coverageResult, {});
        assert.ok(userContent.length > 50, `${scope} prompt should have content`);
        assert.ok(
          userContent.includes("SCENE") || userContent.includes("JOHN") || userContent.includes("MARY"),
          `${scope} should reference screenplay data`
        );
      });
    });
  });

  /* ── Prompt template coverage ── */
  describe("PROMPTS", () => {
    it("all scopes have system and buildUser", () => {
      ["full_pack", "scene_breakdown", "character_bible", "ultra_image_variation"].forEach((scope) => {
        const p = PROMPTS[scope];
        assert.ok(p.system, `${scope} should have system prompt`);
        assert.equal(typeof p.buildUser, "function", `${scope} should have buildUser function`);
      });
    });

    it("full_pack has 13 sections", () => {
      const userContent = PROMPTS.full_pack.buildUser(parseResult, coverageResult, {});
      for (let i = 1; i <= 13; i++) {
        assert.ok(
          userContent.includes(`### ${i}.`),
          `full_pack should have section ${i}`
        );
      }
    });

    it("ultra mode affects prompt content", () => {
      const normal = PROMPTS.full_pack.buildUser(parseResult, coverageResult, { ultra: false });
      const ultra = PROMPTS.full_pack.buildUser(parseResult, coverageResult, { ultra: true });
      assert.ok(ultra.includes("ULTRA MODE"), "ultra should include ULTRA MODE text");
      assert.ok(ultra !== normal, "ultra and normal prompts should differ");
    });
  });

  /* ── PROVIDERS config ── */
  describe("PROVIDERS", () => {
    it("all providers have required fields", () => {
      Object.entries(PROVIDERS).forEach(([key, p]) => {
        assert.ok(p.name, `${key}: name`);
        assert.ok(p.endpoint, `${key}: endpoint`);
        assert.ok(p.model, `${key}: model`);
        assert.equal(typeof p.headers, "function", `${key}: headers fn`);
        assert.equal(typeof p.buildBody, "function", `${key}: buildBody fn`);
        assert.equal(typeof p.parseResponse, "function", `${key}: parseResponse fn`);
      });
    });

    it("deepseek and openai use Authorization header", () => {
      ["deepseek", "openai"].forEach((k) => {
        const headers = PROVIDERS[k].headers("sk-test");
        assert.ok(headers.Authorization === "Bearer sk-test");
      });
    });

    it("anthropic uses x-api-key header", () => {
      const headers = PROVIDERS.anthropic.headers("sk-ant-test");
      assert.equal(headers["x-api-key"], "sk-ant-test");
    });
  });
});
