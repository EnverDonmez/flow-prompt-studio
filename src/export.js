/**
 * Flow Prompt Studio — File Export Engine
 *
 * Writes analysis results and shot plans to disk in various formats.
 * Supports CSV, JSON, Markdown, and single-page HTML storyboard.
 * All operations are synchronous and offline.
 */

const fs = require("fs");
const path = require("path");

/* ─── Export Engine ─── */

class FileExporter {
  /**
   * Ensure output directory exists.
   */
  static _ensureDir(dir) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  /**
   * Write content to file, creating directories as needed.
   */
  static _writeFile(filePath, content) {
    this._ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, content, "utf-8");
    return filePath;
  }

  /* ─── Parse Result Exports ─── */

  /**
   * Export screenplay parse result.
   * @param {object} parseResult - Output from ScreenplayParser.parse()
   * @param {string} format - "json" | "csv" | "markdown"
   * @param {string} outputDir - Directory to write to
   * @returns {string} Path to the written file
   */
  static exportParseResult(parseResult, format, outputDir) {
    this._ensureDir(outputDir);
    const { scenes, characters, stats } = parseResult;
    const baseName = path.basename(stats.filename, path.extname(stats.filename));

    switch (format.toLowerCase()) {
      case "json":
        return this._writeFile(
          path.join(outputDir, `${baseName}-analysis.json`),
          JSON.stringify({ scenes, characters, stats }, null, 2)
        );

      case "csv": {
        const csvHeaders = ["Scene #", "Number", "Heading", "Location", "Line", "Dialogue Lines", "Characters"];
        const csvRows = [csvHeaders.join(",")];
        scenes.forEach((s) => {
          csvRows.push(
            [s.index, s.number, `"${(s.heading || "").replace(/"/g, '""')}"`,
             `"${(s.location || "").replace(/"/g, '""')}"`, s.lineNumber,
             s.dialogueCount, `"${s.characters.join("; ")}"`].join(",")
          );
        });
        return this._writeFile(path.join(outputDir, `${baseName}-analysis.csv`), csvRows.join("\n"));
      }

      case "markdown": {
        let md = `# Screenplay Analysis — ${stats.filename}\n\n`;
        md += `## Statistics\n\n`;
        md += `| Metric | Value |\n|--------|-------|\n`;
        md += `| Scenes | ${stats.totalScenes} |\n`;
        md += `| Characters | ${stats.totalCharacters} |\n`;
        md += `| Dialogue Lines | ${stats.totalDialogueLines} |\n`;
        md += `| Est. Pages | ${stats.estimatedPages} |\n`;
        md += `| Est. Duration | ~${stats.estimatedDurationMinutes} min |\n\n`;
        md += `## Characters\n\n`;
        characters.forEach((c) => (md += `- **${c.name}** (${c.count} appearances)\n`));
        md += `\n## Scenes\n\n`;
        md += `| # | Heading | Location | Dialogue | Characters |\n`;
        md += `|---|---------|----------|----------|------------|\n`;
        scenes.forEach((s) => {
          md += `| ${s.index} | ${s.heading} | ${s.location} | ${s.dialogueCount} | ${s.characters.join(", ")} |\n`;
        });
        return this._writeFile(path.join(outputDir, `${baseName}-analysis.md`), md);
      }

      default:
        throw new Error(`Unsupported format: ${format}. Use: json, csv, markdown`);
    }
  }

  /* ─── Shot Plan Exports ─── */

  /**
   * Export coverage/shot plan result.
   * @param {object} coverageResult - Output from CoverageGenerator.generate()
   * @param {string} format - "json" | "csv" | "markdown" | "html"
   * @param {string} outputDir - Directory to write to
   * @returns {string} Path to the written file
   */
  static exportShotPlan(coverageResult, format, outputDir) {
    this._ensureDir(outputDir);
    const { genre } = coverageResult;

    switch (format.toLowerCase()) {
      case "json":
        return this._writeFile(
          path.join(outputDir, `shot-plan-${genre.key}.json`),
          JSON.stringify(coverageResult, null, 2)
        );

      case "csv": {
        const { CoverageGenerator } = require("./coverage");
        const csv = CoverageGenerator.toCSV(coverageResult);
        return this._writeFile(path.join(outputDir, `shot-plan-${genre.key}.csv`), csv);
      }

      case "markdown": {
        const { CoverageGenerator } = require("./coverage");
        const md = CoverageGenerator.toMarkdown(coverageResult);
        return this._writeFile(path.join(outputDir, `shot-plan-${genre.key}.md`), md);
      }

      case "html":
        return this._writeFile(
          path.join(outputDir, `shot-plan-${genre.key}.html`),
          this._shotPlanToHtml(coverageResult)
        );

      default:
        throw new Error(`Unsupported format: ${format}. Use: json, csv, markdown, html`);
    }
  }

  /* ─── JSON to stdout (pipe-friendly) ─── */

  /**
   * Output JSON to stdout for piping.
   * @param {object} data - Any JSON-serializable data
   */
  static toStdout(data) {
    process.stdout.write(JSON.stringify(data, null, 2) + "\n");
  }

  /* ─── HTML Storyboard ─── */

  /**
   * Generate a single-page HTML storyboard view.
   */
  static _shotPlanToHtml(coverageResult) {
    const { genre, sceneCount, totalShots, shotRows } = coverageResult;
    const shotCards = shotRows
      .map(
        (r) => `
      <div class="shot-card">
        <div class="shot-number">#${r["Shot #"]}</div>
        <div class="shot-type">${r["Shot Type"]}</div>
        <div class="shot-name">${r["Shot Name"]}</div>
        <div class="shot-scene">${r["Scene"]}: ${r["Scene Heading"]}</div>
        <div class="shot-desc">${r["Description"]}</div>
        <div class="shot-duration">${r["Typical Duration"]}</div>
        <div class="shot-characters">${r["Characters"] || "—"}</div>
      </div>`
      )
      .join("\n");

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Shot Plan — ${genre.name}</title>
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; background: #1a1a2e; color: #eee; padding: 20px; }
    .header { text-align: center; padding: 30px 0; border-bottom: 1px solid #333; margin-bottom: 30px; }
    .header h1 { font-size: 2em; color: #e94560; }
    .header p { color: #888; margin-top: 8px; }
    .stats { display: flex; justify-content: center; gap: 30px; margin: 20px 0; flex-wrap: wrap; }
    .stat { background: #16213e; padding: 15px 25px; border-radius: 8px; text-align: center; }
    .stat-value { font-size: 2em; font-weight: bold; color: #e94560; }
    .stat-label { font-size: 0.8em; color: #888; margin-top: 4px; }
    .grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 16px; }
    .shot-card { background: #16213e; border-radius: 10px; padding: 16px; border-left: 4px solid #e94560; transition: transform .15s; }
    .shot-card:hover { transform: translateY(-2px); }
    .shot-number { font-size: 0.75em; color: #888; }
    .shot-type { font-size: 1.2em; font-weight: bold; color: #e94560; margin: 4px 0; }
    .shot-name { color: #ccc; margin-bottom: 8px; }
    .shot-scene { font-size: 0.85em; color: #aaa; margin: 4px 0; }
    .shot-desc { font-size: 0.85em; color: #999; font-style: italic; margin: 6px 0; }
    .shot-duration { font-size: 0.8em; color: #666; }
    .shot-characters { font-size: 0.8em; color: #555; margin-top: 6px; }
    .footer { text-align: center; padding: 30px; color: #555; font-size: 0.8em; }
    @media (prefers-color-scheme: light) {
      body { background: #f5f5f5; color: #333; }
      .header { border-color: #ddd; }
      .header h1 { color: #c0392b; }
      .stat { background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,.08); }
      .stat-value { color: #c0392b; }
      .shot-card { background: #fff; box-shadow: 0 2px 8px rgba(0,0,0,.06); border-left-color: #c0392b; }
      .shot-type { color: #c0392b; }
      .shot-name { color: #555; }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>Shot Coverage Plan</h1>
    <p>${genre.name} — ${genre.description}</p>
  </div>
  <div class="stats">
    <div class="stat"><div class="stat-value">${sceneCount}</div><div class="stat-label">Scenes</div></div>
    <div class="stat"><div class="stat-value">${totalShots}</div><div class="stat-label">Total Shots</div></div>
    <div class="stat"><div class="stat-value">${coverageResult.averageShotsPerScene}</div><div class="stat-label">Avg Shots/Scene</div></div>
    <div class="stat"><div class="stat-value">~${coverageResult.estimatedDurationMinutes}m</div><div class="stat-label">Est. Duration</div></div>
  </div>
  <div class="grid">
    ${shotCards}
  </div>
  <div class="footer">
    <p>Generated by Flow Prompt Studio — ${new Date().toISOString().split("T")[0]}</p>
    <p>Pacing: ${genre.pacing}</p>
  </div>
</body>
</html>`;
  }
}

module.exports = { FileExporter };
