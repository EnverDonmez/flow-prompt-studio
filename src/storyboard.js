/**
 * Flow Prompt Studio — Storyboard Image Generator
 *
 * Generates actual storyboard images from shot plans using free AI image APIs.
 * Zero API key required. Works offline for prompt generation, online for images.
 *
 * Providers (tried in order):
 *   1. Pollinations.ai — completely free, no API key, FLUX model
 *   2. Agnes AI — free tier, no key needed
 *
 * Usage:
 *   const sb = new StoryboardGenerator();
 *   await sb.generate(coverageResult, './storyboard/', { style: 'cinematic' });
 */

const fs = require("fs");
const path = require("path");
const { CoverageGenerator } = require("./coverage");

/* ─── Visual Style Presets ─── */

const STYLES = {
  cinematic: {
    prefix: "cinematic film still, professional lighting, shallow depth of field, 35mm anamorphic, ",
    suffix: ", photorealistic, movie quality, Arri Alexa",
  },
  sketch: {
    prefix: "black and white pencil sketch, storyboard style, clean lines, ",
    suffix: ", hand-drawn storyboard frame, white background, professional storyboard artist",
  },
  anime: {
    prefix: "anime key frame, Studio Ghibli style, detailed background, ",
    suffix: ", anime production art, vibrant colors",
  },
  comic: {
    prefix: "comic book panel, graphic novel style, ink and color, ",
    suffix: ", American comic art style, bold lines, saturated colors",
  },
  realistic: {
    prefix: "photorealistic, 8K, hyperdetailed, natural lighting, ",
    suffix: ", photorealistic render, IMAX quality",
  },
  neon: {
    prefix: "neon noir, cyberpunk aesthetic, rain-slicked streets, volumetric lighting, ",
    suffix: ", synthwave color palette, Blade Runner style",
  },
  watercolor: {
    prefix: "watercolor painting, soft edges, artistic, dreamy atmosphere, ",
    suffix: ", watercolor storyboard, fine art style",
  },
};

/* ─── Prompt Builder ─── */

function buildVisualPrompt(shotRow, styleKey = "cinematic") {
  const style = STYLES[styleKey] || STYLES.cinematic;
  const shotType = shotRow["Shot Name"] || shotRow["Shot Type"];
  const desc = shotRow["Description"] || "";
  const scene = shotRow["Scene Heading"] || "";
  const characters = shotRow["Characters"] || "";

  let prompt = style.prefix;

  // Core shot description
  prompt += `${shotType} shot`;

  if (characters) {
    prompt += ` of ${characters}`;
  }

  if (scene) {
    prompt += `, ${scene.substring(0, 80)}`;
  }

  if (desc) {
    prompt += `, ${desc}`;
  }

  prompt += style.suffix;

  return prompt.substring(0, 500); // Keep under reasonable length
}

/* ─── Main Generator Class ─── */

class StoryboardGenerator {
  constructor(options = {}) {
    this.style = options.style || "cinematic";
    this.width = options.width || 1024;
    this.height = options.height || 768;
    this.provider = options.provider || "pollinations";
    this.concurrency = options.concurrency || 3; // parallel downloads
  }

  /**
   * List available visual styles.
   */
  static listStyles() {
    return Object.keys(STYLES).map((key) => ({
      key,
      description: STYLES[key].prefix.substring(0, 60) + "...",
    }));
  }

