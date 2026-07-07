/**
 * Flow Prompt Studio — Budget Estimator
 *
 * Estimates production costs from screenplay analysis.
 * Uses industry heuristics: scene count, character count, locations,
 * genre-specific multipliers, and coverage complexity.
 *
 * Three estimation levels:
 *   - indie: Micro-budget / indie film scale ($1K–$500K)
 *   - mid: Independent feature / TV pilot ($500K–$5M)
 *   - studio: Studio feature ($5M+)
 */

/* ─── Base Rates (USD, 2026 indie rates) ─── */

const RATES = {
  indie: {
    dayRate: { crew: 350, cast: 250, location: 500, equipment: 800, catering: 15, post: 2000 },
    perSceneFactor: 0.8,
    castMultiplier: 0.5,
    locationMultiplier: 0.6,
    contingency: 0.15,
    label: "Indie / Micro-Budget",
    range: "$2K – $50K",
  },
  mid: {
    dayRate: { crew: 650, cast: 1500, location: 2000, equipment: 3500, catering: 30, post: 8000 },
    perSceneFactor: 1.2,
    castMultiplier: 0.8,
    locationMultiplier: 1.0,
    contingency: 0.12,
    label: "Independent / TV Pilot",
    range: "$50K – $2M",
  },
  studio: {
    dayRate: { crew: 1200, cast: 10000, location: 5000, equipment: 15000, catering: 60, post: 50000 },
    perSceneFactor: 2.5,
    castMultiplier: 2.0,
    locationMultiplier: 2.0,
    contingency: 0.10,
    label: "Studio Feature",
    range: "$2M+",
  },
};

/* ─── Genre Multipliers ─── */
const GENRE_MULTIPLIER = {
  action: 2.0, drama: 1.0, horror: 0.8, documentary: 0.4,
  music_video: 0.5, commercial: 1.5, short_film: 0.3,
};

/* ─── Estimator ─── */

class BudgetEstimator {
  /**
   * Estimate production budget from parse + coverage results.
   *
   * @param {object} parseResult — From ScreenplayParser
   * @param {object} coverageResult — From CoverageGenerator (optional)
   * @param {object} options — { level: "indie"|"mid"|"studio", genre: "drama" }
   * @returns {BudgetResult}
   */
  static estimate(parseResult, coverageResult, options = {}) {
    const level = options.level || "indie";
    const rates = RATES[level];
    const genre = options.genre || coverageResult?.genre?.key || "drama";
    const genreMult = GENRE_MULTIPLIER[genre] || 1.0;

    const { scenes, characters, stats } = parseResult;
    const totalShots = coverageResult?.totalShots || scenes.length * 8;

    // Estimated shoot days (1 page ≈ 1 minute ≈ scenes handled per day)
    const pagesPerDay = level === "studio" ? 3 : level === "mid" ? 5 : 8;
    const shootDays = Math.max(1, Math.ceil(stats.estimatedPages / pagesPerDay));
    const prepDays = Math.ceil(shootDays * 0.5);
    const wrapDays = Math.max(1, Math.ceil(shootDays * 0.2));
    const postWeeks = Math.max(1, Math.ceil(stats.estimatedDurationMinutes / 10));

    // Crew
    const crewSize = level === "studio" ? 80 : level === "mid" ? 25 : 8;
    const crewCost = (shootDays + prepDays) * crewSize * rates.dayRate.crew;

    // Cast
    const castSize = characters.length || 3;
    const castDays = shootDays * rates.perSceneFactor;
    const castCost = castDays * castSize * rates.dayRate.cast * rates.castMultiplier;

    // Locations
    const locationCount = new Set(scenes.map((s) => s.location)).size || 1;
    const locationCost = (shootDays + 1) * locationCount * rates.dayRate.location * rates.locationMultiplier;

    // Equipment
    const equipmentCost = (shootDays + prepDays + wrapDays) * rates.dayRate.equipment;

    // Catering & Craft
    const peoplePerDay = crewSize + castSize;
    const cateringCost = shootDays * peoplePerDay * rates.dayRate.catering * 2; // 2 meals/day

    // Post-Production
    const postCost = postWeeks * rates.dayRate.post;

    // Subtotals
    const subtotal = crewCost + castCost + locationCost + equipmentCost + cateringCost + postCost;
    const genreAdjusted = Math.round(subtotal * genreMult);
    const contingency = Math.round(genreAdjusted * rates.contingency);
    const total = genreAdjusted + contingency;

    // Budget breakdown
    const breakdown = {
      crew: { amount: Math.round(crewCost), pct: ((crewCost / subtotal) * 100).toFixed(1), detail: `${crewSize} crew × ${shootDays + prepDays} days` },
      cast: { amount: Math.round(castCost), pct: ((castCost / subtotal) * 100).toFixed(1), detail: `${castSize} cast × ~${castDays.toFixed(1)} days` },
      locations: { amount: Math.round(locationCost), pct: ((locationCost / subtotal) * 100).toFixed(1), detail: `${locationCount} locations × ${shootDays} days` },
      equipment: { amount: Math.round(equipmentCost), pct: ((equipmentCost / subtotal) * 100).toFixed(1), detail: `${shootDays + prepDays + wrapDays} days` },
      catering: { amount: Math.round(cateringCost), pct: ((cateringCost / subtotal) * 100).toFixed(1), detail: `${peoplePerDay} people × ${shootDays} days` },
      post: { amount: Math.round(postCost), pct: ((postCost / subtotal) * 100).toFixed(1), detail: `${postWeeks} weeks` },
    };

    return {
      level: rates.label,
      genre,
      genreMultiplier: genreMult,
      shootDays,
      prepDays,
      wrapDays,
      postWeeks,
      crewSize,
      castSize,
      locationCount,
      totalShots,
      breakdown,
      subtotal: Math.round(subtotal),
      genreAdjusted,
      contingency,
      total,
      disclaimer: "This is an automated estimate based on industry heuristics. Actual costs vary significantly by region, crew rates, and production requirements. Consult a line producer for accurate budgeting.",
    };
  }

