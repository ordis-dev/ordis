/**
 * Benchmark: Model comparison for performance and accuracy
 * Tests 5 popular models on RTX 3070 8GB
 */

import { extract } from '../src/core/pipeline.js';
import { loadSchema } from '../src/schemas/loader.js';
import type { LLMConfig } from '../src/llm/types.js';
import * as path from 'path';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as readline from 'readline';

const execAsync = promisify(exec);

// Models to test
const MODELS = [
    'llama3.2:3b',
    'qwen2.5:7b',
    'mistral:7b',
    'gemma2:2b',
    'phi3:3.8b'
];

// Test examples
const EXAMPLES = [
    {
        name: '01-email-simple',
        difficulty: 'Easy'
    },
    {
        name: '02-receipt-medium',
        difficulty: 'Medium-Easy'
    },
    {
        name: '03-job-posting-medium',
        difficulty: 'Medium'
    },
    {
        name: '04-contract-complex',
        difficulty: 'Medium-Hard'
    },
    {
        name: '05-medical-hard',
        difficulty: 'Hard'
    }
];

interface BenchmarkResult {
    model: string;
    example: string;
    difficulty: string;
    duration: number;
    success: boolean;
    confidence: number;
    accuracy: number;
    errors: string[];
    fieldIssues: string[];
}

/**
 * Get GPU information
 */
async function getGPUInfo(): Promise<string> {
    try {
        const { stdout } = await execAsync('nvidia-smi --query-gpu=name,memory.total --format=csv,noheader');
        const [name, memory] = stdout.trim().split(',').map(s => s.trim());
        const memoryGB = Math.round(parseInt(memory.split(' ')[0]) / 1024);
        return `${name} (${memoryGB}GB)`;
    } catch (error) {
        // Fallback if nvidia-smi not available or error occurs
        return 'GPU info unavailable';
    }
}

/**
 * Check which models are available in Ollama
 */
async function getAvailableModels(): Promise<string[]> {
    try {
        const { stdout } = await execAsync('ollama list');
        const lines = stdout.split('\n').slice(1); // Skip header
        const models = lines
            .filter(line => line.trim())
            .map(line => line.split(/\s+/)[0]); // Get first column (model name)
        return models;
    } catch (error) {
        console.error('Error checking available models:', (error as Error).message);
        return [];
    }
}

/**
 * Prompt user for yes/no input
 */
function promptUser(question: string): Promise<boolean> {
    const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout
    });

    return new Promise((resolve) => {
        rl.question(question, (answer) => {
            rl.close();
            resolve(answer.toLowerCase().trim() === 'y' || answer.toLowerCase().trim() === 'yes');
        });
    });
}

/**
 * Pull a model using Ollama
 */
async function pullModel(model: string): Promise<boolean> {
    console.log(`  Pulling ${model}...`);
    try {
        const { stdout } = await execAsync(`ollama pull ${model}`);
        console.log(`  ✓ ${model} pulled successfully`);
        return true;
    } catch (error) {
        console.error(`  ✗ Failed to pull ${model}:`, (error as Error).message);
        return false;
    }
}

/**
 * Check and pull missing models
 */
async function ensureModelsAvailable(requiredModels: string[]): Promise<string[]> {
    console.log('Checking available models...\n');
    
    const availableModels = await getAvailableModels();
    const missingModels = requiredModels.filter(model => 
        !availableModels.some(available => available === model || available.startsWith(model + ':'))
    );

    if (missingModels.length === 0) {
        console.log('✓ All required models are available\n');
        return requiredModels;
    }

    console.log('Missing models:');
    missingModels.forEach(model => console.log(`  - ${model}`));
    console.log('');

    const shouldPull = await promptUser('Would you like to pull the missing models? (y/n): ');
    
    if (!shouldPull) {
        console.log('\nSkipping missing models. Only testing available models.\n');
        return requiredModels.filter(model => !missingModels.includes(model));
    }

    console.log('\nPulling missing models...\n');
    
    const pullResults = await Promise.all(
        missingModels.map(model => pullModel(model))
    );

    const successfullyPulled = missingModels.filter((_, idx) => pullResults[idx]);
    const failedToPull = missingModels.filter((_, idx) => !pullResults[idx]);

    if (failedToPull.length > 0) {
        console.log('\nFailed to pull:');
        failedToPull.forEach(model => console.log(`  - ${model}`));
    }

    console.log('');
    
    // Return only models that are now available
    return requiredModels.filter(model => !failedToPull.includes(model));
}

/**
 * Calculate accuracy by comparing extracted data to expected data
 */
