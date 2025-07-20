

import 'dotenv/config'
import readline from 'readline';
import { getProjectCloneUrl, getMergeRequestDetails, getMergeRequestDiff, getChangedFiles, getUnresolvedDiscussions, postCommentToMergeRequest, postLineCommentToMergeRequest } from './api/gitlab.js';
import { cloneRepository } from './services/git.js';
import { runCodeReview } from './services/llm.js';
import { createTempDirectory, cleanupDirectory, readFilesForContext } from './utils/fileHandler.js';

function parseGitLabUrl(url) {
    try {
        const urlObject = new URL(url);
        const pathParts = urlObject.pathname.split('/').filter(p => p);

        const mrIndex = pathParts.findIndex(p => p === 'merge_requests');
        if (mrIndex === -1 || mrIndex + 1 >= pathParts.length) {
            throw new Error('Invalid Merge Request URL format.');
        }

        const mergeRequestIid = parseInt(pathParts[mrIndex + 1], 10);
        const projectPath = pathParts.slice(0, mrIndex -1).join('/');
        const projectId = encodeURIComponent(projectPath);
        const gitlabUrl = urlObject.origin;

        return { gitlabUrl, projectId, mergeRequestIid };
    } catch (error) {
        throw new Error(`Failed to parse GitLab URL: ${error.message}`);
    }
}

async function main() {
  if (!process.env.GITLAB_PRIVATE_TOKEN) {
    throw new Error(
      'GITLAB_PRIVATE_TOKEN environment variable is not set. Please set it to your GitLab private token.'
    );
  }

  let tempDir = null;
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });

  try {
    let mrUrl = process.argv[2];
    let llmChoice = process.argv[3];

    if (!mrUrl) {
        mrUrl = await new Promise(resolve => {
            rl.question('Please enter the GitLab Merge Request URL: ', resolve);
        });
    }

    if (!llmChoice) {
        llmChoice = await new Promise(resolve => {
            rl.question('Choose LLM (gemini/claude) [default: gemini]: ', resolve);
        });
        if (!llmChoice) {
            llmChoice = 'gemini';
        }
    }

    if (!['gemini', 'claude'].includes(llmChoice.toLowerCase())) {
        throw new Error('Invalid LLM choice. Please choose either "gemini" or "claude".');
    }

    rl.close();

    const { gitlabUrl, projectId, mergeRequestIid } = parseGitLabUrl(mrUrl);

    console.log(`Fetching details for MR !${mergeRequestIid} in project ${projectId}...`);

    const mrDetails = await getMergeRequestDetails(gitlabUrl, projectId, mergeRequestIid);
    const sourceBranch = mrDetails.source_branch;
    const baseSha = mrDetails.diff_refs.base_sha;
    const startSha = mrDetails.diff_refs.start_sha;
    const headSha = mrDetails.diff_refs.head_sha;
    console.log(`✓ Found MR: "${mrDetails.title}" on branch "${sourceBranch}"`);
    console.log(`✓ SHA references - base: ${baseSha.substring(0, 8)}, start: ${startSha.substring(0, 8)}, head: ${headSha.substring(0, 8)}`);

    console.log('Checking for unresolved discussions...');
    const unresolvedDiscussions = await getUnresolvedDiscussions(gitlabUrl, projectId, mergeRequestIid);
    
    if (unresolvedDiscussions.length > 0) {
      console.log(`\n❌ Cannot proceed with code review:`);
      console.log(`Found ${unresolvedDiscussions.length} unresolved discussion(s) on this MR.`);
      console.log(`\nPlease resolve all discussions before running the code review.`);
      console.log(`\nUnresolved discussions:`);
      
      unresolvedDiscussions.forEach((discussion, index) => {
        const firstNote = discussion.notes[0];
        const author = firstNote.author.name;
        const snippet = firstNote.body.substring(0, 100) + (firstNote.body.length > 100 ? '...' : '');
        console.log(`  ${index + 1}. By ${author}: ${snippet}`);
      });
      
      return;
    }
    
    console.log(`✓ No unresolved discussions found`);

    const cloneUrl = await getProjectCloneUrl(gitlabUrl, projectId);
    tempDir = await createTempDirectory();
    console.log(`✓ Created temporary directory: ${tempDir}`);
    
    console.log(`Cloning repository into ${tempDir}...`);
    await cloneRepository(cloneUrl, sourceBranch, tempDir);
    console.log('✓ Repository cloned successfully');

    console.log('Fetching MR diff and changed files...');
    const diff = await getMergeRequestDiff(gitlabUrl, projectId, mergeRequestIid);
    const changedFiles = await getChangedFiles(gitlabUrl, projectId, mergeRequestIid);
    console.log(`✓ Found ${changedFiles.length} changed files, diff size: ${diff.length} characters`);

    console.log('Reading changed files for context...');
    const fileContext = await readFilesForContext(changedFiles, tempDir);
    console.log(`✓ File context prepared, total size: ${fileContext.length} characters`);

    console.log(`Running ${llmChoice.toUpperCase()} code review...`);
    const startTime = Date.now();
    const review = await runCodeReview(llmChoice, diff, fileContext);
    const endTime = Date.now();
    console.log(`✓ ${llmChoice.toUpperCase()} code review completed in ${(endTime - startTime) / 1000}s`);

    let parsedReview;
    try {
      // Clean up the response - extract JSON from the response
      let cleanedReview = review.trim();
      
      // Look for JSON block markers
      const jsonStart = cleanedReview.indexOf('```json');
      const jsonEnd = cleanedReview.lastIndexOf('```');
      
      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        // Extract JSON from between ```json and ```
        cleanedReview = cleanedReview.slice(jsonStart + 7, jsonEnd).trim();
      } else {
        // Try to find JSON object by looking for { and }
        const firstBrace = cleanedReview.indexOf('{');
        const lastBrace = cleanedReview.lastIndexOf('}');
        if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
          cleanedReview = cleanedReview.slice(firstBrace, lastBrace + 1);
        }
      }
      
      parsedReview = JSON.parse(cleanedReview);
    } catch (e) {
      console.error(`Failed to parse ${llmChoice} review as JSON. Raw output:`, review);
      throw new Error(`Invalid JSON response from ${llmChoice} CLI.`);
    }

    console.log(`\n--- ${llmChoice.toUpperCase()} Code Review Summary ---\n`);
    console.log(parsedReview.summary);

    console.log(`\nPosting ${parsedReview.comments.length} comments to Merge Request...`);
    let successfulComments = 0;
    let failedComments = 0;
    
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
          headSha
        );
        console.log(`✓ Posted comment to ${comment.file}:${comment.line}`);
        successfulComments++;
      } catch (commentError) {
        console.error(
          `✗ Failed to post comment to ${comment.file}:${comment.line}:`,
          commentError.message
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
      `## ${llmChoice.toUpperCase()} Code Review Summary\n\n${parsedReview.summary}`
    );
    console.log('✓ Summary comment posted successfully.');

  } catch (error) {
    console.error('\nAn error occurred:', error.message);
    process.exit(1);
  } finally {
    if (tempDir) {
      await cleanupDirectory(tempDir);
    }
    rl.close();
  }
}

main();
