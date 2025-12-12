/**
 * Tests for LLM client
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LLMClient, LLMPresets } from '../client.js';
import { LLMError, LLMErrorCodes } from '../errors.js';
import type { Schema } from '../../schemas/types.js';
import type { LLMResponse } from '../types.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('LLMClient', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    describe('extract', () => {
        it('should extract data successfully', async () => {
            const mockResponse: LLMResponse = {
                id: 'test-id',
                object: 'chat.completion',
                created: Date.now(),
                model: 'test-model',
                choices: [
                    {
                        index: 0,
                        message: {
                            role: 'assistant',
                            content: JSON.stringify({
                                data: { name: 'John Doe', age: 30 },
                                confidence: 95,
                                confidenceByField: { name: 98, age: 92 },
                            }),
                        },
                        finish_reason: 'stop',
                    },
                ],
            };

            vi.mocked(fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            } as Response);

            const client = new LLMClient({
                baseURL: 'http://localhost:11434/v1',
                model: 'llama3',
            });

            const schema: Schema = {
                fields: {
                    name: { type: 'string' },
                    age: { type: 'number' },
                },
            };

            const result = await client.extract({
                schema,
                input: 'My name is John Doe and I am 30 years old',
            });

            expect(result.data.name).toBe('John Doe');
            expect(result.data.age).toBe(30);
            expect(result.confidence).toBe(95);
            expect(result.confidenceByField.name).toBe(98);
        });

        it('should handle markdown code blocks in response', async () => {
            const mockResponse: LLMResponse = {
                id: 'test-id',
                object: 'chat.completion',
                created: Date.now(),
                model: 'test-model',
                choices: [
                    {
                        index: 0,
                        message: {
                            role: 'assistant',
                            content: '```json\n{"data":{"name":"Alice"},"confidence":90,"confidenceByField":{"name":90}}\n```',
                        },
                        finish_reason: 'stop',
                    },
                ],
            };

            vi.mocked(fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            } as Response);

            const client = new LLMClient({
                baseURL: 'http://localhost:11434/v1',
                model: 'llama3',
            });

            const schema: Schema = {
                fields: {
                    name: { type: 'string' },
                },
            };

            const result = await client.extract({
                schema,
                input: 'Name: Alice',
            });

            expect(result.data.name).toBe('Alice');
        });

        it('should throw on invalid JSON response', async () => {
            const mockResponse: LLMResponse = {
                id: 'test-id',
                object: 'chat.completion',
                created: Date.now(),
                model: 'test-model',
                choices: [
                    {
                        index: 0,
                        message: {
                            role: 'assistant',
                            content: 'This is not JSON',
                        },
                        finish_reason: 'stop',
                    },
                ],
            };

            vi.mocked(fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            } as Response);

            const client = new LLMClient({
                baseURL: 'http://localhost:11434/v1',
                model: 'llama3',
            });

            const schema: Schema = {
                fields: {
                    name: { type: 'string' },
                },
            };

            await expect(
                client.extract({
                    schema,
                    input: 'test',
                })
            ).rejects.toThrow(LLMError);
        });

        it('should throw on missing data field', async () => {
            const mockResponse: LLMResponse = {
                id: 'test-id',
                object: 'chat.completion',
                created: Date.now(),
                model: 'test-model',
                choices: [
                    {
                        index: 0,
                        message: {
                            role: 'assistant',
                            content: JSON.stringify({
                                confidence: 95,
                                confidenceByField: {},
                            }),
                        },
                        finish_reason: 'stop',
                    },
                ],
            };

            vi.mocked(fetch).mockResolvedValueOnce({
                ok: true,
                json: async () => mockResponse,
            } as Response);

            const client = new LLMClient({
                baseURL: 'http://localhost:11434/v1',
                model: 'llama3',
            });

            const schema: Schema = {
                fields: {
                    name: { type: 'string' },
                },
            };

            await expect(
                client.extract({
                    schema,
                    input: 'test',
                })
            ).rejects.toThrow('missing data object');
        });
    });

    describe('error handling', () => {
        it('should handle 401 authentication error', async () => {
            vi.mocked(fetch).mockResolvedValueOnce({
                ok: false,
                status: 401,
                statusText: 'Unauthorized',
                json: async () => ({ error: { message: 'Invalid API key' } }),
            } as Response);

            const client = new LLMClient({
                baseURL: 'https://api.openai.com/v1',
                apiKey: 'invalid-key',
                model: 'gpt-4',
            });

            const schema: Schema = {
                fields: {
                    name: { type: 'string' },
                },
            };

            try {
                await client.extract({ schema, input: 'test' });
                expect.fail('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(LLMError);
                expect((error as LLMError).code).toBe(LLMErrorCodes.AUTHENTICATION_ERROR);
            }
        });

        it('should handle 429 rate limit error', async () => {
            // Mock all retries to fail with 429
            vi.mocked(fetch).mockResolvedValue({
                ok: false,
                status: 429,
                statusText: 'Too Many Requests',
                headers: new Headers(),
                json: async () => ({ error: { message: 'Rate limit exceeded' } }),
            } as Response);

            const client = new LLMClient({
                baseURL: 'https://api.openai.com/v1',
                apiKey: 'key',
                model: 'gpt-4',
                retries: {
                    maxRetries: 2,
                    initialDelay: 10,
                    maxDelay: 100,
                    backoffFactor: 2,
                },
            });

            const schema: Schema = {
                fields: {
                    name: { type: 'string' },
                },
            };

            try {
                await client.extract({ schema, input: 'test' });
            } catch (error) {
                expect((error as LLMError).code).toBe(LLMErrorCodes.RATE_LIMIT);
            }
        });

        it('should handle network errors', async () => {
            // Mock all retries to fail with network error
            vi.mocked(fetch).mockRejectedValue(new Error('Network failure'));

            const client = new LLMClient({
                baseURL: 'http://localhost:11434/v1',
                model: 'llama3',
                retries: {
                    maxRetries: 2,
                    initialDelay: 10,
                    maxDelay: 100,
                    backoffFactor: 2,
                },
            });

            const schema: Schema = {
                fields: {
                    name: { type: 'string' },
                },
            };

            try {
                await client.extract({ schema, input: 'test' });
            } catch (error) {
                expect((error as LLMError).code).toBe(LLMErrorCodes.NETWORK_ERROR);
            }
        });
    });

    describe('LLMPresets', () => {
        it('should create Ollama config', () => {
            const config = LLMPresets.ollama('llama3');
            expect(config.baseURL).toBe('http://localhost:11434/v1');
            expect(config.model).toBe('llama3');
            expect(config.apiKey).toBeUndefined();
        });

        it('should create LM Studio config', () => {
            const config = LLMPresets.lmStudio('my-model');
            expect(config.baseURL).toBe('http://localhost:1234/v1');
            expect(config.model).toBe('my-model');
        });

        it('should create OpenAI config', () => {
            const config = LLMPresets.openai('sk-test', 'gpt-4');
            expect(config.baseURL).toBe('https://api.openai.com/v1');
            expect(config.model).toBe('gpt-4');
            expect(config.apiKey).toBe('sk-test');
        });

        it('should create OpenRouter config', () => {
            const config = LLMPresets.openrouter('key', 'openai/gpt-4o-mini');
            expect(config.baseURL).toBe('https://openrouter.ai/api/v1');
            expect(config.model).toBe('openai/gpt-4o-mini');
            expect(config.apiKey).toBe('key');
        });
    });
});
