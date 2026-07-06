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

/* ── export ── */
program
  .command("export <type>")
  .description("Export parse results or shot plans to files")
  .option("-f, --format <fmt>", "Format: json, csv, markdown, html", "markdown")
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

/* ═══════════════════════════════════════════
   BACKEND COMMANDS (need backend running)
   ═══════════════════════════════════════════ */

/* ── config ── */
program
  .command("config")
  .description("Show backend configuration and connection status")
  .action(withErrorHandler(async () => {
    const spin = spinner("Checking backend connection...");
    const ping = await client.ping();
    if (ping.reachable) {
      const cfg = await client.getConfig();
      spin.stop(chalk.green("✓ Backend is reachable"));
      console.log(chalk.cyan("\nBackend Configuration:"));
      console.log(`   API Key:    ${cfg.has_api_key ? chalk.green("✓ Present") : chalk.red("✗ Missing")}`);
      console.log(`   Fast Model: ${cfg.fast_model}`);
      console.log(`   Pro Model:  ${cfg.pro_model}`);
      console.log(`   Fallback:   ${cfg.fallback_model}`);
      console.log(`   URL:        ${client.baseUrl}`);
    } else {
      spin.stop(chalk.red("✗ Backend is not reachable (optional for offline features)"));
      console.log(chalk.gray("\n   The backend is only required for AI prompt generation."));
      console.log(chalk.green("\n   Try these offline commands instead:"));
      console.log("     fps parse <file>      Parse screenplay locally");
      console.log("     fps shots <genre>     Generate shot coverage");
      console.log("     fps interactive       Step-by-step wizard");
    }
  }));

/* ── workflow (hybrid: local + optional backend) ── */
program
  .command("workflow <screenplay>")
  .description("Full workflow: local parse + shot plan + optional AI (if backend available)")
  .option("-g, --genre <genre>", "Coverage genre", "drama")
  .option("--ai", "Also run AI generation (requires backend)")
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

    /* ── Phase 2: AI (only if backend available and --ai flag) ── */
    if (opts.ai) {
      console.log(chalk.cyan("\n🤖 Phase 2: AI Generation\n"));
      const ping = await client.ping();
      if (ping.reachable) {
        const spin4 = spinner("  Generating AI prompt pack...");
        try {
          const genResult = await client.generate("full_pack", opts.ultra || false);
          if (genResult.success) {
            spin4.stop(chalk.green(`  ✓ AI generation complete (${genResult.model_used})`));
          } else {
            spin4.stop(chalk.yellow(`  ⚠ AI generation: ${genResult.error || "incomplete"}`));
          }
        } catch (err) {
          spin4.stop(chalk.yellow(`  ⚠ AI generation failed: ${err.message}`));
        }
      } else {
        console.log(chalk.yellow("  ⚠ Backend not available — skipping AI generation"));
        console.log(chalk.gray("    Start the backend and run: fps generate --scope full_pack"));
      }
    }

    /* ── Summary ── */
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(chalk.green(`\n🎬 Workflow complete in ${elapsed}s`));
    console.log(chalk.gray(`   ${stats.totalScenes} scenes → ${coverageResult.totalShots} shots → ${outputDir}/`));
    if (!opts.ai) {
      console.log(chalk.gray(`\n   Tip: Add --ai to also generate AI prompts (requires backend)`));
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
  .command("generate").description("Generate AI prompt pack (needs backend)")
  .option("-s, --scope <scope>", "Scope", "full_pack")
  .option("-u, --ultra", "Ultra mode")
  .option("-o, --output <file>", "Save to file")
  .action(withErrorHandler(async (opts) => {
    const spin = spinner(`Generating: ${opts.scope}...`);
    const result = await client.generate(opts.scope, opts.ultra);
    if (result.success) {
      spin.stop(chalk.green(`✓ Generated (${result.model_used})`));
      if (opts.output && result.markdown) {
        fs.writeFileSync(opts.output, result.markdown, "utf-8");
        console.log(chalk.green(`✓ Saved: ${opts.output}`));
      }
    } else {
      spin.stop(chalk.red(`✗ ${result.error}`));
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
