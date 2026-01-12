/**
 * Tests for type coercion module
 */

import { describe, it, expect } from 'vitest';
import { coerceValue, coerceExtractedData, coerceEnumValue, coerceDateValue } from '../coercion.js';

describe('Type Coercion', () => {
    describe('coerceValue', () => {
        describe('null-like strings', () => {
            it('should coerce "null" string to null for optional fields', () => {
                const result = coerceValue('null', 'number', 'amount', true);
                expect(result.value).toBe(null);
                expect(result.coerced).toBe(true);
                expect(result.warning?.originalValue).toBe('null');
                expect(result.warning?.coercedValue).toBe(null);
            });

            it('should coerce "N/A" string to null for optional fields', () => {
                const result = coerceValue('N/A', 'string', 'name', true);
                expect(result.value).toBe(null);
                expect(result.coerced).toBe(true);
            });

            it('should coerce empty string to null for optional fields', () => {
                const result = coerceValue('', 'number', 'count', true);
                expect(result.value).toBe(null);
                expect(result.coerced).toBe(true);
            });

            it('should coerce "none" string to null for optional fields', () => {
                const result = coerceValue('none', 'string', 'value', true);
                expect(result.value).toBe(null);
                expect(result.coerced).toBe(true);
            });

            it('should coerce "undefined" string to null for optional fields', () => {
                const result = coerceValue('undefined', 'boolean', 'flag', true);
                expect(result.value).toBe(null);
                expect(result.coerced).toBe(true);
            });

            it('should NOT coerce null-like strings for required fields (let validation handle)', () => {
                const result = coerceValue('null', 'number', 'amount', false);
                // For required fields, it won't coerce to null but will try type coercion
                // 'null' can't be parsed as number, so value remains unchanged
                expect(result.value).toBe('null');
                expect(result.coerced).toBe(false);
            });
        });

        describe('number coercion', () => {
            it('should not coerce actual numbers', () => {
                const result = coerceValue(42, 'number', 'count', false);
                expect(result.value).toBe(42);
                expect(result.coerced).toBe(false);
            });

            it('should coerce string "123" to number 123', () => {
                const result = coerceValue('123', 'number', 'count', false);
                expect(result.value).toBe(123);
                expect(result.coerced).toBe(true);
                expect(result.warning?.message).toContain("Coerced string '123' to number 123");
            });

            it('should coerce string "1.5" to number 1.5', () => {
                const result = coerceValue('1.5', 'number', 'price', false);
                expect(result.value).toBe(1.5);
                expect(result.coerced).toBe(true);
            });

            it('should coerce string "-42.5" to number -42.5', () => {
                const result = coerceValue('-42.5', 'number', 'delta', false);
                expect(result.value).toBe(-42.5);
                expect(result.coerced).toBe(true);
            });

            it('should coerce boolean true to 1', () => {
                const result = coerceValue(true, 'number', 'flag', false);
                expect(result.value).toBe(1);
                expect(result.coerced).toBe(true);
            });

            it('should coerce boolean false to 0', () => {
                const result = coerceValue(false, 'number', 'flag', false);
                expect(result.value).toBe(0);
                expect(result.coerced).toBe(true);
            });
        });

        describe('integer coercion', () => {
            it('should not coerce actual integers', () => {
                const result = coerceValue(42, 'integer', 'count', false);
                expect(result.value).toBe(42);
                expect(result.coerced).toBe(false);
            });

            it('should coerce string "123" to integer 123', () => {
                const result = coerceValue('123', 'integer', 'count', false);
                expect(result.value).toBe(123);
                expect(result.coerced).toBe(true);
            });

            it('should truncate float to integer', () => {
                const result = coerceValue(3.7, 'integer', 'count', false);
                expect(result.value).toBe(3);
                expect(result.coerced).toBe(true);
            });

            it('should coerce string float to integer', () => {
                const result = coerceValue('3.9', 'integer', 'count', false);
                expect(result.value).toBe(3);
                expect(result.coerced).toBe(true);
            });
        });

        describe('boolean coercion', () => {
            it('should not coerce actual booleans', () => {
                const result = coerceValue(true, 'boolean', 'active', false);
                expect(result.value).toBe(true);
                expect(result.coerced).toBe(false);
            });

            it('should coerce string "true" to boolean true', () => {
                const result = coerceValue('true', 'boolean', 'active', false);
                expect(result.value).toBe(true);
                expect(result.coerced).toBe(true);
            });

            it('should coerce string "false" to boolean false', () => {
                const result = coerceValue('false', 'boolean', 'active', false);
                expect(result.value).toBe(false);
                expect(result.coerced).toBe(true);
            });

            it('should coerce string "yes" to boolean true', () => {
                const result = coerceValue('yes', 'boolean', 'active', false);
                expect(result.value).toBe(true);
                expect(result.coerced).toBe(true);
            });

            it('should coerce string "no" to boolean false', () => {
                const result = coerceValue('no', 'boolean', 'active', false);
                expect(result.value).toBe(false);
                expect(result.coerced).toBe(true);
            });

            it('should coerce string "1" to boolean true', () => {
                const result = coerceValue('1', 'boolean', 'active', false);
                expect(result.value).toBe(true);
                expect(result.coerced).toBe(true);
            });

            it('should coerce string "0" to boolean false', () => {
                const result = coerceValue('0', 'boolean', 'active', false);
                expect(result.value).toBe(false);
                expect(result.coerced).toBe(true);
            });

            it('should coerce number 1 to boolean true', () => {
                const result = coerceValue(1, 'boolean', 'active', false);
                expect(result.value).toBe(true);
                expect(result.coerced).toBe(true);
            });

            it('should coerce number 0 to boolean false', () => {
                const result = coerceValue(0, 'boolean', 'active', false);
                expect(result.value).toBe(false);
                expect(result.coerced).toBe(true);
            });

            it('should be case-insensitive', () => {
                expect(coerceValue('TRUE', 'boolean', 'active', false).value).toBe(true);
                expect(coerceValue('False', 'boolean', 'active', false).value).toBe(false);
                expect(coerceValue('YES', 'boolean', 'active', false).value).toBe(true);
                expect(coerceValue('No', 'boolean', 'active', false).value).toBe(false);
            });
        });

        describe('string coercion', () => {
            it('should not coerce actual strings', () => {
                const result = coerceValue('hello', 'string', 'name', false);
                expect(result.value).toBe('hello');
                expect(result.coerced).toBe(false);
            });

            it('should coerce number to string', () => {
                const result = coerceValue(42, 'string', 'code', false);
                expect(result.value).toBe('42');
                expect(result.coerced).toBe(true);
            });

            it('should coerce boolean to string', () => {
                const result = coerceValue(true, 'string', 'status', false);
                expect(result.value).toBe('true');
                expect(result.coerced).toBe(true);
            });
        });

        describe('edge cases', () => {
            it('should handle null value', () => {
                const result = coerceValue(null, 'string', 'name', true);
                expect(result.value).toBe(null);
                expect(result.coerced).toBe(false);
            });

            it('should handle undefined value', () => {
                const result = coerceValue(undefined, 'number', 'count', true);
                expect(result.value).toBe(undefined);
                expect(result.coerced).toBe(false);
            });

            it('should trim whitespace before coercion', () => {
                const result = coerceValue('  123  ', 'number', 'count', false);
                expect(result.value).toBe(123);
                expect(result.coerced).toBe(true);
            });
        });
    });

    describe('coerceExtractedData', () => {
        it('should coerce multiple fields', () => {
            const data = {
                name: 'John',
                age: '30',
                active: 'yes',
            };
            const fields = {
                name: { type: 'string' as const },
                age: { type: 'number' as const },
                active: { type: 'boolean' as const },
            };

            const result = coerceExtractedData(data, fields);

            expect(result.data.name).toBe('John');
            expect(result.data.age).toBe(30);
            expect(result.data.active).toBe(true);
            expect(result.warnings).toHaveLength(2); // age and active were coerced
        });

        it('should coerce null strings to null for optional fields', () => {
            const data = {
                name: 'John',
                amount: 'null',
            };
            const fields = {
                name: { type: 'string' as const },
                amount: { type: 'number' as const, optional: true },
            };

            const result = coerceExtractedData(data, fields);

            expect(result.data.name).toBe('John');
            expect(result.data.amount).toBe(null);
            expect(result.warnings).toHaveLength(1);
            expect(result.warnings[0].field).toBe('amount');
        });

        it('should preserve fields not in schema', () => {
            const data = {
                name: 'John',
                extra: 'value',
            };
            const fields = {
                name: { type: 'string' as const },
            };

            const result = coerceExtractedData(data, fields);

            expect(result.data.name).toBe('John');
            expect(result.data.extra).toBe('value');
        });

        it('should return empty warnings array when no coercion needed', () => {
            const data = {
                name: 'John',
                age: 30,
                active: true,
            };
            const fields = {
                name: { type: 'string' as const },
                age: { type: 'number' as const },
                active: { type: 'boolean' as const },
            };

            const result = coerceExtractedData(data, fields);

            expect(result.warnings).toHaveLength(0);
        });
    });

    describe('enum coercion', () => {
        it('should not coerce exact enum match', () => {
            const data = { status: 'active' };
            const fields = {
                status: { 
                    type: 'string' as const, 
                    enum: ['active', 'inactive', 'pending'] 
                },
            };

            const result = coerceExtractedData(data, fields);

            expect(result.data.status).toBe('active');
            expect(result.warnings).toHaveLength(0);
        });

        it('should coerce "Active" to "active" (case insensitive)', () => {
            const data = { status: 'Active' };
            const fields = {
                status: { 
                    type: 'string' as const, 
                    enum: ['active', 'inactive', 'pending'] 
                },
            };

            const result = coerceExtractedData(data, fields);

            expect(result.data.status).toBe('active');
            expect(result.warnings).toHaveLength(1);
            expect(result.warnings[0].originalValue).toBe('Active');
            expect(result.warnings[0].coercedValue).toBe('active');
        });

        it('should coerce "Series B" to "series_b" (spaces to underscores)', () => {
            const data = { round_type: 'Series B' };
            const fields = {
                round_type: { 
                    type: 'string' as const, 
                    enum: ['pre_seed', 'seed', 'series_a', 'series_b', 'series_c'] 
                },
            };

            const result = coerceExtractedData(data, fields);

            expect(result.data.round_type).toBe('series_b');
            expect(result.warnings).toHaveLength(1);
            expect(result.warnings[0].message).toContain("Coerced enum value 'Series B' to 'series_b'");
        });

        it('should coerce "SERIES-A" to "series_a" (hyphens to underscores)', () => {
            const data = { round_type: 'SERIES-A' };
            const fields = {
                round_type: { 
                    type: 'string' as const, 
                    enum: ['pre_seed', 'seed', 'series_a', 'series_b'] 
                },
            };

            const result = coerceExtractedData(data, fields);

            expect(result.data.round_type).toBe('series_a');
            expect(result.warnings).toHaveLength(1);
        });

        it('should not coerce if no enum match found', () => {
            const data = { status: 'unknown_value' };
            const fields = {
                status: { 
                    type: 'string' as const, 
                    enum: ['active', 'inactive'] 
                },
            };

            const result = coerceExtractedData(data, fields);

            // Value unchanged, validation will catch it
            expect(result.data.status).toBe('unknown_value');
            expect(result.warnings).toHaveLength(0);
        });
    });

    describe('recursive array coercion', () => {
        it('should coerce values inside array items', () => {
            const data = {
                items: [
                    { name: 'Item 1', price: '10.50' },
                    { name: 'Item 2', price: '20.00' },
                ],
            };
            const fields = {
                items: {
                    type: 'array' as const,
                    items: {
                        type: 'object' as const,
                        properties: {
                            name: { type: 'string' as const },
                            price: { type: 'number' as const },
                        },
                    },
                },
            };

            const result = coerceExtractedData(data, fields);
            const items = result.data.items as Array<{ name: string; price: number }>;

            expect(items[0].price).toBe(10.50);
            expect(items[1].price).toBe(20.00);
            expect(result.warnings).toHaveLength(2);
            expect(result.warnings[0].field).toBe('items[0].price');
            expect(result.warnings[1].field).toBe('items[1].price');
        });

        it('should coerce enum values inside array items', () => {
            const data = {
                funding_rounds: [
                    { round_type: 'Seed', amount: 1000000 },
                    { round_type: 'Series A', amount: 5000000 },
                    { round_type: 'Series B', amount: 20000000 },
                ],
            };
            const fields = {
                funding_rounds: {
                    type: 'array' as const,
                    items: {
                        type: 'object' as const,
                        properties: {
                            round_type: { 
                                type: 'string' as const,
                                enum: ['pre_seed', 'seed', 'series_a', 'series_b', 'series_c']
                            },
                            amount: { type: 'number' as const },
                        },
                    },
                },
            };

            const result = coerceExtractedData(data, fields);
            const rounds = result.data.funding_rounds as Array<{ round_type: string; amount: number }>;

            expect(rounds[0].round_type).toBe('seed');
            expect(rounds[1].round_type).toBe('series_a');
            expect(rounds[2].round_type).toBe('series_b');
            expect(result.warnings).toHaveLength(3);
        });

        it('should handle nested null values in arrays', () => {
            const data = {
                items: [
                    { name: 'Item 1', price: null },
                    { name: 'Item 2', price: 20.00 },
                ],
            };
            const fields = {
                items: {
                    type: 'array' as const,
                    items: {
                        type: 'object' as const,
                        properties: {
                            name: { type: 'string' as const },
                            price: { type: 'number' as const, optional: true },
                        },
                    },
                },
            };

            const result = coerceExtractedData(data, fields);
            const items = result.data.items as Array<{ name: string; price: number | null }>;

            expect(items[0].price).toBe(null);
            expect(items[1].price).toBe(20.00);
            expect(result.warnings).toHaveLength(0);
        });
    });

    describe('recursive object coercion', () => {
        it('should coerce values inside nested objects', () => {
            const data = {
                address: {
                    city: 'New York',
                    zip: '10001',
                },
            };
            const fields = {
                address: {
                    type: 'object' as const,
                    properties: {
                        city: { type: 'string' as const },
                        zip: { type: 'integer' as const },
                    },
                },
            };

            const result = coerceExtractedData(data, fields);
            const address = result.data.address as { city: string; zip: number };

            expect(address.city).toBe('New York');
            expect(address.zip).toBe(10001);
            expect(result.warnings).toHaveLength(1);
            expect(result.warnings[0].field).toBe('address.zip');
        });

        it('should coerce enum values inside nested objects', () => {
            const data = {
                investor: {
                    name: 'Sequoia',
                    type: 'Venture Capital',
                },
            };
            const fields = {
                investor: {
                    type: 'object' as const,
                    properties: {
                        name: { type: 'string' as const },
                        type: { 
                            type: 'string' as const,
                            enum: ['vc', 'angel', 'corporate', 'venture_capital']
                        },
                    },
                },
            };

            const result = coerceExtractedData(data, fields);
            const investor = result.data.investor as { name: string; type: string };

            expect(investor.name).toBe('Sequoia');
            expect(investor.type).toBe('venture_capital');
            expect(result.warnings).toHaveLength(1);
            expect(result.warnings[0].field).toBe('investor.type');
        });
    });

    describe('date coercion', () => {
        describe('coerceDateValue', () => {
            it('should not coerce already ISO format dates', () => {
                const result = coerceDateValue('2024-11-20', 'date_field');
                expect(result.value).toBe('2024-11-20');
                expect(result.coerced).toBe(false);
            });

            it('should coerce US format MM/DD/YYYY to ISO', () => {
                const result = coerceDateValue('11/20/2024', 'date_field');
                expect(result.value).toBe('2024-11-20');
                expect(result.coerced).toBe(true);
                expect(result.warning?.message).toContain("Coerced date '11/20/2024' to ISO format '2024-11-20'");
            });

            it('should coerce short year format MM/DD/YY to ISO', () => {
                const result = coerceDateValue('11/20/24', 'date_field');
                expect(result.value).toBe('2024-11-20');
                expect(result.coerced).toBe(true);
            });

            it('should coerce short year in 1900s (MM/DD/YY where YY >= 50)', () => {
                const result = coerceDateValue('11/20/99', 'date_field');
                expect(result.value).toBe('1999-11-20');
                expect(result.coerced).toBe(true);
            });

            it('should coerce European format DD-MM-YYYY to ISO', () => {
                const result = coerceDateValue('20-11-2024', 'date_field');
                expect(result.value).toBe('2024-11-20');
                expect(result.coerced).toBe(true);
            });

            it('should coerce European format DD.MM.YYYY to ISO', () => {
                const result = coerceDateValue('20.11.2024', 'date_field');
                expect(result.value).toBe('2024-11-20');
                expect(result.coerced).toBe(true);
            });

            it('should coerce written format "January 15, 2024" to ISO', () => {
                const result = coerceDateValue('January 15, 2024', 'date_field');
                expect(result.value).toBe('2024-01-15');
                expect(result.coerced).toBe(true);
            });

            it('should coerce abbreviated month "Jan 15, 2024" to ISO', () => {
                const result = coerceDateValue('Jan 15, 2024', 'date_field');
                expect(result.value).toBe('2024-01-15');
                expect(result.coerced).toBe(true);
            });

            it('should coerce "15 January 2024" format to ISO', () => {
                const result = coerceDateValue('15 January 2024', 'date_field');
                expect(result.value).toBe('2024-01-15');
                expect(result.coerced).toBe(true);
            });

            it('should strip time from ISO datetime and normalize', () => {
                const result = coerceDateValue('2025-01-25T10:00:00', 'date_field');
                expect(result.value).toBe('2025-01-25');
                expect(result.coerced).toBe(false); // Starts with ISO date, just stripped
            });

            it('should not coerce invalid date string', () => {
                const result = coerceDateValue('not a date', 'date_field');
                expect(result.value).toBe('not a date');
                expect(result.coerced).toBe(false);
            });

            it('should not coerce out-of-range dates', () => {
                const result = coerceDateValue('13/45/2024', 'date_field');
                // Month 13, day 45 is invalid
                expect(result.coerced).toBe(false);
            });
        });

        describe('date coercion in coerceExtractedData', () => {
            it('should coerce date fields with format="date"', () => {
                const data = {
                    event_date: '11/20/24',
                    name: 'Test Event',
                };
                const fields = {
                    event_date: { type: 'string' as const, format: 'date' },
                    name: { type: 'string' as const },
                };

                const result = coerceExtractedData(data, fields);

                expect(result.data.event_date).toBe('2024-11-20');
                expect(result.data.name).toBe('Test Event');
                expect(result.warnings).toHaveLength(1);
                expect(result.warnings[0].field).toBe('event_date');
            });

            it('should coerce date fields with format="date-time"', () => {
                const data = {
                    timestamp: 'Jan 15, 2024',
                };
                const fields = {
                    timestamp: { type: 'string' as const, format: 'date-time' },
                };

                const result = coerceExtractedData(data, fields);

                expect(result.data.timestamp).toBe('2024-01-15');
                expect(result.warnings).toHaveLength(1);
            });

            it('should coerce dates inside array items', () => {
                const data = {
                    events: [
                        { name: 'Event 1', date: '11/20/24' },
                        { name: 'Event 2', date: 'January 15, 2025' },
                    ],
                };
                const fields = {
                    events: {
                        type: 'array' as const,
                        items: {
                            type: 'object' as const,
                            properties: {
                                name: { type: 'string' as const },
                                date: { type: 'string' as const, format: 'date' },
                            },
                        },
                    },
                };

                const result = coerceExtractedData(data, fields);
                const events = result.data.events as Array<{ name: string; date: string }>;

                expect(events[0].date).toBe('2024-11-20');
                expect(events[1].date).toBe('2025-01-15');
                expect(result.warnings).toHaveLength(2);
                expect(result.warnings[0].field).toBe('events[0].date');
                expect(result.warnings[1].field).toBe('events[1].date');
            });

            it('should not coerce string fields without date format', () => {
                const data = {
                    description: '11/20/24', // Looks like a date but no format specified
                };
                const fields = {
                    description: { type: 'string' as const },
                };

                const result = coerceExtractedData(data, fields);

                expect(result.data.description).toBe('11/20/24');
                expect(result.warnings).toHaveLength(0);
            });
        });
    });
});
