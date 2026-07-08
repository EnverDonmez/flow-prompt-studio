# Field Test Notes

These notes document issues found while the package author used Flow Prompt Studio on an actual short documentary workflow. The goal is to keep the public package grounded in real production usage, not only synthetic demos.

## 2.6.0 Field Test - 2026-07-08 - Gorunmeyen Ortak / Vizyon workflow

### Context

- Real usage should support both direct CLI usage and assistant/operator-driven workflows.
- The package should stay useful whether the user wants to run commands manually or ask an assistant to operate the workflow on their behalf.
- Primary source file for current production:
  - `/Users/yazilim/Desktop/gorunmeyen-ortak-vizyon.flow.txt`
- Output directory:
  - `/Users/yazilim/Desktop/flow-prompt-studio-output/vizyon/`

### Parser Issues Found

- PDF input is common in real usage, but the package does not parse PDFs directly.
- The original screenplay PDF extracted into timecoded documentary sections:
  - `00:00 - 00:29 | AÇILIŞ`
- The Vizyon PDF extracted into AI-video scene headings:
  - `SAHNE SCN-001: DENİZ'İN ODASI — GECE`
- Parser originally treated the whole Vizyon document as one scene.
- Parser originally treated production labels as characters:
  - `GÖRÜNTÜ`
  - `TEKNİK BLOK`
  - `AI-ZORLUK`
  - `KALITE RAPORU`
- Turkish uppercase character handling missed names such as:
  - `DENİZ`
  - `ÖĞRETMEN`

### Fixes Already Implemented Locally

- Added timecoded scene heading support.
- Added Vizyon `SAHNE SCN-###:` scene heading support.
- Added Turkish uppercase character support for character detection.
- Ignored preamble before explicit scene headings.
- Prevented common production/visual labels from being counted as characters.
- Added parser tests for the new cases.

### Current Validation

- `npm test` passed with `229/229`.
- Vizyon parse result:
  - 18 scenes
  - 5 speaking characters
  - 57 dialogue/speech lines
- Current speaking character list:
  - `ANLATICI`
  - `DENİZ`
  - `ÖĞRETMEN`
  - `SESLİ SİSTEM`
  - `ARKADAŞI`

### UX / Workflow Lessons

- Production workflows should not force a single interaction style.
- CLI usage and assistant/operator usage should be equally supported.
- Project state, source file selection, and output structure should be explicit enough for CLI users and machine-readable enough for assistant workflows.
- Flow/Veo prompts should not include duration if the UI already has a duration selector.
- Veo supports 4, 6, and 8 second clips, so scene planning should split shots into those durations, but the prompt text itself should avoid duration unless explicitly requested.

### Veo / Flow Prompting Lessons

- Avoid overusing "cyber anomaly", "alarm", "warning", or "red" because the model exaggerates.
- For screen continuity, prompts must explicitly say:
  - preserve the same screen layout
  - do not redesign the interface
  - do not add new windows/popups/warning boxes
  - only animate existing graph lines/data points
- For SCN-006A, desired behavior:
  - realistic modest office
  - same camera angle and same screens
  - three small upper-right graphs continue moving naturally
  - only the middle graph subtly shifts to muted red near the end
  - no big red glow, no full-screen alarm, no UI redesign
- More realistic references are preferred over cinematic "Hollywood SOC" monitor-wall imagery.
- Best SCN-006A reference direction:
  - one laptop
  - one external monitor
  - modest desk
  - warm desk lamp plus cool monitor light
  - believable software workspace

### Potential Product Improvements

- Add documented CLI and assistant/operator workflows without making either one the privileged path.
- Add a `fps prepare` or `fps ingest` helper for PDF-to-text workflows without making PDF parsing a runtime dependency.
- Add first-class support for Vizyon/AI-video scene documents.
- Add a complete Google Flow production-pack generator:
  - read a screenplay or Vizyon document
  - split every scene into production-ready shots using valid Veo durations (4, 6, or 8 seconds)
  - generate a Vizyon-style expanded shot script for the user, not only prompts
  - include all production details needed for each shot: location, time of day, environment, props, wardrobe, character state, blocking, camera angle, lens/framing, movement, lighting, color palette, sound, continuity, transition, VFX/post notes, AI-risk notes, and practical production constraints
  - create one Markdown file per shot, for example `SHOT_001.md`
  - include start image prompt, end image prompt, video prompt, recommended duration, required references, continuity notes, negative constraints, and exact Google Flow setup instructions
  - create a film/project output folder automatically
  - prioritize professional, realistic, production-grade guidance over generic prompt packs
