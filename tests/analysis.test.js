const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { ScriptAnalyzer } = require("../src/analysis");
const { ScreenplayParser } = require("../src/parser");

describe("ScriptAnalyzer", () => {
  const parseResult = ScreenplayParser.parseText(
    "INT. HOUSE - DAY\n\nJOHN\nI love you so much.\n\nMARY\n(smiling)\nI love you too.\n\nSCENE 2\nEXT. PARK - NIGHT\n\nJOHN\n(staring into darkness)\nI'm afraid. Something is out there.\n\nMARY\n(whispering)\nI'm scared too.\n\nSCENE 3\nINT. HOUSE - DAY\n\nJOHN\n(running)\nGet out! Get out now!\n\nMARY\n(screaming)\nHELP!", "test.txt");

  const analysis = ScriptAnalyzer.analyze(parseResult);

  it("analyzes tempo", () => {
    assert.ok(analysis.tempo.overallPace);
    assert.ok(analysis.tempo.averageDialoguePerScene);
    assert.ok(analysis.tempo.scenes.length === parseResult.scenes.length);
  });

  it("detects emotions", () => {
    assert.ok(analysis.emotions.dominantEmotions);
    assert.ok(analysis.emotions.sceneEmotions.length > 0);
  });

  it("maps character relationships", () => {
    assert.ok(analysis.relationships.pairs);
    if (parseResult.characters.length >= 2) {
      assert.ok(analysis.relationships.connectedPairs >= 1);
    }
  });

  it("scores complexity", () => {
    assert.ok(analysis.complexity.averageScore >= 0);
    assert.ok(analysis.complexity.mostComplex);
    assert.ok(analysis.complexity.sceneScores.length === parseResult.scenes.length);
  });

  it("toMarkdown produces valid output", () => {
    const md = ScriptAnalyzer.toMarkdown(analysis);
    assert.ok(md.includes("Tempo"));
    assert.ok(md.includes("Emotional Arc"));
    assert.ok(md.includes("Character Relationships"));
    assert.ok(md.includes("Scene Complexity"));
  });

  it("handles script with no characters gracefully", () => {
    const empty = ScreenplayParser.parseText("SCENE 1\nJust action.", "e");
    const a = ScriptAnalyzer.analyze(empty);
    assert.ok(a.relationships.pairs.length === 0);
  });
});
