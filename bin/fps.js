#!/usr/bin/env node
/**
 * Flow Prompt Studio — CLI
 *
 * Offline-first screenplay parser & shot coverage generator.
 * Backend is optional — only needed for AI prompt generation.
 *
 * Usage:
 *   fps parse <screenplay>            Parse screenplay locally
 *   fps shots <genre>                 Generate shot coverage plan
 *   fps template <genre>              Show genre template details
 *   fps export <type> -f <fmt> -o <dir>  Export to files
 *   fps interactive                   Step-by-step wizard
 *   fps workflow <screenplay>         Hybrid: local + optional AI
 */

const { program } = require("commander");
const fs = require("fs");
const path = require("path");
const os = require("os");
const readline = require("readline");
const { FlowPromptStudioClient } = require("../src/client");
const { ScreenplayParser } = require("../src/parser");
const { CoverageGenerator } = require("../src/coverage");
const { FileExporter } = require("../src/export");
const { AIPromptGenerator } = require("../src/generate");
const { StoryboardGenerator } = require("../src/storyboard");
const { ScreenJSONConverter } = require("../src/screenjson");
const { CallSheetGenerator } = require("../src/callsheet");
const { BudgetEstimator } = require("../src/budget");
const { ProjectManager } = require("../src/project");
const { chalk, spinner } = require("../src/utils");

const pkg = require("../package.json");
const client = new FlowPromptStudioClient();

/* ── Helper: uniform error handling ── */
function withErrorHandler(fn) {
  return async (...args) => {
    try {
      await fn(...args);
    } catch (err) {
      console.error(chalk.red(`\n❌ ${err.message}`));
      if (err.message?.includes("ECONNREFUSED") || err.message?.includes("Cannot connect")) {
        console.error(chalk.gray(`\nTip: This command requires the backend. Start it or use offline commands:`));
        console.error(chalk.gray(`     fps parse, fps shots, fps template, fps interactive`));
      }
      process.exit(1);
    }
  };
}

/* ── Helper: prompt user for input ── */
function ask(rl, question) {
  return new Promise((resolve) => {
    rl.question(question, (answer) => resolve(answer.trim()));
  });
}

program
  .name("fps")
  .description("Offline-first screenplay parser & shot coverage generator — no backend required")
  .version(pkg.version);

/* ═══════════════════════════════════════════
   OFFLINE COMMANDS (no backend needed)
   ═══════════════════════════════════════════ */

/* ── parse ── */
program
  .command("parse <file>")
  .description("Parse screenplay locally — extract scenes, characters, dialogue")
  .option("--json", "Output as JSON (pipe-friendly)")
  .option("--csv", "Output as CSV")
  .option("--markdown", "Output as Markdown")
  .action(withErrorHandler(async (file, opts) => {
    if (!fs.existsSync(file)) {
      console.error(chalk.red(`File not found: ${file}`));
      process.exit(1);
    }

    const spin = spinner("Parsing screenplay...");
    const result = ScreenplayParser.parse(file);
    const { scenes, characters, stats } = result;
    spin.stop(chalk.green(`✓ Parsed: ${stats.totalScenes} scenes, ${stats.totalCharacters} characters`));

    if (opts.json) {
      console.log(JSON.stringify(result, null, 2));
      return;
    }

    if (opts.csv) {
      console.log("Scene #,Number,Heading,Location,Line,Dialogue Lines,Characters");
      scenes.forEach((s) => {
        console.log(`${s.index},${s.number},"${(s.heading || "").replace(/"/g, '""')}","${(s.location || "").replace(/"/g, '""')}",${s.lineNumber},${s.dialogueCount},"${s.characters.join("; ")}"`);
      });
      return;
    }

    if (opts.markdown) {
      let md = `# Screenplay Analysis — ${stats.filename}\n\n`;
      md += `## Stats\n\n| Scenes | Characters | Dialogue Lines | Est. Pages | Est. Duration |\n`;
      md += `|--------|------------|----------------|------------|---------------|\n`;
      md += `| ${stats.totalScenes} | ${stats.totalCharacters} | ${stats.totalDialogueLines} | ${stats.estimatedPages} | ~${stats.estimatedDurationMinutes} min |\n\n`;
      md += `## Characters\n\n`;
      characters.forEach((c) => (md += `- **${c.name}** (${c.count}x)\n`));
      md += `\n## Scenes\n\n`;
      scenes.forEach((s) => (md += `### ${s.number}: ${s.heading}\n- Line ${s.lineNumber}, ${s.dialogueCount} dialogue lines\n- Characters: ${s.characters.join(", ") || "none"}\n\n`));
      console.log(md);
      return;
    }

    // Default pretty output
    console.log(chalk.yellow(`\n📊 ${stats.totalScenes} scenes, ${stats.totalCharacters} characters, ${stats.totalDialogueLines} dialogue lines`));
    console.log(chalk.gray(`   ~${stats.estimatedPages} pages, ~${stats.estimatedDurationMinutes} min`));
    console.log(chalk.yellow(`\nCharacters:`));
    characters.slice(0, 15).forEach((c) => console.log(`   ${c.name} (${c.count}x)`));
    if (characters.length > 15) console.log(chalk.gray(`   ... and ${characters.length - 15} more`));
    console.log(chalk.yellow(`\nScenes:`));
    scenes.forEach((s) => {
      console.log(`   ${s.number}: ${s.heading.substring(0, 60)}`);
      console.log(chalk.gray(`      Line ${s.lineNumber}, ${s.dialogueCount} dialogue lines`));
    });
  }));

