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
import { writeFile, mkdir } from 'fs/promises';

const execAsync = promisify(exec);

// Models to test
const MODELS = [
    'llama3.1:8b',        // Fast Llama baseline
    'gemma2:27b',         // Google's largest local model
    'qwen2.5:7b',         // Fast Qwen model
    'qwen2.5:32b',        // Large Qwen for high accuracy
    'deepseek-r1:32b'     // Reasoning-focused model for structured extraction
];

// Model-specific configurations (e.g., larger context for high-VRAM setups)
const MODEL_CONFIG: Record<string, Partial<LLMConfig>> = {
    'llama3.1:8b': {
        jsonMode: true,  // Enable JSON mode for reliable JSON responses
    },
    'gemma2:27b': {
        jsonMode: true,  // Enable JSON mode for reliable JSON responses
    },
    'qwen2.5:7b': {
        jsonMode: true,  // Enable JSON mode for reliable JSON responses
    },
    'qwen2.5:32b': {
        jsonMode: true,  // Enable JSON mode for reliable JSON responses
    },
    'deepseek-r1:32b': {
        maxContextTokens: 32768,  // 32k context - Ordis token budget
        ollamaOptions: {
            num_ctx: 32768,       // 32k context - Ollama runtime setting
        },
        jsonMode: true,  // Enable JSON mode for reliable JSON responses
    },
};

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
    },
    {
        name: '06-contract-html-hard',
        difficulty: 'Hard-HTML'
    },
    {
        name: '07-medical-html-hard',
        difficulty: 'Hard-HTML'
    },
    {
        name: '08-funding-rounds-complex',
        difficulty: 'Complex-Arrays'
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
    gpuWarnings?: string[];
}

interface GPUStatus {
    memoryUsed: number;      // MB
    memoryTotal: number;     // MB
    memoryPercent: number;   // 0-100
    gpuUtilization: number;  // 0-100
    available: boolean;
    warnings: string[];
}

interface BenchmarkReport {
    timestamp: string;
    gitCommit?: string;
    gitBranch?: string;
    gpu: string;
    gpuWarnings?: string[];
    results: BenchmarkResult[];
    summary: {
        modelsTotal: number;
        testsTotal: number;
        successful: number;
        avgTime: number;
        avgAccuracy: number;
        fastest: { model: string; duration: number };
        mostAccurate: { model: string; accuracy: number };
        bestQuality: { model: string; quality: number };
    };
}

/**
 * Get git information
 */
async function getGitInfo(): Promise<{ commit?: string; branch?: string }> {
    try {
        const { stdout: commit } = await execAsync('git rev-parse --short HEAD');
        const { stdout: branch } = await execAsync('git rev-parse --abbrev-ref HEAD');
        return {
            commit: commit.trim(),
            branch: branch.trim()
        };
    } catch (error) {
        return {};
    }
}

/**
 * Get GPU information (supports NVIDIA and AMD)
 */
async function getGPUInfo(): Promise<string> {
    // Try NVIDIA first
    try {
        const { stdout } = await execAsync('nvidia-smi --query-gpu=name,memory.total --format=csv,noheader');
        const [name, memory] = stdout.trim().split(',').map(s => s.trim());
        const memoryGB = Math.round(parseInt(memory.split(' ')[0]) / 1024);
        return `${name} (${memoryGB}GB)`;
    } catch {
        // NVIDIA not available, try AMD
    }

    // Try AMD ROCm
    try {
        const { stdout: memInfo } = await execAsync('rocm-smi --showmeminfo vram');
        const memMatch = memInfo.match(/VRAM Total Memory \(B\):\s*(\d+)/);
        const memoryBytes = memMatch ? parseInt(memMatch[1]) : 0;
        const memoryGB = Math.round(memoryBytes / (1024 * 1024 * 1024));

        // Try to get GPU name from product info
        let gpuName = 'AMD GPU';
        try {
            const { stdout: productInfo } = await execAsync('rocm-smi --showproductname');
            const gfxMatch = productInfo.match(/GFX Version:\s*(gfx\d+)/);
            if (gfxMatch) {
                // Map GFX versions to marketing names
                const gfxNames: Record<string, string> = {
                    'gfx1100': 'AMD Radeon RX 7900 XTX/XT',
                    'gfx1101': 'AMD Radeon RX 7800/7700',
                    'gfx1102': 'AMD Radeon RX 7600',
                    'gfx1030': 'AMD Radeon RX 6900/6800',
                    'gfx1031': 'AMD Radeon RX 6800',
                    'gfx1032': 'AMD Radeon RX 6700',
                    'gfx90a': 'AMD Instinct MI250',
                    'gfx942': 'AMD Instinct MI300',
                };
                gpuName = gfxNames[gfxMatch[1]] || `AMD GPU (${gfxMatch[1]})`;
            }
        } catch {
            // Use generic name
        }

        return `${gpuName} (${memoryGB}GB)`;
    } catch {
        // AMD not available either
    }

    return 'GPU info unavailable';
}