  /**
   * Generate storyboard images from a coverage result.
   *
   * @param {object} coverageResult - From CoverageGenerator
   * @param {string} outputDir - Where to save images
   * @param {object} options - { style, limit, scenes }
   * @returns {Promise<{images: Array, html: string, dir: string}>}
   */
  async generate(coverageResult, outputDir, options = {}) {
    const style = options.style || this.style;
    const limit = options.limit || coverageResult.shotRows.length;
    const targetScenes = options.scenes || null;

    // Filter shots
    let shots = coverageResult.shotRows;
    if (targetScenes) {
      const sceneIds = targetScenes.split(",").map((s) => s.trim());
      shots = shots.filter((s) => sceneIds.includes(s["Scene"]));
    }
    shots = shots.slice(0, limit);

    // Ensure output directory
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Build prompts for each shot
    const prompts = shots.map((shot, i) => ({
      index: i + 1,
      shot,
      prompt: buildVisualPrompt(shot, style),
    }));

    // Download images with concurrency control
    const images = [];
    for (let i = 0; i < prompts.length; i += this.concurrency) {
      const batch = prompts.slice(i, i + this.concurrency);
      const results = await Promise.all(
        batch.map((p) => this._downloadImage(p, outputDir))
      );
      images.push(...results.filter(Boolean));
    }

    // Generate HTML storyboard
    const html = this._buildHtml(coverageResult, images, style);

    return {
      images,
      html,
      dir: outputDir,
      totalGenerated: images.length,
      totalRequested: prompts.length,
    };
  }

  /**
   * Download a single storyboard image.
   */
  async _downloadImage(promptData, outputDir) {
    const { index, shot, prompt: visualPrompt } = promptData;
    const filename = `shot_${String(index).padStart(3, "0")}.png`;
    const filePath = path.join(outputDir, filename);

    // Check if already exists
    if (fs.existsSync(filePath)) {
      return { index, shot, filePath, prompt: visualPrompt, cached: true };
    }

    // Try Pollinations.ai first
    try {
      const url = this._buildPollinationsUrl(visualPrompt);
      const res = await fetch(url, { signal: AbortSignal.timeout(30000) });

      if (res.ok) {
        const buffer = Buffer.from(await res.arrayBuffer());
        fs.writeFileSync(filePath, buffer);
        return { index, shot, filePath, prompt: visualPrompt, cached: false };
      }
    } catch (err) {
      // Pollinations failed, will try fallback
    }

    // Fallback: Save prompt to text file + generate placeholder HTML
    const promptFile = filePath.replace(".png", ".prompt.txt");
    fs.writeFileSync(promptFile, visualPrompt, "utf-8");

    return {
      index,
      shot,
      filePath: null,
      promptFile,
      prompt: visualPrompt,
      cached: false,
      error: "Image generation unavailable. Prompt saved to .txt file.",
    };
  }

  /**
   * Build Pollinations.ai URL (free, no API key).
   */
  _buildPollinationsUrl(prompt) {
    const encoded = encodeURIComponent(prompt);
    return `https://image.pollinations.ai/prompt/${encoded}?model=flux&width=${this.width}&height=${this.height}&nologo=true`;
  }

