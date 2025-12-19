/**
 * Benchmark: Schema validation performance
 */

import { validateSchema } from '../src/schemas/validator.js';
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
        invoice_id: { type: 'string', pattern: '^INV-\\d{4}-\\d{4}$' },
        amount: { type: 'number', min: 0, max: 1000000 },
        currency: { type: 'string', enum: ['USD', 'EUR', 'GBP', 'JPY', 'SGD'] },
        date: { type: 'string', format: 'date-time', optional: true },
        items: { type: 'string', optional: true },
        tax_rate: { type: 'number', min: 0, max: 1, optional: true },
        discount: { type: 'number', min: 0, max: 1, optional: true },
        notes: { type: 'string', optional: true },
        customer_name: { type: 'string' },
        customer_email: { type: 'string' }
    },
    confidence: {
        threshold: 80,
        failOnLowConfidence: true
    }
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

console.log('=== Schema Validation Benchmarks ===\n');

benchmark('Simple schema validation', () => {
    validateSchema(simpleSchema);
}, 10000);

console.log('');

benchmark('Complex schema validation', () => {
    validateSchema(complexSchema);
}, 10000);
