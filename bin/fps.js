#!/usr/bin/env node
/**
 * Flow Prompt Studio — CLI
 *
 * Kullanım:
 *   fps upload <senaryo.pdf>
 *   fps analyze
 *   fps style
 *   fps generate [--scope full_pack] [--ultra]
 *   fps coverage
 *   fps repair <hata-türü>
 *   fps validate
 *   fps export <format>
 *   fps workflow <senaryo.pdf> [--ultra] [--scope full_pack]
 */

const { program } = require("commander");
const { FlowPromptStudioClient } = require("../src/client");
const { chalk } = require("../src/utils");

const client = new FlowPromptStudioClient();

program
  .name("fps")
  .description("Senaryodan Google Flow / Veo AI prompt paketi üretici")
  .version("1.0.0");

/* ── upload ── */
program
  .command("upload <file>")
  .description("Senaryo dosyası yükle (.txt, .md, .pdf, .docx)")
  .action(async (file) => {
    try {
      const fs = require("fs");
      if (!fs.existsSync(file)) {
        console.error(chalk.red(`Dosya bulunamadı: ${file}`));
        process.exit(1);
      }
      console.log(chalk.cyan(`Yükleniyor: ${file}`));
      const result = await client.uploadScreenplay(file);
      if (result.success) {
        console.log(chalk.green(`✅ Yüklendi: ${result.filename}`));
        console.log(`   ${result.char_count} karakter, ${result.scene_count} sahne`);
        console.log(chalk.gray(`   Sahneler: ${result.scenes.map(s => s.scene_id).join(", ")}`));
      } else {
        console.error(chalk.red(`❌ Yükleme başarısız: ${result.error || "Bilinmeyen hata"}`));
      }
    } catch (err) {
      console.error(chalk.red(`❌ Hata: ${err.message}`));
      process.exit(1);
    }
  });

/* ── analyze ── */
program
  .command("analyze")
  .description("Senaryodan karakter, mekan ve prop çıkar")
  .action(async () => {
    try {
      console.log(chalk.cyan("Analiz ediliyor..."));
      const [analysis, stats] = await Promise.all([client.getAnalysis(), client.getStats()]);
      console.log(chalk.yellow(`\n📊 ${stats.scene_count} sahne, ${stats.char_count} karakter, ~${stats.estimated_segments} segment`));
      console.log(chalk.yellow(`\n👤 Karakterler (${analysis.characters.length}):`));
      analysis.characters.slice(0, 15).forEach(c => console.log(`   ${c.name} (${c.count}x)`));
      console.log(chalk.yellow(`\n📍 Mekanlar (${analysis.locations.length}):`));
      analysis.locations.slice(0, 15).forEach(l => console.log(`   ${l.name} (${l.count}x) [${l.source}]`));
      console.log(chalk.yellow(`\n🔧 Proplar (${analysis.props.length}):`));
      analysis.props.slice(0, 15).forEach(p => console.log(`   ${p.name} (${p.count}x)`));
    } catch (err) {
      console.error(chalk.red(`❌ Hata: ${err.message}`));
      process.exit(1);
    }
  });

/* ── style ── */
program
  .command("style")
  .description("Görsel stil tespiti yap")
  .option("--show", "Mevcut stil ayarlarını göster")
  .action(async (opts) => {
    try {
      if (opts.show) {
        const style = await client.getStyle();
        console.log(chalk.yellow("Mevcut Stil Ayarları:"));
        Object.entries(style).forEach(([k, v]) => {
          console.log(chalk.cyan(`\n  ${k}:`));
          console.log(`  ${v || "(boş)"}`);
        });
        return;
      }
      console.log(chalk.cyan("Stil tespit ediliyor..."));
      const result = await client.detectStyle();
      if (result.detected) {
        console.log(chalk.green(`✅ Stil tespit edildi (${result.mode || "AI"})`));
        const s = result.settings;
        console.log(chalk.gray(`  Görsel: ${s.visual_style?.substring(0, 80)}...`));
        console.log(chalk.gray(`  Kamera: ${s.camera_language?.substring(0, 80)}...`));
      } else {
        console.log(chalk.yellow(`⚠️  ${result.message}`));
      }
    } catch (err) {
      console.error(chalk.red(`❌ Hata: ${err.message}`));
      process.exit(1);
    }
  });