  /**
   * Format budget as Markdown.
   */
  static toMarkdown(result) {
    let md = `# Production Budget Estimate\n\n`;
    md += `**Level:** ${result.level}\n`;
    md += `**Genre:** ${result.genre} (${result.genreMultiplier}x multiplier)\n\n`;
    md += `## Production Summary\n\n`;
    md += `| Metric | Value |\n|--------|-------|\n`;
    md += `| Shoot Days | ${result.shootDays} |\n`;
    md += `| Prep Days | ${result.prepDays} |\n`;
    md += `| Wrap Days | ${result.wrapDays} |\n`;
    md += `| Post Weeks | ${result.postWeeks} |\n`;
    md += `| Crew Size | ${result.crewSize} |\n`;
    md += `| Cast Size | ${result.castSize} |\n`;
    md += `| Locations | ${result.locationCount} |\n`;
    md += `| Total Shots | ${result.totalShots} |\n\n`;
    md += `## Cost Breakdown\n\n`;
    md += `| Category | Amount | % | Detail |\n|----------|--------|---|--------|\n`;
    Object.entries(result.breakdown).forEach(([cat, b]) => {
      md += `| ${cat} | $${b.amount.toLocaleString()} | ${b.pct}% | ${b.detail} |\n`;
    });
    md += `\n| **Subtotal** | **$${result.subtotal.toLocaleString()}** | | |\n`;
    md += `| Genre Adjustment | $${(result.genreAdjusted - result.subtotal).toLocaleString()} | ${result.genreMultiplier}x | |\n`;
    md += `| Contingency (${(RATES[Object.keys(RATES).find(k => RATES[k].label === result.level) || "indie"]?.contingency || 0.15) * 100}%) | $${result.contingency.toLocaleString()} | | |\n`;
    md += `\n## **Estimated Total: $${result.total.toLocaleString()}**\n\n`;
    md += `---\n*${result.disclaimer}*\n`;
    return md;
  }

  /**
   * Format budget as CSV.
   */
  static toCSV(result) {
    let csv = "Category,Amount,Percentage,Detail\n";
    Object.entries(result.breakdown).forEach(([cat, b]) => {
      csv += `${cat},${b.amount},${b.pct}%,"${b.detail}"\n`;
    });
    csv += `Subtotal,${result.subtotal},,\n`;
    csv += `Genre Adjustment,${result.genreAdjusted - result.subtotal},${result.genreMultiplier}x,\n`;
    csv += `Contingency,${result.contingency},,\n`;
    csv += `TOTAL,${result.total},,\n`;
    return csv;
  }
}

module.exports = { BudgetEstimator, RATES };
