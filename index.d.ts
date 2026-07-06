// TypeScript types for flow-prompt-studio
// Minimum TypeScript version: 4.5+

/* ─── Base Types ─── */

export interface UploadResult {
  success: boolean;
  filename: string;
  char_count: number;
  scene_count: number;
  scenes: SceneMeta[];
  error?: string;
}

export interface SceneMeta {
  scene_id: string;
  [key: string]: any;
}

export interface CharacterResult {
  name: string;
  count: number;
  [key: string]: any;
}

export interface LocationResult {
  name: string;
  count: number;
  source: string;
  [key: string]: any;
}

export interface PropResult {
  name: string;
  count: number;
  [key: string]: any;
}

export interface AnalysisResult {
  characters: CharacterResult[];
  locations: LocationResult[];
  props: PropResult[];
  [key: string]: any;
}

export interface StatsResult {
  scene_count: number;
  char_count: number;
  estimated_segments: number;
  [key: string]: any;
}

export interface StyleSettings {
  visual_style?: string;
  camera_language?: string;
  [key: string]: any;
}

export interface StyleDetectionResult {
  detected: boolean;
  mode?: string;
  message?: string;
  settings: StyleSettings;
}

export interface BundleResult {
  shot_rows: ShotRow[];
  asset_plan?: AssetPlan;
  repair_markdown?: string;
}

export interface ShotRow {
  "Shot Type"?: string;
  "Shot Türü"?: string;
  [key: string]: any;
}

export interface AssetCollection {
  [key: string]: any;
}

export interface AssetPlan {
  collections?: AssetCollection[];
  [key: string]: any;
}

export interface GenerationResult {
  success?: boolean;
  manual?: boolean;
  model_used?: string;
  markdown?: string;
  master_prompt?: string;
  error?: string;
}

export interface RepairResult {
  count?: number;
  markdown?: string;
  repair?: {
    flow_agent_prompt?: string;
    retry_strategy?: string;
    [key: string]: any;
  };
  [key: string]: any;
}

export interface ValidationResult {
  issues: ValidationIssue[];
  summary: ValidationSummary;
}

export interface ValidationIssue {
  severity: "critical" | "warning" | "info";
  message: string;
  [key: string]: any;
}

export interface ValidationSummary {
  critical: number;
  warning: number;
  info: number;
}

export interface ConfigResult {
  has_api_key: boolean;
  fast_model: string;
  pro_model: string;
  fallback_model: string;
}

export interface StyleConfig {
  [key: string]: string;
}

export interface ErrorTypesResult {
  error_types: string[];
}

export interface ContinuityResult {
  [key: string]: any;
}

export interface MarkdownResult {
  markdown_text?: string;
  [key: string]: any;
}

export interface PingResult {
  reachable: boolean;
  error?: string;
}

export interface EstimateResult {
  filename: string;
  fileSizeKb: number;
  estimatedScenes: number;
  estimatedShots: number;
  estimatedDurationMinutes: number;
}

/* ─── Workflow Options ─── */

export interface WorkflowOptions {
  /** Generation scope (default: "full_pack") */
  scope?: string;
  /** Ultra image variation mode (default: false) */
  ultra?: boolean;
  /** Run AI generation step (default: true) */
  generate?: boolean;
  /** Export formats */
  exportFormats?: string[];
  /** Progress callback */
  onProgress?: (step: string, message: string) => void;
}

export interface WorkflowResult {
  upload: UploadResult;
  analysis: AnalysisResult;
  stats: StatsResult;
  style: StyleDetectionResult;
  bundle: BundleResult;
  generate?: GenerationResult;
  validation: ValidationResult;
  exports: Record<string, string>;
}

/* ─── Client Options ─── */

export interface ClientRequestOptions {
  headers?: Record<string, string>;
  body?: any;
  method?: string;
  signal?: AbortSignal;
  _skipCache?: boolean;
}

/* ─── Retry / Error ─── */

