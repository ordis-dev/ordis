# Ordis CLI

Ordis is a local-first CLI tool that turns messy, unstructured text into clean, structured data using a schema-driven extraction pipeline powered by LLMs. You give it a schema that describes the fields you expect, point it at some raw text, and choose any OpenAI-compatible model. Ordis builds the prompt, calls the model, validates the output, and returns either a correct structured record or a clear error.

**Ordis does for LLM extraction what Prisma does for databases: strict schemas, predictable output and no more glue code.**

## Status

**✅ CLI functional** - Core extraction pipeline working with real LLMs. Ready for testing and feedback.

**✅ Programmatic API** - Can be used as an npm package in Node.js applications.

## Features

- **Local-first extraction**: Supports Ollama, LM Studio, or any OpenAI-compatible endpoint
- **Schema-first workflow**: Define your data structure upfront
- **Deterministic output**: Returns validated records or structured failures
- **Token budget awareness**: Automatic token counting with warnings and limits
- **Dual-purpose**: Use as CLI tool or import as library
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
    "date": { "type": "date", "optional": true }
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

### As a CLI Tool

```bash
git clone https://github.com/ordis-dev/ordis-cli
cd ordis-cli
npm install
npm run build
```

Run the CLI:

```bash
node dist/cli.js --help
```

### As an npm Package

```bash
npm install ordis-cli
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

### Programmatic Usage

Use ordis-cli as a library in your Node.js application:

```typescript
import { extract, loadSchema, LLMClient } from 'ordis-cli';

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
import { extract, loadSchema, LLMPresets } from 'ordis-cli';

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

## Performance

Pipeline overhead is negligible (~1-2ms). LLM calls dominate execution time (1-10s depending on model). See [benchmarks/README.md](benchmarks/README.md) for detailed metrics.

Run benchmarks:
```bash
npm run benchmark
```

## Roadmap
Smart input truncation ([#40](https://github.com/ordis-dev/ordis-cli/issues/40))
- [ ] Multi-pass extraction for large inputs ([#41](https://github.com/ordis-dev/ordis-cli/issues/41))
- [ ] 
- [ ] Config file support ([#16](https://github.com/ordis-dev/ordis-cli/issues/16))
- [ ] Output formatting options ([#14](https://github.com/ordis-dev/ordis-cli/issues/14))
- [ ] Batch extraction ([#19](https://github.com/ordis-dev/ordis-cli/issues/19))
- [ ] More example schemas ([#13](https://github.com/ordis-dev/ordis-cli/issues/13))

## Contributing

Contributions are welcome!
