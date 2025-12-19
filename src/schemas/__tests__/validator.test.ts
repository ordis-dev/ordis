/**
 * Unit tests for schema validator
 */

import { describe, it, expect } from 'vitest';
import { validateSchema } from '../validator.js';
import { SchemaValidationError, ErrorCodes } from '../errors.js';
import type { Schema } from '../types.js';

describe('Schema Validator', () => {
    describe('Valid Schemas', () => {
        it('should validate a simple valid schema', () => {
            const schema = {
                fields: {
                    name: {
                        type: 'string',
                        description: 'User name',
                    },
                },
            };

            expect(() => validateSchema(schema)).not.toThrow();
        });

        it('should validate schema with multiple field types', () => {
            const schema = {
                fields: {
                    name: { type: 'string' },
                    age: { type: 'number' },
                    birthdate: { type: 'string', format: 'date-time' },
                    status: { type: 'string', enum: ['active', 'inactive'] },
                },
            };

            expect(() => validateSchema(schema)).not.toThrow();
        });

        it('should validate schema with optional fields', () => {
            const schema = {
                fields: {
                    required_field: { type: 'string' },
                    optional_field: { type: 'string', optional: true },
                },
            };

            expect(() => validateSchema(schema)).not.toThrow();
        });

        it('should validate schema with number constraints', () => {
            const schema = {
                fields: {
                    age: { type: 'number', min: 0, max: 120 },
                    score: { type: 'number', min: 0 },
                    balance: { type: 'number', max: 1000000 },
                },
            };

            expect(() => validateSchema(schema)).not.toThrow();
        });

        it('should validate schema with string pattern', () => {
            const schema = {
                fields: {
                    email: { type: 'string', pattern: '^[a-z]+@[a-z]+\\.[a-z]+$' },
                },
            };

            expect(() => validateSchema(schema)).not.toThrow();
        });

        it('should validate schema with metadata', () => {
            const schema = {
                fields: {
                    name: { type: 'string' },
                },
                metadata: {
                    name: 'User Schema',
                    version: '1.0.0',
                    description: 'Schema for user data',
                },
            };

            expect(() => validateSchema(schema)).not.toThrow();
        });

        it('should validate field names with underscores and numbers', () => {
            const schema = {
                fields: {
                    field_1: { type: 'string' },
                    _private_field: { type: 'string' },
                    Field123: { type: 'string' },
                },
            };

            expect(() => validateSchema(schema)).not.toThrow();
        });
    });

    describe('Invalid Schema Structure', () => {
        it('should reject non-object schema', () => {
            expect(() => validateSchema(null)).toThrow(SchemaValidationError);
            expect(() => validateSchema(undefined)).toThrow(SchemaValidationError);
            expect(() => validateSchema('string')).toThrow(SchemaValidationError);
            expect(() => validateSchema(123)).toThrow(SchemaValidationError);
        });

        it('should reject schema without fields property', () => {
            const schema = {};

            expect(() => validateSchema(schema)).toThrow(SchemaValidationError);
            expect(() => validateSchema(schema)).toThrow(/fields/);
        });

        it('should reject schema with non-object fields', () => {
            const schema = { fields: 'not an object' };

            expect(() => validateSchema(schema)).toThrow(SchemaValidationError);
        });

        it('should reject schema with empty fields object', () => {
            const schema = { fields: {} };

            expect(() => validateSchema(schema)).toThrow(SchemaValidationError);
            expect(() => validateSchema(schema)).toThrow(/at least one field/);
        });
    });

    describe('Invalid Field Names', () => {
        it('should reject empty field name', () => {
            const schema = {
                fields: {
                    '': { type: 'string' },
                },
            };

            expect(() => validateSchema(schema)).toThrow(SchemaValidationError);
        });

        it('should reject field names starting with numbers', () => {
            const schema = {
                fields: {
                    '123field': { type: 'string' },
                },
            };

            expect(() => validateSchema(schema)).toThrow(SchemaValidationError);
            expect(() => validateSchema(schema)).toThrow(/Invalid field name/);
        });

        it('should reject field names with special characters', () => {
            const invalidNames = ['field-name', 'field.name', 'field name', 'field@name'];

            invalidNames.forEach((name) => {
                const schema = {
                    fields: {
                        [name]: { type: 'string' },
                    },
                };

                expect(() => validateSchema(schema)).toThrow(SchemaValidationError);
            });
        });
    });

    describe('Invalid Field Definitions', () => {
        it('should reject field without type', () => {
            const schema = {
                fields: {
                    name: { description: 'A name' },
                },
            };

            expect(() => validateSchema(schema)).toThrow(SchemaValidationError);
            expect(() => validateSchema(schema)).toThrow(/missing required 'type'/);
        });

        it('should reject field with invalid type', () => {
            const schema = {
                fields: {
                    name: { type: 'invalid_type' },
                },
            };

            expect(() => validateSchema(schema)).toThrow(SchemaValidationError);
            expect(() => validateSchema(schema)).toThrow(/invalid type/);
        });

        it('should reject field with non-boolean optional', () => {
            const schema = {
                fields: {
                    name: { type: 'string', optional: 'yes' },
                },
            };

            expect(() => validateSchema(schema)).toThrow(SchemaValidationError);
        });

        it('should reject field with non-string description', () => {
            const schema = {
                fields: {
                    name: { type: 'string', description: 123 },
                },
            };

            expect(() => validateSchema(schema)).toThrow(SchemaValidationError);
        });
    });

    describe('Enum Field Validation', () => {
        it('should validate enum with valid values', () => {
            const schema = {
                fields: {
                    status: {
                        type: 'string',
                        enum: ['active', 'inactive', 'pending'],
                    },
                },
            };

            expect(() => validateSchema(schema)).not.toThrow();
        });

        it('should allow string field without enum property', () => {
            const schema = {
                fields: {
                    status: { type: 'string' },
                },
            };

            expect(() => validateSchema(schema)).not.toThrow();
        });

        it('should reject enum with non-array value', () => {
            const schema = {
                fields: {
                    status: { type: 'string', enum: 'not an array' },
                },
            };

            expect(() => validateSchema(schema)).toThrow(SchemaValidationError);
        });

        it('should reject enum with empty array', () => {
            const schema = {
                fields: {
                    status: { type: 'string', enum: [] },
                },
            };

            expect(() => validateSchema(schema)).toThrow(SchemaValidationError);
            expect(() => validateSchema(schema)).toThrow(/cannot be empty/);
        });

        it('should reject enum with non-string values', () => {
            const schema = {
                fields: {
                    status: { type: 'string', enum: ['active', 123, 'inactive'] },
                },
            };

            expect(() => validateSchema(schema)).toThrow(SchemaValidationError);
        });

        it('should reject enum with duplicate values', () => {
            const schema = {
                fields: {
                    status: { type: 'string', enum: ['active', 'inactive', 'active'] },
                },
            };

            expect(() => validateSchema(schema)).toThrow(SchemaValidationError);
            expect(() => validateSchema(schema)).toThrow(/duplicate/);
        });
    });

    describe('Number Field Validation', () => {
        it('should validate number field with min constraint', () => {
            const schema = {
                fields: {
                    age: { type: 'number', min: 0 },
                },
            };

            expect(() => validateSchema(schema)).not.toThrow();
        });

        it('should validate number field with max constraint', () => {
            const schema = {
                fields: {
                    age: { type: 'number', max: 150 },
                },
            };

            expect(() => validateSchema(schema)).not.toThrow();
        });

        it('should validate number field with min and max constraints', () => {
            const schema = {
                fields: {
                    age: { type: 'number', min: 0, max: 150 },
                },
            };

            expect(() => validateSchema(schema)).not.toThrow();
        });

        it('should reject number field with non-number min', () => {
            const schema = {
                fields: {
                    age: { type: 'number', min: '0' },
                },
            };

            expect(() => validateSchema(schema)).toThrow(SchemaValidationError);
        });

        it('should reject number field with non-number max', () => {
            const schema = {
                fields: {
                    age: { type: 'number', max: '150' },
                },
            };

            expect(() => validateSchema(schema)).toThrow(SchemaValidationError);
        });

        it('should reject number field where min > max', () => {
            const schema = {
                fields: {
                    age: { type: 'number', min: 100, max: 50 },
                },
            };

            expect(() => validateSchema(schema)).toThrow(SchemaValidationError);
            expect(() => validateSchema(schema)).toThrow(/cannot be greater than/);
        });

        it('should reject number field with enum property', () => {
            const schema = {
                fields: {
                    age: { type: 'number', enum: ['1', '2', '3'] },
                },
            };

            expect(() => validateSchema(schema)).toThrow(SchemaValidationError);
        });
    });

    describe('String Field Validation', () => {
        it('should validate string field with pattern', () => {
            const schema = {
                fields: {
                    email: { type: 'string', pattern: '^[a-z]+@[a-z]+\\.[a-z]+$' },
                },
            };

            expect(() => validateSchema(schema)).not.toThrow();
        });

        it('should reject string field with non-string pattern', () => {
            const schema = {
                fields: {
                    email: { type: 'string', pattern: 123 },
                },
            };

            expect(() => validateSchema(schema)).toThrow(SchemaValidationError);
        });

        it('should reject string field with invalid regex pattern', () => {
            const schema = {
                fields: {
                    email: { type: 'string', pattern: '[invalid(regex' },
                },
            };

            expect(() => validateSchema(schema)).toThrow(SchemaValidationError);
            expect(() => validateSchema(schema)).toThrow(/invalid regex/);
        });

        it('should reject string field with min/max properties', () => {
            const schema = {
                fields: {
                    name: { type: 'string', min: 1, max: 100 },
                },
            };

            expect(() => validateSchema(schema)).toThrow(SchemaValidationError);
        });
    });

    describe('Metadata Validation', () => {
        it('should validate complete metadata', () => {
            const schema = {
                fields: {
                    name: { type: 'string' },
                },
                metadata: {
                    name: 'Test Schema',
                    version: '1.0.0',
                    description: 'A test schema',
                },
            };

            expect(() => validateSchema(schema)).not.toThrow();
        });

        it('should validate partial metadata', () => {
            const schema = {
                fields: {
                    name: { type: 'string' },
                },
                metadata: {
                    name: 'Test Schema',
                },
            };

            expect(() => validateSchema(schema)).not.toThrow();
        });

        it('should reject non-object metadata', () => {
            const schema = {
                fields: {
                    name: { type: 'string' },
                },
                metadata: 'not an object',
            };

            expect(() => validateSchema(schema)).toThrow(SchemaValidationError);
        });

        it('should reject metadata with non-string name', () => {
            const schema = {
                fields: {
                    name: { type: 'string' },
                },
                metadata: {
                    name: 123,
                },
            };

            expect(() => validateSchema(schema)).toThrow(SchemaValidationError);
        });

        it('should reject metadata with non-string version', () => {
            const schema = {
                fields: {
                    name: { type: 'string' },
                },
                metadata: {
                    version: 1.0,
                },
            };

            expect(() => validateSchema(schema)).toThrow(SchemaValidationError);
        });

        it('should reject metadata with non-string description', () => {
            const schema = {
                fields: {
                    name: { type: 'string' },
                },
                metadata: {
                    description: ['an array'],
                },
            };

            expect(() => validateSchema(schema)).toThrow(SchemaValidationError);
        });
    });

    describe('Error Details', () => {
        it('should include field name in error for field-specific errors', () => {
            const schema = {
                fields: {
                    invalid_field: { type: 'invalid_type' },
                },
            };

            try {
                validateSchema(schema);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).toBeInstanceOf(SchemaValidationError);
                expect((error as SchemaValidationError).field).toBe('invalid_field');
            }
        });

        it('should include error code', () => {
            const schema = {
                fields: {
                    name: { type: 'invalid_type' },
                },
            };

            try {
                validateSchema(schema);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).toBeInstanceOf(SchemaValidationError);
                expect((error as SchemaValidationError).code).toBe(ErrorCodes.INVALID_FIELD_TYPE);
            }
        });

        it('should include additional details for enum errors', () => {
            const schema = {
                fields: {
                    status: { type: 'string', enum: ['active', 123] },
                },
            };

            try {
                validateSchema(schema);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).toBeInstanceOf(SchemaValidationError);
                const details = (error as SchemaValidationError).details;
                expect(details).toBeDefined();
                expect(details?.index).toBe(1);
            }
        });
    });

    describe('Confidence Configuration Validation', () => {
        it('should validate schema with valid confidence config', () => {
            const schema = {
                fields: {
                    name: { type: 'string' },
                },
                confidence: {
                    threshold: 85,
                    failOnLowConfidence: true,
                },
            };

            expect(() => validateSchema(schema)).not.toThrow();
        });

        it('should validate confidence with threshold at boundaries', () => {
            const schemas = [
                {
                    fields: { name: { type: 'string' } },
                    confidence: { threshold: 0, failOnLowConfidence: false },
                },
                {
                    fields: { name: { type: 'string' } },
                    confidence: { threshold: 100, failOnLowConfidence: true },
                },
            ];

            schemas.forEach((schema) => {
                expect(() => validateSchema(schema)).not.toThrow();
            });
        });

        it('should reject confidence config without threshold', () => {
            const schema = {
                fields: {
                    name: { type: 'string' },
                },
                confidence: {
                    failOnLowConfidence: true,
                },
            };

            expect(() => validateSchema(schema)).toThrow(SchemaValidationError);
            expect(() => validateSchema(schema)).toThrow(/threshold/);
        });

        it('should reject confidence config without failOnLowConfidence', () => {
            const schema = {
                fields: {
                    name: { type: 'string' },
                },
                confidence: {
                    threshold: 80,
                },
            };

            expect(() => validateSchema(schema)).toThrow(SchemaValidationError);
            expect(() => validateSchema(schema)).toThrow(/failOnLowConfidence/);
        });

        it('should reject non-object confidence config', () => {
            const schema = {
                fields: {
                    name: { type: 'string' },
                },
                confidence: 'not an object',
            };

            expect(() => validateSchema(schema)).toThrow(SchemaValidationError);
            expect(() => validateSchema(schema)).toThrow(/must be an object/);
        });

        it('should reject non-number threshold', () => {
            const schema = {
                fields: {
                    name: { type: 'string' },
                },
                confidence: {
                    threshold: '80',
                    failOnLowConfidence: true,
                },
            };

            expect(() => validateSchema(schema)).toThrow(SchemaValidationError);
            expect(() => validateSchema(schema)).toThrow(/must be a number/);
        });

        it('should reject threshold below 0', () => {
            const schema = {
                fields: {
                    name: { type: 'string' },
                },
                confidence: {
                    threshold: -10,
                    failOnLowConfidence: true,
                },
            };

            expect(() => validateSchema(schema)).toThrow(SchemaValidationError);
            expect(() => validateSchema(schema)).toThrow(/between 0 and 100/);
        });

        it('should reject threshold above 100', () => {
            const schema = {
                fields: {
                    name: { type: 'string' },
                },
                confidence: {
                    threshold: 150,
                    failOnLowConfidence: true,
                },
            };

            expect(() => validateSchema(schema)).toThrow(SchemaValidationError);
            expect(() => validateSchema(schema)).toThrow(/between 0 and 100/);
        });

        it('should reject non-boolean failOnLowConfidence', () => {
            const schema = {
                fields: {
                    name: { type: 'string' },
                },
                confidence: {
                    threshold: 80,
                    failOnLowConfidence: 'yes',
                },
            };

            expect(() => validateSchema(schema)).toThrow(SchemaValidationError);
            expect(() => validateSchema(schema)).toThrow(/must be a boolean/);
        });

        it('should include error code for invalid confidence config', () => {
            const schema = {
                fields: {
                    name: { type: 'string' },
                },
                confidence: {
                    threshold: 200,
                    failOnLowConfidence: true,
                },
            };

            try {
                validateSchema(schema);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).toBeInstanceOf(SchemaValidationError);
                expect((error as SchemaValidationError).code).toBe(
                    ErrorCodes.INVALID_CONFIDENCE_CONFIG
                );
            }
        });

        it('should include threshold value in error details', () => {
            const schema = {
                fields: {
                    name: { type: 'string' },
                },
                confidence: {
                    threshold: 150,
                    failOnLowConfidence: true,
                },
            };

            try {
                validateSchema(schema);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).toBeInstanceOf(SchemaValidationError);
                const details = (error as SchemaValidationError).details;
                expect(details?.threshold).toBe(150);
            }
        });
    });
});