/* ── shots ── */
program
  .command("shots <genre>")
  .description("Generate shot coverage plan from genre template")
  .option("-s, --scenes <count>", "Number of scenes", "10")
  .option("-f, --file <screenplay>", "Parse a screenplay file and use its scene count")
  .option("--json", "Output as JSON")
  .option("--csv", "Output as CSV")
  .option("--markdown", "Output as Markdown")
  .option("--html", "Output as HTML storyboard")
  .option("-o, --output <dir>", "Save to directory instead of stdout")
  .action(withErrorHandler(async (genre, opts) => {
    let coverageResult;

    if (opts.file) {
      if (!fs.existsSync(opts.file)) {
        console.error(chalk.red(`File not found: ${opts.file}`));
        process.exit(1);
      }
      const spin = spinner(`Parsing ${opts.file} and generating ${genre} coverage...`);
      const parseResult = ScreenplayParser.parse(opts.file);
      coverageResult = CoverageGenerator.generate(parseResult, genre);
      spin.stop(chalk.green(`✓ ${coverageResult.totalShots} shots across ${coverageResult.sceneCount} scenes`));
    } else {
      const sceneCount = parseInt(opts.scenes, 10) || 10;
      const spin = spinner(`Generating ${genre} shot plan for ${sceneCount} scenes...`);
      coverageResult = CoverageGenerator.generateFromSceneCount(sceneCount, genre);
      spin.stop(chalk.green(`✓ ${coverageResult.totalShots} shots across ${sceneCount} scenes`));
    }

    // Output to files
    if (opts.output) {
      const formats = [];
      if (opts.json) formats.push("json");
      if (opts.csv) formats.push("csv");
      if (opts.markdown) formats.push("markdown");
      if (opts.html) formats.push("html");
      if (formats.length === 0) formats.push("markdown", "csv"); // default both

      for (const fmt of formats) {
        const filePath = FileExporter.exportShotPlan(coverageResult, fmt, opts.output);
        console.log(chalk.green(`✓ ${filePath}`));
      }
      return;
    }

    // Stdout output
    if (opts.json) {
      console.log(JSON.stringify(coverageResult, null, 2));
    } else if (opts.csv) {
      console.log(CoverageGenerator.toCSV(coverageResult));
    } else if (opts.html) {
      console.log(FileExporter._shotPlanToHtml(coverageResult));
    } else {
      // Default: markdown
      console.log(CoverageGenerator.toMarkdown(coverageResult));
    }
  }));

/* ── template ── */
program
  .command("template [genre]")
  .description("Show details of a genre coverage template")
  .option("--list", "List all available genres")
  .action(withErrorHandler(async (genre, opts) => {
    const genres = CoverageGenerator.listGenres();

    if (opts.list || !genre) {
      console.log(chalk.cyan("Available genre templates:\n"));
      genres.forEach((g) => {
        const info = CoverageGenerator.getGenre(g);
        console.log(`   ${chalk.bold(g.padEnd(15))} ${info.description}`);
      });
      return;
    }

    const info = CoverageGenerator.getGenre(genre);
    console.log(chalk.cyan(`\n🎬 ${info.name} Template\n`));
    console.log(chalk.gray(`   ${info.description}`));
    console.log(chalk.yellow(`\n   Shots per scene: ${info.shotsPerScene}`));
    console.log(chalk.yellow(`   Pacing: ${info.pacing}`));
    console.log(chalk.yellow(`\n   Shot Distribution:`));
    Object.entries(info.distribution).forEach(([type, count]) => {
      const shotInfo = require("../src/coverage").SHOT_TYPES[type];
      console.log(`   ${String(count).padStart(2)}x ${type.padEnd(5)} ${shotInfo?.name || ""}`);
    });
    console.log(chalk.yellow(`\n   Camera Notes:`));
    info.cameraNotes.forEach((n) => console.log(`   - ${n}`));
    console.log(chalk.yellow(`\n   Equipment:`));
    info.equipment.forEach((e) => console.log(`   - ${e}`));
  }));

