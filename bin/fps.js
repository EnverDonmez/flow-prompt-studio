#!/usr/bin/env node
/**
 * Flow Prompt Studio — CLI
 *
 * Usage:
 *   fps upload <screenplay.pdf>
 *   fps analyze
 *   fps style
 *   fps generate [--scope full_pack] [--ultra]
 *   fps estimate <screenplay.pdf>
 *   fps coverage
 *   fps repair <error-type>
 *   fps validate
 *   fps export <format>
 *   fps workflow <screenplay.pdf> [--ultra] [--scope full_pack] [--dry-run]
 *   fps init [--force]
 *   fps doctor
 */

const { program } = require("commander");
const fs = require("fs");
const path = require("path");
const os = require("os");
const { FlowPromptStudioClient } = require("../src/client");
const { chalk, spinner } = require("../src/utils");

const pkg = require("../package.json");
const client = new FlowPromptStudioClient();

/* ── Helper: handle errors uniformly ── */
function withErrorHandler(fn) {
  return async (...args) => {
    try {
      await fn(...args);
    } catch (err) {
      console.error(chalk.red(`\n❌ ${err.message}`));
      if (err.message?.includes("ECONNREFUSED") || err.message?.includes("Cannot connect")) {
        console.error(chalk.gray(`\nTip: Make sure the Flow Prompt Studio backend is running.`));
        console.error(chalk.gray(`     Check: fps config`));
        console.error(chalk.gray(`     Start:  fps doctor`));
      }
      process.exit(1);
    }
  };
}

program
  .name("fps")
  .description("Screenplay to Google Flow / Veo AI prompt pack generator")
  .version(pkg.version);

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
      spin.stop(chalk.red("✗ Backend is not reachable"));
      console.log(chalk.gray(`\n   ${ping.error}`));
      console.log(chalk.yellow("\nTroubleshooting:"));
      console.log("   1. Start the backend: fps doctor");
      console.log("   2. Or set a custom URL: fps config --url http://your-server:8000");
    }
  }));

/* ── upload ── */
program
  .command("upload <file>")
  .description("Upload a screenplay file (.txt, .md, .pdf, .docx)")
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
      console.log(chalk.gray(`   Scenes: ${result.scenes.map(s => s.scene_id).join(", ")}`));
    } else {
      spin.stop(chalk.red("✗ Upload failed"));
      console.error(chalk.red(`   ${result.error || "Unknown error"}`));
    }
  }));

/* ── analyze ── */
program
  .command("analyze")
  .description("Extract characters, locations, and props from the screenplay")
  .action(withErrorHandler(async () => {
    const spin = spinner("Analyzing screenplay...");
    const [analysis, stats] = await Promise.all([client.getAnalysis(), client.getStats()]);
    spin.stop(chalk.green("✓ Analysis complete"));
    console.log(chalk.yellow(`\n📊 ${stats.scene_count} scenes, ${stats.char_count} characters, ~${stats.estimated_segments} segments`));
    console.log(chalk.yellow(`\nCharacters (${analysis.characters.length}):`));
    analysis.characters.slice(0, 15).forEach(c => console.log(`   ${c.name} (${c.count}x)`));
    console.log(chalk.yellow(`\nLocations (${analysis.locations.length}):`));
    analysis.locations.slice(0, 15).forEach(l => console.log(`   ${l.name} (${l.count}x) [${l.source}]`));
    console.log(chalk.yellow(`\nProps (${analysis.props.length}):`));
    analysis.props.slice(0, 15).forEach(p => console.log(`   ${p.name} (${p.count}x)`));
  }));

/* ── style ── */
program
  .command("style")
  .description("Detect visual style or show current settings")
  .option("--show", "Show current style settings")
  .action(withErrorHandler(async (opts) => {
    if (opts.show) {
      const style = await client.getStyle();
      console.log(chalk.yellow("Current Style Settings:"));
      Object.entries(style).forEach(([k, v]) => {
        console.log(chalk.cyan(`\n  ${k}:`));
        console.log(`  ${v || "(empty)"}`);
      });
      return;
    }
    const spin = spinner("Detecting visual style...");
    const result = await client.detectStyle();
    if (result.detected) {
      spin.stop(chalk.green(`✓ Style detected (${result.mode || "AI"})`));
      const s = result.settings;
      console.log(chalk.gray(`  Visual:  ${s.visual_style?.substring(0, 80)}...`));
      console.log(chalk.gray(`  Camera:  ${s.camera_language?.substring(0, 80)}...`));
    } else {
      spin.stop(chalk.yellow(`⚠  ${result.message}`));
    }
  }));

