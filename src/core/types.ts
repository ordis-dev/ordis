/**
 * Core pipeline type definitions
 */

import type { Schema } from '../schemas/types.js';
import type { LLMConfig } from '../llm/types.js';

/**
 * HTML stripping options for preprocessing
 */
export interface HtmlStripOptions {
    /** Keep text content only (default: true) */
    extractText?: boolean;
    /** Preserve semantic structure like headings, lists (converts to markdown-like format) */
    preserveStructure?: boolean;
    /** Remove specific CSS selectors (e.g., 'nav', 'footer', '.ad', '#sidebar') */
    removeSelectors?: string[];
    /** Max content length after stripping (truncates if exceeded) */
    maxLength?: number;
}

/**
 * Preprocessing configuration for input text
 */
export interface PreprocessingConfig {
    /** Strip HTML tags from input. When true, uses default options. */
    stripHtml?: boolean | HtmlStripOptions;
}

/**
 * Pipeline configuration
 */
export interface PipelineConfig {
    schema: Schema;
    llmConfig: LLMConfig;
    debug?: boolean;
    validateOutput?: boolean;
}

/**
 * Extraction request
 */
export interface ExtractionRequest {
    input: string;
    schema: Schema;
    llmConfig: LLMConfig;
    /** Optional preprocessing configuration */
    preprocessing?: PreprocessingConfig;
    /** Maximum context tokens (overrides llmConfig.maxContextTokens) */
    maxContextTokens?: number;
    debug?: boolean;
}

/**
 * Pipeline step result
 */
export interface StepResult {
    step: string;
    success: boolean;
    data?: unknown;
    error?: unknown;  // Preserve full error object for formatting
    duration?: number;
}

/**
 * Complete extraction result
 */
export interface PipelineResult {
    success: boolean;
    data?: Record<string, unknown>;
    confidence?: number;
    confidenceByField?: Record<string, number>;
    meetsThreshold: boolean;
    errors: Array<{
        field?: string;
        message: string;
        code: string;
        details?: Record<string, unknown>; // Original error details for formatting
    }>;
    steps?: StepResult[];
    metadata: {
        duration: number;
        model?: string;
        schemaName?: string;
    };
}
