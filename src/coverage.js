/**
 * Flow Prompt Studio — Shot Coverage Generator
 *
 * Genre-based shot coverage templates. Each genre defines a set of
 * shot types, their distribution, camera movement suggestions, and
 * equipment notes. No AI required — works completely offline.
 */

/* ─── Shot Type Catalog ─── */

const SHOT_TYPES = {
  EWS: { name: "Extreme Wide Shot", desc: "Subject barely visible, establishing environment", typicalDuration: "4-6s" },
  WS: { name: "Wide Shot", desc: "Full body in frame with environment context", typicalDuration: "3-5s" },
  FS: { name: "Full Shot", desc: "Subject fills frame head to toe", typicalDuration: "3-4s" },
  MLS: { name: "Medium Long Shot", desc: "Knees up, action framing", typicalDuration: "3-4s" },
  MS: { name: "Medium Shot", desc: "Waist up, standard dialogue framing", typicalDuration: "2-4s" },
  MCU: { name: "Medium Close-Up", desc: "Chest up, intimate dialogue", typicalDuration: "2-3s" },
  CU: { name: "Close-Up", desc: "Face or object detail", typicalDuration: "1-3s" },
  ECU: { name: "Extreme Close-Up", desc: "Single detail (eye, hand, prop)", typicalDuration: "1-2s" },
  OTS: { name: "Over-the-Shoulder", desc: "Conversation perspective from behind subject", typicalDuration: "2-4s" },
  TWO: { name: "Two-Shot", desc: "Two subjects in frame", typicalDuration: "2-4s" },
  POV: { name: "Point of View", desc: "Camera sees what character sees", typicalDuration: "2-5s" },
  LA: { name: "Low Angle", desc: "Camera below subject, power/dominance", typicalDuration: "2-3s" },
  HA: { name: "High Angle", desc: "Camera above subject, vulnerability", typicalDuration: "2-3s" },
  DA: { name: "Dutch Angle", desc: "Tilted horizon, unease/disorientation", typicalDuration: "2-3s" },
  INS: { name: "Insert Shot", desc: "Close detail of action or prop", typicalDuration: "1-3s" },
  AER: { name: "Aerial / Drone", desc: "Overhead establishing, sweeping movement", typicalDuration: "5-10s" },
  TRK: { name: "Tracking Shot", desc: "Camera follows subject movement", typicalDuration: "4-10s" },
  DOLLY: { name: "Dolly Shot", desc: "Camera moves toward/away from subject", typicalDuration: "3-6s" },
  PAN: { name: "Pan", desc: "Horizontal camera rotation, revealing", typicalDuration: "3-6s" },
  TILT: { name: "Tilt", desc: "Vertical camera rotation, revealing", typicalDuration: "3-5s" },
  HH: { name: "Handheld", desc: "Shaky, documentary-style immediacy", typicalDuration: "2-5s" },
  STD: { name: "Steadicam", desc: "Smooth floating movement", typicalDuration: "3-8s" },
  SLM: { name: "Slow Motion", desc: "Dramatic time manipulation", typicalDuration: "2-4s" },
  ZOOM: { name: "Zoom In/Out", desc: "Focal length change without camera move", typicalDuration: "2-4s" },
  RACK: { name: "Rack Focus", desc: "Focus shift between foreground and background", typicalDuration: "2-3s" },
};

/* ─── Genre Templates ─── */

