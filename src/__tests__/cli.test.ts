/**
 * Tests for CLI entrypoint
 * Note: Full end-to-end tests require running the CLI process
 */

import { describe, it, expect } from 'vitest';
import { exec } from 'child_process';
import { promisify } from 'util';
import * as path from 'path';

const execAsync = promisify(exec);
const CLI_PATH = path.join(process.cwd(), 'dist/cli.js');

describe('CLI', () => {
    describe('help command', () => {
        it('should display help with --help flag', async () => {
            const { stdout } = await execAsync(`node ${CLI_PATH} --help`);
            
            expect(stdout).toContain('Ordis CLI');
            expect(stdout).toContain('USAGE:');
            expect(stdout).toContain('ordis extract');
            expect(stdout).toContain('--schema');
            expect(stdout).toContain('--input');
            expect(stdout).toContain('--base');
            expect(stdout).toContain('--model');
        });

        it('should display help with -h flag', async () => {
            const { stdout } = await execAsync(`node ${CLI_PATH} -h`);
            
            expect(stdout).toContain('Ordis CLI');
        });
    });

    describe('version command', () => {
        it('should display version with --version flag', async () => {
            const { stdout } = await execAsync(`node ${CLI_PATH} --version`);
            
            expect(stdout).toContain('ordis-cli v');
            expect(stdout).toMatch(/v\d+\.\d+\.\d+/);
        });

        it('should display version with -v flag', async () => {
            const { stdout } = await execAsync(`node ${CLI_PATH} -v`);
            
            expect(stdout).toContain('ordis-cli v');
            expect(stdout).toMatch(/v\d+\.\d+\.\d+/);
        });
    });

    describe('error handling', () => {
        it('should error when no command specified', async () => {
            try {
                await execAsync(`node ${CLI_PATH}`);
                expect.fail('Should have thrown an error');
            } catch (error: any) {
                expect(error.code).toBe(1);
                expect(error.stderr).toContain('No command specified');
            }
        });

        it('should error when unknown command specified', async () => {
            try {
                await execAsync(`node ${CLI_PATH} unknown`);
                expect.fail('Should have thrown an error');
            } catch (error: any) {
                expect(error.code).toBe(1);
                expect(error.stderr).toContain('Unknown command');
            }
        });

        it('should error when --schema is missing', async () => {
            try {
                await execAsync(`node ${CLI_PATH} extract --input test.txt --base http://localhost --model test`);
                expect.fail('Should have thrown an error');
            } catch (error: any) {
                expect(error.code).toBe(1);
                expect(error.stderr).toContain('--schema is required');
            }
        });

        it('should error when --input is missing', async () => {
            try {
                await execAsync(`node ${CLI_PATH} extract --schema test.json --base http://localhost --model test`);
                expect.fail('Should have thrown an error');
            } catch (error: any) {
                expect(error.code).toBe(1);
                expect(error.stderr).toContain('--input is required');
            }
        });

        it('should error when --base is missing', async () => {
            try {
                await execAsync(`node ${CLI_PATH} extract --schema test.json --input test.txt --model test`);
                expect.fail('Should have thrown an error');
            } catch (error: any) {
                expect(error.code).toBe(1);
                expect(error.stderr).toContain('--base is required');
            }
        });

        it('should error when --model is missing', async () => {
            try {
                await execAsync(`node ${CLI_PATH} extract --schema test.json --input test.txt --base http://localhost`);
                expect.fail('Should have thrown an error');
            } catch (error: any) {
                expect(error.code).toBe(1);
                expect(error.stderr).toContain('--model is required');
            }
        });
    });
});
