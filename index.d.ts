// TypeScript types for flow-prompt-studio v3.0
// Minimum TypeScript version: 4.5+

/* ─── Screenplay Parser ─── */

export interface SceneResult {
  index: number;
  number: string;
  heading: string;
  location: string;
  lineNumber: number;
  dialogueCount: number;
  characters: string[];
  content: string;
}

export interface CharacterResult {
  name: string;
  count: number;
}

export interface ParseStats {
  filename: string;
  totalLines: number;
  totalScenes: number;
  totalCharacters: number;
  totalDialogueLines: number;
  estimatedPages: number;
  estimatedDurationMinutes: number;
  speakingCharacters: number;
}

export interface ParseResult {
  scenes: SceneResult[];
  characters: CharacterResult[];
  stats: ParseStats;
}

export class ScreenplayParser {
  static parse(filePath: string): ParseResult;
  static parseText(text: string, label?: string): ParseResult;
  /** @internal */ static _parseFdx(filePath: string): string;
  /** @internal */ static _parseLines(lines: string[], filename: string): ParseResult;
}

/* ─── Shot Coverage Generator ─── */

export interface ShotTypeInfo {
  name: string;
  desc: string;
  typicalDuration: string;
}

export interface GenreInfo {
  key: string;
  name: string;
  description: string;
  shotsPerScene: number;
  distribution: Record<string, number>;
  cameraNotes: string[];
  equipment: string[];
  pacing: string;
}

export interface ShotRow {
  "Shot #": number;
  "Scene": string;
  "Scene Heading": string;
  "Shot Type": string;
  "Shot Name": string;
  "Description": string;
  "Typical Duration": string;
  "Characters": string;
}

export interface CoverageResult {
  genre: GenreInfo;
  sceneCount: number;
  totalShots: number;
  averageShotsPerScene: string;
  estimatedDurationMinutes: number;
  shotRows: ShotRow[];
}

export class CoverageGenerator {
  static listGenres(): string[];
  static getGenre(genre: string): GenreInfo;
  static generate(parseResult: ParseResult, genre?: string): CoverageResult;
  static generateFromSceneCount(sceneCount: number, genre?: string): CoverageResult;
  static toMarkdown(result: CoverageResult): string;
  static toCSV(result: CoverageResult): string;
  /** @internal */ static _pickShotTypes(distribution: Record<string, number>, total: number): string[];
}

/* ─── File Exporter ─── */

export class FileExporter {
  static exportParseResult(result: ParseResult, format: "json" | "csv" | "markdown", outputDir: string): string;
  static exportShotPlan(result: CoverageResult, format: "json" | "csv" | "markdown" | "html", outputDir: string): string;
  static toStdout(data: any): void;
  /** @internal */ static _shotPlanToHtml(result: CoverageResult): string;
  /** @internal */ static _ensureDir(dir: string): void;
  /** @internal */ static _writeFile(filePath: string, content: string): string;
}

/* ─── Google Flow / Veo Production Pack ─── */

export type ProductionPackMode = "standard" | "director";
export type VeoDuration = 4 | 6 | 8;

export interface ProductionPackOptions {
  title?: string;
  mode?: ProductionPackMode;
  shotsPerScene?: number | string;
  defaultDuration?: VeoDuration | number | string;
  learning?: ProductionLearning;
  learningPath?: string;
  projectDir?: string;
}

export interface ProductionFeedbackEntry {
  id: string;
  type: "approved" | "rejected";
  scope: string;
  shot: string | null;
  note: string;
  tags: string[];
  createdAt: string | null;
}

export interface ProductionLearning {
  version: number;
  approved: ProductionFeedbackEntry[];
  rejected: ProductionFeedbackEntry[];
  updatedAt: string | null;
}

export interface ProductionFeedbackInput {
  type: "approved" | "rejected";
  note: string;
  shot?: string | null;
  scope?: string;
  tags?: string[] | string;
  id?: string;
  createdAt?: string;
}

export interface ProductionShot {
  number: number;
  sceneNumber: string;
  sceneHeading: string;
  sceneLocation: string;
  sceneShotIndex: number;
  sceneShotCount: number;
  durationSeconds: VeoDuration;
  intent: string;
  mode: ProductionPackMode;
  risks: string[];
  references: string[];
  flowToolAdvice: string;
  productionDetails: Record<string, string>;
  startImagePrompt: string;
  endImagePrompt: string;
  videoPrompt: string;
  qualityChecklist: string[];
}

