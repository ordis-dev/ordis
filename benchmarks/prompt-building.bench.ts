/**
 * Benchmark: Prompt building performance
 */

import { buildSystemPrompt, buildUserPrompt } from '../src/llm/prompt-builder.js';
import type { Schema } from '../src/schemas/types.js';

// Simple schema
const simpleSchema: Schema = {
    fields: {
        name: { type: 'string' },
        amount: { type: 'number' }
    }
};

// Complex schema
const complexSchema: Schema = {
    fields: {
        invoice_id: { type: 'string', pattern: '^INV-\\d{4}-\\d{4}$', description: 'Unique invoice identifier' },
        amount: { type: 'number', min: 0, max: 1000000, description: 'Invoice total amount' },
        currency: { type: 'string', enum: ['USD', 'EUR', 'GBP', 'JPY', 'SGD'], description: 'Currency code' },
        date: { type: 'string', format: 'date-time', optional: true, description: 'Invoice date' },
        items: { type: 'string', optional: true, description: 'Line items description' },
        tax_rate: { type: 'number', min: 0, max: 1, optional: true, description: 'Tax rate as decimal' },
        discount: { type: 'number', min: 0, max: 1, optional: true, description: 'Discount rate' },
        notes: { type: 'string', optional: true, description: 'Additional notes' },
        customer_name: { type: 'string', description: 'Customer full name' },
        customer_email: { type: 'string', description: 'Customer email address' }
    },
    confidence: {
        threshold: 80,
        failOnLowConfidence: true
    }
};

// Test inputs of different sizes
const smallInput = 'Invoice #123, Amount: $100';
const mediumInput = `
Invoice Number: INV-2024-0042
Date: December 5, 2024
Customer: John Doe
Email: john@example.com
Amount: $1,250.00
Currency: USD
Tax Rate: 8.5%
Items: 
  - Widget A x 10 @ $50.00
  - Widget B x 5 @ $100.00
Notes: Rush order, deliver by Friday
`.trim();

const largeInput = mediumInput.repeat(10);

function benchmark(name: string, fn: () => void, iterations: number = 10000) {
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
        fn();
    }
    const end = performance.now();
    const total = end - start;
    const avg = total / iterations;
    
    console.log(`${name}:`);
    console.log(`  Total: ${total.toFixed(2)}ms`);
    console.log(`  Average: ${avg.toFixed(4)}ms`);
    console.log(`  Ops/sec: ${(1000 / avg).toFixed(0)}`);
}

console.log('=== Prompt Building Benchmarks ===\n');

console.log('--- System Prompt Building ---\n');

benchmark('Simple schema system prompt', () => {
    buildSystemPrompt(simpleSchema);
}, 10000);

console.log('');

benchmark('Complex schema system prompt', () => {
    buildSystemPrompt(complexSchema);
}, 10000);

console.log('\n--- User Prompt Building ---\n');

benchmark('Small input (25 chars)', () => {
    buildUserPrompt(smallInput);
}, 10000);

console.log('');

benchmark('Medium input (~300 chars)', () => {
    buildUserPrompt(mediumInput);
}, 10000);

console.log('');

benchmark('Large input (~3000 chars)', () => {
    buildUserPrompt(largeInput);
}, 1000);
