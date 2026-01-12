# Ordis

Ordis is a local-first tool and library that turns messy, unstructured text into clean, structured data using a schema-driven extraction pipeline powered by LLMs. You give it a schema that describes the fields you expect, point it at some raw text, and choose any OpenAI-compatible model. Ordis builds the prompt, calls the model, validates the output, and returns either a correct structured record or a clear error.

**Ordis does for LLM extraction what Prisma does for databases: strict schemas, predictable output and no more glue code.**

## Status

**✅ CLI functional** - Core extraction pipeline working with real LLMs. Ready for testing and feedback.

**✅ Programmatic API** - Can be used as an npm package in Node.js applications.

## Features

- **Local-first extraction**: Supports Ollama, LM Studio, or any OpenAI-compatible endpoint
- **Schema-first workflow**: Define your data structure upfront
- **Deterministic output**: Returns validated records or structured failures
- **Token budget awareness**: Automatic token counting with warnings and limits
- **HTML preprocessing**: Strip noise from web pages before extraction
- **Dual-purpose**: Use as a CLI or import as a library
- **TypeScript support**: Full type definitions included

## Example

```bash
ordis extract \
  --schema examples/invoice.schema.json \
  --input examples/invoice.txt \
  --base http://localhost:11434/v1 \
  --model llama3.1:8b \
  --debug
```

**Sample schema** (`invoice.schema.json`):

```json
{
  "fields": {
    "invoice_id": { "type": "string" },
    "amount": { "type": "number" },
    "currency": { "type": "string", "enum": ["USD", "SGD", "EUR"] },
    "date": { "type": "string", "format": "date-time", "optional": true }
  }
}
```

## Model Compatibility

Works with any service exposing an OpenAI-compatible API:

- Ollama
- LM Studio
- OpenRouter
- Mistral
- Groq
- OpenAI
- vLLM servers

## Installation

### From npm (recommended)

Install globally to use the CLI anywhere:

```bash
npm install -g @ordis-dev/ordis
ordis --help
```

Or install locally in your project:

```bash
npm install @ordis-dev/ordis
```

### From Source

```bash
git clone https://github.com/ordis-dev/ordis
cd ordis
npm install
npm run build
node dist/cli.js --help
```

## Usage

### CLI Usage

Extract data from text using a schema:

```bash
ordis extract \
  --schema examples/invoice.schema.json \
  --input examples/invoice.txt \
  --base http://localhost:11434/v1 \
  --model llama3.1:8b \
  --debug
```

**With API key** (for providers like OpenAI, Deepseek, etc.):

```bash
ordis extract \
  --schema examples/invoice.schema.json \
  --input examples/invoice.txt \
  --base https://api.deepseek.com/v1 \
  --model deepseek-chat \
  --api-key your-api-key-here
```

### Programmatic Usage

Use ordis as a library in your Node.js application:

```typescript
import { extract, loadSchema, LLMClient } from '@ordis-dev/ordis';

// Load schema from file
const schema = await loadSchema('./invoice.schema.json');

// Or create schema from object
import { loadSchemaFromObject } from 'ordis-cli';
const schema = loadSchemaFromObject({
  fields: {
    invoice_id: { type: 'string' },
    amount: { type: 'number' },
    currency: { type: 'string', enum: ['USD', 'EUR', 'SGD'] }
  }
});

// Configure LLM
const llmConfig = {
  baseURL: 'http://localhost:11434/v1',
  model: 'llama3.2:3b'
};

// Extract data
const result = await extract({
  input: 'Invoice #INV-2024-0042 for $1,250.00 USD',
  schema,
  llmConfig
});

if (result.success) {
  console.log(result.data);
  // { invoice_id: 'INV-2024-0042', amount: 1250, currency: 'USD' }
  console.log('Confidence:', result.confidence);
} else {
  console.error('Extraction failed:', result.errors);
}
```

**Using LLM Presets:**

