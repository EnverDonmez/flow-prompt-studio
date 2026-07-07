/**
 * Flow Prompt Studio — Project Manager
 *
 * Lightweight project management for film productions.
 * Stores project metadata, screenplay versions, coverage plans,
 * and generated assets in a `.fps/project.json` file.
 *
 * Usage:
 *   const pm = new ProjectManager();
 *   pm.init("My Film", "/path/to/project");
 *   pm.addScreenplay("script.txt");
 *   pm.status();
 */

const fs = require("fs");
const path = require("path");
const { ScreenplayParser } = require("./parser");

/* ─── Project Manager ─── */

class ProjectManager {
  constructor(projectDir) {
    this.dir = projectDir || process.cwd();
    this.fpsDir = path.join(this.dir, ".fps");
    this.configPath = path.join(this.fpsDir, "project.json");
  }

  /**
   * Initialize a new project.
   */
  init(title, options = {}) {
    if (!fs.existsSync(this.fpsDir)) {
      fs.mkdirSync(this.fpsDir, { recursive: true });
    }

    if (fs.existsSync(this.configPath) && !options.force) {
      throw new Error(`Project already exists at ${this.configPath}. Use --force to overwrite.`);
    }

    const project = {
      version: "1.0",
      title,
      created: new Date().toISOString(),
      updated: new Date().toISOString(),
      screenplays: [],
      coveragePlans: [],
      exports: [],
      metadata: {
        genre: options.genre || "",
        director: options.director || "",
        producer: options.producer || "",
        dp: options.dp || "",
        notes: options.notes || "",
      },
    };

    fs.writeFileSync(this.configPath, JSON.stringify(project, null, 2), "utf-8");
    return project;
  }

  /**
   * Load existing project.
   */
  load() {
    if (!fs.existsSync(this.configPath)) {
      throw new Error(`No project found. Run 'fps project init "Title"' first.`);
    }
    return JSON.parse(fs.readFileSync(this.configPath, "utf-8"));
  }

  /**
   * Save project.
   */
  save(project) {
    project.updated = new Date().toISOString();
    fs.writeFileSync(this.configPath, JSON.stringify(project, null, 2), "utf-8");
    return project;
  }

  /**
   * Add a screenplay to the project.
   */
  addScreenplay(filePath, options = {}) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const project = this.load();
    const stats = fs.statSync(filePath);
    const parseResult = ScreenplayParser.parse(filePath);

    const entry = {
      id: `sp_${Date.now()}`,
      path: path.relative(this.dir, filePath),
      filename: path.basename(filePath),
      added: new Date().toISOString(),
      fileSize: stats.size,
      analysis: {
        scenes: parseResult.stats.totalScenes,
        characters: parseResult.stats.totalCharacters,
        dialogueLines: parseResult.stats.totalDialogueLines,
        estimatedDuration: parseResult.stats.estimatedDurationMinutes,
      },
      label: options.label || path.basename(filePath, path.extname(filePath)),
    };

    project.screenplays.push(entry);
    project.updated = new Date().toISOString();
    this.save(project);

    return entry;
  }

  /**
   * Record a coverage plan.
   */
  addCoveragePlan(coverageResult, options = {}) {
    const project = this.load();

    const entry = {
      id: `cp_${Date.now()}`,
      genre: coverageResult.genre.key,
      genreName: coverageResult.genre.name,
      scenes: coverageResult.sceneCount,
      totalShots: coverageResult.totalShots,
      created: new Date().toISOString(),
      label: options.label || `${coverageResult.genre.key}-${coverageResult.totalShots}shots`,
    };

    project.coveragePlans.push(entry);
    project.updated = new Date().toISOString();
    project.metadata.genre = coverageResult.genre.key;
    this.save(project);

    return entry;
  }

  /**
   * Record an export.
   */
  addExport(exportType, filePath, options = {}) {
    const project = this.load();

    const entry = {
      type: exportType,
      path: path.relative(this.dir, filePath),
      created: new Date().toISOString(),
      label: options.label || exportType,
    };

    project.exports.push(entry);
    project.updated = new Date().toISOString();
    this.save(project);

    return entry;
  }

  /**
   * Get project status summary.
   */
  status() {
    const project = this.load();
    return {
      title: project.title,
      created: project.created,
      updated: project.updated,
      screenplays: project.screenplays.length,
      coveragePlans: project.coveragePlans.length,
      exports: project.exports.length,
      lastScreenplay: project.screenplays[project.screenplays.length - 1]?.filename || "none",
      lastCoverage: project.coveragePlans[project.coveragePlans.length - 1]?.label || "none",
      metadata: project.metadata,
    };
  }

  /**
   * Export entire project as JSON.
   */
  export() {
    return this.load();
  }
}

module.exports = { ProjectManager };
