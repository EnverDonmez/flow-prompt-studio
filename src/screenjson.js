/**
 * Flow Prompt Studio — ScreenJSON Export
 *
 * Converts parse results to the ScreenJSON 1.0.0 open standard.
 * https://screenjson.com/specification/
 *
 * ScreenJSON is an open, structured JSON format for screenplays designed
 * for interoperability between film production tools, AI pipelines,
 * and localization workflows.
 */

const crypto = require("crypto");

/**
 * Generate an RFC 4122 v4 UUID.
 */
function uuid() {
  return crypto.randomUUID();
}

/**
 * Create a BCP 47 language-keyed text map.
 */
function text(value, lang = "en") {
  return { [lang]: String(value || "") };
}

/**
 * Create a language-keyed name map.
 */
function name(value, lang = "en") {
  return { [lang]: String(value || "").substring(0, 255) };
}

/**
 * Create a slug from a string.
 */
function slugify(str) {
  return (str || "untitled")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 50) || "untitled";
}

/* ─── Main Converter ─── */

class ScreenJSONConverter {
  /**
   * Convert a ScreenplayParser result to ScreenJSON 1.0.0 format.
   *
   * @param {object} parseResult — Output from ScreenplayParser.parse()
   * @param {object} options
   * @param {string} options.title — Project title (default: from filename)
   * @param {string} options.lang — BCP 47 language tag (default: "en")
   * @returns {object} ScreenJSON 1.0.0 document
   */
  static convert(parseResult, options = {}) {
    const { scenes, characters, stats } = parseResult;
    const lang = options.lang || "en";
    const title = options.title || stats.filename.replace(/\.[^.]+$/, "");

    // Build character index
    const charIndex = characters.map((c) => ({
      id: uuid(),
      slug: slugify(c.name),
      name: c.name,
      aliases: [],
      desc: text(`Character appearing in ${c.count} scene(s)`, lang),
      traits: [],
      meta: { appearances: String(c.count) },
    }));

    // Build name-to-UUID map for scene cast references
    const charMap = {};
    charIndex.forEach((c) => {
      charMap[c.name] = c.id;
    });

    // Build scenes
    const screenjsonScenes = scenes.map((scene) => {
      const castUuids = scene.characters.map((name) => charMap[name]).filter(Boolean);

      // Parse heading for context/setting/time
      let context = "";
      let setting = scene.location || scene.heading || "";
      let time = "";

      const headingMatch = scene.heading.match(/^(INT\.|EXT\.|INT\/EXT|EXT\/INT)\s+(.+?)\s*[-–—]\s*(DAY|NIGHT|DAWN|DUSK|MORNING|EVENING|CONTINUOUS|LATER|MOMENTS LATER)?$/i);
      if (headingMatch) {
        context = headingMatch[1].toUpperCase();
        setting = headingMatch[2] || setting;
        time = (headingMatch[3] || "").toUpperCase();
      }

      return {
        id: uuid(),
        authors: [],
        heading: {
          no: scene.index,
          context,
          setting: setting.trim(),
          time: time || undefined,
          mods: [],
          desc: text(scene.heading, lang),
        },
        body: [
          {
            id: uuid(),
            type: "action",
            text: text(`Scene ${scene.number}: ${scene.heading}. ${scene.dialogueCount} dialogue lines.`, lang),
          },
        ],
        cast: castUuids,
        animals: [],
        extra: [],
        locations: setting ? [slugify(setting)] : [],
        moods: [],
        props: [],
        sfx: [],
        sounds: [],
        tags: [],
        vfx: [],
        wardrobe: [],
        meta: {
          lineNumber: String(scene.lineNumber),
          dialogueCount: String(scene.dialogueCount),
        },
      };
    });

    // Build document
    return {
      id: uuid(),
      version: "1.0.0",
      title: name(title, lang),
      lang,
      charset: "utf-8",
      dir: "ltr",
      authors: [
        {
          id: uuid(),
          name: "Unknown",
          role: "screenwriter",
          meta: {},
        },
      ],
      generator: {
        id: "flow-prompt-studio",
        version: require("../package.json").version,
        url: "https://github.com/EnverDonmez/flow-prompt-studio",
      },
      document: {
        cover: {
          title: name(title, lang),
          authors: [],
        },
        scenes: screenjsonScenes,
        layout: {},
        bookmarks: [],
      },
      characters: charIndex,
      revisions: [
        {
          id: uuid(),
          datetime: new Date().toISOString(),
          authors: [],
          desc: text("Initial conversion from screenplay parse", lang),
        },
      ],
      analysis: {
        embeddings: [],
        passages: [
          {
            id: uuid(),
            text: text(`Screenplay analysis: ${stats.totalScenes} scenes, ${stats.totalCharacters} characters, ${stats.totalDialogueLines} dialogue lines, ~${stats.estimatedDurationMinutes} minutes`, lang),
            meta: {
              sceneCount: String(stats.totalScenes),
              characterCount: String(stats.totalCharacters),
              dialogueLines: String(stats.totalDialogueLines),
              estimatedPages: String(stats.estimatedPages),
              estimatedDuration: String(stats.estimatedDurationMinutes),
            },
          },
        ],
        summaries: [],
        meta: {},
      },
    };
  }

  /**
   * Export to JSON string.
   */
  static toJSON(parseResult, options = {}) {
    return JSON.stringify(this.convert(parseResult, options), null, 2);
  }

  /**
   * Export to file.
   */
  static toFile(parseResult, outputPath, options = {}) {
    const fs = require("fs");
    const path = require("path");
    const dir = path.dirname(outputPath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(outputPath, this.toJSON(parseResult, options), "utf-8");
    return outputPath;
  }
}

module.exports = { ScreenJSONConverter };