/**
 * Get current GPU status including memory and utilization (supports NVIDIA and AMD)
 */
async function getGPUStatus(): Promise<GPUStatus> {
    const defaultStatus: GPUStatus = {
        memoryUsed: 0,
        memoryTotal: 0,
        memoryPercent: 0,
        gpuUtilization: 0,
        available: false,
        warnings: []
    };

    // Try NVIDIA first
    try {
        const { stdout } = await execAsync(
            'nvidia-smi --query-gpu=memory.used,memory.total,utilization.gpu --format=csv,noheader,nounits'
        );
        
        const parts = stdout.trim().split(',').map(s => parseInt(s.trim()));
        if (parts.length >= 3 && !parts.some(isNaN)) {
            const [memoryUsed, memoryTotal, gpuUtilization] = parts;
            const memoryPercent = (memoryUsed / memoryTotal) * 100;
            const warnings: string[] = [];

            if (memoryPercent > 95) {
                warnings.push(`⚠️  CRITICAL: GPU memory at ${memoryPercent.toFixed(0)}% - likely OOM or swapping to CPU`);
            } else if (memoryPercent > 85) {
                warnings.push(`⚠️  WARNING: GPU memory at ${memoryPercent.toFixed(0)}% - may cause slowdowns`);
            }

            return {
                memoryUsed,
                memoryTotal,
                memoryPercent,
                gpuUtilization,
                available: true,
                warnings
            };
        }
    } catch {
        // NVIDIA not available, try AMD
    }

    // Try AMD ROCm
    try {
        const { stdout: memInfo } = await execAsync('rocm-smi --showmeminfo vram');
        const totalMatch = memInfo.match(/VRAM Total Memory \(B\):\s*(\d+)/);
        const usedMatch = memInfo.match(/VRAM Total Used Memory \(B\):\s*(\d+)/);
        
        if (!totalMatch || !usedMatch) {
            return { ...defaultStatus, warnings: ['Could not parse rocm-smi memory output'] };
        }

        const memoryTotal = Math.round(parseInt(totalMatch[1]) / (1024 * 1024)); // Convert to MB
        const memoryUsed = Math.round(parseInt(usedMatch[1]) / (1024 * 1024));   // Convert to MB
        const memoryPercent = (memoryUsed / memoryTotal) * 100;

        // Get GPU utilization
        let gpuUtilization = 0;
        try {
            const { stdout: useInfo } = await execAsync('rocm-smi --showuse');
            const useMatch = useInfo.match(/GPU use \(%\):\s*(\d+)/);
            if (useMatch) {
                gpuUtilization = parseInt(useMatch[1]);
            }
        } catch {
            // Utilization not available
        }

        const warnings: string[] = [];

        if (memoryPercent > 95) {
            warnings.push(`⚠️  CRITICAL: GPU memory at ${memoryPercent.toFixed(0)}% - likely OOM or swapping to CPU`);
        } else if (memoryPercent > 85) {
            warnings.push(`⚠️  WARNING: GPU memory at ${memoryPercent.toFixed(0)}% - may cause slowdowns`);
        }

        return {
            memoryUsed,
            memoryTotal,
            memoryPercent,
            gpuUtilization,
            available: true,
            warnings
        };
    } catch {
        // AMD not available either
    }

    return { ...defaultStatus, warnings: ['GPU monitoring unavailable (no nvidia-smi or rocm-smi)'] };
}

/**
 * Monitor GPU during inference and detect issues
 */
