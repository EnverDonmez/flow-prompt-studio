/**
 * Flow Prompt Studio — Coverage Generator Tests
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { CoverageGenerator, GENRES, SHOT_TYPES } = require("../src/coverage");
const { ScreenplayParser } = require("../src/parser");

describe("CoverageGenerator", () => {
  /* ── Genre listing ── */
  describe("listGenres", () => {
    it("returns all genre keys", () => {
      const genres = CoverageGenerator.listGenres();
      assert.ok(genres.length >= 7);
      assert.ok(genres.includes("action"));
      assert.ok(genres.includes("drama"));
      assert.ok(genres.includes("horror"));
      assert.ok(genres.includes("documentary"));
      assert.ok(genres.includes("music_video"));
      assert.ok(genres.includes("commercial"));
      assert.ok(genres.includes("short_film"));
    });
  });

  /* ── Genre info ── */
  describe("getGenre", () => {
    it("returns full genre metadata", () => {
      const info = CoverageGenerator.getGenre("drama");
      assert.equal(info.key, "drama");
      assert.ok(info.name);
      assert.ok(info.description);
      assert.ok(info.shotsPerScene > 0);
      assert.ok(Object.keys(info.distribution).length > 0);
      assert.ok(Array.isArray(info.cameraNotes));
      assert.ok(Array.isArray(info.equipment));
      assert.ok(info.pacing);
    });

    it("throws for unknown genre", () => {
      assert.throws(
        () => CoverageGenerator.getGenre("nonexistent"),
        /Unknown genre/
      );
    });

    it("is case-insensitive", () => {
      const info = CoverageGenerator.getGenre("ACTION");
      assert.equal(info.key, "action");
    });
  });

  /* ── generateFromSceneCount ── */
  describe("generateFromSceneCount", () => {
    it("generates shot plan from scene count", () => {
      const result = CoverageGenerator.generateFromSceneCount(5, "drama");
      assert.equal(result.sceneCount, 5);
      assert.ok(result.totalShots > 0);
      assert.equal(Number(result.averageShotsPerScene), 8); // drama = 8 shots/scene
      assert.ok(result.estimatedDurationMinutes >= 0);
      assert.equal(result.shotRows.length, result.totalShots);
    });

    it("action genre produces more shots than drama", () => {
      const drama = CoverageGenerator.generateFromSceneCount(10, "drama");
      const action = CoverageGenerator.generateFromSceneCount(10, "action");
      assert.ok(action.totalShots > drama.totalShots, "action should have more shots");
    });

    it("handles 0 scenes", () => {
      const result = CoverageGenerator.generateFromSceneCount(0, "drama");
      assert.equal(result.sceneCount, 0);
      assert.equal(result.totalShots, 0);
    });

    it("handles large scene count", () => {
      const result = CoverageGenerator.generateFromSceneCount(100, "action");
      assert.ok(result.totalShots > 500);
      assert.equal(result.shotRows.length, result.totalShots);
    });

    it("all genres work", () => {
      CoverageGenerator.listGenres().forEach((genre) => {
        const result = CoverageGenerator.generateFromSceneCount(3, genre);
        assert.ok(result.totalShots > 0, `${genre} should produce shots`);
      });
    });
  });

  /* ── generate (from parse result) ── */
  describe("generate", () => {
    it("generates from parsed screenplay", () => {
      const parseResult = ScreenplayParser.parseText(
        "SCENE 1\nINT. ROOM - DAY\nJOHN\nHello.\n\nSCENE 2\nEXT. PARK - NIGHT\nMARY\nHi.",
        "test"
      );
      const result = CoverageGenerator.generate(parseResult, "horror");
      assert.equal(result.sceneCount, parseResult.scenes.length);
      assert.ok(result.totalShots > 0);
      // Shot rows should reference actual scene headings
      assert.ok(result.shotRows.some(r => r["Scene Heading"].includes("ROOM") || r["Scene Heading"].includes("PARK")));
    });

    it("includes genre metadata in result", () => {
      const parseResult = ScreenplayParser.parseText("SCENE 1\nContent.", "test");
      const result = CoverageGenerator.generate(parseResult, "commercial");
      assert.equal(result.genre.key, "commercial");
      assert.ok(result.genre.cameraNotes.length > 0);
    });

    it("throws for unknown genre", () => {
      const parseResult = { scenes: [], stats: { totalScenes: 0 } };
      assert.throws(
        () => CoverageGenerator.generate(parseResult, "invalid"),
        /Unknown genre/
      );
    });
  });

  /* ── Shot types ── */
  describe("SHOT_TYPES", () => {
    it("has 25 shot types defined", () => {
      assert.ok(Object.keys(SHOT_TYPES).length >= 20);
    });

    it("each shot type has required fields", () => {
      Object.values(SHOT_TYPES).forEach((st) => {
        assert.ok(st.name);
        assert.ok(st.typicalDuration);
      });
    });
  });

  /* ── toMarkdown ── */
  describe("toMarkdown", () => {
    it("produces valid markdown", () => {
      const result = CoverageGenerator.generateFromSceneCount(2, "drama");
      const md = CoverageGenerator.toMarkdown(result);
      assert.ok(md.includes("# Shot Coverage Plan"));
      assert.ok(md.includes("## Camera Notes"));
      assert.ok(md.includes("## Shot List"));
      assert.ok(md.includes("| Shot # | Scene |"));
    });
  });

  /* ── toCSV ── */
  describe("toCSV", () => {
    it("produces valid CSV", () => {
      const result = CoverageGenerator.generateFromSceneCount(2, "drama");
      const csv = CoverageGenerator.toCSV(result);
      assert.ok(csv.includes("Shot #,Scene,"));
      const lines = csv.split("\n");
      assert.ok(lines.length > 1); // header + data rows
    });
  });

  /* ── Distribution consistency ── */
  describe("distribution", () => {
    it("each genre distribution pool has enough items to pick from", () => {
      Object.entries(GENRES).forEach(([key, genre]) => {
        const poolSize = Object.values(genre.distribution).reduce((a, b) => a + b, 0);
        assert.ok(poolSize >= genre.shotsPerScene,
          `${key}: distribution pool (${poolSize}) should be >= shotsPerScene (${genre.shotsPerScene})`);
      });
    });

    it("all distribution shot types exist in SHOT_TYPES", () => {
      Object.entries(GENRES).forEach(([, genre]) => {
        Object.keys(genre.distribution).forEach((type) => {
          assert.ok(SHOT_TYPES[type], `Shot type ${type} should be defined in SHOT_TYPES`);
        });
      });
    });
  });
});
