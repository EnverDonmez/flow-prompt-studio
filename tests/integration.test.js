/**
 * Flow Prompt Studio — Integration Tests
 *
 * Tests real code paths without mocking (no backend required for most).
 * Usage: node --test tests/integration.test.js
 */

const { describe, it, beforeEach, after, afterEach } = require("node:test");
const assert = require("node:assert/strict");
const { spawnSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

const FPS_BIN = path.resolve(__dirname, "../bin/fps.js");
const PKG = require("../package.json");

// Helper: run fps CLI and capture output
// Accepts either a string (simple args) or array (for paths with spaces)
function fps(args = "", opts = {}) {
  const argArray = Array.isArray(args) ? args : args.split(" ").filter(Boolean);
  const result = spawnSync(process.execPath, [FPS_BIN, ...argArray], {
    encoding: "utf-8",
    timeout: 15000,
    env: { ...process.env, FPS_API_URL: "http://localhost:9999/api/v1" },
    ...opts,
  });
  return {
    stdout: (result.stdout || "").trim(),
    stderr: (result.stderr || "").trim(),
    status: result.status,
    combined: ((result.stdout || "") + (result.stderr || "")).trim(),
  };
}

describe("Integration Tests", () => {
  let tmpDir;
  let originalCwd;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), "fps-integration-"));
    originalCwd = process.cwd();
  });

  afterEach(() => {
    try { process.chdir(originalCwd); } catch {
      // Best-effort cwd restore for failed tests.
    }
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch {
      // Best-effort cleanup for temporary test files.
    }
  });

  after(() => {
    try { process.chdir(originalCwd); } catch {
      // Best-effort cwd restore for failed tests.
    }
  });

  /* ────────────────────────────────────
   * 1. CLI Basics
   * ──────────────────────────────────── */
  describe("CLI basic output", () => {
    it("--version prints version from package.json", () => {
      const { stdout, status } = fps("--version");
      assert.equal(status, 0);
      assert.ok(stdout.includes(PKG.version), `version output should contain ${PKG.version}, got: ${stdout}`);
    });

    it("--help lists all expected commands", () => {
      const { stdout, status } = fps("--help");
      assert.equal(status, 0);
      const expected = ["config", "upload", "analyze", "style", "generate",
        "estimate", "coverage", "repair", "validate", "export",
        "preview", "workflow", "init", "doctor", "help"];
      expected.forEach(cmd => {
        assert.ok(stdout.includes(cmd), `--help should mention '${cmd}'`);
      });
    });

    it("command help works (workflow --help)", () => {
      const { stdout, status } = fps("workflow --help");
      assert.equal(status, 0);
      assert.ok(stdout.includes("--genre"), "workflow --help should show --genre");
      assert.ok(stdout.includes("--ai"), "workflow --help should show --ai");
      assert.ok(stdout.includes("--dry-run"), "workflow --help should show --dry-run");
    });

    it("command help works (estimate --help)", () => {
      const { stdout, status } = fps("estimate --help");
      assert.equal(status, 0);
      assert.ok(stdout.includes("file"), "estimate --help should mention file argument");
    });
  });

  /* ────────────────────────────────────
   * 2. init command
   * ──────────────────────────────────── */
  describe("init command", () => {
    it("creates .fpsrc in current directory", () => {
      process.chdir(tmpDir);
      const { status } = fps("init");
      assert.equal(status, 0);
      assert.ok(fs.existsSync(path.join(tmpDir, ".fpsrc")), ".fpsrc should exist");

      const config = JSON.parse(fs.readFileSync(path.join(tmpDir, ".fpsrc"), "utf-8"));
      assert.equal(config.defaultScope, "full_pack");
      assert.equal(config.language, "en");
      assert.ok(Array.isArray(config.defaultFormats));
      assert.ok(config.defaultFormats.includes("markdown"));
    });

    it("refuses to overwrite without --force", () => {
      process.chdir(tmpDir);
      fs.writeFileSync(path.join(tmpDir, ".fpsrc"), "{}", "utf-8");
      const { combined } = fps("init");
      assert.ok(combined.includes("already exists") || combined.includes("--force"),
        `should warn about existing file, got: ${combined}`);
      // Content should not be overwritten
      const content = fs.readFileSync(path.join(tmpDir, ".fpsrc"), "utf-8");
      assert.equal(content, "{}");
    });

    it("overwrites with --force", () => {
      process.chdir(tmpDir);
      fs.writeFileSync(path.join(tmpDir, ".fpsrc"), "{}", "utf-8");
      const { status } = fps("init --force");
      assert.equal(status, 0);
      const config = JSON.parse(fs.readFileSync(path.join(tmpDir, ".fpsrc"), "utf-8"));
      assert.equal(config.defaultScope, "full_pack");
    });
  });

  /* ────────────────────────────────────
   * 3. estimate command (no backend)
   * ──────────────────────────────────── */
  describe("estimate command", () => {
    it("estimates a screenplay with SCENE markers", () => {
      const file = path.join(tmpDir, "script.txt");
      fs.writeFileSync(file, "SCENE 1\nWalking down the street.\nSCENE 2\nEntering the building.\nSCENE: 3\nFinal confrontation.", "utf-8");

      const { stdout, status } = fps(["estimate", file]);
      assert.equal(status, 0, `should exit 0, got ${status}`);
      assert.ok(stdout.includes("Estimation"), "should show 'Estimation' header");
      assert.ok(stdout.includes("script.txt"), "should show filename");
      // Should detect ~3 scenes
      assert.ok(stdout.includes("Scenes") || stdout.includes("scenes"), "should mention scenes");
    });

    it("handles files with no scene markers", () => {
      const file = path.join(tmpDir, "plain.txt");
      fs.writeFileSync(file, "Just some random text without scene markers.\nMore text.\nEven more.", "utf-8");

      const { stdout, status } = fps(["estimate", file]);
      assert.equal(status, 0);
      assert.ok(stdout.includes("Estimation"), "should still produce estimation");
    });

    it("errors on missing file", () => {
      const { combined } = fps(["estimate", path.join(tmpDir, "nonexistent.pdf")]);
      assert.ok(combined.includes("File not found") || combined.includes("not found"),
        `should report missing file, got: ${combined}`);
    });

    it("handles .md files", () => {
      const file = path.join(tmpDir, "script.md");
      fs.writeFileSync(file, "# SCENE 1\nThe beginning.\n\n# SCENE 2\nThe middle.", "utf-8");

      const { stdout, status } = fps(["estimate", file]);
      assert.equal(status, 0);
      assert.ok(stdout.includes("Estimation"));
    });

    it("handles empty files", () => {
      const file = path.join(tmpDir, "empty.txt");
      fs.writeFileSync(file, "", "utf-8");

      const { stdout, status } = fps(["estimate", file]);
      assert.equal(status, 0);
      assert.ok(stdout.includes("Estimation"), "empty file should still produce output");
    });

    it("handles large files quickly", () => {
      const file = path.join(tmpDir, "large.txt");
      // Generate ~100KB file
      let content = "";
      for (let i = 1; i <= 50; i++) {
        content += `SCENE ${i}\nScene ${i} content here. Lots of description and dialogue.\n`.repeat(10);
      }
      fs.writeFileSync(file, content, "utf-8");

      const { stdout, status } = fps(["estimate", file]);
      assert.equal(status, 0);
      assert.ok(stdout.includes("Estimation"));
    });
  });

  /* ────────────────────────────────────
   * 4. Graceful errors (no backend)
   * ──────────────────────────────────── */
  describe("graceful errors without backend", () => {
    it("config shows provider status even without backend", () => {
      // New config shows AI providers first, then attempts backend (which may timeout)
      const result = spawnSync(process.execPath, [FPS_BIN, "config"], {
        encoding: "utf-8",
        timeout: 15000,
        env: { ...process.env, FPS_API_URL: "http://localhost:9999/api/v1" },
      });
      const combined = ((result.stdout || "") + (result.stderr || "")).trim();
      assert.ok(combined.includes("DeepSeek") || combined.includes("AI Providers"),
        `should show provider status, got: ${combined}`);
    });

    it("doctor runs successfully even without backend", () => {
      // doctor now shows offline commands — no connection needed
      const result = spawnSync(process.execPath, [FPS_BIN, "doctor"], {
        encoding: "utf-8",
        timeout: 10000,
        env: { ...process.env, FPS_API_URL: "http://0.0.0.0:1/api/v1" },
      });
      const stdout = (result.stdout || "").trim();
      const combined = ((result.stdout || "") + (result.stderr || "")).trim();
      // May exit non-zero depending on connection timing — we just care about output content
      assert.ok(stdout.includes("Node.js"), "should check Node.js version");
      assert.ok(combined.includes("npm") || combined.includes("fps"), "should mention npm or fps version");
      assert.ok(combined.includes("offline") || combined.includes("AI"), "should mention capabilities");
      assert.ok(combined.includes("parse") || combined.includes("shots") || combined.includes("interactive"),
        "should show available commands");
    });

    it("export without type shows usage error", () => {
      const { combined } = fps("export");
      // New export requires <type> argument
      assert.ok(combined.includes("missing") || combined.includes("error") || combined.includes("Invalid") || combined.includes("type"),
        `should show usage info, got: ${combined}`);
    });

    it("repair without type lists error types", () => {
      // This will fail because backend is down, but should give a meaningful error
      const { combined } = fps("repair");
      assert.ok(
        combined.includes("not reachable") || combined.includes("Cannot connect") ||
        combined.includes("Available error types"),
        `should either list types or show connection error, got: ${combined}`
      );
    });

    it("invalid type gives clear error", () => {
      const { combined } = fps("export invalid_type_xyz");
      assert.ok(combined.includes("Invalid"),
        `should say invalid type, got: ${combined}`);
    });

    it("exports Resolve marker CSV to stdout", () => {
      const { stdout, status, combined } = fps("export shot-plan --format resolve-csv --stdout");
      assert.equal(status, 0, combined);
      assert.ok(stdout.includes("Timeline,Timecode,Name,Note,Color,Duration"));
      assert.ok(stdout.includes("00:00:00:00"));
      assert.ok(stdout.includes("Shot 1"));
    });

    it("exports Resolve marker CSV to a file", () => {
      const outDir = path.join(tmpDir, "resolve-out");
      const { stdout, status, combined } = fps(["export", "shot-plan", "--format", "resolve-csv", "-o", outDir]);
      assert.equal(status, 0, combined);
      assert.ok(stdout.includes("resolve-markers-drama.csv"));
      const outFile = path.join(outDir, "resolve-markers-drama.csv");
      assert.ok(fs.existsSync(outFile));
      const content = fs.readFileSync(outFile, "utf-8");
      assert.ok(content.includes("Timeline,Timecode,Name,Note,Color,Duration"));
      assert.ok(content.includes("00:00:00:00"));
    });
  });

  /* ────────────────────────────────────
   * 5. Programmatic API (no backend)
   * ──────────────────────────────────── */
  describe("programmatic API", () => {
    let FlowPromptStudio, FlowPromptStudioClient;

    beforeEach(() => {
      delete require.cache[require.resolve("../src/index")];
      delete require.cache[require.resolve("../src/client")];
      const mod = require("../src/index");
      FlowPromptStudio = mod.FlowPromptStudio;
      FlowPromptStudioClient = mod.FlowPromptStudioClient;
    });

    it("version getter returns valid semver", () => {
      const fps = new FlowPromptStudio();
      const v = fps.version;
      assert.ok(/^\d+\.\d+\.\d+$/.test(v), `version should be semver, got: ${v}`);
      assert.equal(v, PKG.version, "version should match package.json");
    });

    it("client default baseUrl matches env or default", () => {
      const client = new FlowPromptStudioClient();
      assert.ok(client.baseUrl.includes("/api/v1"), "baseUrl should contain /api/v1");
    });

    it("client custom baseUrl works", () => {
      const client = new FlowPromptStudioClient("http://custom:3000/api/v2");
      assert.equal(client.baseUrl, "http://custom:3000/api/v2");
    });

    it("client.retryConfig has expected defaults", () => {
      const client = new FlowPromptStudioClient();
      assert.equal(client.retryConfig.maxRetries, 3);
      assert.equal(client.retryConfig.initialDelayMs, 1000);
      assert.equal(client.retryConfig.timeoutMs, 60000);
      assert.deepEqual(client.retryConfig.retryableStatuses, [429, 502, 503, 504]);
    });

    it("estimate returns correct structure", async () => {
      const file = path.join(tmpDir, "api-test.txt");
      fs.writeFileSync(file, "SCENE 1\nTest content.\nSCENE 2\nMore test.", "utf-8");

      const client = new FlowPromptStudioClient();
      const est = await client.estimate(file);

      assert.equal(typeof est.filename, "string");
      assert.equal(typeof est.fileSizeKb, "number");
      assert.equal(typeof est.estimatedScenes, "number");
      assert.equal(typeof est.estimatedShots, "number");
      assert.equal(typeof est.estimatedDurationMinutes, "number");
      assert.ok(est.estimatedScenes >= 1, `should detect at least 1 scene, got ${est.estimatedScenes}`);
      assert.ok(est.estimatedShots >= 1);
    });

    it("estimate throws for missing file", async () => {
      const client = new FlowPromptStudioClient();
      await assert.rejects(
        () => client.estimate("/definitely/not/a/real/file.pdf"),
        /File not found/
      );
    });

    it("uploadScreenplay throws for missing file", async () => {
      const client = new FlowPromptStudioClient();
      await assert.rejects(
        () => client.uploadScreenplay("/nonexistent/file.pdf"),
        /File not found/
      );
    });

    it("getExportUrl returns correct format strings", () => {
      const client = new FlowPromptStudioClient("http://api:8000/api/v1");
      assert.equal(client.getExportUrl("markdown"), "http://api:8000/api/v1/export/markdown");
      assert.equal(client.getExportUrl("production-pack-zip"), "http://api:8000/api/v1/export/production-pack-zip");
      assert.ok(client.getExportUrl("shot-plan-csv").endsWith("/shot-plan-csv"));
    });

    it("client.clearCache does not throw", () => {
      const client = new FlowPromptStudioClient();
      client.clearCache(); // should not throw
    });

    it("client._sleep resolves after given ms", async () => {
      const client = new FlowPromptStudioClient();
      const start = Date.now();
      await client._sleep(50);
      const elapsed = Date.now() - start;
      assert.ok(elapsed >= 40, `sleep should wait at least ~40ms, got ${elapsed}ms`);
    });

    it("client._isRetryable detects retryable statuses", () => {
      const client = new FlowPromptStudioClient();
      assert.equal(client._isRetryable(null, 503), true);
      assert.equal(client._isRetryable(null, 502), true);
      assert.equal(client._isRetryable(null, 429), true);
      assert.equal(client._isRetryable(null, 504), true);
      assert.equal(client._isRetryable(null, 500), false);
      assert.equal(client._isRetryable(null, 404), false);
      assert.equal(client._isRetryable(null, 200), false);
    });

    it("client._isRetryable detects network errors", () => {
      const client = new FlowPromptStudioClient();
      assert.equal(client._isRetryable(new Error("ECONNREFUSED"), 0), true);
      assert.equal(client._isRetryable(new Error("fetch failed"), 0), true);
      assert.equal(client._isRetryable(new Error("ETIMEDOUT"), 0), true);
      assert.equal(client._isRetryable(new Error("ENOTFOUND"), 0), true);
      assert.equal(client._isRetryable(new Error("AbortError"), 0), true);
      assert.equal(client._isRetryable(new Error("random error"), 0), false);
    });

    it("client._parseRetryAfter handles seconds format", () => {
      const client = new FlowPromptStudioClient();
      const headers = { get: (name) => name === "retry-after" ? "120" : null };
      const delay = client._parseRetryAfter(headers);
      assert.equal(delay, 120000);
    });

    it("client._parseRetryAfter returns null without header", () => {
      const client = new FlowPromptStudioClient();
      const headers = { get: () => null };
      assert.equal(client._parseRetryAfter(headers), null);
    });

    it("ping without backend returns reachable=false", async () => {
      const client = new FlowPromptStudioClient("http://localhost:9999/api/v1");
      client.retryConfig = { ...client.retryConfig, maxRetries: 0, timeoutMs: 2000 };
      const result = await client.ping();
      assert.equal(result.reachable, false);
      assert.ok(result.error);
    });
  });

  /* ────────────────────────────────────
   * 6. Utils (spinner, chalk)
   * ──────────────────────────────────── */
  describe("utils", () => {
    it("spinner.update and spinner.stop work", (context, done) => {
      const { spinner } = require("../src/utils");
      const spin = spinner("testing");
      assert.equal(typeof spin.update, "function");
      assert.equal(typeof spin.stop, "function");

      // Verify update doesn't throw
      spin.update("still testing");
      spin.update("almost done");

      // Verify stop doesn't throw and prints something
      // Capture stderr to verify output
      const write = process.stderr.write;
      const writes = [];
      process.stderr.write = (chunk) => { writes.push(chunk); return true; };

      spin.stop("✓ done");

      process.stderr.write = write;
      assert.ok(writes.some(w => w.includes("done")), "stop should write the final message");
      done();
    });

    it("spinner can run for a brief period", (context, done) => {
      const { spinner } = require("../src/utils");
      const spin = spinner("processing...");
      setTimeout(() => {
        spin.update("still processing...");
      }, 50);
      setTimeout(() => {
        spin.stop("✓ finished");
        done();
      }, 150);
    });

    it("chalk produces colored output", () => {
      const { chalk } = require("../src/utils");
      const red = chalk.red("error");
      assert.ok(red.startsWith("\x1b[31m"));
      assert.ok(red.endsWith("\x1b[0m"));

      const green = chalk.green("ok");
      assert.ok(green.startsWith("\x1b[32m"));

      const bold = chalk.bold("emphasis");
      assert.ok(bold.startsWith("\x1b[1m"));
    });

    it("chalk all colors return strings", () => {
      const { chalk } = require("../src/utils");
      ["red", "green", "yellow", "blue", "cyan", "gray", "bold"].forEach(fn => {
        const result = chalk[fn]("test");
        assert.equal(typeof result, "string");
        assert.ok(result.includes("\x1b["), `${fn} should contain ANSI code`);
        assert.ok(result.includes("test"), `${fn} should contain original text`);
      });
    });
  });

  /* ────────────────────────────────────
   * 7. Smoke: workflow --help
   * ──────────────────────────────────── */
  describe("CLI edge cases", () => {
    it("unknown command shows helpful output", () => {
      const { combined } = fps("nonexistent_command");
      assert.ok(combined.includes("unknown") || combined.includes("help") || combined.includes("command"),
        `should show error for unknown command, got: ${combined}`);
    });

    it("upload without file shows error", () => {
      const { combined } = fps("upload");
      assert.ok(
        combined.includes("missing") || combined.includes("required") || combined.includes("argument") ||
        combined.includes("file") || combined.includes("error"),
        `should error on missing file argument, got: ${combined}`
      );
    });

    it("workflow without file shows error", () => {
      const { combined } = fps("workflow");
      assert.ok(
        combined.includes("missing") || combined.includes("required") || combined.includes("argument") ||
        combined.includes("file"),
        `should error on missing argument, got: ${combined}`
      );
    });

    it("estimate without file shows error", () => {
      const { combined } = fps("estimate");
      assert.ok(
        combined.includes("missing") || combined.includes("required") || combined.includes("argument"),
        `should error on missing argument, got: ${combined}`
      );
    });

    it("workflow with nonexistent file shows clear error", () => {
      const { combined } = fps(["workflow", path.join(tmpDir, "does_not_exist.pdf")]);
      assert.ok(combined.includes("not found") || combined.includes("not exist"),
        `should clearly say file not found, got: ${combined}`);
    });

    it("upload with nonexistent file shows clear error", () => {
      const { combined } = fps(["upload", path.join(tmpDir, "nope.pdf")]);
      assert.ok(combined.includes("not found"),
        `should clearly say file not found, got: ${combined}`);
    });

    it("export with invalid type gives clear error", () => {
      const { combined } = fps("export nonexistent_type_xyz");
      assert.ok(combined.includes("Invalid"),
        `should say invalid, got: ${combined}`);
    });

    it("style --show without backend gives graceful error", () => {
      const { combined } = fps("style --show");
      assert.ok(
        combined.includes("not reachable") || combined.includes("Cannot connect") ||
        combined.includes("Current") || combined.includes("Style"),
        `should either show style or connection error, got: ${combined}`
      );
    });
  });

  /* ────────────────────────────────────
   * 8. TypeScript definitions file
   * ──────────────────────────────────── */
  describe("index.d.ts", () => {
    it("exists and contains all exported classes", () => {
      const dts = fs.readFileSync(path.resolve(__dirname, "../index.d.ts"), "utf-8");
      assert.ok(dts.includes("export class FlowPromptStudioClient"));
      assert.ok(dts.includes("export class FlowPromptStudio"));
      assert.ok(dts.includes("WorkflowOptions"));
      assert.ok(dts.includes("RetryConfig"));
      assert.ok(dts.includes("PingResult"));
      assert.ok(dts.includes("EstimateResult"));
      assert.ok(dts.includes("UploadResult"));
      assert.ok(dts.includes("ping(): Promise<PingResult>"));
      assert.ok(dts.includes("estimate(filePath: string): Promise<EstimateResult>"));
      assert.ok(dts.includes("clearCache(): void"));
    });
  });

  /* ────────────────────────────────────
   * 9. package.json integrity
   * ──────────────────────────────────── */
  describe("package.json", () => {
    it("has all required fields", () => {
      assert.equal(PKG.name, "flow-prompt-studio");
      assert.ok(PKG.version);
      assert.ok(PKG.main);
      assert.equal(PKG.types, "index.d.ts");
      assert.ok(PKG.bin.fps);
      assert.ok(Array.isArray(PKG.files));
      assert.ok(PKG.files.includes("index.d.ts"));
      assert.ok(PKG.files.includes("CHANGELOG.md"));
      assert.ok(PKG.files.includes("README.md"));
    });

    it("scripts include test and smoke", () => {
      assert.ok(PKG.scripts.test);
      assert.ok(PKG.scripts.smoke);
      assert.ok(PKG.scripts.lint);
    });

    it("keywords include relevant terms", () => {
      assert.ok(PKG.keywords.includes("google-flow"));
      assert.ok(PKG.keywords.includes("veo"));
      assert.ok(PKG.keywords.includes("screenplay"));
    });

    it("repository points to correct GitHub URL", () => {
      assert.ok(PKG.repository.url.includes("EnverDonmez/flow-prompt-studio"));
    });
  });
});
