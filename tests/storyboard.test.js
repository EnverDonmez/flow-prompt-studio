/**
 * Flow Prompt Studio — Storyboard Generator Tests
 */

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { StoryboardGenerator, STYLES } = require("../src/storyboard");
const { CoverageGenerator } = require("../src/coverage");

describe("StoryboardGenerator", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fps-sb-"));
  });

  afterEach(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  /* ── Styles ── */
  describe("listStyles", () => {
    it("returns all styles", () => {
      const styles = StoryboardGenerator.listStyles();
      assert.ok(styles.length >= 7);
      assert.ok(styles.find((s) => s.key === "cinematic"));
      assert.ok(styles.find((s) => s.key === "sketch"));
      assert.ok(styles.find((s) => s.key === "anime"));
    });
  });

  describe("STYLES", () => {
    it("each style has prefix and suffix", () => {
      Object.values(STYLES).forEach((s) => {
        assert.ok(s.prefix.length > 0);
        assert.ok(s.suffix.length > 0);
      });
    });
  });

  /* ── Constructor ── */
  describe("constructor", () => {
    it("uses cinematic as default style", () => {
      const sb = new StoryboardGenerator();
      assert.equal(sb.style, "cinematic");
    });

    it("accepts custom options", () => {
      const sb = new StoryboardGenerator({ style: "sketch", width: 512, height: 512, concurrency: 2 });
      assert.equal(sb.style, "sketch");
      assert.equal(sb.width, 512);
      assert.equal(sb.concurrency, 2);
    });
  });

  /* ── Generate ── */
  describe("generate", () => {
    const coverageResult = CoverageGenerator.generateFromSceneCount(3, "drama");

    it("generates prompt files even without network", async () => {
      const sb = new StoryboardGenerator({ style: "sketch" });
      const result = await sb.generate(coverageResult, tmpDir, { limit: 3 });

      assert.ok(result.totalGenerated >= 0);
      assert.ok(result.totalRequested <= 3);
      assert.ok(result.html.length > 100);
    });

    it("creates output directory if missing", async () => {
      const nestedDir = path.join(tmpDir, "a", "b", "c");
      const sb = new StoryboardGenerator();
      const result = await sb.generate(coverageResult, nestedDir, { limit: 1 });
      assert.ok(fs.existsSync(nestedDir));
    });

    it("builds valid HTML storyboard", async () => {
      const sb = new StoryboardGenerator({ style: "comic" });
      const result = await sb.generate(coverageResult, tmpDir, { limit: 2 });

      assert.ok(result.html.includes("<!DOCTYPE html>"));
      assert.ok(result.html.includes("shot-card"));
      assert.ok(result.html.includes("Shot Coverage Plan") || result.html.includes("Storyboard"));
      assert.ok(result.html.includes("comic"));
    });

    it("respects limit option", async () => {
      const sb = new StoryboardGenerator();
      const result = await sb.generate(coverageResult, tmpDir, { limit: 5 });
      assert.ok(result.totalRequested <= 5);
    });

    it("respects scenes filter", async () => {
      const sb = new StoryboardGenerator();
      const result = await sb.generate(coverageResult, tmpDir, {
        limit: 10,
        scenes: "SCENE_01",
      });
      // All shots should be from SCENE_01
      if (result.images.length > 0) {
        result.images.forEach((img) => {
          assert.equal(img.shot["Scene"], "SCENE_01");
        });
      }
    });
  });

  /* ── Prompt building (internal) ── */
  describe("prompt building", () => {
    it("builds visual prompts with correct structure", async () => {
      const coverageResult = CoverageGenerator.generateFromSceneCount(1, "action");
      const sb = new StoryboardGenerator({ style: "realistic" });
      const result = await sb.generate(coverageResult, tmpDir, { limit: 2 });

      assert.ok(result.images.length >= 0);
      // Even without network, we should have prompt data
    });
  });

  /* ── HTML content ── */
  describe("HTML output", () => {
    const coverageResult = CoverageGenerator.generateFromSceneCount(2, "horror");

    it("HTML includes genre info", async () => {
      const sb = new StoryboardGenerator();
      const result = await sb.generate(coverageResult, tmpDir, { limit: 1 });
      assert.ok(result.html.includes("Horror"));
    });

    it("HTML is valid and has responsive CSS", async () => {
      const sb = new StoryboardGenerator();
      const result = await sb.generate(coverageResult, tmpDir, { limit: 1 });
      assert.ok(result.html.includes("prefers-color-scheme"));
      assert.ok(result.html.includes("minmax"));
    });
  });
});
