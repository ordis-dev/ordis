/**
 * Integration tests for schema system
 */

import { describe, it, expect } from 'vitest';
import { parseSchema } from '../loader.js';
import { SchemaValidationError, ErrorCodes } from '../errors.js';

describe('Schema System Integration', () => {
    describe('End-to-end validation', () => {
        it('should successfully parse and validate complete invoice schema', () => {
            const schemaJson = `{
        "fields": {
          "invoice_id": {
            "type": "string",
            "description": "Unique invoice identifier"
          },
          "amount": {
            "type": "number",
            "description": "Total invoice amount"
          },
          "currency": {
            "type": "string",
            "enum": ["USD", "SGD", "EUR"],
            "description": "Currency code"
          },
          "date": {
            "type": "string",
            "format": "date-time",
            "optional": true,
            "description": "Invoice date"
          }
        }
      }`;

            const schema = parseSchema(schemaJson);

            expect(schema.fields).toBeDefined();
            expect(Object.keys(schema.fields)).toHaveLength(4);
            expect(schema.fields.invoice_id.type).toBe('string');
            expect(schema.fields.amount.type).toBe('number');
            expect(schema.fields.currency.enum).toEqual(['USD', 'SGD', 'EUR']);
            expect(schema.fields.date.optional).toBe(true);
        });

        it('should catch multiple validation errors in order', () => {
            // Test that validation stops at first error (fail-fast approach)
            const invalidSchemas = [
                '{ "notFields": {} }', // Missing fields
                '{ "fields": {} }', // Empty fields
                '{ "fields": { "": { "type": "string" } } }', // Empty field name
                '{ "fields": { "123": { "type": "string" } } }', // Invalid field name
                '{ "fields": { "name": {} } }', // Missing type
                '{ "fields": { "name": { "type": "invalid" } } }', // Invalid type
            ];

            invalidSchemas.forEach((schemaJson) => {
                expect(() => parseSchema(schemaJson)).toThrow(SchemaValidationError);
            });
        });

        it('should validate complex nested constraints', () => {
            const schemaJson = `{
        "fields": {
          "price": {
            "type": "number",
            "min": 0.01,
            "max": 999999.99
          },
          "status": {
            "type": "string",
            "enum": ["draft", "pending", "approved", "rejected", "archived"]
          },
          "email": {
            "type": "string",
            "pattern": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\\\.[a-zA-Z]{2,}$"
          }
        },
        "metadata": {
          "name": "Order Schema",
          "version": "3.1.0",
          "description": "Schema for order processing"
        }
      }`;

            const schema = parseSchema(schemaJson);

            expect(schema.fields.price.min).toBe(0.01);
            expect(schema.fields.price.max).toBe(999999.99);
            expect(schema.fields.status.enum).toHaveLength(5);
            expect(schema.fields.email.pattern).toBeDefined();
            expect(schema.metadata?.version).toBe('3.1.0');
        });
    });

    describe('Error reporting quality', () => {
        it('should provide clear error for missing fields property', () => {
            const schemaJson = '{ "metadata": { "name": "Test" } }';

            try {
                parseSchema(schemaJson);
                expect.fail('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(SchemaValidationError);
                const err = error as SchemaValidationError;
                expect(err.message).toContain('fields');
                expect(err.code).toBe(ErrorCodes.MISSING_FIELDS);
            }
        });

        it('should provide clear error for invalid field type', () => {
            const schemaJson = '{ "fields": { "name": { "type": "text" } } }';

            try {
                parseSchema(schemaJson);
                expect.fail('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(SchemaValidationError);
                const err = error as SchemaValidationError;
                expect(err.message).toContain('invalid type');
                expect(err.message).toContain('text');
                expect(err.field).toBe('name');
                expect(err.code).toBe(ErrorCodes.INVALID_FIELD_TYPE);
                expect(err.details?.validTypes).toEqual(['string', 'number', 'integer', 'boolean', 'array', 'object']);
            }
        });

        it('should provide clear error for invalid field type', () => {
            const schemaJson = '{ "fields": { "status": { "type": "enum" } } }';

            try {
                parseSchema(schemaJson);
                expect.fail('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(SchemaValidationError);
                const err = error as SchemaValidationError;
                expect(err.message).toContain('invalid type');
                expect(err.field).toBe('status');
                expect(err.code).toBe(ErrorCodes.INVALID_FIELD_TYPE);
            }
        });

        it('should provide clear error for constraint mismatch', () => {
            const schemaJson = '{ "fields": { "age": { "type": "number", "min": 100, "max": 50 } } }';

            try {
                parseSchema(schemaJson);
                expect.fail('Should have thrown');
            } catch (error) {
                expect(error).toBeInstanceOf(SchemaValidationError);
                const err = error as SchemaValidationError;
                expect(err.message).toContain('cannot be greater than');
                expect(err.field).toBe('age');
                expect(err.code).toBe(ErrorCodes.CONSTRAINT_MISMATCH);
                expect(err.details?.min).toBe(100);
                expect(err.details?.max).toBe(50);
            }
        });
    });

    describe('Realistic use cases', () => {
        it('should handle product catalog schema', () => {
            const schema = parseSchema(`{
        "fields": {
          "sku": {
            "type": "string",
            "pattern": "^[A-Z]{3}-[0-9]{6}$",
            "description": "Stock Keeping Unit"
          },
          "name": {
            "type": "string",
            "description": "Product name"
          },
          "price": {
            "type": "number",
            "min": 0,
            "description": "Price in cents"
          },
          "category": {
            "type": "string",
            "enum": ["electronics", "clothing", "books", "food"],
            "description": "Product category"
          },
          "in_stock": {
            "type": "string",
            "enum": ["yes", "no"],
            "description": "Stock availability"
          },
          "discontinued_date": {
            "type": "string",
            "format": "date-time",
            "optional": true,
            "description": "Date when product was discontinued"
          }
        },
        "metadata": {
          "name": "Product Catalog",
          "version": "1.0.0"
        }
      }`);

            expect(schema.fields.sku.pattern).toBe('^[A-Z]{3}-[0-9]{6}$');
            expect(schema.fields.category.enum).toHaveLength(4);
            expect(schema.fields.discontinued_date.optional).toBe(true);
        });

        it('should handle event registration schema', () => {
            const schema = parseSchema(`{
        "fields": {
          "event_name": {
            "type": "string"
          },
          "attendee_count": {
            "type": "number",
            "min": 1,
            "max": 10000
          },
          "event_type": {
            "type": "string",
            "enum": ["conference", "workshop", "webinar", "meetup"]
          },
          "event_date": {
            "type": "string",
            "format": "date-time"
          },
          "registration_email": {
            "type": "string",
            "pattern": "^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\\\.[a-zA-Z]{2,}$"
          },
          "notes": {
            "type": "string",
            "optional": true
          }
        }
      }`);

            expect(schema.fields.attendee_count.min).toBe(1);
            expect(schema.fields.attendee_count.max).toBe(10000);
            expect(schema.fields.event_type.enum).toContain('workshop');
            expect(schema.fields.notes.optional).toBe(true);
        });
    });

    describe('Edge cases', () => {
        it('should handle schema with only one field', () => {
            const schema = parseSchema(`{
        "fields": {
          "id": { "type": "string" }
        }
      }`);

            expect(Object.keys(schema.fields)).toHaveLength(1);
        });

        it('should handle fields with all optional properties', () => {
            const schema = parseSchema(`{
        "fields": {
          "field1": {
            "type": "string",
            "description": "A field",
            "optional": true
          }
        }
      }`);

            expect(schema.fields.field1.optional).toBe(true);
            expect(schema.fields.field1.description).toBe('A field');
        });

        it('should handle minimal valid schema', () => {
            const schema = parseSchema(`{
        "fields": {
          "x": { "type": "string" }
        }
      }`);

            expect(schema.fields.x.type).toBe('string');
        });

        it('should handle schema with metadata only', () => {
            const schema = parseSchema(`{
        "fields": {
          "id": { "type": "string" }
        },
        "metadata": {
          "name": "Simple Schema"
        }
      }`);

            expect(schema.metadata?.name).toBe('Simple Schema');
            expect(schema.metadata?.version).toBeUndefined();
            expect(schema.metadata?.description).toBeUndefined();
        });
    });

    describe('Confidence Configuration', () => {
        it('should parse schema with strict confidence requirements', () => {
            const schema = parseSchema(`{
        "fields": {
          "transaction_id": { "type": "string" },
          "amount": { "type": "number" }
        },
        "confidence": {
          "threshold": 95,
          "failOnLowConfidence": true
        },
        "metadata": {
          "name": "Financial Transaction",
          "description": "High-confidence extraction for financial data"
        }
      }`);

            expect(schema.confidence?.threshold).toBe(95);
            expect(schema.confidence?.failOnLowConfidence).toBe(true);
        });

        it('should parse schema with permissive confidence settings', () => {
            const schema = parseSchema(`{
        "fields": {
          "title": { "type": "string" },
          "tags": { "type": "string", "optional": true }
        },
        "confidence": {
          "threshold": 60,
          "failOnLowConfidence": false
        }
      }`);

            expect(schema.confidence?.threshold).toBe(60);
            expect(schema.confidence?.failOnLowConfidence).toBe(false);
        });

        it('should allow schema without confidence config', () => {
            const schema = parseSchema(`{
        "fields": {
          "name": { "type": "string" }
        }
      }`);

            expect(schema.confidence).toBeUndefined();
        });

        it('should reject schema with invalid confidence threshold', () => {
            const invalidSchema = `{
        "fields": {
          "name": { "type": "string" }
        },
        "confidence": {
          "threshold": 150,
          "failOnLowConfidence": true
        }
      }`;

            expect(() => parseSchema(invalidSchema)).toThrow(SchemaValidationError);
            expect(() => parseSchema(invalidSchema)).toThrow(/between 0 and 100/);
        });

        it('should reject schema with incomplete confidence config', () => {
            const incompleteSchema = `{
        "fields": {
          "name": { "type": "string" }
        },
        "confidence": {
          "threshold": 80
        }
      }`;

            expect(() => parseSchema(incompleteSchema)).toThrow(SchemaValidationError);
            expect(() => parseSchema(incompleteSchema)).toThrow(/failOnLowConfidence/);
        });

        it('should handle real-world high-stakes schema', () => {
            const schema = parseSchema(`{
        "fields": {
          "invoice_number": {
            "type": "string",
            "pattern": "^INV-[0-9]{6}$"
          },
          "total_amount": {
            "type": "number",
            "min": 0
          },
          "payment_status": {
            "type": "string",
            "enum": ["paid", "pending", "overdue"]
          }
        },
        "confidence": {
          "threshold": 90,
          "failOnLowConfidence": true
        },
        "metadata": {
          "name": "Invoice Extraction",
          "version": "2.0.0",
          "description": "Requires 90% confidence for automated processing"
        }
      }`);

            expect(schema.fields.invoice_number.pattern).toBeDefined();
            expect(schema.confidence?.threshold).toBe(90);
            expect(schema.confidence?.failOnLowConfidence).toBe(true);
            expect(schema.metadata?.version).toBe('2.0.0');
        });
    });
});
