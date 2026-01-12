# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [0.5.0] - 2026-01-12

### Added
- **Type coercion for LLM output** ([#71](https://github.com/ordis-dev/ordis/issues/71))
  - Automatic coercion of string numbers ("123" → 123)
  - String boolean coercion ("true"/"yes"/"1" → true)
  - Null-like string handling ("null"/"none"/"n/a" → null for optional fields)
  - Coercion warnings in pipeline results for transparency
  - New exports: `coerceValue()`, `coerceExtractedData()`, `coerceEnumValue()`, `coerceDateValue()`

- **Enum case-insensitive coercion**
  - "Series B" → "series_b" automatic normalization
  - Space and hyphen to underscore conversion
  - Case-insensitive matching against schema enum values

- **Date format coercion**
  - US format: "11/20/24" or "11/20/2024" → "2024-11-20"
  - European format: "20-11-2024" or "20.11.2024" → "2024-11-20"
  - Written format: "January 15, 2024" or "15 Jan 2024" → "2024-01-15"
  - ISO with time stripping: "2024-01-15T10:00:00" → "2024-01-15"
  - Requires `format: "date"` or `format: "date-time"` in schema

- **Array of objects support** ([#70](https://github.com/ordis-dev/ordis/issues/70))
  - New field type: `type: "array"` with `items: { type: "object", properties: {...} }`
  - New field type: `type: "object"` with `properties: {...}` for nested objects
  - Recursive validation with proper error paths (e.g., "items[1].price")
  - Recursive coercion for nested field values
  - Prompt builder generates nested schema descriptions for LLMs

- **Ollama runtime options**
  - `ollamaOptions.num_ctx` for dynamic context window sizing
  - `ollamaOptions.num_gpu` for GPU layer control
  - Pass Ollama-specific parameters without custom Modelfiles

- **New example**: `08-funding-rounds-complex` demonstrating array-of-objects extraction

### Changed
- Prompt builder adds array-specific instructions when schema contains array fields
- Benchmark now uses deep equality for array/object comparisons
- Benchmark displays full JSON for array field comparisons (instead of "[object Object]")

### Fixed
- Array fields now properly validated with nested object structure
- Coercion applied recursively to array items and nested objects

## [0.4.1] - 2026-01-12

### Fixed
- `maxContextTokens` now works as a top-level parameter in `extract()` ([#67](https://github.com/ordis-dev/ordis/issues/67))
  - Previously, the parameter was ignored unless passed inside `llmConfig`
  - Top-level `maxContextTokens` now takes precedence over `llmConfig.maxContextTokens`
  - Both usage patterns are supported for backwards compatibility

## [0.4.0] - 2026-01-12

### Added
- **User-friendly error messages** ([#63](https://github.com/ordis-dev/ordis/issues/63))
  - Emoji indicators (❌ for errors, 💡 for tips, ℹ️ for details) for quick error scanning
  - Expected vs. actual value comparison in validation errors
  - Actionable suggestions for common error patterns
  - Service-specific troubleshooting tips (Ollama, LM Studio, OpenAI, etc.)
  - Context-aware error formatting with model and URL information
  - File system error handling (ENOENT, EACCES) with helpful messages

- **Debug mode enhancements**
  - `--debug` flag now shows full LLM request and response
  - Token usage breakdown (system prompt, input, output reservation)
  - Complete system and user prompts visible in debug output
  - LLM response metadata including token counts
  - Debug flag propagated to LLMConfig for programmatic usage

- **Error formatter module**
  - `formatValidationError()` - Format field-level validation errors
  - `formatLLMError()` - Format LLM service errors with troubleshooting
  - `formatValidationErrors()` - Format multiple validation errors
  - `formatError()` - Universal error formatter
  - Exported from main package for programmatic usage

### Changed
- ValidationError interface now includes `expected` and `actual` fields
- ValidationError `field` is now optional for errors without field context
- Pipeline preserves full error objects instead of just messages
- Error details in pipeline results include original error for better formatting

### Fixed
- Token limit exceeded errors now show service-specific suggestions
- Network connection errors display helpful troubleshooting steps
- Rate limit errors include retry guidance
- Invalid JSON responses from LLMs are clearly explained

## [0.1.0] - 2025-12-18

### Added
- Initial release of @ordis-dev/ordis
- Schema-first extraction engine with validation
- OpenAI-compatible LLM client support (Ollama, LM Studio, OpenRouter, etc.)
- CLI tool for processing text files with JSON schemas
- Programmatic API for library usage
- TypeScript support with full type definitions
- Confidence scoring for extracted data
- Token budget management
- Comprehensive test suite
- Benchmark suite for model comparison
- Example schemas and input files

[Unreleased]: https://github.com/ordis-dev/ordis/compare/v0.5.0...HEAD
[0.5.0]: https://github.com/ordis-dev/ordis/compare/v0.4.1...v0.5.0
[0.4.1]: https://github.com/ordis-dev/ordis/compare/v0.4.0...v0.4.1
[0.4.0]: https://github.com/ordis-dev/ordis/compare/v0.1.0...v0.4.0
[0.1.0]: https://github.com/ordis-dev/ordis/releases/tag/v0.1.0
