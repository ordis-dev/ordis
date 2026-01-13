# Token Budget Awareness

Token budget awareness prevents context overflow by tracking token usage and providing warnings or errors when limits are approached or exceeded.

## Features

- **Token estimation**: Rough approximation using ~4 characters per token
- **Automatic validation**: Checks token usage before calling LLM
- **Warnings**: Alert when approaching context limits (default: 90%)
- **Clear errors**: Detailed messages when limits exceeded
- **Debug mode**: Optional detailed token usage logging
- **Configurable budgets**: Customize limits per component

## Quick Start

### Basic Usage

Token counting is automatic - no changes needed to existing code:

```typescript
import { LLMClient } from '@ordis-dev/ordis';

const client = new LLMClient({
    baseURL: 'http://localhost:11434/v1',
    model: 'llama3.2:3b',
    // Token budget uses sensible defaults
});

// Automatically checks token usage
const result = await client.extract({
    schema: mySchema,
    input: myText,
});
```

### Custom Token Limits

Configure token budgets for your specific model:

```typescript
const client = new LLMClient({
    baseURL: 'http://localhost:11434/v1',
    model: 'llama3.2:3b',
    maxContextTokens: 8192,  // Model's context window
    tokenBudget: {
        system: 1000,  // Max tokens for system prompt
        input: 6000,   // Max tokens for user input
        output: 1192,  // Reserved for model output
    },
    warnThreshold: 85,  // Warn at 85% usage
});
```

### Debug Mode

Enable detailed token usage logging:

```typescript
const client = new LLMClient({
    baseURL: 'http://localhost:11434/v1',
    model: 'llama3.2:3b',
    debugTokens: true,  // Log token usage to stderr
});

// Shows detailed breakdown:
// [Token Usage]
// Token usage: 1234/4096 (30.1%)
//   System prompt: 234 tokens
//   Input: 800 tokens
//   Reserved for output: 200 tokens
```

## Configuration

### LLMConfig Options

| Option | Type | Default | Description |
|--------|------|---------|-------------|
| `maxContextTokens` | `number` | `32768` | Maximum context window size |
| `tokenBudget` | `TokenBudget` | See below | Breakdown of token allocation |
| `warnThreshold` | `number` | `90` | Warning threshold (percentage) |
| `debugTokens` | `boolean` | `false` | Enable debug logging |

### Default Token Budget

```typescript
{
    system: 1000,   // System prompt
    input: 2000,    // User input
    output: 1000,   // Model completion
}
// Total: 4000 tokens (fits in 4096 context)
```

## Error Handling

### TOKEN_LIMIT_EXCEEDED Error

When token budget is exceeded:

```typescript
try {
    await client.extract({ schema, input: hugeText });
} catch (error) {
    if (error.code === 'TOKEN_LIMIT_EXCEEDED') {
        console.error('Input too large!');
        console.error(error.message);
        // Token budget exceeded: 5234/4096 tokens (1138 over limit)
        //
        // Breakdown:
        //   System prompt: 234 tokens
        //   Input: 4000 tokens
        //   Reserved for output: 1000 tokens
        //
        // Suggestions:
        //   - Reduce input size (currently 4000 tokens)
        //   - Simplify schema to reduce system prompt (currently 234 tokens)
        //   - Use a model with larger context window
        //   - Consider chunking large inputs (future feature)
    }
}
```

### Warning Messages

When approaching limits (default: ≥90%):

```
⚠ Approaching token budget limit: 3686/4096 tokens (90.0%)
  System: 234 | Input: 2452 | Output: 1000
```

## Standalone Usage

Use token counting without LLMClient:

```typescript
import { TokenCounter, estimateTokens } from '@ordis-dev/ordis';

// Estimate tokens for text
const tokens = estimateTokens('Hello, world!');
console.log(tokens);  // ~4 tokens

// Create counter
const counter = new TokenCounter({
    maxContextTokens: 4096,
});

// Calculate usage
const usage = counter.calculateUsage(systemPrompt, userInput);
console.log(usage);
// {
//   systemTokens: 234,
//   inputTokens: 800,
//   outputTokens: 1000,
//   totalTokens: 2034,
//   maxContextTokens: 4096,
//   usagePercent: 49.7
// }

// Check limits
if (counter.exceedsLimit(usage)) {
    throw new Error(counter.getErrorMessage(usage));
}

if (counter.shouldWarn(usage)) {
    console.warn(counter.getWarningMessage(usage));
}
```

## Token Estimation

Token counting uses a conservative approximation:

- **Method**: ~4 characters per token (rounded up)
- **Accuracy**: Conservative estimate (may overestimate)
- **Rationale**: Better to be safe than hit actual limits

### Examples

```typescript
estimateTokens('');                    // 0 tokens
estimateTokens('1234');                // 1 token
estimateTokens('12345');               // 2 tokens
estimateTokens('Hello, world!');       // 4 tokens
estimateTokens('a'.repeat(400));       // 100 tokens
```

Actual tokenization varies by model, but this approximation works well for budget checking.

## Common Patterns

### Different Models, Different Limits

```typescript
// Small model (4K context)
const small = new LLMClient({
    model: 'llama3.2:3b',
    maxContextTokens: 4096,
});

// Large model (128K context)
const large = new LLMClient({
    model: 'llama3.1:70b',
    maxContextTokens: 131072,
    tokenBudget: {
        system: 2000,
        input: 120000,
        output: 8000,
    },
});
```

### Graceful Degradation

```typescript
async function extractWithFallback(text: string) {
    try {
        // Try with full input
        return await client.extract({ schema, input: text });
    } catch (error) {
        if (error.code === 'TOKEN_LIMIT_EXCEEDED') {
            // Truncate and retry (basic approach)
            const truncated = text.slice(0, 8000);  // ~2000 tokens
            console.warn('Input truncated due to token limit');
            return await client.extract({ schema, input: truncated });
        }
        throw error;
    }
}
```

### Budget Planning

```typescript
// Calculate before making request
const counter = new TokenCounter({ maxContextTokens: 4096 });
const usage = counter.calculateUsage(systemPrompt, input);

console.log(counter.formatUsage(usage));

if (counter.exceedsLimit(usage)) {
    console.error('Input too large, needs truncation');
    // Handle before calling LLM
}
```

## Future Enhancements

Token budget awareness is the foundation for:

1. **Smart truncation** (Issue #40)
   - Truncate from middle, preserving start/end
   - Simplify schemas automatically
   - User-configurable strategies

2. **Multi-pass extraction** (Issue #41)
   - Automatic chunking for large inputs
   - Intelligent result merging
   - Deduplication and conflict resolution

## API Reference

See [TokenCounter API](./api/token-counter.md) for detailed documentation.

## Related

- Issue #39: Basic token counting and warnings (implemented)
- Issue #40: Smart input truncation (planned)
- Issue #41: Multi-pass extraction (planned)
