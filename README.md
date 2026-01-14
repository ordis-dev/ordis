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

**Enable JSON mode** (for reliable JSON responses):

```bash
# OpenAI and compatible providers
ordis extract \
  --schema examples/invoice.schema.json \
  --input examples/invoice.txt \
  --base https://api.openai.com/v1 \
  --model gpt-4o-mini \
  --api-key your-api-key \
  --json-mode

# Ollama (auto-detected)
ordis extract \
  --schema examples/invoice.schema.json \
  --input examples/invoice.txt \
  --base http://localhost:11434/v1 \
  --model qwen2.5:32b \
  --json-mode

# Explicit provider override
ordis extract \
  --schema examples/invoice.schema.json \
  --input examples/invoice.txt \
  --base http://localhost:11434/v1 \
  --model qwen2.5:32b \
  --json-mode \
  --provider ollama
```

JSON mode forces the model to return only valid JSON. Provider is auto-detected from the base URL.

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

// Enable JSON mode (provider auto-detected from baseURL)
const resultWithJsonMode = await extract({
  input: text,
  schema,
  llmConfig: {
    baseURL: 'http://localhost:11434/v1',
    model: 'qwen2.5:32b',
    jsonMode: true  // Auto-detects Ollama, uses format: "json"
  }
});

// Explicit provider override
const resultExplicit = await extract({
  input: text,
  schema,
  llmConfig: {
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    apiKey: process.env.OPENAI_API_KEY,
    jsonMode: true,
    provider: 'openai'  // Uses response_format: { type: "json_object" }
  }
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

**Completed in v0.6.0:**
- ✅ JSON mode support for OpenAI and Ollama providers ([#78](https://github.com/ordis-dev/ordis/issues/78))
  - Auto-detection based on base URL
  - Eliminates parsing failures from non-JSON responses
  - Works with both Ollama (`format: "json"`) and OpenAI (`response_format`)

**Completed in v0.5.1:**
- ✅ Default context window increased to 32k (was 4096)
- ✅ Markdown-wrapped JSON parsing ([#74](https://github.com/ordis-dev/ordis/issues/74))
- ✅ AMD GPU support in benchmarks (rocm-smi detection)
- ✅ GPU health monitoring in benchmarks (VRAM pressure, utilization)

**Completed in v0.5.0:**
- ✅ Type coercion for LLM output ([#71](https://github.com/ordis-dev/ordis/issues/71))
  - Automatic string-to-number/boolean coercion
  - Null-like string handling ("null"/"none"/"n/a")
  - Enum case-insensitive matching ("Series B" → "series_b")
  - Date format normalization (US, EU, written formats)
- ✅ Array of objects support ([#70](https://github.com/ordis-dev/ordis/issues/70))
  - Nested object schemas with recursive validation
  - Proper error paths (e.g., "items[1].price")
- ✅ Ollama runtime options (num_ctx, num_gpu)

**Completed in v0.4.0:**
- ✅ User-friendly error messages ([#63](https://github.com/ordis-dev/ordis/issues/63))
  - Emoji indicators (❌, 💡, ℹ️) for quick scanning
  - Expected vs. actual values for validation errors
  - Actionable suggestions for common issues
  - Service-specific troubleshooting (Ollama, LM Studio, OpenAI)
- ✅ Debug mode enhancements
  - Full LLM request/response logging
  - Token usage breakdown

See [CHANGELOG.md](CHANGELOG.md) for complete version history.

## Contributing

Contributions are welcome!
