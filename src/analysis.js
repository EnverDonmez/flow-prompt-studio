/**
 * Flow Prompt Studio — Advanced Script Analysis
 *
 * Analyzes screenplays for:
 *   - Pacing/tempo map (dialogue density per scene)
 *   - Emotional arc (keyword-based sentiment)
 *   - Character relationship graph (co-occurrence)
 *   - Scene complexity scoring
 *
 * All analysis is offline, no AI required.
 */

/* ─── Emotion Keywords ─── */

const EMOTION_KEYWORDS = {
  joy: ["happy", "smile", "laugh", "joy", "celebrate", "love", "embrace", "grin", "delight", "cheer"],
  sadness: ["cry", "tear", "sad", "weep", "mourn", "grief", "sorrow", "despair", "sob", "alone"],
  anger: ["angry", "furious", "rage", "yell", "shout", "scream", "fury", "snap", "storm", "fume"],
  fear: ["afraid", "scared", "terrif", "fear", "horror", "panic", "dread", "anxiety", "nervous", "tremble"],
  tension: ["tense", "silence", "stare", "quiet", "still", "wait", "pause", "beat", "slowly", "hold"],
  action: ["run", "jump", "chase", "fight", "shoot", "explode", "crash", "race", "dodge", "strike"],
  romance: ["kiss", "touch", "gaze", "intimate", "close", "whisper", "soft", "gentle", "caress", "warm"],
  mystery: ["mysterious", "strange", "odd", "peculiar", "weird", "unusual", "unknown", "hidden", "secret", "dark"],
};

/* ─── Analysis Engine ─── */

class ScriptAnalyzer {
  /**
   * Full analysis of a parsed screenplay.
   */
  static analyze(parseResult) {
    return {
      tempo: this._analyzeTempo(parseResult),
      emotions: this._analyzeEmotions(parseResult),
      relationships: this._analyzeRelationships(parseResult),
      complexity: this._analyzeComplexity(parseResult),
    };
  }

  /**
   * Tempo/pacing map — dialogue density per scene.
   * High dialogue = fast pace (conversation-driven)
   * Low dialogue = slow pace (visual/atmospheric)
   */
  static _analyzeTempo(parseResult) {
    const avgDialogue = parseResult.stats.totalScenes > 0
      ? parseResult.stats.totalDialogueLines / parseResult.stats.totalScenes
      : 0;

    const sceneTempos = parseResult.scenes.map((s) => {
      const ratio = avgDialogue > 0 ? s.dialogueCount / avgDialogue : 1;
      let pace;
      if (ratio > 1.5) pace = "fast";
      else if (ratio > 0.7) pace = "medium";
      else pace = "slow";

      return { scene: s.number, heading: s.heading, dialogueCount: s.dialogueCount, ratio: ratio.toFixed(2), pace };
    });

    const fastCount = sceneTempos.filter((s) => s.pace === "fast").length;
    const slowCount = sceneTempos.filter((s) => s.pace === "slow").length;
    const overallPace = fastCount > slowCount ? "dialogue-driven" : slowCount > fastCount ? "visual/atmospheric" : "balanced";

    return {
      overallPace,
      averageDialoguePerScene: avgDialogue.toFixed(1),
      fastScenes: fastCount,
      mediumScenes: sceneTempos.length - fastCount - slowCount,
      slowScenes: slowCount,
      scenes: sceneTempos,
    };
  }

  /**
   * Emotional arc — keyword-based sentiment per scene.
   */
  static _analyzeEmotions(parseResult) {
    const sceneEmotions = parseResult.scenes.map((s) => {
      const heading = (s.heading || "").toLowerCase();
      const scores = {};

      Object.entries(EMOTION_KEYWORDS).forEach(([emotion, keywords]) => {
        let count = 0;
        keywords.forEach((kw) => {
          const regex = new RegExp(kw, "gi");
          const matches = heading.match(regex);
          if (matches) count += matches.length;
        });
        if (count > 0) scores[emotion] = count;
      });

      const dominant = Object.entries(scores).sort(([, a], [, b]) => b - a)[0];

      return {
        scene: s.number,
        heading: s.heading,
        dominantEmotion: dominant ? dominant[0] : "neutral",
        scores,
      };
    });

    // Overall emotional profile
    const totals = {};
    sceneEmotions.forEach((s) => {
      Object.entries(s.scores).forEach(([e, c]) => {
        totals[e] = (totals[e] || 0) + c;
      });
    });

    const dominantOverall = Object.entries(totals).sort(([, a], [, b]) => b - a).slice(0, 3).map(([e]) => e);

    return {
      dominantEmotions: dominantOverall,
      sceneEmotions,
    };
  }

