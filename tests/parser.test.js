/**
 * Flow Prompt Studio — Screenplay Parser Tests
 */

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { ScreenplayParser } = require("../src/parser");

describe("ScreenplayParser", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fps-parser-"));
  });

  afterEach(() => {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {
      // Best-effort cleanup for temporary test files.
    }
  });

  /* ── Basic parsing ── */
  describe("parse", () => {
    it("detects SCENE markers", () => {
      const file = path.join(tmpDir, "scenes.txt");
      fs.writeFileSync(file, "SCENE 1\nThe beginning.\nSCENE: 2\nThe middle.\nSCENE 3 - The End\nThe conclusion.", "utf-8");
      const result = ScreenplayParser.parse(file);
      assert.ok(result.scenes.length >= 2, `should detect at least 2 scenes, got ${result.scenes.length}`);
      assert.ok(result.stats.totalScenes >= 2);
    });

    it("detects INT./EXT. markers", () => {
      const file = path.join(tmpDir, "int-ext.txt");
      fs.writeFileSync(file, "INT. COFFEE SHOP - DAY\nPeople sit at tables.\nEXT. STREET - NIGHT\nA car passes.", "utf-8");
      const result = ScreenplayParser.parse(file);
      assert.ok(result.scenes.length >= 2, `should detect INT./EXT. scenes, got ${result.scenes.length}`);
      assert.ok(result.scenes[0].heading.includes("COFFEE SHOP"));
    });

    it("detects Fountain format (# markers)", () => {
      const file = path.join(tmpDir, "fountain.txt");
      fs.writeFileSync(file, "# Act One\n## The Beginning\nSomething happens.\n## The Middle\nMore happens.", "utf-8");
      const result = ScreenplayParser.parse(file);
      assert.ok(result.scenes.length >= 2);
    });

    it("extracts character names (ALL CAPS lines)", () => {
      const file = path.join(tmpDir, "chars.txt");
      fs.writeFileSync(file, "SCENE 1\n\nJOHN\nHello there.\n\nMARY\nHi John!\n\nJOHN\nHow are you?", "utf-8");
      const result = ScreenplayParser.parse(file);
      assert.ok(result.characters.length >= 2);
      const names = result.characters.map(c => c.name);
      assert.ok(names.includes("JOHN"));
      assert.ok(names.includes("MARY"));
      // John should appear twice
      const john = result.characters.find(c => c.name === "JOHN");
      assert.equal(john.count, 2);
    });

    it("counts dialogue lines", () => {
      const file = path.join(tmpDir, "dialogue.txt");
      fs.writeFileSync(file, "SCENE 1\n\nJOHN\nHello there.\nHow have you been?\n\nMARY\nI'm good.\n\nSCENE 2\n\nJOHN\nLet's go.", "utf-8");
      const result = ScreenplayParser.parse(file);
      assert.ok(result.stats.totalDialogueLines >= 3);
    });

    it("handles empty files gracefully", () => {
      const file = path.join(tmpDir, "empty.txt");
      fs.writeFileSync(file, "", "utf-8");
      const result = ScreenplayParser.parse(file);
      assert.equal(result.scenes.length, 0);
      assert.equal(result.stats.totalScenes, 0);
    });

    it("provides statistics", () => {
      const file = path.join(tmpDir, "stats.txt");
      fs.writeFileSync(file, "SCENE 1\nContent here\nSCENE 2\nMore content\nSCENE 3\nFinal scene\n\nJOHN\nDialogue line.\n", "utf-8");
      const result = ScreenplayParser.parse(file);
      assert.equal(typeof result.stats.filename, "string");
      assert.ok(result.stats.totalLines > 0);
      assert.ok(result.stats.estimatedPages >= 0);
      assert.ok(result.stats.estimatedDurationMinutes >= 0);
    });

    it("handles .fdx files (Final Draft XML)", () => {
      const file = path.join(tmpDir, "script.fdx");
      fs.writeFileSync(file, `<?xml version="1.0"?>
<FinalDraft>
  <Content>
    <Paragraph Type="Scene Heading"><Text>INT. ROOM - DAY</Text></Paragraph>
    <Paragraph Type="Character"><Text>JOHN</Text></Paragraph>
    <Paragraph Type="Dialogue"><Text>Hello world.</Text></Paragraph>
    <Paragraph Type="Scene Heading"><Text>EXT. PARK - NIGHT</Text></Paragraph>
  </Content>
</FinalDraft>`, "utf-8");
      const result = ScreenplayParser.parse(file);
      assert.ok(result.scenes.length >= 1);
      // Should have extracted character from FDX format
      assert.ok(result.stats.totalScenes >= 1);
    });

    it("skips transitions (CUT TO:, FADE IN:, etc.)", () => {
      const file = path.join(tmpDir, "transitions.txt");
      fs.writeFileSync(file, "SCENE 1\n\nJOHN\nHello.\n\nCUT TO:\n\nSCENE 2\n\nFADE OUT.", "utf-8");
      const result = ScreenplayParser.parse(file);
      // Should not have transition as character
      const names = result.characters.map(c => c.name);
      assert.ok(!names.includes("CUT TO"));
      assert.ok(!names.includes("FADE OUT"));
    });

    it("detects Turkish/American scene markers", () => {
      const file = path.join(tmpDir, "mixed.txt");
      fs.writeFileSync(file, "SCENE 1\nStart.\nSCÈNE 2\nFrench.\nSCENA 3\nItalian.\nSZENE 4\nGerman.\nCHAPTER 5\nEnglish.", "utf-8");
      const result = ScreenplayParser.parse(file);
      assert.ok(result.scenes.length >= 5, `got ${result.scenes.length}`);
    });
  });

  /* ── parseText ── */
  describe("parseText", () => {
    it("parses text string directly", () => {
      const result = ScreenplayParser.parseText("SCENE 1\nTest content\nSCENE 2\nMore", "test");
      assert.equal(result.stats.filename, "test");
      assert.equal(result.scenes.length, 2);
    });

    it("parses inline screenplay", () => {
      const text = "INT. HOUSE - DAY\n\nJOHN\nWhere are you?\n\nMARY\nOver here!";
      const result = ScreenplayParser.parseText(text, "inline");
      assert.ok(result.stats.totalScenes >= 1);
      assert.ok(result.characters.length >= 1);
    });
  });

  /* ── Error handling ── */
  describe("errors", () => {
    it("throws for missing file", () => {
      assert.throws(
        () => ScreenplayParser.parse("/nonexistent/path/file.txt"),
        /File not found/
      );
    });

    it("handles binary files gracefully", () => {
      const file = path.join(tmpDir, "binary.bin");
      fs.writeFileSync(file, Buffer.from([0x00, 0x01, 0x02, 0xFF, 0xFE]));
      // Should not throw — just parse whatever it can
      const result = ScreenplayParser.parse(file);
      assert.ok(result.stats.totalScenes >= 0);
    });

    it("handles very long lines", () => {
      const file = path.join(tmpDir, "long.txt");
      const longLine = "A".repeat(10000) + "\nSCENE 1\nNormal content.\n";
      fs.writeFileSync(file, longLine, "utf-8");
      const result = ScreenplayParser.parse(file);
      assert.ok(result.scenes.length >= 1);
    });

    it("handles special characters in character names", () => {
      const file = path.join(tmpDir, "special.txt");
      fs.writeFileSync(file, "SCENE 1\n\nJOHN-O'BRIEN\nHello.\n\nDR. SMITH (V.O.)\nNarration.", "utf-8");
      const result = ScreenplayParser.parse(file);
      const names = result.characters.map(c => c.name);
      // Should handle hyphen and apostrophe
      assert.ok(names.some(n => n.includes("JOHN")));
    });
  });
});
