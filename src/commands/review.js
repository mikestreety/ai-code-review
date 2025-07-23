import { Command, Args, Flags } from '@oclif/core';
import { validateReviewMode, validateLocalOutputFormat, validateOutputFormat } from '../../services/validator.js';
import { getAvailableLlms } from '../../services/llm-discovery.js';
import { promptForReviewMode, promptForUrl, promptForOutputFormat, promptForLlm } from '../../services/prompts.js';
import { determineBranchesForLocalReview, performLocalReview, performGitLabReview } from '../../services/review-orchestrator.js';
import {
	getForceReviewMode,
	getForceLlmProvider,
	getForceOutputFormat,
	getForceLocalOutputFormat,
	shouldForceValue,
} from '../../services/environment-config.js';

export default class Review extends Command {
	static args = {
		url_or_branch: Args.string({
			description: 'GitLab MR URL or local branch name (will prompt if not provided)',
			required: false,
		}),
	};

	static description = 'Review code changes with AI-powered analysis';

	static flags = {
		'help': Flags.help({ char: 'h' }),
		'mode': Flags.string({
			char: 'm',
			description: 'Review mode: local (compare branches) or gitlab (MR review)',
			options: ['local', 'gitlab'],
		}),
		'base': Flags.string({
			char: 'b',
			description: 'Base branch for local comparison (default: auto-detect)',
		}),
		'llm': Flags.string({
			char: 'l',
			description: 'LLM provider to use (will prompt if not specified)',
		}),
		'output': Flags.string({
			char: 'o',
			description: 'Output format: gitlab (post to MR), html (generate report), cli (console output)',
			options: ['gitlab', 'html', 'cli'],
		}),
		'list-llms': Flags.boolean({
			description: 'List available LLM providers and exit',
		}),
	};

	async run() {
		const { args, flags } = await this.parse(Review);

		if (flags['list-llms']) {
			await this.listAvailableLlms();
			return;
		}

		await this.handleReviewCommand(args.url_or_branch, flags);
	}

	async listAvailableLlms() {
		const availableLlms = await getAvailableLlms();
		if (availableLlms.length === 0) {
			this.log('No LLM binaries found. Please install one of: claude, gemini, openai, ollama, chatgpt, llama, or gh (for copilot)');
		} else {
			this.log('Available LLM providers:');
			for (const llm of availableLlms) {
				this.log(`  - ${llm}`);
			}
		}
	}

	async handleReviewCommand(urlOrBranch, options) {
		// Determine review mode
		let reviewMode = options.mode;
		const forceMode = getForceReviewMode();

		if (shouldForceValue(forceMode)) {
			reviewMode = forceMode;
		} else if (!reviewMode) {
			reviewMode = await promptForReviewMode();
		}

		try {
			validateReviewMode(reviewMode);
		} catch (error) {
			this.error(`Error: ${error.message}`, { exit: 1 });
		}

		const forceLlm = getForceLlmProvider();
		let llmProvider = options.llm;
		if (shouldForceValue(forceLlm)) {
			llmProvider = forceLlm;
		} else if (!llmProvider) {
			llmProvider = await promptForLlm();
		}

		await (reviewMode === 'local' ? this.handleLocalReview(urlOrBranch, options, llmProvider) : this.handleGitLabReview(urlOrBranch, options, llmProvider));
	}

	async handleLocalReview(urlOrBranch, options, llmProvider) {
		// Determine branches
		const { currentBranch, baseBranch } = await determineBranchesForLocalReview(urlOrBranch, options);

		// Get output format
		let outputFormat = options.output;
		const forceLocalOutput = getForceLocalOutputFormat();

		if (shouldForceValue(forceLocalOutput)) {
			outputFormat = forceLocalOutput;
		} else if (!outputFormat) {
			outputFormat = await promptForOutputFormat(true);
		} else if (options.output) {
			try {
				validateLocalOutputFormat(options.output);
				outputFormat = options.output;
			} catch (error) {
				this.error(`Error: ${error.message}`, { exit: 1 });
			}
		} else {
			outputFormat = 'html';
		}

		await performLocalReview(currentBranch, baseBranch, llmProvider, outputFormat);
	}

	async handleGitLabReview(urlOrBranch, options, llmProvider) {
		// Get URL
		let url = urlOrBranch;
		if (!url) {
			url = await promptForUrl();
			if (!url) {
				this.error('Error: GitLab MR URL is required', { exit: 1 });
			}
		}

		// Get output format
		let outputFormat = options.output;
		const forceOutput = getForceOutputFormat();

		if (shouldForceValue(forceOutput)) {
			outputFormat = forceOutput;
		} else if (!outputFormat) {
			outputFormat = await promptForOutputFormat(false);
		} else if (options.output) {
			try {
				validateOutputFormat(options.output);
				outputFormat = options.output;
			} catch (error) {
				this.error(`Error: ${error.message}`, { exit: 1 });
			}
		} else {
			outputFormat = 'gitlab';
		}

		await performGitLabReview(url, llmProvider, outputFormat);
	}
}