/* ── generate ── */
program
  .command("generate")
  .description("Generate AI prompt pack")
  .option("-s, --scope <scope>", "Scope: full_pack, scene_breakdown, character_bible, etc.", "full_pack")
  .option("-u, --ultra", "Ultra image variation mode")
  .option("-m, --manual", "Manual mode (don't call API)")
  .option("-o, --output <file>", "Save output to file")
  .action(withErrorHandler(async (opts) => {
    const spin = spinner(`Generating: ${opts.scope}...`);
    const result = await client.generate(opts.scope, opts.ultra, opts.manual);
    if (result.manual) {
      spin.stop(chalk.yellow("📋 Manual Mode — Master prompt prepared"));
      console.log(chalk.gray(`   Prompt length: ${result.master_prompt?.length || 0} chars`));
      if (opts.output && result.master_prompt) {
        fs.writeFileSync(opts.output, result.master_prompt, "utf-8");
        console.log(chalk.green(`✓ Saved: ${opts.output}`));
      }
    } else if (result.success) {
      spin.stop(chalk.green(`✓ Generated (${result.model_used})`));
      if (opts.output && result.markdown) {
        fs.writeFileSync(opts.output, result.markdown, "utf-8");
        console.log(chalk.green(`✓ Saved: ${opts.output}`));
      }
    } else {
      spin.stop(chalk.red(`✗ ${result.error}`));
    }
  }));

/* ── estimate / dry-run ── */
program
  .command("estimate <file>")
  .description("Estimate shot count and duration without uploading (dry-run)")
  .action(withErrorHandler(async (file) => {
    if (!fs.existsSync(file)) {
      console.error(chalk.red(`File not found: ${file}`));
      process.exit(1);
    }
    const spin = spinner("Analyzing screenplay locally...");
    const est = await client.estimate(file);
    spin.stop(chalk.green("✓ Estimation complete"));
    console.log(chalk.cyan("\n📋 Dry-Run Estimation:"));
    console.log(`   File:            ${est.filename}`);
    console.log(`   Size:            ${est.fileSizeKb} KB`);
    console.log(`   Est. Scenes:     ${est.estimatedScenes}`);
    console.log(`   Est. Shots:      ${est.estimatedShots} (~11 shots/scene)`);
    console.log(`   Est. Duration:   ~${est.estimatedDurationMinutes} min`);
  }));

/* ── coverage ── */
program
  .command("coverage")
  .description("View camera coverage and shot plan")
  .option("--refresh", "Clear cache and recalculate")
  .action(withErrorHandler(async (opts) => {
    const spin = spinner("Fetching coverage plan...");
    const bundle = await client.getBundle(opts.refresh);
    spin.stop(chalk.green(`\n✓ ${bundle.shot_rows.length} shots planned`));
    console.log(chalk.yellow(`   Assets: ${bundle.asset_plan?.collections?.length || 0} collections`));
    console.log(chalk.yellow(`   Repair: ${bundle.repair_markdown?.length || 0} chars`));
    // Shot type summary
    const byType = {};
    bundle.shot_rows.forEach(s => { byType[s["Shot Type"] || s["Shot Türü"]] = (byType[s["Shot Type"] || s["Shot Türü"]] || 0) + 1; });
    console.log(chalk.cyan("\nShot Breakdown:"));
    Object.entries(byType).sort(([,a], [,b]) => b - a).forEach(([t, c]) => {
      console.log(`   ${t}: ${c}`);
    });
  }));

/* ── repair ── */
program
  .command("repair [error-type]")
  .description("Generate repair prompt. Lists error types if none specified.")
  .option("-s, --scene <id>", "Scene ID", "SCENE_01A")
  .option("--segment <id>", "Segment ID")
  .option("-p, --problem <text>", "Problem description")
  .option("--all", "Generate for all error types")
  .action(withErrorHandler(async (errorType, opts) => {
    if (opts.all) {
      const spin = spinner("Generating all repair prompts...");
      const result = await client.generateAllRepairs();
      spin.stop(chalk.green(`✓ ${result.count} repair prompts (${result.markdown.length} chars)`));
      return;
    }
    if (!errorType) {
      console.log(chalk.cyan("Available error types:"));
      const types = await client.getErrorTypes();
      types.error_types.forEach((t, i) => console.log(`   ${String(i + 1).padStart(2)}. ${t}`));
      console.log(chalk.gray("\nUsage: fps repair 'Character face changed' --scene SCENE_01A"));
      return;
    }
    const spin = spinner(`Generating repair: ${errorType}`);
    const result = await client.generateRepair(errorType, opts.scene, opts.segment || "", opts.problem || "");
    spin.stop(chalk.green("✓ Repair prompt generated"));
    console.log(chalk.gray(result.repair?.flow_agent_prompt?.substring(0, 200) + "..."));
    console.log(chalk.cyan("\nStrategy:"));
    console.log(result.repair?.retry_strategy);
  }));

