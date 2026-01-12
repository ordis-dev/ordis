/**
 * Output validator - validates extracted data against schema
 */

import type { Schema, FieldDefinition } from '../schemas/types.js';
import { PipelineError, PipelineErrorCodes } from './errors.js';
import { coerceExtractedData, type CoercionWarning } from './coercion.js';

export interface ValidationError {
    field?: string;
    message: string;
    code: string;
    value?: unknown;
    expected?: unknown;  // Expected type or value(s)
    actual?: unknown;    // Actual type or value received
}

export interface ValidationResult {
    valid: boolean;
    errors: ValidationError[];
    warnings?: CoercionWarning[];  // Warnings from type coercion
    coercedData?: Record<string, unknown>;  // Data after coercion
}

/**
 * Validates extracted data against schema
 */
export function validateExtractedData(
    data: Record<string, unknown>,
    schema: Schema
): ValidationResult {
    const errors: ValidationError[] = [];

    // Apply type coercion first
    const { data: coercedData, warnings } = coerceExtractedData(data, schema.fields);

    // Check required fields using coerced data
    for (const [fieldName, fieldDef] of Object.entries(schema.fields)) {
        const value = coercedData[fieldName];

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
        warnings: warnings.length > 0 ? warnings : undefined,
        coercedData,
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

        case 'array':
            if (!Array.isArray(value)) {
                errors.push({
                    field: fieldName,
                    message: `Field '${fieldName}' must be an array, got ${typeof value}`,
                    code: PipelineErrorCodes.TYPE_MISMATCH,
                    value,
                });
            } else if (fieldDef.items) {
                // Validate each item in the array
                for (let i = 0; i < value.length; i++) {
                    const item = value[i];
                    const itemErrors = validateArrayItem(
                        `${fieldName}[${i}]`,
                        item,
                        fieldDef.items
                    );
                    errors.push(...itemErrors);
                }
            }
            break;

        case 'object':
            if (typeof value !== 'object' || value === null || Array.isArray(value)) {
                errors.push({
                    field: fieldName,
                    message: `Field '${fieldName}' must be an object, got ${Array.isArray(value) ? 'array' : typeof value}`,
                    code: PipelineErrorCodes.TYPE_MISMATCH,
                    value,
                });
            } else if (fieldDef.properties) {
                // Validate nested object properties
                const objectErrors = validateObjectProperties(
                    fieldName,
                    value as Record<string, unknown>,
                    fieldDef.properties
                );
                errors.push(...objectErrors);
            }
            break;
    }

    return errors;
}

/**
 * Validates an array item (currently only supports object items)
 */
function validateArrayItem(
    itemPath: string,
    item: unknown,
    itemDef: { type: string; properties?: Record<string, FieldDefinition> }
): ValidationError[] {
    const errors: ValidationError[] = [];

    if (itemDef.type === 'object') {
        if (typeof item !== 'object' || item === null || Array.isArray(item)) {
            errors.push({
                field: itemPath,
                message: `${itemPath} must be an object, got ${Array.isArray(item) ? 'array' : typeof item}`,
                code: PipelineErrorCodes.TYPE_MISMATCH,
                value: item,
            });
        } else if (itemDef.properties) {
            const objectErrors = validateObjectProperties(
                itemPath,
                item as Record<string, unknown>,
                itemDef.properties
            );
            errors.push(...objectErrors);
        }
    }

    return errors;
}

/**
 * Validates nested object properties
 */
function validateObjectProperties(
    parentPath: string,
    obj: Record<string, unknown>,
    properties: Record<string, FieldDefinition>
): ValidationError[] {
    const errors: ValidationError[] = [];

    for (const [propName, propDef] of Object.entries(properties)) {
        const value = obj[propName];
        const propPath = `${parentPath}.${propName}`;

        // Check if field is missing
        if (value === undefined || value === null) {
            if (!propDef.optional) {
                errors.push({
                    field: propPath,
                    message: `Required field '${propPath}' is missing`,
                    code: PipelineErrorCodes.FIELD_MISSING,
                });
            }
            continue;
        }

        // Validate field type and constraints
        const fieldErrors = validateField(propPath, value, propDef);
        errors.push(...fieldErrors);
    }

    return errors;
}
