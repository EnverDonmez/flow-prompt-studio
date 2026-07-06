/**
 * Flow Prompt Studio — API Client
 * Backend API ile haberleşme katmanı.
 * Retry, timeout ve exponential backoff desteği.
 */

const fs = require("fs");
const path = require("path");

const API_BASE = process.env.FPS_API_URL || "http://localhost:8000/api/v1";

/** Varsayılan retry yapılandırması */
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
  }

  /**
   * Retry'lanabilir hata mı kontrolü.
   * Ağ hataları ve belirli HTTP durum kodları retry'lanır.
   */
  _isRetryable(error, status) {
    if (status && this.retryConfig.retryableStatuses.includes(status)) {
      return true;
    }
    // Ağ hataları (fetch failed, DNS, connection refused vs.)
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

  /**
   * Belirtilen ms kadar bekle.
   */
  _sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Retry-After header'ından bekleme süresi çıkar.
   */
  _parseRetryAfter(headers) {
    const raw = headers.get("retry-after");
    if (!raw) return null;
    // Saniye cinsinden (örn: "120")
    const seconds = parseInt(raw, 10);
    if (!isNaN(seconds)) return seconds * 1000;
    // HTTP-date formatı (örn: "Wed, 21 Oct 2015 07:28:00 GMT")
    const date = new Date(raw);
    if (!isNaN(date.getTime())) return Math.max(0, date.getTime() - Date.now());
    return null;
  }

  /**
   * Core HTTP istek metodu — retry, timeout ve hata yönetimi ile.
   *
   * @param {string} path - API endpoint yolu (örn: "/session")
   * @param {object} options - Fetch seçenekleri
   * @returns {Promise<any>} JSON, text veya blob yanıt
   */
  async _request(path, options = {}) {
    const url = `${this.baseUrl}${path}`;
    const headers = { ...options.headers };
    const { retryConfig } = this;

    // Content-Type: FormData için fetch boundary'yi kendi ekler
    if (!(options.body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
    }

    let lastError = null;
    let attempt = 0;

    while (attempt <= retryConfig.maxRetries) {
      attempt++;

      try {
        // Timeout kontrolü
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), retryConfig.timeoutMs);

        const signal = options.signal
          ? // İki sinyali birleştir: bizim timeout + dışarıdan gelen
            AbortSignal.any([controller.signal, options.signal])
          : controller.signal;

        const res = await fetch(url, {
          ...options,
          headers,
          signal,
        });

        clearTimeout(timeoutId);

        // 2xx → başarılı
        if (res.ok) {
          const ct = res.headers.get("content-type") || "";
          if (ct.includes("application/json")) return res.json();
          if (ct.includes("text")) return res.text();
          return res.blob();
        }

        // Başarısız yanıt
        const errBody = await res.text().catch(() => res.statusText);
        const err = new Error(`API ${res.status}: ${errBody}`);
        err.status = res.status;

        // Retry'lanabilir mi?
        if (this._isRetryable(null, res.status) && attempt <= retryConfig.maxRetries) {
          // Retry-After header'ına saygı göster
          const retryAfterMs = this._parseRetryAfter(res.headers);
          const delay = retryAfterMs != null
            ? Math.min(retryAfterMs, retryConfig.maxDelayMs)
            : Math.min(
                retryConfig.initialDelayMs * Math.pow(retryConfig.backoffMultiplier, attempt - 1),
                retryConfig.maxDelayMs
              );

          console.warn(
            `[fps] ${res.status} yanıtı, ${attempt}/${retryConfig.maxRetries} deneme — ${delay}ms bekleniyor...`
          );
          await this._sleep(delay);
          lastError = err;
          continue;
        }

        // Retry hakkı kalmadıysa veya retry'lanamaz statü ise
        lastError = err;
        break;

      } catch (fetchErr) {
        clearTimeout(undefined); // safe no-op if timeoutId out of scope

        // Timeout'tan gelen AbortError
        if (fetchErr.name === "AbortError" && !options.signal?.aborted) {
          fetchErr = new Error(`İstek timeout: ${retryConfig.timeoutMs}ms`);
          fetchErr.status = 0;
        }

        // Retry'lanabilir ağ hatası mı?
        if (this._isRetryable(fetchErr, fetchErr.status || 0) && attempt <= retryConfig.maxRetries) {
          const delay = Math.min(
            retryConfig.initialDelayMs * Math.pow(retryConfig.backoffMultiplier, attempt - 1),
            retryConfig.maxDelayMs
          );
          console.warn(
            `[fps] Ağ hatası (${fetchErr.message}), ${attempt}/${retryConfig.maxRetries} deneme — ${delay}ms bekleniyor...`
          );
          await this._sleep(delay);
          lastError = fetchErr;
          continue;
        }

        lastError = fetchErr;
        break;
      }
    }

    // Tüm denemeler tükendi
    throw new Error(
      `${retryConfig.maxRetries + 1} deneme sonrası başarısız: ${lastError?.message || "Bilinmeyen hata"}`
    );
  }

  /* ── Session ── */
  async getSession() { return this._request("/session"); }
  async resetSession() { return this._request("/session/reset", { method: "POST" }); }

  /* ── Screenplay ── */
  async uploadScreenplay(filePath) {
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
      throw new Error(`API ${res.status}: ${errBody}`);
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
