/**
 * Schema validator - validates schema definitions
 */

import type { Schema, FieldDefinition, FieldType } from './types.js';
import { SchemaValidationError, ErrorCodes } from './errors.js';

const VALID_FIELD_TYPES: FieldType[] = ['string', 'number', 'integer', 'boolean', 'array', 'object'];

/**
 * Validates a schema definition
 * 
 * @param schema - The schema object to validate
 * @throws {SchemaValidationError} If the schema is invalid
 */
export function validateSchema(schema: unknown): asserts schema is Schema {
    // Check if schema is an object
    if (!schema || typeof schema !== 'object') {
        throw new SchemaValidationError(
            'Schema must be an object',
            ErrorCodes.INVALID_JSON
        );
    }

    const schemaObj = schema as Record<string, unknown>;

    // Check for required 'fields' property
    if (!schemaObj.fields) {
        throw new SchemaValidationError(
            "Schema must contain a 'fields' property",
            ErrorCodes.MISSING_FIELDS
        );
    }

    if (typeof schemaObj.fields !== 'object' || schemaObj.fields === null) {
        throw new SchemaValidationError(
            "'fields' must be an object",
            ErrorCodes.MISSING_FIELDS
        );
    }

    const fields = schemaObj.fields as Record<string, unknown>;

    // Check if fields is empty
    if (Object.keys(fields).length === 0) {
        throw new SchemaValidationError(
            'Schema must contain at least one field',
            ErrorCodes.MISSING_FIELDS
        );
    }

    // Validate each field definition
    for (const [fieldName, fieldDef] of Object.entries(fields)) {
        validateFieldName(fieldName);
        validateFieldDefinition(fieldName, fieldDef);
    }

    // Validate metadata if present
    if (schemaObj.metadata !== undefined) {
        validateMetadata(schemaObj.metadata);
    }

    // Validate confidence configuration if present
    if (schemaObj.confidence !== undefined) {
        validateConfidenceConfig(schemaObj.confidence);
    }
}

/**
 * Validates a field name
 */
function validateFieldName(fieldName: string): void {
    if (!fieldName || fieldName.trim() === '') {
        throw new SchemaValidationError(
            'Field name cannot be empty',
            ErrorCodes.INVALID_FIELD_NAME
        );
    }

    // Field names should be valid identifiers (alphanumeric and underscore)
    if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(fieldName)) {
        throw new SchemaValidationError(
            `Invalid field name '${fieldName}'. Field names must start with a letter or underscore and contain only alphanumeric characters and underscores`,
            ErrorCodes.INVALID_FIELD_NAME,
            fieldName
        );
    }
}

/**
 * Validates a field definition
 */
function validateFieldDefinition(fieldName: string, fieldDef: unknown): void {
    if (!fieldDef || typeof fieldDef !== 'object') {
        throw new SchemaValidationError(
            `Field '${fieldName}' definition must be an object`,
            ErrorCodes.INVALID_FIELD_TYPE,
            fieldName
        );
    }

    const def = fieldDef as Record<string, unknown>;

    // Check for required 'type' property
    if (!def.type) {
        throw new SchemaValidationError(
            `Field '${fieldName}' is missing required 'type' property`,
            ErrorCodes.INVALID_FIELD_TYPE,
            fieldName
        );
    }

    if (typeof def.type !== 'string') {
        throw new SchemaValidationError(
            `Field '${fieldName}' type must be a string`,
            ErrorCodes.INVALID_FIELD_TYPE,
            fieldName
        );
    }

    // Validate field type
    if (!VALID_FIELD_TYPES.includes(def.type as FieldType)) {
        throw new SchemaValidationError(
            `Field '${fieldName}' has invalid type '${def.type}'. Valid types are: ${VALID_FIELD_TYPES.join(', ')}`,
            ErrorCodes.INVALID_FIELD_TYPE,
            fieldName,
            { validTypes: VALID_FIELD_TYPES, receivedType: def.type }
        );
    }

    // Validate optional property if present
    if (def.optional !== undefined && typeof def.optional !== 'boolean') {
        throw new SchemaValidationError(
            `Field '${fieldName}' optional property must be a boolean`,
            ErrorCodes.INVALID_CONSTRAINT,
            fieldName
        );
    }

    // Validate description if present
    if (def.description !== undefined && typeof def.description !== 'string') {
        throw new SchemaValidationError(
            `Field '${fieldName}' description must be a string`,
            ErrorCodes.INVALID_CONSTRAINT,
            fieldName
        );
    }

    // Type-specific validations
    const fieldType = def.type as FieldType;

    if (fieldType === 'number' || fieldType === 'integer') {
        validateNumberField(fieldName, def);
    }

    if (fieldType === 'string') {
        validateStringField(fieldName, def);
        // Validate enum constraint if present
        if (def.enum) {
            validateEnumConstraint(fieldName, def);
        }
    }

    if (fieldType === 'array') {
        validateArrayField(fieldName, def);
    }

    if (fieldType === 'object') {
        validateObjectField(fieldName, def);
    }
}

