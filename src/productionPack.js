/**
 * Flow Prompt Studio — Google Flow / Veo Production Pack Generator
 *
 * Turns parsed screenplay scenes into practical shot Markdown files.
 * Works offline and keeps output structured for CLI users and assistants.
 */

const fs = require("fs");
const path = require("path");

const VALID_VEO_DURATIONS = [4, 6, 8];

const RISK_RULES = [
  { key: "face_identity", terms: ["face", "character", "person", "teacher", "doctor", "young", "worker", "patient", "friend", "deniz"] },
  { key: "text_on_screen", terms: ["screen", "monitor", "laptop", "phone", "tablet", "terminal", "code", "subtitle", "text", "dashboard"] },
  { key: "screen_continuity", terms: ["screen", "monitor", "laptop", "dashboard", "terminal", "code", "graph", "ui", "interface", "cyber", "software"] },
  { key: "ui_redesign", terms: ["ui", "interface", "dashboard", "screen", "monitor", "software", "app"] },
  { key: "overacting", terms: ["panic", "alarm", "fear", "attack", "crisis", "shouting", "angry", "urgent"] },
  { key: "hands", terms: ["hand", "typing", "keyboard", "phone", "touch", "write", "hold"] },
  { key: "crowd", terms: ["crowd", "people", "office", "center", "classroom", "hospital", "public"] },
  { key: "logos", terms: ["brand", "logo", "company", "government", "public", "hospital", "school"] },
  { key: "unwanted_sci_fi", terms: ["cyber", "security", "ai", "data", "network", "system", "analysis"] },
  { key: "alarm_exaggeration", terms: ["alarm", "warning", "red", "attack", "anomaly", "cyber", "breach"] },
];

const NEGATIVE_CONSTRAINTS = {
  face_identity: "Keep character identity stable and avoid changing face shape, age, hairstyle, or wardrobe.",
  text_on_screen: "Avoid readable fake text, random words, logos, watermarks, and changing on-screen typography.",
  screen_continuity: "Preserve the same screen layout and only animate existing interface elements when screen motion is needed.",
  ui_redesign: "Do not redesign the interface, add new panels, popups, alerts, overlays, or warning boxes.",
  overacting: "Keep performance restrained, natural, and documentary-realistic; avoid exaggerated reactions.",
  hands: "Keep hand motion simple and believable; avoid distorted fingers or unnecessary gestures.",
  crowd: "Keep background people minimal and consistent; avoid adding extra prominent characters.",
  logos: "Avoid real brand logos, government seals, hospital logos, or copyrighted marks.",
  unwanted_sci_fi: "Avoid holograms, neon sci-fi effects, floating data, futuristic rooms, and impossible interfaces.",
  alarm_exaggeration: "Avoid flashing red lights, full-screen red alerts, sirens, dramatic alarm graphics, and glowing red overlays.",
};

class ProductionPackGenerator {
  static get validDurations() {
    return [...VALID_VEO_DURATIONS];
  }

  static create(parseResult, options = {}) {
    const title = options.title || this._titleFromParseResult(parseResult);
    const mode = options.mode || "director";
    const learning = this._normalizeLearning(options.learning || this.loadLearning(options.learningPath || options.projectDir));
    const defaultSceneDuration = this._validDuration(options.defaultDuration || 8);
    const requestedShotsPerScene = parseInt(options.shotsPerScene || 0, 10) || 0;
    const shotsPerScene = requestedShotsPerScene > 0 ? requestedShotsPerScene : 0;
    const projectSlug = this._slug(title);
    const shots = [];
    const continuity = this._buildContinuity(parseResult, { title, mode, learning });

    let shotNumber = 0;
    for (const scene of parseResult.scenes || []) {
      const sceneDuration = this._sceneDuration(scene) || defaultSceneDuration * (shotsPerScene || 3);
      const durations = shotsPerScene
        ? this._fixedDurations(shotsPerScene, defaultSceneDuration)
        : this._splitDuration(sceneDuration);

      durations.forEach((duration, sceneShotIndex) => {
        shotNumber += 1;
        shots.push(this._buildShot({
          shotNumber,
          scene,
          sceneShotIndex,
          sceneShotCount: durations.length,
          duration,
          mode,
          learning,
        }));
      });
    }

    return {
      title,
      slug: projectSlug,
      mode,
      platform: "Google Flow / Veo",
      validDurations: [...VALID_VEO_DURATIONS],
      source: parseResult.stats?.filename || "screenplay",
      sceneCount: parseResult.scenes?.length || 0,
      shotCount: shots.length,
      continuity,
      learning,
      shots,
    };
  }

