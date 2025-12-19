/**
 * Output validator - validates extracted data against schema
 */

import type { Schema, FieldDefinition } from '../schemas/types.js';
import { PipelineError, PipelineErrorCodes } from './errors.js';

export interface ValidationError {
    field: string;
    message: string;
    code: string;
    value?: unknown;
}

export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
}

/**
 * Validates extracted data against schema
 */
export function validateExtractedData(
    data: Record<string, unknown>,
    schema: Schema
): ValidationResult {
    const errors: ValidationError[] = [];

    // Check required fields
    for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
        const value = data[fieldName];

        // Check if field is missing
        if (value === undefined || value === null) {
            if (!fieldDef.optional) {
                errors.push({
                    field: fieldName,
                    message: `Required field '${fieldName}' is missing`,
                    code: PipelineErrorCodes.FIELD_MISSING,
                });
            }
            continue;
        }

        // Validate field type and constraints
        const fieldErrors = validateField(fieldName, value, fieldDef);
        errors.push(...fieldErrors);
    }

    return {
        valid: errors.length === 0,
        errors,
    };
}

/**
 * Validates a single field
 */
function validateField(
    fieldName: string,
    value: unknown,
    fieldDef: FieldDefinition
): ValidationError[] {
    const errors: ValidationError[] = [];

    switch (fieldDef.type) {
        case 'string':
            if (typeof value !== 'string') {
                errors.push({
                    field: fieldName,
                    message: `Field '${fieldName}' must be a string, got ${typeof value}`,
                    code: PipelineErrorCodes.TYPE_MISMATCH,
                    value,
                });
            } else {
                // Check enum constraint
                if (fieldDef.enum && !fieldDef.enum.includes(value)) {
                    errors.push({
                        field: fieldName,
                        message: `Field '${fieldName}' must be one of: ${fieldDef.enum.join(', ')}. Got: ${value}`,
                        code: PipelineErrorCodes.FIELD_INVALID,
                        value,
                    });
                }
                // Check pattern constraint
                if (fieldDef.pattern) {
                    try {
                        const regex = new RegExp(fieldDef.pattern);
                        if (!regex.test(value)) {
                            errors.push({
                                field: fieldName,
                                message: `Field '${fieldName}' does not match pattern: ${fieldDef.pattern}`,
                                code: PipelineErrorCodes.FIELD_INVALID,
                                value,
                            });
                        }
                    } catch (e) {
                        // Invalid regex in schema - should be caught by schema validation
                    }
                }
            }
            break;

        case 'number':
            if (typeof value !== 'number' || isNaN(value)) {
                errors.push({
                    field: fieldName,
                    message: `Field '${fieldName}' must be a number, got ${typeof value}`,
                    code: PipelineErrorCodes.TYPE_MISMATCH,
                    value,
                });
            } else {
                if (fieldDef.min !== undefined && value < fieldDef.min) {
                    errors.push({
                        field: fieldName,
                        message: `Field '${fieldName}' must be >= ${fieldDef.min}, got ${value}`,
                        code: PipelineErrorCodes.FIELD_INVALID,
                        value,
                    });
                }
                if (fieldDef.max !== undefined && value > fieldDef.max) {
                    errors.push({
                        field: fieldName,
                        message: `Field '${fieldName}' must be <= ${fieldDef.max}, got ${value}`,
                        code: PipelineErrorCodes.FIELD_INVALID,
                        value,
                    });
                }
            }
            break;

        case 'integer':
            if (typeof value !== 'number' || !Number.isInteger(value)) {
                errors.push({
                    field: fieldName,
                    message: `Field '${fieldName}' must be an integer`,
                    code: PipelineErrorCodes.TYPE_MISMATCH,
                    value,
                });
            } else {
                // Check min/max constraints
                if (fieldDef.min !== undefined && value < fieldDef.min) {
                    errors.push({
                        field: fieldName,
                        message: `Field '${fieldName}' must be at least ${fieldDef.min}`,
                        code: PipelineErrorCodes.FIELD_INVALID,
                        value,
                    });
                }
                if (fieldDef.max !== undefined && value > fieldDef.max) {
                    errors.push({
                        field: fieldName,
                        message: `Field '${fieldName}' must be at most ${fieldDef.max}`,
                        code: PipelineErrorCodes.FIELD_INVALID,
                        value,
                    });
                }
            }
            break;

        case 'boolean':
            if (typeof value !== 'boolean') {
                errors.push({
                    field: fieldName,
                    message: `Field '${fieldName}' must be a boolean, got ${typeof value}`,
                    code: PipelineErrorCodes.TYPE_MISMATCH,
                    value,
                });
            }
            break;
    }

    return errors;
}