async function checkGPUHealth(model: string, preStatus: GPUStatus, postStatus: GPUStatus): Promise<string[]> {
    const warnings: string[] = [];

    if (!preStatus.available || !postStatus.available) {
        warnings.push('⚠️  GPU monitoring unavailable - cannot verify GPU usage');
        return warnings;
    }

    // Check if GPU was actually used (utilization should spike during inference)
    if (postStatus.gpuUtilization < 5 && preStatus.gpuUtilization < 5) {
        warnings.push(`⚠️  LOW GPU UTILIZATION (${postStatus.gpuUtilization}%) - model may be running on CPU`);
    }

    // Check for memory overflow
    if (postStatus.memoryPercent > 95) {
        warnings.push(`⚠️  MEMORY CRITICAL: ${postStatus.memoryUsed}/${postStatus.memoryTotal}MB (${postStatus.memoryPercent.toFixed(0)}%)`);
    } else if (postStatus.memoryPercent > 85) {
        warnings.push(`⚠️  MEMORY HIGH: ${postStatus.memoryUsed}/${postStatus.memoryTotal}MB (${postStatus.memoryPercent.toFixed(0)}%)`);
    }

    // Inherit any warnings from status checks
    warnings.push(...postStatus.warnings);

    return warnings;
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
 * Stringify a value for comparison display
 * Handles arrays and objects with JSON.stringify for readable output
 */
function stringifyValue(value: unknown): string {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value) || (typeof value === 'object' && value !== null)) {
        return JSON.stringify(value);
    }
    return String(value);
}

/**
 * Deep compare two values for equality
 */
