import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import config from '../config.js';

const execPromise = promisify(exec);

export async function checkBinaryExists(binaryName) {
	try {
		await execPromise(`command -v ${binaryName}`);
		return true;
	} catch {
		return false;
	}
}

export async function getAvailableLlms() {
	const availableLlms = [];

	for (const [llmName, llmConfig] of Object.entries(config.llms)) {
		const exists = await checkBinaryExists(llmConfig.cliPath);
		if (exists) {
			availableLlms.push(llmName);
		}
	}

	return availableLlms;
}

export function isGitLabUrl(input) {
	try {
		const url = new URL(input);
		return url.protocol === 'http:' || url.protocol === 'https:';
	} catch {
		return false;
	}
}
