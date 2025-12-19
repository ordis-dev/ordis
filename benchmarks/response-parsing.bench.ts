/**
 * Benchmark: Response parsing performance
 */

import { validateExtractedData } from '../src/core/validator.js';
import type { Schema } from '../src/schemas/types.js';

const schema: Schema = {
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
};

// Valid response
const validData = {
    invoice_id: 'INV-2024-0042',
    amount: 1250,
    currency: 'USD',
    date: '2024-12-05'
};

const confidenceByField = {
    invoice_id: 100,
    amount: 100,
    currency: 100,
    date: 95
};

// Response with errors
const invalidData = {
    invoice_id: 'INV-2024-0042',
    amount: 'not-a-number', // Type error
    currency: 'INVALID', // Enum error
    date: '2024-12-05'
};

const lowConfidence = {
    invoice_id: 50,
    amount: 60,
    currency: 70,
    date: 40
};

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

console.log('=== Response Parsing Benchmarks ===\n');

benchmark('Valid response validation', () => {
    validateExtractedData(validData, schema);
}, 10000);

console.log('');

benchmark('Invalid response validation', () => {
    try {
        validateExtractedData(invalidData, schema);
    } catch (e) {
        // Expected to fail
    }
}, 10000);

console.log('');

benchmark('JSON parsing (simulated)', () => {
    const json = JSON.stringify({ data: validData, confidence: 95, confidenceByField });
    JSON.parse(json);
}, 10000);
