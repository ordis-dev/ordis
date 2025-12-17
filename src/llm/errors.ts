/**
 * LLM client errors
 */

export const LLMErrorCodes = {
    NETWORK_ERROR: 'NETWORK_ERROR',
    API_ERROR: 'API_ERROR',
    TIMEOUT: 'TIMEOUT',
    INVALID_RESPONSE: 'INVALID_RESPONSE',
    AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
    RATE_LIMIT: 'RATE_LIMIT',
    TOKEN_LIMIT_EXCEEDED: 'TOKEN_LIMIT_EXCEEDED',
} as const;

export type LLMErrorCode = (typeof LLMErrorCodes)[keyof typeof LLMErrorCodes];

export class LLMError extends Error {
    constructor(
        message: string,
        public code: LLMErrorCode,
        public statusCode?: number,
        public details?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'LLMError';
        Object.setPrototypeOf(this, LLMError.prototype);
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            statusCode: this.statusCode,
            details: this.details,
        };
    }
}