/* ── generate ── */
program
  .command("generate")
  .description("AI prompt paketi üret")
  .option("-s, --scope <scope>", "full_pack, scene_breakdown, character_bible, flow_agent_instructions, ultra_image_variation_pack", "full_pack")
  .option("-u, --ultra", "Ultra görsel varyasyon modu")
  .option("-m, --manual", "Manuel mod (API çağrısı yapma)")
  .option("-o, --output <file>", "Çıktıyı dosyaya kaydet")
  .action(async (opts) => {
    try {
      console.log(chalk.cyan(`Üretiliyor: ${opts.scope}...`));
      const result = await client.generate(opts.scope, opts.ultra, opts.manual);
      if (result.manual) {
        console.log(chalk.yellow("📋 Manuel Mod — Master prompt hazırlandı"));
        console.log(chalk.gray(`   Prompt uzunluğu: ${result.master_prompt?.length || 0} karakter`));
        if (opts.output && result.master_prompt) {
          require("fs").writeFileSync(opts.output, result.master_prompt, "utf-8");
          console.log(chalk.green(`✅ Kaydedildi: ${opts.output}`));
        }
      } else if (result.success) {
        console.log(chalk.green(`✅ Üretim tamamlandı (${result.model_used})`));
        if (opts.output && result.markdown) {
          require("fs").writeFileSync(opts.output, result.markdown, "utf-8");
          console.log(chalk.green(`✅ Kaydedildi: ${opts.output}`));
        }
      } else {
        console.error(chalk.red(`❌ ${result.error}`));
      }
    } catch (err) {
      console.error(chalk.red(`❌ Hata: ${err.message}`));
      process.exit(1);
    }
  });

/* ── coverage ── */
program
  .command("coverage")
  .description("Kamera coverage ve shot planı görüntüle")
  .option("--refresh", "Önbelleği temizle ve yeniden hesapla")
  .action(async (opts) => {
    try {
      console.log(chalk.cyan("Coverage planı alınıyor..."));
      const bundle = await client.getBundle(opts.refresh);
      console.log(chalk.green(`\n✅ ${bundle.shot_rows.length} shot planlandı`));
      console.log(chalk.yellow(`   Asset: ${bundle.asset_plan?.collections?.length || 0} koleksiyon`));
      console.log(chalk.yellow(`   Repair: ${bundle.repair_markdown?.length || 0} karakter`));
      // Shot type summary
      const byType = {};
      bundle.shot_rows.forEach(s => { byType[s["Shot Türü"]] = (byType[s["Shot Türü"]] || 0) + 1; });
      console.log(chalk.cyan("\nShot Dağılımı:"));
      Object.entries(byType).sort(([,a], [,b]) => b - a).forEach(([t, c]) => {
        console.log(`   ${t}: ${c}`);
      });
    } catch (err) {
      console.error(chalk.red(`❌ Hata: ${err.message}`));
      process.exit(1);
    }
  });

/* ── repair ── */
program
  .command("repair [error-type]")
  .description("Onarım promptu üret. Hata türü belirtilmezse liste gösterir.")
  .option("-s, --scene <id>", "Sahne ID", "SCENE_01A")
  .option("--segment <id>", "Segment ID")
  .option("-p, --problem <text>", "Sorun açıklaması")
  .option("--all", "Tüm hata türleri için üret")
  .action(async (errorType, opts) => {
    try {
      if (opts.all) {
        console.log(chalk.cyan("Tüm onarım promptları üretiliyor..."));
        const result = await client.generateAllRepairs();
        console.log(chalk.green(`✅ ${result.count} onarım promptu (${result.markdown.length} karakter)`));
        return;
      }
      if (!errorType) {
        console.log(chalk.cyan("Kullanılabilir hata türleri:"));
        const types = await client.getErrorTypes();
        types.error_types.forEach((t, i) => console.log(`   ${String(i + 1).padStart(2)}. ${t}`));
        console.log(chalk.gray("\nKullanım: fps repair \"Karakter yüzü değişti\" --scene SCENE_01A"));
        return;
      }
      console.log(chalk.cyan(`Onarım promptu: ${errorType}`));
      const result = await client.generateRepair(errorType, opts.scene, opts.segment || "", opts.problem || "");
      console.log(chalk.green("✅ Onarım promptu:"));
      console.log(chalk.gray(result.repair?.flow_agent_prompt?.substring(0, 200) + "..."));
      console.log(chalk.cyan("\nStrateji:"));
      console.log(result.repair?.retry_strategy);
    } catch (err) {
      console.error(chalk.red(`❌ Hata: ${err.message}`));
      process.exit(1);
    }
  });

