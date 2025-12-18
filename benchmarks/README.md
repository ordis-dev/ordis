# Performance Benchmarks

This directory contains performance benchmarks for Ordis to measure extraction speed and identify bottlenecks.

## Running Benchmarks

Run all benchmarks:
```bash
npm run benchmark
```

Run a specific benchmark:
```bash
npx tsx benchmarks/schema-validation.bench.ts
```

## Benchmark Files

### model-comparison.bench.ts
Comprehensive benchmark comparing multiple LLM models on accuracy, speed, and quality across 5 test examples of varying difficulty.

**Features:**
- Tests 5 local models (llama3.2:3b, llama3.1:8b, qwen2.5:7b, deepseek-r1:7b, deepseek-r1:14b)
- Measures accuracy against expected outputs
- Tracks confidence scores and field-level issues
- Automatically saves detailed reports (JSON + Markdown) in `results/`
- Includes git commit info for tracking improvements over time

**Typical Results (Dec 2025, AMD Radeon RX 7900 XTX):**
- **llama3.2:3b** - 1.0s avg, 94% accuracy, best speed/accuracy balance
- **llama3.1:8b** - 1.6s avg, 95% accuracy, good reasoning
- **qwen2.5:7b** - 1.8s avg, 98% accuracy, very accurate
- **deepseek-r1:7b** - 4.8s avg, 97% accuracy, reasoning-focused
- **deepseek-r1:14b** - 10.3s avg, 100% accuracy, most accurate (slower)

*Note: Performance will vary based on your hardware. These results are from local Ollama inference.*

**Reports saved to:** `benchmarks/results/model-comparison-{date}-{time}-{commit}.{json,md}`

### schema-validation.bench.ts
Measures schema validation performance with simple and complex schemas.

**Typical Results:**
- Simple schema: ~1.2M ops/sec
- Complex schema: ~650K ops/sec

### prompt-building.bench.ts
Measures prompt generation performance for different schema complexities and input sizes.

**Typical Results:**
- System prompts: 300K-900K ops/sec
- User prompts: 20M+ ops/sec (string concatenation)

### response-parsing.bench.ts
Measures response validation and JSON parsing performance.

**Typical Results:**
- Valid response: ~1M ops/sec
- Invalid response: ~1.3M ops/sec
- JSON parsing: ~700K ops/sec

### end-to-end.bench.ts
Measures complete extraction pipeline with mocked LLM (isolates pipeline overhead).

**Typical Results:**
- Small input (60 chars): ~2K ops/sec
- Medium input (300 chars): ~10K ops/sec
- Large input (1500 chars): ~6K ops/sec

## Performance Characteristics

### Bottlenecks Identified

1. **LLM API Calls** - By far the slowest component (1-15 seconds typical)
   - Local models: 1-15s depending on model size and hardware
   - Cloud APIs: 200-2000ms depending on provider and model

2. **Schema Validation** - Very fast (<1ms even for complex schemas)
   - Simple schemas: ~0.0008ms
   - Complex schemas: ~0.0014ms

3. **Prompt Building** - Extremely fast (<1ms)
   - System prompts: 0.001-0.003ms
   - User prompts: <0.0001ms

4. **Response Parsing** - Very fast (~1ms)
   - Validation: ~0.0009ms
   - JSON parsing: ~0.0014ms

### Key Insights

- **Pipeline overhead is negligible** (~1-2ms total for non-LLM operations)
- **LLM calls dominate execution time** (99%+ of total time)
- **Input size has minimal impact** on pipeline performance
- **Schema complexity has minor impact** (~2x slower for 10x more fields)

## Baseline Performance (v0.1.0)

Measured on: Node.js v22.20.0, Linux

**Schema Validation:**
- Simple: ~0.0008ms avg (~1.2M ops/sec)
- Complex: ~0.0014ms avg (~650K ops/sec)

**Prompt Building:**
- System (simple): ~0.0011ms avg (~890K ops/sec)
- System (complex): ~0.0032ms avg (~310K ops/sec)
- User: <0.0001ms avg (~20M+ ops/sec)

**Response Parsing:**
- Valid: ~0.0009ms avg (~1M ops/sec)
- Invalid: ~0.0008ms avg (~1.3M ops/sec)

**End-to-End (mocked LLM):**
- Small input (60 chars): ~0.46ms avg (~2K ops/sec)
- Medium input (300 chars): ~0.09ms avg (~10K ops/sec)
- Large input (1500 chars): ~0.15ms avg (~6K ops/sec)

**Note**: End-to-end benchmarks use mocked LLM to isolate pipeline overhead. Real-world extraction with LLM calls will be 100-1000x slower depending on model.
