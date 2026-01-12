/**
 * Tests for output validator
 */

import { describe, it, expect } from 'vitest';
import { validateExtractedData } from '../validator.js';
import type { Schema } from '../../schemas/types.js';

describe('Output Validator', () => {
    describe('validateExtractedData', () => {
        it('should validate correct data', () => {
            const schema: Schema = {
                fields: {
                    name: { type: 'string' },
                    age: { type: 'number' },
                },
            };

            const data = {
                name: 'John',
                age: 30,
            };

            const result = validateExtractedData(data, schema);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should detect missing required field', () => {
            const schema: Schema = {
                fields: {
                    name: { type: 'string' },
                    age: { type: 'number' },
                },
            };

            const data = {
                name: 'John',
            };

            const result = validateExtractedData(data, schema);
            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].field).toBe('age');
            expect(result.errors[0].code).toBe('FIELD_MISSING');
        });

        it('should allow missing optional field', () => {
            const schema: Schema = {
                fields: {
                    name: { type: 'string' },
                    nickname: { type: 'string', optional: true },
                },
            };

            const data = {
                name: 'John',
            };

            const result = validateExtractedData(data, schema);
            expect(result.valid).toBe(true);
        });

        it('should detect type mismatch for non-coercible values', () => {
            const schema: Schema = {
                fields: {
                    age: { type: 'number' },
                },
            };

            const data = {
                age: 'not a number',  // Cannot be coerced to number
            };

            const result = validateExtractedData(data, schema);
            expect(result.valid).toBe(false);
            expect(result.errors[0].code).toBe('TYPE_MISMATCH');
        });

        it('should coerce string numbers to numbers', () => {
            const schema: Schema = {
                fields: {
                    age: { type: 'number' },
                },
            };

            const data = {
                age: '30',  // Coercible to 30
            };

            const result = validateExtractedData(data, schema);
            expect(result.valid).toBe(true);
            expect(result.coercedData?.age).toBe(30);
            expect(result.warnings).toHaveLength(1);
        });

        it('should validate string pattern', () => {
            const schema: Schema = {
                fields: {
                    email: { type: 'string', pattern: '^[a-z]+@[a-z]+\\.[a-z]+$' },
                },
            };

            const validData = { email: 'test@example.com' };
            expect(validateExtractedData(validData, schema).valid).toBe(true);

            const invalidData = { email: 'invalid-email' };
            expect(validateExtractedData(invalidData, schema).valid).toBe(false);
        });

        it('should validate number constraints', () => {
            const schema: Schema = {
                fields: {
                    age: { type: 'number', min: 0, max: 120 },
                },
            };

            expect(validateExtractedData({ age: 30 }, schema).valid).toBe(true);
            expect(validateExtractedData({ age: -5 }, schema).valid).toBe(false);
            expect(validateExtractedData({ age: 150 }, schema).valid).toBe(false);
        });

        it('should validate enum values', () => {
            const schema: Schema = {
                fields: {
                    status: { type: 'string', enum: ['active', 'inactive'] },
                },
            };

            expect(validateExtractedData({ status: 'active' }, schema).valid).toBe(true);
            expect(validateExtractedData({ status: 'pending' }, schema).valid).toBe(false);
        });

        it('should collect multiple errors for non-coercible values', () => {
            const schema: Schema = {
                fields: {
                    name: { type: 'string' },
                    age: { type: 'number', min: 0 },
                    status: { type: 'string', enum: ['active', 'inactive'] },
                },
            };

            const data = {
                name: { complex: 'object' },  // Cannot coerce object to string
                age: -5,  // Valid number but below min
                status: 'pending',  // Valid string but not in enum
            };

            const result = validateExtractedData(data, schema);
            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(3);
        });
    });
});
