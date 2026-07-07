/**
 * Flow Prompt Studio — API Client
 * Backend communication layer with retry, timeout, and exponential backoff.
 */

const fs = require("fs");
const path = require("path");

const API_BASE = process.env.FPS_API_URL || "http://localhost:8000/api/v1";

/** Default retry configuration */
const DEFAULT_RETRY_CONFIG = {
  maxRetries: 3,
  initialDelayMs: 1000,
  backoffMultiplier: 2,
  maxDelayMs: 30000,
  timeoutMs: 60000,
  retryableStatuses: [429, 502, 503, 504],
};

class FlowPromptStudioClient {
  constructor(baseUrl = API_BASE) {
    this.baseUrl = baseUrl;
    this.retryConfig = { ...DEFAULT_RETRY_CONFIG };
    /** Simple in-memory cache for GET requests */
    this._cache = new Map();
    this._cacheTtl = 60_000; // 1 minute default
  }

  /**
   * Check whether an error is retryable.
   * Network errors and specific HTTP status codes are retryable.
   */
  _isRetryable(error, status) {
    if (status && this.retryConfig.retryableStatuses.includes(status)) {
      return true;
    }
    // Network errors (fetch failed, DNS, connection refused, etc.)
    if (!status && error) {
      const msg = error.message || "";
      if (
        msg.includes("fetch failed") ||
        msg.includes("ECONNREFUSED") ||
        msg.includes("ECONNRESET") ||
        msg.includes("ETIMEDOUT") ||
        msg.includes("ENOTFOUND") ||
        msg.includes("network timeout") ||
        msg.includes("AbortError")
      ) {
        return true;
      }
    }
    return false;
  }

  /** Sleep for given milliseconds */
  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /** Extract wait duration from Retry-After header */
  _parseRetryAfter(headers) {
    const raw = headers.get("retry-after");
    if (!raw) return null;
    // Seconds (e.g. "120")
    const seconds = parseInt(raw, 10);
    if (!isNaN(seconds)) return seconds * 1000;
    // HTTP-date format (e.g. "Wed, 21 Oct 2015 07:28:00 GMT")
    const date = new Date(raw);
    if (!isNaN(date.getTime())) return Math.max(0, date.getTime() - Date.now());
    return null;
  }

  /**
   * Check whether the backend is reachable.
   * @returns {Promise<{reachable: boolean, error?: string}>}
   */
  async ping() {
    try {
      await this._request("/config", { _skipCache: true });
      return { reachable: true };
    } catch (err) {
      return { reachable: false, error: err.message };
    }
  }

