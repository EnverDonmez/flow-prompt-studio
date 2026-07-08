/**
 * Flow Prompt Studio — Source Ingest Helper
 *
 * Prepares screenplay/Vizyon sources for parsing without adding PDF runtime dependencies.
 */

const fs = require("fs");
const path = require("path");
const { execFileSync } = require("child_process");
const { ScreenplayParser } = require("./parser");

class IngestHelper {
  static ingest(filePath, outputDir = "./fps-ingest", options = {}) {
    if (!fs.existsSync(filePath)) throw new Error(`File not found: ${filePath}`);

    const ext = path.extname(filePath).toLowerCase();
    const title = options.title || path.basename(filePath, ext);
    const slug = this._slug(title);
    const rootDir = path.join(outputDir, slug);
    this._ensureDir(rootDir);

    if (ext === ".pdf") {
      return this._ingestPdf(filePath, rootDir, title, options);
    }

    const text = this._readSourceText(filePath, ext);
    const normalizedPath = path.join(rootDir, `${slug}.flow.txt`);
    this._writeFile(normalizedPath, this._normalizeText(text));
    const parseResult = ScreenplayParser.parse(normalizedPath);

    const files = [
      normalizedPath,
      this._writeFile(path.join(rootDir, "ingest-report.md"), this._reportMarkdown({
        title,
        source: filePath,
        normalizedPath,
        parseResult,
        manual: false,
      })),
      this._writeFile(path.join(rootDir, "parse-result.json"), JSON.stringify(parseResult, null, 2)),
    ];

    return {
      title,
      source: filePath,
      outputDir: rootDir,
      normalizedPath,
      manual: false,
      parseResult,
      files,
    };
  }

  static _ingestPdf(filePath, rootDir, title, options) {
    const slug = this._slug(title);
    const normalizedPath = path.join(rootDir, `${slug}.flow.txt`);
    const pdftotext = Object.prototype.hasOwnProperty.call(options, "pdftotextPath")
      ? options.pdftotextPath
      : this._findPdftotext();

    if (!pdftotext) {
      const instructionsPath = path.join(rootDir, "PDF_INGEST_INSTRUCTIONS.md");
      const instructions = this._pdfInstructions(filePath, normalizedPath);
      this._writeFile(instructionsPath, instructions);
      return {
        title,
        source: filePath,
        outputDir: rootDir,
        normalizedPath,
        manual: true,
        parseResult: null,
        files: [instructionsPath],
        message: "PDF text extraction requires pdftotext. Instructions were written for manual preparation.",
      };
    }

    try {
      execFileSync(pdftotext, ["-layout", filePath, normalizedPath], { stdio: "ignore" });
    } catch (err) {
      throw new Error(`PDF extraction failed with pdftotext: ${err.message}`);
    }

    const text = fs.readFileSync(normalizedPath, "utf-8");
    this._writeFile(normalizedPath, this._normalizeText(text));
    const parseResult = ScreenplayParser.parse(normalizedPath);
    const files = [
      normalizedPath,
      this._writeFile(path.join(rootDir, "ingest-report.md"), this._reportMarkdown({
        title,
        source: filePath,
        normalizedPath,
        parseResult,
        manual: false,
      })),
      this._writeFile(path.join(rootDir, "parse-result.json"), JSON.stringify(parseResult, null, 2)),
    ];

    return {
      title,
      source: filePath,
      outputDir: rootDir,
      normalizedPath,
      manual: false,
      parseResult,
      files,
    };
  }

  static _readSourceText(filePath, ext) {
    if (ext === ".fdx") return ScreenplayParser._parseFdx(filePath);
    return fs.readFileSync(filePath, "utf-8");
  }

  static _normalizeText(text) {
    return String(text || "")
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n")
      .split("\n")
      .map((line) => line.replace(/[ \t]+$/g, ""))
      .join("\n")
      .trim() + "\n";
  }

  static _reportMarkdown({ title, source, normalizedPath, parseResult, manual }) {
    let md = `# ${title} — Ingest Report\n\n`;
    md += `**Source:** ${source}\n`;
    md += `**Prepared text:** ${normalizedPath}\n`;
    md += `**Manual extraction required:** ${manual ? "yes" : "no"}\n\n`;
    if (parseResult) {
      md += `## Parse Summary\n\n`;
      md += `- Scenes: ${parseResult.stats.totalScenes}\n`;
      md += `- Characters: ${parseResult.stats.totalCharacters}\n`;
      md += `- Dialogue lines: ${parseResult.stats.totalDialogueLines}\n`;
      md += `- Estimated pages: ${parseResult.stats.estimatedPages}\n\n`;
      md += `## Next Step\n\n`;
      md += `Run:\n\n`;
      md += "```bash\n";
      md += `fps production-pack "${normalizedPath}"\n`;
      md += "```\n";
    }
    return md;
  }

  static _pdfInstructions(source, target) {
    return [
      "# PDF Ingest Instructions",
      "",
      "Flow Prompt Studio does not ship a PDF parser dependency. This keeps the npm package small and offline-first.",
      "",
      "Recommended options:",
      "",
      "1. Install Poppler and rerun ingest:",
      "",
      "```bash",
      "brew install poppler",
      `fps ingest "${source}"`,
      "```",
      "",
      "2. Or manually export/copy the PDF text into:",
      "",
      "```text",
      target,
      "```",
      "",
      "Then run:",
      "",
      "```bash",
      `fps production-pack "${target}"`,
      "```",
      "",
    ].join("\n");
  }

  static _findPdftotext() {
    const candidates = [
      "/opt/homebrew/bin/pdftotext",
      "/usr/local/bin/pdftotext",
      "/usr/bin/pdftotext",
    ];
    for (const candidate of candidates) {
      if (fs.existsSync(candidate)) return candidate;
    }
    try {
      const result = execFileSync("which", ["pdftotext"], { encoding: "utf-8", stdio: ["ignore", "pipe", "ignore"] }).trim();
      return result || null;
    } catch {
      return null;
    }
  }

  static _slug(value) {
    return String(value || "ingest")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "ingest";
  }

  static _ensureDir(dir) {
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  }

  static _writeFile(filePath, content) {
    this._ensureDir(path.dirname(filePath));
    fs.writeFileSync(filePath, content, "utf-8");
    return filePath;
  }
}

module.exports = { IngestHelper };
