/**
 * Flow Prompt Studio — API Client
 * Backend API ile haberleşme katmanı.
 */

const API_BASE = process.env.FPS_API_URL || "http://localhost:8000/api/v1";

class FlowPromptStudioClient {
  constructor(baseUrl = API_BASE) {
    this.baseUrl = baseUrl;
  }

  async _request(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const headers = { ...options.headers };

    // Don't set Content-Type for FormData (fetch sets it automatically with boundary)
    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    const res = await fetch(url, { ...options, headers });
    const ct = res.headers.get("content-type") || "";

    if (!res.ok) {
      const err = await res.text().catch(() => res.statusText);
      throw new Error(`API ${res.status}: ${err}`);
    }

    if (ct.includes("application/json")) return res.json();
    if (ct.includes("text")) return res.text();
    return res.blob();
  }

  /* ── Session ── */
  async getSession() { return this._request("/session"); }
  async resetSession() { return this._request("/session/reset", { method: "POST" }); }

  /* ── Screenplay ── */
  async uploadScreenplay(filePath) {
    const fs = require("fs");
    const path = require("path");

    const fileBuffer = fs.readFileSync(filePath);
    const blob = new Blob([fileBuffer], { type: "application/octet-stream" });
    const fd = new FormData();
    fd.append("file", blob, path.basename(filePath));

    const res = await fetch(`${this.baseUrl}/screenplay/upload`, {
      method: "POST",
      body: fd,
    });
    return res.json();
  }

  async setScreenplayText(text) {
    return this._request("/screenplay/text", {
      method: "POST",
      body: JSON.stringify({ text }),
    });
  }

  async getScenes() { return this._request("/screenplay/scenes"); }
  async getStats() { return this._request("/screenplay/stats"); }
  async getAnalysis() { return this._request("/screenplay/analysis"); }

  /* ── Style ── */
  async detectStyle() { return this._request("/style/detect", { method: "POST" }); }
  async getStyle() { return this._request("/settings/style"); }
  async updateStyle(data) { return this._request("/settings/style", { method: "PUT", body: JSON.stringify(data) }); }

  /* ── Generation ── */
  async generate(scope = "full_pack", forceUltra = false, manualMode = false) {
    return this._request("/generate", {
      method: "POST",
      body: JSON.stringify({ scope, force_ultra: forceUltra, manual_mode: manualMode }),
    });
  }
  async getMasterPrompt(scope = "full_pack", forceUltra = false) {
    return this._request(`/generate/master-prompt?scope=${scope}&force_ultra=${forceUltra}`);
  }
  async submitManualOutput(output) {
    return this._request("/generate/manual", { method: "POST", body: JSON.stringify({ manual_ai_output: output }) });
  }
  async getLogs() { return this._request("/generate/logs"); }
  async getGenerationStatus() { return this._request("/generate/status"); }

  /* ── Production ── */
  async getCoverage(refresh = false) { return this._request(`/production/coverage?refresh=${refresh}`); }
  async getAssetPlan(refresh = false) { return this._request(`/production/asset-plan?refresh=${refresh}`); }
  async getBundle(refresh = false) { return this._request(`/production/bundle?refresh=${refresh}`); }
  async getProjectMap() { return this._request("/production/project-map"); }

  /* ── Repair ── */
  async getErrorTypes() { return this._request("/repair/error-types"); }
  async generateRepair(errorType, sceneId = "", segmentId = "", problemDescription = "") {
    return this._request("/repair", {
      method: "POST",
      body: JSON.stringify({ error_type: errorType, scene_id: sceneId, segment_id: segmentId, problem_description: problemDescription }),
    });
  }
  async generateAllRepairs() { return this._request("/repair/generate-all", { method: "POST" }); }

  /* ── Preview ── */
  async getMarkdown() { return this._request("/preview/markdown"); }
  async updateMarkdown(text) {
    return this._request("/preview/markdown", { method: "PUT", body: JSON.stringify({ markdown_text: text }) });
  }
  async getFlowCopyReady() { return this._request("/preview/flow-copy-ready"); }
  async checkContinuity() { return this._request("/preview/continuity", { method: "POST" }); }

  /* ── Validation ── */
  async validate(markdownText = "") {
    return this._request("/validate", { method: "POST", body: JSON.stringify({ markdown_text: markdownText }) });
  }

  /* ── Export ── */
  getExportUrl(format) { return `${this.baseUrl}/export/${format}`; }
  async getConfig() { return this._request("/config"); }
}

module.exports = { FlowPromptStudioClient };
