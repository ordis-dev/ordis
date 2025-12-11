# Contributing to ordis-cli

Thank you for your interest in contributing! This document outlines how to contribute to this project.

## Getting Started

### Prerequisites
- Node.js 18+
- Git

### Setup
```bash
git clone https://github.com/ordis-dev/ordis-cli
cd ordis-cli
npm install
npm run build
```

## Development Workflow

### 1. Create an Issue
All work starts with a GitHub issue. Use the issue templates to ensure proper structure.

### 2. Create a Branch
```bash
git checkout -b feature/short-description
```

Follow the naming convention:
- `feature/short-description` (for new features)
- `bugfix/short-description` (for bug fixes)
- `hotfix/short-description` (for urgent fixes)
- `refactor/short-description` (for code improvements)

### 3. Make Changes
- Follow [code style guidelines](#code-style)
- Update documentation as needed
- Ensure all tests pass

### 4. Submit Pull Request
- Reference the issue number
- Include clear description of changes
- Follow PR template

## Issue Guidelines

### Issue Structure
Use the provided GitHub issue templates which include:

**Description**: Brief explanation of what needs to be done and why

**Tasks**: Specific actionable items with checkboxes

**Acceptance Criteria**: Clear, testable conditions for completion

### Issue Types
- **Feature**: New functionality or enhancement
- **Bug**: Something broken or not working as expected
- **Refactor**: Code improvement without functional changes
- **Documentation**: Updates to docs, README, or comments

### Quality Guidelines
- **Be Specific**: Tasks should be concrete and actionable
- **Be Testable**: Acceptance criteria should be verifiable
- **Right-Sized**: Issues should be completable in a reasonable timeframe

## Code Style

### TypeScript
- Use strict mode enabled in tsconfig.json
- Prefer explicit types over `any`
- Use descriptive variable names
- Follow the existing patterns in the codebase

### Project Structure
```
src/
├── cli.ts           # CLI entrypoint and argument parsing
├── core/            # Schema validation, parsing, error handling
├── schemas/         # Schema definitions and validation logic
├── llm/             # LLM client wrappers (OpenAI-compatible)
└── utils/           # Shared utilities
examples/            # Sample schemas and input files
```

### Conventions
- **Separation of concerns**: Keep schema definitions, validation logic, and LLM integration separate
- **Descriptive naming**: Use clear names for schema files (e.g., `invoice.schema.json`, `address.schema.json`)
- **No magic**: Explicit behavior over hidden retries or silent corrections
- **Useful errors**: Return structured, descriptive errors that explain what went wrong and where
- **Configuration**: Store API keys and endpoints in `.env` (never commit)

## Development Commands

- `npm run build` - Compile TypeScript to JavaScript
- `npm run dev` - Run CLI directly with tsx (no build needed)
- `npm run clean` - Remove build artifacts
- `node dist/cli.js --help` - Show CLI help
- `node dist/cli.js extract [options]` - Test extraction command

## Pull Request Process

1. Ensure your branch is up to date with main
2. Run `npm run build` to verify compilation
3. Test CLI functionality with sample data
4. Create PR referencing the issue number
5. Get review approval
6. Squash and merge

## Core Principles

When contributing, keep these principles in mind:

- **Schema first, not prompt first**: Schemas define what "correct" means before the model sees input
- **Treat model output as untrusted**: All LLM responses are validated against the schema
- **Deterministic output or clear failure**: No silent corrections or "close enough" results
- **Small, boring pipelines**: Clear steps (input → model → validate → output) without hidden magic
- **I/O at the edges**: Core engine handles validation; clients handle LLM calls, files, and APIs

## Questions?

- Check existing issues and discussions
- Ask questions in the issue thread
- Open a discussion for general questions
- Review the project README for basic usage