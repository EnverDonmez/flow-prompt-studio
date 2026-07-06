/**
 * Flow Prompt Studio — Programmatic API
 *
 * Usage:
 *   const { FlowPromptStudio } = require('flow-prompt-studio');
 *   const fps = new FlowPromptStudio();
 *   await fps.workflow('screenplay.pdf');
 */

const { FlowPromptStudioClient } = require("./client");

class FlowPromptStudio {
  constructor(baseUrl) {
    this.client = new FlowPromptStudioClient(baseUrl);
  }

  get version() { return require("../package.json").version; }

  /* ── Full automated workflow ── */
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

  /** Check if backend is reachable */
  async ping() {
    return this.client.ping();
  }

  /* ── Individual API wrappers ── */
  async upload(filePath) {
    return this.client.uploadScreenplay(filePath);
  }

  async analyze() {
    const [analysis, stats] = await Promise.all([
      this.client.getAnalysis(),
      this.client.getStats(),
    ]);
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

module.exports = { FlowPromptStudio, FlowPromptStudioClient };
