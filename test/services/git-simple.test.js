import { describe, it, expect } from 'vitest';

describe('git (simplified)', () => {
	it('should validate required parameters', async() => {
		const { cloneRepository } = await import('../../services/git.js');

		// Test parameter validation
		await expect(cloneRepository(null, 'main', '/tmp'))
			.rejects.toThrow('Missing required parameters for git clone');

		await expect(cloneRepository('https://example.com/repo.git', null, '/tmp'))
			.rejects.toThrow('Missing required parameters for git clone');

		await expect(cloneRepository('https://example.com/repo.git', 'main', null))
			.rejects.toThrow('Missing required parameters for git clone');
	});
});

describe('local-git (simplified)', () => {
	it('should have basic functionality', async() => {
		// Test that the module can be imported without errors
		const localGit = await import('../../services/local-git.js');

		expect(typeof localGit.getCurrentBranch).toBe('function');
		expect(typeof localGit.getBaseBranch).toBe('function');
		expect(typeof localGit.getBranchDiff).toBe('function');
		expect(typeof localGit.getChangedFilesLocal).toBe('function');
		expect(typeof localGit.readLocalFilesForContext).toBe('function');
		expect(typeof localGit.validateGitRepository).toBe('function');
		expect(typeof localGit.getBranchInfo).toBe('function');
	});
});