/* ── storyboard ── */
program
  .command("storyboard")
  .description("Generate storyboard images from shot plan (free, no API key needed)")
  .option("-f, --file <screenplay>", "Screenplay file to parse")
  .option("-g, --genre <genre>", "Coverage genre", "drama")
  .option("-s, --scenes <count>", "Number of scenes (if no file)", "5")
  .option("--style <style>", "Visual style: cinematic, sketch, anime, comic, realistic, neon, watercolor", "cinematic")
  .option("--scenes-filter <ids>", "Only generate for specific scene IDs (comma-separated)", "")
  .option("--limit <n>", "Max number of images to generate", "20")
  .option("-o, --output <dir>", "Output directory", "./storyboard")
  .option("--list-styles", "List available visual styles")
  .action(withErrorHandler(async (opts) => {
    if (opts.listStyles) {
      console.log(chalk.cyan("Available storyboard styles:\n"));
      StoryboardGenerator.listStyles().forEach((s) => {
        console.log(`   ${chalk.bold(s.key.padEnd(15))} ${s.description}`);
      });
      return;
    }

    // Get coverage result
    let coverageResult;
    if (opts.file) {
      if (!fs.existsSync(opts.file)) {
        console.error(chalk.red(`File not found: ${opts.file}`));
        process.exit(1);
      }
      const spin1 = spinner("Parsing screenplay...");
      const parseResult = ScreenplayParser.parse(opts.file);
      coverageResult = CoverageGenerator.generate(parseResult, opts.genre);
      spin1.stop(chalk.green(`✓ ${coverageResult.sceneCount} scenes, ${coverageResult.totalShots} shots`));
    } else {
      const sceneCount = parseInt(opts.scenes, 10) || 5;
      coverageResult = CoverageGenerator.generateFromSceneCount(sceneCount, opts.genre);
    }

    const style = opts.style || "cinematic";
    const limit = parseInt(opts.limit, 10) || 20;
    const outputDir = opts.output || "./storyboard";

    const sb = new StoryboardGenerator({ style, concurrency: 3 });

    console.log(chalk.cyan(`\n🎨 Generating ${style} storyboard...`));
    console.log(chalk.gray(`   Provider: Pollinations.ai (free, no API key)`));
    console.log(chalk.gray(`   Images: up to ${Math.min(limit, coverageResult.totalShots)} of ${coverageResult.totalShots} shots`));
    console.log(chalk.gray(`   This may take a minute...\n`));

    const spin2 = spinner("Generating storyboard images...");
    const result = await sb.generate(coverageResult, outputDir, {
      style,
      limit,
      scenes: opts.scenesFilter || null,
    });

    spin2.stop(chalk.green(`✓ Generated ${result.totalGenerated} images`));

    // Save HTML
    const htmlPath = path.join(outputDir, "storyboard.html");
    fs.writeFileSync(htmlPath, result.html, "utf-8");

    console.log(chalk.green(`\n🎬 Storyboard complete!`));
    console.log(chalk.gray(`   ${result.totalGenerated} images → ${outputDir}/`));
    console.log(chalk.gray(`   View: open ${htmlPath}`));

    if (result.totalGenerated < result.totalRequested) {
      console.log(chalk.yellow(`\n   ⚠ ${result.totalRequested - result.totalGenerated} images could not be generated.`));
      console.log(chalk.gray(`   Prompts saved as .txt files for manual generation.`));
    }
  }));

/* ── export (updated with screenjson) ── */
program
  .command("export <type>")
  .description("Export parse results or shot plans to files")
  .option("-f, --format <fmt>", "Format: json, csv, markdown, html, screenjson", "markdown")
  .option("-o, --output <dir>", "Output directory", "./output")
  .option("--file <screenplay>", "Screenplay file to parse first")
  .option("-g, --genre <genre>", "Genre for shot plan", "drama")
  .option("-s, --scenes <count>", "Scene count for shot plan", "10")
  .option("--stdout", "Print to stdout instead of file")
  .action(withErrorHandler(async (type, opts) => {
    if (!["parse-result", "shot-plan"].includes(type)) {
      console.error(chalk.red(`Invalid export type: ${type}. Use: parse-result, shot-plan`));
      process.exit(1);
    }

    if (type === "parse-result") {
      const filePath = opts.file;
      if (!filePath || !fs.existsSync(filePath)) {
        console.error(chalk.red(`File not found. Use: fps export parse-result --file <screenplay>`));
        process.exit(1);
      }
      const result = ScreenplayParser.parse(filePath);

      // ScreenJSON format
      if (opts.format === "screenjson") {
        if (opts.stdout) {
          console.log(ScreenJSONConverter.toJSON(result));
        } else {
          const outPath = path.join(opts.output, path.basename(filePath, path.extname(filePath)) + ".screenjson");
          ScreenJSONConverter.toFile(result, outPath);
          console.log(chalk.green(`✓ ${outPath}`));
        }
        return;
      }

      if (opts.stdout) {
        FileExporter.toStdout(result);
      } else {
        const out = FileExporter.exportParseResult(result, opts.format, opts.output);
        console.log(chalk.green(`✓ ${out}`));
      }
    }

    if (type === "shot-plan") {
      let coverageResult;
      if (opts.file && fs.existsSync(opts.file)) {
        const parseResult = ScreenplayParser.parse(opts.file);
        coverageResult = CoverageGenerator.generate(parseResult, opts.genre);
      } else {
        coverageResult = CoverageGenerator.generateFromSceneCount(parseInt(opts.scenes, 10), opts.genre);
      }
      if (opts.stdout) {
        FileExporter.toStdout(coverageResult);
      } else {
        const out = FileExporter.exportShotPlan(coverageResult, opts.format, opts.output);
        console.log(chalk.green(`✓ ${out}`));
      }
    }
  }));

