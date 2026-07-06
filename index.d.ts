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
  "Shot Türü": string;
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

/* ─── Workflow Options ─── */

export interface WorkflowOptions {
  /** Üretim kapsamı (default: "full_pack") */
  scope?: string;
  /** Ultra görsel varyasyon modu (default: false) */
  ultra?: boolean;
  /** AI üretimi adımı çalışsın mı (default: true) */
  generate?: boolean;
  /** Dışa aktarma formatları */
  exportFormats?: string[];
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
}

/* ─── Retry / Error ─── */

export interface RetryConfig {
  /** Maksimum deneme sayısı (default: 3) */
  maxRetries: number;
  /** İlk denemede bekleme süresi ms (default: 1000) */
  initialDelayMs: number;
  /** Her denemede katlanarak artan bekleme çarpanı (default: 2) */
  backoffMultiplier: number;
  /** Maksimum bekleme süresi ms (default: 30000) */
  maxDelayMs: number;
  /** İstek timeout ms (default: 60000) */
  timeoutMs: number;
  /** Hangi HTTP durum kodlarında retry yapılsın (default: [429, 502, 503, 504]) */
  retryableStatuses: number[];
}

/* ─── FlowPromptStudioClient ─── */

export class FlowPromptStudioClient {
  constructor(baseUrl?: string);

  baseUrl: string;
  retryConfig: RetryConfig;

  /** Özel istek atma metodu — retry ve timeout uygular */
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

  /** Tam otomatik 7 adımlı workflow */
  workflow(screenplayPath: string, options?: WorkflowOptions): Promise<WorkflowResult>;

  /* Bireysel API wrapper'ları */
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
