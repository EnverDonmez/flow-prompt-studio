# Flow Prompt Studio CLI

**Offline-first screenplay parser & shot coverage generator — no backend required.**

Drop in a screenplay file and get scene analysis, character extraction, dialogue stats, and a full shot coverage plan. All locally. No API keys. No internet. Just you and the script.

> ✨ **v2.0**: Completely offline. Backend only needed for AI prompt generation. `npm install -g` and start working immediately.

## Installation

```bash
npm install -g flow-prompt-studio
```

**Zero extra dependencies.** Only needs Node.js >= 18.

## Quick Start

```bash
# Parse a screenplay (offline — works instantly)
fps parse screenplay.txt

# Parse with JSON output (pipe-friendly)
fps parse screenplay.txt --json

# Generate a shot coverage plan for any genre
fps shots action -s 12

# Parse + cover in one step
fps shots drama -f screenplay.txt

# Browse genre templates
fps template --list

# Inspect a specific genre
fps template horror

# Export to files
fps export parse-result -f screenplay.txt -o ./output/
fps export shot-plan -g action -s 10 -f csv -o ./output/

# Interactive step-by-step wizard
fps interactive

# Full workflow (local parse + shot plan + optional AI)
fps workflow screenplay.txt
fps workflow screenplay.txt --genre horror --ai
```

## Offline Commands (no backend needed)

| Command | Description |
|---|---|
| `fps parse <file>` | Parse screenplay — scenes, characters, dialogue |
| `fps shots <genre>` | Generate shot coverage plan from genre template |
| `fps template <genre>` | View genre template camera notes + equipment |
| `fps export <type>` | Export parse/shots to files (json, csv, md, html) |
| `fps interactive` | Step-by-step wizard — no flags, just follow prompts |
| `fps workflow <file>` | Full workflow: parse → cover → export + optional AI |

### Parse Options

```
fps parse <file> [--json] [--csv] [--markdown]
```

Extracts:
- **Scenes** — heading, number, location, dialogue count
- **Characters** — name, frequency, which scenes they appear in
- **Stats** — total scenes, characters, dialogue lines, estimated pages & duration
- Supports: `.txt`, `.md`, `.fountain`, `.fdx` (Final Draft XML)

### Shot Coverage Genres

| Genre | Best For |
|---|---|
| `action` | Chase sequences, fights, stunts — fast-paced multi-cam |
| `drama` | Character-driven stories — performance-focused coverage |
| `horror` | Tension & fear — dutch angles, POV, negative space |
| `documentary` | Interviews + vérité — handheld, natural light |
| `music_video` | Rhythmic, stylized — beat-synced, slo-mo, macro |
| `commercial` | Product-focused — hero shot, macro detail, lifestyle |
| `short_film` | Festival-friendly — resource-conscious, hybrid |

### Export Formats

```bash
fps export parse-result --file script.txt --format json -o ./out/
fps export shot-plan --genre action --scenes 10 --format html -o ./out/
fps export shot-plan --file script.txt --genre action --format csv -o ./out/
# For piping: --stdout
fps export shot-plan -g drama -s 5 --format json --stdout | jq .
```

## Backend Commands (optional, for AI features)

These require the Flow Prompt Studio backend running at `http://localhost:8000`:

| Command | Description |
|---|---|
| `fps upload <file>` | Upload to backend for AI analysis |
| `fps generate` | AI prompt pack generation (DeepSeek) |
| `fps workflow --ai` | Full workflow with AI prompt generation |

Start the backend, then add `--ai` to any workflow command.

## Programmatic API

```javascript
// Offline — no backend, no internet
const fps = require('flow-prompt-studio').fps;

// Parse a screenplay
const result = fps.parse('screenplay.txt');
console.log(result.scenes);       // [{ heading, location, characters... }]
console.log(result.characters);   // [{ name, count }]
console.log(result.stats);        // { totalScenes, totalCharacters, ... }

// Generate shot coverage
const plan = fps.cover(result, 'action');
console.log(plan.totalShots);     // e.g. 126

// Export to file
fps.exportShotPlan(plan, 'csv', './output/');
fps.exportShotPlan(plan, 'html', './output/');
```

```javascript
// With backend (optional)
const { FlowPromptStudio } = require('flow-prompt-studio');
const studio = new FlowPromptStudio();
await studio.workflow('screenplay.pdf', { ultra: true });
```

## TypeScript

Full type definitions included. Zero-config:

```typescript
import { fps, ScreenplayParser, CoverageGenerator, FileExporter } from 'flow-prompt-studio';

const result = ScreenplayParser.parse('screenplay.txt');
const plan = CoverageGenerator.generate(result, 'horror');
FileExporter.exportShotPlan(plan, 'html', './output/');
```

## Project Configuration

```bash
fps init          # Creates .fpsrc in current directory
fps doctor        # System check & troubleshooting
```

## License

MIT — Free forever. No registration, no API key, no internet required for core features.

---

**Made for filmmakers, by filmmakers.** Parse. Plan. Shoot.
