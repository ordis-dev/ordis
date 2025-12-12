/**
 * Extraction pipeline engine
 */

import { LLMClient } from '../llm/client.js';
import { validateExtractedData } from './validator.js';
import { PipelineError, PipelineErrorCodes } from './errors.js';
import type { ExtractionRequest, PipelineResult, StepResult } from './types.js';

/**
 * Main extraction pipeline
 */
export class ExtractionPipeline {
    private debug: boolean;

    constructor(debug: boolean = false) {
        this.debug = debug;
    }

    /**
     * Executes complete extraction pipeline
     */
    async extract(request: ExtractionRequest): Promise<PipelineResult> {
        const startTime = Date.now();
        const steps: StepResult[] = [];

        try {
            // Step 1: Create LLM client
            const clientStep = this.recordStep('create_client', () => {
                return new LLMClient(request.llmConfig);
            });
            steps.push(clientStep);

            if (!clientStep.success) {
                throw new PipelineError(
                    'Failed to create LLM client',
                    PipelineErrorCodes.LLM_ERROR,
                    'create_client'
                );
            }

            const client = clientStep.data as LLMClient;

            // Step 2: Call LLM for extraction
            const extractStep = await this.recordStepAsync('llm_extract', async () => {
                return await client.extract({
                    schema: request.schema,
                    input: request.input,
                });
            });
            steps.push(extractStep);

            if (!extractStep.success || !extractStep.data) {
                throw new PipelineError(
                    'LLM extraction failed',
                    PipelineErrorCodes.LLM_ERROR,
                    'llm_extract',
                    { error: extractStep.error }
                );
            }

            const extraction = extractStep.data as {
                data: Record<string, unknown>;
                confidence: number;
                confidenceByField: Record<string, number>;
            };

            // Step 3: Validate extracted data
            const validateStep = this.recordStep('validate_data', () => {
                return validateExtractedData(extraction.data, request.schema);
            });
            steps.push(validateStep);

            const validation = validateStep.data as { valid: boolean; errors: Array<{ field: string; message: string; code: string }> };

            if (!validation.valid) {
                const duration = Date.now() - startTime;
                return {
                    success: false,
                    meetsThreshold: false,
                    errors: validation.errors,
                    steps: this.debug ? steps : undefined,
                    metadata: {
                        duration,
                        model: request.llmConfig.model,
                        schemaName: request.schema.metadata?.name,
                    },
                };
            }

            // Step 4: Check confidence threshold
            const confidenceStep = this.recordStep('check_confidence', () => {
                if (!request.schema.confidence) {
                    return { meetsThreshold: true };
                }

                const { threshold, failOnLowConfidence } = request.schema.confidence;
                const meetsThreshold = extraction.confidence >= threshold;

                return {
                    meetsThreshold,
                    shouldFail: !meetsThreshold && failOnLowConfidence,
                };
            });
            steps.push(confidenceStep);

            const confidenceCheck = confidenceStep.data as { meetsThreshold: boolean; shouldFail?: boolean };

            if (confidenceCheck.shouldFail) {
                const duration = Date.now() - startTime;
                return {
                    success: false,
                    data: extraction.data,
                    confidence: extraction.confidence,
                    confidenceByField: extraction.confidenceByField,
                    meetsThreshold: false,
                    errors: [
                        {
                            message: `Confidence ${extraction.confidence}% below threshold ${request.schema.confidence?.threshold}%`,
                            code: PipelineErrorCodes.CONFIDENCE_ERROR,
                        },
                    ],
                    steps: this.debug ? steps : undefined,
                    metadata: {
                        duration,
                        model: request.llmConfig.model,
                        schemaName: request.schema.metadata?.name,
                    },
                };
            }

            // Success!
            const duration = Date.now() - startTime;
            return {
                success: true,
                data: extraction.data,
                confidence: extraction.confidence,
                confidenceByField: extraction.confidenceByField,
                meetsThreshold: confidenceCheck.meetsThreshold,
                errors: [],
                steps: this.debug ? steps : undefined,
                metadata: {
                    duration,
                    model: request.llmConfig.model,
                    schemaName: request.schema.metadata?.name,
                },
            };
        } catch (error) {
            const duration = Date.now() - startTime;

            if (error instanceof PipelineError) {
                return {
                    success: false,
                    meetsThreshold: false,
                    errors: [
                        {
                            message: error.message,
                            code: error.code,
                        },
                    ],
                    steps: this.debug ? steps : undefined,
                    metadata: {
                        duration,
                        model: request.llmConfig.model,
                        schemaName: request.schema.metadata?.name,
                    },
                };
            }

            return {
                success: false,
                meetsThreshold: false,
                errors: [
                    {
                        message: (error as Error).message,
                        code: 'UNKNOWN_ERROR',
                    },
                ],
                steps: this.debug ? steps : undefined,
                metadata: {
                    duration,
                    model: request.llmConfig.model,
                    schemaName: request.schema.metadata?.name,
                },
            };
        }
    }

    /**
     * Records a synchronous step
     */
    private recordStep<T>(name: string, fn: () => T): StepResult {
        const startTime = Date.now();
        try {
            const result = fn();
            const duration = Date.now() - startTime;
            return {
                step: name,
                success: true,
                data: result,
                duration,
            };
        } catch (error) {
            const duration = Date.now() - startTime;
            return {
                step: name,
                success: false,
                error: (error as Error).message,
                duration,
            };
        }
    }

    /**
     * Records an async step
     */
    private async recordStepAsync<T>(name: string, fn: () => Promise<T>): Promise<StepResult> {
        const startTime = Date.now();
        try {
            const result = await fn();
            const duration = Date.now() - startTime;
            return {
                step: name,
                success: true,
                data: result,
                duration,
            };
        } catch (error) {
            const duration = Date.now() - startTime;
            return {
                step: name,
                success: false,
                error: (error as Error).message,
                duration,
            };
        }
    }
}

/**
 * Convenience function to run extraction
 */
export async function extract(request: ExtractionRequest): Promise<PipelineResult> {
    const pipeline = new ExtractionPipeline(request.debug);
    return await pipeline.extract(request);
}