  static export(parseResult, outputDir, options = {}) {
    const title = options.title || this._titleFromParseResult(parseResult);
    const rootDir = path.join(outputDir || ".", this._slug(title));
    const pack = this.create(parseResult, {
      ...options,
      title,
      projectDir: options.projectDir || (options.learningPath ? undefined : rootDir),
    });
    this._ensureDir(rootDir);

    const files = [];
    files.push(this._writeFile(path.join(rootDir, "INDEX.md"), this.toIndexMarkdown(pack)));
    files.push(this._writeFile(path.join(rootDir, "CONTINUITY.md"), this.toContinuityMarkdown(pack)));
    files.push(this._writeFile(path.join(rootDir, "LEARNING.md"), this.toLearningMarkdown(pack.learning, pack)));

    const shotDir = path.join(rootDir, "shots");
    this._ensureDir(shotDir);
    pack.shots.forEach((shot) => {
      files.push(this._writeFile(
        path.join(shotDir, `SHOT_${String(shot.number).padStart(3, "0")}.md`),
        this.toShotMarkdown(shot, pack)
      ));
    });

    files.push(this._writeFile(path.join(rootDir, "LEARNING.json"), JSON.stringify(pack.learning, null, 2)));
    files.push(this._writeFile(path.join(rootDir, "production-pack.json"), JSON.stringify(pack, null, 2)));

    return {
      ...pack,
      outputDir: rootDir,
      files,
    };
  }

  static toIndexMarkdown(pack) {
    let md = `# ${pack.title} — Production Pack\n\n`;
    md += `**Platform:** ${pack.platform}\n`;
    md += `**Mode:** ${pack.mode}\n`;
    md += `**Source:** ${pack.source}\n`;
    md += `**Scenes:** ${pack.sceneCount}\n`;
    md += `**Shots:** ${pack.shotCount}\n`;
    md += `**Valid Veo durations:** ${pack.validDurations.join(", ")} seconds\n\n`;
    md += `## Workflow\n\n`;
    md += `- Use the CLI directly or let an assistant operate these files on behalf of the user.\n`;
    md += `- Select the recommended duration in Google Flow / Veo UI; the prompt text intentionally avoids duration wording.\n`;
    md += `- Use reference images when character identity, location continuity, or screen continuity matters.\n`;
    md += `- Review each output with the shot quality checklist before moving to the next shot.\n\n`;
    md += `## Feedback Loop\n\n`;
    md += `After reviewing generated outputs, record learning with:\n\n`;
    md += "```bash\n";
    md += `fps feedback "<pack-directory>" --type rejected --shot SHOT_001 --note "too dramatic, added unwanted red alarm overlays"\n`;
    md += `fps feedback "<pack-directory>" --type approved --shot SHOT_001 --note "realistic lighting and stable screen layout"\n`;
    md += "```\n\n";
    md += `Then regenerate the pack with \`--learning ${pack.slug}\` or reuse the same output directory.\n\n`;
    md += `## Shot Files\n\n`;
    pack.shots.forEach((shot) => {
      md += `- [SHOT_${String(shot.number).padStart(3, "0")}.md](shots/SHOT_${String(shot.number).padStart(3, "0")}.md) — ${shot.sceneNumber}, ${shot.durationSeconds}s, ${shot.intent}\n`;
    });
    return md;
  }