export interface ProductionPack {
  title: string;
  slug: string;
  mode: ProductionPackMode;
  platform: string;
  validDurations: VeoDuration[];
  source: string;
  sceneCount: number;
  shotCount: number;
  continuity: {
    characters: string[];
    locations: string[];
    visualRules: string[];
    approvedDirections: ProductionFeedbackEntry[];
    rejectedDirections: ProductionFeedbackEntry[];
  };
  learning: ProductionLearning;
  shots: ProductionShot[];
}

export interface ExportedProductionPack extends ProductionPack {
  outputDir: string;
  files: string[];
}

export class ProductionPackGenerator {
  static readonly validDurations: VeoDuration[];
  static create(parseResult: ParseResult, options?: ProductionPackOptions): ProductionPack;
  static export(parseResult: ParseResult, outputDir: string, options?: ProductionPackOptions): ExportedProductionPack;
  static loadLearning(inputPath?: string): ProductionLearning;
  static recordFeedback(projectDir: string, feedback: ProductionFeedbackInput): { learningPath: string; learning: ProductionLearning; entry: ProductionFeedbackEntry };
  static toIndexMarkdown(pack: ProductionPack): string;
  static toContinuityMarkdown(pack: ProductionPack): string;
  static toLearningMarkdown(learning: ProductionLearning, pack?: Partial<ProductionPack>): string;
  static toShotMarkdown(shot: ProductionShot, pack: ProductionPack): string;
}

/* ─── Source Ingest ─── */

export interface IngestOptions {
  title?: string;
  pdftotextPath?: string;
}

export interface IngestResult {
  title: string;
  source: string;
  outputDir: string;
  normalizedPath: string;
  manual: boolean;
  parseResult: ParseResult | null;
  files: string[];
  message?: string;
}

export class IngestHelper {
  static ingest(filePath: string, outputDir?: string, options?: IngestOptions): IngestResult;
}

/* ─── AI Prompt Generation ─── */

export type AIProvider =
  | "deepseek"
  | "openai"
  | "anthropic"
  | "gemini"
  | "mistral"
  | "groq"
  | "xai"
  | "cohere"
  | "perplexity"
  | "together"
  | "openrouter"
  | "custom";
export type PromptScope = "full_pack" | "scene_breakdown" | "character_bible" | "ultra_image_variation";

export interface AIGenerateOptions {
  provider?: AIProvider;
  apiKey?: string;
  model?: string;
  baseUrl?: string;
  temperature?: number;
  maxTokens?: number;
  ultra?: boolean;
}

export interface AIProviderStatus {
  key: AIProvider;
  name: string;
  model: string;
  configured: boolean;
  envVar: string;
  envVars: string[];
  requiresBaseUrl: boolean;
  baseUrlConfigured: boolean;
}

export interface AIGenerateResult {
  success: boolean;
  markdown: string;
  model: string;
  provider: AIProvider;
  providerName: string;
  scope: PromptScope;
}

export class AIPromptGenerator {
  constructor(options?: AIGenerateOptions);
  provider: AIProvider;
  apiKey: string;
  model: string | null;
  baseUrl: string | null;
  temperature: number;
  maxTokens: number;
  static resolveApiKey(provider: AIProvider): string | null;
  static resolveBaseUrl(provider: AIProvider): string | null;
  static resolveModel(provider: AIProvider): string | null;
  static getProvider(provider: AIProvider): any;
  static getProviderEnvVars(provider: AIProvider): string[];
  static getProvidersStatus(): AIProviderStatus[];
  generate(parseResult: ParseResult, coverageResult: CoverageResult, scope?: PromptScope, options?: AIGenerateOptions): Promise<AIGenerateResult>;
}

/* ─── Storyboard, ScreenJSON, Call Sheet, Budget, Project, Conversion ─── */

export interface StoryboardOptions {
  style?: string;
  width?: number;
  height?: number;
  provider?: string;
  concurrency?: number;
  limit?: number;
  scenes?: string;
}

export interface StoryboardImage {
  index: number;
  shot: ShotRow;
  filePath?: string | null;
  promptFile?: string;
  prompt: string;
  cached: boolean;
  error?: string;
}

export interface StoryboardResult {
  images: StoryboardImage[];
  html: string;
  dir: string;
  totalGenerated: number;
  totalRequested: number;
}

