# Copilot Instructions for Ordis

## Project Overview

**Ordis** is a tool and library for extracting structured data from unstructured text using schema-first LLM pipelines. The project emphasizes deterministic, validated output over "close enough" results.

### Core Principles

- **Schema first, not prompt first**: Schemas define what "correct" means before the model sees input
- **Treat model output as untrusted**: All LLM responses are validated against the schema
- **Deterministic output or clear failure**: No silent corrections or "close enough" results
- **Small, boring pipelines**: Clear steps (input → model → validate → output) without hidden magic
- **I/O at the edges**: Core engine handles validation; clients handle LLM calls, files, and APIs

## Architecture

```
src/
├── cli.ts           # CLI entrypoint and argument parsing
├── core/            # Schema validation, parsing, error handling
├── schemas/         # Schema definitions and validation logic
├── llm/             # LLM client wrappers (OpenAI-compatible)
└── utils/           # Shared utilities
examples/            # Sample schemas and input files
```

## Branching Process

- **main**: Always stable and deployable. All changes are merged via pull requests (PRs).
- **GitHub issue as starting point**: Every new branch (feature, bugfix, hotfix, release) must be linked to a GitHub issue. Create or reference an issue describing the work before starting a branch.
- **feature branches**: Use `feature/short-description` (e.g., `feature/schema-validation`) for new features or enhancements. Merge to `main` via PR.
- **bugfix branches**: Use `bugfix/short-description` for bug fixes. Merge to `main` via PR.
- **hotfix branches**: Use `hotfix/short-description` for urgent production fixes. Merge to `main` via PR.
- **release branches**: Use `release/x.y.z` for preparing releases. Merge to `main` and tag.
- **PRs**: All changes must go through PRs for review. Use clear titles and descriptions, and reference the related GitHub issue.
- **Branch deletion**: Delete feature/bugfix/hotfix branches after merging to keep the repository clean.

## Developer Workflows

- **Install**: `npm install`
- **Build**: `npm run build`
- **Run**: `node dist/cli.js --help`
- **Debug**: Use `--debug` flag for verbose output
- **Test**: `npm test` (must pass before committing)
- **Benchmark**: `npm run benchmark` (run after tests, before committing to verify performance)

## Conventions

- **Separation of concerns**: Keep schema definitions, validation logic, and LLM integration separate
- **Descriptive naming**: Use clear names for schema files (e.g., `invoice.schema.json`, `address.schema.json`)
- **No magic**: Explicit behavior over hidden retries or silent corrections
- **Useful errors**: Return structured, descriptive errors that explain what went wrong and where
- **Configuration**: Store API keys and endpoints in `.env` (never commit)
- **Examples**: Add example schemas and input files to `examples/` directory
- **Documentation format**: Use lists and sections instead of ASCII tables for better readability

## Integration Points

- **LLM providers**: Any OpenAI-compatible API (Ollama, LM Studio, OpenRouter, etc.)
- **Schema format**: JSON-based field definitions with types and constraints
- **Output format**: Validated JSON matching the schema or structured error response

## Contributing

When creating issues or pull requests:

- Use issue templates in `.github/ISSUE_TEMPLATE/` for structured bug reports, features, etc.
- Use PR template in `.github/PULL_REQUEST_TEMPLATE.md` for consistent pull requests
- See `docs/CONTRIBUTING.md` for complete development workflow and standards

**Update this file as the project grows.** Add new patterns, directory structures, and conventions as they emerge.