/* ── interactive ── */
program
  .command("interactive")
  .description("Step-by-step interactive wizard — no backend required")
  .action(withErrorHandler(async () => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

    console.log(chalk.cyan("\n🎬 Flow Prompt Studio — Interactive Mode\n"));
    console.log(chalk.gray("  Press Ctrl+C at any time to exit.\n"));

    // Step 1: Screenplay file
    const filePath = await ask(rl, chalk.yellow("📄 Screenplay file path: "));
    if (!filePath || !fs.existsSync(filePath)) {
      console.error(chalk.red(`\nFile not found: ${filePath || "(empty)"}`));
      rl.close();
      process.exit(1);
    }

    // Step 2: Parse
    const spin1 = spinner("Parsing screenplay...");
    const parseResult = ScreenplayParser.parse(filePath);
    spin1.stop(chalk.green(`✓ Found ${parseResult.stats.totalScenes} scenes, ${parseResult.stats.totalCharacters} characters`));

    // Step 3: Genre
    console.log(chalk.yellow("\n🎭 Available genres:"));
    const genres = CoverageGenerator.listGenres();
    genres.forEach((g, i) => {
      const info = CoverageGenerator.getGenre(g);
      console.log(`   ${chalk.bold(String(i + 1).padStart(2))}. ${g.padEnd(15)} ${info.description}`);
    });
    const genreChoice = await ask(rl, chalk.yellow(`\nGenre (1-${genres.length}) [drama]: `));
    const genreIdx = parseInt(genreChoice, 10) - 1;
    const genre = genres[genreIdx] || "drama";

    // Step 4: Generate coverage
    const spin2 = spinner(`Generating ${genre} shot coverage...`);
    const coverageResult = CoverageGenerator.generate(parseResult, genre);
    spin2.stop(chalk.green(`✓ ${coverageResult.totalShots} shots planned`));

    // Step 5: Output format
    console.log(chalk.yellow("\n📦 Output format:"));
    console.log("   1. Markdown (human-readable)");
    console.log("   2. CSV (spreadsheet-ready)");
    console.log("   3. JSON (machine-readable)");
    console.log("   4. HTML (visual storyboard)");
    console.log("   5. All formats");
    const fmtChoice = await ask(rl, chalk.yellow("\nFormat (1-5) [1]: "));
    const fmtMap = { "1": "markdown", "2": "csv", "3": "json", "4": "html", "5": "all" };
    const format = fmtMap[fmtChoice] || "markdown";

    // Step 6: Output directory
    const outDir = await ask(rl, chalk.yellow(`\n📁 Output directory [./output]: `));
    const outputDir = outDir || "./output";

    // Step 7: Export
    console.log();
    if (format === "all") {
      ["markdown", "csv", "json", "html"].forEach((f) => {
        const p = FileExporter.exportShotPlan(coverageResult, f, outputDir);
        console.log(chalk.green(`   ✓ ${p}`));
      });
    } else {
      const p = FileExporter.exportShotPlan(coverageResult, format, outputDir);
      console.log(chalk.green(`   ✓ ${p}`));
    }

    rl.close();
    console.log(chalk.green(`\n🎬 Done! ${coverageResult.sceneCount} scenes, ${coverageResult.totalShots} shots → ${outputDir}\n`));
  }));

/* ── callsheet ── */
program
  .command("callsheet")
  .description("Generate professional call sheet (HTML, print-ready PDF)")
  .option("-f, --file <screenplay>", "Screenplay file")
  .option("-g, --genre <genre>", "Coverage genre", "drama")
  .option("-d, --day <n>", "Shoot day number", "1")
  .option("--title <title>", "Production title")
  .option("--director <name>", "Director name", "TBD")
  .option("--dp <name>", "Director of Photography", "TBD")
  .option("--date <date>", "Shoot date (YYYY-MM-DD)")
  .option("--location <name>", "Primary location", "TBD")
  .option("--call <time>", "General call time", "07:00")
  .option("-o, --output <file>", "Output HTML file", "./callsheet.html")
  .action(withErrorHandler(async (opts) => {
    if (!opts.file || !fs.existsSync(opts.file)) {
      console.error(chalk.red("Screenplay file required. Use: fps callsheet -f <screenplay>"));
      process.exit(1);
    }

    const spin1 = spinner("Building call sheet...");
    const parseResult = ScreenplayParser.parse(opts.file);
    const coverageResult = CoverageGenerator.generate(parseResult, opts.genre);

    const cs = new CallSheetGenerator(parseResult, coverageResult);
    const html = cs.generate({
      day: parseInt(opts.day, 10),
      title: opts.title || parseResult.stats.filename,
      director: opts.director,
      dp: opts.dp,
      date: opts.date || new Date().toISOString().split("T")[0],
      location: opts.location,
      callTime: opts.call,
    });

    const outPath = opts.output || "./callsheet.html";
    const dir = path.dirname(outPath);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(outPath, html, "utf-8");

    spin1.stop(chalk.green(`✓ Call sheet saved: ${outPath}`));
    console.log(chalk.gray(`   ${coverageResult.sceneCount} scenes · ${coverageResult.totalShots} shots`));
    console.log(chalk.gray(`   Open in browser → Print → Save as PDF`));
  }));