export class StoryboardGenerator {
  constructor(options?: StoryboardOptions);
  static listStyles(): { key: string; description: string }[];
  generate(coverageResult: CoverageResult, outputDir: string, options?: StoryboardOptions): Promise<StoryboardResult>;
}

export class ScreenJSONConverter {
  static convert(parseResult: ParseResult, options?: Record<string, any>): any;
  static toJSON(parseResult: ParseResult, options?: Record<string, any>): string;
  static toFile(parseResult: ParseResult, outputPath: string, options?: Record<string, any>): string;
}

export class CallSheetGenerator {
  constructor(parseResult: ParseResult, coverageResult?: CoverageResult, options?: Record<string, any>);
  generate(options?: Record<string, any>): string;
}

export interface BudgetResult {
  level: string;
  genre: string;
  genreMultiplier: number;
  shootDays: number;
  prepDays: number;
  wrapDays: number;
  postWeeks: number;
  crewSize: number;
  castSize: number;
  locationCount: number;
  totalShots: number;
  breakdown: Record<string, { amount: number; pct: string; detail: string }>;
  subtotal: number;
  genreAdjusted: number;
  contingency: number;
  total: number;
  disclaimer: string;
}

export class BudgetEstimator {
  static estimate(parseResult: ParseResult, coverageResult?: CoverageResult, options?: { level?: "indie" | "mid" | "studio"; genre?: string }): BudgetResult;
  static toMarkdown(result: BudgetResult): string;
  static toCSV(result: BudgetResult): string;
}

export class ProjectManager {
  constructor(projectDir?: string);
}

export class FormatConverter {
  static convert(inputPath: string, outputPath: string, toFormat?: string): string;
  static listFormats(): { ext: string; name: string; desc: string }[];
}

export class ScriptAnalyzer {
  static analyze(parseResult: ParseResult): any;
}

/* ─── Convenience Top-Level API (no class instance needed) ─── */

export interface FpsAPI {
  parse(filePath: string): ParseResult;
  parseText(text: string, label?: string): ParseResult;
  cover(parseResult: ParseResult, genre?: string): CoverageResult;
  coverFromSceneCount(count: number, genre?: string): CoverageResult;
  listGenres(): string[];
  getGenre(genre: string): GenreInfo;
  exportParseResult(result: ParseResult, format: string, outputDir: string): string;
  exportShotPlan(result: CoverageResult, format: string, outputDir: string): string;
  createProductionPack(result: ParseResult, options?: ProductionPackOptions): ProductionPack;
  exportProductionPack(result: ParseResult, outputDir: string, options?: ProductionPackOptions): ExportedProductionPack;
  recordProductionFeedback(projectDir: string, feedback: ProductionFeedbackInput): { learningPath: string; learning: ProductionLearning; entry: ProductionFeedbackEntry };
  loadProductionLearning(inputPath?: string): ProductionLearning;
  ingest(filePath: string, outputDir?: string, options?: IngestOptions): IngestResult;
  toMarkdown(result: CoverageResult): string;
  toCSV(result: CoverageResult): string;
  toStdout(data: any): void;
  generate(parseResult: ParseResult, coverageResult: CoverageResult, scope?: PromptScope, options?: AIGenerateOptions): Promise<AIGenerateResult>;
  getProvidersStatus(): AIProviderStatus[];
  storyboard(coverageResult: CoverageResult, outputDir: string, options?: StoryboardOptions): Promise<StoryboardResult>;
  listStoryStyles(): { key: string; description: string }[];
  toScreenJSON(parseResult: ParseResult, options?: Record<string, any>): any;
  exportScreenJSON(parseResult: ParseResult, outputPath: string, options?: Record<string, any>): string;
  version: string;
}

export const fps: FpsAPI;
export const version: string;

/* ─── Backend (optional) ─── */

export interface UploadResult {
  success: boolean;
  filename: string;
  char_count: number;
  scene_count: number;
  scenes: { scene_id: string; [key: string]: any }[];
  error?: string;
}

export interface WorkflowOptions {
  scope?: string;
  ultra?: boolean;
  generate?: boolean;
  exportFormats?: string[];
  onProgress?: (step: string, message: string) => void;
}

export interface WorkflowResult {
  upload: UploadResult;
  analysis: any;
  stats: any;
  style: any;
  bundle: any;
  generate?: any;
  validation: any;
  exports: Record<string, string>;
}

