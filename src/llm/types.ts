/**
 * LLM client type definitions
 */

import type { Schema } from '../schemas/types.js';

/**
 * Retry configuration
 */
export interface RetryConfig {
    maxRetries: number;
    initialDelay: number;
    maxDelay: number;
    backoffFactor: number;
}

/**
 * Token budget breakdown
 */
export interface TokenBudget {
    /** Maximum tokens for system prompt */
    system: number;
    /** Maximum tokens for user input */
    input: number;
    /** Reserved tokens for model output */
    output: number;
}

/**
 * Configuration for LLM client
 */
export interface LLMConfig {
    baseURL: string;
    apiKey?: string;
    model: string;
    temperature?: number;
    maxTokens?: number;
    timeout?: number;
    retries?: RetryConfig;
    /** Maximum context tokens (default: 4096) */
    maxContextTokens?: number;
    /** Token budget breakdown */
    tokenBudget?: TokenBudget;
    /** Warn when token usage exceeds this percentage (default: 90) */
    warnThreshold?: number;
    /** Enable debug logging for token usage */
    debugTokens?: boolean;
    /** Enable verbose debug output (shows full request/response) */
    debug?: boolean;
}

/**
 * Message in chat completion format
 */
export interface ChatMessage {
    role: 'system' | 'user' | 'assistant';
    content: string;
}

/**
 * Request to LLM API
 */
export interface LLMRequest {
    model: string;
    messages: ChatMessage[];
    temperature?: number;
    max_tokens?: number;
}

/**
 * Response from LLM API (OpenAI-compatible)
 */
export interface LLMResponse {
    id: string;
    object: string;
    created: number;
    model: string;
    choices: Array<{
        index: number;
        message: ChatMessage;
        finish_reason: string;
    }>;
    usage?: {
        prompt_tokens: number;
        completion_tokens: number;
        total_tokens: number;
    };
}

/**
 * Extracted data with confidence scores
 */
export interface ExtractionResponse {
    data: Record<string, unknown>;
    confidence: number;
    confidenceByField: Record<string, number>;
}

/**
 * Options for extraction
 */
export interface ExtractionOptions {
    schema: Schema;
    input: string;
    systemPrompt?: string;
}