const GENRES = {
  action: {
    name: "Action",
    description: "High-energy sequences with emphasis on movement, stunts, and spectacle",
    shotsPerScene: 14,
    distribution: {
      EWS: 1, WS: 2, MS: 2, CU: 1, ECU: 1,
      TRK: 2, AER: 1, LA: 1, POV: 1, SLM: 1, HH: 1,
    },
    cameraNotes: [
      "Use gimbals and drones for dynamic chase sequences",
      "Multiple cameras for stunt coverage (safety + close-up)",
      "High frame rate for slow-motion action beats",
    ],
    equipment: ["Gimbal (Ronin/Movi)", "Drone", "Crash cam", "High-speed camera", "Long lens (70-200mm)"],
    pacing: "Fast cuts, 2-4s average shot length during action, longer for establishing",
  },

  drama: {
    name: "Drama",
    description: "Character-driven storytelling with emphasis on performance and emotion",
    shotsPerScene: 8,
    distribution: {
      MS: 2, MCU: 3, CU: 2, OTS: 2, TWO: 1,
      WS: 1, DOLLY: 1, FS: 1,
    },
    cameraNotes: [
      "Linger on performances — don't cut too early",
      "Use dolly moves for emotional reveals",
      "Shallow depth of field for intimate moments",
    ],
    equipment: ["Prime lenses (35mm, 50mm, 85mm)", "Dolly + track", "Shoulder rig", "ND filters"],
    pacing: "Deliberate pacing, 3-6s average shot length, longer takes for emotional scenes",
  },

  horror: {
    name: "Horror",
    description: "Tension and fear through framing, movement, and withheld information",
    shotsPerScene: 10,
    distribution: {
      WS: 2, MS: 2, CU: 2, ECU: 1, POV: 2,
      DA: 1, HH: 1, LA: 1, HA: 1, TRK: 1,
    },
    cameraNotes: [
      "Dutch angles create subconscious unease",
      "POV shots put audience in victim's perspective",
      "Hold on empty frames — let audience imagine the threat",
      "Use negative space to suggest hidden danger",
    ],
    equipment: ["Fast prime lenses (T1.3-T2)", "Gimbal for smooth POV", "Practical lighting rig", "Fog machine"],
    pacing: "Slow build, 4-8s average, sudden acceleration for scares (0.5-2s cuts)",
  },

  documentary: {
    name: "Documentary",
    description: "Observational and interview-based storytelling with vérité aesthetics",
    shotsPerScene: 6,
    distribution: {
      MS: 3, CU: 2, WS: 2, OTS: 1, INS: 1,
      HH: 2, PAN: 1, TILT: 1,
    },
    cameraNotes: [
      "Handheld for vérité — embrace imperfection",
      "Always have B-roll running for coverage",
      "Interview framing: subject looks slightly off-camera",
      "Establishing shots: environment before people",
    ],
    equipment: ["Zoom lens (24-70mm)", "Shotgun mic", "Lav mics", "Portable LED panel", "Monopod"],
    pacing: "Natural rhythm, 3-6s average, longer for interviews (10-30s)",
  },

  music_video: {
    name: "Music Video",
    description: "Rhythmic, stylized visuals synchronized to music",
    shotsPerScene: 16,
    distribution: {
      CU: 3, ECU: 2, MS: 3, WS: 2,
      SLM: 2, TRK: 2, AER: 1, LA: 1, POV: 1, INS: 2,
    },
    cameraNotes: [
      "Cut on the beat — edit drives everything",
      "Mix performance shots with abstract B-roll",
      "Slow motion for dramatic moments, speed ramps for energy",
      "Color and lighting as storytelling elements",
    ],
    equipment: ["Gimbal", "Drone", "High-speed camera", "Prism filters", "RGB LED panels", "Smoke/haze"],
    pacing: "Fast, rhythmic, 1-4s cuts synced to music tempo",
  },

  commercial: {
    name: "Commercial / Ad",
    description: "Product-focused, visually polished, maximum impact in short runtime",
    shotsPerScene: 10,
    distribution: {
      ECU: 3, CU: 2, MS: 2, WS: 1,
      SLM: 2, DOLLY: 1, INS: 2, AER: 1,
    },
    cameraNotes: [
      "Hero product shot is everything — light it perfectly",
      "Lifestyle: show the product in aspirational context",
      "End card: clean, branded, memorable",
      "Every frame must serve the message — no wasted shots",
    ],
    equipment: ["Macro lens", "Slider", "Product turntable", "Softbox lighting", "C-stands + flags"],
    pacing: "Tight, 1-3s average, maximum information density per second",
  },

  short_film: {
    name: "Short Film",
    description: "Festival-friendly hybrid coverage balancing creativity with resource constraints",
    shotsPerScene: 7,
    distribution: {
      MS: 3, CU: 2, WS: 1, OTS: 2, TWO: 1,
      DOLLY: 1, FS: 1, HH: 1,
    },
    cameraNotes: [
      "Plan for limited locations — maximize each setup",
      "Natural light is your friend — shoot during golden hour",
      "Sound is 50% of the experience — don't neglect it",
      "Rehearse blocking before lighting to save setup time",
    ],
    equipment: ["Versatile zoom (24-105mm)", "LED panel kit", "Boom mic + recorder", "Reflector/diffuser", "Shoulder rig"],
    pacing: "Flexible, 2-5s average, adjust to story needs",
  },
};

/* ─── Generator Class ─── */

class CoverageGenerator {
  /**
   * List available genre keys.
   * @returns {string[]}
   */
  static listGenres() {
    return Object.keys(GENRES);
  }

  /**
   * Get genre metadata.
   * @param {string} genre - Genre key
   * @returns {object}
   */
  static getGenre(genre) {
    const g = GENRES[genre.toLowerCase()];
    if (!g) throw new Error(`Unknown genre: ${genre}. Available: ${Object.keys(GENRES).join(", ")}`);
    return { key: genre.toLowerCase(), ...g };
  }

