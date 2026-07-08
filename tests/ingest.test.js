/**
 * Flow Prompt Studio — Ingest Helper Tests
 */

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { IngestHelper } = require("../src/ingest");
const { FlowPromptStudio, fps } = require("../src/index");

describe("IngestHelper", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fps-ingest-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("normalizes text sources and writes parse artifacts", () => {
    const source = path.join(tmpDir, "vision.txt");
    fs.writeFileSync(source, "SCENE 1\nDENIZ\nHello.\n", "utf-8");

    const result = IngestHelper.ingest(source, path.join(tmpDir, "out"), {
      title: "Vision Source",
    });

    assert.equal(result.manual, false);
    assert.ok(fs.existsSync(result.normalizedPath));
    assert.ok(fs.existsSync(path.join(result.outputDir, "ingest-report.md")));
    assert.ok(fs.existsSync(path.join(result.outputDir, "parse-result.json")));
    assert.equal(result.parseResult.stats.totalScenes, 1);
  });

  it("writes manual PDF instructions when pdftotext is unavailable", () => {
    const source = path.join(tmpDir, "script.pdf");
    fs.writeFileSync(source, "%PDF-1.4 fake", "utf-8");

    const result = IngestHelper.ingest(source, path.join(tmpDir, "out"), {
      title: "PDF Source",
      pdftotextPath: "",
    });

    assert.equal(result.manual, true);
    assert.equal(result.parseResult, null);
    assert.ok(fs.existsSync(path.join(result.outputDir, "PDF_INGEST_INSTRUCTIONS.md")));
  });

  it("is available through class and convenience APIs", () => {
    const source = path.join(tmpDir, "api.txt");
    fs.writeFileSync(source, "SCENE 1\nA room.", "utf-8");
    const studio = new FlowPromptStudio();

    const fromClass = studio.ingest(source, path.join(tmpDir, "class-out"));
    const fromConvenience = fps.ingest(source, path.join(tmpDir, "fps-out"));

    assert.equal(fromClass.parseResult.stats.totalScenes, 1);
    assert.equal(fromConvenience.parseResult.stats.totalScenes, 1);
  });
});
