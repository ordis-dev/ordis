/**
 * Prompt builder - generates prompts from schemas
 */

import type { Schema } from '../schemas/types.js';

/**
 * Builds a system prompt for extraction
 */
export function buildSystemPrompt(schema: Schema): string {
    const { fields, metadata, confidence, prompt } = schema;

    let promptText = `You are a structured data extraction system. Extract information from text according to the schema below.

Rules:
- Return only valid JSON (no markdown, no explanation)
- Include a confidence score (0-100) for each field
- Use null for missing or uncertain values
- Include all fields in the response, even if null

Schema:
`;

    // Add field definitions
    for (const [fieldName, fieldDef] of Object.entries(fields)) {
        promptText += `\n- ${fieldName}: ${fieldDef.type}`;
        if (fieldDef.optional) {
            promptText += ' (optional)';
        }
        if (fieldDef.description) {
            promptText += ` - ${fieldDef.description}`;
        }
        if (fieldDef.enum) {
            promptText += ` - allowed values: ${fieldDef.enum.join(', ')}`;
        }
        if (fieldDef.min !== undefined || fieldDef.max !== undefined) {
            const min = fieldDef.min !== undefined ? fieldDef.min : 'null';
            const max = fieldDef.max !== undefined ? fieldDef.max : 'null';
            promptText += ` - range: ${min} to ${max}`;
        }
        if (fieldDef.pattern) {
            promptText += ` - pattern: ${fieldDef.pattern}`;
        }
    }

    // Add confidence requirements
    if (confidence) {
        promptText += `\n\nConfidence threshold: ${confidence.threshold}% (extractions below this may be rejected)`;
    }

    // Add few-shot examples only if explicitly enabled (default: false)
    // Benchmarks show examples hurt performance for most models
    if (prompt?.includeFewShotExamples === true) {
        promptText += `\n\nExample extraction:

Input text: "Invoice #INV-2024-0042 dated December 15, 2024 for $1,250.00 USD"

Output:
{
  "data": {
    "invoice_id": "INV-2024-0042",
    "date": "2024-12-15",
    "amount": 1250.00,
    "currency": "USD"
  },
  "confidence": 95,
  "confidenceByField": {
    "invoice_id": 98,
    "date": 95,
    "amount": 92,
    "currency": 95
  }
}

Note: Use null for missing or uncertain values. Example with missing data:

Input text: "Order reference A-123. Contact: john@example.com"

Output:
{
  "data": {
    "order_id": "A-123",
    "email": "john@example.com",
    "phone": null,
    "address": null
  },
  "confidence": 70,
  "confidenceByField": {
    "order_id": 95,
    "email": 98,
    "phone": 0,
    "address": 0
  }
}`;
    }

    // Add response format reminder
    const exampleFields = Object.keys(fields).slice(0, 2);
    const field1 = exampleFields[0] || 'field1';
    const field2 = exampleFields[1] || 'field2';
    
    promptText += `\n\nYour response must follow this exact structure:
{
  "data": { ... all fields from schema ... },
  "confidence": <number 0-100>,
  "confidenceByField": { ... confidence for each field ... }
}`;

    return promptText;
}

/**
 * Builds a user prompt with input text
 */
export function buildUserPrompt(input: string): string {
    return `Extract data from the following text:\n\n${input}`;
}
