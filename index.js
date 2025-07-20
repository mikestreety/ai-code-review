import 'dotenv/config';
import { Command } from 'commander';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import readline from 'node:readline';
import { getProjectCloneUrl, getMergeRequestDetails, getMergeRequestDiff, getChangedFiles, getUnresolvedDiscussions } from './api/gitlab.js';
import { cloneRepository } from './services/git.js';
import { runCodeReview } from './services/llm.js';
import { createTemporaryDirectory, cleanupDirectory, readFilesForContext } from './utils/file-handler.js';
import { validateEnvironment, validateLlmChoice, validateOutputFormat, validateReviewMode, validateLocalOutputFormat, parseGitLabUrl } from './services/validator.js';
import { parseReviewResponse } from './services/review-processor.js';
import { handleOutput } from './services/output-handlers.js';
import { validateGitRepository, getCurrentBranch, getBaseBranch, getBranchDiff, getChangedFilesLocal, readLocalFilesForContext, getBranchInfo } from './services/local-git.js';
import config from './config.js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __filename = fileURLToPath(import.meta.url),
	__dirname = path.dirname(__filename),
	packageJson = JSON.parse(readFileSync(path.join(__dirname, 'package.json'), 'utf8')),
	execPromise = promisify(exec);

async function promptForReviewMode() {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	return new Promise((resolve) => {
		console.log('\nReview mode options:');
		console.log('  local  - Review local branch changes (compare current branch with base)');
		console.log('  gitlab - Review GitLab Merge Request (requires MR URL)');
		rl.question('\nChoose review mode [local/gitlab] (default: local): ', (answer) => {
			rl.close();
			const mode = answer.trim().toLowerCase() || 'local';
			resolve(['local', 'gitlab'].includes(mode) ? mode : 'local');
		});
	});
}

async function promptForUrl() {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	return new Promise((resolve) => {
		rl.question('Please enter the GitLab Merge Request URL: ', (answer) => {
			rl.close();
			resolve(answer.trim());
		});
	});
}