```typescript
import { extract, loadSchema, LLMPresets } from '@ordis-dev/ordis';

const schema = await loadSchema('./schema.json');

// Use preset configurations
const result = await extract({
  input: text,
  schema,
  llmConfig: LLMPresets.ollama('llama3.2:3b')
  // Or: LLMPresets.openai(apiKey, 'gpt-4o-mini')
  // Or: LLMPresets.lmStudio('local-model')
});
```

**Extracting from HTML:**

```typescript
import { extract, loadSchema } from '@ordis-dev/ordis';

const schema = await loadSchema('./schema.json');

// Strip HTML noise before extraction
const result = await extract({
  input: rawHtmlContent,
  schema,
  llmConfig: { baseURL: 'http://localhost:11434/v1', model: 'llama3.2:3b' },
  preprocessing: {
    stripHtml: true  // Removes scripts, styles, nav, ads, etc.
    // Or with options:
    // stripHtml: {
    //   preserveStructure: true,  // Convert headings/lists to markdown
    //   removeSelectors: ['.sidebar', '#comments'],
    //   maxLength: 10000
    // }
  }
});
```

## What Works

- ✅ Schema loader and validator
- ✅ Prompt builder with confidence scoring
- ✅ Universal LLM client (OpenAI-compatible APIs)
- ✅ Token budget awareness with warnings and errors
- ✅ Structured error system
- ✅ CLI extraction command
- ✅ Programmatic API for library usage
- ✅ Field-level confidence tracking
- ✅ TypeScript type definitions
- ✅ Performance benchmarks
- ✅ HTML preprocessing for noisy web content

## Performance

Pipeline overhead is negligible (~1-2ms). LLM calls dominate execution time (1-10s depending on model). See [benchmarks/README.md](benchmarks/README.md) for detailed metrics.

Run benchmarks:
```bash
npm run benchmark
```

## Roadmap

**Completed in v0.4.0:**
- ✅ User-friendly error messages ([#63](https://github.com/ordis-dev/ordis/issues/63))
  - Emoji indicators (❌, 💡, ℹ️) for quick scanning
  - Expected vs. actual values for validation errors
  - Actionable suggestions for common issues
  - Service-specific troubleshooting (Ollama, LM Studio, OpenAI)
  - File system error handling (ENOENT, EACCES)
- ✅ Debug mode enhancements
  - Full LLM request/response logging
  - Token usage breakdown
  - System and user prompt visibility
  - Detailed error context

**Completed in v0.2.0:**
- ✅ HTML stripping/preprocessing before extraction ([#59](https://github.com/ordis-dev/ordis/issues/59))
  - `stripHtml: true` removes HTML tags, keeps text content
  - `preserveStructure: true` converts headings/lists to markdown-like format
  - `removeSelectors` for custom element removal
  - Automatic removal of scripts, styles, nav, footer, ads

**Completed in v0.1.0:**
- ✅ Core extraction pipeline with schema validation
- ✅ Token budget awareness and management
- ✅ Confidence scoring for extracted data
- ✅ Programmatic API for library usage
- ✅ CLI tool with debug mode
- ✅ Comprehensive test suite and benchmarks
- ✅ Support for any OpenAI-compatible API

**Upcoming:**
- [ ] Schema validation error line numbers ([#64](https://github.com/ordis-dev/ordis/issues/64))
- [ ] Smart input truncation ([#40](https://github.com/ordis-dev/ordis/issues/40))
- [ ] Multi-pass extraction for large inputs ([#41](https://github.com/ordis-dev/ordis/issues/41))
- [ ] Config file support ([#16](https://github.com/ordis-dev/ordis/issues/16))
- [ ] Output formatting options ([#14](https://github.com/ordis-dev/ordis/issues/14))
- [ ] Batch extraction ([#19](https://github.com/ordis-dev/ordis/issues/19))
- [ ] More example schemas ([#13](https://github.com/ordis-dev/ordis/issues/13))

## Contributing

Contributions are welcome!
