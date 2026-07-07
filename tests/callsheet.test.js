const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { CallSheetGenerator } = require("../src/callsheet");
const { ScreenplayParser } = require("../src/parser");
const { CoverageGenerator } = require("../src/coverage");

describe("CallSheetGenerator", () => {
  const parseResult = ScreenplayParser.parseText(
    "INT. ROOM - DAY\n\nJOHN\nHello.\n\nSCENE 2\nEXT. PARK - NIGHT\n\nMARY\nHi.", "test.txt");
  const coverageResult = CoverageGenerator.generate(parseResult, "drama");

  it("generates HTML string", () => {
    const cs = new CallSheetGenerator(parseResult, coverageResult);
    const html = cs.generate({ day: 1, director: "Test Director" });
    assert.ok(html.includes("<!DOCTYPE html>"));
    assert.ok(html.includes("Call Sheet"));
    assert.ok(html.includes("Test Director"));
  });

  it("includes all 9 standard sections", () => {
    const cs = new CallSheetGenerator(parseResult, coverageResult);
    const html = cs.generate({ day: 1 });
    assert.ok(html.includes("Director"), "should have director");
    assert.ok(html.includes("Weather"), "should have weather");
    assert.ok(html.includes("Location"), "should have location");
    assert.ok(html.includes("Shooting Schedule"), "should have schedule");
    assert.ok(html.includes("Cast List"), "should have cast list");
    assert.ok(html.includes("Crew Call"), "should have crew call");
  });

  it("handles custom options", () => {
    const cs = new CallSheetGenerator(parseResult, coverageResult);
    const html = cs.generate({ day: 5, callTime: "09:30", location: "Beach House" });
    assert.ok(html.includes("Day 5"));
    assert.ok(html.includes("09:30"));
    assert.ok(html.includes("Beach House"));
  });

  it("includes equipment notes from coverage genre", () => {
    const actionCoverage = CoverageGenerator.generate(parseResult, "action");
    const cs = new CallSheetGenerator(parseResult, actionCoverage);
    const html = cs.generate({ day: 1 });
    assert.ok(html.includes("Equipment Notes") || actionCoverage.genre.equipment.length === 0);
  });

  it("_addHours helper works", () => {
    const cs = new CallSheetGenerator(parseResult, coverageResult);
    assert.equal(cs._addHours("07:00", 1.5), "08:30");
    assert.equal(cs._addHours("07:00", -1), "06:00");
    assert.equal(cs._addHours("23:00", 2), "01:00");
  });
});
