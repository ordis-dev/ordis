/**
 * Error formatting utilities for user-friendly error messages
 */

import type { ValidationError } from './validator.js';
import type { Schema, FieldDefinition } from '../schemas/types.js';
import type { LLMError } from '../llm/errors.js';
import { LLMErrorCodes } from '../llm/errors.js';
import { PipelineErrorCodes } from './errors.js';

export interface FormattedError {
    title: string;
    message: string;
    suggestion?: string;
    details?: string[];
}

/**
 * Format validation error with context and suggestions
 * Returns a formatted string with title, message, and suggestions
 */
export function formatValidationError(
    error: ValidationError,
    schema?: Schema,
    value?: unknown
): string {
    const field = schema?.fields?.[error.field];
    const fieldDesc = field?.description ? ` (${field.description})` : '';
    
    const formatted: FormattedError = {
        title: 'Field Validation Error',
        message: '',
        details: [],
    };

    switch (error.code) {
        case PipelineErrorCodes.FIELD_MISSING:
            formatted.message = `Required field '${error.field}' is missing${fieldDesc}`;
            formatted.suggestion = field?.optional
                ? `This field was expected but not marked as optional in the schema.`
                : `The LLM didn't extract this field. Try:\n` +
                  `  • Make the field description more explicit\n` +
                  `  • Ensure the input text contains this information\n` +
                  `  • Mark the field as optional if it's not always present`;
            break;

        case PipelineErrorCodes.TYPE_MISMATCH:
            // Use expected/actual from error if provided, otherwise infer from schema
            const expectedType = (error.expected as string) || field?.type || 'unknown';
            const actualType = (error.actual as string) || typeof error.value;
            const gotValue = JSON.stringify(error.value);
            
            formatted.message = `Field '${error.field}'${fieldDesc}\n` +
                               `  Expected: ${expectedType}\n` +
                               `  Got: ${gotValue} (${actualType})`;
            
            // Type-specific suggestions
            if (expectedType === 'number' && actualType === 'string') {
                formatted.suggestion = `The LLM returned a string instead of a number.\n` +
                                     `  • Check if the value contains formatting (e.g., "$1,250.00")\n` +
                                     `  • Update schema description to request "raw number without formatting"\n` +
                                     `  • Example: "amount as a number (e.g., 1250, not $1,250.00)"`;
            } else if (expectedType === 'string' && actualType === 'number') {
                formatted.suggestion = `The LLM returned a number instead of a string.\n` +
                                     `  • Update schema to use type: "number" if numeric data is expected\n` +
                                     `  • Or clarify in description that quotes are required`;
            } else if (expectedType === 'integer' && actualType === 'number') {
                formatted.suggestion = `Got a decimal number but expected an integer.\n` +
                                     `  • Ask for "whole number" or "integer" in the field description`;
            }
            break;

        case PipelineErrorCodes.FIELD_INVALID:
            // Check if expected is an array (enum values) or string (pattern)
            const expectedValue = error.expected;
            if (Array.isArray(expectedValue)) {
                // Enum validation error
                formatted.message = `Field '${error.field}' has invalid value\n` +
                                   `  Allowed: ${expectedValue.join(', ')}\n` +
                                   `  Got: ${JSON.stringify(error.value)}`;
                formatted.suggestion = `The LLM returned a value not in the allowed list.\n` +
                                     `  • Add the value to the enum list if it's valid\n` +
                                     `  • Provide examples in the field description\n` +
                                     `  • Use pattern matching if exact values aren't required`;
            } else if (typeof expectedValue === 'string' && expectedValue.startsWith('^')) {
                // Pattern validation error
                formatted.message = `Field '${error.field}' doesn't match required pattern\n` +
                                   `  Pattern: ${expectedValue}\n` +
                                   `  Got: ${JSON.stringify(error.value)}`;
                formatted.suggestion = `The value doesn't match the regex pattern.\n` +
                                     `  • Provide an example in the field description\n` +
                                     `  • Simplify the pattern if it's too strict`;
            } else if (field?.enum) {
                formatted.message = `Field '${error.field}' has invalid value\n` +
                                   `  Allowed: ${field.enum.join(', ')}\n` +
                                   `  Got: ${JSON.stringify(error.value)}`;
                formatted.suggestion = `The LLM returned a value not in the allowed list.\n` +
                                     `  • Add the value to the enum list if it's valid\n` +
                                     `  • Provide examples in the field description\n` +
                                     `  • Use pattern matching if exact values aren't required`;
            } else if (field?.pattern) {
                formatted.message = `Field '${error.field}' doesn't match required pattern\n` +
                                   `  Pattern: ${field.pattern}\n` +
                                   `  Got: ${JSON.stringify(error.value)}`;
                formatted.suggestion = `The value doesn't match the regex pattern.\n` +
                                     `  • Provide an example in the field description\n` +
                                     `  • Simplify the pattern if it's too strict`;
            } else if (field?.min !== undefined || field?.max !== undefined) {
                formatted.message = error.message;
                formatted.suggestion = `Value is out of the allowed range.\n` +
                                     `  • Check if the constraint is correct\n` +
                                     `  • Mention the range in the field description`;
            } else {
                // Generic field invalid error
                formatted.message = error.message;
            }
            break;

        default:
            formatted.message = error.message;
    }

    // Add field location in schema
    if (schema?.metadata?.name) {
        formatted.details = [` Field: ${error.field}`, `Schema: ${schema.metadata.name}`];
    }
    
    return formatFormattedError(formatted);
}

