/**
 * Benchmark: End-to-end extraction performance
 * Note: Uses mocked LLM to isolate extraction pipeline performance
 */

import { extract } from '../src/core/pipeline.js';
import { loadSchemaFromObject } from '../src/schemas/loader.js';
import type { LLMConfig, LLMResponse } from '../src/llm/types.js';

// Create test schema
const schema = loadSchemaFromObject({
    fields: {
        invoice_id: { type: 'string' },
        amount: { type: 'number' },
        currency: { type: 'string', enum: ['USD', 'EUR', 'GBP'] },
        date: { type: 'string', format: 'date-time', optional: true }
    },
    confidence: {
        threshold: 80,
        failOnLowConfidence: true
    }
});

// Test inputs of different sizes
const smallInput = 'Invoice #INV-2024-0042, Amount: $1,250 USD, Date: 2024-12-05';

const mediumInput = `
Invoice Number: INV-2024-0042
Date: December 5, 2024
Customer: John Doe
Email: john@example.com

Items:
  - Widget A x 10 @ $50.00 = $500.00
  - Widget B x 5 @ $100.00 = $500.00
  - Widget C x 1 @ $250.00 = $250.00

Subtotal: $1,250.00
Tax (8.5%): $106.25
Total: $1,356.25
Currency: USD

Payment Terms: Net 30
Due Date: January 5, 2025
`.trim();

const largeInput = `
${mediumInput}

Additional Notes:
This is a rush order requiring expedited processing. Customer has requested
delivery by end of week. All items are in stock and ready to ship. Warehouse
has been notified of the urgency.

Customer Account History:
- Account opened: 2020-01-15
- Total orders to date: 156
- Average order value: $1,850
- Payment history: Excellent (always on time)
- Preferred shipping: FedEx Express

Special Instructions:
- Package items separately
- Include gift wrapping for Widget C
- Add promotional materials
- Send tracking info to both customer email and phone
- Signature required upon delivery

${mediumInput.repeat(2)}
`.trim();

// Mock LLM config with instant response
const mockLLMConfig: LLMConfig = {
    baseURL: 'http://localhost:11434/v1',
    model: 'mock-model'
};

// Mock successful response
const mockResponse: LLMResponse = {
    id: 'mock-id',
    object: 'chat.completion',
    created: Date.now(),
    model: 'mock-model',
    choices: [{
        index: 0,
        message: {
            role: 'assistant',
            content: JSON.stringify({
                data: {
                    invoice_id: 'INV-2024-0042',
                    amount: 1250,
                    currency: 'USD',
                    date: '2024-12-05'
                },
                confidence: 95,
                confidenceByField: {
                    invoice_id: 100,
                    amount: 100,
                    currency: 100,
                    date: 90
                }
            })
        },
        finish_reason: 'stop'
    }]
};

// Mock fetch globally for benchmarking
const originalFetch = global.fetch;
global.fetch = async () => {
    return new Response(JSON.stringify(mockResponse), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
    });
};

async function benchmarkAsync(name: string, fn: () => Promise<void>, iterations: number = 100) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
        await fn();
    }
    const end = performance.now();
    const total = end - start;
    const avg = total / iterations;
    
    console.log(`${name}:`);
    console.log(`  Total: ${total.toFixed(2)}ms`);
    console.log(`  Average: ${avg.toFixed(2)}ms`);
    console.log(`  Ops/sec: ${(1000 / avg).toFixed(1)}`);
}

async function runBenchmarks() {
    console.log('=== End-to-End Extraction Benchmarks ===');
    console.log('(Using mocked LLM for consistent timing)\n');

    await benchmarkAsync('Small input (~60 chars)', async () => {
        await extract({
            input: smallInput,
            schema,
            llmConfig: mockLLMConfig
        });
    }, 100);

    console.log('');

    await benchmarkAsync('Medium input (~300 chars)', async () => {
        await extract({
            input: mediumInput,
            schema,
            llmConfig: mockLLMConfig
        });
    }, 100);

    console.log('');

    await benchmarkAsync('Large input (~1500 chars)', async () => {
        await extract({
            input: largeInput,
            schema,
            llmConfig: mockLLMConfig
        });
    }, 50);

    // Restore original fetch
    global.fetch = originalFetch;
}

runBenchmarks().catch(console.error);
