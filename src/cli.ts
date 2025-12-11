#!/usr/bin/env node

/**
 * Ordis CLI - Schema-first extraction tool
 * Entrypoint for the command-line interface
 */

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

function main(): void {
    const args = parseArgs(process.argv);

    if (!args.command) {
        console.error('Error: No command specified. Use "ordis extract" or "ordis --help"');
        process.exit(1);
    }

    if (args.command === 'extract') {
        if (args.debug) {
            console.log('[DEBUG] Starting extraction with args:', args);
        }

        // TODO: Implement extraction logic
        console.log('Extract command not yet implemented.');
        console.log('This will validate schema, load input, call LLM, and return structured output.');
        process.exit(0);
    } else {
        console.error(`Error: Unknown command "${args.command}". Use "ordis --help" for usage.`);
        process.exit(1);
    }
}

main();