  static toContinuityMarkdown(pack) {
    const c = pack.continuity;
    let md = `# ${pack.title} — Continuity Memory\n\n`;
    md += `## Character Identity\n\n`;
    c.characters.forEach((name) => {
      md += `- ${name}: preserve face, age, wardrobe direction, posture, and performance style across shots.\n`;
    });
    if (!c.characters.length) md += `- No speaking characters detected; preserve any referenced visual subjects from shot to shot.\n`;
    md += `\n## Locations\n\n`;
    c.locations.forEach((location) => {
      md += `- ${location}: keep spatial layout, lighting direction, props, and camera geography consistent.\n`;
    });
    md += `\n## Visual Rules\n\n`;
    c.visualRules.forEach((rule) => {
      md += `- ${rule}\n`;
    });
    md += `\n## Rejected Output Learning\n\n`;
    if (pack.learning.rejected.length) {
      pack.learning.rejected.forEach((entry) => {
        md += `- ${entry.scope}: avoid ${entry.note}\n`;
      });
    } else {
      md += `- No rejected outputs recorded yet.\n`;
    }
    md += `\n## Approved Output Learning\n\n`;
    if (pack.learning.approved.length) {
      pack.learning.approved.forEach((entry) => {
        md += `- ${entry.scope}: preserve ${entry.note}\n`;
      });
    } else {
      md += `- No approved outputs recorded yet.\n`;
    }
    return md;
  }

  static toLearningMarkdown(learning, pack = {}) {
    const data = this._normalizeLearning(learning);
    let md = `# ${pack.title || "Production Pack"} — Output Learning\n\n`;
    md += `Use this file to track what worked and what failed during generation. The machine-readable source is LEARNING.json.\n\n`;
    md += `## Approved\n\n`;
    if (data.approved.length) {
      data.approved.forEach((entry) => {
        md += `- ${entry.scope}: ${entry.note}${entry.tags.length ? ` [${entry.tags.join(", ")}]` : ""}\n`;
      });
    } else {
      md += `- No approved outputs recorded yet.\n`;
    }
    md += `\n## Rejected\n\n`;
    if (data.rejected.length) {
      data.rejected.forEach((entry) => {
        md += `- ${entry.scope}: ${entry.note}${entry.tags.length ? ` [${entry.tags.join(", ")}]` : ""}\n`;
      });
    } else {
      md += `- No rejected outputs recorded yet.\n`;
    }
    return md;
  }

  static toShotMarkdown(shot, pack) {
    let md = `# SHOT_${String(shot.number).padStart(3, "0")} — ${shot.sceneNumber}\n\n`;
    md += `## Google Flow Setup\n\n`;
    md += `- Tool recommendation: ${shot.flowToolAdvice}\n`;
    md += `- Select duration in UI: ${shot.durationSeconds} seconds\n`;
    md += `- Use start image prompt first when the shot begins a new visual setup.\n`;
    md += `- Use end image prompt when the final frame needs precise continuity.\n`;
    md += `- Use video prompt with start/end frames when continuity is critical.\n\n`;
    md += `## References\n\n`;
    shot.references.forEach((ref) => {
      md += `- ${ref}\n`;
    });
    md += `\n## Expanded Shot Script\n\n`;
    Object.entries(shot.productionDetails).forEach(([label, value]) => {
      md += `- ${label}: ${value}\n`;
    });
    md += `\n## Risk Profile\n\n`;
    shot.risks.forEach((risk) => {
      md += `- ${risk}: ${NEGATIVE_CONSTRAINTS[risk]}\n`;
    });
    if (!shot.risks.length) md += `- low: No major model-specific risk detected from the scene metadata.\n`;
    md += `\n## Start Image Prompt\n\n${shot.startImagePrompt}\n\n`;
    md += `## End Image Prompt\n\n${shot.endImagePrompt}\n\n`;
    md += `## Video Prompt\n\n${shot.videoPrompt}\n\n`;
    md += `## Quality Checklist\n\n`;
    shot.qualityChecklist.forEach((item) => {
      md += `- [ ] ${item}\n`;
    });
    md += `\n## Continuity Source\n\n`;
    md += `- Project continuity file: CONTINUITY.md\n`;
    md += `- Production pack: ${pack.title}\n`;
    return md;
  }

