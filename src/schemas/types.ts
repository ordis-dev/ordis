/**
 * Schema type definitions for Ordis
 * 
 * Defines the structure and types used for schema validation.
 */

/**
 * Supported field types in schema definitions
 * Note: For dates, use type='string' with format='date-time'
 */
export type FieldType = 'string' | 'number' | 'integer' | 'boolean';

/**
 * Field definition within a schema
 */
export interface FieldDefinition {
    type: FieldType;
    description?: string;
    optional?: boolean;
    format?: string;
    enum?: string[];
    min?: number;
    max?: number;
    pattern?: string;
}

/**
 * Complete schema definition
 */
export interface Schema {
    fields: Record<string, FieldDefinition>;
    metadata?: {
        name?: string;
        version?: string;
        description?: string;
    };
    confidence?: {
        threshold: number; // Minimum confidence score (0-100) required for success
        failOnLowConfidence: boolean; // Whether to fail extraction if below threshold
    };
    prompt?: {
        includeFewShotExamples?: boolean; // Whether to include few-shot examples in prompt (default: false)
    };
}

/**
 * Validation error for a specific field
 */
export interface ValidationError {
    field?: string;
    message: string;
    code: string;
    value?: unknown;
    expected?: unknown;  // Expected type or value(s)
    actual?: unknown;    // Actual type or value received
    confidence?: number; // Confidence score (0-100) if available
}

/**
 * Result of schema validation
 */
export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    confidence?: number; // Overall confidence score (0-100) for the validation
    confidenceByField?: Record<string, number>; // Per-field confidence scores
}

/**
 * Result of data extraction
 */
export interface ExtractionResult {
    success: boolean;
    data?: Record<string, unknown>; // Extracted and validated data
    confidence: number; // Overall confidence score (0-100)
    confidenceByField: Record<string, number>; // Confidence for each field
    errors: ValidationError[];
    meetsThreshold: boolean; // Whether confidence meets schema threshold
    metadata?: {
        schemaName?: string;
        extractionTimestamp?: string;
        model?: string;
    };
}
