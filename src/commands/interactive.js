import { Command } from '@oclif/core';
import { promptForReviewMode, promptForUrl, promptForBranches, promptForOutputFormat, promptForLlm } from '../../services/prompts.js';
import { performLocalReview, performGitLabReview } from '../../services/review-orchestrator.js';
import { 
	getForceReviewMode, 
	getForceLlmProvider, 
	getForceOutputFormat, 
	getForceLocalOutputFormat,
	shouldForceValue 
} from '../../services/env-config.js';

export default class Interactive extends Command {
	static description = 'Run in interactive mode with prompts';

	static hidden = true; // Hide from help by default since it's the default behavior

	async run() {
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
				this.error('Error: GitLab MR URL is required', { exit: 1 });
			}
			
			const forceLlm = getForceLlmProvider();
			const llmProvider = shouldForceValue(forceLlm) ? forceLlm : await promptForLlm();
			
			const forceOutput = getForceOutputFormat();
			const outputFormat = shouldForceValue(forceOutput) ? forceOutput : await promptForOutputFormat(false);
			
			await performGitLabReview(url, llmProvider, outputFormat);
		}
	}
}