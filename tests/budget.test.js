const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const { BudgetEstimator } = require("../src/budget");
const { ScreenplayParser } = require("../src/parser");
const { CoverageGenerator } = require("../src/coverage");

describe("BudgetEstimator", () => {
  const parseResult = ScreenplayParser.parseText(
    "SCENE 1\nINT. HOUSE - DAY\nJOHN\nHello.\n\nSCENE 2\nEXT. PARK - NIGHT\nMARY\nHi.\n\nSCENE 3\nINT. CAFE - DAY\nJOHN\nBye.", "test.txt");
  const coverageResult = CoverageGenerator.generate(parseResult, "drama");

  it("estimates indie budget", () => {
    const budget = BudgetEstimator.estimate(parseResult, coverageResult, { level: "indie" });
    assert.equal(budget.level, "Indie / Micro-Budget");
    assert.ok(budget.total > 0);
    assert.ok(budget.shootDays >= 1);
    assert.ok(budget.breakdown.crew.amount > 0);
    assert.ok(budget.breakdown.cast.amount > 0);
  });

  it("mid level is higher than indie", () => {
    const indie = BudgetEstimator.estimate(parseResult, coverageResult, { level: "indie" });
    const mid = BudgetEstimator.estimate(parseResult, coverageResult, { level: "mid" });
    assert.ok(mid.total > indie.total, `mid (${mid.total}) should be > indie (${indie.total})`);
  });

  it("studio is highest", () => {
    const studio = BudgetEstimator.estimate(parseResult, coverageResult, { level: "studio" });
    assert.ok(studio.total > 100000);
  });

  it("action genre costs more than drama", () => {
    const actionCoverage = CoverageGenerator.generate(parseResult, "action");
    const drama = BudgetEstimator.estimate(parseResult, coverageResult, { level: "indie", genre: "drama" });
    const action = BudgetEstimator.estimate(parseResult, actionCoverage, { level: "indie", genre: "action" });
    assert.ok(action.total > drama.total || action.genreMultiplier > drama.genreMultiplier);
  });

  it("toMarkdown produces valid output", () => {
    const budget = BudgetEstimator.estimate(parseResult, coverageResult);
    const md = BudgetEstimator.toMarkdown(budget);
    assert.ok(md.includes("# Production Budget Estimate"));
    assert.ok(md.includes("Estimated Total"));
    assert.ok(md.includes(budget.total.toLocaleString()));
  });

  it("toCSV produces valid CSV", () => {
    const budget = BudgetEstimator.estimate(parseResult, coverageResult);
    const csv = BudgetEstimator.toCSV(budget);
    assert.ok(csv.includes("Category,Amount,Percentage,Detail"));
    assert.ok(csv.includes("TOTAL"));
  });

  it("all 6 breakdown categories present", () => {
    const budget = BudgetEstimator.estimate(parseResult, coverageResult);
    const cats = Object.keys(budget.breakdown);
    assert.ok(cats.includes("crew"));
    assert.ok(cats.includes("cast"));
    assert.ok(cats.includes("locations"));
    assert.ok(cats.includes("equipment"));
    assert.ok(cats.includes("catering"));
    assert.ok(cats.includes("post"));
  });
});
