/**
 * Pipeline error codes and classes
 */

export const PipelineErrorCodes = {
    SCHEMA_LOAD_ERROR: 'SCHEMA_LOAD_ERROR',
    LLM_ERROR: 'LLM_ERROR',
    VALIDATION_ERROR: 'VALIDATION_ERROR',
    CONFIDENCE_ERROR: 'CONFIDENCE_ERROR',
    FIELD_MISSING: 'FIELD_MISSING',
    FIELD_INVALID: 'FIELD_INVALID',
    TYPE_MISMATCH: 'TYPE_MISMATCH',
} as const;

export type PipelineErrorCode = (typeof PipelineErrorCodes)[keyof typeof PipelineErrorCodes];

export class PipelineError extends Error {
    constructor(
        message: string,
        public code: PipelineErrorCode,
        public step?: string,
        public details?: Record<string, unknown>
    ) {
        super(message);
        this.name = 'PipelineError';
        Object.setPrototypeOf(this, PipelineError.prototype);
    }

    toJSON() {
        return {
            name: this.name,
            message: this.message,
            code: this.code,
            step: this.step,
            details: this.details,
        };
    }
}
