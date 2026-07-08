/**
 * Flow Prompt Studio — Production Pack Generator Tests
 */

const { describe, it, beforeEach, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { ScreenplayParser } = require("../src/parser");
const { ProductionPackGenerator } = require("../src/productionPack");
const { FlowPromptStudio, fps } = require("../src/index");

describe("ProductionPackGenerator", () => {
  let tmpDir;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fps-pack-"));
  });

  afterEach(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it("creates director-mode shots with valid Veo durations", () => {
    const parseResult = ScreenplayParser.parseText(
      [
        "00:00 - 00:14 | CYBER SECURITY CENTER",
        "A laptop screen shows dashboard graphs while an analyst watches.",
        "ANALYST",
        "This login is unusual.",
      ].join("\n"),
      "cyber.txt"
    );

    const pack = ProductionPackGenerator.create(parseResult, {
      title: "Cyber Test",
      mode: "director",
    });

    assert.equal(pack.title, "Cyber Test");
    assert.equal(pack.mode, "director");
    assert.equal(pack.sceneCount, 1);
    assert.deepEqual(pack.validDurations, [4, 6, 8]);
    assert.ok(pack.shotCount >= 2);
    assert.ok(pack.shots.every((shot) => [4, 6, 8].includes(shot.durationSeconds)));
    assert.ok(pack.shots[0].risks.includes("screen_continuity"));
    assert.ok(pack.shots[0].flowToolAdvice.includes("start/end frames"));
    assert.ok(pack.shots[0].videoPrompt.includes("Preserve the same scene"));
  });

  it("prefers readable 6/8 second duration plans for 34-second scenes", () => {
    assert.deepEqual(ProductionPackGenerator._splitDuration(34), [8, 8, 6, 6, 6]);
  });

  it("exports index, continuity, JSON manifest, and shot markdown files", () => {
    const parseResult = ScreenplayParser.parseText(
      [
        "SCENE 1: MODEST OFFICE - NIGHT",
        "DENIZ",
        "We need to check the screen.",
        "SCENE 2: HOSPITAL - DAY",
        "DOCTOR",
        "The system flagged this patient.",
      ].join("\n"),
      "vision.txt"
    );

    const pack = ProductionPackGenerator.export(parseResult, tmpDir, {
      title: "Vision Pack",
      shotsPerScene: 2,
      defaultDuration: 6,
    });

    assert.equal(pack.shotCount, 4);
    assert.ok(fs.existsSync(path.join(pack.outputDir, "INDEX.md")));
    assert.ok(fs.existsSync(path.join(pack.outputDir, "CONTINUITY.md")));
    assert.ok(fs.existsSync(path.join(pack.outputDir, "production-pack.json")));
    assert.ok(fs.existsSync(path.join(pack.outputDir, "shots", "SHOT_001.md")));

    const shotMd = fs.readFileSync(path.join(pack.outputDir, "shots", "SHOT_001.md"), "utf-8");
    assert.ok(shotMd.includes("## Google Flow Setup"));
    assert.ok(shotMd.includes("## Start Image Prompt"));
    assert.ok(shotMd.includes("## End Image Prompt"));
    assert.ok(shotMd.includes("## Video Prompt"));
    assert.ok(shotMd.includes("## Quality Checklist"));
    assert.ok(shotMd.includes("Select duration in UI: 6 seconds"));
    assert.ok(fs.existsSync(path.join(pack.outputDir, "LEARNING.json")));
    assert.ok(fs.existsSync(path.join(pack.outputDir, "LEARNING.md")));
  });

  it("is available through class and convenience APIs", () => {
    const parseResult = ScreenplayParser.parseText("SCENE 1\nA quiet room.", "api.txt");
    const studio = new FlowPromptStudio();

    const fromClass = studio.createProductionPack(parseResult, { shotsPerScene: 1 });
    const fromConvenience = fps.createProductionPack(parseResult, { shotsPerScene: 1 });

    assert.equal(fromClass.shotCount, 1);
    assert.equal(fromConvenience.shotCount, 1);
    assert.equal(fromClass.shots[0].durationSeconds, 8);
  });

  it("records feedback and injects learning into later prompts", () => {
    const parseResult = ScreenplayParser.parseText(
      [
        "SCENE 1: CYBER OFFICE - NIGHT",
        "A software dashboard is visible on the monitor.",
      ].join("\n"),
      "learning.txt"
    );

    const initial = ProductionPackGenerator.export(parseResult, tmpDir, {
      title: "Learning Pack",
      shotsPerScene: 1,
    });

    const feedback = ProductionPackGenerator.recordFeedback(initial.outputDir, {
      type: "rejected",
      shot: "SHOT_001",
      note: "the screen became a full red alarm interface",
      tags: "screen_continuity,alarm_exaggeration",
    });

    assert.equal(feedback.entry.type, "rejected");
    assert.ok(fs.existsSync(path.join(initial.outputDir, "LEARNING.json")));

    const learned = ProductionPackGenerator.export(parseResult, tmpDir, {
      title: "Learning Pack",
      shotsPerScene: 1,
    });

    assert.ok(learned.learning.rejected.length >= 1);
    assert.ok(learned.shots[0].videoPrompt.includes("Avoid this previously rejected direction"));
    assert.ok(learned.shots[0].videoPrompt.includes("full red alarm interface"));
  });
});
