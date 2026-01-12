/**
 * LLM client - universal client for OpenAI-compatible APIs
 */

import type {
    LLMConfig,
    LLMRequest,
    LLMResponse,
    ExtractionOptions,
    ExtractionResponse,
} from './types.js';
import { LLMError, LLMErrorCodes, type LLMErrorCode } from './errors.js';
import { buildSystemPrompt, buildUserPrompt } from './prompt-builder.js';
import { TokenCounter } from './token-counter.js';

export class LLMClient {
    private config: LLMConfig & {
        temperature: number;
        maxTokens: number;
        timeout: number;
    };
    private retryConfig: {
        maxRetries: number;
        initialDelay: number;
        maxDelay: number;
        backoffFactor: number;
    };
    private tokenCounter: TokenCounter;

    constructor(config: LLMConfig) {
        this.config = {
            temperature: 0.0,
            maxTokens: 2000,
            timeout: 120000, // 120 seconds for slower local models
            ...config,
        };
        this.retryConfig = config.retries || {
            maxRetries: 3,
            initialDelay: 1000,
            maxDelay: 10000,
            backoffFactor: 2,
        };
        this.tokenCounter = new TokenCounter({
            maxContextTokens: config.maxContextTokens,
            tokenBudget: config.tokenBudget,
            warnThreshold: config.warnThreshold,
        });
    }

    /**
     * Extracts data from text using schema
     */
    async extract(options: ExtractionOptions): Promise<ExtractionResponse> {
        const { schema, input, systemPrompt } = options;

        // Build prompts
        const system = systemPrompt || buildSystemPrompt(schema);
        const user = buildUserPrompt(input);

        // Check token budget
        const usage = this.tokenCounter.calculateUsage(system, user);
        
        // Debug logging if enabled
        if (this.config.debugTokens) {
            console.error('[Token Usage]\n' + this.tokenCounter.formatUsage(usage));
        }

        // Error if over limit
        if (this.tokenCounter.exceedsLimit(usage)) {
            throw new LLMError(
                this.tokenCounter.getErrorMessage(usage),
                LLMErrorCodes.TOKEN_LIMIT_EXCEEDED,
                undefined,
                { usage }
            );
        }

        // Warn if approaching limit
        if (this.tokenCounter.shouldWarn(usage)) {
            console.warn(this.tokenCounter.getWarningMessage(usage));
        }

        // Create request
        const request: LLMRequest = {
            model: this.config.model,
            messages: [
                { role: 'system', content: system },
                { role: 'user', content: user },
            ],
            temperature: this.config.temperature,
            max_tokens: this.config.maxTokens,
        };

        // Call API with retries
        const response = await this.chatWithRetry(request);

        // Parse response
        return this.parseExtractionResponse(response);
    }

    /**
     * Calls chat completion API with retry logic
     */
    private async chatWithRetry(request: LLMRequest): Promise<LLMResponse> {
        let lastError: LLMError | null = null;
        let attempt = 0;

        while (attempt <= this.retryConfig.maxRetries) {
            try {
                return await this.chat(request);
            } catch (error) {
                lastError = error as LLMError;

                // Don't retry on non-retryable errors
                if (!this.isRetryableError(lastError)) {
                    throw lastError;
                }

                // Last attempt - don't wait
                if (attempt === this.retryConfig.maxRetries) {
                    throw lastError;
                }

                // Calculate delay with exponential backoff and jitter
                const delay = this.calculateDelay(attempt, lastError);
                
                // Wait before retry
                await this.sleep(delay);
                
                attempt++;
            }
        }

        throw lastError!;
    }

    /**
     * Checks if error is retryable
     */
    private isRetryableError(error: LLMError): boolean {
        const retryableCodes: LLMErrorCode[] = [
            LLMErrorCodes.NETWORK_ERROR,
            LLMErrorCodes.TIMEOUT,
            LLMErrorCodes.RATE_LIMIT,
            LLMErrorCodes.API_ERROR,
        ];
        // Don't retry token limit errors
        return retryableCodes.includes(error.code);
    }

    /**
     * Calculates delay with exponential backoff and jitter
     */
    private calculateDelay(attempt: number, error: LLMError): number {
        // Check for Retry-After header in rate limit errors
        if (error.code === LLMErrorCodes.RATE_LIMIT && error.details?.retryAfter) {
            const retryAfter = Number(error.details.retryAfter) * 1000;
            return Math.min(retryAfter, this.retryConfig.maxDelay);
        }

        // Exponential backoff: initialDelay * (backoffFactor ^ attempt)
        const exponentialDelay = 
            this.retryConfig.initialDelay * 
            Math.pow(this.retryConfig.backoffFactor, attempt);

        // Add jitter (random 0-25% of delay)
        const jitter = exponentialDelay * 0.25 * Math.random();
        const delayWithJitter = exponentialDelay + jitter;

        // Cap at maxDelay
        return Math.min(delayWithJitter, this.retryConfig.maxDelay);
    }