  /**
   * Generate a shot coverage plan for a screenplay.
   *
   * @param {object} parseResult - Result from ScreenplayParser.parse()
   * @param {string} genre - Genre key (action, drama, horror, etc.)
   * @returns {CoverageResult}
   */
  static generate(parseResult, genre = "drama") {
    const g = GENRES[genre.toLowerCase()];
    if (!g) throw new Error(`Unknown genre: ${genre}. Available: ${Object.keys(GENRES).join(", ")}`);

    const { scenes, stats } = parseResult;
    const shotRows = [];

    let shotNumber = 0;
    for (const scene of scenes) {
      const shotsForScene = g.shotsPerScene;
      const shotTypes = this._pickShotTypes(g.distribution, shotsForScene);

      for (const shotType of shotTypes) {
        shotNumber++;
        const typeInfo = SHOT_TYPES[shotType] || { name: shotType, desc: "", typicalDuration: "2-4s" };

        shotRows.push({
          "Shot #": shotNumber,
          "Scene": scene.number,
          "Scene Heading": scene.heading,
          "Shot Type": shotType,
          "Shot Name": typeInfo.name,
          "Description": typeInfo.desc,
          "Typical Duration": typeInfo.typicalDuration,
          "Characters": scene.characters.join(", "),
        });
      }
    }

    return {
      genre: { key: genre.toLowerCase(), ...g },
      sceneCount: scenes.length,
      totalShots: shotRows.length,
      averageShotsPerScene: (shotRows.length / (scenes.length || 1)).toFixed(1),
      estimatedDurationMinutes: Math.round(shotRows.length * 3 / 60), // ~3s average per shot
      shotRows,
    };
  }

  /**
   * Generate a shot plan without a parsed screenplay — just from a scene count.
   *
   * @param {number} sceneCount - Number of scenes
   * @param {string} [genre="drama"] - Genre key
   * @returns {CoverageResult}
   */
  static generateFromSceneCount(sceneCount, genre = "drama") {
    const g = GENRES[genre.toLowerCase()];
    if (!g) throw new Error(`Unknown genre: ${genre}. Available: ${Object.keys(GENRES).join(", ")}`);

    const shotRows = [];
    let shotNumber = 0;

    for (let s = 1; s <= sceneCount; s++) {
      const shotTypes = this._pickShotTypes(g.distribution, g.shotsPerScene);
      for (const shotType of shotTypes) {
        shotNumber++;
        const typeInfo = SHOT_TYPES[shotType] || { name: shotType, desc: "", typicalDuration: "2-4s" };
        shotRows.push({
          "Shot #": shotNumber,
          "Scene": `SCENE_${String(s).padStart(2, "0")}`,
          "Scene Heading": `Scene ${s}`,
          "Shot Type": shotType,
          "Shot Name": typeInfo.name,
          "Description": typeInfo.desc,
          "Typical Duration": typeInfo.typicalDuration,
          "Characters": "",
        });
      }
    }

    return {
      genre: { key: genre.toLowerCase(), ...g },
      sceneCount,
      totalShots: shotRows.length,
      averageShotsPerScene: (shotRows.length / (sceneCount || 1)).toFixed(1),
      estimatedDurationMinutes: Math.round(shotRows.length * 3 / 60),
      shotRows,
    };
  }

  /**
   * Pick shot types based on genre distribution.
   */
  static _pickShotTypes(distribution, total) {
    const types = [];
    const entries = Object.entries(distribution);

    for (const [type, count] of entries) {
      for (let i = 0; i < count; i++) {
        types.push(type);
      }
    }

    // Shuffle and take `total`
    for (let i = types.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [types[i], types[j]] = [types[j], types[i]];
    }

    return types.slice(0, total);
  }

  /**
   * Render shot plan to Markdown.
   */
  static toMarkdown(coverageResult) {
    const { genre, sceneCount, totalShots, averageShotsPerScene, estimatedDurationMinutes, shotRows } = coverageResult;
    let md = `# Shot Coverage Plan — ${genre.name}\n\n`;
    md += `**Genre:** ${genre.name}\n`;
    md += `**Description:** ${genre.description}\n`;
    md += `**Scenes:** ${sceneCount}\n`;
    md += `**Total Shots:** ${totalShots}\n`;
    md += `**Avg Shots/Scene:** ${averageShotsPerScene}\n`;
    md += `**Est. Duration:** ~${estimatedDurationMinutes} min\n\n`;
    md += `## Camera Notes\n\n`;
    genre.cameraNotes.forEach((n) => (md += `- ${n}\n`));
    md += `\n## Recommended Equipment\n\n`;
    genre.equipment.forEach((e) => (md += `- ${e}\n`));
    md += `\n## Pacing\n\n${genre.pacing}\n\n`;
    md += `## Shot List\n\n`;
    md += `| Shot # | Scene | Shot Type | Shot Name | Description | Duration | Characters |\n`;
    md += `|--------|-------|-----------|-----------|-------------|----------|------------|\n`;
    shotRows.forEach((r) => {
      md += `| ${r["Shot #"]} | ${r["Scene"]} | ${r["Shot Type"]} | ${r["Shot Name"]} | ${r["Description"]} | ${r["Typical Duration"]} | ${r["Characters"]} |\n`;
    });
    return md;
  }

  /**
   * Render shot plan to CSV string.
   */
  static toCSV(coverageResult) {
    const headers = ["Shot #", "Scene", "Scene Heading", "Shot Type", "Shot Name", "Description", "Typical Duration", "Characters"];
    const lines = [headers.join(",")];
    coverageResult.shotRows.forEach((r) => {
      lines.push(headers.map((h) => `"${String(r[h] || "").replace(/"/g, '""')}"`).join(","));
    });
    return lines.join("\n");
  }
}

module.exports = { CoverageGenerator, SHOT_TYPES, GENRES };
