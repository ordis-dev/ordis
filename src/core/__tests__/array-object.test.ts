/**
 * Tests for array and object type support
 */

import { describe, it, expect } from 'vitest';
import { validateSchema } from '../../schemas/validator.js';
import { validateExtractedData } from '../validator.js';
import { buildSystemPrompt } from '../../llm/prompt-builder.js';
import type { Schema } from '../../schemas/types.js';

describe('Array and Object Type Support', () => {
    describe('Schema Validation', () => {
        it('should validate schema with array of objects', () => {
            const schema = {
                fields: {
                    funding_rounds: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                round_type: { type: 'string' },
                                amount_usd: { type: 'number', optional: true },
                            },
                        },
                        optional: true,
                    },
                },
            };

            expect(() => validateSchema(schema)).not.toThrow();
        });

        it('should validate schema with nested object', () => {
            const schema = {
                fields: {
                    address: {
                        type: 'object',
                        properties: {
                            street: { type: 'string' },
                            city: { type: 'string' },
                            zip: { type: 'string', optional: true },
                        },
                    },
                },
            };

            expect(() => validateSchema(schema)).not.toThrow();
        });

        it('should reject array without items', () => {
            const schema = {
                fields: {
                    items: {
                        type: 'array',
                    },
                },
            };

            expect(() => validateSchema(schema)).toThrow(/must have an 'items' property/);
        });

        it('should reject array with non-object items', () => {
            const schema = {
                fields: {
                    items: {
                        type: 'array',
                        items: {
                            type: 'string',
                        },
                    },
                },
            };

            expect(() => validateSchema(schema)).toThrow(/items type must be 'object'/);
        });

        it('should reject object without properties', () => {
            const schema = {
                fields: {
                    address: {
                        type: 'object',
                    },
                },
            };

            expect(() => validateSchema(schema)).toThrow(/must have a 'properties' property/);
        });

        it('should validate nested property types', () => {
            const schema = {
                fields: {
                    items: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                name: { type: 'invalid_type' },
                            },
                        },
                    },
                },
            };

            expect(() => validateSchema(schema)).toThrow(/invalid type/);
        });
    });

    describe('Data Validation', () => {
        it('should validate array of objects', () => {
            const schema: Schema = {
                fields: {
                    funding_rounds: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                round_type: { type: 'string' },
                                amount_usd: { type: 'number' },
                            },
                        },
                    },
                },
            };

            const validData = {
                funding_rounds: [
                    { round_type: 'series_a', amount_usd: 15000000 },
                    { round_type: 'series_b', amount_usd: 45000000 },
                ],
            };

            const result = validateExtractedData(validData, schema);
            expect(result.valid).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should detect invalid item in array', () => {
            const schema: Schema = {
                fields: {
                    items: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                name: { type: 'string' },
                                price: { type: 'number' },
                            },
                        },
                    },
                },
            };

            const invalidData = {
                items: [
                    { name: 'Product A', price: 100 },
                    { name: 'Product B', price: 'invalid' }, // Wrong type
                ],
            };

            const result = validateExtractedData(invalidData, schema);
            expect(result.valid).toBe(false);
            expect(result.errors).toHaveLength(1);
            expect(result.errors[0].field).toBe('items[1].price');
            expect(result.errors[0].code).toBe('TYPE_MISMATCH');
        });

        it('should detect missing required field in array item', () => {
            const schema: Schema = {
                fields: {
                    items: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                name: { type: 'string' },
                                price: { type: 'number' },
                            },
                        },
                    },
                },
            };

            const invalidData = {
                items: [
                    { name: 'Product A', price: 100 },
                    { name: 'Product B' }, // Missing price
                ],
            };

            const result = validateExtractedData(invalidData, schema);
            expect(result.valid).toBe(false);
            expect(result.errors[0].field).toBe('items[1].price');
            expect(result.errors[0].code).toBe('FIELD_MISSING');
        });

        it('should allow optional fields in array items', () => {
            const schema: Schema = {
                fields: {
                    items: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                name: { type: 'string' },
                                price: { type: 'number', optional: true },
                            },
                        },
                    },
                },
            };

            const validData = {
                items: [
                    { name: 'Product A', price: 100 },
                    { name: 'Product B' }, // price is optional
                ],
            };

            const result = validateExtractedData(validData, schema);
            expect(result.valid).toBe(true);
        });

        it('should validate nested object', () => {
            const schema: Schema = {
                fields: {
                    address: {
                        type: 'object',
                        properties: {
                            street: { type: 'string' },
                            city: { type: 'string' },
                        },
                    },
                },
            };

            const validData = {
                address: {
                    street: '123 Main St',
                    city: 'Springfield',
                },
            };

            const result = validateExtractedData(validData, schema);
            expect(result.valid).toBe(true);
        });

        it('should detect type mismatch in nested object', () => {
            const schema: Schema = {
                fields: {
                    address: {
                        type: 'object',
                        properties: {
                            street: { type: 'string' },
                            zip: { type: 'number' },
                        },
                    },
                },
            };

            const invalidData = {
                address: {
                    street: '123 Main St',
                    zip: 'not-a-number',
                },
            };

            const result = validateExtractedData(invalidData, schema);
            expect(result.valid).toBe(false);
            expect(result.errors[0].field).toBe('address.zip');
        });

        it('should handle empty array', () => {
            const schema: Schema = {
                fields: {
                    items: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                name: { type: 'string' },
                            },
                        },
                    },
                },
            };

            const validData = {
                items: [],
            };

            const result = validateExtractedData(validData, schema);
            expect(result.valid).toBe(true);
        });

        it('should reject non-array value for array field', () => {
            const schema: Schema = {
                fields: {
                    items: {
                        type: 'array',
                        items: {
                            type: 'object',
                            properties: {
                                name: { type: 'string' },
                            },
                        },
                    },
                },
            };

            const invalidData = {
                items: { name: 'Not an array' },
            };

            const result = validateExtractedData(invalidData, schema);
            expect(result.valid).toBe(false);
            expect(result.errors[0].code).toBe('TYPE_MISMATCH');
        });

        it('should reject non-object value for object field', () => {
            const schema: Schema = {
                fields: {
                    address: {
                        type: 'object',
                        properties: {
                            street: { type: 'string' },
                        },
                    },
                },
            };

            const invalidData = {
                address: 'Not an object',
            };

            const result = validateExtractedData(invalidData, schema);
            expect(result.valid).toBe(false);
            expect(result.errors[0].code).toBe('TYPE_MISMATCH');
        });
    });

    describe('Prompt Generation', () => {
        it('should generate prompt for array of objects', () => {
            const schema: Schema = {
                fields: {
                    funding_rounds: {
                        type: 'array',
                        description: 'List of funding rounds',
                        items: {
                            type: 'object',
                            properties: {
                                round_type: { 
                                    type: 'string',
                                    enum: ['seed', 'series_a', 'series_b'],
                                },
                                amount_usd: { type: 'number', optional: true },
                            },
                        },
                        optional: true,
                    },
                },
            };

            const prompt = buildSystemPrompt(schema);

            expect(prompt).toContain('funding_rounds: array');
            expect(prompt).toContain('List of funding rounds');
            expect(prompt).toContain('items (object)');
            expect(prompt).toContain('round_type: string');
            expect(prompt).toContain('seed, series_a, series_b');
            expect(prompt).toContain('amount_usd: number (optional)');
        });

        it('should generate prompt for nested object', () => {
            const schema: Schema = {
                fields: {
                    company: {
                        type: 'object',
                        description: 'Company information',
                        properties: {
                            name: { type: 'string' },
                            employees: { type: 'integer', min: 1 },
                        },
                    },
                },
            };

            const prompt = buildSystemPrompt(schema);

            expect(prompt).toContain('company: object');
            expect(prompt).toContain('Company information');
            expect(prompt).toContain('name: string');
            expect(prompt).toContain('employees: integer');
        });
    });
});