export interface RetryConfig {
  /** Maximum retry attempts (default: 3) */
  maxRetries: number;
  /** Initial delay in ms (default: 1000) */
  initialDelayMs: number;
  /** Exponential backoff multiplier (default: 2) */
  backoffMultiplier: number;
  /** Maximum delay in ms (default: 30000) */
  maxDelayMs: number;
  /** Request timeout in ms (default: 60000) */
  timeoutMs: number;
  /** HTTP status codes that trigger a retry (default: [429, 502, 503, 504]) */
  retryableStatuses: number[];
}

/* ─── FlowPromptStudioClient ─── */

export class FlowPromptStudioClient {
  constructor(baseUrl?: string);

  baseUrl: string;
  retryConfig: RetryConfig;

  /** Check if backend is reachable */
  ping(): Promise<PingResult>;

  /** Estimate shot count and duration from a screenplay file (local, no upload) */
  estimate(filePath: string): Promise<EstimateResult>;

  /** Clear the in-memory request cache */
  clearCache(): void;

  /** Core HTTP request with retry and timeout */
  _request(path: string, options?: ClientRequestOptions): Promise<any>;

  /* Session */
  getSession(): Promise<any>;
  resetSession(): Promise<any>;

  /* Screenplay */
  uploadScreenplay(filePath: string): Promise<UploadResult>;
  setScreenplayText(text: string): Promise<any>;
  getScenes(): Promise<any>;
  getStats(): Promise<StatsResult>;
  getAnalysis(): Promise<AnalysisResult>;

  /* Style */
  detectStyle(): Promise<StyleDetectionResult>;
  getStyle(): Promise<StyleConfig>;
  updateStyle(data: Record<string, any>): Promise<any>;

  /* Generation */
  generate(scope?: string, forceUltra?: boolean, manualMode?: boolean): Promise<GenerationResult>;
  getMasterPrompt(scope?: string, forceUltra?: boolean): Promise<any>;
  submitManualOutput(output: string): Promise<any>;
  getLogs(): Promise<any>;
  getGenerationStatus(): Promise<any>;

  /* Production */
  getCoverage(refresh?: boolean): Promise<any>;
  getAssetPlan(refresh?: boolean): Promise<any>;
  getBundle(refresh?: boolean): Promise<BundleResult>;
  getProjectMap(): Promise<any>;

  /* Repair */
  getErrorTypes(): Promise<ErrorTypesResult>;
  generateRepair(
    errorType: string,
    sceneId?: string,
    segmentId?: string,
    problemDescription?: string
  ): Promise<RepairResult>;
  generateAllRepairs(): Promise<RepairResult>;

  /* Preview */
  getMarkdown(): Promise<MarkdownResult>;
  updateMarkdown(text: string): Promise<any>;
  getFlowCopyReady(): Promise<string>;
  checkContinuity(): Promise<ContinuityResult>;

  /* Validation */
  validate(markdownText?: string): Promise<ValidationResult>;

  /* Export */
  getExportUrl(format: string): string;

  /* Config */
  getConfig(): Promise<ConfigResult>;
}

/* ─── FlowPromptStudio ─── */

export class FlowPromptStudio {
  constructor(baseUrl?: string);

  client: FlowPromptStudioClient;
  readonly version: string;

  /** Check if backend is reachable */
  ping(): Promise<PingResult>;

  /** Full automated 7-step workflow */
  workflow(screenplayPath: string, options?: WorkflowOptions): Promise<WorkflowResult>;

  /** Workflow with built-in CLI spinner */
  workflowProgressive(screenplayPath: string, options?: WorkflowOptions): Promise<WorkflowResult>;

  /** Estimate shots/duration without uploading (dry-run) */
  estimate(filePath: string): Promise<EstimateResult>;

  /* Individual API wrappers */
  upload(filePath: string): Promise<UploadResult>;
  analyze(): Promise<{ analysis: AnalysisResult; stats: StatsResult }>;
  detectStyle(): Promise<StyleDetectionResult>;
  generate(scope?: string, ultra?: boolean): Promise<GenerationResult>;
  getCoverage(refresh?: boolean): Promise<BundleResult>;
  repair(errorType: string, sceneId?: string, problem?: string): Promise<RepairResult>;
  repairAll(): Promise<RepairResult>;
  validate(): Promise<ValidationResult>;
  getExportUrl(format: string): string;
  getConfig(): Promise<ConfigResult>;
}
