# 🎬 Flow Prompt Studio

**The open-source AI film production toolkit. Parse. Plan. Shoot.**

[![npm version](https://img.shields.io/npm/v/flow-prompt-studio)](https://www.npmjs.com/package/flow-prompt-studio)
[![npm downloads](https://img.shields.io/npm/dm/flow-prompt-studio)](https://www.npmjs.com/package/flow-prompt-studio)
[![CI](https://github.com/EnverDonmez/flow-prompt-studio/actions/workflows/ci.yml/badge.svg)](https://github.com/EnverDonmez/flow-prompt-studio/actions/workflows/ci.yml)
[![GitHub stars](https://img.shields.io/github/stars/EnverDonmez/flow-prompt-studio)](https://github.com/EnverDonmez/flow-prompt-studio)
[![license](https://img.shields.io/npm/l/flow-prompt-studio)](https://github.com/EnverDonmez/flow-prompt-studio/blob/main/LICENSE)
[![node](https://img.shields.io/node/v/flow-prompt-studio)](https://nodejs.org)

> **No backend. No Python. No Docker. Just `npm install -g` and go.**
> Core parsing, coverage, call sheets, budgets, conversion, and exports work offline. AI and storyboard image generation are optional online features.

> **Field-tested by the author.** See [`FIELD_TEST_NOTES.md`](FIELD_TEST_NOTES.md) for real production issues found while using Flow Prompt Studio on an AI-video short documentary workflow.

---

## ⚡ 10-Second Demo

```bash
npx flow-prompt-studio demo
```

See screenplay parsing, shot coverage, character analysis, and budget estimation — all on a built-in short film, all in under 30 milliseconds. No setup, no files, no keys.

---

## 🚀 Install & Start

```bash
npm install -g flow-prompt-studio

# See everything fps can do in one command:
fps demo

# Or jump straight in with your own screenplay:
fps parse your-screenplay.txt
```

**Only needs Node.js ≥ 18. Installs one small runtime dependency (`commander`).**

---

## 📖 What It Does

| Command | What You Get | Needs |
|---------|-------------|-------|
| `fps ingest <file>` | Prepare PDF/TXT/MD/FDX sources for parsing and production packs | Nothing* |
| `fps parse <file>` | Scenes, characters, dialogue stats | Nothing |
| `fps production-pack <file>` | Google Flow / Veo shot files, prompts, references, continuity | Nothing |
| `fps feedback <packDir>` | Record approved/rejected generation learning | Nothing |
| `fps shots <genre>` | Shot coverage plan (7 genres) | Nothing |
| `fps storyboard -f <file>` | Visual storyboard images (free AI) | Nothing* |
| `fps callsheet -f <file>` | Professional call sheet → PDF | Nothing |
| `fps budget -f <file>` | Production cost estimate ($) | Nothing |
| `fps generate -f <file>` | AI prompt pack (13 sections) | API key |
| `fps workflow <file> --ai` | parse → cover → AI → export | API key |
| `fps analyze-script <file>` | Tempo, emotion, relationships | Nothing |
| `fps convert in.fdx out.fountain` | Format conversion | Nothing |
| `fps interactive` | Step-by-step wizard | Nothing |
| `fps demo` | Built-in demo screenplay | Nothing |

*\*PDF ingest uses the local `pdftotext` binary when available, or writes manual extraction instructions. Storyboard image prompts are generated locally; image downloads use Pollinations.ai — free, no signup, but internet is required.*

---

## 🎯 Real Output (from `fps demo`)

```
🎬 Flow Prompt Studio — Live Demo                         24ms

📄 Parse
   3 scenes · 2 characters · 15 dialogue lines · ~2 min runtime

Characters:
   MAYA           ████████ 8x
   LEO            ███████ 7x

🎥 Coverage (Drama)
   24 shots · 8.0 avg/scene · ~1 min
   Camera: Linger on performances — don't cut too early
   Equipment: Prime lenses (35mm, 50mm, 85mm), Dolly + track

🔬 Analysis
   Tempo: balanced
   Dominant emotion: neutral (character-driven dialogue)
   Strongest relationship: LEO ↔ MAYA (2 scenes)

💰 Budget (indie)
   Estimated: $14,145
   Shoot: 1 day · Crew: 8 · Cast: 2 · Locations: 3
```

---

## 🎨 Shot Coverage Genres

7 built-in coverage templates with shot distributions, camera notes, and equipment recommendations:

| Genre | Shots/Scene | Best For |
|-------|------------|----------|
| `action` | 14 | Chase sequences, fights, stunts |
| `drama` | 8 | Character-driven stories, performances |
| `horror` | 10 | Tension, fear, dutch angles, POV |
| `documentary` | 6 | Interviews, vérité, handheld |
| `music_video` | 16 | Beat-synced, slo-mo, macro |
| `commercial` | 10 | Product-focused, lifestyle |
| `short_film` | 7 | Festival-friendly, resource-conscious |

```bash
fps shots action -s 12          # 168 shots for 12 scenes
fps template horror             # Full camera notes + equipment list
fps template --list             # Browse all 7 genres
```

---

## 🎬 Google Flow / Veo Production Packs

Generate a complete project folder for AI-video production:

```bash
fps production-pack script.txt -o ./flow-pack --title "My Short Film"
```

The pack includes:

- `INDEX.md` — project overview and shot list
- `CONTINUITY.md` — character, location, visual, and rejected-output memory
- `LEARNING.json` / `LEARNING.md` — approved/rejected output learning that can influence later prompts
- `shots/SHOT_001.md` — one file per shot with Flow setup, references, start image prompt, end image prompt, video prompt, risks, and quality checklist
- `production-pack.json` — machine-readable manifest for assistant/operator workflows

Production packs split scenes into valid Veo durations: 4, 6, or 8 seconds. The generated prompts intentionally avoid duration wording because Google Flow already exposes duration as a UI setting.

```bash
fps production-pack vision.txt --mode director --shots-per-scene 3 --default-duration 6
```

Prepare sources first:

```bash
fps ingest screenplay.pdf -o ./prepared
fps ingest vision.txt --pack --pack-output ./flow-pack --title "My Film"
```

Record what worked or failed, then reuse it:

```bash
fps feedback ./flow-pack/my-film --type rejected --shot SHOT_006 --note "screen became too red and added alarm popups" --tags screen_continuity,alarm_exaggeration
fps feedback ./flow-pack/my-film --type approved --shot SHOT_006 --note "realistic office lighting and stable dashboard layout"
fps production-pack vision.txt -o ./flow-pack --title "My Film" --learning ./flow-pack/my-film
```

---

## 🤖 AI Generation (optional)

11 popular AI providers plus any OpenAI-compatible endpoint. Set an env var and go:

```bash
# DeepSeek (cheapest, best value)
export DEEPSEEK_API_KEY=sk-...
fps generate -f script.txt -p deepseek

# OpenAI
export OPENAI_API_KEY=sk-...
fps generate -f script.txt -p openai --model gpt-4o

# Claude
export ANTHROPIC_API_KEY=sk-ant-...
fps generate -f script.txt -p anthropic

# Google Gemini
export GEMINI_API_KEY=...
fps generate -f script.txt -p gemini

# OpenRouter
export OPENROUTER_API_KEY=sk-or-...
fps generate -f script.txt -p openrouter --model openai/gpt-4o

# Custom OpenAI-compatible endpoint (local/self-hosted/vendor proxy)
fps generate -f script.txt -p custom \
  --base-url http://localhost:1234/v1 \
  --model local-model \
  --key local-key
```

| Provider | CLI key | Env var |
|----------|---------|---------|
| DeepSeek | `deepseek` | `DEEPSEEK_API_KEY` |
| OpenAI | `openai` | `OPENAI_API_KEY` |
| Anthropic / Claude | `anthropic` | `ANTHROPIC_API_KEY` |
| Google Gemini | `gemini` | `GEMINI_API_KEY` or `GOOGLE_API_KEY` |
| Mistral AI | `mistral` | `MISTRAL_API_KEY` |
| Groq | `groq` | `GROQ_API_KEY` |
| xAI / Grok | `xai` | `XAI_API_KEY` |
| Cohere | `cohere` | `COHERE_API_KEY` |
| Perplexity | `perplexity` | `PERPLEXITY_API_KEY` |
| Together AI | `together` | `TOGETHER_API_KEY` |
| OpenRouter | `openrouter` | `OPENROUTER_API_KEY` |
| Custom OpenAI-compatible | `custom` | `CUSTOM_AI_API_KEY` or `OPENAI_COMPATIBLE_API_KEY` |

4 prompt scopes: `full_pack` (13 sections), `scene_breakdown`, `character_bible`, `ultra_image_variation`

Or run everything in one command:
```bash
fps workflow script.txt --ai -p deepseek --genre horror -o ./output/
```

---

## 📦 Export Formats

| Data | Formats |
|------|---------|
| Parse result | JSON, CSV, Markdown, ScreenJSON |
| Shot plan | JSON, CSV, Markdown, HTML, Resolve CSV |
| Storyboard | HTML (responsive, dark/light mode) |
| Call sheet | HTML (print-ready PDF) |
| Budget | Markdown, CSV, JSON |
| Screenplay | FDX, Fountain, TXT, ScreenJSON |

```bash
fps export parse-result --file script.txt --format screenjson -o ./out/
fps export shot-plan -g horror --file script.txt --format resolve-csv -o ./out/
fps export shot-plan -g drama -s 10 --format html -o ./out/
```

---

## 💻 Programmatic API

```javascript
const fps = require('flow-prompt-studio').fps;

// Everything is synchronous and offline:
const result = fps.parse('screenplay.txt');
const plan = fps.cover(result, 'horror');
fps.exportShotPlan(plan, 'html', './output/');

// Google Flow / Veo production pack:
const pack = fps.exportProductionPack(result, './flow-pack', {
  title: 'My Short Film',
  mode: 'director'
});

// Record field feedback and reuse it later:
fps.recordProductionFeedback(pack.outputDir, {
  type: 'rejected',
  shot: 'SHOT_001',
  note: 'too much red alarm styling'
});

// With AI (async):
const gen = await fps.generate(result, plan, 'full_pack',
  { provider: 'deepseek', apiKey: process.env.DEEPSEEK_API_KEY });

// 239 tests. Offline-first core.
```

---

## 🔒 Privacy & Network Behavior

Flow Prompt Studio keeps the core workflow local:

- `ingest`, `parse`, `production-pack`, `feedback`, `shots`, `callsheet`, `budget`, `convert`, `export`, `analyze-script`, and `demo` do not send screenplay content over the network.
- `storyboard` sends generated image prompts to Pollinations.ai only when you request image generation.
- `generate` and `workflow --ai` send screenplay-derived context to the AI provider you choose: DeepSeek, OpenAI, Anthropic, Gemini, Mistral, Groq, xAI, Cohere, Perplexity, Together AI, OpenRouter, or your custom OpenAI-compatible endpoint.
- API keys are read from CLI flags, environment variables, `.env`, or `.fpsrc`; they are not printed in CLI output.

---

## 🏗️ Advanced

```bash
fps analyze-script script.txt   # Tempo, emotion, relationships, complexity
fps ingest script.pdf           # Prepare PDF/TXT/MD/FDX sources
fps production-pack script.txt  # Google Flow / Veo production pack
fps feedback ./pack --type rejected --note "too cinematic"
fps convert in.fdx out.fountain # Format conversion
fps project init "My Film"      # Project management
fps project add script.txt      # Add screenplays to project
fps doctor                      # System health check
fps config                      # AI provider status
```

---

## 🌟 Why This Exists

Independent filmmakers deserve professional tools that don't require subscriptions, cloud accounts, or Python backends. Flow Prompt Studio gives you:

- **Script breakdown** in milliseconds — no manual highlighting
- **Shot planning** with cinematography metadata — no Excel hell
- **Budget estimates** from real screenplay data — no guesswork
- **AI prompts** when you want them — no vendor lock-in

Everything runs in your terminal. Everything is free. Everything is open source.

---

Built with ❤️ for filmmakers. [GitHub](https://github.com/EnverDonmez/flow-prompt-studio) · [npm](https://www.npmjs.com/package/flow-prompt-studio) · [Issues](https://github.com/EnverDonmez/flow-prompt-studio/issues)
