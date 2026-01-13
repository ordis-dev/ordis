/**
 * Token counting and budget management
 */

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
 * Token usage information
 */
export interface TokenUsage {
    /** Estimated system prompt tokens */
    systemTokens: number;
    /** Estimated input tokens */
    inputTokens: number;
    /** Reserved output tokens */
    outputTokens: number;
    /** Total estimated tokens */
    totalTokens: number;
    /** Maximum context tokens allowed */
    maxContextTokens: number;
    /** Percentage of budget used */
    usagePercent: number;
}

/**
 * Token counter configuration
 */
export interface TokenCounterConfig {
    /** Maximum context tokens (default: 32768) */
    maxContextTokens?: number;
    /** Token budget breakdown */
    tokenBudget?: TokenBudget;
    /** Warn when usage exceeds this percentage (default: 90) */
    warnThreshold?: number;
}

/**
 * Estimates token count for text using rough approximation
 * Uses ~4 characters per token heuristic (conservative estimate)
 * 
 * @param text Text to estimate tokens for
 * @returns Estimated token count
 */
export function estimateTokens(text: string): number {
    if (!text || text.length === 0) {
        return 0;
    }

    // Rough approximation: 4 chars per token
    // This is conservative - actual tokenization varies by model
    const charsPerToken = 4;
    return Math.ceil(text.length / charsPerToken);
}

/**
 * Token counter for managing LLM context budgets
 */
export class TokenCounter {
    private config: Required<TokenCounterConfig>;

    constructor(config: TokenCounterConfig = {}) {
        const defaultBudget: TokenBudget = {
            system: 1000,
            input: 2000,
            output: 1000,
        };

        this.config = {
            maxContextTokens: config.maxContextTokens || 32768,
            tokenBudget: config.tokenBudget || defaultBudget,
            warnThreshold: config.warnThreshold || 90,
        };
    }

    /**
     * Calculate token usage for system prompt and input
     */
    calculateUsage(systemPrompt: string, input: string): TokenUsage {
        const systemTokens = estimateTokens(systemPrompt);
        const inputTokens = estimateTokens(input);
        const outputTokens = this.config.tokenBudget.output;
        const totalTokens = systemTokens + inputTokens + outputTokens;
        const usagePercent = (totalTokens / this.config.maxContextTokens) * 100;

        return {
            systemTokens,
            inputTokens,
            outputTokens,
            totalTokens,
            maxContextTokens: this.config.maxContextTokens,
            usagePercent,
        };
    }

    /**
     * Check if usage exceeds maximum context
     */
    exceedsLimit(usage: TokenUsage): boolean {
        return usage.totalTokens > usage.maxContextTokens;
    }

    /**
     * Check if usage exceeds warning threshold
     */
    shouldWarn(usage: TokenUsage): boolean {
        return usage.usagePercent >= this.config.warnThreshold;
    }

    /**
     * Get human-readable usage summary
     */
    formatUsage(usage: TokenUsage): string {
        const lines: string[] = [
            `Token usage: ${usage.totalTokens}/${usage.maxContextTokens} (${usage.usagePercent.toFixed(1)}%)`,
            `  System prompt: ${usage.systemTokens} tokens`,
            `  Input: ${usage.inputTokens} tokens`,
            `  Reserved for output: ${usage.outputTokens} tokens`,
        ];
        return lines.join('\n');
    }

    /**
     * Get error message when limit exceeded
     */
    getErrorMessage(usage: TokenUsage): string {
        const overflow = usage.totalTokens - usage.maxContextTokens;
        return [
            `Token budget exceeded: ${usage.totalTokens}/${usage.maxContextTokens} tokens (${overflow} over limit)`,
            ``,
            `Breakdown:`,
            `  System prompt: ${usage.systemTokens} tokens`,
            `  Input: ${usage.inputTokens} tokens`,
            `  Reserved for output: ${usage.outputTokens} tokens`,
            ``,
            `Suggestions:`,
            `  - Reduce input size (currently ${usage.inputTokens} tokens)`,
            `  - Simplify schema to reduce system prompt (currently ${usage.systemTokens} tokens)`,
            `  - Use a model with larger context window`,
            `  - Consider chunking large inputs (future feature)`,
        ].join('\n');
    }

    /**
     * Get warning message when approaching limit
     */
    getWarningMessage(usage: TokenUsage): string {
        return [
            `⚠ Approaching token budget limit: ${usage.totalTokens}/${usage.maxContextTokens} tokens (${usage.usagePercent.toFixed(1)}%)`,
            `  System: ${usage.systemTokens} | Input: ${usage.inputTokens} | Output: ${usage.outputTokens}`,
        ].join('\n');
    }
}
