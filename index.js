import 'dotenv/config';
import readline from 'node:readline';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { getProjectCloneUrl, getMergeRequestDetails, getMergeRequestDiff, getChangedFiles, getUnresolvedDiscussions, postCommentToMergeRequest, postLineCommentToMergeRequest } from './api/gitlab.js';
import { cloneRepository } from './services/git.js';
import { runCodeReview } from './services/llm.js';
import { createTemporaryDirectory, cleanupDirectory, readFilesForContext } from './utils/file-handler.js';
import config from './config.js';

const execPromise = promisify(exec);

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

function parseGitLabUrl(url) {
	try {
		const urlObject = new URL(url),
			pathParts = urlObject.pathname.split('/').filter(Boolean),

			mrIndex = pathParts.indexOf('merge_requests');
		if (mrIndex === -1 || mrIndex + 1 >= pathParts.length) {
			throw new Error('Invalid Merge Request URL format.');
		}

		const mergeRequestIid = Number.parseInt(pathParts[mrIndex + 1]),
			projectPath = pathParts.slice(0, mrIndex - 1).join('/'),
			projectId = encodeURIComponent(projectPath),
			gitlabUrl = urlObject.origin;

		return { gitlabUrl, projectId, mergeRequestIid };
	} catch (error) {
		throw new Error(`Failed to parse GitLab URL: ${error.message}`);
	}
}

