import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createTemporaryDirectory, cleanupDirectory, readFilesForContext } from '../../utils/file-handler.js';

// Mock dependencies
vi.mock('node:fs', () => ({
	promises: {
		mkdtemp: vi.fn(),
		rm: vi.fn(),
		readFile: vi.fn(),
	},
}));

vi.mock('../../config.js', () => ({
	default: {
		tempDirPrefix: 'gitlab-review-',
	},
}));

describe('file-handler', () => {
	beforeEach(() => {
		vi.clearAllMocks();
		console.log = vi.fn();
		console.warn = vi.fn();
	});

	afterEach(() => {
		vi.restoreAllMocks();
	});

	describe('createTemporaryDirectory', () => {
		it('should create a temporary directory with correct prefix', async() => {
			const mockTempDir = '/tmp/gitlab-review-abc123';
			fs.mkdtemp.mockResolvedValue(mockTempDir);

			const result = await createTemporaryDirectory();

			expect(fs.mkdtemp).toHaveBeenCalledWith(
				path.join(os.tmpdir(), 'gitlab-review-'),
			);
			expect(result).toBe(mockTempDir);
			expect(console.log).toHaveBeenCalledWith(`Created temporary directory: ${mockTempDir}`);
		});

		it('should handle errors when creating temporary directory', async() => {
			const error = new Error('Permission denied');
			fs.mkdtemp.mockRejectedValue(error);

			await expect(createTemporaryDirectory()).rejects.toThrow('Permission denied');
		});
	});

	describe('cleanupDirectory', () => {
		it('should cleanup directory with correct prefix', async() => {
			const tempDir = path.join(os.tmpdir(), 'gitlab-review-abc123');
			fs.rm.mockResolvedValue();

			await cleanupDirectory(tempDir);

			expect(fs.rm).toHaveBeenCalledWith(tempDir, { recursive: true, force: true });
			expect(console.log).toHaveBeenCalledWith(`Cleaning up temporary directory: ${tempDir}`);
		});

		it('should not cleanup directory without correct prefix', async() => {
			const nonTempDir = '/some/other/directory';

			await cleanupDirectory(nonTempDir);

			expect(fs.rm).not.toHaveBeenCalled();
			expect(console.warn).toHaveBeenCalledWith(`Skipping cleanup of non-temporary directory: ${nonTempDir}`);
		});

		it('should handle undefined directory path', async() => {
			await cleanupDirectory();

			expect(fs.rm).not.toHaveBeenCalled();
			expect(console.log).not.toHaveBeenCalled();
			expect(console.warn).not.toHaveBeenCalled();
		});

		it('should handle empty directory path', async() => {
			await cleanupDirectory('');

			expect(fs.rm).not.toHaveBeenCalled();
		});

		it('should handle errors during cleanup', async() => {
			const tempDir = path.join(os.tmpdir(), 'gitlab-review-abc123'),
				error = new Error('Permission denied');
			fs.rm.mockRejectedValue(error);

			await expect(cleanupDirectory(tempDir)).rejects.toThrow('Permission denied');
		});
	});

	describe('readFilesForContext', () => {
		it('should read multiple files and create context', async() => {
			const filePaths = ['file1.js', 'file2.js'],
				repoRoot = '/repo',
				file1Content = 'console.log("file1");',
				file2Content = 'console.log("file2");';

			fs.readFile
				.mockResolvedValueOnce(file1Content)
				.mockResolvedValueOnce(file2Content);

			const result = await readFilesForContext(filePaths, repoRoot);

			expect(fs.readFile).toHaveBeenCalledWith('/repo/file1.js', 'utf8');
			expect(fs.readFile).toHaveBeenCalledWith('/repo/file2.js', 'utf8');
			expect(result).toBe(
				`--- file1.js ---\n${file1Content}\n\n--- file2.js ---\n${file2Content}\n\n`,
			);
		});

		it('should handle file read errors gracefully', async() => {
			const filePaths = ['file1.js', 'file2.js'],
				repoRoot = '/repo',
				file1Content = 'console.log("file1");',
				error = new Error('File not found');

			fs.readFile
				.mockResolvedValueOnce(file1Content)
				.mockRejectedValueOnce(error);

			const result = await readFilesForContext(filePaths, repoRoot);

			expect(console.warn).toHaveBeenCalledWith('Warning: Could not read file file2.js: File not found');
			expect(result).toBe(`--- file1.js ---\n${file1Content}\n\n`);
		});

		it('should handle empty file paths array', async() => {
			const result = await readFilesForContext([], '/repo');
			expect(result).toBe('');
			expect(fs.readFile).not.toHaveBeenCalled();
		});

		it('should handle paths with special characters', async() => {
			const filePaths = ['src/utils/file-with spaces.js'],
				repoRoot = '/repo',
				content = 'test content';

			fs.readFile.mockResolvedValue(content);

			const result = await readFilesForContext(filePaths, repoRoot);

			expect(fs.readFile).toHaveBeenCalledWith('/repo/src/utils/file-with spaces.js', 'utf8');
			expect(result).toContain('--- src/utils/file-with spaces.js ---');
		});
	});
});
