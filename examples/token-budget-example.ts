/**
 * Example: Token Budget Awareness
 * 
 * Demonstrates how to use token counting and budget management
 * to prevent context overflow errors.
 */

import { LLMClient, estimateTokens, TokenCounter } from '../src/index.js';

async function example1_automatic() {
    console.log('=== Example 1: Automatic Token Checking ===\n');

    // Token checking is automatic - uses sensible defaults
    const client = new LLMClient({
        baseURL: 'http://localhost:11434/v1',
        model: 'llama3.2:3b',
        // Default: maxContextTokens = 4096
    });

    const schema = {
        fields: {
            name: { type: 'string' as const, description: 'Person name' },
            age: { type: 'number' as const, description: 'Person age' },
        },
    };

    try {
        const result = await client.extract({
            schema,
            input: 'My name is Alice and I am 25 years old.',
        });
        console.log('✓ Extraction successful:', result.data);
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error('✗ Error:', error.message);
        }
    }
}

async function example2_customLimits() {
    console.log('\n=== Example 2: Custom Token Limits ===\n');

    // Configure for specific model's context window
    const client = new LLMClient({
        baseURL: 'http://localhost:11434/v1',
        model: 'llama3.2:3b',
        maxContextTokens: 8192,  // Larger model
        tokenBudget: {
            system: 1000,
            input: 6000,
            output: 1192,
        },
        warnThreshold: 85,  // Warn at 85% instead of 90%
    });

    const schema = {
        fields: {
            summary: { type: 'string' as const, description: 'Document summary' },
        },
    };

    const largeInput = 'This is a document. '.repeat(500); // ~10,000 chars

    try {
        const result = await client.extract({
            schema,
            input: largeInput,
        });
        console.log('✓ Large input processed successfully');
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error('✗ Error:', error.message);
        }
    }
}

async function example3_debugMode() {
    console.log('\n=== Example 3: Debug Mode ===\n');

    // Enable debug logging to see token usage
    const client = new LLMClient({
        baseURL: 'http://localhost:11434/v1',
        model: 'llama3.2:3b',
        debugTokens: true,  // Shows detailed token breakdown
    });

    const schema = {
        fields: {
            title: { type: 'string' as const },
            content: { type: 'string' as const },
        },
    };

    try {
        await client.extract({
            schema,
            input: 'Title: Hello World\nContent: This is a test.',
        });
    } catch (error: unknown) {
        if (error instanceof Error) {
            console.error('Error:', error.message);
        }
    }
}

function example4_standaloneUsage() {
    console.log('\n=== Example 4: Standalone Token Counting ===\n');

    // Use token counter without LLMClient
    const counter = new TokenCounter({
        maxContextTokens: 4096,
    });

    const systemPrompt = 'You are a helpful assistant. Extract structured data.';
    const userInput = 'My name is Bob and I work as a software engineer.';

    const usage = counter.calculateUsage(systemPrompt, userInput);

    console.log('Token Usage:');
    console.log(counter.formatUsage(usage));

    if (counter.shouldWarn(usage)) {
        console.log('\n⚠ Warning:');
        console.log(counter.getWarningMessage(usage));
    }

    if (counter.exceedsLimit(usage)) {
        console.log('\n✗ Error:');
        console.log(counter.getErrorMessage(usage));
    }
}

function example5_estimation() {
    console.log('\n=== Example 5: Token Estimation ===\n');

    const texts = [
        '',
        'Hello',
        'Hello, world!',
        'The quick brown fox jumps over the lazy dog.',
        'a'.repeat(400),  // 400 chars
        'test '.repeat(100),  // 500 chars
    ];

    console.log('Token Estimates (using ~4 chars per token):');
    for (const text of texts) {
        const tokens = estimateTokens(text);
        const preview = text.length > 40 
            ? text.slice(0, 37) + '...'
            : text || '(empty)';
        console.log(`  ${tokens.toString().padStart(3)} tokens - ${preview}`);
    }
}

async function example6_errorHandling() {
    console.log('\n=== Example 6: Error Handling ===\n');

    // Intentionally small limit to trigger error
    const client = new LLMClient({
        baseURL: 'http://localhost:11434/v1',
        model: 'llama3.2:3b',
        maxContextTokens: 100,  // Very small
    });

    const schema = {
        fields: {
            name: { type: 'string' as const },
        },
    };

    // Large input will exceed limit
    const largeInput = 'test '.repeat(200);  // ~1000 chars = ~250 tokens

    try {
        await client.extract({ schema, input: largeInput });
    } catch (error: unknown) {
        if (error instanceof Error && 'code' in error) {
            const llmError = error as { code: string; message: string };
            if (llmError.code === 'TOKEN_LIMIT_EXCEEDED') {
                console.log('✓ Caught TOKEN_LIMIT_EXCEEDED error as expected');
                console.log('\nError details:');
                console.log(llmError.message);
            }
        }
    }
}

// Run examples
async function main() {
    console.log('Token Budget Awareness Examples\n');
    
    // Example 1: Automatic (requires running Ollama)
    // await example1_automatic();
    
    // Example 2: Custom limits (requires running Ollama)
    // await example2_customLimits();
    
    // Example 3: Debug mode (requires running Ollama)
    // await example3_debugMode();
    
    // Example 4-6: No LLM required
    example4_standaloneUsage();
    example5_estimation();
    
    // Example 6: Error handling (requires running Ollama)
    // await example6_errorHandling();
}

main().catch(console.error);