/* ── budget ── */
program
  .command("budget")
  .description("Estimate production budget from screenplay")
  .option("-f, --file <screenplay>", "Screenplay file")
  .option("-g, --genre <genre>", "Film genre", "drama")
  .option("-l, --level <level>", "Budget level: indie, mid, studio", "indie")
  .option("--json", "Output as JSON")
  .option("--csv", "Output as CSV")
  .option("-o, --output <file>", "Save to file")
  .action(withErrorHandler(async (opts) => {
    if (!opts.file || !fs.existsSync(opts.file)) {
      console.error(chalk.red("Screenplay file required. Use: fps budget -f <screenplay>"));
      process.exit(1);
    }

    const spin1 = spinner("Calculating budget...");
    const parseResult = ScreenplayParser.parse(opts.file);
    const coverageResult = CoverageGenerator.generate(parseResult, opts.genre);
    const budget = BudgetEstimator.estimate(parseResult, coverageResult, {
      level: opts.level,
      genre: opts.genre,
    });
    spin1.stop(chalk.green(`✓ Estimated: $${budget.total.toLocaleString()}`));

    if (opts.json) {
      console.log(JSON.stringify(budget, null, 2));
    } else if (opts.csv) {
      const csv = BudgetEstimator.toCSV(budget);
      if (opts.output) {
        fs.writeFileSync(opts.output, csv, "utf-8");
        console.log(chalk.green(`✓ Saved: ${opts.output}`));
      } else {
        console.log(csv);
      }
    } else {
      const md = BudgetEstimator.toMarkdown(budget);
      if (opts.output) {
        fs.writeFileSync(opts.output, md, "utf-8");
        console.log(chalk.green(`✓ Saved: ${opts.output}`));
      } else {
        console.log(md);
      }
    }

    console.log(chalk.gray(`\n   ${budget.disclaimer}`));
  }));

/* ── project ── */
program
  .command("project <action>")
  .description("Project management: init, add, status, export")
  .option("-f, --file <path>", "Screenplay file to add")
  .option("-g, --genre <genre>", "Genre for coverage", "drama")
  .option("-t, --title <title>", "Project title")
  .option("--director <name>", "Director")
  .option("--dp <name>", "Director of Photography")
  .option("--force", "Force overwrite")
  .action(withErrorHandler(async (action, opts) => {
    const pm = new ProjectManager();

    switch (action) {
      case "init": {
        const title = opts.title || path.basename(process.cwd());
        const project = pm.init(title, { force: opts.force, director: opts.director, dp: opts.dp });
        console.log(chalk.green(`✓ Project initialized: "${project.title}"`));
        console.log(chalk.gray(`   Config: ${pm.configPath}`));
        break;
      }

      case "add": {
        if (!opts.file) {
          console.error(chalk.red("Use: fps project add -f <screenplay>"));
          process.exit(1);
        }
        const entry = pm.addScreenplay(opts.file);
        console.log(chalk.green(`✓ Added: ${entry.filename}`));
        console.log(chalk.gray(`   ${entry.analysis.scenes} scenes, ${entry.analysis.characters} characters`));
        break;
      }

      case "status": {
        const s = pm.status();
        console.log(chalk.cyan(`\n📋 ${s.title}\n`));
        console.log(`   Created:    ${s.created.split("T")[0]}`);
        console.log(`   Updated:    ${s.updated.split("T")[0]}`);
        console.log(`   Screenplays: ${s.screenplays}`);
        console.log(`   Coverage:    ${s.coveragePlans}`);
        console.log(`   Exports:     ${s.exports}`);
        if (s.metadata.genre) console.log(`   Genre:       ${s.metadata.genre}`);
        if (s.metadata.director) console.log(`   Director:    ${s.metadata.director}`);
        break;
      }

      case "export": {
        const data = pm.export();
        console.log(JSON.stringify(data, null, 2));
        break;
      }

      default:
        console.error(chalk.red(`Unknown action: ${action}. Use: init, add, status, export`));
        process.exit(1);
    }
  }));

/* ═══════════════════════════════════════════
   BACKEND COMMANDS (need backend running)
   ═══════════════════════════════════════════ */

/* ── config ── */
program
  .command("config")
  .description("Show AI provider status and configuration")
  .action(withErrorHandler(async () => {
    console.log(chalk.cyan("🔧 Flow Prompt Studio — Configuration\n"));

    // AI Providers
    console.log(chalk.yellow("AI Providers (no backend needed):"));
    const providers = AIPromptGenerator.getProvidersStatus();
    providers.forEach((p) => {
      const icon = p.configured ? chalk.green("✓") : chalk.gray("✗");
      const status = p.configured ? `configured (${p.envVar})` : `not configured (set ${p.envVar})`;
      console.log(`   ${icon} ${p.name.padEnd(12)} ${status}`);
    });

    console.log(chalk.gray("\n   Set API keys via environment variables, --key flag, or .fpsrc config."));
    console.log(chalk.gray("   Example: export DEEPSEEK_API_KEY=sk-..."));

    // Backend (optional)
    console.log(chalk.yellow("\nBackend (optional, for legacy API):"));
    try {
      const ping = await client.ping();
      if (ping.reachable) {
        console.log(chalk.green(`   ✓ Backend reachable at ${client.baseUrl}`));
      } else {
        console.log(chalk.gray(`   ✗ Backend not running (not needed for AI features)`));
      }
    } catch {
      console.log(chalk.gray(`   ✗ Backend not running (not needed for AI features)`));
    }

    console.log(chalk.green("\n✓ Offline commands always available:"));
    console.log("   fps parse <file>       Parse screenplay");
    console.log("   fps shots <genre>      Generate shot coverage");
    console.log("   fps generate -f <file>  AI prompt pack (needs API key)");
    console.log("   fps interactive         Step-by-step wizard");
  }));

