/**
 * Flow Prompt Studio — Programmatic API
 *
 * Kullanım:
 *   const fps = require('flow-prompt-studio');
 *   await fps.workflow('senaryo.pdf');
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
    } = options;

    const results = {};

    // Step 1: Upload
    results.upload = await this.client.uploadScreenplay(screenplayPath);

    // Step 2: Analyze
    const [analysis, stats] = await Promise.all([
      this.client.getAnalysis(),
      this.client.getStats(),
    ]);
    results.analysis = analysis;
    results.stats = stats;

    // Step 3: Style detection
    results.style = await this.client.detectStyle();

    // Step 4: Coverage & production bundle
    results.bundle = await this.client.getBundle(true);

    // Step 5: Generate (optional)
    if (generate) {
      results.generate = await this.client.generate(scope, ultra);
    }

    // Step 6: Validate
    results.validation = await this.client.validate();

    // Step 7: Export URLs
    results.exports = {};
    for (const fmt of exportFormats) {
      results.exports[fmt] = this.client.getExportUrl(fmt);
    }

    return results;
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
  async repair(errorType, sceneId, problem) { return this.client.generateRepair(errorType, sceneId, "", problem || ""); }
  async repairAll() { return this.client.generateAllRepairs(); }
  async validate() { return this.client.validate(); }
  async getExportUrl(format) { return this.client.getExportUrl(format); }
  async getConfig() { return this.client.getConfig(); }
}

module.exports = { FlowPromptStudio, FlowPromptStudioClient };
