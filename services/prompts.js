import inquirer from 'inquirer';
import { getCurrentBranch, getBaseBranch } from './local-git.js';
import { getAvailableLlms } from './llm-discovery.js';
import {
	getDefaultReviewMode,
	getDefaultLlmProvider,
	getDefaultOutputFormat,
	getDefaultLocalOutputFormat,
} from './environment-config.js';

export async function promptForReviewMode() {
	const defaultMode = getDefaultReviewMode(),

		{ reviewMode } = await inquirer.prompt([
			{
				type: 'list',
				name: 'reviewMode',
				message: 'Choose review mode:',
				choices: [
					{
						name: 'local - Review local branch changes (compare current branch with base)',
						value: 'local',
					},
					{
						name: 'gitlab - Review GitLab Merge Request (requires MR URL)',
						value: 'gitlab',
					},
				],
				default: defaultMode,
			},
		]);

	return reviewMode;
}

export async function promptForUrl() {
	const { url } = await inquirer.prompt([
		{
			type: 'input',
			name: 'url',
			message: 'Enter the GitLab Merge Request URL:',
			validate: (input) => {
				if (!input.trim()) {
					return 'Please enter a valid GitLab MR URL';
				}
				if (!input.includes('merge_requests')) {
					return 'Please enter a valid GitLab merge request URL';
				}
				return true;
			},
		},
	]);

	return url.trim();
}

export async function promptForBranches() {
	const currentBranch = await getCurrentBranch(),
		suggestedBase = await getBaseBranch(currentBranch),

		{ baseBranch } = await inquirer.prompt([
			{
				type: 'input',
				name: 'baseBranch',
				message: `Base branch to compare against (current: ${currentBranch}):`,
				default: suggestedBase,
				validate: (input) => {
					if (!input.trim()) {
						return 'Please enter a base branch name';
					}
					return true;
				},
			},
		]);

	return { currentBranch, baseBranch };
}

export async function promptForOutputFormat(isLocal = false) {
	const defaultFormat = isLocal ? getDefaultLocalOutputFormat() : getDefaultOutputFormat(),

		choices = [];

	if (!isLocal) {
		choices.push({
			name: 'gitlab - Post comments directly to GitLab MR',
			value: 'gitlab',
		});
	}

	choices.push(
		{
			name: 'html - Generate beautiful HTML report file',
			value: 'html',
		},
		{
			name: 'cli - Show linter-style console output',
			value: 'cli',
		},
	);

	const { outputFormat } = await inquirer.prompt([
		{
			type: 'list',
			name: 'outputFormat',
			message: 'Choose output format:',
			choices,
			default: defaultFormat,
		},
	]);

	return outputFormat;
}

export async function promptForLlm() {
	const availableLlms = await getAvailableLlms();

	if (availableLlms.length === 0) {
		throw new Error('No LLM binaries found. Please install Claude CLI or Gemini CLI.');
	}

	if (availableLlms.length === 1) {
		console.log(`\n✓ Using ${availableLlms[0]} (only available LLM)`);
		return availableLlms[0];
	}

	const defaultLlm = getDefaultLlmProvider(),
		defaultValue = (defaultLlm && availableLlms.includes(defaultLlm)) ? defaultLlm : availableLlms[0],

		{ llmProvider } = await inquirer.prompt([
			{
				type: 'list',
				name: 'llmProvider',
				message: 'Choose LLM provider:',
				choices: availableLlms.map(llm => ({
					name: llm,
					value: llm,
				})),
				default: defaultValue,
			},
		]);

	return llmProvider;
}
