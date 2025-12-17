/**
 * Tests for prompt builder
 */

import { describe, it, expect } from 'vitest';
import { buildSystemPrompt, buildUserPrompt } from '../prompt-builder.js';
import type { Schema } from '../../schemas/types.js';

describe('Prompt Builder', () => {
    describe('buildSystemPrompt', () => {
        it('should build basic system prompt', () => {
            const schema: Schema = {
                fields: {
                    name: { type: 'string' },
                    age: { type: 'number' },
                },
            };

            const prompt = buildSystemPrompt(schema);

            expect(prompt).toContain('data extraction');
            expect(prompt).toContain('name: string');
            expect(prompt).toContain('age: number');
            expect(prompt).toContain('only valid JSON');
        });

        it('should include field descriptions', () => {
            const schema: Schema = {
                fields: {
                    email: {
                        type: 'string',
                        description: 'User email address',
                    },
                },
            };

            const prompt = buildSystemPrompt(schema);

            expect(prompt).toContain('User email address');
        });

        it('should mark optional fields', () => {
            const schema: Schema = {
                fields: {
                    name: { type: 'string' },
                    nickname: { type: 'string', optional: true },
                },
            };

            const prompt = buildSystemPrompt(schema);

            expect(prompt).toContain('nickname: string (optional)');
        });

        it('should include enum values', () => {
            const schema: Schema = {
                fields: {
                    status: {
                        type: 'enum',
                        enum: ['active', 'inactive', 'pending'],
                    },
                },
            };

            const prompt = buildSystemPrompt(schema);

            expect(prompt).toContain('active, inactive, pending');
        });

        it('should include number constraints', () => {
            const schema: Schema = {
                fields: {
                    age: { type: 'number', min: 0, max: 120 },
                },
            };

            const prompt = buildSystemPrompt(schema);

            expect(prompt).toContain('range: 0 to 120');
        });

        it('should include pattern for strings', () => {
            const schema: Schema = {
                fields: {
                    zipcode: {
                        type: 'string',
                        pattern: '^\\d{5}$',
                    },
                },
            };

            const prompt = buildSystemPrompt(schema);

            expect(prompt).toContain('pattern: ^\\d{5}$');
        });

        it('should include confidence requirements', () => {
            const schema: Schema = {
                fields: {
                    name: { type: 'string' },
                },
                confidence: {
                    threshold: 85,
                    failOnLowConfidence: true,
                },
            };

            const prompt = buildSystemPrompt(schema);

            expect(prompt).toContain('threshold: 85%');
            expect(prompt).toContain('confidence score');
        });

        it('should include response format', () => {
            const schema: Schema = {
                fields: {
                    id: { type: 'string' },
                    count: { type: 'number' },
                },
            };

            const prompt = buildSystemPrompt(schema);

            expect(prompt).toContain('"data"');
            expect(prompt).toContain('"confidence"');
            expect(prompt).toContain('"confidenceByField"');
        });

        it('should NOT include few-shot examples by default', () => {
            const schema: Schema = {
                fields: {
                    name: { type: 'string' },
                    age: { type: 'number' },
                },
            };

            const prompt = buildSystemPrompt(schema);

            expect(prompt).not.toContain('Example extraction:');
            expect(prompt).not.toContain('INV-2024-0042');
        });

        it('should include few-shot examples when explicitly enabled', () => {
            const schema: Schema = {
                fields: {
                    name: { type: 'string' },
                    age: { type: 'number' },
                },
                prompt: {
                    includeFewShotExamples: true,
                },
            };

            const prompt = buildSystemPrompt(schema);

            expect(prompt).toContain('Example extraction:');
            expect(prompt).toContain('Input text:');
            expect(prompt).toContain('Output:');
        });

        it('should include example with null values when enabled', () => {
            const schema: Schema = {
                fields: {
                    email: { type: 'string' },
                    phone: { type: 'string', optional: true },
                },
                prompt: {
                    includeFewShotExamples: true,
                },
            };

            const prompt = buildSystemPrompt(schema);

            expect(prompt).toContain('null');
            expect(prompt).toContain('missing or uncertain');
        });

        it('should include invoice example when enabled', () => {
            const schema: Schema = {
                fields: {
                    invoice_id: { type: 'string' },
                    amount: { type: 'number' },
                },
                prompt: {
                    includeFewShotExamples: true,
                },
            };

            const prompt = buildSystemPrompt(schema);

            expect(prompt).toContain('INV-2024-0042');
            expect(prompt).toContain('1250.00');
        });
    });

    describe('buildUserPrompt', () => {
        it('should wrap input text', () => {
            const input = 'Name: John Doe\nAge: 30';
            const prompt = buildUserPrompt(input);

            expect(prompt).toContain('Extract data');
            expect(prompt).toContain(input);
        });

        it('should handle multiline input', () => {
            const input = 'Line 1\nLine 2\nLine 3';
            const prompt = buildUserPrompt(input);

            expect(prompt).toContain(input);
        });
    });
});
