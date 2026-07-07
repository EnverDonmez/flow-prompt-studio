/**
 * Flow Prompt Studio — AI Generate Module Tests
 */

const { describe, it, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { AIPromptGenerator, PROVIDERS, PROMPTS } = require("../src/generate");
const { ScreenplayParser } = require("../src/parser");
const { CoverageGenerator } = require("../src/coverage");

let originalFetch;

const TEST_ENV_VARS = [
  "DEEPSEEK_API_KEY",
  "OPENAI_API_KEY",
  "ANTHROPIC_API_KEY",
  "GEMINI_API_KEY",
  "GOOGLE_API_KEY",
  "MISTRAL_API_KEY",
  "GROQ_API_KEY",
  "XAI_API_KEY",
  "COHERE_API_KEY",
  "PERPLEXITY_API_KEY",
  "TOGETHER_API_KEY",
  "OPENROUTER_API_KEY",
  "CUSTOM_AI_API_KEY",
  "OPENAI_COMPATIBLE_API_KEY",
  "CUSTOM_AI_BASE_URL",
  "OPENAI_COMPATIBLE_BASE_URL",
  "CUSTOM_AI_MODEL",
  "OPENAI_COMPATIBLE_MODEL",
];

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
    TEST_ENV_VARS.forEach((envVar) => {
      delete process.env[envVar];
    });
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
        () => new AIPromptGenerator({ provider: "notreal", apiKey: "x" }),
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

    it("reads alias environment variables", () => {
      process.env.GOOGLE_API_KEY = "google-env-test";
      const key = AIPromptGenerator.resolveApiKey("gemini");
      assert.equal(key, "google-env-test");
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
    it("returns all providers", () => {
      const status = AIPromptGenerator.getProvidersStatus();
      assert.equal(status.length, Object.keys(PROVIDERS).length);
      ["deepseek", "openai", "anthropic", "gemini", "mistral", "groq", "xai", "cohere", "perplexity", "together", "openrouter", "custom"].forEach((key) => {
        assert.ok(status.find((s) => s.key === key), `${key} should be listed`);
      });
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

    it("uses explicit API key without requiring env vars", async () => {
      let capturedAuth = null;

      setupFetch(async (_url, init) => {
        capturedAuth = init.headers.Authorization;
        return {
          ok: true,
          status: 200,
          json: async () => ({ choices: [{ message: { content: "Explicit key output" } }] }),
        };
      });

      const gen = new AIPromptGenerator({ provider: "openai", apiKey: "sk-explicit" });
      const result = await gen.generate(parseResult, null, "scene_breakdown");

      assert.equal(result.success, true);
      assert.equal(result.markdown, "Explicit key output");
      assert.equal(capturedAuth, "Bearer sk-explicit");
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

    it("supports gemini provider format", async () => {
      process.env.GEMINI_API_KEY = "gemini-test";
      let capturedUrl = null;
      let capturedBody = null;

      setupFetch(async (url, init) => {
        capturedUrl = url;
        capturedBody = JSON.parse(init.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({ candidates: [{ content: { parts: [{ text: "Gemini output" }] } }] }),
        };
      });

      const gen = new AIPromptGenerator({ provider: "gemini", apiKey: "gemini-test", model: "gemini-test-model" });
      const result = await gen.generate(parseResult, null, "character_bible");

      assert.equal(result.success, true);
      assert.equal(result.markdown, "Gemini output");
      assert.ok(capturedUrl.includes("/models/gemini-test-model:generateContent"));
      assert.ok(capturedUrl.includes("key=gemini-test"));
      assert.ok(capturedBody.system_instruction.parts[0].text);
      assert.equal(capturedBody.contents[0].role, "user");
      assert.ok(capturedBody.generationConfig.maxOutputTokens);
    });

    it("supports cohere provider format", async () => {
      process.env.COHERE_API_KEY = "cohere-test";
      let capturedBody = null;
      let capturedAuth = null;

      setupFetch(async (_url, init) => {
        capturedAuth = init.headers.Authorization;
        capturedBody = JSON.parse(init.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({ message: { content: [{ text: "Cohere output" }] } }),
        };
      });

      const gen = new AIPromptGenerator({ provider: "cohere", apiKey: "cohere-test" });
      const result = await gen.generate(parseResult, null, "scene_breakdown");

      assert.equal(result.success, true);
      assert.equal(result.markdown, "Cohere output");
      assert.equal(capturedAuth, "Bearer cohere-test");
      assert.equal(capturedBody.messages[0].role, "system");
      assert.equal(capturedBody.messages[1].role, "user");
    });

    it("supports custom OpenAI-compatible endpoint", async () => {
      let capturedUrl = null;
      let capturedBody = null;

      setupFetch(async (url, init) => {
        capturedUrl = url;
        capturedBody = JSON.parse(init.body);
        return {
          ok: true,
          status: 200,
          json: async () => ({ choices: [{ message: { content: "Custom output" } }] }),
        };
      });

      const gen = new AIPromptGenerator({
        provider: "custom",
        apiKey: "custom-key",
        baseUrl: "http://localhost:1234/v1",
        model: "local-model",
      });
      const result = await gen.generate(parseResult, null, "full_pack");

      assert.equal(result.success, true);
      assert.equal(result.markdown, "Custom output");
      assert.equal(capturedUrl, "http://localhost:1234/v1/chat/completions");
      assert.equal(capturedBody.model, "local-model");
    });

    it("requires base URL for custom provider", async () => {
      const gen = new AIPromptGenerator({ provider: "custom", apiKey: "custom-key" });
      await assert.rejects(
        () => gen.generate(parseResult, null, "full_pack"),
        /No base URL/
      );
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
        assert.ok(p.endpoint || p.requiresBaseUrl, `${key}: endpoint`);
        assert.ok(p.model, `${key}: model`);
        assert.ok(Array.isArray(p.envVars), `${key}: envVars`);
        assert.ok(p.envVars.length > 0, `${key}: envVars length`);
        assert.equal(typeof p.headers, "function", `${key}: headers fn`);
        assert.equal(typeof p.buildBody, "function", `${key}: buildBody fn`);
        assert.equal(typeof p.parseResponse, "function", `${key}: parseResponse fn`);
      });
    });

    it("OpenAI-compatible providers use Authorization header", () => {
      ["deepseek", "openai", "mistral", "groq", "xai", "cohere", "perplexity", "together", "openrouter", "custom"].forEach((k) => {
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