async function promptForBranches() {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

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

async function promptForOutputFormat(isLocal = false) {
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	return new Promise((resolve) => {
		console.log('\nOutput format options:');
		if (!isLocal) {
			console.log('  gitlab - Post comments directly to GitLab MR (default)');
		}
		console.log('  html   - Generate beautiful HTML report file');
		console.log('  cli    - Show linter-style console output');

		const defaultFormat = isLocal ? 'html' : 'gitlab',
			validFormats = isLocal ? ['html', 'cli'] : ['gitlab', 'html', 'cli'],
			formatOptions = isLocal ? 'html/cli' : 'gitlab/html/cli';

		rl.question(`\nChoose output format [${formatOptions}] (default: ${defaultFormat}): `, (answer) => {
			rl.close();
			const format = answer.trim().toLowerCase() || defaultFormat;
			resolve(validFormats.includes(format) ? format : defaultFormat);
		});
	});
}

async function promptForLlm() {
	const availableLlms = await getAvailableLlms();

	if (availableLlms.length === 0) {
		throw new Error('No LLM binaries found. Please install Claude CLI or Gemini CLI.');
	}

	if (availableLlms.length === 1) {
		console.log(`\nUsing ${availableLlms[0]} (only available LLM)`);
		return availableLlms[0];
	}

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	return new Promise((resolve) => {
		console.log('\nAvailable LLM providers:');
		for (const [index, llm] of availableLlms.entries()) {
			console.log(`  ${index + 1}. ${llm}`);
		}
		console.log(`\nDefault: ${availableLlms[0]}`);

		rl.question(`\nChoose LLM provider [1-${availableLlms.length}] (default: 1): `, (answer) => {
			rl.close();
			const choice = Number.parseInt(answer.trim()) || 1,
				selectedLlm = availableLlms[choice - 1] || availableLlms[0];
			resolve(selectedLlm);
		});
	});
}

async function checkBinaryExists(binaryName) {
	try {
		await execPromise(`command -v ${binaryName}`);
		return true;
	} catch {
		return false;
	}
}

async function getAvailableLlms() {
	const availableLlms = [];

	for (const [llmName, llmConfig] of Object.entries(config.llms)) {
		const exists = await checkBinaryExists(llmConfig.cliPath);
		if (exists) {
			availableLlms.push(llmName);
		}
	}

	return availableLlms;
}

async function determineBranchesForLocalReview(urlOrBranch, options) {
	let currentBranch, baseBranch;

	if (urlOrBranch && !urlOrBranch.startsWith('http')) {
		// Treat as branch name
		currentBranch = urlOrBranch;
		baseBranch = options.base ? options.base : (await getBaseBranch(currentBranch));
	} else if (urlOrBranch) {
		throw new Error('URL provided but local mode selected. Use --mode gitlab for GitLab URLs.');
	} else if (options.base) {
		// Use current branch with provided base
		currentBranch = await getCurrentBranch();
		baseBranch = options.base;
	} else {
		// Prompt for branches
		const branchInfo = await promptForBranches();
		currentBranch = branchInfo.currentBranch;
		baseBranch = branchInfo.baseBranch;
	}

	return { currentBranch, baseBranch };
}

async function performLocalReview(currentBranch, baseBranch, llmChoice, outputFormat = 'html') {
	try {
		// Validate inputs
		validateLocalOutputFormat(outputFormat);

		const availableLlms = await getAvailableLlms();
		validateLlmChoice(llmChoice, availableLlms);

		// Validate git repository
		await validateGitRepository();

		// Get branch information
		const branchInfo = await getBranchInfo(currentBranch, baseBranch);
		console.log(`Comparing ${branchInfo.currentBranch} (${branchInfo.currentSha.slice(0, 8)}) with ${branchInfo.baseBranch} (${branchInfo.baseSha.slice(0, 8)})`);

		// Get diff and changed files
		console.log('Getting local changes...');
		const diff = await getBranchDiff(currentBranch, baseBranch),
			changedFiles = await getChangedFilesLocal(currentBranch, baseBranch);
		console.log(`✓ Found ${changedFiles.length} changed files, diff size: ${diff.length} characters`);

		if (diff.length === 0) {
			console.log('No differences found between branches.');
			return;
		}

		// Read file context
		console.log('Reading changed files for context...');
		const fileContext = await readLocalFilesForContext(changedFiles);
		console.log(`✓ File context prepared, total size: ${fileContext.length} characters`);

		// Run code review
		console.log(`Running ${llmChoice.toUpperCase()} code review...`);
		const startTime = Date.now(),
			review = await runCodeReview(llmChoice, diff, fileContext),
			endTime = Date.now();
		console.log(`✓ ${llmChoice.toUpperCase()} code review completed in ${(endTime - startTime) / 1000}s`);

		const parsedReview = parseReviewResponse(review, llmChoice);

		// Handle output (no GitLab params for local)
		await handleOutput(outputFormat, parsedReview, llmChoice, null);
	} catch (error) {
		console.error('\nAn error occurred:', error.message);
		process.exit(1);
	}
}

async function performReview(mrUrl, llmChoice, outputFormat = 'gitlab') {
	let temporaryDirectory = null;

	try {
		// Validate inputs
		validateEnvironment();
		validateOutputFormat(outputFormat);

		const availableLlms = await getAvailableLlms();
		validateLlmChoice(llmChoice, availableLlms);

		const { gitlabUrl, projectId, mergeRequestIid } = parseGitLabUrl(mrUrl);

		// Check for unresolved discussions
		await checkUnresolvedDiscussions(gitlabUrl, projectId, mergeRequestIid);

		// Get MR details and setup repository
		const mrData = await setupMergeRequestData(gitlabUrl, projectId, mergeRequestIid);

		// Clone and analyze repository
		temporaryDirectory = await setupRepository(mrData.cloneUrl, mrData.sourceBranch);
		const analysisData = await analyzeRepository(gitlabUrl, projectId, mergeRequestIid, temporaryDirectory);

		// Run code review
		console.log(`Running ${llmChoice.toUpperCase()} code review...`);
		const startTime = Date.now(),
			review = await runCodeReview(llmChoice, analysisData.diff, analysisData.fileContext),
			endTime = Date.now();
		console.log(`✓ ${llmChoice.toUpperCase()} code review completed in ${(endTime - startTime) / 1000}s`);

		const parsedReview = parseReviewResponse(review, llmChoice),

			// Handle output
			gitlabParameters = {
				gitlabUrl,
				projectId,
				mergeRequestIid,
				baseSha: mrData.baseSha,
				startSha: mrData.startSha,
				headSha: mrData.headSha,
			};

		await handleOutput(outputFormat, parsedReview, llmChoice, gitlabParameters);
	} catch (error) {
		console.error('\nAn error occurred:', error.message);
		process.exit(1);
	} finally {
		if (temporaryDirectory) {
			await cleanupDirectory(temporaryDirectory);
		}
	}
}

async function checkUnresolvedDiscussions(gitlabUrl, projectId, mergeRequestIid) {
	console.log('Checking for unresolved discussions...');
	const unresolvedDiscussions = await getUnresolvedDiscussions(gitlabUrl, projectId, mergeRequestIid);

	if (unresolvedDiscussions.length > 0) {
		console.log(`\n❌ Cannot proceed with code review:`);
		console.log(`Found ${unresolvedDiscussions.length} unresolved discussion(s) on this MR.`);
		console.log(`\nPlease resolve all discussions before running the code review.`);
		console.log(`\nUnresolved discussions:`);

		for (const [index, discussion] of unresolvedDiscussions.entries()) {
			const firstNote = discussion.notes[0],
				author = firstNote.author.name,
				snippet = firstNote.body.slice(0, 100) + (firstNote.body.length > 100 ? '...' : '');
			console.log(`  ${index + 1}. By ${author}: ${snippet}`);
		}

		throw new Error('Unresolved discussions found');
	}

	console.log(`✓ No unresolved discussions found`);
}

async function setupMergeRequestData(gitlabUrl, projectId, mergeRequestIid) {
	console.log(`Fetching details for MR !${mergeRequestIid} in project ${projectId}...`);

	const mrDetails = await getMergeRequestDetails(gitlabUrl, projectId, mergeRequestIid),
		sourceBranch = mrDetails.source_branch,
		baseSha = mrDetails.diff_refs.base_sha,
		startSha = mrDetails.diff_refs.start_sha,
		headSha = mrDetails.diff_refs.head_sha;

	console.log(`✓ Found MR: "${mrDetails.title}" on branch "${sourceBranch}"`);
	console.log(`✓ SHA references - base: ${baseSha.slice(0, 8)}, start: ${startSha.slice(0, 8)}, head: ${headSha.slice(0, 8)}`);

	const cloneUrl = await getProjectCloneUrl(gitlabUrl, projectId);

	return {
		mrDetails,
		sourceBranch,
		baseSha,
		startSha,
		headSha,
		cloneUrl,
	};
}

async function setupRepository(cloneUrl, sourceBranch) {
	const temporaryDirectory = await createTemporaryDirectory();
	console.log(`✓ Created temporary directory: ${temporaryDirectory}`);

	console.log(`Cloning repository into ${temporaryDirectory}...`);
	await cloneRepository(cloneUrl, sourceBranch, temporaryDirectory);
	console.log('✓ Repository cloned successfully');

	return temporaryDirectory;
}

async function analyzeRepository(gitlabUrl, projectId, mergeRequestIid, temporaryDirectory) {
	console.log('Fetching MR diff and changed files...');
	const diff = await getMergeRequestDiff(gitlabUrl, projectId, mergeRequestIid),
		changedFiles = await getChangedFiles(gitlabUrl, projectId, mergeRequestIid);
	console.log(`✓ Found ${changedFiles.length} changed files, diff size: ${diff.length} characters`);

	console.log('Reading changed files for context...');
	const fileContext = await readFilesForContext(changedFiles, temporaryDirectory);
	console.log(`✓ File context prepared, total size: ${fileContext.length} characters`);

	return {
		diff,
		fileContext,
		changedFiles,
	};
}

// Commander CLI setup
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
			const availableLlms = await getAvailableLlms();
			if (availableLlms.length === 0) {
				console.log('No LLM binaries found. Please install one of: claude, gemini, openai, ollama, chatgpt, llama, or gh (for copilot)');
			} else {
				console.log('Available LLM providers:');
				for (const llm of availableLlms) {
					console.log(`  - ${llm}`);
				}
			}
			return;
		}

		// Determine review mode
		let reviewMode = options.mode;
		if (!process.argv.includes('--mode') && !process.argv.includes('-m')) {
			reviewMode = await promptForReviewMode();
		}

		try {
			validateReviewMode(reviewMode);
		} catch (error) {
			console.error('Error:', error.message);
			process.exit(1);
		}

		if (reviewMode === 'local') {
			// Local branch review
			let currentBranch, baseBranch;

			try {
				const branchInfo = await determineBranchesForLocalReview(urlOrBranch, options);
				currentBranch = branchInfo.currentBranch;
				baseBranch = branchInfo.baseBranch;
			} catch (error) {
				console.error('Error:', error.message);
				process.exit(1);
			}

			// Prompt for LLM if not provided
			let llmProvider = options.llm;
			if (!process.argv.includes('--llm') && !process.argv.includes('-l')) {
				llmProvider = await promptForLlm();
			}

			// Prompt for output format if not provided
			let outputFormat = options.output;
			if (!process.argv.includes('--output') && !process.argv.includes('-o')) {
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
		} else {
			// GitLab MR review
			let url = urlOrBranch;
			if (!url || !url.startsWith('http')) {
				url = await promptForUrl();
				if (!url) {
					console.error('Error: GitLab MR URL is required');
					process.exit(1);
				}
			}

			// Prompt for LLM if not provided
			let llmProvider = options.llm;
			if (!process.argv.includes('--llm') && !process.argv.includes('-l')) {
				llmProvider = await promptForLlm();
			}

			// Prompt for output format if not provided
			let outputFormat = options.output;
			if (!process.argv.includes('--output') && !process.argv.includes('-o')) {
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

			await performReview(url, llmProvider, outputFormat);
		}
	});

// Add a separate command for listing LLMs
program
	.command('list-llms')
	.description('List available LLM providers')
	.action(async() => {
		const availableLlms = await getAvailableLlms();
		if (availableLlms.length === 0) {
			console.log('No LLM binaries found. Please install one of: claude, gemini, openai, ollama, chatgpt, llama, or gh (for copilot)');
		} else {
			console.log('Available LLM providers:');
			for (const llm of availableLlms) {
				console.log(`  - ${llm}`);
			}
		}
	});

// Interactive mode when no arguments provided
if (process.argv.length === 2) {
	const reviewMode = await promptForReviewMode();

	if (reviewMode === 'local') {
		const branchInfo = await promptForBranches(),
			llmProvider = await promptForLlm(),
			outputFormat = await promptForOutputFormat(true);
		await performLocalReview(branchInfo.currentBranch, branchInfo.baseBranch, llmProvider, outputFormat);
	} else {
		const url = await promptForUrl();
		if (!url) {
			console.error('Error: GitLab MR URL is required');
			process.exit(1);
		}
		const llmProvider = await promptForLlm(),
			outputFormat = await promptForOutputFormat(false);
		await performReview(url, llmProvider, outputFormat);
	}
} else {
	program.parse();
}
