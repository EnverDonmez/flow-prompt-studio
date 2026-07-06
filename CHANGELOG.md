# Changelog

All notable changes to Flow Prompt Studio.

## [2.1.0] — 2026-07-06

### Added — Native AI Generation (No Backend Required)
- **`src/generate.js`** — Direct AI API calls to DeepSeek, OpenAI, and Anthropic
  - Provider-agnostic: uniform interface for all 3 AI services
  - 4 prompt scopes: `full_pack` (13 sections), `scene_breakdown`, `character_bible`, `ultra_image_variation`
  - Smart prompt engineering: screenplay data auto-embedded in prompts
  - API key resolution: env vars → `.env` file → `.fpsrc` config → CLI flag
  - Key sanitization: never logs or displays API keys
- **`fps generate`** now works without Python backend
  - `--provider deepseek|openai|anthropic` — pick your AI
  - `--key` flag or env var — flexible auth
  - `--file` — auto-parses screenplay for context-rich prompts
  - `--scope` — 4 prompt templates available
  - `--ultra` — maximum variation mode
- **`fps workflow --ai`** — fully backend-free: parse → cover → AI → export
  - Works with `--provider` and `--key` flags
  - Auto-saves AI output alongside parse/coverage exports
- **`fps config`** — now shows all 3 AI provider statuses
- **24 new tests** (161 total): generate module, prompt templates, providers

### Changed
- Python backend is now **fully optional** for all features
- `fps workflow --ai` no longer checks backend connection
- Package description updated: "No backend. Zero-config. One command."

## [2.0.0] — 2026-07-06

### Added — Offline-First Revolution
- **Local screenplay parser** (`src/parser.js`) — scenes, characters, dialogue, stats. No AI needed.
  - Supports `.txt`, `.md`, `.fountain`, `.fdx` (Final Draft XML)
  - Scene detection: `SCENE`, `INT./EXT.`, `CHAPTER`, Fountain `#`, and more
  - Character extraction: ALL-CAPS name detection with frequency tracking
  - Dialogue counting, page estimation (1 page ≈ 1 minute)
- **Shot coverage generator** (`src/coverage.js`) — 7 genre templates with 25 shot types
  - `action`, `drama`, `horror`, `documentary`, `music_video`, `commercial`, `short_film`
  - Each with: shot distribution, camera notes, equipment recommendations, pacing guide
  - Output: structured JSON, CSV, Markdown, HTML storyboard
- **File export engine** (`src/export.js`) — write actual files to disk
  - Formats: `csv`, `json`, `markdown`, `html` (responsive storyboard with light/dark mode)
  - `--stdout` flag for pipe-friendly output (CI/CD, AI agents)
- **5 new CLI commands:**
  - `fps parse <file>` — local screenplay analysis
  - `fps shots <genre>` — shot coverage generation
  - `fps template <genre>` — genre template browser
  - `fps export <type>` — file export with format selection
  - `fps interactive` — step-by-step wizard mode
- **Hybrid workflow** — local parse + shot plan always work; `--ai` flag adds backend generation
- **Top-level `fps` object** — `require('flow-prompt-studio').fps.parse()` for direct API
- **46 new tests** (137 total): parser, coverage, export, updated integration

### Changed
- **Backend is now OPTIONAL** — core features work completely offline
- `fps workflow` now runs local-first (parse → cover → export), AI is opt-in with `--ai`
- `fps doctor` now recommends offline commands
- `fps config` shows offline alternatives when backend is down
- README rewritten with offline-first messaging
- `package.json` description: "Offline-first screenplay parser & shot coverage generator"

### Breaking Changes (from v1.x)
- `fps export` now requires `<type>` argument (`parse-result` or `shot-plan`)
- `fps workflow --no-generate` removed; use `fps workflow` (without `--ai`) for local-only
- `fps workflow` flags changed: `--genre`, `--ai`, `--ultra`, `--dry-run`, `--output`

## [1.1.0] — 2026-07-06

### Added
- **TypeScript type definitions** (`index.d.ts`) — full type coverage for all classes and methods
- **Retry mechanism** — exponential backoff, configurable timeout, Retry-After header support
- **Spinner/progress** — visual feedback during long-running operations
- **`fps estimate <file>`** — dry-run estimation without uploading (scene count, shot count, duration)
- **`fps init`** — scaffold a `.fpsrc` project configuration file
- **`fps doctor`** — system health check and troubleshooting guide
- **`fps workflow --dry-run`** — estimate before running full workflow
- **Connection ping** — `client.ping()` and graceful error messages for backend downtime
- **In-memory cache** — GET requests cached for 1 minute, with `clearCache()` method
- **Workflow progress callbacks** — `onProgress` option for programmatic progress tracking
- **`workflowProgressive()`** — workflow with built-in spinner (for CLI use)
- **English localization** — all comments, CLI output, and documentation converted to English
- **Unit tests** — 41 tests across 3 files (client, index, utils) using Node.js native test runner
- **GitHub Actions CI** — automated tests on push/PR

### Changed
- **Version now read dynamically** from `package.json` (no more hardcoded versions)
- **Better error messages** — connection failures include troubleshooting tips
- **`withErrorHandler` wrapper** — uniform CLI error handling

### Fixed
- Retry exhaustion now correctly throws aggregate error message
- `require("fs")` calls moved to top level in client.js

## [1.0.0] — Initial release

- CLI with 12 commands
- Programmatic API (`FlowPromptStudio` class)
- Backend client with full API coverage
- 7-step automated workflow
- Claude Code skill integration
- 14 export formats
