# Changelog

All notable changes to Flow Prompt Studio.

## [1.1.0] — 2026-07-06

### Added
- **TypeScript type definitions** (`index.d.ts`) — full type coverage for all classes and methods
- **Retry mechanism** — exponential backoff, configurable timeout, Retry-After header support
- **Spinner/progress** — visual feedback during long-running operations
- **`fps estimate <file>`** — dry-run estimation without uploading (scene count, shot count, duration)
- **`fps init`** — scaffold a `.fpsrc` project configuration file
- **`fps doctor`** — system health check and troubleshooting guide
- **`fps workflow --dry-run`** — estimate before running full workflow
- **Connection ping** — `client.ping()` and graceful error messages for backend downtime
- **In-memory cache** — GET requests cached for 1 minute, with `clearCache()` method
- **Workflow progress callbacks** — `onProgress` option for programmatic progress tracking
- **`workflowProgressive()`** — workflow with built-in spinner (for CLI use)
- **English localization** — all comments, CLI output, and documentation converted to English
- **Unit tests** — 41 tests across 3 files (client, index, utils) using Node.js native test runner
- **GitHub Actions CI** — automated tests on push/PR

### Changed
- **Version now read dynamically** from `package.json` (no more hardcoded versions)
- **Better error messages** — connection failures include troubleshooting tips
- **`withErrorHandler` wrapper** — uniform CLI error handling

### Fixed
- Retry exhaustion now correctly throws aggregate error message
- `require("fs")` calls moved to top level in client.js

## [1.0.0] — Initial release

- CLI with 12 commands
- Programmatic API (`FlowPromptStudio` class)
- Backend client with full API coverage
- 7-step automated workflow
- Claude Code skill integration
- 14 export formats