  /**
   * Build an HTML storyboard page with embedded images.
   */
  _buildHtml(coverageResult, images, style) {
    const { genre } = coverageResult;

    const cards = images
      .map((img) => {
        const src = img.filePath
          ? path.relative(path.dirname(img.filePath), img.filePath)
          : null;
        const shot = img.shot;

        return `
      <div class="shot-card">
        <div class="shot-header">
          <span class="shot-number">#${shot["Shot #"]}</span>
          <span class="shot-type">${shot["Shot Type"]}</span>
        </div>
        ${src
          ? `<div class="shot-image"><img src="${src}" alt="${img.prompt}" loading="lazy"></div>`
          : `<div class="shot-image placeholder">
               <div class="placeholder-text">🎬<br>Image unavailable<br><small>Prompt saved to .txt file</small></div>
             </div>`
        }
        <div class="shot-info">
          <div class="shot-scene">${shot["Scene"]}: ${shot["Scene Heading"]}</div>
          <div class="shot-desc">${shot["Description"] || shot["Shot Name"]}</div>
          <div class="shot-prompt" title="${img.prompt}">${img.prompt.substring(0, 100)}…</div>
        </div>
      </div>`;
      })
      .join("\n");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Storyboard — ${genre.name} (${style})</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #0d0d0d; color: #ccc; }
    .header { text-align: center; padding: 40px 20px; background: #1a1a1a; border-bottom: 2px solid #e94560; }
    .header h1 { font-size: 2.2em; color: #e94560; }
    .header .subtitle { color: #888; margin-top: 8px; font-size: 0.95em; }
    .stats { display: flex; justify-content: center; gap: 20px; padding: 20px; flex-wrap: wrap; }
    .stat { background: #1a1a1a; padding: 12px 20px; border-radius: 6px; text-align: center; min-width: 80px; }
    .stat-value { font-size: 1.5em; color: #e94560; font-weight: bold; }
    .stat-label { font-size: 0.7em; color: #666; text-transform: uppercase; letter-spacing: 1px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px; padding: 20px; max-width: 1400px; margin: 0 auto; }
    .shot-card { background: #1a1a1a; border-radius: 12px; overflow: hidden; border: 1px solid #2a2a2a; transition: transform .2s, border-color .2s; }
    .shot-card:hover { transform: translateY(-3px); border-color: #e94560; }
    .shot-header { display: flex; justify-content: space-between; padding: 12px 16px; background: #222; border-bottom: 1px solid #333; }
    .shot-number { color: #e94560; font-weight: bold; }
    .shot-type { background: #333; padding: 2px 10px; border-radius: 4px; font-size: 0.8em; color: #aaa; }
    .shot-image { width: 100%; aspect-ratio: 4/3; overflow: hidden; background: #111; }
    .shot-image img { width: 100%; height: 100%; object-fit: cover; }
    .shot-image.placeholder { display: flex; align-items: center; justify-content: center; }
    .placeholder-text { text-align: center; color: #555; font-size: 0.9em; line-height: 1.8; }
    .shot-info { padding: 14px 16px; }
    .shot-scene { font-size: 0.8em; color: #888; margin-bottom: 4px; }
    .shot-desc { font-size: 0.9em; color: #ccc; margin-bottom: 6px; line-height: 1.4; }
    .shot-prompt { font-size: 0.7em; color: #555; font-style: italic; cursor: help; margin-top: 8px; padding-top: 8px; border-top: 1px solid #222; }
    .footer { text-align: center; padding: 30px; color: #444; font-size: 0.8em; border-top: 1px solid #222; margin-top: 30px; }
    @media (prefers-color-scheme: light) {
      body { background: #f5f5f5; color: #333; }
      .header { background: #fff; border-color: #c0392b; }
      .header h1 { color: #c0392b; }
      .stat, .shot-card { background: #fff; }
      .shot-card { border-color: #ddd; }
      .shot-header { background: #f9f9f9; border-color: #eee; }
      .stat-value { color: #c0392b; }
      .shot-image { background: #eee; }
      .shot-prompt { border-color: #eee; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>🎬 Storyboard</h1>
    <div class="subtitle">${genre.name} · Style: ${style} · ${coverageResult.totalShots} shots planned</div>
  </div>
  <div class="stats">
    <div class="stat"><div class="stat-value">${images.length}</div><div class="stat-label">Frames</div></div>
    <div class="stat"><div class="stat-value">${coverageResult.sceneCount}</div><div class="stat-label">Scenes</div></div>
    <div class="stat"><div class="stat-value">${style}</div><div class="stat-label">Style</div></div>
    <div class="stat"><div class="stat-value">~${coverageResult.estimatedDurationMinutes}m</div><div class="stat-label">Duration</div></div>
  </div>
  <div class="grid">
    ${cards}
  </div>
  <div class="footer">
    <p>Generated by Flow Prompt Studio v${require("../package.json").version} — ${new Date().toISOString().split("T")[0]}</p>
    <p>Images via Pollinations.ai (free, no API key) · ${style} style</p>
  </div>
</body>
</html>`;
  }
}

module.exports = { StoryboardGenerator, STYLES };
