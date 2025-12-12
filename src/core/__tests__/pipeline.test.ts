/**
 * Tests for extraction pipeline
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ExtractionPipeline, extract } from '../pipeline.js';
import type { Schema } from '../../schemas/types.js';
import type { LLMConfig } from '../../llm/types.js';

// Mock fetch globally
const mockFetch = vi.fn();
global.fetch = mockFetch;

describe('Extraction Pipeline', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('successful extraction', () => {
        it('should complete full pipeline', async () => {
            // Mock successful LLM response
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{
                        message: {
                            content: JSON.stringify({
                                data: {
                                    name: 'John Doe',
                                    age: 30,
                                },
                                confidence: 95,
                                confidenceByField: {
                                    name: 98,
                                    age: 92,
                                },
                            }),
                        },
                    }],
                }),
            });

            const schema: Schema = {
                fields: {
                    name: { type: 'string' },
                    age: { type: 'number' },
                },
            };

            const llmConfig: LLMConfig = {
                baseURL: 'http://localhost:11434/v1',
                model: 'llama3',
            };

            const pipeline = new ExtractionPipeline();
            const result = await pipeline.extract({
                input: 'My name is John Doe and I am 30 years old',
                schema,
                llmConfig,
            });

            expect(result.success).toBe(true);
            expect(result.data).toEqual({ name: 'John Doe', age: 30 });
            expect(result.confidence).toBe(95);
            expect(result.meetsThreshold).toBe(true);
            expect(result.errors).toHaveLength(0);
        });

        it('should include debug steps when enabled', async () => {
            // Mock successful LLM response
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{
                        message: {
                            content: JSON.stringify({
                                data: { name: 'Alice' },
                                confidence: 90,
                                confidenceByField: { name: 90 },
                            }),
                        },
                    }],
                }),
            });

            const schema: Schema = {
                fields: {
                    name: { type: 'string' },
                },
            };

            const llmConfig: LLMConfig = {
                baseURL: 'http://localhost:11434/v1',
                model: 'llama3',
            };

            const result = await extract({
                input: 'Name: Alice',
                schema,
                llmConfig,
                debug: true,
            });

            expect(result.success).toBe(true);
            expect(result.steps).toBeDefined();
            expect(result.steps?.length).toBeGreaterThan(0);
            expect(result.steps?.[0].step).toBe('create_client');
        });
    });

    describe('validation failures', () => {
        it('should fail on missing required field', async () => {
            // Mock LLM response with missing field
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{
                        message: {
                            content: JSON.stringify({
                                data: {
                                    name: 'John',
                                },
                                confidence: 95,
                                confidenceByField: {
                                    name: 95,
                                },
                            }),
                        },
                    }],
                }),
            });

            const schema: Schema = {
                fields: {
                    name: { type: 'string' },
                    age: { type: 'number' },
                },
            };

            const llmConfig: LLMConfig = {
                baseURL: 'http://localhost:11434/v1',
                model: 'llama3',
            };

            const pipeline = new ExtractionPipeline();
            const result = await pipeline.extract({
                input: 'Name: John',
                schema,
                llmConfig,
            });

            expect(result.success).toBe(false);
            expect(result.errors.length).toBeGreaterThan(0);
            expect(result.errors[0].field).toBe('age');
            expect(result.errors[0].code).toBe('FIELD_MISSING');
        });

        it('should fail on type mismatch', async () => {
            // Mock LLM response with wrong type
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{
                        message: {
                            content: JSON.stringify({
                                data: {
                                    name: 'John',
                                    age: 'thirty',
                                },
                                confidence: 95,
                                confidenceByField: {
                                    name: 95,
                                    age: 80,
                                },
                            }),
                        },
                    }],
                }),
            });

            const schema: Schema = {
                fields: {
                    name: { type: 'string' },
                    age: { type: 'number' },
                },
            };

            const llmConfig: LLMConfig = {
                baseURL: 'http://localhost:11434/v1',
                model: 'llama3',
            };

            const pipeline = new ExtractionPipeline();
            const result = await pipeline.extract({
                input: 'test',
                schema,
                llmConfig,
            });

            expect(result.success).toBe(false);
            expect(result.errors.some(e => e.code === 'TYPE_MISMATCH')).toBe(true);
        });
    });

    describe('confidence threshold', () => {
        it('should pass when confidence meets threshold', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{
                        message: {
                            content: JSON.stringify({
                                data: { name: 'John' },
                                confidence: 90,
                                confidenceByField: { name: 90 },
                            }),
                        },
                    }],
                }),
            });

            const schema: Schema = {
                fields: {
                    name: { type: 'string' },
                },
                confidence: {
                    threshold: 85,
                    failOnLowConfidence: true,
                },
            };

            const llmConfig: LLMConfig = {
                baseURL: 'http://localhost:11434/v1',
                model: 'llama3',
            };

            const pipeline = new ExtractionPipeline();
            const result = await pipeline.extract({
                input: 'John',
                schema,
                llmConfig,
            });

            expect(result.success).toBe(true);
            expect(result.meetsThreshold).toBe(true);
        });

        it('should fail when confidence below threshold', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{
                        message: {
                            content: JSON.stringify({
                                data: { name: 'John' },
                                confidence: 70,
                                confidenceByField: { name: 70 },
                            }),
                        },
                    }],
                }),
            });

            const schema: Schema = {
                fields: {
                    name: { type: 'string' },
                },
                confidence: {
                    threshold: 85,
                    failOnLowConfidence: true,
                },
            };

            const llmConfig: LLMConfig = {
                baseURL: 'http://localhost:11434/v1',
                model: 'llama3',
            };

            const pipeline = new ExtractionPipeline();
            const result = await pipeline.extract({
                input: 'test',
                schema,
                llmConfig,
            });

            expect(result.success).toBe(false);
            expect(result.meetsThreshold).toBe(false);
            expect(result.errors.some(e => e.code === 'CONFIDENCE_ERROR')).toBe(true);
        });

        it('should warn but succeed when failOnLowConfidence is false', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{
                        message: {
                            content: JSON.stringify({
                                data: { name: 'John' },
                                confidence: 70,
                                confidenceByField: { name: 70 },
                            }),
                        },
                    }],
                }),
            });

            const schema: Schema = {
                fields: {
                    name: { type: 'string' },
                },
                confidence: {
                    threshold: 85,
                    failOnLowConfidence: false,
                },
            };

            const llmConfig: LLMConfig = {
                baseURL: 'http://localhost:11434/v1',
                model: 'llama3',
            };

            const pipeline = new ExtractionPipeline();
            const result = await pipeline.extract({
                input: 'test',
                schema,
                llmConfig,
            });

            expect(result.success).toBe(true);
            expect(result.meetsThreshold).toBe(false);
        });
    });

    describe('metadata', () => {
        it('should include metadata in result', async () => {
            mockFetch.mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    choices: [{
                        message: {
                            content: JSON.stringify({
                                data: { name: 'John' },
                                confidence: 90,
                                confidenceByField: { name: 90 },
                            }),
                        },
                    }],
                }),
            });

            const schema: Schema = {
                fields: {
                    name: { type: 'string' },
                },
                metadata: {
                    name: 'Test Schema',
                },
            };

            const llmConfig: LLMConfig = {
                baseURL: 'http://localhost:11434/v1',
                model: 'llama3',
            };

            const pipeline = new ExtractionPipeline();
            const result = await pipeline.extract({
                input: 'test',
                schema,
                llmConfig,
            });

            expect(result.metadata).toBeDefined();
            expect(result.metadata.model).toBe('llama3');
            expect(result.metadata.schemaName).toBe('Test Schema');
            expect(result.metadata.duration).toBeGreaterThanOrEqual(0);
        });
    });
});