function calculateAccuracy(extracted: Record<string, unknown>, expected: Record<string, unknown>, confidenceByField?: Record<string, number>): { accuracy: number; issues: string[] } {
    let correct = 0;
    let total = 0;
    const issues: string[] = [];

    for (const [key, expectedValue] of Object.entries(expected)) {
        total++;
        const extractedValue = extracted[key];
        const fieldConf = confidenceByField?.[key];
        const confStr = fieldConf !== undefined ? ` (conf: ${fieldConf.toFixed(0)}%)` : '';
        
        if (extractedValue === expectedValue) {
            correct++;
        } else if (typeof expectedValue === 'number' && typeof extractedValue === 'number') {
            // Allow small numerical differences
            if (Math.abs(expectedValue - extractedValue) < 0.01) {
                correct++;
            } else {
                issues.push(`${key}: expected ${expectedValue}, got ${extractedValue}${confStr}`);
            }
        } else {
            issues.push(`${key}: expected "${expectedValue}", got "${extractedValue}"${confStr}`);
        }
    }

    return {
        accuracy: total > 0 ? (correct / total) * 100 : 0,
        issues
    };
}

/**
 * Test a single model with a single example
 */
async function testModel(model: string, exampleName: string, difficulty: string, schema: any, input: string, expectedData: Record<string, unknown>): Promise<BenchmarkResult> {
    const llmConfig: LLMConfig = {
        baseURL: 'http://localhost:11434/v1',
        model
    };

    const errors: string[] = [];
    let duration = 0;
    let success = false;
    let confidence = 0;
    let accuracy = 0;
    let fieldIssues: string[] = [];

    try {
        const start = performance.now();
        const result = await extract({
            input,
            schema,
            llmConfig
        });
        const end = performance.now();

        duration = end - start;
        success = result.success;
        confidence = result.confidence || 0;

        if (result.data) {
            const accuracyResult = calculateAccuracy(result.data, expectedData, result.confidenceByField);
            accuracy = accuracyResult.accuracy;
            fieldIssues = accuracyResult.issues;
        } else {
            // No data extracted - show why
            if (result.errors && Array.isArray(result.errors) && result.errors.length > 0) {
                fieldIssues = result.errors.map(e => {
                    const field = e.field ? `[${e.field}] ` : '';
                    return `${field}${e.message}`;
                });
            } else {
                fieldIssues = ['No data extracted from input (no error details available)'];
            }
        }

        if (!result.success) {
            if (result.errors && Array.isArray(result.errors)) {
                errors.push(...result.errors.map(e => e.message));
            }
        }
    } catch (error) {
        errors.push((error as Error).message);
    }

    return {
        model,
        example: exampleName,
        difficulty,
        duration,
        success,
        confidence,
        accuracy,
        errors,
        fieldIssues
    };
}

/**
 * Display results in a clean list format
 */
