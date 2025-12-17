/**
 * Ordis CLI - Public API
 * Main entry point for programmatic usage
 */

// Core pipeline exports
export { ExtractionPipeline, extract } from './core/pipeline.js';
export { validateExtractedData } from './core/validator.js';
export { PipelineError, PipelineErrorCodes } from './core/errors.js';
export type {
    PipelineConfig,
    ExtractionRequest,
    PipelineResult,
    StepResult,
} from './core/types.js';

// Schema exports
export { loadSchema, parseSchema, loadSchemaFromObject } from './schemas/loader.js';
export { validateSchema } from './schemas/validator.js';
export { SchemaValidationError, ErrorCodes as SchemaErrorCodes } from './schemas/errors.js';
export type { 
    Schema, 
    FieldDefinition, 
    FieldType, 
    ValidationError, 
    ValidationResult 
} from './schemas/types.js';

// LLM exports
export { LLMClient, createLLMClient, LLMPresets } from './llm/client.js';
export { LLMError, LLMErrorCodes } from './llm/errors.js';
export { buildSystemPrompt, buildUserPrompt } from './llm/prompt-builder.js';
export { TokenCounter, estimateTokens } from './llm/token-counter.js';
export type {
    LLMConfig,
    RetryConfig,
    ChatMessage,
    LLMRequest,
    LLMResponse,
    ExtractionOptions,
    ExtractionResponse,
    TokenBudget,
} from './llm/types.js';
export type { TokenUsage, TokenCounterConfig } from './llm/token-counter.js';
