/**
 * Tests for error-formatter.ts
 * Validates user-friendly error message formatting
 */

import { describe, it, expect } from 'vitest';
import {
    formatError,
    formatValidationError,
    formatValidationErrors,
    formatLLMError,
} from '../error-formatter.js';
import { SchemaValidationError, ErrorCodes as SchemaErrorCodes } from '../../schemas/errors.js';
import { LLMError, LLMErrorCodes } from '../../llm/errors.js';
import { PipelineErrorCodes } from '../errors.js';
import type { ValidationError } from '../../schemas/types.js';

describe('error-formatter', () => {
    describe('formatValidationError', () => {
        it('formats TYPE_MISMATCH error with string to number suggestion', () => {
            const error: ValidationError = {
                field: 'age',
                message: 'Expected type number but got string',
                code: PipelineErrorCodes.TYPE_MISMATCH,
                expected: 'number',
                actual: 'string',
                value: '25',
            };

            const formatted = formatValidationError(error);

            expect(formatted).toContain('age');
            expect(formatted).toContain('number');
            expect(formatted).toContain('string');
            expect(formatted).toContain('Got: "25"');
            expect(formatted).toMatch(/Tip:/);
        });

        it('formats TYPE_MISMATCH error with number to string case', () => {
            const error: ValidationError = {
                field: 'name',
                message: 'Expected type string but got number',
                code: PipelineErrorCodes.TYPE_MISMATCH,
                expected: 'string',
                actual: 'number',
                value: 123,
            };

            const formatted = formatValidationError(error);

            expect(formatted).toContain('name');
            expect(formatted).toContain('string');
            expect(formatted).toContain('number');
            expect(formatted).toContain('Got: 123');
        });

        it('formats FIELD_MISSING error', () => {
            const error: ValidationError = {
                field: 'email',
                message: 'Required field missing',
                code: PipelineErrorCodes.FIELD_MISSING,
            };

            const formatted = formatValidationError(error);

            expect(formatted).toContain('email');
            expect(formatted).toContain('missing');
            expect(formatted).toMatch(/Tip:/);
            expect(formatted).toContain('input text contains this information');
        });

        it('formats FIELD_INVALID error with regex pattern', () => {
            const error: ValidationError = {
                field: 'email',
                message: 'Value does not match required pattern',
                code: PipelineErrorCodes.FIELD_INVALID,
                expected: '^[\\w.-]+@[\\w.-]+\\.\\w+$',
                value: 'invalid-email',
            };

            const formatted = formatValidationError(error);

            expect(formatted).toContain('email');
            expect(formatted).toContain('invalid-email');
            expect(formatted).toContain('pattern');
        });

        it('formats enum validation error', () => {
            const error: ValidationError = {
                field: 'status',
                message: 'Value not in allowed values',
                code: PipelineErrorCodes.FIELD_INVALID,
                expected: ['active', 'inactive', 'pending'],
                value: 'completed',
            };

            const formatted = formatValidationError(error);

            expect(formatted).toContain('status');
            expect(formatted).toContain('completed');
            expect(formatted).toContain('active');
            expect(formatted).toContain('inactive');
            expect(formatted).toContain('pending');
        });

        it('formats error without field name', () => {
            const error: ValidationError = {
                message: 'Overall validation failed',
                code: PipelineErrorCodes.VALIDATION_ERROR,
            };

            const formatted = formatValidationError(error);

            expect(formatted).toContain('validation failed');
            expect(formatted).not.toContain('Field:');
        });

        it('formats error with context suggestion', () => {
            const error: ValidationError = {
                field: 'items',
                message: 'Expected array but got string',
                code: PipelineErrorCodes.TYPE_MISMATCH,
                expected: 'array',
                actual: 'string',
            };

            const formatted = formatValidationError(error);

            expect(formatted).toContain('items');
            expect(formatted).toContain('array');
            expect(formatted).toContain('string');
        });
    });

    describe('formatValidationErrors', () => {
        it('formats multiple validation errors', () => {
            const errors: ValidationError[] = [
                {
                    field: 'name',
                    message: 'Required field missing',
                    code: PipelineErrorCodes.FIELD_MISSING,
                },
                {
                    field: 'age',
                    message: 'Expected type number but got string',
                    code: PipelineErrorCodes.TYPE_MISMATCH,
                    expected: 'number',
                    actual: 'string',
                },
            ];

            const formatted = formatValidationErrors(errors);

            expect(formatted).toContain('2 validation errors');
            expect(formatted).toContain('name');
            expect(formatted).toContain('age');
            expect(formatted).toContain('Field Validation Error');
        });

        it('formats single validation error', () => {
            const errors: ValidationError[] = [
                {
                    field: 'email',
                    message: 'Invalid format',
                    code: PipelineErrorCodes.FIELD_INVALID,
                },
            ];

            const formatted = formatValidationErrors(errors);

            expect(formatted).toContain('1 validation error');
            expect(formatted).toContain('Invalid format');
        });

        it('formats empty error array', () => {
            const formatted = formatValidationErrors([]);

            expect(formatted).toContain('Validation passed');
        });
    });

    describe('formatLLMError', () => {
        it('formats NETWORK_ERROR', () => {
            const error = new LLMError(
                'Network request failed',
                LLMErrorCodes.NETWORK_ERROR,
                undefined,
                { cause: new Error('ECONNREFUSED') }
            );

            const formatted = formatLLMError(error);

            expect(formatted).toMatch(/Network/i);
            expect(formatted).toMatch(/Tip:/);
            expect(formatted).toContain('service is running');
        });

        it('formats AUTHENTICATION_ERROR', () => {
            const error = new LLMError(
                'Invalid API key',
                LLMErrorCodes.AUTHENTICATION_ERROR
            );

            const formatted = formatLLMError(error);

            expect(formatted).toMatch(/Authentication/i);
            expect(formatted).toMatch(/Tip:/);
            expect(formatted).toContain('API key');
        });

        it('formats RATE_LIMIT', () => {
            const error = new LLMError(
                'Rate limit exceeded',
                LLMErrorCodes.RATE_LIMIT
            );

            const formatted = formatLLMError(error);

            expect(formatted).toMatch(/Rate Limit/i);
            expect(formatted).toMatch(/Tip:/);
            expect(formatted).toContain('Wait a moment');
        });

        it('formats TOKEN_LIMIT_EXCEEDED with context', () => {
            const error = new LLMError(
                'Context length exceeded',
                LLMErrorCodes.TOKEN_LIMIT_EXCEEDED,
                undefined,
                {
                    details: {
                        promptTokens: 5000,
                        maxTokens: 4096,
                    },
                }
            );

            const formatted = formatLLMError(error);

            expect(formatted).toMatch(/Context Window/i);
            expect(formatted).toMatch(/Solutions:|Tip:/);
            expect(formatted).toContain('Reduce input size');
            expect(formatted).toContain('larger context window');
        });

        it('formats TOKEN_LIMIT_EXCEEDED without token counts', () => {
            const error = new LLMError(
                'Maximum context length exceeded',
                LLMErrorCodes.TOKEN_LIMIT_EXCEEDED
            );

            const formatted = formatLLMError(error);

            expect(formatted).toContain('context window');
            expect(formatted).toMatch(/Solutions:/);
            expect(formatted).toContain('Reduce input size');
        });

        it('formats TIMEOUT', () => {
            const error = new LLMError(
                'Request timeout',
                LLMErrorCodes.TIMEOUT
            );

            const formatted = formatLLMError(error);

            expect(formatted).toMatch(/Timeout/i);
            expect(formatted).toMatch(/Tip:/);
            expect(formatted).toContain("didn't respond");
        });

        it('formats API_ERROR with status code', () => {
            const error = new LLMError(
                'API error occurred',
                LLMErrorCodes.API_ERROR,
                500,
                { details: { statusCode: 500 } }
            );

            const formatted = formatLLMError(error);

            expect(formatted).toMatch(/API Error|Service Error/i);
            expect(formatted).toContain('API error occurred');
        });

        it('formats generic API_ERROR without details', () => {
            const error = new LLMError(
                'Unknown API error',
                LLMErrorCodes.API_ERROR
            );

            const formatted = formatLLMError(error);

            expect(formatted).toContain('error');
            expect(formatted).toContain('Unknown API error');
        });
    });

    describe('formatError', () => {
        it('formats SchemaValidationError', () => {
            const error = new SchemaValidationError(
                'Invalid schema format',
                SchemaErrorCodes.INVALID_FIELD_TYPE,
                'name'
            );

            const formatted = formatError(error);

            expect(formatted).toContain('Invalid schema format');
        });

        it('formats LLMError', () => {
            const error = new LLMError(
                'Network error',
                LLMErrorCodes.NETWORK_ERROR
            );

            const formatted = formatError(error);

            expect(formatted).toMatch(/Network/i);
            expect(formatted).toMatch(/Tip:/);
        });

        it('formats generic Error', () => {
            const error = new Error('Something went wrong');

            const formatted = formatError(error);

            expect(formatted).toBe('Something went wrong');
        });

        it('formats string error', () => {
            const formatted = formatError('Simple error message');

            expect(formatted).toBe('Simple error message');
        });

        it('formats unknown error type', () => {
            const formatted = formatError({ custom: 'error' });

            expect(formatted).toContain('Unknown error');
        });

        it('formats null error', () => {
            const formatted = formatError(null);

            expect(formatted).toContain('Unknown error');
        });

        it('formats undefined error', () => {
            const formatted = formatError(undefined);

            expect(formatted).toContain('Unknown error');
        });
    });
});
