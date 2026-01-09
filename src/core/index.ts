/**
 * Core pipeline module exports
 */

export { ExtractionPipeline, extract } from './pipeline.js';
export { validateExtractedData } from './validator.js';
export { PipelineError, PipelineErrorCodes } from './errors.js';
export {
    stripHtml,
    preprocess,
    preprocessWithDetails,
    resolveHtmlStripOptions,
} from './preprocessor.js';
export type { PreprocessResult } from './preprocessor.js';
export type {
    PipelineConfig,
    ExtractionRequest,
    PipelineResult,
    StepResult,
    HtmlStripOptions,
    PreprocessingConfig,
} from './types.js';
