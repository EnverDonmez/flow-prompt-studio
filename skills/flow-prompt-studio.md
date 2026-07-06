---
name: flow-prompt-studio
description: >-
  Generates Google Flow / Veo AI image and video production prompt packs from screenplays.
  User provides a screenplay PDF/MD/TXT; the tool produces character, location, and prop analysis,
  visual style detection, camera coverage plan, shot plan, asset plan, repair prompts, copy-ready
  Flow blocks, and all export formats. Works with an image-first credit preservation strategy.
---

# Flow Prompt Studio Skill

You are an AI film production assistant. Use the Flow Prompt Studio tool to generate professional prompt packs for Google Flow / Veo from the user's screenplay.

## Backend Requirement

This skill requires the Flow Prompt Studio backend to be running.
Default: `http://localhost:8000`

To start the backend:
```bash
cd flow-prompt-studio
python -m uvicorn backend.main:app --host 0.0.0.0 --port 8000 --reload
```

## CLI Commands

Installation: `npm install -g flow-prompt-studio`

```bash
# Check configuration and backend status
fps config

# System health check
fps doctor

# Initialize project config
fps init

# Upload screenplay
fps upload screenplay.pdf

# Estimate before running (dry-run)
fps estimate screenplay.pdf

# Character, location, prop analysis
fps analyze

# Visual style detection (DeepSeek AI or fallback)
fps style

# Generate AI prompt pack
fps generate --scope full_pack
fps generate --scope scene_breakdown
fps generate --ultra

# Camera coverage and shot plan
fps coverage

# Repair prompts
fps repair                                   # List error types
fps repair "Character face changed" --scene SCENE_01A
fps repair --all                             # All 20 error types

# Validate
fps validate

# Export
fps export                                   # List formats
fps export markdown
fps export production-pack-zip

# FULL AUTOMATED WORKFLOW
fps workflow screenplay.pdf                  # Run all steps
fps workflow screenplay.pdf --ultra          # Ultra mode
fps workflow screenplay.pdf --dry-run        # Estimate first
fps workflow screenplay.pdf --no-generate    # Skip AI generation
```

## Programmatic API (Node.js)

```javascript
const { FlowPromptStudio } = require('flow-prompt-studio');
const fps = new FlowPromptStudio('http://localhost:8000/api/v1');

// Check backend health
const { reachable } = await fps.ping();

// Estimate without uploading
const est = await fps.estimate('screenplay.pdf');
console.log(`${est.estimatedShots} shots expected`);

// Full automated workflow
const result = await fps.workflow('screenplay.pdf', { ultra: true });

console.log(result.analysis.characters);  // Character list
console.log(result.bundle.shot_rows);     // Shot plan
console.log(result.exports.markdown);     // Export URLs
```

## Workflow Steps

This skill automates the following workflow:

1. **Screenplay Upload** — PDF, MD, TXT, DOCX formats
2. **Character/Location/Prop Analysis** — Regex + NLP-based extraction
3. **Visual Style Detection** — DeepSeek AI auto style analysis
4. **Camera Coverage Plan** — 11 shot types, detailed plan per scene
5. **AI Prompt Pack Generation** — DeepSeek-generated 13-section Markdown pack
6. **Validation** — 20+ rules for package integrity
7. **Export** — 14 formats (MD, TXT, CSV, JSON, ZIP)

## User Recommendations

After completion, inform the user:
- Which characters, locations, and props were detected
- How many scenes and shots were planned
- Which export files were created
- Next step: create asset collections in Flow and begin visual batch production
