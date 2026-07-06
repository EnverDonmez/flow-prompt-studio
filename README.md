# Flow Prompt Studio CLI

**Screenplay to Google Flow / Veo AI prompt pack generator**

Drop in a screenplay file — get character analysis, visual style detection, camera coverage plan, shot plan, asset plan, AI prompt pack, repair prompts, copy-ready Flow blocks, and all export formats automatically generated.

## Installation

```bash
npm install -g flow-prompt-studio
```

## Requirements

- Node.js >= 18
- Flow Prompt Studio Backend (`http://localhost:8000`)
- DeepSeek API Key (in backend `.env` file)

## Quick Start

```bash
# Check backend status
fps config

# Estimate before running (dry-run)
fps estimate screenplay.pdf

# Upload screenplay and run full workflow
fps workflow screenplay.pdf

# Run with dry-run preview first
fps workflow screenplay.pdf --dry-run

# Analysis only
fps upload screenplay.pdf
fps analyze
```

## Commands

| Command | Description |
|---------|-------------|
| `fps config` | Backend status and API key check |
| `fps init` | Initialize a project with `.fpsrc` config |
| `fps doctor` | System check and troubleshooting |
| `fps upload <file>` | Upload screenplay (.txt, .md, .pdf, .docx) |
| `fps estimate <file>` | Estimate shots/duration without uploading (dry-run) |
| `fps analyze` | Extract characters, locations, props |
| `fps style` | Visual style detection (AI or fallback) |
| `fps generate` | Generate AI prompt pack |
| `fps coverage` | Camera coverage and shot plan |
| `fps repair [type]` | Generate repair prompt |
| `fps validate` | Validate the prompt package |
| `fps preview` | Preview generated markdown |
| `fps export [format]` | Export (14 formats) |
| `fps workflow <file>` | **Full automated 7-step workflow** |

## Workflow

`fps workflow screenplay.pdf` runs these steps in sequence:

1. 📤 Screenplay upload
2. 🔍 Character, location, prop analysis
3. 🎨 Visual style detection
4. 📷 Camera coverage plan (~11 shots/scene)
5. 🤖 AI prompt pack generation (optional)
6. ✅ Package validation
7. 📦 Export (6 formats)

With `--dry-run`, you get an estimate before the workflow starts.

## Project Configuration

Initialize a project config file:

```bash
fps init
```

This creates a `.fpsrc` file in your current directory:

```json
{
  "apiUrl": "http://localhost:8000/api/v1",
  "defaultScope": "full_pack",
  "defaultFormats": ["markdown", "shot-plan-csv", "asset-plan-md", "playbook"],
  "ultra": false,
  "language": "en"
}
```

## Programmatic API

```javascript
const { FlowPromptStudio } = require('flow-prompt-studio');
const fps = new FlowPromptStudio();

// Check backend health
const { reachable } = await fps.ping();

// Estimate before running (no upload)
const estimate = await fps.estimate('screenplay.pdf');
console.log(estimate.estimatedShots); // e.g. 198

// Full automated workflow
const result = await fps.workflow('screenplay.pdf', { ultra: true });

// Manual control
await fps.upload('screenplay.pdf');
const { analysis } = await fps.analyze();
const style = await fps.detectStyle();
const bundle = await fps.getCoverage();
const gen = await fps.generate('full_pack', true);
const validation = await fps.validate();
const url = await fps.getExportUrl('production-pack-zip');
```

## TypeScript

Type definitions are included:

```typescript
import { FlowPromptStudio, FlowPromptStudioClient } from 'flow-prompt-studio';

const fps: FlowPromptStudio = new FlowPromptStudio();
const result = await fps.workflow('screenplay.pdf', { ultra: true });
```

## Claude Code Skill

This package works with Claude Code. The `skills/flow-prompt-studio.md` file lets Claude Code recognize this tool as a skill.

## Troubleshooting

Run the system check:

```bash
fps doctor
```

Common issues:

- **"Cannot connect to backend"** — Make sure the Flow Prompt Studio backend is running on port 8000
- **"API key missing"** — Set `DEEPSEEK_API_KEY` in your backend `.env` file
- **Upload failures** — Ensure the file format is supported (.txt, .md, .pdf, .docx)

## License

MIT
