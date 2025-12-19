/**
 * Unit tests for schema loader
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { loadSchema, parseSchema, loadSchemaFromObject } from '../loader.js';
import { SchemaValidationError, ErrorCodes } from '../errors.js';
import type { Schema } from '../types.js';

const TEST_DIR = path.join(process.cwd(), 'test-schemas');

describe('Schema Loader', () => {
    beforeEach(async () => {
        // Create test directory
        await fs.mkdir(TEST_DIR, { recursive: true });
    });

    afterEach(async () => {
        // Clean up test directory
        await fs.rm(TEST_DIR, { recursive: true, force: true });
    });

    describe('loadSchema', () => {
        it('should load a valid schema from file', async () => {
            const schema = {
                fields: {
                    name: { type: 'string' },
                    age: { type: 'number' },
                },
            };

            const filePath = path.join(TEST_DIR, 'valid.schema.json');
            await fs.writeFile(filePath, JSON.stringify(schema));

            const loaded = await loadSchema(filePath);
            expect(loaded).toEqual(schema);
        });

        it('should throw error for non-existent file', async () => {
            const filePath = path.join(TEST_DIR, 'does-not-exist.json');

            await expect(loadSchema(filePath)).rejects.toThrow(SchemaValidationError);
            await expect(loadSchema(filePath)).rejects.toThrow(/Cannot read schema file/);
        });

        it('should throw error for invalid JSON', async () => {
            const filePath = path.join(TEST_DIR, 'invalid.json');
            await fs.writeFile(filePath, '{ invalid json }');

            await expect(loadSchema(filePath)).rejects.toThrow(SchemaValidationError);
            await expect(loadSchema(filePath)).rejects.toThrow(/Invalid JSON/);
        });

        it('should throw error for invalid schema structure', async () => {
            const invalidSchema = {
                // Missing fields property
                metadata: { name: 'Test' },
            };

            const filePath = path.join(TEST_DIR, 'invalid-schema.json');
            await fs.writeFile(filePath, JSON.stringify(invalidSchema));

            await expect(loadSchema(filePath)).rejects.toThrow(SchemaValidationError);
        });

        it('should load schema with metadata', async () => {
            const schema = {
                fields: {
                    id: { type: 'string' },
                },
                metadata: {
                    name: 'Test Schema',
                    version: '1.0.0',
                    description: 'A test schema',
                },
            };

            const filePath = path.join(TEST_DIR, 'with-metadata.json');
            await fs.writeFile(filePath, JSON.stringify(schema));

            const loaded = await loadSchema(filePath);
            expect(loaded).toEqual(schema);
            expect(loaded.metadata?.name).toBe('Test Schema');
        });

        it('should load complex schema with all field types', async () => {
            const schema = {
                fields: {
                    invoice_id: { type: 'string', description: 'Invoice ID' },
                    amount: { type: 'number', min: 0 },
                    currency: { type: 'string', enum: ['USD', 'EUR', 'GBP'] },
                    date: { type: 'string', format: 'date-time', optional: true },
                    email: { type: 'string', pattern: '^[a-z]+@[a-z]+\\.[a-z]+$' },
                },
            };

            const filePath = path.join(TEST_DIR, 'complex.json');
            await fs.writeFile(filePath, JSON.stringify(schema, null, 2));

            const loaded = await loadSchema(filePath);
            expect(loaded).toEqual(schema);
        });
    });

    describe('parseSchema', () => {
        it('should parse valid JSON string', () => {
            const schemaString = JSON.stringify({
                fields: {
                    name: { type: 'string' },
                },
            });

            const schema = parseSchema(schemaString);
            expect(schema.fields.name.type).toBe('string');
        });

        it('should throw error for invalid JSON string', () => {
            const invalidJson = '{ invalid }';

            expect(() => parseSchema(invalidJson)).toThrow(SchemaValidationError);
            expect(() => parseSchema(invalidJson)).toThrow(/Invalid JSON/);
        });

        it('should throw error for invalid schema structure', () => {
            const invalidSchema = JSON.stringify({ notFields: {} });

            expect(() => parseSchema(invalidSchema)).toThrow(SchemaValidationError);
        });

        it('should parse schema with all features', () => {
            const schemaString = JSON.stringify({
                fields: {
                    id: { type: 'string' },
                    count: { type: 'number', min: 0, max: 100 },
                    status: { type: 'string', enum: ['active', 'inactive'] },
                    created: { type: 'string', format: 'date-time', optional: true },
                },
                metadata: {
                    name: 'Complete Schema',
                    version: '1.0.0',
                },
            });

            const schema = parseSchema(schemaString);
            expect(Object.keys(schema.fields)).toHaveLength(4);
            expect(schema.metadata?.name).toBe('Complete Schema');
        });
    });

    describe('loadSchemaFromObject', () => {
        it('should load valid schema object', () => {
            const schemaObj = {
                fields: {
                    title: { type: 'string' },
                },
            };

            const schema = loadSchemaFromObject(schemaObj);
            expect(schema).toEqual(schemaObj);
        });

        it('should throw error for invalid schema object', () => {
            const invalidObj = {
                notFields: { title: { type: 'string' } },
            };

            expect(() => loadSchemaFromObject(invalidObj)).toThrow(SchemaValidationError);
        });

        it('should validate all constraints', () => {
            const invalidObj = {
                fields: {
                    age: { type: 'number', min: 100, max: 50 }, // min > max
                },
            };

            expect(() => loadSchemaFromObject(invalidObj)).toThrow(SchemaValidationError);
        });

        it('should accept schema with metadata', () => {
            const schemaObj = {
                fields: {
                    name: { type: 'string' },
                },
                metadata: {
                    name: 'Object Schema',
                },
            };

            const schema = loadSchemaFromObject(schemaObj);
            expect(schema.metadata?.name).toBe('Object Schema');
        });
    });

    describe('Error handling', () => {
        it('should provide file path in error details', async () => {
            const filePath = path.join(TEST_DIR, 'bad-json.json');
            await fs.writeFile(filePath, '{ bad json');

            try {
                await loadSchema(filePath);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).toBeInstanceOf(SchemaValidationError);
                const schemaError = error as SchemaValidationError;
                expect(schemaError.details?.filePath).toBe(filePath);
            }
        });

        it('should have appropriate error code for JSON errors', async () => {
            const filePath = path.join(TEST_DIR, 'bad.json');
            await fs.writeFile(filePath, 'not json at all');

            try {
                await loadSchema(filePath);
                expect.fail('Should have thrown an error');
            } catch (error) {
                expect(error).toBeInstanceOf(SchemaValidationError);
                expect((error as SchemaValidationError).code).toBe(ErrorCodes.INVALID_JSON);
            }
        });

        it('should handle read permission errors gracefully', async () => {
            const filePath = path.join(TEST_DIR, 'readonly.json');
            await fs.writeFile(filePath, '{}');
            await fs.chmod(filePath, 0o000); // Remove all permissions

            try {
                await expect(loadSchema(filePath)).rejects.toThrow(SchemaValidationError);
            } finally {
                // Restore permissions for cleanup
                await fs.chmod(filePath, 0o644);
            }
        });
    });

    describe('Real-world schemas', () => {
        it('should load invoice schema', async () => {
            const invoiceSchema = {
                fields: {
                    invoice_id: {
                        type: 'string',
                        description: 'Unique invoice identifier',
                    },
                    amount: {
                        type: 'number',
                        description: 'Total invoice amount',
                    },
                    currency: {
                        type: 'string',
                        enum: ['USD', 'SGD', 'EUR'],
                        description: 'Currency code',
                    },
                    date: {
                        type: 'string',
                        format: 'date-time',
                        optional: true,
                        description: 'Invoice date',
                    },
                },
            };

            const filePath = path.join(TEST_DIR, 'invoice.schema.json');
            await fs.writeFile(filePath, JSON.stringify(invoiceSchema, null, 2));

            const loaded = await loadSchema(filePath);
            expect(loaded.fields.invoice_id.type).toBe('string');
            expect(loaded.fields.amount.type).toBe('number');
            expect(loaded.fields.currency.type).toBe('string');
            expect(loaded.fields.currency.enum).toEqual(['USD', 'SGD', 'EUR']);
            expect(loaded.fields.date.optional).toBe(true);
        });

        it('should load user profile schema', async () => {
            const userSchema = {
                fields: {
                    username: {
                        type: 'string',
                        pattern: '^[a-zA-Z0-9_]{3,20}$',
                    },
                    email: {
                        type: 'string',
                        pattern: '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,}$',
                    },
                    age: {
                        type: 'number',
                        min: 13,
                        max: 120,
                    },
                    role: {
                        type: 'string',
                        enum: ['user', 'admin', 'moderator'],
                    },
                    bio: {
                        type: 'string',
                        optional: true,
                    },
                },
                metadata: {
                    name: 'User Profile',
                    version: '2.0.0',
                    description: 'Schema for user profile data',
                },
            };

            const filePath = path.join(TEST_DIR, 'user.schema.json');
            await fs.writeFile(filePath, JSON.stringify(userSchema, null, 2));

            const loaded = await loadSchema(filePath);
            expect(loaded.fields.username.pattern).toBeDefined();
            expect(loaded.fields.age.min).toBe(13);
            expect(loaded.metadata?.version).toBe('2.0.0');
        });
    });
});
