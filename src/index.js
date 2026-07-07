/**
 * Flow Prompt Studio — Programmatic API
 *
 * Usage:
 *   const fps = require('flow-prompt-studio');
 *   const result = fps.parse('screenplay.pdf');
 *   const plan = fps.cover(result, 'action');
 *   fps.export(plan, 'csv', './output/');
 *
 *   // AI-powered (requires backend):
 *   const { FlowPromptStudio } = require('flow-prompt-studio');
 *   const studio = new FlowPromptStudio();
 *   await studio.workflow('screenplay.pdf');
 */

const { FlowPromptStudioClient } = require("./client");
const { ScreenplayParser } = require("./parser");
const { CoverageGenerator } = require("./coverage");
const { FileExporter } = require("./export");
const { AIPromptGenerator } = require("./generate");
const { StoryboardGenerator } = require("./storyboard");
const { ScreenJSONConverter } = require("./screenjson");
const { CallSheetGenerator } = require("./callsheet");
const { BudgetEstimator } = require("./budget");
const { ProjectManager } = require("./project");
const { FormatConverter } = require("./convert");
const { ScriptAnalyzer } = require("./analysis");

class FlowPromptStudio {
  constructor(baseUrl) {
    this.client = new FlowPromptStudioClient(baseUrl);
  }

  get version() { return require("../package.json").version; }

  /* ── Offline: Parse screenplay ── */
  parse(filePath) {
    return ScreenplayParser.parse(filePath);
  }

  parseText(text, label) {
    return ScreenplayParser.parseText(text, label);
  }

  /* ── Offline: Generate shot coverage ── */
  cover(parseResult, genre = "drama") {
    return CoverageGenerator.generate(parseResult, genre);
  }

  coverFromSceneCount(sceneCount, genre = "drama") {
    return CoverageGenerator.generateFromSceneCount(sceneCount, genre);
  }

  listGenres() {
    return CoverageGenerator.listGenres();
  }

  getGenre(genre) {
    return CoverageGenerator.getGenre(genre);
  }

  /* ── Offline: Export to file ── */
  exportParseResult(parseResult, format, outputDir) {
    return FileExporter.exportParseResult(parseResult, format, outputDir);
  }

  exportShotPlan(coverageResult, format, outputDir) {
    return FileExporter.exportShotPlan(coverageResult, format, outputDir);
  }

  /* ── Offline: Render to string ── */
  shotPlanToMarkdown(coverageResult) {
    return CoverageGenerator.toMarkdown(coverageResult);
  }

  shotPlanToCSV(coverageResult) {
    return CoverageGenerator.toCSV(coverageResult);
  }

  shotPlanToHTML(coverageResult) {
    return FileExporter._shotPlanToHtml(coverageResult);
  }

  /* ── Hybrid: Local workflow (no backend needed) ── */
  workflowLocal(screenplayPath, genre = "drama") {
    const parseResult = this.parse(screenplayPath);
    const coverageResult = this.cover(parseResult, genre);
    return { parse: parseResult, coverage: coverageResult };
  }

  /* ── Native AI generation (no backend needed) ── */
  async generateAI(parseResult, coverageResult, scope = "full_pack", options = {}) {
    const provider = options.provider || "deepseek";
    const apiKey = options.apiKey || AIPromptGenerator.resolveApiKey(provider);
    const gen = new AIPromptGenerator({ provider, apiKey, ...options });
    return gen.generate(parseResult, coverageResult, scope, options);
  }

  static getProvidersStatus() {
    return AIPromptGenerator.getProvidersStatus();
  }

  /* ── Storyboard generation ── */
  async generateStoryboard(coverageResult, outputDir, options = {}) {
    const sb = new StoryboardGenerator(options);
    return sb.generate(coverageResult, outputDir, options);
  }

  static listStoryStyles() {
    return StoryboardGenerator.listStyles();
  }

  /* ── ScreenJSON export ── */
  toScreenJSON(parseResult, options = {}) {
    return ScreenJSONConverter.convert(parseResult, options);
  }

  exportScreenJSON(parseResult, outputPath, options = {}) {
    return ScreenJSONConverter.toFile(parseResult, outputPath, options);
  }

  /* ── Backend-dependent: ping ── */
  async ping() {
    return this.client.ping();
  }

