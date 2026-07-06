/**
 * Flow Prompt Studio — Utils unit tests
 *
 * Usage: node --test tests/utils.test.js
 */

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");

describe("utils", () => {
  const { chalk, spinner } = require("../src/utils");

  describe("chalk", () => {
    it("exports all color functions", () => {
      const methods = ["red", "green", "yellow", "blue", "cyan", "gray", "bold"];
      methods.forEach((m) => {
        assert.equal(typeof chalk[m], "function", `${m} should be a function`);
      });
    });

    it("includes ANSI escape codes for red", () => {
      const result = chalk.red("error");
      assert.ok(result.includes("\x1b[31m"), "should contain red ANSI code");
      assert.ok(result.includes("error"), "should preserve original text");
      assert.ok(result.includes("\x1b[0m"), "should contain reset code");
    });

    it("green uses correct ANSI code", () => {
      const result = chalk.green("success");
      assert.ok(result.includes("\x1b[32m"));
      assert.ok(result.includes("success"));
    });

    it("yellow uses correct ANSI code", () => {
      const result = chalk.yellow("warning");
      assert.ok(result.includes("\x1b[33m"));
    });

    it("blue uses correct ANSI code", () => {
      const result = chalk.blue("info");
      assert.ok(result.includes("\x1b[34m"));
    });

    it("cyan uses correct ANSI code", () => {
      const result = chalk.cyan("step");
      assert.ok(result.includes("\x1b[36m"));
    });

    it("gray uses correct ANSI code", () => {
      const result = chalk.gray("detail");
      assert.ok(result.includes("\x1b[90m"));
    });

    it("bold uses correct ANSI code", () => {
      const result = chalk.bold("emphasis");
      assert.ok(result.includes("\x1b[1m"));
    });

    it("works with empty string", () => {
      const result = chalk.red("");
      assert.equal(result, "\x1b[31m\x1b[0m");
    });

    it("nesting works (red + bold)", () => {
      const result = chalk.red(chalk.bold("critical"));
      assert.ok(result.includes("\x1b[1m"));
      assert.ok(result.includes("\x1b[31m"));
    });
  });

  describe("spinner", () => {
    it("returns update and stop functions", () => {
      const spin = spinner("testing...");
      assert.equal(typeof spin.update, "function");
      assert.equal(typeof spin.stop, "function");
      spin.stop();
    });

    it("stop accepts a final message", () => {
      const spin = spinner("working...");
      spin.stop("done!");
      // Should not throw
    });

    it("update changes the message without stopping", () => {
      const spin = spinner("initial...");
      spin.update("updated...");
      spin.stop();
    });
  });
});
