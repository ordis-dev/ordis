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
