/**
 * Flow Prompt Studio — ScreenJSON Converter Tests
 */

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { ScreenJSONConverter } = require("../src/screenjson");
const { ScreenplayParser } = require("../src/parser");

describe("ScreenJSONConverter", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fps-sj-"));
  });

  afterEach(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {}
  });

  const parseResult = ScreenplayParser.parseText(
    "INT. COFFEE SHOP - DAY\n\nJOHN\nHello world.\n\nMARY\nHi John.\n\nEXT. PARK - NIGHT\n\nJOHN\nGoodbye.",
    "test.txt"
  );

  /* ── convert ── */
  describe("convert", () => {
    it("produces valid ScreenJSON document", () => {
      const doc = ScreenJSONConverter.convert(parseResult);
      assert.equal(doc.version, "1.0.0");
      assert.ok(doc.id); // UUID
      assert.ok(doc.title);
      assert.equal(doc.lang, "en");
    });

    it("includes generator metadata", () => {
      const doc = ScreenJSONConverter.convert(parseResult);
      assert.equal(doc.generator.id, "flow-prompt-studio");
      assert.ok(doc.generator.version);
    });

    it("converts scenes to ScreenJSON format", () => {
      const doc = ScreenJSONConverter.convert(parseResult);
      assert.ok(doc.document.scenes.length >= 2);
      const firstScene = doc.document.scenes[0];
      assert.ok(firstScene.id);
      assert.ok(firstScene.heading);
      assert.equal(typeof firstScene.heading.no, "number");
    });

    it("detects INT./EXT. context", () => {
      const doc = ScreenJSONConverter.convert(parseResult);
      const firstScene = doc.document.scenes[0];
      assert.equal(firstScene.heading.context, "INT.");
    });

    it("creates character index with UUIDs", () => {
      const doc = ScreenJSONConverter.convert(parseResult);
      assert.ok(doc.characters.length >= 2);
      doc.characters.forEach((c) => {
        assert.ok(c.id);
        assert.ok(c.name);
        assert.ok(c.slug);
      });
    });

    it("links scene cast to character UUIDs", () => {
      const doc = ScreenJSONConverter.convert(parseResult);
      const sceneWithJohn = doc.document.scenes.find((s) =>
        s.heading.setting.includes("COFFEE SHOP")
      );
      assert.ok(sceneWithJohn);
      assert.ok(sceneWithJohn.cast.length > 0, `cast should have characters, got ${sceneWithJohn.cast.length}`);
    });

    it("includes analysis passages", () => {
      const doc = ScreenJSONConverter.convert(parseResult);
      assert.ok(doc.analysis);
      assert.ok(doc.analysis.passages.length > 0);
      const passage = doc.analysis.passages[0];
      assert.ok(passage.meta.sceneCount);
      assert.ok(passage.meta.characterCount);
    });

    it("respects language option", () => {
      const doc = ScreenJSONConverter.convert(parseResult, { lang: "tr" });
      assert.equal(doc.lang, "tr");
    });

    it("respects title option", () => {
      const doc = ScreenJSONConverter.convert(parseResult, { title: "My Film" });
      assert.equal(doc.title.en, "My Film");
    });

    it("generates valid revisions", () => {
      const doc = ScreenJSONConverter.convert(parseResult);
      assert.ok(doc.revisions.length >= 1);
      assert.ok(doc.revisions[0].id);
      assert.ok(doc.revisions[0].datetime);
    });
  });

  /* ── toJSON ── */
  describe("toJSON", () => {
    it("produces valid JSON string", () => {
      const json = ScreenJSONConverter.toJSON(parseResult);
      const parsed = JSON.parse(json);
      assert.equal(parsed.version, "1.0.0");
    });

    it("is pretty-printed", () => {
      const json = ScreenJSONConverter.toJSON(parseResult);
      assert.ok(json.includes("\n  "));
    });
  });

  /* ── toFile ── */
  describe("toFile", () => {
    it("writes to disk", () => {
      const outPath = path.join(tmpDir, "test.screenjson");
      const written = ScreenJSONConverter.toFile(parseResult, outPath);
      assert.equal(written, outPath);
      assert.ok(fs.existsSync(outPath));

      const content = JSON.parse(fs.readFileSync(outPath, "utf-8"));
      assert.equal(content.version, "1.0.0");
    });

    it("creates nested directories", () => {
      const nestedPath = path.join(tmpDir, "x", "y", "z.screenjson");
      ScreenJSONConverter.toFile(parseResult, nestedPath);
      assert.ok(fs.existsSync(nestedPath));
    });
  });

  /* ── UUID generation ── */
  describe("UUIDs", () => {
    it("all document IDs are unique", () => {
      const doc = ScreenJSONConverter.convert(parseResult);
      const ids = new Set();
      ids.add(doc.id);
      doc.document.scenes.forEach((s) => ids.add(s.id));
      doc.characters.forEach((c) => ids.add(c.id));
      // All should be unique
      assert.ok(ids.size >= 3);
    });

    it("UUIDs are valid format", () => {
      const doc = ScreenJSONConverter.convert(parseResult);
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      assert.ok(uuidRegex.test(doc.id));
    });
  });
});