    /**
     * Sleep utility
     */
    private sleep(ms: number): Promise<void> {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Calls chat completion API
     */
    async chat(request: LLMRequest): Promise<LLMResponse> {
        const url = `${this.config.baseURL}/chat/completions`;

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), this.config.timeout);

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...(this.config.apiKey && { 'Authorization': `Bearer ${this.config.apiKey}` }),
                },
                body: JSON.stringify(request),
                signal: controller.signal,
            });

            clearTimeout(timeoutId);

            if (!response.ok) {
                await this.handleErrorResponse(response);
            }

            const data = await response.json();
            return data as LLMResponse;
        } catch (error) {
            clearTimeout(timeoutId);

            if (error instanceof LLMError) {
                throw error;
            }

            if ((error as Error).name === 'AbortError') {
                throw new LLMError(
                    `Request timeout after ${this.config.timeout}ms`,
                    LLMErrorCodes.TIMEOUT
                );
            }

            throw new LLMError(
                `Network error: ${(error as Error).message}`,
                LLMErrorCodes.NETWORK_ERROR,
                undefined,
                { originalError: (error as Error).message }
            );
        }
    }

    /**
     * Handles error responses from API
     */
    private async handleErrorResponse(response: Response): Promise<never> {
        const status = response.status;
        let errorMessage = `API error: ${status} ${response.statusText}`;
        let errorCode: LLMErrorCode = LLMErrorCodes.API_ERROR;
        const details: Record<string, unknown> = {};

        try {
            const errorData = await response.json() as { error?: { message?: string; type?: string } };
            const rawMessage = errorData.error?.message || errorMessage;
            errorMessage = rawMessage;
            
            // Detect context window/token limit errors from various providers
            const msgLower = rawMessage.toLowerCase();
            if (msgLower.includes('context length') || 
                msgLower.includes('maximum context') ||
                msgLower.includes('context_length_exceeded') ||
                msgLower.includes('token limit') ||
                msgLower.includes('too many tokens') ||
                msgLower.includes('prompt is too long') ||
                (msgLower.includes('context') && msgLower.includes('exceed'))) {
                errorCode = LLMErrorCodes.TOKEN_LIMIT_EXCEEDED;
                details.originalMessage = rawMessage;
            }
        } catch {
            // If we can't parse error JSON, use status text
        }

        if (status === 401 || status === 403) {
            errorCode = LLMErrorCodes.AUTHENTICATION_ERROR;
        } else if (status === 429) {
            errorCode = LLMErrorCodes.RATE_LIMIT;
            // Capture Retry-After header if present
            const retryAfter = response.headers.get('Retry-After');
            if (retryAfter) {
                details.retryAfter = retryAfter;
            }
        }

        throw new LLMError(errorMessage, errorCode, status, details);
    }

    /**
     * Parses extraction response from LLM
     */
    private parseExtractionResponse(response: LLMResponse): ExtractionResponse {
        if (!response.choices || response.choices.length === 0) {
            throw new LLMError(
                'No choices in LLM response',
                LLMErrorCodes.INVALID_RESPONSE
            );
        }

        const message = response.choices[0].message;
        if (!message || !message.content) {
            throw new LLMError(
                'No content in LLM response',
                LLMErrorCodes.INVALID_RESPONSE
            );
        }

        let content = message.content.trim();

        // Remove markdown code blocks if present
        if (content.startsWith('```json')) {
            content = content.replace(/^```json\s*/, '').replace(/\s*```$/, '');
        } else if (content.startsWith('```')) {
            content = content.replace(/^```\s*/, '').replace(/\s*```$/, '');
        }

        try {
            const parsed = JSON.parse(content);

            if (!parsed.data || typeof parsed.data !== 'object') {
                throw new Error('Response missing data object');
            }

            if (typeof parsed.confidence !== 'number') {
                throw new Error('Response missing confidence score');
            }

            if (!parsed.confidenceByField || typeof parsed.confidenceByField !== 'object') {
                throw new Error('Response missing confidenceByField object');
            }

            return {
                data: parsed.data,
                confidence: parsed.confidence,
                confidenceByField: parsed.confidenceByField,
            };
        } catch (error) {
            throw new LLMError(
                `Failed to parse LLM response: ${(error as Error).message}`,
                LLMErrorCodes.INVALID_RESPONSE,
                undefined,
                { content, error: (error as Error).message }
            );
        }
    }
}

/**
 * Creates LLM client with common configurations
 */
export function createLLMClient(config: LLMConfig): LLMClient {
    return new LLMClient(config);
}

/**
 * Preset configurations for popular providers
 */
export const LLMPresets = {
    ollama: (model: string = 'llama3'): LLMConfig => ({
        baseURL: 'http://localhost:11434/v1',
        model,
    }),

    lmStudio: (model: string = 'local-model'): LLMConfig => ({
        baseURL: 'http://localhost:1234/v1',
        model,
    }),

    openai: (apiKey: string, model: string = 'gpt-4o-mini'): LLMConfig => ({
        baseURL: 'https://api.openai.com/v1',
        apiKey,
        model,
    }),

    openrouter: (apiKey: string, model: string = 'openai/gpt-4o-mini'): LLMConfig => ({
        baseURL: 'https://openrouter.ai/api/v1',
        apiKey,
        model,
    }),
};
