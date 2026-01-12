/**
 * Type coercion module - converts LLM output to expected types
 * 
 * Handles common LLM quirks like:
 * - String "null" instead of null
 * - String numbers like "123" instead of 123
 * - String booleans like "true" instead of true
 * - Enum case mismatch like "Series A" instead of "series_a"
 * - Date format variations like "11/20/24" instead of "2024-11-20"
 */

import type { FieldType, FieldDefinition, ArrayItemDefinition } from '../schemas/types.js';

/**
 * Warning generated during coercion
 */
export interface CoercionWarning {
    field: string;
    message: string;
    originalValue: unknown;
    coercedValue: unknown;
}

/**
 * Result of coercing a value
 */
export interface CoercionResult {
    value: unknown;
    coerced: boolean;
    warning?: CoercionWarning;
}

/**
 * Null-like string values that should be coerced to null
 */
const NULL_STRINGS = new Set(['null', 'none', 'n/a', 'na', 'undefined', '']);

/**
 * Boolean true string values
 */
const TRUE_STRINGS = new Set(['true', 'yes', '1']);

/**
 * Boolean false string values
 */
const FALSE_STRINGS = new Set(['false', 'no', '0']);

/**
 * Normalize a string for enum matching
 * Converts to lowercase and replaces spaces/hyphens with underscores
 */
function normalizeEnumValue(value: string): string {
    return value.trim().toLowerCase().replace(/[\s-]+/g, '_');
}

/**
 * Coerce an enum value to match expected enum values (case-insensitive)
 * 
 * @param value - The string value to coerce
 * @param enumValues - Array of allowed enum values
 * @param fieldName - Field name for warning messages
 * @returns CoercionResult with matched enum value or original if no match
 */
export function coerceEnumValue(
    value: string,
    enumValues: string[],
    fieldName: string
): CoercionResult {
    // Exact match - no coercion needed
    if (enumValues.includes(value)) {
        return { value, coerced: false };
    }

    // Try normalized match
    const normalized = normalizeEnumValue(value);
    const match = enumValues.find(e => normalizeEnumValue(e) === normalized);
    
    if (match) {
        return {
            value: match,
            coerced: true,
            warning: {
                field: fieldName,
                message: `Coerced enum value '${value}' to '${match}'`,
                originalValue: value,
                coercedValue: match,
            },
        };
    }

    // No match found - return original (validation will catch it)
    return { value, coerced: false };
}

/**
 * Common date format patterns and their parsing logic
 * Supports: MM/DD/YY, MM/DD/YYYY, DD-MM-YYYY, YYYY-MM-DD, etc.
 */
const DATE_PATTERNS: Array<{
    regex: RegExp;
    parse: (match: RegExpMatchArray) => { year: number; month: number; day: number } | null;
}> = [
    // ISO format: YYYY-MM-DD or YYYY-MM-DDTHH:MM:SS
    {
        regex: /^(\d{4})-(\d{1,2})-(\d{1,2})(?:T[\d:]+)?$/,
        parse: (m) => ({ year: parseInt(m[1]), month: parseInt(m[2]), day: parseInt(m[3]) }),
    },
    // US format: MM/DD/YYYY or MM/DD/YY
    {
        regex: /^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/,
        parse: (m) => {
            let year = parseInt(m[3]);
            if (year < 100) year += year < 50 ? 2000 : 1900;
            return { year, month: parseInt(m[1]), day: parseInt(m[2]) };
        },
    },
    // European format: DD-MM-YYYY or DD.MM.YYYY
    {
        regex: /^(\d{1,2})[-.](\d{1,2})[-.](\d{4})$/,
        parse: (m) => ({ year: parseInt(m[3]), month: parseInt(m[2]), day: parseInt(m[1]) }),
    },
    // Written format: January 15, 2024 or Jan 15, 2024
    {
        regex: /^([A-Za-z]+)\s+(\d{1,2}),?\s+(\d{4})$/,
        parse: (m) => {
            const monthNames: Record<string, number> = {
                january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3,
                april: 4, apr: 4, may: 5, june: 6, jun: 6,
                july: 7, jul: 7, august: 8, aug: 8, september: 9, sep: 9, sept: 9,
                october: 10, oct: 10, november: 11, nov: 11, december: 12, dec: 12,
            };
            const month = monthNames[m[1].toLowerCase()];
            if (!month) return null;
            return { year: parseInt(m[3]), month, day: parseInt(m[2]) };
        },
    },
    // Written format: 15 January 2024 or 15 Jan 2024
    {
        regex: /^(\d{1,2})\s+([A-Za-z]+)\s+(\d{4})$/,
        parse: (m) => {
            const monthNames: Record<string, number> = {
                january: 1, jan: 1, february: 2, feb: 2, march: 3, mar: 3,
                april: 4, apr: 4, may: 5, june: 6, jun: 6,
                july: 7, jul: 7, august: 8, aug: 8, september: 9, sep: 9, sept: 9,
                october: 10, oct: 10, november: 11, nov: 11, december: 12, dec: 12,
            };
            const month = monthNames[m[2].toLowerCase()];
            if (!month) return null;
            return { year: parseInt(m[3]), month, day: parseInt(m[1]) };
        },
    },
];