async function main() {
	if (!process.env.GITLAB_PRIVATE_TOKEN) {
		throw new Error(
			'GITLAB_PRIVATE_TOKEN environment variable is not set. Please set it to your GitLab private token.',
		);
	}

	let temporaryDirectory = null;
	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	try {
		let mrUrl = process.argv[2],
			llmChoice = process.argv[3];

		if (!mrUrl) {
			mrUrl = await new Promise((resolve) => {
				rl.question('Please enter the GitLab Merge Request URL: ', resolve);
			});
		}

		// Check available LLMs
		const availableLlms = await getAvailableLlms();

		if (availableLlms.length === 0) {
			throw new Error('No LLM binaries found. Please install Claude CLI or Gemini CLI.');
		}

		if (!llmChoice) {
			if (availableLlms.length === 1) {
				llmChoice = availableLlms[0];
				console.log(`Using ${llmChoice} (only available LLM)`);
			} else {
				const availableOptions = availableLlms.join('/'),
					defaultLlm = availableLlms[0];

				llmChoice = await new Promise((resolve) => {
					rl.question(`Choose LLM (${availableOptions}) [default: ${defaultLlm}]: `, resolve);
				});
				if (!llmChoice) {
					llmChoice = defaultLlm;
				}
			}
		}

		if (!availableLlms.includes(llmChoice.toLowerCase())) {
			throw new Error(`Invalid LLM choice "${llmChoice}". Available options: ${availableLlms.join(', ')}`);
		}

		rl.close();

		const { gitlabUrl, projectId, mergeRequestIid } = parseGitLabUrl(mrUrl);

		console.log(`Fetching details for MR !${mergeRequestIid} in project ${projectId}...`);

		const mrDetails = await getMergeRequestDetails(gitlabUrl, projectId, mergeRequestIid),
			sourceBranch = mrDetails.source_branch,
			baseSha = mrDetails.diff_refs.base_sha,
			startSha = mrDetails.diff_refs.start_sha,
			headSha = mrDetails.diff_refs.head_sha;
		console.log(`✓ Found MR: "${mrDetails.title}" on branch "${sourceBranch}"`);
		console.log(`✓ SHA references - base: ${baseSha.slice(0, 8)}, start: ${startSha.slice(0, 8)}, head: ${headSha.slice(0, 8)}`);

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

			return;
		}

		console.log(`✓ No unresolved discussions found`);

		const cloneUrl = await getProjectCloneUrl(gitlabUrl, projectId);
		temporaryDirectory = await createTemporaryDirectory();
		console.log(`✓ Created temporary directory: ${temporaryDirectory}`);

		console.log(`Cloning repository into ${temporaryDirectory}...`);
		await cloneRepository(cloneUrl, sourceBranch, temporaryDirectory);
		console.log('✓ Repository cloned successfully');

		console.log('Fetching MR diff and changed files...');
		const diff = await getMergeRequestDiff(gitlabUrl, projectId, mergeRequestIid),
			changedFiles = await getChangedFiles(gitlabUrl, projectId, mergeRequestIid);
		console.log(`✓ Found ${changedFiles.length} changed files, diff size: ${diff.length} characters`);

		console.log('Reading changed files for context...');
		const fileContext = await readFilesForContext(changedFiles, temporaryDirectory);
		console.log(`✓ File context prepared, total size: ${fileContext.length} characters`);

		console.log(`Running ${llmChoice.toUpperCase()} code review...`);
		const startTime = Date.now(),
			review = await runCodeReview(llmChoice, diff, fileContext),
			endTime = Date.now();
		console.log(`✓ ${llmChoice.toUpperCase()} code review completed in ${(endTime - startTime) / 1000}s`);

		let parsedReview;
		try {
			// Clean up the response - extract JSON from the response
			let cleanedReview = review.trim();

			// First, try to parse as Claude CLI's wrapped response format
			if (llmChoice.toLowerCase() === 'claude' && cleanedReview.startsWith('{') && cleanedReview.includes('"result"')) {
				const wrappedResponse = JSON.parse(cleanedReview);
				if (wrappedResponse.result) {
					cleanedReview = wrappedResponse.result;
				}
			}

			// Look for JSON block markers
			const jsonStart = cleanedReview.indexOf('```json'),
				jsonEnd = cleanedReview.lastIndexOf('```');

			if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
				// Extract JSON from between ```json and ```
				cleanedReview = cleanedReview.slice(jsonStart + 7, jsonEnd).trim();
			} else {
				// Try to find JSON object by looking for { and }
				const firstBrace = cleanedReview.indexOf('{'),
					lastBrace = cleanedReview.lastIndexOf('}');
				if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
					cleanedReview = cleanedReview.slice(firstBrace, lastBrace + 1);
				}
			}

			parsedReview = JSON.parse(cleanedReview);
		} catch {
			console.error(`Failed to parse ${llmChoice} review as JSON. Raw output:`, review);
			throw new Error(`Invalid JSON response from ${llmChoice} CLI.`);
		}

		console.log(`\n--- ${llmChoice.toUpperCase()} Code Review Summary ---\n`);
		console.log(parsedReview.summary);

		console.log(`\nPosting ${parsedReview.comments.length} comments to Merge Request...`);
		let successfulComments = 0,
			failedComments = 0;

		for (const comment of parsedReview.comments) {
			try {
				await postLineCommentToMergeRequest(
					gitlabUrl,
					projectId,
					mergeRequestIid,
					comment.comment,
					comment.file,
					comment.line,
					baseSha,
					startSha,
					headSha,
				);
				console.log(`✓ Posted comment to ${comment.file}:${comment.line}`);
				successfulComments++;
			} catch (commentError) {
				console.error(
					`✗ Failed to post comment to ${comment.file}:${comment.line}:`,
					commentError.message,
				);
				failedComments++;
			}
		}

		console.log(`Comment posting complete: ${successfulComments} successful, ${failedComments} failed`);

		console.log('Posting summary comment...');
		await postCommentToMergeRequest(
			gitlabUrl,
			projectId,
			mergeRequestIid,
			`## ${llmChoice.toUpperCase()} Code Review Summary\n\n${parsedReview.summary}`,
		);
		console.log('✓ Summary comment posted successfully.');
	} catch (error) {
		console.error('\nAn error occurred:', error.message);
		process.exit(1);
	} finally {
		if (temporaryDirectory) {
			await cleanupDirectory(temporaryDirectory);
		}
		rl.close();
	}
}

main();