/* ── workflow (hybrid: local + optional backend) ── */
program
  .command("workflow <screenplay>")
  .description("Full workflow: local parse + shot plan + optional AI (if backend available)")
  .option("-g, --genre <genre>", "Coverage genre", "drama")
  .option("--ai", "Also run AI generation (DeepSeek/OpenAI/Claude — no backend needed)")
  .option("-p, --provider <provider>", "AI provider for --ai", "deepseek")
  .option("-k, --key <key>", "API key for AI provider")
  .option("--ultra", "Ultra mode for AI generation")
  .option("--dry-run", "Estimate first, then run")
  .option("-o, --output <dir>", "Export output directory")
  .action(withErrorHandler(async (file, opts) => {
    if (!fs.existsSync(file)) {
      console.error(chalk.red(`File not found: ${file}`));
      process.exit(1);
    }

    const startTime = Date.now();
    const outputDir = opts.output || "./output";

    /* ── Phase 1: Local (always works) ── */
    console.log(chalk.cyan("📄 Phase 1: Local Analysis\n"));

    // Dry-run estimate
    if (opts.dryRun) {
      const est = await client.estimate(file);
      console.log(chalk.yellow("📋 Estimation:"));
      console.log(`   Est. Scenes:   ${est.estimatedScenes}`);
      console.log(`   Est. Shots:    ${est.estimatedShots}`);
      console.log(`   Est. Duration: ~${est.estimatedDurationMinutes} min\n`);
    }

    // Parse
    const spin1 = spinner("  Parsing screenplay...");
    const parseResult = ScreenplayParser.parse(file);
    const { scenes, characters, stats } = parseResult;
    spin1.stop(chalk.green(`  ✓ ${stats.totalScenes} scenes, ${stats.totalCharacters} characters, ${stats.totalDialogueLines} dialogue lines`));

    // Coverage
    const spin2 = spinner(`  Generating ${opts.genre} shot coverage...`);
    const coverageResult = CoverageGenerator.generate(parseResult, opts.genre);
    spin2.stop(chalk.green(`  ✓ ${coverageResult.totalShots} shots planned (~${coverageResult.estimatedDurationMinutes} min)`));

    // Export local results
    const spin3 = spinner("  Exporting files...");
    const files = [];
    files.push(FileExporter.exportParseResult(parseResult, "markdown", outputDir));
    files.push(FileExporter.exportShotPlan(coverageResult, "csv", outputDir));
    files.push(FileExporter.exportShotPlan(coverageResult, "html", outputDir));
    spin3.stop(chalk.green(`  ✓ ${files.length} files saved to ${outputDir}/`));

    /* ── Phase 2: AI (native, no backend needed) ── */
    if (opts.ai) {
      console.log(chalk.cyan("\n🤖 Phase 2: AI Generation\n"));

      const provider = opts.provider || "deepseek";
      const apiKey = opts.key || AIPromptGenerator.resolveApiKey(provider);

      if (!apiKey) {
        console.log(chalk.yellow(`  ⚠ No API key for ${provider} — skipping AI generation`));
        const envVar = { deepseek: "DEEPSEEK_API_KEY", openai: "OPENAI_API_KEY", anthropic: "ANTHROPIC_API_KEY" }[provider];
        console.log(chalk.gray(`    Set ${envVar} or use --key flag`));
      } else {
        const spin4 = spinner("  Generating AI prompt pack...");
        try {
          const gen = new AIPromptGenerator({ provider, apiKey });
          const genResult = await gen.generate(parseResult, coverageResult, "full_pack", { ultra: opts.ultra || false });
          if (genResult.success) {
            spin4.stop(chalk.green(`  ✓ AI generation complete (${genResult.providerName} / ${genResult.model})`));
            // Save AI output
            const aiFile = path.join(outputDir, `ai-prompt-${genResult.provider}.md`);
            fs.writeFileSync(aiFile, genResult.markdown, "utf-8");
            console.log(chalk.gray(`    Saved: ${aiFile} (${genResult.markdown.length} chars)`));
          } else {
            spin4.stop(chalk.yellow(`  ⚠ AI generation: ${genResult.error || "incomplete"}`));
          }
        } catch (err) {
          spin4.stop(chalk.yellow(`  ⚠ AI generation failed: ${err.message}`));
        }
      }
    }

    /* ── Summary ── */
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(chalk.green(`\n🎬 Workflow complete in ${elapsed}s`));
    console.log(chalk.gray(`   ${stats.totalScenes} scenes → ${coverageResult.totalShots} shots → ${outputDir}/`));
    if (!opts.ai) {
      console.log(chalk.gray(`\n   Tip: Add --ai to also generate AI prompts (DeepSeek/OpenAI/Claude)`));
    }
  }));