/**
 * Coerce a date string to ISO format (YYYY-MM-DD)
 * 
 * @param value - The date string to coerce
 * @param fieldName - Field name for warning messages
 * @returns CoercionResult with ISO date or original if not parseable
 */
export function coerceDateValue(
    value: string,
    fieldName: string
): CoercionResult {
    const trimmed = value.trim();
    
    // Already in ISO format without time - no coercion needed
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) {
        return { value: trimmed, coerced: false };
    }

    // Try each pattern
    for (const pattern of DATE_PATTERNS) {
        const match = trimmed.match(pattern.regex);
        if (match) {
            const parsed = pattern.parse(match);
            if (parsed) {
                // Validate the date components
                if (parsed.month >= 1 && parsed.month <= 12 && 
                    parsed.day >= 1 && parsed.day <= 31 &&
                    parsed.year >= 1900 && parsed.year <= 2100) {
                    
                    const isoDate = `${parsed.year}-${String(parsed.month).padStart(2, '0')}-${String(parsed.day).padStart(2, '0')}`;
                    
                    // Check if it's different from original (ignoring time component)
                    if (isoDate !== trimmed && !trimmed.startsWith(isoDate)) {
                        return {
                            value: isoDate,
                            coerced: true,
                            warning: {
                                field: fieldName,
                                message: `Coerced date '${value}' to ISO format '${isoDate}'`,
                                originalValue: value,
                                coercedValue: isoDate,
                            },
                        };
                    }
                    
                    return { value: isoDate, coerced: false };
                }
            }
        }
    }

    // No pattern matched - return original
    return { value, coerced: false };
}

/**
 * Coerce a value to the expected type
 * 
 * @param value - The value to coerce
 * @param targetType - The expected field type
 * @param fieldName - Field name for warning messages
 * @param isOptional - Whether the field is optional (affects null coercion)
 * @returns CoercionResult with the coerced value and any warnings
 */
export function coerceValue(
    value: unknown,
    targetType: FieldType,
    fieldName: string,
    isOptional: boolean = false
): CoercionResult {
    // Already null/undefined - no coercion needed
    if (value === null || value === undefined) {
        return { value, coerced: false };
    }

    // Check for null-like strings first (applies to all types)
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        if (NULL_STRINGS.has(normalized)) {
            // Only coerce to null if field is optional
            if (isOptional) {
                return {
                    value: null,
                    coerced: true,
                    warning: {
                        field: fieldName,
                        message: `Coerced '${value}' string to null`,
                        originalValue: value,
                        coercedValue: null,
                    },
                };
            }
            // For required fields, try type-specific coercion below
        }
    }

    switch (targetType) {
        case 'number':
            return coerceToNumber(value, fieldName);
        case 'integer':
            return coerceToInteger(value, fieldName);
        case 'boolean':
            return coerceToBoolean(value, fieldName);
        case 'string':
            return coerceToString(value, fieldName);
        default:
            return { value, coerced: false };
    }
}

