import { getProjectCloneUrl, getMergeRequestDetails, getMergeRequestDiff, getChangedFiles, getUnresolvedDiscussions } from '../api/gitlab.js';
import { cloneRepository } from './git.js';
import { runCodeReview } from './llm.js';
import { createTemporaryDirectory, cleanupDirectory, readFilesForContext } from '../utils/file-handler.js';
import { validateEnvironment, validateLlmChoice, validateOutputFormat, validateLocalOutputFormat, parseGitLabUrl } from './validator.js';
import { parseReviewResponse } from './review-processor.js';
import { handleOutput } from './output-handlers.js';
import { validateGitRepository, getCurrentBranch, getBaseBranch, getBranchDiff, getChangedFilesLocal, readLocalFilesForContext, getBranchInfo } from './local-git.js';
import { getAvailableLlms, isGitLabUrl } from './llm-discovery.js';

export async function determineBranchesForLocalReview(urlOrBranch, options) {
	let currentBranch, baseBranch;

	if (urlOrBranch && !isGitLabUrl(urlOrBranch)) {
		// Treat as branch name
		currentBranch = urlOrBranch;
		baseBranch = options.base || (await getBaseBranch(currentBranch));
	} else if (urlOrBranch) {
		throw new Error('URL provided but local mode selected. Use --mode gitlab for GitLab URLs.');
	} else if (options.base) {
		// Use current branch with provided base
		currentBranch = await getCurrentBranch();
		baseBranch = options.base;
	} else {
		// Use current branch and auto-detect base
		currentBranch = await getCurrentBranch();
		baseBranch = await getBaseBranch(currentBranch);
	}

	return { currentBranch, baseBranch };
}

export async function performLocalReview(currentBranch, baseBranch, llmChoice, outputFormat = 'html') {
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
		await handleOutput(outputFormat, parsedReview, llmChoice, null, fileContext);
	} catch (error) {
		console.error('\nAn error occurred:', error.message);
		process.exit(1);
	}
}

export async function performGitLabReview(mrUrl, llmChoice, outputFormat = 'gitlab') {
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

		await handleOutput(outputFormat, parsedReview, llmChoice, gitlabParameters, analysisData.fileContext);
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
