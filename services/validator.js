export function validateEnvironment() {
	if (!process.env.GITLAB_PRIVATE_TOKEN) {
		throw new Error(
			'GITLAB_PRIVATE_TOKEN environment variable is not set. Please set it to your GitLab private token.',
		);
	}
}

export function validateLlmChoice(llmChoice, availableLlms) {
	if (!llmChoice) {
		throw new Error('LLM choice is required');
	}

	if (!availableLlms.includes(llmChoice.toLowerCase())) {
		throw new Error(`Invalid LLM choice "${llmChoice}". Available options: ${availableLlms.join(', ')}`);
	}
}

export function validateOutputFormat(outputFormat) {
	const validFormats = ['gitlab', 'html', 'cli'];
	if (!validFormats.includes(outputFormat)) {
		throw new Error(`Invalid output format "${outputFormat}". Valid options: ${validFormats.join(', ')}`);
	}
}

export function validateReviewMode(mode) {
	const validModes = ['local', 'gitlab'];
	if (!validModes.includes(mode)) {
		throw new Error(`Invalid review mode "${mode}". Valid options: ${validModes.join(', ')}`);
	}
	
	// Check if GitLab mode is selected but no token is configured
	if (mode === 'gitlab' && !process.env.GITLAB_PRIVATE_TOKEN) {
		throw new Error('GitLab mode requires GITLAB_PRIVATE_TOKEN to be set. Please configure your GitLab token or use local mode.');
	}
}

export function validateLocalOutputFormat(outputFormat) {
	const validFormats = ['html', 'cli'];
	if (!validFormats.includes(outputFormat)) {
		throw new Error(`Invalid output format for local review "${outputFormat}". Valid options: ${validFormats.join(', ')} (GitLab posting not available for local repos)`);
	}
}

export function parseGitLabUrl(url) {
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
