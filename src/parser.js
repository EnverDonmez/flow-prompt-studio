/**
 * Flow Prompt Studio — Local Screenplay Parser
 *
 * Parses screenplays in TXT, MD, Fountain (.fountain), and Final Draft XML (.fdx)
 * formats. Extracts scenes, characters, dialogue, and statistics.
 *
 * Zero dependencies. Works offline. No API key required.
 */

const fs = require("fs");
const path = require("path");

/* ─── Scene Detection Patterns ─── */

const TIMECODE_SCENE_PATTERN = /^(\d{1,2}:\d{2}(?::\d{2})?)\s*[-–—]\s*(\d{1,2}:\d{2}(?::\d{2})?)\s*\|\s*(.+)$/i;

const SCENE_PATTERNS = [
  // Standard screenplay format: INT./EXT. or INT/EXT
  /^(INT\.|EXT\.|INT\/EXT|EXT\/INT|I\/E|E\/I)[.\s-]+(.+)$/im,
  // Timecoded documentary/script sections: 00:00 - 00:29 | OPENING
  TIMECODE_SCENE_PATTERN,
  // Vision/AI-video format: SAHNE SCN-001: LOCATION - TIME
  /^(SAHNE|SCENE)\s+(SCN-\d+)\s*:\s*(.+)$/im,
  // Numbered scenes: SCENE 1, SCENE: 1, SCÈNE 1
  /^(SCENE|SCÈNE|SCENA|SZENE|BÖLÜM|CHAPTER|REEL|ACT)\s*[:.\-—]?\s*(\d+)\s*[:.\-—]?\s*(.*)$/im,
  // Fountain format: # Section, ## Scene
  /^#{1,2}\s+(.+)$/m,
  // Day/Night markers
  /^(.+)\s[-–—]\s(DAY|NIGHT|DAWN|DUSK|MORNING|EVENING|CONTINUOUS|LATER|MOMENTS LATER)\s*$/im,
];

/* ─── Character Detection ─── */

// Standard format: ALL CAPS name on its own line (typically before dialogue)
const TURKISH_UPPER = "A-ZÀ-ÖØ-ÞĞİŞÇÜÖ";
const CHARACTER_LINE = new RegExp(`^[${TURKISH_UPPER}][${TURKISH_UPPER}\\s'\\-().]{1,30}[${TURKISH_UPPER}]$`);
// More permissive: ALL CAPS name followed by dialogue in parentheses or next line
const CHARACTER_PAREN = new RegExp(`^([${TURKISH_UPPER}][${TURKISH_UPPER}\\s'\\-().]{1,30}[${TURKISH_UPPER}])\\s*\\(([^)]+)\\)\\s*$`);

const NON_CHARACTER_CUES = new Set([
  "GÖRÜNTÜ",
  "GORUNTU",
  "VISUAL",
  "IMAGE",
  "SHOT",
  "ALT YAZI",
  "ALTYAZI",
  "SUBTITLE",
  "TEKNİK BLOK",
  "TEKNIK BLOK",
  "AI-ZORLUK",
  "MODEL NOTU",
  "KALİTE RAPORU",
  "KALITE RAPORU",
]);

/* ─── Main Parser Class ─── */

class ScreenplayParser {
  /**
   * Parse a screenplay file and extract structured data.
   * @param {string} filePath - Path to the screenplay file
   * @returns {ParseResult}
   */
  static parse(filePath) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    const ext = path.extname(filePath).toLowerCase();
    let text;

    if (ext === ".fdx") {
      text = this._parseFdx(filePath);
    } else {
      text = fs.readFileSync(filePath, "utf-8");
    }