  static _buildShot({ shotNumber, scene, sceneShotIndex, sceneShotCount, duration, mode, learning }) {
    const intent = this._shotIntent(sceneShotIndex, sceneShotCount);
    const context = `${scene.heading || ""} ${scene.location || ""} ${scene.content || ""} ${(scene.characters || []).join(" ")}`;
    const risks = this._riskProfile(context);
    const references = this._referenceStrategy(scene, sceneShotIndex, risks);
    const productionDetails = this._productionDetails(scene, intent, sceneShotIndex, sceneShotCount, mode);
    const negative = this._negativePrompt(risks, learning);
    const positive = this._positiveLearning(learning);

    return {
      number: shotNumber,
      sceneNumber: scene.number,
      sceneHeading: scene.heading,
      sceneLocation: scene.location,
      sceneShotIndex: sceneShotIndex + 1,
      sceneShotCount,
      durationSeconds: duration,
      intent,
      mode,
      risks,
      references,
      flowToolAdvice: this._flowToolAdvice(sceneShotIndex, risks),
      productionDetails,
      startImagePrompt: this._startPrompt(scene, productionDetails, negative, positive),
      endImagePrompt: this._endPrompt(scene, productionDetails, negative, positive),
      videoPrompt: this._videoPrompt(scene, productionDetails, negative, positive),
      qualityChecklist: this._qualityChecklist(risks),
    };
  }

  static _productionDetails(scene, intent, sceneShotIndex, sceneShotCount, mode) {
    const characters = scene.characters?.join(", ") || "visual subjects from the scene";
    const location = scene.location || scene.heading || "the scripted location";
    return {
      Location: location,
      "Time of day": this._timeOfDay(scene.heading),
      Environment: `Grounded, realistic environment based on ${location}.`,
      Characters: characters,
      Props: this._propsFromScene(scene),
      Wardrobe: "Consistent with established character sheets and previous approved frames.",
      "Character state": this._characterState(sceneShotIndex, sceneShotCount),
      Blocking: this._blocking(intent),
      "Camera/framing": this._camera(intent),
      Movement: this._movement(intent),
      Lighting: this._lighting(scene.heading),
      "Color palette": "Natural production color, restrained contrast, no artificial over-stylization.",
      Sound: "Use as production context only; do not add visible text or sound labels to the image.",
      Continuity: "Preserve character identity, location geography, props, wardrobe, and screen layouts from approved references.",
      Transition: sceneShotIndex === 0 ? "Begin from the previous approved scene or a clean establishing frame." : "Continue from the previous shot without changing the visual language.",
      "VFX/post notes": mode === "director" ? "Keep any AI-visible effect subtle, practical, and motivated by the story." : "Minimal post notes.",
      "AI-risk notes": "Prefer realistic detail over spectacle; avoid adding elements not present in the script.",
    };
  }

  static _startPrompt(scene, details, negative, positive = "") {
    return [
      `Create a realistic start frame for ${scene.heading}.`,
      `Location: ${details.Location}.`,
      `Characters: ${details.Characters}.`,
      `Blocking: ${this._sentence(details.Blocking)}`,
      `Camera/framing: ${this._sentence(details["Camera/framing"])}`,
      `Lighting: ${this._sentence(details.Lighting)}`,
      `Preserve continuity with approved references and keep the image grounded, cinematic, and production-realistic.`,
      positive,
      negative,
    ].filter(Boolean).join(" ");
  }

  static _endPrompt(scene, details, negative, positive = "") {
    return [
      `Create a realistic end frame for ${scene.heading}.`,
      `Keep the same location, characters, wardrobe, props, lighting direction, and camera language from the start frame.`,
      `Show only a natural progression of the action: ${this._sentence(details["Character state"])}`,
      `The frame should feel like the final moment of the same shot, not a redesigned scene.`,
      positive,
      negative,
    ].filter(Boolean).join(" ");
  }

  static _videoPrompt(scene, details, negative, positive = "") {
    return [
      `Preserve the same scene, character identity, wardrobe, props, camera angle, lens feel, and lighting from the reference frames.`,
      `The action is restrained and realistic: ${this._sentence(details.Blocking)}`,
      `Camera movement: ${this._sentence(details.Movement)}`,
      `Keep continuity exact across the shot and avoid introducing new visual elements.`,
      positive,
      negative,
    ].filter(Boolean).join(" ");
  }