/* ── validate ── */
program
  .command("validate")
  .description("Validate the prompt package")
  .action(withErrorHandler(async () => {
    const spin = spinner("Validating...");
    const result = await client.validate();
    const issues = result.issues || [];
    const summary = result.summary || {};
    spin.stop(chalk.green(`✓ ${issues.length} issues found`));
    console.log(`   🔴 Critical: ${summary.critical || 0}  🟡 Warning: ${summary.warning || 0}  🔵 Info: ${summary.info || 0}`);
    if (issues.length > 0) {
      console.log(chalk.yellow("\nIssues:"));
      issues.slice(0, 10).forEach(i => {
        const icon = i.severity === "critical" ? "🔴" : i.severity === "warning" ? "🟡" : "🔵";
        console.log(`   ${icon} [${i.severity}] ${i.message}`);
      });
    }
  }));

/* ── export ── */
program
  .command("export [format]")
  .description("Export to file. Lists formats if none specified.")
  .option("-o, --output <dir>", "Output directory")
  .action(withErrorHandler(async (format, opts) => {
    const formats = [
      "markdown", "txt", "scene-markdown", "flow-copy-ready",
      "shot-plan-csv", "shot-plan-json", "prompt-index",
      "asset-plan-md", "asset-plan-json", "repair-prompts",
      "validation-report-md", "validation-report-json",
      "playbook", "production-pack-zip"
    ];
    if (!format) {
      console.log(chalk.cyan("Available export formats:"));
      formats.forEach(f => console.log(`   ${f}`));
      console.log(chalk.gray("\nUsage: fps export markdown"));
      return;
    }
    if (!formats.includes(format)) {
      console.error(chalk.red(`Invalid format: ${format}`));
      process.exit(1);
    }
    const url = client.getExportUrl(format);
    console.log(chalk.green(`✓ Export URL: ${url}`));
    console.log(chalk.gray("  Open in browser or use curl to download."));
  }));

/* ── preview ── */
program
  .command("preview")
  .description("Preview the generated markdown")
  .option("--flow-only", "Only show Flow copy-ready blocks")
  .option("--continuity", "Run continuity check")
  .action(withErrorHandler(async (opts) => {
    if (opts.continuity) {
      const spin = spinner("Checking continuity...");
      const result = await client.checkContinuity();
      spin.stop(chalk.green("✓ Continuity check complete"));
      return;
    }
    if (opts.flowOnly) {
      const result = await client.getFlowCopyReady();
      console.log(chalk.cyan("Flow Copy-Ready Blocks:"));
      console.log(result.substring(0, 500) + "...");
      return;
    }
    const result = await client.getMarkdown();
    console.log(chalk.cyan(`Markdown (${result.markdown_text?.length || 0} chars):`));
    console.log((result.markdown_text || "").substring(0, 500) + "...");
  }));

/* ── workflow ── */
program
  .command("workflow <screenplay>")
  .description("Full automated workflow: upload → analyze → style → coverage → export")
  .option("-u, --ultra", "Ultra image variation mode")
  .option("-s, --scope <scope>", "Generation scope", "full_pack")
  .option("--no-generate", "Skip AI generation step")
  .option("--dry-run", "Estimate before running the full workflow")
  .action(withErrorHandler(async (file, opts) => {
    if (!fs.existsSync(file)) {
      console.error(chalk.red(`File not found: ${file}`));
      process.exit(1);
    }

    // Dry-run: estimate first
    if (opts.dryRun) {
      console.log(chalk.cyan("🔍 Dry-Run Mode — estimating before workflow...\n"));
      const est = await client.estimate(file);
      console.log(chalk.yellow("📋 Estimation:"));
      console.log(`   File:          ${est.filename}`);
      console.log(`   Size:          ${est.fileSizeKb} KB`);
      console.log(`   Est. Scenes:   ${est.estimatedScenes}`);
      console.log(`   Est. Shots:    ${est.estimatedShots}`);
      console.log(`   Est. Duration: ~${est.estimatedDurationMinutes} min`);
      console.log(chalk.gray("\n   Starting full workflow...\n"));
    }

    const startTime = Date.now();
    const spin = spinner("Step 1/7: Uploading screenplay...");
    const { FlowPromptStudio } = require("../src/index");
    const fpsInstance = new FlowPromptStudio(client.baseUrl);

    const result = await fpsInstance.workflow(file, {
      scope: opts.scope,
      ultra: opts.ultra,
      generate: opts.generate !== false,
      onProgress: (step, msg) => {
        const labels = {
          upload: "Step 1/7:",
          analyze: "Step 2/7:",
          style: "Step 3/7:",
          coverage: "Step 4/7:",
          generate: "Step 5/7:",
          validate: "Step 6/7:",
          export: "Step 7/7:",
        };
        spin.update(`${labels[step] || ""} ${msg}`);
      },
    });

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const shotCount = result.bundle?.shot_rows?.length || 0;
    const sceneCount = result.upload?.scene_count || 0;
    spin.stop(chalk.green("✓") + ` Workflow complete in ${elapsed}s`);

    console.log(chalk.green(`\n🎬 ${sceneCount} scenes → ${shotCount} shots → ${Object.keys(result.exports).length} exports`));

    // Show export URLs
    console.log(chalk.cyan("\n📦 Export URLs:"));
    Object.entries(result.exports).forEach(([fmt, url]) => {
      console.log(chalk.gray(`   ${fmt}: ${url}`));
    });
  }));