    const lines = text.split(/\r?\n/);
    return this._parseLines(lines, path.basename(filePath));
  }

  /**
   * Parse screenplay text directly from a string.
   * @param {string} text - Screenplay content
   * @param {string} [label="inline"] - Label for the source
   * @returns {ParseResult}
   */
  static parseText(text, label = "inline") {
    const lines = text.split(/\r?\n/);
    return this._parseLines(lines, label);
  }

  /**
   * Parse Final Draft XML (.fdx) format.
   */
  static _parseFdx(filePath) {
    const xml = fs.readFileSync(filePath, "utf-8");
    const paragraphs = [];
    const regex = /<Paragraph[^>]*Type="([^"]*)"[^>]*>[\s\S]*?<Text>(.*?)<\/Text>[\s\S]*?<\/Paragraph>/gi;
    let match;
    while ((match = regex.exec(xml)) !== null) {
      const type = match[1];
      const txt = match[2].replace(/<[^>]+>/g, "").trim();
      if (type === "Scene Heading") paragraphs.push(txt);
      else if (type === "Character") paragraphs.push(txt.toUpperCase());
      else if (type === "Dialogue") paragraphs.push("  " + txt);
      else paragraphs.push(txt);
    }
    return paragraphs.join("\n");
  }

  /**
   * Core line-by-line parser.
   */
  static _parseLines(lines, filename) {
    const scenes = [];
    const characters = {};
    const rawScenes = [];
    const hasExplicitScenes = lines.some((raw) => {
      const line = raw.trim();
      return line && SCENE_PATTERNS.some((pattern) => line.match(pattern));
    });

    let currentScene = null;
    let currentCharacter = null;
    let sceneIndex = 0;
    let totalDialogueLines = 0;

    for (let i = 0; i < lines.length; i++) {
      const raw = lines[i];
      const line = raw.trim();

      if (!line) {
        currentCharacter = null;
        continue;
      }

      // ── Scene Detection ──
      let sceneDetected = false;
      for (const pattern of SCENE_PATTERNS) {
        const m = line.match(pattern);
        if (m) {
          sceneIndex++;
          // Save previous scene
          if (currentScene) {
            rawScenes.push(currentScene);
          }

          const heading = line;
          const isTimecoded = pattern === TIMECODE_SCENE_PATTERN;
          const sceneNumber = isTimecoded ? `${m[1]}-${m[2]}` : (m[2] || `S${sceneIndex}`);
          const location = isTimecoded ? m[3] : (m[2] ? (m[3] || m[2]) : (m[1] || line));

          currentScene = {
            index: sceneIndex,
            number: sceneNumber,
            heading,
            location: location.trim(),
            lineNumber: i + 1,
            dialogueCount: 0,
            characters: new Set(),
            contentLines: [],
          };
          currentCharacter = null;
          sceneDetected = true;
          break;
        }
      }
      if (sceneDetected) continue;

      // No scene yet? Create implicit scene from first content
      if (!currentScene && line && !hasExplicitScenes) {
        sceneIndex++;
        currentScene = {
          index: sceneIndex,
          number: `S${sceneIndex}`,
          heading: line.substring(0, 60),
          location: line.substring(0, 60),
          lineNumber: i + 1,
          dialogueCount: 0,
          characters: new Set(),
          contentLines: [],
        };
      }

      if (!currentScene) continue;

      currentScene.contentLines.push(line);

      const nextContentLine = (() => {
        for (let j = i + 1; j < lines.length; j++) {
          const nextLine = lines[j].trim();
          if (nextLine) return nextLine;
        }
        return "";
      })();

      // ── Character Detection ──
      const charParen = line.match(CHARACTER_PAREN);
      if (charParen) {
        const name = charParen[1].trim();
        currentCharacter = name;
        characters[name] = (characters[name] || 0) + 1;
        currentScene.characters.add(name);
        continue;
      }

      // ALL CAPS line that looks like a character name
      if (
        CHARACTER_LINE.test(line) &&
        line.length < 40 &&
        line === line.toUpperCase() &&
        !NON_CHARACTER_CUES.has(line) &&
        !NON_CHARACTER_CUES.has(nextContentLine) &&
        !line.startsWith("INT") &&
        !line.startsWith("EXT") &&
        !line.startsWith("SCENE") &&
        !line.startsWith("ACT") &&
        !line.startsWith("FADE") &&
        !line.startsWith("CUT") &&
        !line.startsWith("DISSOLVE") &&
        line.length > 1
      ) {
        currentCharacter = line;
        characters[line] = (characters[line] || 0) + 1;
        currentScene.characters.add(line);
        continue;
      }

      // ── Dialogue Detection ──
      // Text following a character line that isn't a scene marker or all-caps
      if (currentCharacter && line.length > 1 && !/^(INT|EXT|SCENE|FADE|CUT|DISSOLVE)/i.test(line)) {
        // Check this looks like dialogue (not another scene heading or parenthetical)
        if (!line.startsWith("(") || !line.endsWith(")")) {
          totalDialogueLines++;
          currentScene.dialogueCount++;
          currentCharacter = null; // Reset after one dialogue block
          continue;
        }
      }

      // Parenthetical (actor direction) — skip
      if (line.startsWith("(") && line.endsWith(")") && line.length < 60) {
        continue;
      }

      // Transition (CUT TO:, FADE OUT., etc.) — skip
      if (/^(CUT TO|FADE (IN|OUT)|DISSOLVE TO|SMASH CUT|MATCH CUT|IRIS|WIPE)/i.test(line)) {
        continue;
      }
    }

    // Save last scene
    if (currentScene) {
      rawScenes.push(currentScene);
    }

    // Convert Set to array for JSON serialization
    for (const scene of rawScenes) {
      scenes.push({
        index: scene.index,
        number: scene.number,
        heading: scene.heading,
        location: scene.location,
        lineNumber: scene.lineNumber,
        dialogueCount: scene.dialogueCount,
        characters: [...scene.characters],
        content: scene.contentLines.join("\n"),
      });
    }

    // Sort characters by frequency
    const sortedCharacters = Object.entries(characters)
      .sort(([, a], [, b]) => b - a)
      .map(([name, count]) => ({ name, count }));

    // Statistics
    const totalPages = Math.ceil(lines.length / 55); // ~55 lines per page standard
    const stats = {
      filename,
      totalLines: lines.length,
      totalScenes: scenes.length,
      totalCharacters: sortedCharacters.length,
      totalDialogueLines,
      estimatedPages: totalPages,
      estimatedDurationMinutes: totalPages, // 1 page ≈ 1 minute
      speakingCharacters: sortedCharacters.filter((c) => c.count > 0).length,
    };

    return { scenes, characters: sortedCharacters, stats };
  }
}

module.exports = { ScreenplayParser };
