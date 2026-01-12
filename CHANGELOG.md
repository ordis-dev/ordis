# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/ordis-dev/ordis/compare/v0.4.0...HEAD
[0.4.0]: https://github.com/ordis-dev/ordis/compare/v0.1.0...v0.4.0
[0.1.0]: https://github.com/ordis-dev/ordis/releases/tag/v0.1.0