/**
 * Helper to format a FormattedError into a string
 */
function formatFormattedError(error: FormattedError): string {
    const lines: string[] = [`❌ ${error.title}`, `   ${error.message.replace(/\n/g, '\n   ')}`];
    
    if (error.suggestion) {
        lines.push('', `💡 Tip:`);
        lines.push(`   ${error.suggestion.replace(/\n/g, '\n   ')}`);
    }
    
    if (error.details && error.details.length > 0) {
        lines.push('', `ℹ️  Details:`);
        for (const detail of error.details) {
            lines.push(`   • ${detail}`);
        }
    }
    
    return lines.join('\n');
}

/**
 * Format LLM error with context and recovery suggestions
 * Returns a formatted string with title, message, suggestions, and details
 */
export function formatLLMError(error: LLMError, context?: {
    model?: string;
    baseURL?: string;
    inputLength?: number;
}): string {
    const formatted: FormattedError = {
        title: 'LLM Service Error',
        message: error.message,
        details: [],
    };

    switch (error.code) {
        case LLMErrorCodes.NETWORK_ERROR:
            formatted.title = 'Network Connection Error';
            formatted.suggestion = `Cannot reach the LLM service.\n` +
                                 `  • Check if the service is running (${context?.baseURL || 'unknown URL'})\n` +
                                 `  • For Ollama: run 'ollama serve'\n` +
                                 `  • For LM Studio: ensure the server is started\n` +
                                 `  • Check firewall settings`;
            break;

        case LLMErrorCodes.AUTHENTICATION_ERROR:
            formatted.title = 'Authentication Failed';
            formatted.suggestion = `Invalid or missing API key.\n` +
                                 `  • Check your API key is correct\n` +
                                 `  • Use --api-key option or set in config\n` +
                                 `  • For local models (Ollama/LM Studio), API key is not needed`;
            break;

        case LLMErrorCodes.RATE_LIMIT:
            formatted.title = 'Rate Limit Exceeded';
            const retryAfter = error.details?.retryAfter as number | undefined;
            formatted.suggestion = retryAfter
                ? `Too many requests. Retry after ${retryAfter} seconds.`
                : `Too many requests.\n` +
                  `  • Wait a moment and try again\n` +
                  `  • Reduce request frequency\n` +
                  `  • Check your API plan limits`;
            break;

        case LLMErrorCodes.TIMEOUT:
            formatted.title = 'Request Timeout';
            formatted.suggestion = `The LLM service didn't respond in time.\n` +
                                 `  • Local models: this is normal for long inputs or slower hardware\n` +
                                 `  • Try a faster model (e.g., llama3.2:3b instead of 70b)\n` +
                                 `  • Reduce input size\n` +
                                 `  • Increase timeout in config`;
            break;

        case LLMErrorCodes.TOKEN_LIMIT_EXCEEDED:
            formatted.title = 'Context Window Exceeded';
            formatted.message = error.message;
            formatted.suggestion = `The input is too large for this model's context window.\n` +
                                 `  • Model: ${context?.model || 'unknown'}\n` +
                                 `  • Input length: ~${context?.inputLength || 'unknown'} characters\n` +
                                 `\n` +
                                 `  Solutions:\n` +
                                 `  • Reduce input size (extract relevant sections only)\n` +
                                 `  • Use HTML preprocessing to strip noise: --strip-html\n` +
                                 `  • Switch to a model with larger context window\n` +
                                 `  • Split extraction into multiple passes (coming soon)`;
            break;

        case LLMErrorCodes.INVALID_RESPONSE:
            formatted.title = 'Invalid LLM Response';
            if (error.message.includes('JSON')) {
                formatted.suggestion = `The LLM didn't return valid JSON.\n` +
                                     `  • This usually happens with smaller or undertrained models\n` +
                                     `  • Try a more capable model (e.g., llama3.1:8b instead of 3b)\n` +
                                     `  • Simplify your schema\n` +
                                     `  • Reduce input complexity`;
            } else if (error.message.includes('confidence')) {
                formatted.suggestion = `The LLM response is missing the confidence score.\n` +
                                     `  • This is a model capability issue\n` +
                                     `  • Try a different model`;
            }
            break;

        case LLMErrorCodes.API_ERROR:
            // Check for common API error patterns
            const msg = error.message.toLowerCase();
            
            if (msg.includes('context') || msg.includes('token') || msg.includes('length')) {
                formatted.title = 'Context Window Exceeded';
                formatted.suggestion = `The input is too large for this model's context window.\n` +
                                     `  • Model: ${context?.model || 'unknown'}\n` +
                                     `  • Input length: ~${context?.inputLength || 'unknown'} characters\n` +
                                     `\n` +
                                     `  Solutions:\n` +
                                     `  • Reduce input size (extract relevant sections only)\n` +
                                     `  • Use HTML preprocessing to strip noise: --strip-html\n` +
                                     `  • Switch to a model with larger context window\n` +
                                     `  • Split extraction into multiple passes (coming soon)`;
            } else if (msg.includes('model') && msg.includes('not found')) {
                formatted.title = 'Model Not Found';
                formatted.suggestion = `The specified model is not available.\n` +
                                     `  • Model: ${context?.model || 'unknown'}\n` +
                                     `  • For Ollama: run 'ollama list' to see available models\n` +
                                     `  • Pull the model: 'ollama pull ${context?.model}'\n` +
                                     `  • For LM Studio: check loaded models in the UI`;
            } else if (error.statusCode === 404) {
                formatted.title = 'Endpoint Not Found';
                formatted.suggestion = `The API endpoint doesn't exist.\n` +
                                     `  • Check the base URL: ${context?.baseURL || 'unknown'}\n` +
                                     `  • Ensure /v1 suffix for Ollama/LM Studio\n` +
                                     `  • Verify the service supports OpenAI-compatible API`;
            } else if (error.statusCode && error.statusCode >= 500) {
                formatted.title = 'Service Error';
                formatted.suggestion = `The LLM service encountered an internal error.\n` +
                                     `  • Check service logs for details\n` +
                                     `  • Try again in a moment\n` +
                                     `  • Report to service provider if persistent`;
            }
            break;
    }

    // Add error details
    if (error.statusCode) {
        formatted.details?.push(`Status: ${error.statusCode}`);
    }
    if (context?.model) {
        formatted.details?.push(`Model: ${context.model}`);
    }
    if (context?.baseURL) {
        formatted.details?.push(`URL: ${context.baseURL}`);
    }

    return formatFormattedError(formatted);
}

