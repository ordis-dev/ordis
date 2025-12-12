/**
 * Tests for retry logic
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LLMClient } from '../client.js';
import { LLMError, LLMErrorCodes } from '../errors.js';
import type { Schema } from '../../schemas/types.js';
import type { LLMResponse } from '../types.js';

// Mock fetch globally
global.fetch = vi.fn();

describe('Retry Logic', () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    const mockSuccessResponse: LLMResponse = {
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
                        data: { name: 'Test' },
                        confidence: 95,
                        confidenceByField: { name: 95 },
                    }),
                },
                finish_reason: 'stop',
            },
        ],
    };

    const schema: Schema = {
        fields: {
            name: { type: 'string' },
        },
    };

    describe('Network errors', () => {
        it('should retry on network errors', async () => {
            let callCount = 0;
            
            vi.mocked(fetch).mockImplementation(async () => {
                callCount++;
                if (callCount < 3) {
                    throw new Error('Network failure');
                }
                return {
                    ok: true,
                    json: async () => mockSuccessResponse,
                } as Response;
            });

            const client = new LLMClient({
                baseURL: 'http://localhost:11434/v1',
                model: 'llama3',
                retries: {
                    maxRetries: 3,
                    initialDelay: 10,
                    maxDelay: 100,
                    backoffFactor: 2,
                },
            });

            const result = await client.extract({
                schema,
                input: 'Name: Test',
            });

            expect(result.data.name).toBe('Test');
            expect(callCount).toBe(3);
        });

        it('should fail after max retries', async () => {
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

            await expect(
                client.extract({
                    schema,
                    input: 'Name: Test',
                })
            ).rejects.toThrow('Network error');
        });
    });

    describe('Rate limiting', () => {
        it('should retry on 429 errors', async () => {
            let callCount = 0;

            vi.mocked(fetch).mockImplementation(async () => {
                callCount++;
                if (callCount < 2) {
                    return {
                        ok: false,
                        status: 429,
                        statusText: 'Too Many Requests',
                        headers: new Headers(),
                        json: async () => ({ error: { message: 'Rate limit exceeded' } }),
                    } as Response;
                }
                return {
                    ok: true,
                    json: async () => mockSuccessResponse,
                } as Response;
            });

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

            const result = await client.extract({
                schema,
                input: 'Name: Test',
            });

            expect(result.data.name).toBe('Test');
            expect(callCount).toBe(2);
        });

        it('should respect Retry-After header', async () => {
            let callCount = 0;
            const startTime = Date.now();

            vi.mocked(fetch).mockImplementation(async () => {
                callCount++;
                if (callCount < 2) {
                    const headers = new Headers();
                    headers.set('Retry-After', '0'); // Use 0 for testing
                    return {
                        ok: false,
                        status: 429,
                        statusText: 'Too Many Requests',
                        headers,
                        json: async () => ({ error: { message: 'Rate limit exceeded' } }),
                    } as Response;
                }
                return {
                    ok: true,
                    json: async () => mockSuccessResponse,
                } as Response;
            });

            const client = new LLMClient({
                baseURL: 'http://localhost:11434/v1',
                model: 'llama3',
                retries: {
                    maxRetries: 2,
                    initialDelay: 100,
                    maxDelay: 10000,
                    backoffFactor: 2,
                },
            });

            const result = await client.extract({
                schema,
                input: 'Name: Test',
            });

            expect(result.data.name).toBe('Test');
            
            // Should complete quickly since Retry-After is 0
            const elapsed = Date.now() - startTime;
            expect(elapsed).toBeLessThan(1000);
        });
    });

    describe('Non-retryable errors', () => {
        it('should not retry on authentication errors', async () => {
            let callCount = 0;

            vi.mocked(fetch).mockImplementation(async () => {
                callCount++;
                return {
                    ok: false,
                    status: 401,
                    statusText: 'Unauthorized',
                    headers: new Headers(),
                    json: async () => ({ error: { message: 'Invalid API key' } }),
                } as Response;
            });

            const client = new LLMClient({
                baseURL: 'http://localhost:11434/v1',
                model: 'llama3',
                apiKey: 'invalid',
                retries: {
                    maxRetries: 3,
                    initialDelay: 10,
                    maxDelay: 100,
                    backoffFactor: 2,
                },
            });

            await expect(
                client.extract({
                    schema,
                    input: 'Name: Test',
                })
            ).rejects.toThrow('Invalid API key');

            expect(callCount).toBe(1); // Should not retry
        });

        it('should not retry on invalid response', async () => {
            let callCount = 0;

            vi.mocked(fetch).mockImplementation(async () => {
                callCount++;
                return {
                    ok: true,
                    json: async () => ({
                        id: 'test-id',
                        object: 'chat.completion',
                        created: Date.now(),
                        model: 'test-model',
                        choices: [
                            {
                                index: 0,
                                message: {
                                    role: 'assistant',
                                    content: 'This is not valid JSON',
                                },
                                finish_reason: 'stop',
                            },
                        ],
                    }),
                } as Response;
            });

            const client = new LLMClient({
                baseURL: 'http://localhost:11434/v1',
                model: 'llama3',
                retries: {
                    maxRetries: 3,
                    initialDelay: 10,
                    maxDelay: 100,
                    backoffFactor: 2,
                },
            });

            await expect(
                client.extract({
                    schema,
                    input: 'Name: Test',
                })
            ).rejects.toThrow('Failed to parse');

            expect(callCount).toBe(1); // Should not retry
        });
    });

    describe('Exponential backoff', () => {
        it('should use exponential backoff with jitter', async () => {
            const delays: number[] = [];
            let callCount = 0;

            // Spy on the sleep method to capture delays
            const sleepSpy = vi.fn(async (ms: number) => {
                delays.push(ms);
                await new Promise(resolve => setTimeout(resolve, 1)); // Fast forward
            });

            vi.mocked(fetch).mockImplementation(async () => {
                callCount++;
                if (callCount < 4) {
                    throw new Error('Network failure');
                }
                return {
                    ok: true,
                    json: async () => mockSuccessResponse,
                } as Response;
            });

            const client = new LLMClient({
                baseURL: 'http://localhost:11434/v1',
                model: 'llama3',
                retries: {
                    maxRetries: 3,
                    initialDelay: 1000,
                    maxDelay: 10000,
                    backoffFactor: 2,
                },
            });

            // Replace sleep method
            (client as any).sleep = sleepSpy;

            await client.extract({
                schema,
                input: 'Name: Test',
            });

            // Should have 3 retries (after 1st, 2nd, and 3rd failures)
            expect(delays.length).toBe(3);
            
            // Check exponential backoff pattern with jitter
            // First retry: ~1000ms (1000 * 2^0)
            expect(delays[0]).toBeGreaterThanOrEqual(1000);
            expect(delays[0]).toBeLessThan(1250);
            
            // Second retry: ~2000ms (1000 * 2^1)
            expect(delays[1]).toBeGreaterThanOrEqual(2000);
            expect(delays[1]).toBeLessThan(2500);
            
            // Third retry: ~4000ms (1000 * 2^2)
            expect(delays[2]).toBeGreaterThanOrEqual(4000);
            expect(delays[2]).toBeLessThan(5000);
        });

        it('should cap delay at maxDelay', async () => {
            const delays: number[] = [];
            let callCount = 0;

            const sleepSpy = vi.fn(async (ms: number) => {
                delays.push(ms);
                await new Promise(resolve => setTimeout(resolve, 1));
            });

            vi.mocked(fetch).mockImplementation(async () => {
                callCount++;
                if (callCount < 4) {
                    throw new Error('Network failure');
                }
                return {
                    ok: true,
                    json: async () => mockSuccessResponse,
                } as Response;
            });

            const client = new LLMClient({
                baseURL: 'http://localhost:11434/v1',
                model: 'llama3',
                retries: {
                    maxRetries: 3,
                    initialDelay: 5000,
                    maxDelay: 6000,
                    backoffFactor: 3,
                },
            });

            (client as any).sleep = sleepSpy;

            await client.extract({
                schema,
                input: 'Name: Test',
            });

            // All delays should be capped at maxDelay (6000ms)
            delays.forEach(delay => {
                expect(delay).toBeLessThanOrEqual(6000);
            });
        });
    });

    describe('Default configuration', () => {
        it('should use default retry config when not specified', async () => {
            let callCount = 0;

            vi.mocked(fetch).mockImplementation(async () => {
                callCount++;
                if (callCount < 3) {
                    throw new Error('Network failure');
                }
                return {
                    ok: true,
                    json: async () => mockSuccessResponse,
                } as Response;
            });

            const client = new LLMClient({
                baseURL: 'http://localhost:11434/v1',
                model: 'llama3',
                // No retry config provided - should use defaults
            });

            // Replace sleep to speed up test
            (client as any).sleep = async () => {
                await new Promise(resolve => setTimeout(resolve, 1));
            };

            const result = await client.extract({
                schema,
                input: 'Name: Test',
            });

            expect(result.data.name).toBe('Test');
            expect(callCount).toBe(3);
        });
    });
});
