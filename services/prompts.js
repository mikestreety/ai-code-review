import readline from 'node:readline';
import { getCurrentBranch, getBaseBranch } from './local-git.js';
import { getAvailableLlms } from './llm-discovery.js';
import { 
	getDefaultReviewMode, 
	getDefaultLlmProvider, 
	getDefaultOutputFormat, 
	getDefaultLocalOutputFormat 
} from './env-config.js';

function createReadlineInterface() {
	return readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});
}

export async function promptForReviewMode() {
	const rl = createReadlineInterface();
	const defaultMode = getDefaultReviewMode();

	return new Promise((resolve) => {
		console.log('\nReview mode options:');
		console.log('  local  - Review local branch changes (compare current branch with base)');
		console.log('  gitlab - Review GitLab Merge Request (requires MR URL)');
		rl.question(`\nChoose review mode [local/gitlab] (default: ${defaultMode}): `, (answer) => {
			rl.close();
			const mode = answer.trim().toLowerCase() || defaultMode;
			resolve(['local', 'gitlab'].includes(mode) ? mode : defaultMode);
		});
	});
}

export async function promptForUrl() {
	const rl = createReadlineInterface();

	return new Promise((resolve) => {
		rl.question('Please enter the GitLab Merge Request URL: ', (answer) => {
			rl.close();
			resolve(answer.trim());
		});
	});
}

export async function promptForBranches() {
	const rl = createReadlineInterface();

	try {
		const currentBranch = await getCurrentBranch(),
			suggestedBase = await getBaseBranch(currentBranch);

		return new Promise((resolve) => {
			console.log(`\nCurrent branch: ${currentBranch}`);
			rl.question(`Base branch to compare against (default: ${suggestedBase}): `, (answer) => {
				rl.close();
				const baseBranch = answer.trim() || suggestedBase;
				resolve({ currentBranch, baseBranch });
			});
		});
	} catch (error) {
		rl.close();
		throw error;
	}
}

export async function promptForOutputFormat(isLocal = false) {
	const rl = createReadlineInterface();
	const defaultFormat = isLocal ? getDefaultLocalOutputFormat() : getDefaultOutputFormat();

	return new Promise((resolve) => {
		console.log('\nOutput format options:');
		if (!isLocal) {
			console.log('  gitlab - Post comments directly to GitLab MR (default)');
		}
		console.log('  html   - Generate beautiful HTML report file');
		console.log('  cli    - Show linter-style console output');

		const validFormats = isLocal ? ['html', 'cli'] : ['gitlab', 'html', 'cli'],
			formatOptions = isLocal ? 'html/cli' : 'gitlab/html/cli';

		rl.question(`\nChoose output format [${formatOptions}] (default: ${defaultFormat}): `, (answer) => {
			rl.close();
			const format = answer.trim().toLowerCase() || defaultFormat;
			resolve(validFormats.includes(format) ? format : defaultFormat);
		});
	});
}

export async function promptForLlm() {
	const availableLlms = await getAvailableLlms();

	if (availableLlms.length === 0) {
		throw new Error('No LLM binaries found. Please install Claude CLI or Gemini CLI.');
	}

	if (availableLlms.length === 1) {
		console.log(`\nUsing ${availableLlms[0]} (only available LLM)`);
		return availableLlms[0];
	}

	const rl = createReadlineInterface();
	const defaultLlm = getDefaultLlmProvider();
	const defaultIndex = defaultLlm && availableLlms.includes(defaultLlm) 
		? availableLlms.indexOf(defaultLlm) + 1 
		: 1;

	return new Promise((resolve) => {
		console.log('\nAvailable LLM providers:');
		for (const [index, llm] of availableLlms.entries()) {
			console.log(`  ${index + 1}. ${llm}`);
		}
		console.log(`\nDefault: ${availableLlms[defaultIndex - 1]}`);

		rl.question(`\nChoose LLM provider [1-${availableLlms.length}] (default: ${defaultIndex}): `, (answer) => {
			rl.close();
			const choice = Number.parseInt(answer.trim()) || defaultIndex,
				selectedLlm = availableLlms[choice - 1] || availableLlms[defaultIndex - 1];
			resolve(selectedLlm);
		});
	});
}