function deepEqual(a: unknown, b: unknown): boolean {
    if (a === b) return true;
    if (typeof a !== typeof b) return false;
    if (a === null || b === null) return a === b;
    
    if (Array.isArray(a) && Array.isArray(b)) {
        if (a.length !== b.length) return false;
        return a.every((item, i) => deepEqual(item, b[i]));
    }
    
    if (typeof a === 'object' && typeof b === 'object') {
        const aKeys = Object.keys(a as object);
        const bKeys = Object.keys(b as object);
        if (aKeys.length !== bKeys.length) return false;
        return aKeys.every(key => 
            deepEqual((a as Record<string, unknown>)[key], (b as Record<string, unknown>)[key])
        );
    }
    
    return false;
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
        
        // Use deep equality for arrays and objects
        if (deepEqual(extractedValue, expectedValue)) {
            correct++;
        } else if (typeof expectedValue === 'number' && typeof extractedValue === 'number') {
            // Allow small numerical differences
            if (Math.abs(expectedValue - extractedValue) < 0.01) {
                correct++;
            } else {
                issues.push(`${key}: expected ${expectedValue}, got ${extractedValue}${confStr}`);
            }
        } else {
            // Use stringifyValue for readable output
            issues.push(`${key}: expected ${stringifyValue(expectedValue)}, got ${stringifyValue(extractedValue)}${confStr}`);
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
async function testModel(model: string, exampleName: string, difficulty: string, schema: any, input: string, expectedData: Record<string, unknown>, monitorGPU: boolean = true): Promise<BenchmarkResult> {
    // Merge base config with model-specific overrides
    const llmConfig: LLMConfig = {
        baseURL: 'http://localhost:11434/v1',
        model,
        ...MODEL_CONFIG[model],  // Apply model-specific config if exists
    };

    const errors: string[] = [];
    const gpuWarnings: string[] = [];
    let duration = 0;
    let success = false;
    let confidence = 0;
    let accuracy = 0;
    let fieldIssues: string[] = [];

    // Get GPU status before inference
    const preGPUStatus = monitorGPU ? await getGPUStatus() : null;

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

        // Get GPU status after inference and check for issues
        if (monitorGPU && preGPUStatus) {
            const postGPUStatus = await getGPUStatus();
            const warnings = await checkGPUHealth(model, preGPUStatus, postGPUStatus);
            gpuWarnings.push(...warnings);
        }

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
        
        // Check GPU status on error - might indicate OOM
        if (monitorGPU) {
            const errorGPUStatus = await getGPUStatus();
            if (errorGPUStatus.memoryPercent > 90) {
                gpuWarnings.push(`⚠️  GPU memory at ${errorGPUStatus.memoryPercent.toFixed(0)}% during error - possible OOM`);
            }
        }
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
        fieldIssues,
        gpuWarnings: gpuWarnings.length > 0 ? gpuWarnings : undefined
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
            
            // Display GPU warnings if any exist
            if (result.gpuWarnings && result.gpuWarnings.length > 0) {
                for (const warning of result.gpuWarnings) {
                    console.log(`      🔥 ${warning}`);
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

    // GPU Warnings Summary
    const allGPUWarnings = results.flatMap(r => r.gpuWarnings || []);
    if (allGPUWarnings.length > 0) {
        const uniqueWarnings = [...new Set(allGPUWarnings)];
        console.log('🔥 GPU Warnings:');
        for (const warning of uniqueWarnings) {
            console.log(`  ${warning}`);
        }
        console.log('');
    }

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
 * Generate markdown report
 */
function generateMarkdownReport(report: BenchmarkReport): string {
    const { timestamp, gitCommit, gitBranch, gpu, results, summary } = report;
    
    let md = `# Model Comparison Benchmark Report\n\n`;
    md += `**Date:** ${new Date(timestamp).toLocaleString()}\n`;
    md += `**GPU:** ${gpu}\n`;
    if (gitCommit) md += `**Git Commit:** ${gitCommit}\n`;
    if (gitBranch) md += `**Git Branch:** ${gitBranch}\n`;
    md += `\n---\n\n`;
    
    md += `## Summary\n\n`;
    md += `- **Models tested:** ${summary.modelsTotal}\n`;
    md += `- **Total tests:** ${summary.testsTotal}\n`;
    md += `- **Successful:** ${summary.successful}/${summary.testsTotal}\n`;
    md += `- **Average time:** ${summary.avgTime.toFixed(2)}s\n`;
    md += `- **Average accuracy:** ${summary.avgAccuracy.toFixed(0)}%\n\n`;
    
    md += `### Best Performers\n\n`;
    md += `- **Fastest:** ${summary.fastest.model} (${(summary.fastest.duration / 1000).toFixed(2)}s)\n`;
    md += `- **Most Accurate:** ${summary.mostAccurate.model} (${summary.mostAccurate.accuracy.toFixed(0)}%)\n`;
    md += `- **Best Quality:** ${summary.bestQuality.model} (${summary.bestQuality.quality.toFixed(0)}%)\n\n`;
    
    md += `---\n\n## Detailed Results\n\n`;
    
    // Group by model
    const byModel = new Map<string, BenchmarkResult[]>();
    for (const result of results) {
        if (!byModel.has(result.model)) {
            byModel.set(result.model, []);
        }
        byModel.get(result.model)!.push(result);
    }
    
    for (const [model, modelResults] of byModel) {
        const avgTime = modelResults.reduce((sum, r) => sum + r.duration, 0) / modelResults.length / 1000;
        const avgAccuracy = modelResults.reduce((sum, r) => sum + r.accuracy, 0) / modelResults.length;
        const avgConfidence = modelResults.reduce((sum, r) => sum + r.confidence, 0) / modelResults.length;
        const avgQuality = (avgConfidence + avgAccuracy) / 2;
        
        md += `### ${model}\n\n`;
        md += `**Overall:** ${avgTime.toFixed(2)}s avg | ${avgAccuracy.toFixed(0)}% accuracy | ${avgQuality.toFixed(0)}% quality\n\n`;
        
        md += `| Status | Difficulty   | Example                     | Time  | Conf | Acc  | Issues |\n`;
        md += `|--------|--------------|-----------------------------| ------|------|------|--------|\n`;
        
        for (const result of modelResults) {
            const status = result.success ? '✓' : '✗';
            const time = (result.duration / 1000).toFixed(2) + 's';
            const diff = result.difficulty.padEnd(12);
            const example = result.example.padEnd(27);
            const conf = (result.confidence + '%').padEnd(4);
            const acc = (result.accuracy.toFixed(0) + '%').padEnd(4);
            const issues = result.fieldIssues.length;
            md += `| ${status}      | ${diff} | ${example} | ${time.padEnd(5)} | ${conf} | ${acc} | ${issues}      |\n`;
        }
        
        md += `\n`;
        
        // Show issues if any
        const withIssues = modelResults.filter(r => r.fieldIssues.length > 0);
        if (withIssues.length > 0) {
            md += `**Issues:**\n\n`;
            for (const result of withIssues) {
                if (result.fieldIssues.length > 0) {
                    md += `- **${result.example}:**\n`;
                    for (const issue of result.fieldIssues) {
                        md += `  - ${issue}\n`;
                    }
                }
            }
            md += `\n`;
        }
        
        // Show GPU warnings if any
        const withGPUWarnings = modelResults.filter(r => r.gpuWarnings && r.gpuWarnings.length > 0);
        if (withGPUWarnings.length > 0) {
            md += `**🔥 GPU Warnings:**\n\n`;
            for (const result of withGPUWarnings) {
                md += `- **${result.example}:**\n`;
                for (const warning of result.gpuWarnings!) {
                    md += `  - ${warning}\n`;
                }
            }
            md += `\n`;
        }
    }
    
    // Global GPU warnings summary
    const allGPUWarnings = results.flatMap(r => r.gpuWarnings || []);
    if (allGPUWarnings.length > 0) {
        const uniqueWarnings = [...new Set(allGPUWarnings)];
        md += `---\n\n## 🔥 GPU Health Summary\n\n`;
        md += `The following GPU issues were detected during the benchmark:\n\n`;
        for (const warning of uniqueWarnings) {
            md += `- ${warning}\n`;
        }
        md += `\n`;
    }
    
    return md;
}

/**
 * Save benchmark report
 */
async function saveBenchmarkReport(results: BenchmarkResult[], gpu: string) {
    const gitInfo = await getGitInfo();
    const timestamp = new Date().toISOString();
    
    // Calculate summary
    const successful = results.filter(r => r.success).length;
    const avgTime = results.reduce((sum, r) => sum + r.duration, 0) / results.length;
    const avgAccuracy = results.reduce((sum, r) => sum + r.accuracy, 0) / results.length;
    
    const fastest = results.reduce((a, b) => a.duration < b.duration ? a : b);
    const mostAccurate = results.reduce((a, b) => a.accuracy > b.accuracy ? a : b);
    const bestQuality = results.reduce((a, b) => {
        const qualA = ((a.confidence || 0) + a.accuracy) / 2;
        const qualB = ((b.confidence || 0) + b.accuracy) / 2;
        return qualA > qualB ? a : b;
    });
    
    const report: BenchmarkReport = {
        timestamp,
        gitCommit: gitInfo.commit,
        gitBranch: gitInfo.branch,
        gpu,
        gpuWarnings: [...new Set(results.flatMap(r => r.gpuWarnings || []))],
        results,
        summary: {
            modelsTotal: new Set(results.map(r => r.model)).size,
            testsTotal: results.length,
            successful,
            avgTime,
            avgAccuracy,
            fastest: { model: fastest.model, duration: fastest.duration },
            mostAccurate: { model: mostAccurate.model, accuracy: mostAccurate.accuracy },
            bestQuality: { 
                model: bestQuality.model, 
                quality: ((bestQuality.confidence || 0) + bestQuality.accuracy) / 2 
            }
        }
    };
    
    // Create filename with timestamp
    const dateStr = new Date(timestamp).toISOString().replace(/[:.]/g, '-').split('T')[0];
    const timeStr = new Date(timestamp).toISOString().replace(/[:.]/g, '-').split('T')[1].substring(0, 8);
    const commitStr = gitInfo.commit ? `-${gitInfo.commit}` : '';
    const baseFilename = `model-comparison-${dateStr}-${timeStr}${commitStr}`;
    
    const resultsDir = path.join(process.cwd(), 'benchmarks', 'results');
    await mkdir(resultsDir, { recursive: true });
    
    // Save JSON
    const jsonPath = path.join(resultsDir, `${baseFilename}.json`);
    await writeFile(jsonPath, JSON.stringify(report, null, 2));
    console.log(`\n📊 JSON report saved: ${jsonPath}`);
    
    // Save Markdown
    const mdPath = path.join(resultsDir, `${baseFilename}.md`);
    const markdown = generateMarkdownReport(report);
    await writeFile(mdPath, markdown);
    console.log(`📄 Markdown report saved: ${mdPath}`);
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
        
        // Warmup: run a quick inference to load model into GPU
        console.log(`  Warming up ${model}...`);
        try {
            await testModel(model, 'warmup', 'warmup', 
                { fields: { test: { type: 'string' } } }, 
                'Quick warmup test', 
                { test: 'warmup' },
                false  // Skip GPU monitoring for warmup
            );
        } catch (error) {
            console.log(`  Note: Warmup failed, continuing anyway`);
        }
        
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
    
    // Save report
    await saveBenchmarkReport(results, gpuInfo);
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
