#!/usr/bin/env node

/**
 * Ordis CLI - Schema-first extraction tool
 * Entrypoint for the command-line interface
 */

import * as fs from 'fs/promises';
import * as path from 'path';
import { loadSchema } from './schemas/loader.js';
import { extract } from './core/pipeline.js';
import type { LLMConfig } from './llm/types.js';
import packageJson from '../package.json' with { type: 'json' };

interface CliArgs {
    command?: string;
    schema?: string;
    input?: string;
    base?: string;
    model?: string;
    debug?: boolean;
}

function parseArgs(args: string[]): CliArgs {
    const parsed: CliArgs = {};

    for (let i = 2; i < args.length; i++) {
        const arg = args[i];

        if (arg === '--help' || arg === '-h') {
            showHelp();
            process.exit(0);
        }

        if (arg === '--version' || arg === '-v') {
            showVersion();
            process.exit(0);
        }

        if (arg === '--debug') {
            parsed.debug = true;
            continue;
        }

        if (arg === '--schema' && args[i + 1]) {
            parsed.schema = args[++i];
        } else if (arg === '--input' && args[i + 1]) {
            parsed.input = args[++i];
        } else if (arg === '--base' && args[i + 1]) {
            parsed.base = args[++i];
        } else if (arg === '--model' && args[i + 1]) {
            parsed.model = args[++i];
        } else if (!arg.startsWith('--')) {
            parsed.command = arg;
        }
    }

    return parsed;
}

function showHelp(): void {
    console.log(`
Ordis CLI - Schema-first LLM extraction tool

USAGE:
  ordis extract [OPTIONS]

OPTIONS:
  --schema <path>   Path to schema definition file (JSON)
  --input <path>    Path to input text file
  --base <url>      Base URL for OpenAI-compatible API
  --model <name>    Model name to use for extraction
  --debug           Enable verbose debug output
  --version, -v     Show version number
  --help, -h        Show this help message

EXAMPLES:
  # Extract invoice data using local Ollama
  ordis extract \\
    --schema examples/invoice.schema.json \\
    --input examples/invoice.txt \\
    --base http://localhost:11434/v1 \\
    --model llama3.1:8b

  # Extract with debug output
  ordis extract --schema schema.json --input data.txt --debug

For more information, visit: https://github.com/ordis-dev/ordis-cli
`);
}

function showVersion(): void {
    console.log(`ordis-cli v${packageJson.version}`);
}

async function runExtraction(args: CliArgs): Promise<void> {
    // Validate required arguments
    if (!args.schema) {
        console.error('Error: --schema is required');
        console.error('Usage: ordis extract --schema <path> --input <path> --base <url> --model <name>');
        process.exit(1);
    }

    if (!args.input) {
        console.error('Error: --input is required');
        console.error('Usage: ordis extract --schema <path> --input <path> --base <url> --model <name>');
        process.exit(1);
    }

    if (!args.base) {
        console.error('Error: --base is required');
        console.error('Usage: ordis extract --schema <path> --input <path> --base <url> --model <name>');
        process.exit(1);
    }

    if (!args.model) {
        console.error('Error: --model is required');
        console.error('Usage: ordis extract --schema <path> --input <path> --base <url> --model <name>');
        process.exit(1);
    }

    try {
        // Step 1: Load schema
        if (args.debug) {
            console.log(`[DEBUG] Loading schema from: ${args.schema}`);
        }

        const schemaPath = path.resolve(args.schema);
        const schema = await loadSchema(schemaPath);

        if (args.debug) {
            console.log('[DEBUG] Schema loaded successfully:', {
                name: schema.metadata?.name,
                fields: Object.keys(schema.fields),
                confidenceThreshold: schema.confidence?.threshold,
            });
        }

        // Step 2: Read input file
        if (args.debug) {
            console.log(`[DEBUG] Reading input from: ${args.input}`);
        }

        const inputPath = path.resolve(args.input);
        const inputText = await fs.readFile(inputPath, 'utf-8');

        if (args.debug) {
            console.log(`[DEBUG] Input loaded: ${inputText.length} characters`);
        }

        // Step 3: Create LLM config
        const llmConfig: LLMConfig = {
            baseURL: args.base,
            model: args.model,
        };

        if (args.debug) {
            console.log('[DEBUG] LLM config:', {
                baseURL: llmConfig.baseURL,
                model: llmConfig.model,
            });
        }

        // Step 4: Run extraction
        if (args.debug) {
            console.log('[DEBUG] Starting extraction pipeline...');
        }

        const result = await extract({
            input: inputText,
            schema,
            llmConfig,
            debug: args.debug,
        });

        // Step 5: Output results
        if (args.debug) {
            console.log('[DEBUG] Extraction complete');
            console.log('[DEBUG] Result:', {
                success: result.success,
                confidence: result.confidence,
                meetsThreshold: result.meetsThreshold,
                errorCount: result.errors.length,
            });
        }

        if (result.success) {
            // Output successful extraction as JSON
            const output = {
                success: true,
                data: result.data,
                confidence: result.confidence,
                confidenceByField: result.confidenceByField,
                meetsThreshold: result.meetsThreshold,
                metadata: result.metadata,
            };

            console.log(JSON.stringify(output, null, 2));
            process.exit(0);
        } else {
            // Output failure with errors
            const output = {
                success: false,
                errors: result.errors,
                data: result.data, // May be partial
                confidence: result.confidence,
                meetsThreshold: result.meetsThreshold,
                metadata: result.metadata,
            };

            console.error(JSON.stringify(output, null, 2));
            process.exit(1);
        }
    } catch (error) {
        // Handle unexpected errors
        if (args.debug && error instanceof Error) {
            console.error('[DEBUG] Stack trace:', error.stack);
        }

        const errorOutput = {
            success: false,
            errors: [
                {
                    message: error instanceof Error ? error.message : String(error),
                    code: (error as any).code || 'UNKNOWN_ERROR',
                },
            ],
        };

        console.error(JSON.stringify(errorOutput, null, 2));
        process.exit(1);
    }
}

async function main(): Promise<void> {
    const args = parseArgs(process.argv);

    if (!args.command) {
        console.error('Error: No command specified. Use "ordis extract" or "ordis --help"');
        process.exit(1);
    }

    if (args.command === 'extract') {
        if (args.debug) {
            console.log('[DEBUG] Starting extraction with args:', {
                schema: args.schema,
                input: args.input,
                base: args.base,
                model: args.model,
            });
        }

        await runExtraction(args);
    } else {
        console.error(`Error: Unknown command "${args.command}". Use "ordis --help" for usage.`);
        process.exit(1);
    }
}

main().catch((error) => {
    console.error('Fatal error:', error.message);
    process.exit(1);
});