/**
 * Coerce value to number
 */
function coerceToNumber(value: unknown, fieldName: string): CoercionResult {
    // Already a number
    if (typeof value === 'number') {
        return { value, coerced: false };
    }

    // String to number
    if (typeof value === 'string') {
        const trimmed = value.trim();
        
        // Handle empty or null-like strings
        if (NULL_STRINGS.has(trimmed.toLowerCase())) {
            return { value, coerced: false }; // Let validation handle it
        }

        // Try to parse as number
        const parsed = parseFloat(trimmed);
        if (!isNaN(parsed)) {
            return {
                value: parsed,
                coerced: true,
                warning: {
                    field: fieldName,
                    message: `Coerced string '${value}' to number ${parsed}`,
                    originalValue: value,
                    coercedValue: parsed,
                },
            };
        }
    }

    // Boolean to number
    if (typeof value === 'boolean') {
        const num = value ? 1 : 0;
        return {
            value: num,
            coerced: true,
            warning: {
                field: fieldName,
                message: `Coerced boolean ${value} to number ${num}`,
                originalValue: value,
                coercedValue: num,
            },
        };
    }

    return { value, coerced: false };
}

/**
 * Coerce value to integer
 */
function coerceToInteger(value: unknown, fieldName: string): CoercionResult {
    // First coerce to number
    const numberResult = coerceToNumber(value, fieldName);
    
    if (typeof numberResult.value === 'number') {
        // If it's already an integer, keep as-is
        if (Number.isInteger(numberResult.value)) {
            return numberResult;
        }
        
        // Truncate to integer
        const intValue = Math.trunc(numberResult.value);
        return {
            value: intValue,
            coerced: true,
            warning: {
                field: fieldName,
                message: `Coerced ${value} to integer ${intValue}`,
                originalValue: value,
                coercedValue: intValue,
            },
        };
    }

    return { value, coerced: false };
}

/**
 * Coerce value to boolean
 */
function coerceToBoolean(value: unknown, fieldName: string): CoercionResult {
    // Already a boolean
    if (typeof value === 'boolean') {
        return { value, coerced: false };
    }

    // String to boolean
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase();
        
        if (TRUE_STRINGS.has(normalized)) {
            return {
                value: true,
                coerced: true,
                warning: {
                    field: fieldName,
                    message: `Coerced string '${value}' to boolean true`,
                    originalValue: value,
                    coercedValue: true,
                },
            };
        }
        
        if (FALSE_STRINGS.has(normalized)) {
            return {
                value: false,
                coerced: true,
                warning: {
                    field: fieldName,
                    message: `Coerced string '${value}' to boolean false`,
                    originalValue: value,
                    coercedValue: false,
                },
            };
        }
    }

    // Number to boolean
    if (typeof value === 'number') {
        const boolValue = value !== 0;
        return {
            value: boolValue,
            coerced: true,
            warning: {
                field: fieldName,
                message: `Coerced number ${value} to boolean ${boolValue}`,
                originalValue: value,
                coercedValue: boolValue,
            },
        };
    }

    return { value, coerced: false };
}

/**
 * Coerce value to string
 */
function coerceToString(value: unknown, fieldName: string): CoercionResult {
    // Already a string
    if (typeof value === 'string') {
        return { value, coerced: false };
    }

    // Number or boolean to string
    if (typeof value === 'number' || typeof value === 'boolean') {
        const strValue = String(value);
        return {
            value: strValue,
            coerced: true,
            warning: {
                field: fieldName,
                message: `Coerced ${typeof value} ${value} to string '${strValue}'`,
                originalValue: value,
                coercedValue: strValue,
            },
        };
    }

    return { value, coerced: false };
}

/**
 * Coerce all values in an extracted data object (recursive)
 * 
 * Handles:
 * - Top-level field coercion
 * - Enum value normalization (case-insensitive)
 * - Recursive coercion for array items
 * - Recursive coercion for nested objects
 * 
 * @param data - The extracted data object
 * @param fields - Field definitions from schema
 * @returns Coerced data and any warnings generated
 */