  /* ── Full automated workflow (needs backend) ── */
  async workflow(screenplayPath, options = {}) {
    const {
      scope = "full_pack",
      ultra = false,
      generate = true,
      exportFormats = ["markdown", "shot-plan-csv", "asset-plan-md", "repair-prompts", "playbook"],
      onProgress,
    } = options;

    const results = {};
    const notify = (step, msg) => {
      if (onProgress) onProgress(step, msg);
    };

    // Step 1: Upload
    notify("upload", `Uploading screenplay: ${screenplayPath}`);
    results.upload = await this.client.uploadScreenplay(screenplayPath);

    // Step 2: Analyze
    notify("analyze", "Analyzing characters, locations, props...");
    const [analysis, stats] = await Promise.all([
      this.client.getAnalysis(),
      this.client.getStats(),
    ]);
    results.analysis = analysis;
    results.stats = stats;

    // Step 3: Style detection
    notify("style", "Detecting visual style...");
    results.style = await this.client.detectStyle();

    // Step 4: Coverage & production bundle
    notify("coverage", "Building camera coverage plan...");
    results.bundle = await this.client.getBundle(true);

    // Step 5: Generate (optional)
    if (generate) {
      notify("generate", `Generating AI prompt pack (${scope})...`);
      results.generate = await this.client.generate(scope, ultra);
    }

    // Step 6: Validate
    notify("validate", "Validating package...");
    results.validation = await this.client.validate();

    // Step 7: Export URLs
    notify("export", "Preparing exports...");
    results.exports = {};
    for (const fmt of exportFormats) {
      results.exports[fmt] = this.client.getExportUrl(fmt);
    }

    return results;
  }

  /* ── Workflow with spinner (for CLI use) ── */
  async workflowProgressive(screenplayPath, options = {}) {
    const { spinner } = require("./utils");
    const spin = spinner("Starting workflow...");

    const result = await this.workflow(screenplayPath, {
      ...options,
      onProgress: (step, msg) => spin.update(`[${step}] ${msg}`),
    });

    const shotCount = result.bundle?.shot_rows?.length || 0;
    const sceneCount = result.upload?.scene_count || 0;
    spin.stop(`Workflow complete: ${sceneCount} scenes → ${shotCount} shots`);

    return result;
  }

  /* ── Individual API wrappers (backend) ── */
  async upload(filePath) { return this.client.uploadScreenplay(filePath); }
  async analyze() {
    const [analysis, stats] = await Promise.all([this.client.getAnalysis(), this.client.getStats()]);
    return { analysis, stats };
  }
  async detectStyle() { return this.client.detectStyle(); }
  async generate(scope = "full_pack", ultra = false) { return this.client.generate(scope, ultra); }
  async getCoverage(refresh = true) { return this.client.getBundle(refresh); }
  async estimate(filePath) { return this.client.estimate(filePath); }
  async repair(errorType, sceneId, problem) { return this.client.generateRepair(errorType, sceneId, "", problem || ""); }
  async repairAll() { return this.client.generateAllRepairs(); }
  async validate() { return this.client.validate(); }
  async getExportUrl(format) { return this.client.getExportUrl(format); }
  async getConfig() { return this.client.getConfig(); }
}

// Top-level convenience exports (no instantiation needed for offline features)
const fps = {
  parse: (filePath) => ScreenplayParser.parse(filePath),
  parseText: (text, label) => ScreenplayParser.parseText(text, label),
  cover: (parseResult, genre) => CoverageGenerator.generate(parseResult, genre),
  coverFromSceneCount: (count, genre) => CoverageGenerator.generateFromSceneCount(count, genre),
  listGenres: () => CoverageGenerator.listGenres(),
  getGenre: (genre) => CoverageGenerator.getGenre(genre),
  exportParseResult: (r, f, d) => FileExporter.exportParseResult(r, f, d),
  exportShotPlan: (r, f, d) => FileExporter.exportShotPlan(r, f, d),
  toMarkdown: (r) => CoverageGenerator.toMarkdown(r),
  toCSV: (r) => CoverageGenerator.toCSV(r),
  toStdout: (d) => FileExporter.toStdout(d),
  generate: (parseResult, coverageResult, scope, opts) => {
    const provider = opts?.provider || "deepseek";
    const apiKey = opts?.apiKey || AIPromptGenerator.resolveApiKey(provider);
    const gen = new AIPromptGenerator({ provider, apiKey, ...opts });
    return gen.generate(parseResult, coverageResult, scope, opts);
  },
  getProvidersStatus: () => AIPromptGenerator.getProvidersStatus(),
  storyboard: (coverageResult, outputDir, opts) => {
    const sb = new StoryboardGenerator(opts);
    return sb.generate(coverageResult, outputDir, opts);
  },
  listStoryStyles: () => StoryboardGenerator.listStyles(),
  toScreenJSON: (parseResult, opts) => ScreenJSONConverter.convert(parseResult, opts),
  exportScreenJSON: (parseResult, outputPath, opts) => ScreenJSONConverter.toFile(parseResult, outputPath, opts),
  version: require("../package.json").version,
};

module.exports = {
  FlowPromptStudio,
  FlowPromptStudioClient,
  ScreenplayParser,
  CoverageGenerator,
  FileExporter,
  AIPromptGenerator,
  StoryboardGenerator,
  ScreenJSONConverter,
  CallSheetGenerator,
  BudgetEstimator,
  ProjectManager,
  FormatConverter,
  ScriptAnalyzer,
  fps,
};
