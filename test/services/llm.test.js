import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { EventEmitter } from 'node:events';
import { runCodeReview, runClaudeCodeReview, runGeminiCodeReview } from '../../services/llm.js';

// Mock dependencies
vi.mock('node:child_process', () => ({
	spawn: vi.fn(),
}));

vi.mock('node:fs', () => ({
	readFileSync: vi.fn(),
}));

vi.mock('../../config.js', () => ({
	default: {
		llms: {
			claude: {
				cliPath: 'claude',
				args: ['--print', '--output-format', 'json'],
				timeout: 30_000,
			},
			gemini: {
				cliPath: 'gemini',
				args: ['-p'],
				timeout: 30_000,
			},
			invalid: {
				cliPath: 'invalid',
				args: [],
				timeout: 30_000,
			},
		},
	},
}));

describe('llm', () => {
	let mockSpawn,
		mockReadFileSync,
		originalStderr;

	beforeEach(async() => {
		vi.clearAllMocks();

		// Mock stderr.write to avoid console noise during tests
		originalStderr = process.stderr.write;
		process.stderr.write = vi.fn();

		const childProcess = await import('node:child_process'),
			fs = await import('node:fs');

		mockSpawn = childProcess.spawn;
		mockReadFileSync = fs.readFileSync;

		// Mock prompt file
		mockReadFileSync.mockReturnValue('Code review prompt: {FULL_FILE_CONTEXT}\nDiff: {CODE_DIFF}');
	});

	afterEach(() => {
		vi.restoreAllMocks();
		process.stderr.write = originalStderr;
	});

	describe('runCodeReview', () => {
		it('should successfully run code review with Claude', async() => {
			const mockProcess = new EventEmitter();
			mockProcess.stdout = new EventEmitter();
			mockProcess.stderr = new EventEmitter();
			mockProcess.stdin = {
				write: vi.fn(),
				end: vi.fn(),
			};
			mockProcess.kill = vi.fn();

			mockSpawn.mockReturnValue(mockProcess);

			const reviewPromise = runCodeReview('claude', 'diff content', 'file context');

			// Simulate successful execution
			setTimeout(() => {
				mockProcess.stdout.emit('data', 'Review result');
				mockProcess.emit('close', 0);
			}, 10);

			const result = await reviewPromise;

			expect(mockSpawn).toHaveBeenCalledWith('claude', ['--print', '--output-format', 'json'], {
				stdio: ['pipe', 'pipe', 'pipe'],
			});
			expect(mockProcess.stdin.write).toHaveBeenCalledWith(
				expect.stringContaining('Code review prompt: file context'),
			);
			expect(mockProcess.stdin.write).toHaveBeenCalledWith(
				expect.stringContaining('Diff: diff content'),
			);
			expect(result).toBe('Review result');
		});

		it('should handle process timeout', async() => {
			vi.useFakeTimers();

			const mockProcess = new EventEmitter();
			mockProcess.stdout = new EventEmitter();
			mockProcess.stderr = new EventEmitter();
			mockProcess.stdin = {
				write: vi.fn(),
				end: vi.fn(),
			};
			mockProcess.kill = vi.fn();

			mockSpawn.mockReturnValue(mockProcess);

			const reviewPromise = runCodeReview('claude', 'diff', 'context');

			// Fast-forward time to trigger timeout
			vi.advanceTimersByTime(30_000);

			await expect(reviewPromise).rejects.toThrow('CLAUDE CLI timed out after 30 seconds');
			expect(mockProcess.kill).toHaveBeenCalled();

			vi.useRealTimers();
		});

		it('should handle process errors', async() => {
			const mockProcess = new EventEmitter();
			mockProcess.stdout = new EventEmitter();
			mockProcess.stderr = new EventEmitter();
			mockProcess.stdin = {
				write: vi.fn(),
				end: vi.fn(),
			};

			mockSpawn.mockReturnValue(mockProcess);

			const reviewPromise = runCodeReview('claude', 'diff', 'context');

			setTimeout(() => {
				mockProcess.emit('error', new Error('Failed to start process'));
			}, 10);

			await expect(reviewPromise).rejects.toThrow('Failed to start CLAUDE CLI: Failed to start process');
		});

		it('should handle non-zero exit codes', async() => {
			const mockProcess = new EventEmitter();
			mockProcess.stdout = new EventEmitter();
			mockProcess.stderr = new EventEmitter();
			mockProcess.stdin = {
				write: vi.fn(),
				end: vi.fn(),
			};

			mockSpawn.mockReturnValue(mockProcess);

			const reviewPromise = runCodeReview('claude', 'diff', 'context');

			setTimeout(() => {
				mockProcess.stderr.emit('data', 'Error message');
				mockProcess.emit('close', 1);
			}, 10);

			await expect(reviewPromise).rejects.toThrow('CLAUDE CLI execution failed with code 1: Error message');
		});

		it('should throw error for unsupported LLM', async() => {
			await expect(runCodeReview('unsupported', 'diff', 'context'))
				.rejects.toThrow('Unsupported LLM: unsupported. Supported LLMs: claude, gemini, invalid');
		});

		it('should escape backticks in content', async() => {
			const mockProcess = new EventEmitter();
			mockProcess.stdout = new EventEmitter();
			mockProcess.stderr = new EventEmitter();
			mockProcess.stdin = {
				write: vi.fn(),
				end: vi.fn(),
			};

			mockSpawn.mockReturnValue(mockProcess);

			const reviewPromise = runCodeReview('claude', 'diff with `backticks`', 'context with `backticks`');

			setTimeout(() => {
				mockProcess.emit('close', 0);
			}, 10);

			await reviewPromise;

			const writtenContent = mockProcess.stdin.write.mock.calls[0][0];
			expect(writtenContent).toContain('context with \\`backticks\\`');
			expect(writtenContent).toContain('diff with \\`backticks\\`');
		});

		it('should handle stdout data chunks', async() => {
			const mockProcess = new EventEmitter();
			mockProcess.stdout = new EventEmitter();
			mockProcess.stderr = new EventEmitter();
			mockProcess.stdin = {
				write: vi.fn(),
				end: vi.fn(),
			};

			mockSpawn.mockReturnValue(mockProcess);

			const reviewPromise = runCodeReview('claude', 'diff', 'context');

			setTimeout(() => {
				mockProcess.stdout.emit('data', 'Part 1 ');
				mockProcess.stdout.emit('data', 'Part 2');
				mockProcess.emit('close', 0);
			}, 10);

			const result = await reviewPromise;
			expect(result).toBe('Part 1 Part 2');
		});

		it('should handle prompt file loading errors', async() => {
			mockReadFileSync.mockImplementation(() => {
				throw new Error('File not found');
			});

			await expect(runCodeReview('claude', 'diff', 'context'))
				.rejects.toThrow('Could not find code-review.txt prompt file');
		});
	});

	describe('Legacy functions', () => {
		it('runClaudeCodeReview should call runCodeReview with claude', async() => {
			const mockProcess = new EventEmitter();
			mockProcess.stdout = new EventEmitter();
			mockProcess.stderr = new EventEmitter();
			mockProcess.stdin = {
				write: vi.fn(),
				end: vi.fn(),
			};

			mockSpawn.mockReturnValue(mockProcess);

			const reviewPromise = runClaudeCodeReview('diff', 'context');

			setTimeout(() => {
				mockProcess.stdout.emit('data', 'Claude result');
				mockProcess.emit('close', 0);
			}, 10);

			const result = await reviewPromise;

			expect(mockSpawn).toHaveBeenCalledWith('claude', ['--print', '--output-format', 'json'], {
				stdio: ['pipe', 'pipe', 'pipe'],
			});
			expect(result).toBe('Claude result');
		});

		it('runGeminiCodeReview should call runCodeReview with gemini', async() => {
			const mockProcess = new EventEmitter();
			mockProcess.stdout = new EventEmitter();
			mockProcess.stderr = new EventEmitter();
			mockProcess.stdin = {
				write: vi.fn(),
				end: vi.fn(),
			};

			mockSpawn.mockReturnValue(mockProcess);

			const reviewPromise = runGeminiCodeReview('diff', 'context');

			setTimeout(() => {
				mockProcess.stdout.emit('data', 'Gemini result');
				mockProcess.emit('close', 0);
			}, 10);

			const result = await reviewPromise;

			expect(mockSpawn).toHaveBeenCalledWith('gemini', ['-p'], {
				stdio: ['pipe', 'pipe', 'pipe'],
			});
			expect(result).toBe('Gemini result');
		});
	});
});