/**
 * Validates enum constraint on string fields
 */
function validateEnumConstraint(fieldName: string, def: Record<string, unknown>): void {
    if (!Array.isArray(def.enum)) {
        throw new SchemaValidationError(
            `Field '${fieldName}' enum property must be an array`,
            ErrorCodes.INVALID_ENUM_VALUE,
            fieldName
        );
    }

    if (def.enum.length === 0) {
        throw new SchemaValidationError(
            `Field '${fieldName}' enum array cannot be empty`,
            ErrorCodes.EMPTY_ENUM_VALUES,
            fieldName
        );
    }

    // Check all enum values are strings
    for (let i = 0; i < def.enum.length; i++) {
        const value = def.enum[i];
        if (typeof value !== 'string') {
            throw new SchemaValidationError(
                `Field '${fieldName}' enum value at index ${i} must be a string, got ${typeof value}`,
                ErrorCodes.INVALID_ENUM_VALUE,
                fieldName,
                { index: i, value }
            );
        }
    }

    // Check for duplicate values
    const uniqueValues = new Set(def.enum);
    if (uniqueValues.size !== def.enum.length) {
        throw new SchemaValidationError(
            `Field '${fieldName}' enum contains duplicate values`,
            ErrorCodes.DUPLICATE_ENUM_VALUE,
            fieldName
        );
    }
}

/**
 * Validates number field constraints
 */
function validateNumberField(fieldName: string, def: Record<string, unknown>): void {
    if (def.min !== undefined) {
        if (typeof def.min !== 'number') {
            throw new SchemaValidationError(
                `Field '${fieldName}' min constraint must be a number`,
                ErrorCodes.INVALID_CONSTRAINT,
                fieldName
            );
        }
    }

    if (def.max !== undefined) {
        if (typeof def.max !== 'number') {
            throw new SchemaValidationError(
                `Field '${fieldName}' max constraint must be a number`,
                ErrorCodes.INVALID_CONSTRAINT,
                fieldName
            );
        }
    }

    if (def.min !== undefined && def.max !== undefined) {
        if ((def.min as number) > (def.max as number)) {
            throw new SchemaValidationError(
                `Field '${fieldName}' min value (${def.min}) cannot be greater than max value (${def.max})`,
                ErrorCodes.CONSTRAINT_MISMATCH,
                fieldName,
                { min: def.min, max: def.max }
            );
        }
    }

    // Enum is not valid for number type
    if (def.enum !== undefined) {
        throw new SchemaValidationError(
            `Field '${fieldName}' with type 'number' cannot have 'enum' property`,
            ErrorCodes.INVALID_CONSTRAINT,
            fieldName
        );
    }
}

/**
 * Validates string field constraints
 */
function validateStringField(fieldName: string, def: Record<string, unknown>): void {
    if (def.pattern !== undefined) {
        if (typeof def.pattern !== 'string') {
            throw new SchemaValidationError(
                `Field '${fieldName}' pattern constraint must be a string`,
                ErrorCodes.INVALID_CONSTRAINT,
                fieldName
            );
        }

        // Validate regex pattern
        try {
            new RegExp(def.pattern);
        } catch (error) {
            throw new SchemaValidationError(
                `Field '${fieldName}' has invalid regex pattern: ${(error as Error).message}`,
                ErrorCodes.INVALID_PATTERN,
                fieldName,
                { pattern: def.pattern }
            );
        }
    }

    // min/max not valid for string type (could be added for length later)
    if (def.min !== undefined || def.max !== undefined) {
        throw new SchemaValidationError(
            `Field '${fieldName}' with type 'string' cannot have 'min' or 'max' properties`,
            ErrorCodes.INVALID_CONSTRAINT,
            fieldName
        );
    }
}

/**
 * Validates array field definition
 */