export function coerceExtractedData(
    data: Record<string, unknown>,
    fields: Record<string, FieldDefinition>
): { data: Record<string, unknown>; warnings: CoercionWarning[] } {
    const coercedData: Record<string, unknown> = { ...data };
    const warnings: CoercionWarning[] = [];

    for (const [fieldName, fieldDef] of Object.entries(fields)) {
        if (!(fieldName in data)) continue;
        
        const value = data[fieldName];
        
        // Handle null/undefined - no coercion needed
        if (value === null || value === undefined) {
            coercedData[fieldName] = value;
            continue;
        }

        // Handle array type - recursively coerce items
        if (fieldDef.type === 'array' && Array.isArray(value) && fieldDef.items) {
            const { array: coercedArray, warnings: arrayWarnings } = coerceArrayItems(
                value,
                fieldDef.items,
                fieldName
            );
            coercedData[fieldName] = coercedArray;
            warnings.push(...arrayWarnings);
            continue;
        }

        // Handle object type - recursively coerce properties
        if (fieldDef.type === 'object' && typeof value === 'object' && !Array.isArray(value) && fieldDef.properties) {
            const { data: coercedObj, warnings: objWarnings } = coerceExtractedData(
                value as Record<string, unknown>,
                fieldDef.properties
            );
            // Update warning field paths
            for (const w of objWarnings) {
                w.field = `${fieldName}.${w.field}`;
            }
            coercedData[fieldName] = coercedObj;
            warnings.push(...objWarnings);
            continue;
        }

        // Handle string with enum - try enum coercion first
        if (fieldDef.type === 'string' && typeof value === 'string' && fieldDef.enum) {
            const enumResult = coerceEnumValue(value, fieldDef.enum, fieldName);
            coercedData[fieldName] = enumResult.value;
            if (enumResult.warning) {
                warnings.push(enumResult.warning);
            }
            continue;
        }

        // Handle string with date/date-time format - normalize to ISO
        if (fieldDef.type === 'string' && typeof value === 'string' && 
            (fieldDef.format === 'date' || fieldDef.format === 'date-time')) {
            const dateResult = coerceDateValue(value, fieldName);
            coercedData[fieldName] = dateResult.value;
            if (dateResult.warning) {
                warnings.push(dateResult.warning);
            }
            continue;
        }

        // Standard type coercion
        const result = coerceValue(
            value,
            fieldDef.type,
            fieldName,
            fieldDef.optional ?? false
        );
        
        coercedData[fieldName] = result.value;
        if (result.warning) {
            warnings.push(result.warning);
        }
    }

    return { data: coercedData, warnings };
}

/**
 * Coerce array items recursively
 * 
 * @param array - The array to coerce
 * @param itemDef - Definition of array items
 * @param fieldName - Parent field name for error paths
 * @returns Coerced array and any warnings
 */
function coerceArrayItems(
    array: unknown[],
    itemDef: ArrayItemDefinition,
    fieldName: string
): { array: unknown[]; warnings: CoercionWarning[] } {
    const coercedArray: unknown[] = [];
    const warnings: CoercionWarning[] = [];

    for (let i = 0; i < array.length; i++) {
        const item = array[i];
        const itemPath = `${fieldName}[${i}]`;

        // Only handle object items for now (as per ArrayItemDefinition)
        if (itemDef.type === 'object' && typeof item === 'object' && item !== null && !Array.isArray(item) && itemDef.properties) {
            const { data: coercedItem, warnings: itemWarnings } = coerceExtractedData(
                item as Record<string, unknown>,
                itemDef.properties
            );
            // Update warning field paths
            for (const w of itemWarnings) {
                w.field = `${itemPath}.${w.field}`;
            }
            coercedArray.push(coercedItem);
            warnings.push(...itemWarnings);
        } else {
            // Non-object items are passed through as-is
            coercedArray.push(item);
        }
    }

    return { array: coercedArray, warnings };
}