- Add Google Flow tool recommendations:
  - when a shot would be easier with a specific Flow tool, explicitly tell the user which tool to use
  - include the recommendation inside the shot Markdown file
  - keep these user-facing Flow instructions in English
  - examples: use reference images for character continuity, use start/end frames for screen continuity, use editing/repair tools when only a small part of the frame should change
- Add a prompt generator mode for Veo clip planning:
  - start frame prompt
  - end frame prompt
  - video prompt
  - 4/6/8 second clip plan
- Add continuity-focused prompt templates:
  - "preserve screen layout"
  - "minimal UI motion"
  - "no readable text"
  - "no alarm exaggeration"
- Add a production notes extractor for `TEKNİK BLOK`, `AI-ZORLUK`, `MODEL NOTU`, `GEÇİŞ`.

### Professionalization / Differentiation Ideas

- Position the package as an AI video production workflow engine, not only a prompt generator.
- Add `CONTINUITY.md` per film/project:
  - character identity rules
  - location and set continuity
  - wardrobe and prop continuity
  - color palette and lighting continuity
  - camera language and framing rules
  - screen/UI layout continuity
  - approved and rejected visual directions
- Add shot-level model risk profiling:
  - `face_identity`
  - `text_on_screen`
  - `screen_continuity`
  - `ui_redesign`
  - `overacting`
  - `hands`
  - `crowd`
  - `logos`
  - `unwanted_sci_fi`
  - `alarm_exaggeration`
- Use risk profiles to automatically add negative constraints to prompts.
- Add a reference strategy block for every shot:
  - character references
  - location references
  - previous start/end frame references
  - screen continuity references
  - rejected references or visual directions to avoid
- Add a Flow Tool Advisor:
  - explain which Google Flow tool should be used for each shot
  - recommend reference images when character identity must remain stable
  - recommend start/end frames when camera, screen, or motion continuity is critical
  - recommend editing/repair tools when only a small region of the frame should change
  - keep user-facing Flow tool guidance in English
- Add a shot quality checklist to every generated `SHOT_###.md`:
  - character identity preserved
  - location continuity preserved
  - screen layout unchanged
  - no extra UI panels
  - no readable fake text
  - no unwanted logos
  - motion level matches the scene
  - selected duration is valid for Veo
- Add rejected output learning:
  - when a generated result is rejected, store why it failed
  - when a result is approved, store what worked
  - use those preferences automatically in later prompts for the same project
- Add separate product modes:
  - `standard`: fast prompt generation
  - `director`: shot breakdown, references, Flow settings, risk notes, continuity, start/end/video prompts, and quality checks
- Most differentiating feature bundle:
  - Production Pack Generator
  - Continuity Memory
  - Flow Tool Advisor

### Implemented in 3.0.0

- Added `fps ingest` for source preparation and PDF-to-text guidance without adding a PDF runtime dependency.
- Added `fps production-pack` for Google Flow / Veo project folders.
- Added one Markdown file per shot with start image prompt, end image prompt, video prompt, references, Flow setup, risk profile, and quality checklist.
- Added Veo duration splitting for 4, 6, and 8 second clips.
- Added `CONTINUITY.md` for project continuity memory.
- Added `LEARNING.json` and `LEARNING.md` for approved/rejected output learning.
- Added `fps feedback` so field feedback can be recorded after reviewing generated images/videos.
- Added prompt injection from rejected output learning as negative constraints and approved output learning as positive continuity guidance.
- Added Flow Tool Advisor recommendations for reference images, start/end frames, and repair/edit-style workflows.
- Added `standard` and `director` production-pack modes.