/* ── init ── */
program
  .command("init")
  .description("Initialize a Flow Prompt Studio project in the current directory")
  .option("-f, --force", "Overwrite existing config")
  .action(withErrorHandler(async (opts) => {
    const configPath = path.join(process.cwd(), ".fpsrc");
    if (fs.existsSync(configPath) && !opts.force) {
      console.log(chalk.yellow("⚠  .fpsrc already exists. Use --force to overwrite."));
      return;
    }

    const config = {
      apiUrl: process.env.FPS_API_URL || "http://localhost:8000/api/v1",
      defaultScope: "full_pack",
      defaultFormats: ["markdown", "shot-plan-csv", "asset-plan-md", "playbook"],
      ultra: false,
      language: "en",
    };

    fs.writeFileSync(configPath, JSON.stringify(config, null, 2), "utf-8");
    console.log(chalk.green(`✓ Project initialized: ${configPath}`));
    console.log(chalk.gray("\n  Edit .fpsrc to customize your defaults."));
  }));

/* ── doctor ── */
program
  .command("doctor")
  .description("Check system requirements and troubleshoot issues")
  .action(withErrorHandler(async () => {
    console.log(chalk.cyan("🔍 Flow Prompt Studio — System Check\n"));

    // Node.js version
    const nodeVersion = process.version;
    const nodeOk = parseInt(process.version.slice(1)) >= 18;
    console.log(`${nodeOk ? chalk.green("✓") : chalk.red("✗")} Node.js: ${nodeVersion} ${nodeOk ? "" : chalk.red("(need >= 18)")}`);

    // npm version
    let npmVersion = "unknown";
    try {
      npmVersion = require("child_process").execSync("npm --version", { encoding: "utf-8" }).trim();
    } catch {}
    console.log(`   npm:    v${npmVersion}`);

    // Package version
    console.log(`   fps:    v${pkg.version}`);

    // Backend reachable
    const spin = spinner("\nChecking backend...");
    const ping = await client.ping();
    if (ping.reachable) {
      spin.stop(chalk.green("✓ Backend is reachable"));
      const cfg = await client.getConfig();
      console.log(`   URL:      ${client.baseUrl}`);
      console.log(`   API Key:  ${cfg.has_api_key ? chalk.green("✓ Present") : chalk.red("✗ Missing — set DEEPSEEK_API_KEY in backend .env")}`);
    } else {
      spin.stop(chalk.red("✗ Backend is not reachable"));
      console.log(chalk.gray(`\n   ${ping.error}`));
      console.log(chalk.yellow("\n   To fix:"));
      console.log("   1. Navigate to your Flow Prompt Studio backend directory");
      console.log("   2. Run: python -m uvicorn main:app --reload");
      console.log("   3. The backend should be running at http://localhost:8000");
    }

    // Check for common issues
    console.log(chalk.cyan("\n📋 Recommendations:"));
    if (!process.env.DEEPSEEK_API_KEY && !process.env.FPS_API_KEY) {
      console.log(chalk.yellow("   ⚠  No API key detected. Set DEEPSEEK_API_KEY in your backend .env file."));
    }
    console.log("   ✓ Run 'fps init' to create a project config");
    console.log("   ✓ Run 'fps estimate <file>' to preview before running workflow");
  }));

program.parse();
