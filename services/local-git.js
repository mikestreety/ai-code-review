import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

const execPromise = promisify(exec);

export async function getCurrentBranch() {
	try {
		const { stdout } = await execPromise('git rev-parse --abbrev-ref HEAD');
		return stdout.trim();
	} catch (error) {
		throw new Error(`Failed to get current branch: ${error.message}`);
	}
}

export async function getBaseBranch(currentBranch) {
	try {
		// Try to find the merge base with common branches
		const commonBranches = ['main', 'master', 'develop', 'dev'];

		for (const baseBranch of commonBranches) {
			if (baseBranch === currentBranch) continue;

			try {
				await execPromise(`git rev-parse --verify ${baseBranch}`);
				return baseBranch;
			} catch {
				// Branch doesn't exist, try next one
				continue;
			}
		}

		// If no common branch found, try to get the upstream branch
		try {
			const { stdout } = await execPromise(`git rev-parse --abbrev-ref ${currentBranch}@{upstream}`);
			return stdout.trim().replace('origin/', '');
		} catch {
			// Fall back to main if nothing else works
			return 'main';
		}
	} catch (error) {
		throw new Error(`Failed to determine base branch: ${error.message}`);
	}
}

export async function getBranchDiff(currentBranch, baseBranch) {
	try {
		const { stdout } = await execPromise(`git diff ${baseBranch}...${currentBranch}`);
		return stdout;
	} catch (error) {
		throw new Error(`Failed to get diff between ${baseBranch} and ${currentBranch}: ${error.message}`);
	}
}

export async function getChangedFilesLocal(currentBranch, baseBranch) {
	try {
		const { stdout } = await execPromise(`git diff --name-only ${baseBranch}...${currentBranch}`);
		return stdout.trim().split('\n').filter(file => file.length > 0);
	} catch (error) {
		throw new Error(`Failed to get changed files between ${baseBranch} and ${currentBranch}: ${error.message}`);
	}
}

export async function readLocalFilesForContext(filePaths, repoRoot = '.') {
	let context = '';
	for (const filePath of filePaths) {
		try {
			const fullPath = path.resolve(repoRoot, filePath),
				content = await readFile(fullPath, 'utf8');
			context += `--- ${filePath} ---\n${content}\n\n`;
		} catch (error) {
			console.warn(`Warning: Could not read file ${filePath}: ${error.message}`);
		}
	}
	return context;
}

export async function validateGitRepository() {
	try {
		await execPromise('git rev-parse --git-dir');
		return true;
	} catch {
		throw new Error('Current directory is not a git repository');
	}
}

export async function getBranchInfo(currentBranch, baseBranch) {
	try {
		const { stdout: currentSha } = await execPromise(`git rev-parse ${currentBranch}`),
			{ stdout: baseSha } = await execPromise(`git rev-parse ${baseBranch}`);

		return {
			currentBranch,
			baseBranch,
			currentSha: currentSha.trim(),
			baseSha: baseSha.trim(),
		};
	} catch (error) {
		throw new Error(`Failed to get branch information: ${error.message}`);
	}
}
