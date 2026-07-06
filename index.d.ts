// TypeScript types for flow-prompt-studio v2.0
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
  toMarkdown(result: CoverageResult): string;
  toCSV(result: CoverageResult): string;
  toStdout(data: any): void;
  version: string;
}

export const fps: FpsAPI;

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
  shotPlanToMarkdown(result: CoverageResult): string;
  shotPlanToCSV(result: CoverageResult): string;
  shotPlanToHTML(result: CoverageResult): string;
  workflowLocal(screenplayPath: string, genre?: string): { parse: ParseResult; coverage: CoverageResult };

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
