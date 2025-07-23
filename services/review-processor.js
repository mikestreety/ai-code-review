import { parseFileContents } from './code-snippet-extractor.js';

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
		issueCount = parsedReview.comments.filter(c => c.comment.match(/^issue:/i)).length,
		suggestions = parsedReview.comments.filter(c => c.comment.match(/^suggestion:/i)).length,
		praiseCount = parsedReview.comments.filter(c => c.comment.match(/^praise:/i)).length,
		todoCount = parsedReview.comments.filter(c => c.comment.match(/^todo:/i)).length,
		questionCount = parsedReview.comments.filter(c => c.comment.match(/^question:/i)).length,
		nitpickCount = parsedReview.comments.filter(c => c.comment.match(/^nitpick:/i)).length,
		noteCount = parsedReview.comments.filter(c => c.comment.match(/^note:/i)).length;

	return {
		totalComments,
		issueCount,
		suggestions,
		praiseCount,
		todoCount,
		questionCount,
		nitpickCount,
		noteCount,
	};
}

export function validateAndFixLineNumbers(parsedReview, fileContext) {
	if (!fileContext || !parsedReview?.comments) {
		return parsedReview;
	}

	const fileContents = parseFileContents(fileContext),
		validatedComments = [];

	for (const comment of parsedReview.comments) {
		const fileContent = fileContents.get(comment.file);

		if (!fileContent) {
			console.warn(`Warning: File '${comment.file}' not found in context. Skipping comment.`);
			continue;
		}

		const fileLines = fileContent.split('\n'),
			maxLineNumber = fileLines.length;

		// Validate line number
		if (!comment.line || comment.line < 1 || comment.line > maxLineNumber) {
			console.warn(`Warning: Invalid line number ${comment.line} for file '${comment.file}' (max: ${maxLineNumber}). Skipping comment.`);
			continue;
		}

		// Check if the line is empty or whitespace only (might indicate a mapping issue)
		const targetLine = fileLines[comment.line - 1];
		if (!targetLine || targetLine.trim() === '') {
			console.warn(`Warning: Line ${comment.line} in '${comment.file}' is empty. This might indicate a line number mapping issue.`);
			// Still include the comment but flag it
			comment._lineWarning = true;
		}

		validatedComments.push(comment);
	}

	return {
		...parsedReview,
		comments: validatedComments,
	};
}