/* ═══════════════════════════════════════════
   REUSING EXISTING COMMANDS
   ═══════════════════════════════════════════ */

/* ── upload ── */
program
  .command("upload <file>")
  .description("Upload a screenplay to backend (.txt, .md, .pdf, .docx)")
  .action(withErrorHandler(async (file) => {
    if (!fs.existsSync(file)) {
      console.error(chalk.red(`File not found: ${file}`));
      process.exit(1);
    }
    const spin = spinner("Uploading...");
    const result = await client.uploadScreenplay(file);
    if (result.success) {
      spin.stop(chalk.green(`✓ Uploaded: ${result.filename}`));
      console.log(`   ${result.char_count} characters, ${result.scene_count} scenes`);
    } else {
      spin.stop(chalk.red("✗ Upload failed"));
      console.error(chalk.red(`   ${result.error || "Unknown error"}`));
    }
  }));

/* ── analyze ── */
program
  .command("analyze")
  .description("Backend-powered analysis (use 'fps parse' for offline)")
  .action(withErrorHandler(async () => {
    const spin = spinner("Analyzing via backend...");
    const [analysis, stats] = await Promise.all([client.getAnalysis(), client.getStats()]);
    spin.stop(chalk.green("✓ Analysis complete"));
    console.log(chalk.yellow(`\n${stats.scene_count} scenes, ${stats.char_count} characters`));
    analysis.characters?.slice(0, 10).forEach(c => console.log(`   ${c.name} (${c.count}x)`));
  }));

/* ── style, generate, coverage, repair, validate, preview, export (URL), estimate, init, doctor ── */
// These are kept from v1.x with minor improvements

program
  .command("style").description("Detect visual style (needs backend)").option("--show", "Show current style settings")
  .action(withErrorHandler(async (opts) => {
    if (opts.show) {
      const style = await client.getStyle();
      Object.entries(style).forEach(([k, v]) => console.log(chalk.cyan(`\n  ${k}:`) + `\n  ${v || "(empty)"}`));
      return;
    }
    const spin = spinner("Detecting visual style...");
    const result = await client.detectStyle();
    if (result.detected) {
      spin.stop(chalk.green(`✓ Style detected (${result.mode || "AI"})`));
    } else {
      spin.stop(chalk.yellow(`⚠  ${result.message}`));
    }
  }));

program
  .command("generate")
  .description("Generate AI prompt pack (DeepSeek, OpenAI, Claude — no backend needed)")
  .option("-p, --provider <provider>", "AI provider: deepseek, openai, anthropic", "deepseek")
  .option("-k, --key <key>", "API key (or set env var)")
  .option("-m, --model <model>", "Model override")
  .option("-s, --scope <scope>", "Scope: full_pack, scene_breakdown, character_bible, ultra_image_variation", "full_pack")
  .option("-u, --ultra", "Ultra mode for maximum variation")
  .option("-f, --file <screenplay>", "Screenplay file to parse and generate from")
  .option("-g, --genre <genre>", "Genre for coverage context", "drama")
  .option("-o, --output <file>", "Save markdown output to file")
  .action(withErrorHandler(async (opts) => {
    const provider = opts.provider || "deepseek";
    const apiKey = opts.key || AIPromptGenerator.resolveApiKey(provider);

    if (!apiKey) {
      const envVar = { deepseek: "DEEPSEEK_API_KEY", openai: "OPENAI_API_KEY", anthropic: "ANTHROPIC_API_KEY" }[provider];
      console.error(chalk.red(`No API key for ${provider}.`));
      console.error(chalk.gray(`  Set ${envVar} environment variable or use --key flag.`));
      console.error(chalk.gray(`  Or add to .fpsrc: { "apiKeys": { "${provider}": "sk-..." } }`));
      process.exit(1);
    }

    // Parse screenplay if file provided (gives better prompts)
    let parseResult = null;
    let coverageResult = null;
    if (opts.file) {
      if (!fs.existsSync(opts.file)) {
        console.error(chalk.red(`File not found: ${opts.file}`));
        process.exit(1);
      }
      const spin1 = spinner("Parsing screenplay for context...");
      parseResult = ScreenplayParser.parse(opts.file);
      coverageResult = CoverageGenerator.generate(parseResult, opts.genre);
      spin1.stop(chalk.green(`✓ ${parseResult.stats.totalScenes} scenes, ${coverageResult.totalShots} shots as context`));
    } else {
      // Create minimal context
      parseResult = { scenes: [], characters: [], stats: { totalScenes: 0, totalCharacters: 0, totalDialogueLines: 0, estimatedPages: 0, estimatedDurationMinutes: 0 } };
      coverageResult = null;
    }

    const gen = new AIPromptGenerator({ provider, apiKey, model: opts.model, temperature: 0.7 });

    const spin2 = spinner(`Generating ${opts.scope} via ${provider}...`);
    const result = await gen.generate(parseResult, coverageResult, opts.scope, { ultra: opts.ultra });

    if (result.success) {
      spin2.stop(chalk.green(`✓ Generated via ${result.providerName} (${result.model})`));
      console.log(chalk.gray(`   ${result.markdown.length} chars`));

      if (opts.output) {
        fs.writeFileSync(opts.output, result.markdown, "utf-8");
        console.log(chalk.green(`✓ Saved: ${opts.output}`));
      } else {
        // Print first 500 chars as preview
        console.log(chalk.cyan("\n── Preview (first 500 chars) ──\n"));
        console.log(result.markdown.substring(0, 500));
        if (result.markdown.length > 500) {
          console.log(chalk.gray(`\n... (${result.markdown.length - 500} more chars. Use -o to save to file)`));
        }
      }
    } else {
      spin2.stop(chalk.red(`✗ ${result.error}`));
    }
  }));