/**
 * Format multiple validation errors into a readable message
 */
export function formatValidationErrors(
    errors: ValidationError[],
    schema?: Schema
): string {
    if (errors.length === 0) {
        return 'Validation passed';
    }

    const lines: string[] = [`Found ${errors.length} validation error${errors.length > 1 ? 's' : ''}:\n`];

    for (const error of errors) {
        const formatted = formatValidationError(error, schema, error.value);
        lines.push(formatted);
        lines.push('');
    }

    return lines.join('\n');
}

/**
 * Format any error into a user-friendly message
 */
export function formatError(
    error: unknown,
    context?: Record<string, unknown>
): string {
    // Handle null/undefined
    if (error === null || error === undefined) {
        return 'Unknown error occurred';
    }

    // Handle string
    if (typeof error === 'string') {
        return error;
    }

    // Handle non-object types
    if (typeof error !== 'object') {
        return `Unknown error: ${String(error)}`;
    }

    // Handle validation error plain objects from pipeline
    if ('field' in error && 'code' in error && 'message' in error) {
        const validationError = error as any;
        return formatValidationError(validationError, undefined, validationError.value);
    }

    // Handle LLMError
    if (error instanceof Error && 'code' in error && typeof error.code === 'string' && error.code in LLMErrorCodes) {
        return formatLLMError(error as LLMError, context);
    }

    // Handle SchemaValidationError  
    if (error instanceof Error && 'errors' in error && Array.isArray((error as any).errors)) {
        const schemaError = error as any;
        return `Schema validation failed:\n\n${formatValidationErrors(schemaError.errors)}`;
    }

    // Handle FormattedError
    if ('title' in error && 'message' in error) {
        return formatFormattedError(error as FormattedError);
    }

    // Handle generic Error
    if (error instanceof Error) {
        return error.message;
    }

    // Fallback
    return `Unknown error: ${JSON.stringify(error)}`;
}