function displayResults(results: BenchmarkResult[]) {
    console.log('\n' + '='.repeat(60));
    console.log('Model Performance & Accuracy Results');
    console.log('='.repeat(60) + '\n');

    // Group results by model
    const byModel = new Map<string, BenchmarkResult[]>();
    for (const result of results) {
        if (!byModel.has(result.model)) {
            byModel.set(result.model, []);
        }
        byModel.get(result.model)!.push(result);
    }

    let modelIndex = 1;
    for (const [model, modelResults] of byModel) {
        console.log(`[${modelIndex}] ${model}`);
        
        const avgTime = modelResults.reduce((sum, r) => sum + r.duration, 0) / modelResults.length / 1000;
        const avgAccuracy = modelResults.reduce((sum, r) => sum + r.accuracy, 0) / modelResults.length;
        const avgConfidence = modelResults.reduce((sum, r) => sum + r.confidence, 0) / modelResults.length;
        const avgQuality = (avgConfidence + avgAccuracy) / 2;
        
        console.log(`    Overall: ${avgTime.toFixed(2)}s avg | ${avgAccuracy.toFixed(0)}% accuracy | ${avgQuality.toFixed(0)}% quality\n`);
        
        // Show results for each example
        for (const result of modelResults) {
            const time = (result.duration / 1000).toFixed(2);
            const successIcon = result.success ? '✓' : '✗';
            
            console.log(`    ${result.difficulty.padEnd(12)} | ${result.example}`);
            console.log(`      ${successIcon} ${time}s | Conf: ${result.confidence.toFixed(0)}% | Acc: ${result.accuracy.toFixed(0)}%`);
            
            // Display field-level issues if any exist
            if (result.fieldIssues && Array.isArray(result.fieldIssues) && result.fieldIssues.length > 0) {
                for (const issue of result.fieldIssues) {
                    console.log(`      ⚠️  ${issue}`);
                }
            }
            console.log('');
        }
        
        modelIndex++;
    }

    // Summary
    const successful = results.filter(r => r.success).length;
    const avgTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length / 1000;
    const avgAccuracy = results.reduce((sum, r) => sum + r.accuracy, 0) / results.length;

    console.log('Summary:');
    console.log(`  Models tested: ${results.length}`);
    console.log(`  Successful: ${successful}/${results.length}`);
    console.log(`  Average time: ${avgTime.toFixed(2)}s`);
    console.log(`  Average accuracy: ${(avgAccuracy || 0).toFixed(0)}%\n`);

    // Best performers
    const fastest = results.reduce((a, b) => a.duration < b.duration ? a : b);
    const mostAccurate = results.reduce((a, b) => a.accuracy > b.accuracy ? a : b);
    const bestQuality = results.reduce((a, b) => {
        const qualA = ((a.confidence || 0) + a.accuracy) / 2;
        const qualB = ((b.confidence || 0) + b.accuracy) / 2;
        return qualA > qualB ? a : b;
    });

    console.log('Best Performers:');
    console.log(`  Fastest: ${fastest.model} (${(fastest.duration / 1000).toFixed(2)}s)`);
    console.log(`  Most Accurate: ${mostAccurate.model} (${(mostAccurate.accuracy || 0).toFixed(0)}%)`);
    console.log(`  Best Quality: ${bestQuality.model} (${(((bestQuality.confidence || 0) + (bestQuality.accuracy || 0)) / 2).toFixed(0)}%)\n`);

    // Errors
    const withErrors = results.filter(r => r.errors && r.errors.length > 0);
    if (withErrors.length > 0) {
        console.log('Errors:');
        for (const result of withErrors) {
            console.log(`  ${result.model}: ${result.errors.join(', ')}`);
        }
        console.log('');
    }
}

/**
 * Main benchmark runner
 */
async function runModelBenchmark() {
    const gpuInfo = await getGPUInfo();
    console.log('=' .repeat(60));
    console.log(`Model Comparison Benchmark - ${gpuInfo}`);
    console.log('=' .repeat(60));
    console.log();

    // Check and pull missing models
    const modelsToTest = await ensureModelsAvailable(MODELS);
    
    if (modelsToTest.length === 0) {
        console.log('No models available to test. Exiting.');
        return;
    }

    console.log(`Testing ${modelsToTest.length} models across ${EXAMPLES.length} examples...`);
    console.log(`Total tests: ${modelsToTest.length * EXAMPLES.length}\n`);

    const { readFile } = await import('fs/promises');
    const results: BenchmarkResult[] = [];
    let testNumber = 0;
    
    // Test each model with each example
    for (const model of modelsToTest) {
        console.log(`\nTesting ${model}...`);
        
        for (const example of EXAMPLES) {
            testNumber++;
            const schemaPath = path.join(process.cwd(), 'examples', `${example.name}.schema.json`);
            const inputPath = path.join(process.cwd(), 'examples', `${example.name}.txt`);
            const expectedPath = path.join(process.cwd(), 'examples', `${example.name}.expected.json`);

            try {
                const schema = await loadSchema(schemaPath);
                const input = await readFile(inputPath, 'utf-8');
                const expectedData = JSON.parse(await readFile(expectedPath, 'utf-8'));
                
                console.log(`  [${testNumber}/${modelsToTest.length * EXAMPLES.length}] ${example.difficulty}: ${example.name}...`);
                
                const result = await testModel(model, example.name, example.difficulty, schema, input, expectedData);
                results.push(result);
                
                const status = result.success ? '✓' : '✗';
                const time = (result.duration / 1000).toFixed(2);
                console.log(`      ${status} ${time}s | Acc: ${result.accuracy.toFixed(0)}%`);
            } catch (error) {
                console.log(`      ✗ Error loading example: ${(error as Error).message}`);
            }
        }
    }

    // Display results
    displayResults(results);
}

// Run benchmark
console.log('Starting model comparison benchmark...\n');
console.log('⚠️  Note: This requires Ollama to be running with the following models:');
MODELS.forEach(model => console.log(`   - ${model}`));
console.log('\nPull missing models with: ollama pull <model>\n');

runModelBenchmark().catch(error => {
    console.error('\n❌ Benchmark failed:', error.message);
    process.exit(1);
});
