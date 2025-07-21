export function parseReviewResponse(review, llmChoice) {
	let parsedReview;
	try {
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

	return parsedReview;
}

export function getReviewStatistics(parsedReview) {
	const totalComments = parsedReview.comments.length,
		blockingIssues = parsedReview.comments.filter(c => c.comment.includes('issue')).length,
		suggestions = parsedReview.comments.filter(c => c.comment.includes('suggestion')).length,
		praiseCount = parsedReview.comments.filter(c => c.comment.includes('praise')).length,
		todoCount = parsedReview.comments.filter(c => c.comment.includes('todo')).length,
		questionCount = parsedReview.comments.filter(c => c.comment.includes('question')).length,
		nitpickCount = parsedReview.comments.filter(c => c.comment.includes('nitpick')).length,
		noteCount = parsedReview.comments.filter(c => c.comment.includes('note')).length;

	return {
		totalComments,
		blockingIssues,
		suggestions,
		praiseCount,
		todoCount,
		questionCount,
		nitpickCount,
		noteCount,
	};
}
