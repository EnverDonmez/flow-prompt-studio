/**
 * Flow Prompt Studio — Native AI Prompt Generator
 *
 * Direct API calls to DeepSeek, OpenAI, and Anthropic.
 * No Python backend needed. Works with just an API key.
 *
 * Usage:
 *   const gen = new AIPromptGenerator({ provider: "deepseek", apiKey: "sk-..." });
 *   const result = await gen.generate(parseResult, "full_pack");
 */

/* ─── Provider Configurations ─── */

const PROVIDERS = {
  deepseek: {
    name: "DeepSeek",
    endpoint: "https://api.deepseek.com/v1/chat/completions",
    model: "deepseek-chat",
    headers: (apiKey) => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    }),
    buildBody: (model, messages, options) => ({
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
    }),
    parseResponse: (data) => data.choices?.[0]?.message?.content || "",
  },

  openai: {
    name: "OpenAI",
    endpoint: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4o",
    headers: (apiKey) => ({
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    }),
    buildBody: (model, messages, options) => ({
      model,
      messages,
      temperature: options.temperature ?? 0.7,
      max_tokens: options.maxTokens ?? 4096,
    }),
    parseResponse: (data) => data.choices?.[0]?.message?.content || "",
  },

  anthropic: {
    name: "Anthropic",
    endpoint: "https://api.anthropic.com/v1/messages",
    model: "claude-sonnet-4-20250514",
    headers: (apiKey) => ({
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    }),
    buildBody: (model, messages, options) => {
      // Anthropic uses system prompt separately
      const systemMsg = messages.find((m) => m.role === "system");
      const userMsgs = messages.filter((m) => m.role !== "system");
      return {
        model,
        system: systemMsg?.content || "",
        messages: userMsgs.map((m) => ({ role: "user", content: m.content })),
        max_tokens: options.maxTokens ?? 4096,
        temperature: options.temperature ?? 0.7,
      };
    },
    parseResponse: (data) => data.content?.[0]?.text || "",
  },
};

/* ─── Prompt Templates ─── */

