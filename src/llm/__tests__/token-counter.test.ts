/**
 * Token counter tests
 */

import { describe, test, expect } from 'vitest';
import { estimateTokens, TokenCounter } from '../token-counter.js';

describe('estimateTokens', () => {
    test('returns 0 for empty string', () => {
        expect(estimateTokens('')).toBe(0);
    });

    test('estimates tokens using 4 chars per token', () => {
        // 20 characters = 5 tokens
        expect(estimateTokens('12345678901234567890')).toBe(5);
    });

    test('rounds up for partial tokens', () => {
        // 21 characters = 6 tokens (5.25 rounded up)
        expect(estimateTokens('123456789012345678901')).toBe(6);
    });

    test('handles longer text', () => {
        const text = 'The quick brown fox jumps over the lazy dog. '.repeat(10);
        const tokens = estimateTokens(text);
        expect(tokens).toBeGreaterThan(0);
        // 45 chars * 10 = 450 chars = ~113 tokens
        expect(tokens).toBeCloseTo(113, 0);
    });
});

describe('TokenCounter', () => {
    describe('calculateUsage', () => {
        test('calculates token usage correctly', () => {
            const counter = new TokenCounter({
                maxContextTokens: 4096,
                tokenBudget: {
                    system: 1000,
                    input: 2000,
                    output: 1000,
                },
            });

            // 400 chars = 100 tokens, 800 chars = 200 tokens
            const system = 'a'.repeat(400);
            const input = 'b'.repeat(800);

            const usage = counter.calculateUsage(system, input);

            expect(usage.systemTokens).toBe(100);
            expect(usage.inputTokens).toBe(200);
            expect(usage.outputTokens).toBe(1000);
            expect(usage.totalTokens).toBe(1300);
            expect(usage.maxContextTokens).toBe(4096);
            expect(usage.usagePercent).toBeCloseTo(31.7, 1);
        });

        test('handles empty strings', () => {
            const counter = new TokenCounter();
            const usage = counter.calculateUsage('', '');

            expect(usage.systemTokens).toBe(0);
            expect(usage.inputTokens).toBe(0);
            expect(usage.totalTokens).toBe(1000); // just output tokens
        });
    });

    describe('exceedsLimit', () => {
        test('returns true when total exceeds max', () => {
            const counter = new TokenCounter({ maxContextTokens: 100 });
            const usage = counter.calculateUsage('a'.repeat(400), 'b'.repeat(400));
            // 100 + 100 + 1000 = 1200 > 100
            expect(counter.exceedsLimit(usage)).toBe(true);
        });

        test('returns false when under limit', () => {
            const counter = new TokenCounter({ maxContextTokens: 4096 });
            const usage = counter.calculateUsage('a'.repeat(400), 'b'.repeat(400));
            // 100 + 100 + 1000 = 1200 < 4096
            expect(counter.exceedsLimit(usage)).toBe(false);
        });

        test('returns false when exactly at limit', () => {
            const counter = new TokenCounter({ maxContextTokens: 1200 });
            const usage = counter.calculateUsage('a'.repeat(400), 'b'.repeat(400));
            // 100 + 100 + 1000 = 1200 === 1200
            expect(counter.exceedsLimit(usage)).toBe(false);
        });
    });

    describe('shouldWarn', () => {
        test('returns true when usage exceeds warn threshold', () => {
            const counter = new TokenCounter({
                maxContextTokens: 1000,
                warnThreshold: 90,
            });
            // 360 + 360 + 1000 = 1720 tokens = 172% (way over)
            const usage = counter.calculateUsage('a'.repeat(1440), 'b'.repeat(1440));
            expect(counter.shouldWarn(usage)).toBe(true);
        });

        test('returns false when under warn threshold', () => {
            const counter = new TokenCounter({
                maxContextTokens: 4096,
                warnThreshold: 90,
            });
            // 100 + 100 + 1000 = 1200 = ~29%
            const usage = counter.calculateUsage('a'.repeat(400), 'b'.repeat(400));
            expect(counter.shouldWarn(usage)).toBe(false);
        });

        test('uses 90% default threshold', () => {
            const counter = new TokenCounter({ maxContextTokens: 1000 });
            // Need 900+ tokens to trigger warning
            // 200 + 200 + 1000 = 1400 = 140%
            const usage = counter.calculateUsage('a'.repeat(800), 'b'.repeat(800));
            expect(counter.shouldWarn(usage)).toBe(true);
        });
    });

    describe('formatUsage', () => {
        test('formats usage information', () => {
            const counter = new TokenCounter({ maxContextTokens: 4096 });
            const usage = counter.calculateUsage('a'.repeat(400), 'b'.repeat(800));

            const formatted = counter.formatUsage(usage);

            expect(formatted).toContain('Token usage:');
            expect(formatted).toContain('1300/4096');
            expect(formatted).toContain('System prompt: 100 tokens');
            expect(formatted).toContain('Input: 200 tokens');
            expect(formatted).toContain('Reserved for output: 1000 tokens');
        });
    });

    describe('getErrorMessage', () => {
        test('provides detailed error message when limit exceeded', () => {
            const counter = new TokenCounter({ maxContextTokens: 1000 });
            const usage = counter.calculateUsage('a'.repeat(1000), 'b'.repeat(2000));
            // 250 + 500 + 1000 = 1750 tokens

            const message = counter.getErrorMessage(usage);

            expect(message).toContain('Token budget exceeded');
            expect(message).toContain('1750/1000');
            expect(message).toContain('750 over limit');
            expect(message).toContain('System prompt: 250 tokens');
            expect(message).toContain('Input: 500 tokens');
            expect(message).toContain('Suggestions:');
        });
    });

    describe('getWarningMessage', () => {
        test('provides warning message when approaching limit', () => {
            const counter = new TokenCounter({ maxContextTokens: 1000 });
            const usage = counter.calculateUsage('a'.repeat(800), 'b'.repeat(800));

            const message = counter.getWarningMessage(usage);

            expect(message).toContain('⚠');
            expect(message).toContain('Approaching token budget limit');
            expect(message).toContain('System:');
            expect(message).toContain('Input:');
            expect(message).toContain('Output:');
        });
    });

    describe('configuration', () => {
        test('uses default values when not specified', () => {
            const counter = new TokenCounter();
            const usage = counter.calculateUsage('', '');

            expect(usage.maxContextTokens).toBe(4096);
            expect(usage.outputTokens).toBe(1000);
        });

        test('respects custom maxContextTokens', () => {
            const counter = new TokenCounter({ maxContextTokens: 8192 });
            const usage = counter.calculateUsage('', '');

            expect(usage.maxContextTokens).toBe(8192);
        });

        test('respects custom token budget', () => {
            const counter = new TokenCounter({
                tokenBudget: {
                    system: 500,
                    input: 1500,
                    output: 2000,
                },
            });
            const usage = counter.calculateUsage('', '');

            expect(usage.outputTokens).toBe(2000);
        });
    });
});