  static _referenceStrategy(scene, sceneShotIndex, risks) {
    const refs = [];
    if (scene.characters?.length) refs.push(`Character reference: ${scene.characters.join(", ")} character sheet(s).`);
    refs.push(sceneShotIndex === 0 ? "Location reference: approved establishing frame or location board for this scene." : "Continuity reference: previous approved shot/end frame from the same scene.");
    if (risks.includes("screen_continuity")) refs.push("Screen continuity reference: use the approved screen/interface frame and do not let the model redesign it.");
    refs.push("Rejected direction reference: avoid any previously rejected over-dramatic, unrealistic, or inconsistent outputs.");
    return refs;
  }

  static _flowToolAdvice(sceneShotIndex, risks) {
    if (risks.includes("screen_continuity")) {
      return "Use start/end frames and reference images because screen continuity is critical.";
    }
    if (sceneShotIndex > 0) {
      return "Use the previous approved end frame as the reference image for continuity.";
    }
    if (risks.includes("face_identity")) {
      return "Use character reference images before generating video so identity remains stable.";
    }
    return "Use text-to-image for the start frame, then generate video from the approved frame.";
  }

  static _riskProfile(text) {
    const lower = String(text || "").toLowerCase();
    const risks = [];
    RISK_RULES.forEach((rule) => {
      if (rule.terms.some((term) => lower.includes(term))) risks.push(rule.key);
    });
    return [...new Set(risks)];
  }

  static _negativePrompt(risks, learning = null) {
    const constraints = risks.map((risk) => NEGATIVE_CONSTRAINTS[risk]).filter(Boolean);
    const learned = this._normalizeLearning(learning).rejected.map((entry) => `Avoid this previously rejected direction: ${entry.note}.`);
    constraints.push("No readable text, no logos, no watermarks, no subtitles, no UI labels unless explicitly required.");
    return constraints.concat(learned).join(" ");
  }

  static _positiveLearning(learning = null) {
    const approved = this._normalizeLearning(learning).approved;
    if (!approved.length) return "";
    return approved.map((entry) => `Preserve this approved direction when relevant: ${entry.note}.`).join(" ");
  }

  static _qualityChecklist(risks) {
    const items = [
      "Recommended Veo duration was selected in the UI.",
      "Character identity and wardrobe match the references.",
      "Location geography and lighting remain consistent.",
      "No unwanted logos, watermarks, subtitles, or readable fake text.",
      "Motion level matches the scene and does not become theatrical.",
    ];
    if (risks.includes("screen_continuity")) {
      items.push("Screen layout is unchanged and only intended elements moved.");
      items.push("No new popups, panels, alerts, warning boxes, or red overlays appeared.");
    }
    return items;
  }

  static _splitDuration(totalSeconds) {
    const target = Math.max(4, Math.round(totalSeconds || 8));
    const exact = this._durationCombination(target);
    if (exact) return this._sortDurations(exact);

    for (let offset = 1; offset <= 3; offset++) {
      const lower = this._durationCombination(target - offset);
      if (lower) return this._sortDurations(lower);
      const upper = this._durationCombination(target + offset);
      if (upper) return this._sortDurations(upper);
    }

    return [this._validDuration(target)];
  }

  static _durationCombination(target) {
    if (target < 4) return null;
    const dp = Array.from({ length: target + 1 }, () => null);
    dp[0] = [];
    for (let t = 1; t <= target; t++) {
      for (const duration of [8, 6, 4]) {
        if (t >= duration && dp[t - duration]) {
          const candidate = [...dp[t - duration], duration];
          if (!dp[t] || this._betterDurationPlan(candidate, dp[t])) {
            dp[t] = candidate;
          }
        }
      }
    }
    return dp[target];
  }

  static _betterDurationPlan(candidate, current) {
    if (candidate.length !== current.length) return candidate.length < current.length;
    const candidateFours = candidate.filter((n) => n === 4).length;
    const currentFours = current.filter((n) => n === 4).length;
    if (candidateFours !== currentFours) return candidateFours < currentFours;
    const candidateEights = candidate.filter((n) => n === 8).length;
    const currentEights = current.filter((n) => n === 8).length;
    return candidateEights > currentEights;
  }

  static _fixedDurations(count, duration) {
    return Array.from({ length: count }, () => this._validDuration(duration));
  }

  static _sortDurations(durations) {
    return [...durations].sort((a, b) => b - a);
  }

