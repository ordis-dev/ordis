/**
 * Core pipeline type definitions
 */

import type { Schema } from '../schemas/types.js';
import type { LLMConfig } from '../llm/types.js';

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
    debug?: boolean;
}

/**
 * Pipeline step result
 */
export interface StepResult {
    step: string;
    success: boolean;
    data?: unknown;
    error?: string;
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
    }>;
    steps?: StepResult[];
    metadata: {
        duration: number;
        model?: string;
        schemaName?: string;
    };
}