const PROMPTS = {
  full_pack: {
    system: `You are a senior film production AI assistant specialized in Google Flow / Veo prompt engineering.
You output structured, production-ready Markdown with no fluff, no markdown outside the requested sections, and no commentary.
Every prompt you write must be copy-paste ready into Google Flow or Veo.`,
    buildUser: (parseResult, coverageResult, options) => {
      const { scenes, characters, stats } = parseResult;
      const { genre } = coverageResult || {};
      const sceneList = scenes.map((s) => `  - ${s.number}: ${s.heading} (${s.dialogueCount} dialogue lines, chars: ${s.characters.join(", ") || "none"})`).join("\n");
      const charList = characters.map((c) => `  - ${c.name} (${c.count} appearances)`).join("\n");

      return `Generate a COMPLETE Flow/Veo AI prompt pack for this screenplay:

## Screenplay Analysis
- **Scenes:** ${stats.totalScenes}
- **Characters:** ${stats.totalCharacters} speaking
- **Dialogue Lines:** ${stats.totalDialogueLines}
- **Est. Duration:** ~${stats.estimatedDurationMinutes} min
- **Genre:** ${genre?.name || "drama"}
- **Shots Planned:** ${coverageResult?.totalShots || "N/A"}

### Scenes:
${sceneList}

### Characters:
${charList}

## Required Output Sections

Generate the following 13 sections in order. Use ### for section headers. Be specific, detailed, and production-ready:

### 1. Visual Style Guide
Define the overall look: color palette, lighting style, aspect ratio, lens choices, film stock/grain references. Be specific — name actual lenses, color temperatures, reference films.

### 2. Character Consistency Bible
For EACH character above, write a detailed visual description ensuring consistency across all shots: age, build, hair, eyes, distinguishing features, wardrobe palette, typical framing.

### 3. Location & Set Design
For each scene location, describe the environment, key props, lighting setup, color treatment, and any VFX extensions needed.

### 4. Camera Coverage Plan
Scene-by-scene shot breakdown with shot types (CU, MS, WS, OTS, etc.), camera movement notes, and lens recommendations. Reference the ${coverageResult?.totalShots || "planned"} shots.

### 5. Flow Agent Instructions
Write first-person instructions for a Flow AI agent to execute each scene. "Start with a wide establishing shot of [location]. Track [character] as they [action]. Cut to close-up when..."

### 6. Asset Collection Plan
Organize all required assets: characters, props, locations, vehicles, effects. Group by collection type with generation priority (HIGH/MEDIUM/LOW).

### 7. Shot-by-Shot Prompt List
${options.ultra ? "ULTRA MODE: Write individual Veo prompts for EVERY shot. Each prompt should be 2-4 sentences describing exact framing, lighting, action, and mood." : "Write representative Veo prompts for key shots in each scene. Each prompt should be 2-4 sentences."}

### 8. Continuity Notes
Cross-scene continuity requirements: wardrobe changes, time of day progression, prop states, character positions, lighting continuity.

### 9. Repair & Retry Prompts
For 10 common failure modes (character face change, prop inconsistency, lighting mismatch, etc.), write a repair prompt that fixes the issue while keeping the rest of the shot intact.

### 10. Image-First Credit Strategy
Recommend which shots to generate first with limited credits, which can use lower quality, and how to batch for maximum coverage per credit.

### 11. Playbook
A concise 1-page summary suitable for printing: scene list, key shots, critical continuity notes, equipment checklist.

### 12. Export-Ready Flow Blocks
Copy-paste ready text blocks for Google Flow: style presets, character prompts, location prompts, shot prompts — each clearly labeled and self-contained.

### 13. Validation Checklist
A checklist of 15+ items to verify before final export: character consistency, lighting continuity, prop states, dialogue sync, etc.

Output ALL 13 sections. Be thorough. This is a production document.`;
    },
  },

  scene_breakdown: {
    system: "You are a film production AI that writes precise, shot-by-shot Veo/Flow prompts for individual scenes.",
    buildUser: (parseResult, _coverage, options) => {
      const { scenes, characters } = parseResult;
      return `Write detailed Veo AI prompts for EACH of these ${scenes.length} scenes. For each scene, provide 3-5 specific shot prompts covering wide, medium, and close-up coverage.

Characters: ${characters.map((c) => c.name).join(", ")}

Scenes:
${scenes.map((s) => `### ${s.number}: ${s.heading}\nCharacters: ${s.characters.join(", ") || "none"}\nDialogue: ${s.dialogueCount} lines`).join("\n\n")}

${options.ultra ? "ULTRA MODE: Generate 8-12 shots per scene with maximum visual variation." : ""}`;
    },
  },

  character_bible: {
    system: "You are a character design specialist for film production. Output detailed, consistent character descriptions suitable for AI image generation.",
    buildUser: (parseResult) => {
      const { characters } = parseResult;
      return `Create a detailed visual character bible for these ${characters.length} characters:

${characters.map((c) => `- ${c.name} (appears in ${c.count} scenes)`).join("\n")}

For each character provide:
1. Physical description (age, height, build, face shape, distinctive features)
2. Hair & makeup (style, color, texture, any changes across scenes)
3. Wardrobe (color palette, style, key pieces, scene-specific changes)
4. Typical framing (how they should be shot — angles, lenses, distances)
5. Reference casting ("could be played by [actor name]" for AI consistency)
6. Mood board keywords (10-15 visual keywords for AI image generation)`;
    },
  },

  ultra_image_variation: {
    system: "You are a visual variation specialist. Generate maximum variety in AI image prompts while maintaining character and location consistency.",
    buildUser: (parseResult, coverageResult, options) => {
      const { scenes, characters } = parseResult;
      return `Generate HIGH-VARIATION Veo/Flow image prompts for this screenplay.
For each scene, generate prompts covering:
- 3 different lighting setups (golden hour, overcast, neon/noir, natural, studio)
- 3 different camera angles (low angle heroic, high angle vulnerable, dutch angle tense, POV immersive)
- 3 different compositions (rule of thirds, centered symmetry, deep depth, shallow focus, negative space)
- 3 different moods (warm/intimate, cold/distant, energetic/chaotic, calm/contemplative)

Scenes: ${scenes.length}
Characters: ${characters.map((c) => c.name).join(", ")}
Total shots: ${coverageResult?.totalShots || scenes.length * 10}

${options.ultra ? "ABSOLUTE MAXIMUM VARIATION: Generate at least 5 variations per category per scene. Every prompt must be distinctly different." : ""}

Output structured by scene, with clear labels for each variation type.`;
    },
  },
};

/* ─── Main Generator Class ─── */

class AIPromptGenerator {
  /**
   * @param {object} options
   * @param {string} options.provider - "deepseek" | "openai" | "anthropic"
   * @param {string} options.apiKey - API key for the provider
   * @param {string} [options.model] - Override default model
   * @param {number} [options.temperature] - 0-2, default 0.7
   * @param {number} [options.maxTokens] - Default 4096
   */
  constructor(options = {}) {
    this.provider = options.provider || "deepseek";
    this.apiKey = this._sanitizeKey(options.apiKey || "");
    this.model = options.model || null;
    this.temperature = options.temperature ?? 0.7;
    this.maxTokens = options.maxTokens ?? 4096;

    if (!PROVIDERS[this.provider]) {
      throw new Error(`Unknown provider: ${this.provider}. Available: ${Object.keys(PROVIDERS).join(", ")}`);
    }
  }

  /**
   * Resolve API key from multiple sources.
   * Order: explicit key → env var → .fpsrc → .env file
   */
  static resolveApiKey(provider) {
    const envMap = { deepseek: "DEEPSEEK_API_KEY", openai: "OPENAI_API_KEY", anthropic: "ANTHROPIC_API_KEY" };
    const envVar = envMap[provider];
    if (!envVar) return null;

    // 1. Environment variable
    if (process.env[envVar]) return process.env[envVar];

    // 2. .env file in cwd
    try {
      const fs = require("fs");
      const path = require("path");
      const envPath = path.join(process.cwd(), ".env");
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, "utf-8");
        const match = content.match(new RegExp(`^${envVar}\\s*=\\s*(.+)$`, "m"));
        if (match) return match[1].replace(/["']/g, "").trim();
      }
    } catch {}

    // 3. .fpsrc config
    try {
      const fs = require("fs");
      const path = require("path");
      const rcPath = path.join(process.cwd(), ".fpsrc");
      if (fs.existsSync(rcPath)) {
        const config = JSON.parse(fs.readFileSync(rcPath, "utf-8"));
        if (config.apiKeys && config.apiKeys[provider]) return config.apiKeys[provider];
      }
    } catch {}

    return null;
  }

  /**
   * List available providers with their status.
   */
  static getProvidersStatus() {
    return Object.entries(PROVIDERS).map(([key, p]) => ({
      key,
      name: p.name,
      model: p.model,
      configured: !!AIPromptGenerator.resolveApiKey(key),
      envVar: { deepseek: "DEEPSEEK_API_KEY", openai: "OPENAI_API_KEY", anthropic: "ANTHROPIC_API_KEY" }[key],
    }));
  }

  /**
   * Strip sensitive data from key for safe logging.
   */
  _sanitizeKey(key) {
    if (!key) return "";
    if (key.length <= 8) return "***";
    return key.substring(0, 4) + "..." + key.substring(key.length - 4);
  }

  /**
   * Get the real API key (unsanitized) from the stored key or environment.
   */
  _getRealKey() {
    // If key was provided directly and looks like a real key (not sanitized)
    const envMap = { deepseek: "DEEPSEEK_API_KEY", openai: "OPENAI_API_KEY", anthropic: "ANTHROPIC_API_KEY" };
    const directKey = process.env[envMap[this.provider]] || AIPromptGenerator.resolveApiKey(this.provider);
    if (directKey) return directKey;

    // The key stored in this.apiKey might be sanitized — try to get real one
    return AIPromptGenerator.resolveApiKey(this.provider) || "";
  }

  /**
   * Generate AI prompts for a screenplay.
   *
   * @param {object} parseResult - Output from ScreenplayParser
   * @param {string} [scope="full_pack"] - Prompt scope
   * @param {object} [options] - Extra options
   * @returns {Promise<{success: boolean, markdown?: string, model: string, provider: string, error?: string}>}
   */
  async generate(parseResult, coverageResult, scope = "full_pack", options = {}) {
    const prompt = PROMPTS[scope];
    if (!prompt) {
      throw new Error(`Unknown scope: ${scope}. Available: ${Object.keys(PROMPTS).join(", ")}`);
    }

    const provider = PROVIDERS[this.provider];
    const realKey = this._getRealKey();

    if (!realKey) {
      const envVar = { deepseek: "DEEPSEEK_API_KEY", openai: "OPENAI_API_KEY", anthropic: "ANTHROPIC_API_KEY" }[this.provider];
      throw new Error(
        `No API key for ${provider.name}. Set ${envVar} environment variable, ` +
        `use --key flag, or add to .fpsrc config.`
      );
    }

    const model = this.model || provider.model;
    const systemMsg = { role: "system", content: prompt.system };
    const userMsg = { role: "user", content: prompt.buildUser(parseResult, coverageResult, options) };
    const messages = [systemMsg, userMsg];

    const body = provider.buildBody(model, messages, {
      temperature: this.temperature,
      maxTokens: this.maxTokens,
    });

    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 120_000);

      const res = await fetch(provider.endpoint, {
        method: "POST",
        headers: provider.headers(realKey),
        body: JSON.stringify(body),
        signal: controller.signal,
      });

      clearTimeout(timeout);

      if (!res.ok) {
        const errText = await res.text().catch(() => res.statusText);
        if (res.status === 401 || res.status === 403) {
          throw new Error(`${provider.name} authentication failed. Check your API key.`);
        }
        if (res.status === 429) {
          throw new Error(`${provider.name} rate limit exceeded. Wait and try again.`);
        }
        throw new Error(`${provider.name} API ${res.status}: ${errText.substring(0, 200)}`);
      }

      const data = await res.json();
      const markdown = provider.parseResponse(data);

      return {
        success: true,
        markdown,
        model,
        provider: this.provider,
        providerName: provider.name,
        scope,
      };
    } catch (err) {
      if (err.name === "AbortError") {
        throw new Error(`${provider.name} request timed out after 120s.`);
      }
      throw err;
    }
  }
}

module.exports = { AIPromptGenerator, PROVIDERS, PROMPTS };