/* ── validate ── */
program
  .command("validate")
  .description("Prompt paketini doğrula")
  .action(async () => {
    try {
      console.log(chalk.cyan("Doğrulanıyor..."));
      const result = await client.validate();
      const issues = result.issues || [];
      const summary = result.summary || {};
      console.log(chalk.green(`\n✅ ${issues.length} sorun tespit edildi`));
      console.log(`   🔴 Kritik: ${summary.critical || 0}  🟡 Uyarı: ${summary.warning || 0}  🔵 Bilgi: ${summary.info || 0}`);
      if (issues.length > 0) {
        console.log(chalk.yellow("\nSorunlar:"));
        issues.slice(0, 10).forEach(i => {
          const icon = i.severity === "critical" ? "🔴" : i.severity === "warning" ? "🟡" : "🔵";
          console.log(`   ${icon} [${i.severity}] ${i.message}`);
        });
      }
    } catch (err) {
      console.error(chalk.red(`❌ Hata: ${err.message}`));
      process.exit(1);
    }
  });

/* ── export ── */
program
  .command("export [format]")
  .description("Dosyayı dışa aktar. Format belirtilmezse liste gösterir.")
  .option("-o, --output <dir>", "Çıktı dizini")
  .action(async (format, opts) => {
    const formats = [
      "markdown", "txt", "scene-markdown", "flow-copy-ready",
      "shot-plan-csv", "shot-plan-json", "prompt-index",
      "asset-plan-md", "asset-plan-json", "repair-prompts",
      "validation-report-md", "validation-report-json",
      "playbook", "production-pack-zip"
    ];
    if (!format) {
      console.log(chalk.cyan("Kullanılabilir export formatları:"));
      formats.forEach(f => console.log(`   ${f}`));
      console.log(chalk.gray("\nKullanım: fps export markdown"));
      return;
    }
    if (!formats.includes(format)) {
      console.error(chalk.red(`Geçersiz format: ${format}`));
      process.exit(1);
    }
    try {
      console.log(chalk.cyan(`Dışa aktarılıyor: ${format}`));
      const url = client.getExportUrl(format);
      console.log(chalk.green(`✅ İndirme URL: ${url}`));
      console.log(chalk.gray("Dosyayı indirmek için tarayıcıda açın veya curl kullanın."));
    } catch (err) {
      console.error(chalk.red(`❌ Hata: ${err.message}`));
      process.exit(1);
    }
  });

/* ── preview ── */
program
  .command("preview")
  .description("Oluşturulan markdown'u önizle")
  .option("--flow-only", "Sadece Flow copy-ready blokları")
  .option("--continuity", "Süreklilik kontrolü yap")
  .action(async (opts) => {
    try {
      if (opts.continuity) {
        console.log(chalk.cyan("Süreklilik kontrolü..."));
        const result = await client.checkContinuity();
        console.log(chalk.green("✅ Kontrol tamamlandı"));
        return;
      }
      if (opts.flowOnly) {
        const result = await client.getFlowCopyReady();
        console.log(chalk.cyan("Flow Copy-Ready Blokları:"));
        console.log(result.substring(0, 500) + "...");
        return;
      }
      const result = await client.getMarkdown();
      console.log(chalk.cyan(`Markdown (${result.markdown_text?.length || 0} karakter):`));
      console.log((result.markdown_text || "").substring(0, 500) + "...");
    } catch (err) {
      console.error(chalk.red(`❌ Hata: ${err.message}`));
      process.exit(1);
    }
  });

