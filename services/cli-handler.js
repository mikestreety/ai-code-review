import { Command } from 'commander';
import { validateReviewMode, validateLocalOutputFormat, validateOutputFormat } from './validator.js';
import { getAvailableLlms } from './llm-discovery.js';
import { promptForReviewMode, promptForUrl, promptForBranches, promptForOutputFormat, promptForLlm } from './prompts.js';
import { determineBranchesForLocalReview, performLocalReview, performGitLabReview } from './review-orchestrator.js';
import { runSetup } from './setup.js';
import { 
	getForceReviewMode, 
	getForceLlmProvider, 
	getForceOutputFormat, 
	getForceLocalOutputFormat,
	shouldForceValue 
} from './env-config.js';

export function createCliProgram(packageJson) {
	const program = new Command();

	program
		.name('gitlab-mr-reviewer')
		.description('AI-powered code reviews for GitLab MRs and local git branches')
		.version(packageJson.version);

	program
		.command('review')
		.description('Review code changes with AI-powered analysis')
		.argument('[url_or_branch]', 'GitLab MR URL or local branch name (will prompt if not provided)')
		.option('-m, --mode <mode>', 'Review mode: local (compare branches) or gitlab (MR review)')
		.option('-b, --base <branch>', 'Base branch for local comparison (default: auto-detect)')
		.option('-l, --llm <provider>', 'LLM provider to use (will prompt if not specified)')
		.option('-o, --output <format>', 'Output format: gitlab (post to MR), html (generate report), cli (console output)')
		.option('--list-llms', 'List available LLM providers and exit')
		.action(async(urlOrBranch, options) => {
			if (options.listLlms) {
				await listAvailableLlms();
				return;
			}

			await handleReviewCommand(urlOrBranch, options);
		});

	// Add a separate command for listing LLMs
	program
		.command('list-llms')
		.description('List available LLM providers')
		.action(async() => {
			await listAvailableLlms();
		});

	// Add setup command
	program
		.command('setup')
		.description('Configure default preferences and force options')
		.action(async() => {
			await runSetup();
		});

	return program;
}

async function listAvailableLlms() {
	const availableLlms = await getAvailableLlms();
	if (availableLlms.length === 0) {
		console.log('No LLM binaries found. Please install one of: claude, gemini, openai, ollama, chatgpt, llama, or gh (for copilot)');
	} else {
		console.log('Available LLM providers:');
		for (const llm of availableLlms) {
			console.log(`  - ${llm}`);
		}
	}
}

async function handleReviewCommand(urlOrBranch, options) {
	// Determine review mode
	let reviewMode = options.mode;
	const forceMode = getForceReviewMode();
	
	if (shouldForceValue(forceMode)) {
		reviewMode = forceMode;
	} else if (!process.argv.includes('--mode') && !process.argv.includes('-m')) {
		reviewMode = await promptForReviewMode();
	}

	try {
		validateReviewMode(reviewMode);
	} catch (error) {
		console.error('Error:', error.message);
		process.exit(1);
	}

	const forceLlm = getForceLlmProvider();
	let llmProvider = options.llm;
	if (shouldForceValue(forceLlm)) {
		llmProvider = forceLlm;
	} else if (!process.argv.includes('--llm') && !process.argv.includes('-l')) {
		llmProvider = await promptForLlm();
	}

	await (reviewMode === 'local' ? handleLocalReview(urlOrBranch, options, llmProvider) : handleGitLabReview(urlOrBranch, options, llmProvider));
}


async function handleLocalReview(urlOrBranch, options, llmProvider) {

	// Get output format
	let outputFormat = options.output;
	const forceLocalOutput = getForceLocalOutputFormat();
	
	if (shouldForceValue(forceLocalOutput)) {
		outputFormat = forceLocalOutput;
	} else if (!process.argv.includes('--output') && !process.argv.includes('-o')) {
		outputFormat = await promptForOutputFormat(true);
	} else if (options.output) {
		try {
			validateLocalOutputFormat(options.output);
			outputFormat = options.output;
		} catch (error) {
			console.error('Error:', error.message);
			process.exit(1);
		}
	} else {
		outputFormat = 'html';
	}

	await performLocalReview(currentBranch, baseBranch, llmProvider, outputFormat);
}

async function handleGitLabReview(urlOrBranch, options, llmProvider) {

	// Get output format
	let outputFormat = options.output;
	const forceOutput = getForceOutputFormat();
	
	if (shouldForceValue(forceOutput)) {
		outputFormat = forceOutput;
	} else if (!process.argv.includes('--output') && !process.argv.includes('-o')) {
		outputFormat = await promptForOutputFormat(false);
	} else if (options.output) {
		try {
			validateOutputFormat(options.output);
			outputFormat = options.output;
		} catch (error) {
			console.error('Error:', error.message);
			process.exit(1);
		}
	} else {
		outputFormat = 'gitlab';
	}

	await performGitLabReview(url, llmProvider, outputFormat);
}

export async function handleInteractiveMode() {
	const forceMode = getForceReviewMode();
	const reviewMode = shouldForceValue(forceMode) ? forceMode : await promptForReviewMode();

	if (reviewMode === 'local') {
		const branchInfo = await promptForBranches();
		
		const forceLlm = getForceLlmProvider();
		const llmProvider = shouldForceValue(forceLlm) ? forceLlm : await promptForLlm();
		
		const forceLocalOutput = getForceLocalOutputFormat();
		const outputFormat = shouldForceValue(forceLocalOutput) ? forceLocalOutput : await promptForOutputFormat(true);
		
		await performLocalReview(branchInfo.currentBranch, branchInfo.baseBranch, llmProvider, outputFormat);
	} else {
		const url = await promptForUrl();
		if (!url) {
			console.error('Error: GitLab MR URL is required');
			process.exit(1);
		}
		
		const forceLlm = getForceLlmProvider();
		const llmProvider = shouldForceValue(forceLlm) ? forceLlm : await promptForLlm();
		
		const forceOutput = getForceOutputFormat();
		const outputFormat = shouldForceValue(forceOutput) ? forceOutput : await promptForOutputFormat(false);
		
		await performGitLabReview(url, llmProvider, outputFormat);
	}
}