export interface PingResult { reachable: boolean; error?: string; }
export interface EstimateResult { filename: string; fileSizeKb: number; estimatedScenes: number; estimatedShots: number; estimatedDurationMinutes: number; }
export interface RetryConfig { maxRetries: number; initialDelayMs: number; backoffMultiplier: number; maxDelayMs: number; timeoutMs: number; retryableStatuses: number[]; }

export class FlowPromptStudioClient {
  constructor(baseUrl?: string);
  baseUrl: string;
  retryConfig: RetryConfig;
  ping(): Promise<PingResult>;
  estimate(filePath: string): Promise<EstimateResult>;
  uploadScreenplay(filePath: string): Promise<UploadResult>;
  getAnalysis(): Promise<any>;
  getStats(): Promise<any>;
  detectStyle(): Promise<any>;
  generate(scope?: string, forceUltra?: boolean, manualMode?: boolean): Promise<any>;
  getBundle(refresh?: boolean): Promise<any>;
  generateRepair(errorType: string, sceneId?: string, segmentId?: string, problemDescription?: string): Promise<any>;
  generateAllRepairs(): Promise<any>;
  validate(markdownText?: string): Promise<any>;
  getExportUrl(format: string): string;
  getConfig(): Promise<any>;
  clearCache(): void;
}

export class FlowPromptStudio {
  constructor(baseUrl?: string);
  client: FlowPromptStudioClient;
  readonly version: string;

  /* Offline API */
  parse(filePath: string): ParseResult;
  parseText(text: string, label?: string): ParseResult;
  cover(parseResult: ParseResult, genre?: string): CoverageResult;
  coverFromSceneCount(sceneCount: number, genre?: string): CoverageResult;
  listGenres(): string[];
  getGenre(genre: string): GenreInfo;
  exportParseResult(result: ParseResult, format: string, outputDir: string): string;
  exportShotPlan(result: CoverageResult, format: string, outputDir: string): string;
  createProductionPack(result: ParseResult, options?: ProductionPackOptions): ProductionPack;
  exportProductionPack(result: ParseResult, outputDir: string, options?: ProductionPackOptions): ExportedProductionPack;
  recordProductionFeedback(projectDir: string, feedback: ProductionFeedbackInput): { learningPath: string; learning: ProductionLearning; entry: ProductionFeedbackEntry };
  loadProductionLearning(inputPath?: string): ProductionLearning;
  ingest(filePath: string, outputDir?: string, options?: IngestOptions): IngestResult;
  shotPlanToMarkdown(result: CoverageResult): string;
  shotPlanToCSV(result: CoverageResult): string;
  shotPlanToHTML(result: CoverageResult): string;
  workflowLocal(screenplayPath: string, genre?: string): { parse: ParseResult; coverage: CoverageResult };
  generateAI(parseResult: ParseResult, coverageResult: CoverageResult, scope?: PromptScope, options?: AIGenerateOptions): Promise<AIGenerateResult>;
  generateStoryboard(coverageResult: CoverageResult, outputDir: string, options?: StoryboardOptions): Promise<StoryboardResult>;
  toScreenJSON(parseResult: ParseResult, options?: Record<string, any>): any;
  exportScreenJSON(parseResult: ParseResult, outputPath: string, options?: Record<string, any>): string;
  static getProvidersStatus(): AIProviderStatus[];
  static listStoryStyles(): { key: string; description: string }[];

  /* Backend API (optional) */
  ping(): Promise<PingResult>;
  workflow(screenplayPath: string, options?: WorkflowOptions): Promise<WorkflowResult>;
  workflowProgressive(screenplayPath: string, options?: WorkflowOptions): Promise<WorkflowResult>;
  upload(filePath: string): Promise<UploadResult>;
  analyze(): Promise<{ analysis: any; stats: any }>;
  detectStyle(): Promise<any>;
  generate(scope?: string, ultra?: boolean): Promise<any>;
  getCoverage(refresh?: boolean): Promise<any>;
  estimate(filePath: string): Promise<EstimateResult>;
  repair(errorType: string, sceneId?: string, problem?: string): Promise<any>;
  repairAll(): Promise<any>;
  validate(): Promise<any>;
  getExportUrl(format: string): string;
  getConfig(): Promise<any>;
}