/* ── config ── */
program
  .command("config")
  .description("Backend yapılandırmasını göster")
  .action(async () => {
    try {
      const cfg = await client.getConfig();
      console.log(chalk.cyan("Backend Yapılandırması:"));
      console.log(`   API Key: ${cfg.has_api_key ? "✅ Mevcut" : "❌ Yok"}`);
      console.log(`   Hızlı Model: ${cfg.fast_model}`);
      console.log(`   Pro Model: ${cfg.pro_model}`);
      console.log(`   Yedek Model: ${cfg.fallback_model}`);
    } catch (err) {
      console.error(chalk.red(`❌ Backend'e bağlanılamadı: ${err.message}`));
      console.error(chalk.gray(`   ${client.baseUrl} adresinde backend çalışıyor mu?`));
      process.exit(1);
    }
  });

/* ── workflow ── */
program
  .command("workflow <screenplay>")
  .description("Tam otomatik workflow: yükle → analiz → stil → coverage → export")
  .option("-u, --ultra", "Ultra görsel varyasyon modu")
  .option("-s, --scope <scope>", "Üretim kapsamı", "full_pack")
  .option("--no-generate", "AI üretimi adımını atla")
  .action(async (file, opts) => {
    const fs = require("fs");
    if (!fs.existsSync(file)) {
      console.error(chalk.red(`Dosya bulunamadı: ${file}`));
      process.exit(1);
    }

    const startTime = Date.now();
    const log = (step, msg) => console.log(chalk.cyan(`[${step}]`) + ` ${msg}`);

    try {
      /* Step 1: Upload */
      log("1/7", `Senaryo yükleniyor: ${file}`);
      const upload = await client.uploadScreenplay(file);
      if (!upload.success) throw new Error(upload.error);
      log("1/7", chalk.green(`✅ ${upload.scene_count} sahne, ${upload.char_count} karakter`));

      /* Step 2: Analyze */
      log("2/7", "Karakter, mekan, prop analizi...");
      const analysis = await client.getAnalysis();
      log("2/7", chalk.green(`✅ ${analysis.characters.length} karakter, ${analysis.locations.length} mekan, ${analysis.props.length} prop`));

      /* Step 3: Style */
      log("3/7", "Görsel stil tespiti...");
      const style = await client.detectStyle();
      log("3/7", chalk.green(`✅ ${style.detected ? "AI tespit" : "Varsayılan"} (${style.mode || "auto"})`));

      /* Step 4: Coverage */
      log("4/7", "Kamera coverage planı...");
      const bundle = await client.getBundle(true);
      log("4/7", chalk.green(`✅ ${bundle.shot_rows.length} shot, ${bundle.asset_plan?.collections?.length || 0} koleksiyon`));

      /* Step 5: Generate (optional) */
      if (opts.generate !== false) {
        log("5/7", `AI prompt paketi üretiliyor (${opts.scope})...`);
        const gen = await client.generate(opts.scope, opts.ultra, false);
        if (gen.manual) {
          log("5/7", chalk.yellow(`⚠️  Manuel mod — ${gen.master_prompt?.length || 0} karakterlik prompt hazır`));
        } else if (gen.success) {
          log("5/7", chalk.green(`✅ ${gen.model_used} ile üretildi`));
        } else {
          log("5/7", chalk.yellow(`⚠️  ${gen.error}`));
        }
      } else {
        log("5/7", chalk.gray("Atlandı (--no-generate)"));
      }

      /* Step 6: Validate */
      log("6/7", "Paket doğrulanıyor...");
      const validation = await client.validate();
      const vCount = validation.issues?.length || 0;
      log("6/7", chalk.green(`✅ ${vCount} sorun (${validation.summary?.critical || 0} kritik)`));

      /* Step 7: Export */
      log("7/7", "Dışa aktarılıyor...");
      const formats = ["markdown", "shot-plan-csv", "asset-plan-md", "repair-prompts", "validation-report-md", "playbook"];
      for (const fmt of formats) {
        const url = client.getExportUrl(fmt);
        log("7/7", chalk.gray(`   ${fmt}: ${url}`));
      }

      const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
      console.log(chalk.green(`\n🎬 Workflow tamamlandı! (${elapsed}s)`));
      console.log(chalk.gray(`   ${upload.scene_count} sahne → ${bundle.shot_rows.length} shot → ${formats.length} export`));

    } catch (err) {
      console.error(chalk.red(`\n❌ Workflow başarısız: ${err.message}`));
      process.exit(1);
    }
  });

program.parse();