program
  .command("estimate <file>").description("Estimate shots/duration without uploading")
  .action(withErrorHandler(async (file) => {
    if (!fs.existsSync(file)) { console.error(chalk.red(`File not found: ${file}`)); process.exit(1); }
    const est = await client.estimate(file);
    console.log(chalk.cyan("\n📋 Estimation:"));
    console.log(`   File:       ${est.filename} (${est.fileSizeKb} KB)`);
    console.log(`   Scenes:     ~${est.estimatedScenes}`);
    console.log(`   Shots:      ~${est.estimatedShots}`);
    console.log(`   Duration:   ~${est.estimatedDurationMinutes} min`);
  }));

program.command("coverage").description("Camera coverage plan (needs backend)").option("--refresh", "Recalculate")
  .action(withErrorHandler(async (opts) => {
    const spin = spinner("Fetching coverage plan...");
    const bundle = await client.getBundle(opts.refresh);
    spin.stop(chalk.green(`✓ ${bundle.shot_rows.length} shots planned`));
  }));

program.command("repair [error-type]").description("Generate repair prompt (needs backend)").option("--all", "All types")
  .action(withErrorHandler(async (errorType, opts) => {
    if (opts.all) {
      const result = await client.generateAllRepairs();
      console.log(chalk.green(`✓ ${result.count} repair prompts`));
      return;
    }
    if (!errorType) {
      const types = await client.getErrorTypes();
      types.error_types.forEach((t, i) => console.log(`   ${String(i + 1).padStart(2)}. ${t}`));
      return;
    }
    const result = await client.generateRepair(errorType);
    console.log(chalk.green("✓ Repair prompt generated"));
  }));

program.command("validate").description("Validate prompt package (needs backend)")
  .action(withErrorHandler(async () => {
    const result = await client.validate();
    console.log(chalk.green(`✓ ${(result.issues || []).length} issues found`));
  }));

program.command("preview").description("Preview markdown (needs backend)")
  .option("--flow-only", "Flow blocks only").option("--continuity", "Check continuity")
  .action(withErrorHandler(async (opts) => {
    if (opts.continuity) { await client.checkContinuity(); console.log(chalk.green("✓ Continuity check complete")); return; }
    if (opts.flowOnly) { const r = await client.getFlowCopyReady(); console.log(r.substring(0, 500) + "..."); return; }
    const r = await client.getMarkdown();
    console.log((r.markdown_text || "").substring(0, 500) + "...");
  }));

program.command("init").description("Initialize a project with .fpsrc config").option("-f, --force", "Overwrite existing")
  .action(withErrorHandler(async (opts) => {
    const configPath = path.join(process.cwd(), ".fpsrc");
    if (fs.existsSync(configPath) && !opts.force) {
      console.log(chalk.yellow("⚠  .fpsrc already exists. Use --force to overwrite."));
      return;
    }
    fs.writeFileSync(configPath, JSON.stringify({ apiUrl: "http://localhost:8000/api/v1", defaultScope: "full_pack", defaultFormats: ["markdown", "shot-plan-csv", "asset-plan-md", "playbook"], ultra: false, language: "en" }, null, 2), "utf-8");
    console.log(chalk.green(`✓ Project initialized: ${configPath}`));
  }));

program.command("doctor").description("System health check and troubleshooting")
  .action(withErrorHandler(async () => {
    console.log(chalk.cyan("🔍 Flow Prompt Studio — System Check\n"));
    const nodeVersion = process.version;
    const nodeOk = parseInt(process.version.slice(1)) >= 18;
    console.log(`${nodeOk ? chalk.green("✓") : chalk.red("✗")} Node.js: ${nodeVersion} ${nodeOk ? "" : chalk.red("(need >= 18)")}`);
    console.log(`   fps:    v${pkg.version}`);
    console.log(chalk.green("\n✓ Offline commands ready:"));
    console.log("   fps parse <file>       Parse screenplay locally");
    console.log("   fps shots <genre>      Generate shot coverage");
    console.log("   fps template --list    Browse genre templates");
    console.log("   fps interactive        Step-by-step wizard");
    console.log(chalk.gray("\n   For AI features, start the backend and use: fps workflow --ai"));
  }));

program.parse();