  /**
   * Character relationship graph — co-occurrence matrix.
   */
  static _analyzeRelationships(parseResult) {
    const { scenes } = parseResult;
    const charNames = parseResult.characters.map((c) => c.name);

    if (charNames.length < 2) {
      return { pairs: [], strongest: null, graph: {} };
    }

    // Build co-occurrence matrix
    const pairs = {};
    for (let i = 0; i < charNames.length; i++) {
      for (let j = i + 1; j < charNames.length; j++) {
        const key = [charNames[i], charNames[j]].sort().join(" ↔ ");
        pairs[key] = 0;
      }
    }

    scenes.forEach((s) => {
      const charsInScene = s.characters || [];
      Object.keys(pairs).forEach((pair) => {
        const [a, b] = pair.split(" ↔ ");
        if (charsInScene.includes(a) && charsInScene.includes(b)) {
          pairs[pair]++;
        }
      });
    });

    const sorted = Object.entries(pairs)
      .filter(([, count]) => count > 0)
      .sort(([, a], [, b]) => b - a);

    return {
      pairs: sorted.map(([pair, count]) => ({ pair, sharedScenes: count })),
      strongest: sorted[0] ? { pair: sorted[0][0], sharedScenes: sorted[0][1] } : null,
      totalCharacterPairs: Object.keys(pairs).length,
      connectedPairs: sorted.length,
    };
  }

  /**
   * Scene complexity scoring — characters + dialogue density + location changes.
   */
  static _analyzeComplexity(parseResult) {
    const { scenes } = parseResult;

    const sceneScores = scenes.map((s) => {
      const charComplexity = (s.characters?.length || 0) * 10;
      const dialogueComplexity = s.dialogueCount * 5;
      const locationChange = s.index > 1 && s.location !== scenes[s.index - 2]?.location ? 15 : 0;
      const total = charComplexity + dialogueComplexity + locationChange;

      let level;
      if (total > 50) level = "high";
      else if (total > 20) level = "medium";
      else level = "low";

      return {
        scene: s.number,
        heading: s.heading,
        score: total,
        level,
        factors: {
          characters: charComplexity,
          dialogue: dialogueComplexity,
          locationChange,
        },
      };
    });

    const avgScore = sceneScores.length > 0
      ? sceneScores.reduce((sum, s) => sum + s.score, 0) / sceneScores.length
      : 0;

    const highComplexity = sceneScores.filter((s) => s.level === "high").length;

    return {
      averageScore: Math.round(avgScore),
      highComplexityScenes: highComplexity,
      mostComplex: sceneScores.sort((a, b) => b.score - a.score).slice(0, 3),
      sceneScores,
    };
  }

  /**
   * Format full analysis as Markdown.
   */
  static toMarkdown(analysis) {
    let md = `# Script Analysis\n\n`;

    // Tempo
    md += `## Tempo & Pacing\n\n`;
    md += `**Overall:** ${analysis.tempo.overallPace}\n`;
    md += `**Avg dialogue/scene:** ${analysis.tempo.averageDialoguePerScene}\n`;
    md += `**Fast scenes:** ${analysis.tempo.fastScenes} | **Medium:** ${analysis.tempo.mediumScenes} | **Slow:** ${analysis.tempo.slowScenes}\n\n`;
    md += `| Scene | Pace | Dialogue | Ratio |\n|-------|------|----------|-------|\n`;
    analysis.tempo.scenes.forEach((s) => {
      md += `| ${s.scene} | ${s.pace} | ${s.dialogueCount} | ${s.ratio}x |\n`;
    });

    // Emotions
    md += `\n## Emotional Arc\n\n`;
    md += `**Dominant:** ${(analysis.emotions.dominantEmotions || []).join(", ") || "neutral"}\n\n`;
    md += `| Scene | Dominant Emotion |\n|-------|-----------------|\n`;
    analysis.emotions.sceneEmotions.forEach((s) => {
      md += `| ${s.scene} | ${s.dominantEmotion} |\n`;
    });

    // Relationships
    md += `\n## Character Relationships\n\n`;
    if (analysis.relationships.strongest) {
      md += `**Strongest:** ${analysis.relationships.strongest.pair} (${analysis.relationships.strongest.sharedScenes} scenes together)\n\n`;
    }
    md += `| Pair | Shared Scenes |\n|------|--------------|\n`;
    analysis.relationships.pairs.forEach((p) => {
      md += `| ${p.pair} | ${p.sharedScenes} |\n`;
    });

    // Complexity
    md += `\n## Scene Complexity\n\n`;
    md += `**Average:** ${analysis.complexity.averageScore} | **High complexity:** ${analysis.complexity.highComplexityScenes} scenes\n\n`;
    md += `### Most Complex Scenes\n\n`;
    analysis.complexity.mostComplex.forEach((s) => {
      md += `- **${s.scene}:** ${s.heading} (score: ${s.score}, ${s.level})\n`;
    });

    return md;
  }
}

module.exports = { ScriptAnalyzer, EMOTION_KEYWORDS };
