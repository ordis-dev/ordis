# JSON Mode

## Overview

Some LLM models don't consistently respect prompt instructions to return only JSON, instead wrapping responses in markdown code blocks, adding explanations, or returning malformed JSON.

Ordis includes JSON mode support that works with both **OpenAI** and **Ollama** providers:
- **OpenAI**: Uses `response_format: { type: "json_object" }`
- **Ollama**: Uses `format: "json"`

The provider type is **auto-detected** from your base URL, or can be explicitly set with the `--provider` flag.

## When to Use JSON Mode

**Use JSON mode if:**
- Your model returns markdown-wrapped JSON (e.g., ` ```json\n{...}\n``` `)
- Responses include explanatory text before or after the JSON
- You're getting parsing errors despite Ordis's markdown unwrapping logic
- You want maximum reliability for production workloads

**Don't use JSON mode if:**
- Current output is already working reliably
- You prefer maximum provider compatibility over strict JSON

## Compatibility

### OpenAI-Compatible Providers

**Supported:**
- OpenAI (GPT-4, GPT-4o, GPT-3.5-turbo)
- Deepseek (deepseek-chat, deepseek-coder)
- Azure OpenAI
- OpenRouter (most models)
- Groq (some models)

Uses `response_format: { type: "json_object" }`

### Ollama-Compatible Providers

**Supported:**
- Ollama (all models including Llama, Qwen, Gemma, Mistral, etc.)
- LM Studio (most models)
- vLLM servers running Ollama-compatible API

Uses `format: "json"`

## Auto-Detection

Ordis automatically detects the provider based on your base URL:

- `http://localhost:11434` → Ollama
- `http://localhost:1234` → Ollama (LM Studio)
- `https://api.openai.com` → OpenAI
- `https://api.deepseek.com` → OpenAI
- Everything else → OpenAI (default)

## CLI Usage

```bash
# Auto-detected (Ollama)
ordis extract \
  --schema examples/invoice.schema.json \
  --input examples/invoice.txt \
  --base http://localhost:11434/v1 \
  --model qwen2.5:32b \
  --json-mode

# Auto-detected (OpenAI)
ordis extract \
  --schema examples/invoice.schema.json \
  --input examples/invoice.txt \
  --base https://api.openai.com/v1 \
  --model gpt-4o-mini \
  --api-key $OPENAI_API_KEY \
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

## Programmatic Usage

```typescript
import { extract, loadSchema } from '@ordis-dev/ordis';

const schema = await loadSchema('./schema.json');

// Auto-detected based on baseURL
const result = await extract({
  input: text,
  schema,
  llmConfig: {
    baseURL: 'http://localhost:11434/v1',
    model: 'qwen2.5:32b',
    jsonMode: true  // Auto-detects Ollama
  }
});

// Explicit provider
const resultExplicit = await extract({
  input: text,
  schema,
  llmConfig: {
    baseURL: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    apiKey: process.env.OPENAI_API_KEY,
    jsonMode: true,
    provider: 'openai'  // Force OpenAI format
  }
});
```

## How It Works

When `jsonMode: true` is set, Ordis adds the appropriate parameter based on the detected or specified provider:

**For Ollama:**
```json
{
  "format": "json"
}
```

**For OpenAI:**
```json
{
  "response_format": {
    "type": "json_object"
  }
}
```

This instructs the LLM API to return only valid JSON without any markdown formatting or additional text.

## Fallback Behavior

Even without JSON mode, Ordis includes sophisticated response parsing that handles:
- Markdown code blocks (` ```json\n{...}\n``` `)
- Text before the JSON object
- Text after the JSON object
- Partial code blocks

JSON mode simply makes this more reliable by preventing the model from adding extra formatting in the first place.

## Troubleshooting

**Still getting non-JSON responses:**
- Check that you're using `--json-mode` flag
- Try explicit provider: `--provider ollama` or `--provider openai`
- Some very old models may not support JSON mode

**Provider auto-detection wrong:**
- Use `--provider` flag to explicitly set the provider type
- Check your base URL is correct

**JSON mode works but extractions are worse:**
- Some models perform better without JSON mode
- Try both approaches and compare results
- Keep whichever gives better accuracy

**Want to verify which provider is being used:**
- Add `--debug` flag to see provider detection in action
- Check debug output: `[DEBUG] Provider: ollama` or `[DEBUG] Provider: openai`

## Examples

### Qwen2.5:32b on Ollama

```bash
ordis extract \
  --schema examples/invoice.schema.json \
  --input examples/invoice.txt \
  --base http://localhost:11434/v1 \
  --model qwen2.5:32b \
  --json-mode \
  --debug
```

Output shows:
```
[DEBUG] Provider: ollama
[DEBUG] LLM Request: {
  format: "json",
  ...
}
```

### GPT-4o-mini on OpenAI

```bash
ordis extract \
  --schema examples/invoice.schema.json \
  --input examples/invoice.txt \
  --base https://api.openai.com/v1 \
  --model gpt-4o-mini \
  --api-key $OPENAI_API_KEY \
  --json-mode \
  --debug
```

Output shows:
```
[DEBUG] Provider: openai
[DEBUG] LLM Request: {
  response_format: { type: "json_object" },
  ...
}
```