  static _validDuration(value) {
    const n = parseInt(value, 10);
    if (VALID_VEO_DURATIONS.includes(n)) return n;
    return VALID_VEO_DURATIONS.reduce((best, current) => (
      Math.abs(current - n) < Math.abs(best - n) ? current : best
    ), 8);
  }

  static _sceneDuration(scene) {
    const source = `${scene.number || ""}\n${scene.heading || ""}\n${scene.content || ""}`;
    const m = String(source).match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*[-–—]\s*(\d{1,2}):(\d{2})(?::(\d{2}))?/);
    if (!m) return null;
    const start = this._toSeconds(m[1], m[2], m[3]);
    const end = this._toSeconds(m[4], m[5], m[6]);
    return end > start ? end - start : null;
  }

  static _toSeconds(a, b, c) {
    if (c === undefined) return parseInt(a, 10) * 60 + parseInt(b, 10);
    return parseInt(a, 10) * 3600 + parseInt(b, 10) * 60 + parseInt(c, 10);
  }

  static _shotIntent(index, count) {
    if (count === 1) return "complete scene beat";
    if (index === 0) return "establish the scene and visual geography";
    if (index === count - 1) return "resolve the scene beat and preserve continuity into the next shot";
    return "develop the action with controlled continuity";
  }

  static _timeOfDay(heading) {
    const h = String(heading || "").toLowerCase();
    if (h.includes("night") || h.includes("gece")) return "Night";
    if (h.includes("morning") || h.includes("sabah")) return "Morning";
    if (h.includes("evening") || h.includes("akşam") || h.includes("aksam")) return "Evening";
    if (h.includes("day") || h.includes("gündüz") || h.includes("gunduz")) return "Day";
    return "Scripted or visually motivated time of day";
  }

  static _lighting(heading) {
    const time = this._timeOfDay(heading);
    if (time === "Night") return "Motivated practical light, controlled shadows, realistic low-light exposure.";
    if (time === "Morning") return "Soft natural morning light with gentle contrast.";
    if (time === "Evening") return "Warm practical light mixed with fading ambient light.";
    return "Natural motivated light based on the location and scene tone.";
  }

  static _propsFromScene(scene) {
    const text = `${scene.heading || ""} ${scene.location || ""} ${scene.content || ""}`.toLowerCase();
    const props = [];
    if (text.includes("screen") || text.includes("monitor") || text.includes("cyber")) props.push("computer screens");
    if (text.includes("phone")) props.push("phone");
    if (text.includes("hospital") || text.includes("doctor")) props.push("medical objects");
    if (text.includes("school") || text.includes("teacher")) props.push("classroom objects");
    return props.length ? props.join(", ") : "Only props motivated by the scene; do not add decorative clutter.";
  }

  static _blocking(intent) {
    if (intent.startsWith("establish")) return "Subjects settle naturally into the environment while the frame establishes geography.";
    if (intent.startsWith("resolve")) return "Subjects complete a small motivated action without changing the setup.";
    return "Subjects continue the scene action with small, believable movement.";
  }

  static _characterState(sceneShotIndex, sceneShotCount) {
    if (sceneShotCount === 1) return "The character completes the scene beat in a single restrained action.";
    if (sceneShotIndex === 0) return "The character is introduced in a calm, readable state.";
    if (sceneShotIndex === sceneShotCount - 1) return "The character reaches a small resolved reaction or decision without overacting.";
    return "The character remains focused while the action develops naturally.";
  }

  static _camera(intent) {
    if (intent.startsWith("establish")) return "Wide or medium-wide frame that clearly introduces the environment.";
    if (intent.startsWith("resolve")) return "Medium or close framing that lands the story beat without visual exaggeration.";
    return "Medium observational framing, stable and easy to match across cuts.";
  }

  static _movement(intent) {
    if (intent.startsWith("establish")) return "Slow locked-off frame or very subtle push-in.";
    if (intent.startsWith("resolve")) return "Minimal movement, hold continuity and let the action finish.";
    return "Subtle natural camera movement only if needed; no dramatic shake or sweeping moves.";
  }

  static _buildContinuity(parseResult, options = {}) {
    const learning = this._normalizeLearning(options.learning);
    const characters = (parseResult.characters || []).map((c) => c.name);
    const locations = [...new Set((parseResult.scenes || []).map((s) => s.location).filter(Boolean))];
    return {
      characters,
      locations,
      visualRules: [
        "Prefer grounded realism over spectacle.",
        "Do not introduce unrequested characters, props, logos, or interface elements.",
        "Keep camera language consistent inside each scene.",
        "When screens appear, preserve the layout and animate only intended existing elements.",
        "Use approved start/end frames as continuity anchors before generating the next shot.",
      ],
      approvedDirections: learning.approved,
      rejectedDirections: learning.rejected,
    };
  }

  static loadLearning(inputPath) {
    if (!inputPath) return this._emptyLearning();
    const statPath = fs.existsSync(inputPath) ? inputPath : null;
    if (!statPath) return this._emptyLearning();
    const learningPath = fs.statSync(statPath).isDirectory()
      ? path.join(statPath, "LEARNING.json")
      : statPath;
    if (!fs.existsSync(learningPath)) return this._emptyLearning();
    try {
      return this._normalizeLearning(JSON.parse(fs.readFileSync(learningPath, "utf-8")));
    } catch (err) {
      throw new Error(`Could not read learning file: ${learningPath}. ${err.message}`);
    }
  }

  static recordFeedback(projectDir, feedback) {
    if (!projectDir) throw new Error("Project directory is required.");
    this._ensureDir(projectDir);
    const learningPath = path.join(projectDir, "LEARNING.json");
    const learning = this.loadLearning(projectDir);
    const type = feedback.type === "approved" ? "approved" : "rejected";
    const entry = {
      id: feedback.id || `fb_${Date.now()}`,
      type,
      scope: feedback.scope || feedback.shot || "project",
      shot: feedback.shot || null,
      note: String(feedback.note || "").trim(),
      tags: this._tags(feedback.tags),
      createdAt: feedback.createdAt || new Date().toISOString(),
    };
    if (!entry.note) throw new Error("Feedback note is required.");
    learning[type].push(entry);
    learning.updatedAt = entry.createdAt;
    this._writeFile(learningPath, JSON.stringify(learning, null, 2));
    this._writeFile(path.join(projectDir, "LEARNING.md"), this.toLearningMarkdown(learning, { title: path.basename(projectDir) }));
    return { learningPath, learning, entry };
  }

  static _emptyLearning() {
    return {
      version: 1,
      approved: [],
      rejected: [],
      updatedAt: null,
    };
  }

  static _normalizeLearning(learning) {
    const data = learning || {};
    return {
      version: data.version || 1,
      approved: Array.isArray(data.approved) ? data.approved.map((entry) => this._normalizeLearningEntry(entry, "approved")).filter((entry) => entry.note) : [],
      rejected: Array.isArray(data.rejected) ? data.rejected.map((entry) => this._normalizeLearningEntry(entry, "rejected")).filter((entry) => entry.note) : [],
      updatedAt: data.updatedAt || null,
    };
  }

  static _normalizeLearningEntry(entry, fallbackType) {
    return {
      id: entry.id || `fb_${Date.now()}`,
      type: entry.type || fallbackType,
      scope: entry.scope || entry.shot || "project",
      shot: entry.shot || null,
      note: String(entry.note || "").trim(),
      tags: this._tags(entry.tags),
      createdAt: entry.createdAt || null,
    };
  }

  static _tags(tags) {
    if (Array.isArray(tags)) return tags.map((tag) => String(tag).trim()).filter(Boolean);
    return String(tags || "").split(",").map((tag) => tag.trim()).filter(Boolean);
  }

  static _titleFromParseResult(parseResult) {
    const filename = parseResult.stats?.filename || "production-pack";
    return path.basename(filename, path.extname(filename)).replace(/[-_]+/g, " ");
  }

  static _slug(value) {
    return String(value || "production-pack")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "production-pack";
  }

  static _sentence(value) {
    const text = String(value || "").trim();
    if (!text) return "";
    return /[.!?]$/.test(text) ? text : `${text}.`;
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

module.exports = { ProductionPackGenerator, VALID_VEO_DURATIONS };