  /**
   * Core HTTP request method — with retry, timeout, and error handling.
   *
   * @param {string} path - API endpoint path (e.g. "/session")
   * @param {object} options - Fetch options
   * @returns {Promise<any>} JSON, text, or blob response
   */
  async _request(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const headers = { ...options.headers };
    const { retryConfig } = this;
    const skipCache = options._skipCache;

    // Check cache for GET requests
    const method = options.method || "GET";
    if (method === "GET" && !skipCache) {
      const cached = this._cache.get(url);
      if (cached && Date.now() - cached.timestamp < this._cacheTtl) {
        return cached.data;
      }
    }

    // Content-Type: let fetch set boundary for FormData
    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    let lastError = null;
    let attempt = 0;

    while (attempt <= retryConfig.maxRetries) {
      attempt++;

      try {
        // Timeout control
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), retryConfig.timeoutMs);

        const signal = options.signal
          ? AbortSignal.any([controller.signal, options.signal])
          : controller.signal;

        const res = await fetch(url, {
          ...options,
          headers,
          signal,
        });

        clearTimeout(timeoutId);

        // 2xx → success
        if (res.ok) {
          const ct = res.headers.get("content-type") || "";
          let result;
          if (ct.includes("application/json")) result = await res.json();
          else if (ct.includes("text")) result = await res.text();
          else result = await res.blob();

          // Cache GET results
          if (method === "GET") {
            this._cache.set(url, { data: result, timestamp: Date.now() });
          }
          return result;
        }

        // Failed response
        const errBody = await res.text().catch(() => res.statusText);
        const err = new Error(`API ${res.status}: ${errBody}`);
        err.status = res.status;

        // Retryable?
        if (this._isRetryable(null, res.status) && attempt <= retryConfig.maxRetries) {
          const retryAfterMs = this._parseRetryAfter(res.headers);
          const delay = retryAfterMs != null
            ? Math.min(retryAfterMs, retryConfig.maxDelayMs)
            : Math.min(
                retryConfig.initialDelayMs * Math.pow(retryConfig.backoffMultiplier, attempt - 1),
                retryConfig.maxDelayMs
              );

          console.warn(
            `[fps] HTTP ${res.status}, attempt ${attempt}/${retryConfig.maxRetries + 1} — waiting ${delay}ms...`
          );
          await this._sleep(delay);
          lastError = err;
          continue;
        }

        lastError = err;
        break;

      } catch (fetchErr) {
        let requestError = fetchErr;

        // Timeout AbortError
        if (requestError.name === "AbortError" && !options.signal?.aborted) {
          requestError = new Error(`Request timed out after ${retryConfig.timeoutMs}ms`);
          requestError.status = 0;
        }

        // Retryable network error?
        if (this._isRetryable(requestError, requestError.status || 0) && attempt <= retryConfig.maxRetries) {
          const delay = Math.min(
            retryConfig.initialDelayMs * Math.pow(retryConfig.backoffMultiplier, attempt - 1),
            retryConfig.maxDelayMs
          );
          console.warn(
            `[fps] Network error (${requestError.message}), attempt ${attempt}/${retryConfig.maxRetries + 1} — waiting ${delay}ms...`
          );
          await this._sleep(delay);
          lastError = requestError;
          continue;
        }

        // Wrap connection errors with helpful messages
        if (requestError.message?.includes("ECONNREFUSED") || requestError.message?.includes("fetch failed")) {
          const helpful = new Error(
            `Cannot connect to Flow Prompt Studio backend at ${this.baseUrl}\n` +
            `  Make sure the backend is running. Check with: fps config`
          );
          helpful.status = 0;
          throw helpful;
        }

        lastError = requestError;
        break;
      }
    }

    // All attempts exhausted
    throw new Error(
      `Failed after ${retryConfig.maxRetries + 1} attempts: ${lastError?.message || "Unknown error"}`
    );
  }

  /** Clear the in-memory cache */
  clearCache() {
    this._cache.clear();
  }

  /* ── Session ── */
  async getSession() { return this._request("/session"); }
  async resetSession() { return this._request("/session/reset", { method: "POST" }); }

  /* ── Screenplay ── */
  async uploadScreenplay(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    const fileBuffer = fs.readFileSync(filePath);
    const blob = new Blob([fileBuffer], { type: "application/octet-stream" });
    const fd = new FormData();
    fd.append("file", blob, path.basename(filePath));

    const res = await fetch(`${this.baseUrl}/screenplay/upload`, {
      method: "POST",
      body: fd,
      signal: AbortSignal.timeout(this.retryConfig.timeoutMs),
    });

    if (!res.ok) {
      const errBody = await res.text().catch(() => res.statusText);
      throw new Error(`Upload failed (HTTP ${res.status}): ${errBody}`);
    }

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

  /**
   * Estimate shot count and duration for a screenplay file (dry-run).
   * Reads scene count locally without uploading.
   */
  async estimate(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }
    const content = fs.readFileSync(filePath, "utf-8");
    // Naive scene detection: look for scene markers
    const sceneMatches = content.match(/(?:SAHNE|SCENE|SCÈNE|SCENA|SZENE)\s*[:.\-—]?\s*\d+/gi) || [];
    const estimatedScenes = sceneMatches.length || Math.ceil(content.length / 2000);
    return {
      filename: path.basename(filePath),
      fileSizeKb: Math.round(fs.statSync(filePath).size / 1024),
      estimatedScenes,
      estimatedShots: estimatedScenes * 11, // ~11 shots per scene average
      estimatedDurationMinutes: Math.round(estimatedScenes * 0.3),
    };
  }

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
