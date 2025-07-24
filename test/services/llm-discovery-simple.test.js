import { describe, it, expect } from 'vitest';

describe('llm-discovery (simplified)', () => {
	it('should have basic functionality', async() => {
		const { checkBinaryExists, getAvailableLlms, isGitLabUrl } = await import('../../services/llm-discovery.js');

		expect(typeof checkBinaryExists).toBe('function');
		expect(typeof getAvailableLlms).toBe('function');
		expect(typeof isGitLabUrl).toBe('function');
	});

	describe('isGitLabUrl', () => {
		it('should return true for valid HTTP URLs', async() => {
			const { isGitLabUrl } = await import('../../services/llm-discovery.js');

			expect(isGitLabUrl('http://gitlab.com')).toBe(true);
			expect(isGitLabUrl('http://example.com/project')).toBe(true);
		});

		it('should return true for valid HTTPS URLs', async() => {
			const { isGitLabUrl } = await import('../../services/llm-discovery.js');

			expect(isGitLabUrl('https://gitlab.com')).toBe(true);
			expect(isGitLabUrl('https://github.com/user/repo')).toBe(true);
			expect(isGitLabUrl('https://gitlab.example.com/group/project')).toBe(true);
		});

		it('should return false for invalid URLs', async() => {
			const { isGitLabUrl } = await import('../../services/llm-discovery.js');

			expect(isGitLabUrl('not-a-url')).toBe(false);
			expect(isGitLabUrl('ftp://example.com')).toBe(false);
			expect(isGitLabUrl('file:///path/to/file')).toBe(false);
			expect(isGitLabUrl('')).toBe(false);
		});

		it('should return false for malformed URLs', async() => {
			const { isGitLabUrl } = await import('../../services/llm-discovery.js');

			expect(isGitLabUrl('http://')).toBe(false);
			expect(isGitLabUrl('https://')).toBe(false);
			expect(isGitLabUrl('://invalid')).toBe(false);
		});

		it('should handle URLs with ports and paths', async() => {
			const { isGitLabUrl } = await import('../../services/llm-discovery.js');

			expect(isGitLabUrl('https://gitlab.com:8080')).toBe(true);
			expect(isGitLabUrl('http://localhost:3000/project')).toBe(true);
			expect(isGitLabUrl('https://gitlab.com/group/project/merge_requests/123')).toBe(true);
		});

		it('should handle URLs with query parameters and fragments', async() => {
			const { isGitLabUrl } = await import('../../services/llm-discovery.js');

			expect(isGitLabUrl('https://gitlab.com/project?tab=files')).toBe(true);
			expect(isGitLabUrl('https://gitlab.com/project#readme')).toBe(true);
			expect(isGitLabUrl('https://gitlab.com/project?tab=files#readme')).toBe(true);
		});
	});
});