function validateArrayField(fieldName: string, def: Record<string, unknown>): void {
    // Array must have items definition
    if (!def.items) {
        throw new SchemaValidationError(
            `Array field '${fieldName}' must have an 'items' property defining the array element type`,
            ErrorCodes.INVALID_CONSTRAINT,
            fieldName
        );
    }

    if (typeof def.items !== 'object' || def.items === null) {
        throw new SchemaValidationError(
            `Array field '${fieldName}' items must be an object`,
            ErrorCodes.INVALID_CONSTRAINT,
            fieldName
        );
    }

    const items = def.items as Record<string, unknown>;

    // Currently only support object items
    if (items.type !== 'object') {
        throw new SchemaValidationError(
            `Array field '${fieldName}' items type must be 'object'. Got: ${items.type}`,
            ErrorCodes.INVALID_CONSTRAINT,
            fieldName
        );
    }

    // Validate the nested object properties
    if (!items.properties) {
        throw new SchemaValidationError(
            `Array field '${fieldName}' items must have 'properties' defining the object structure`,
            ErrorCodes.INVALID_CONSTRAINT,
            fieldName
        );
    }

    if (typeof items.properties !== 'object' || items.properties === null) {
        throw new SchemaValidationError(
            `Array field '${fieldName}' items properties must be an object`,
            ErrorCodes.INVALID_CONSTRAINT,
            fieldName
        );
    }

    const properties = items.properties as Record<string, unknown>;

    if (Object.keys(properties).length === 0) {
        throw new SchemaValidationError(
            `Array field '${fieldName}' items must have at least one property`,
            ErrorCodes.INVALID_CONSTRAINT,
            fieldName
        );
    }

    // Validate each nested property
    for (const [propName, propDef] of Object.entries(properties)) {
        validateFieldName(propName);
        validateFieldDefinition(`${fieldName}.items.${propName}`, propDef);
    }
}

/**
 * Validates object field definition
 */
function validateObjectField(fieldName: string, def: Record<string, unknown>): void {
    // Object must have properties definition
    if (!def.properties) {
        throw new SchemaValidationError(
            `Object field '${fieldName}' must have a 'properties' property defining the object structure`,
            ErrorCodes.INVALID_CONSTRAINT,
            fieldName
        );
    }

    if (typeof def.properties !== 'object' || def.properties === null) {
        throw new SchemaValidationError(
            `Object field '${fieldName}' properties must be an object`,
            ErrorCodes.INVALID_CONSTRAINT,
            fieldName
        );
    }

    const properties = def.properties as Record<string, unknown>;

    if (Object.keys(properties).length === 0) {
        throw new SchemaValidationError(
            `Object field '${fieldName}' must have at least one property`,
            ErrorCodes.INVALID_CONSTRAINT,
            fieldName
        );
    }

    // Validate each nested property
    for (const [propName, propDef] of Object.entries(properties)) {
        validateFieldName(propName);
        validateFieldDefinition(`${fieldName}.${propName}`, propDef);
    }
}

/**
 * Validates schema metadata
 */
function validateMetadata(metadata: unknown): void {
    if (typeof metadata !== 'object' || metadata === null) {
        throw new SchemaValidationError(
            'Schema metadata must be an object',
            ErrorCodes.INVALID_JSON
        );
    }

    const meta = metadata as Record<string, unknown>;

    if (meta.name !== undefined && typeof meta.name !== 'string') {
        throw new SchemaValidationError(
            'Schema metadata name must be a string',
            ErrorCodes.INVALID_JSON
        );
    }

    if (meta.version !== undefined && typeof meta.version !== 'string') {
        throw new SchemaValidationError(
            'Schema metadata version must be a string',
            ErrorCodes.INVALID_JSON
        );
    }

    if (meta.description !== undefined && typeof meta.description !== 'string') {
        throw new SchemaValidationError(
            'Schema metadata description must be a string',
            ErrorCodes.INVALID_JSON
        );
    }
}

/**
 * Validates confidence configuration
 */
function validateConfidenceConfig(confidence: unknown): void {
    if (typeof confidence !== 'object' || confidence === null) {
        throw new SchemaValidationError(
            'Confidence configuration must be an object',
            ErrorCodes.INVALID_CONFIDENCE_CONFIG
        );
    }

    const config = confidence as Record<string, unknown>;

    // Check for required 'threshold' property
    if (config.threshold === undefined) {
        throw new SchemaValidationError(
            'Confidence configuration must include a threshold value',
            ErrorCodes.INVALID_CONFIDENCE_CONFIG
        );
    }

    if (typeof config.threshold !== 'number') {
        throw new SchemaValidationError(
            'Confidence threshold must be a number',
            ErrorCodes.INVALID_CONFIDENCE_CONFIG,
            undefined,
            { received: typeof config.threshold }
        );
    }

    // Validate threshold range (0-100)
    if (config.threshold < 0 || config.threshold > 100) {
        throw new SchemaValidationError(
            `Confidence threshold must be between 0 and 100, got ${config.threshold}`,
            ErrorCodes.INVALID_CONFIDENCE_CONFIG,
            undefined,
            { threshold: config.threshold }
        );
    }

    // Check for required 'failOnLowConfidence' property
    if (config.failOnLowConfidence === undefined) {
        throw new SchemaValidationError(
            'Confidence configuration must include failOnLowConfidence boolean',
            ErrorCodes.INVALID_CONFIDENCE_CONFIG
        );
    }

    if (typeof config.failOnLowConfidence !== 'boolean') {
        throw new SchemaValidationError(
            'failOnLowConfidence must be a boolean',
            ErrorCodes.INVALID_CONFIDENCE_CONFIG,
            undefined,
            { received: typeof config.failOnLowConfidence }
        );
    }
}
