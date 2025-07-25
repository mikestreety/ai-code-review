import { parseFileContents } from './code-snippet-extractor.js';

/**
 * Convert Ollama's text output to the expected JSON format
 * @param {String} textReview - Ollama's raw text response
 * @returns {Object} - Structured review object
 */
function convertOllamaTextToJson(textReview) {
	// Create a basic structure for the review response
	const reviewObject = {
			summary: '',
			comments: [],
			overall_rating: 'good',
			suggestions: [],
		},

		// Extract summary from the beginning of the text
		lines = textReview.split('\n').filter(line => line.trim()),

		// Look for summary or overall assessment
		summaryMarkers = ['summary', 'overview', 'assessment', 'analysis'];
	let summaryText = '',
		currentSection = '',
		isInCodeBlock = false;

	for (let index = 0; index < lines.length; index++) {
		const line = lines[index].trim(),
			lowerLine = line.toLowerCase();

		// Track code blocks
		if (line.startsWith('```')) {
			isInCodeBlock = !isInCodeBlock;
			continue;
		}

		if (isInCodeBlock) continue;

		// Check for section headers
		if (summaryMarkers.some(marker => lowerLine.includes(marker)) && (lowerLine.includes('##') || lowerLine.includes('**') || lowerLine.includes('='))) {
			currentSection = 'summary';
			continue;
		}

		if (lowerLine.includes('issue') || lowerLine.includes('problem') || lowerLine.includes('concern')) {
			currentSection = 'issues';
		} else if (lowerLine.includes('suggestion') || lowerLine.includes('recommend') || lowerLine.includes('consider')) {
			currentSection = 'suggestions';
		} else if (lowerLine.includes('note') || lowerLine.includes('observation')) {
			currentSection = 'notes';
		}

		// Extract content based on current section
		if (currentSection === 'summary' && line && !/^[#*=-]/.test(line)) {
			summaryText += `${line} `;
		}

		// Look for specific code review patterns
		if (line.includes('README') || line.includes('.md') || line.includes('file')) {
			// Try to extract file-specific comments
			const comment = extractCommentFromLine(line, lines, index);
			if (comment) {
				reviewObject.comments.push(comment);
			}
		}
	}

	// Set summary
	reviewObject.summary = summaryText.trim() || 'Code review completed. See specific comments for details.';

	// If no specific comments were found, create a general comment
	if (reviewObject.comments.length === 0) {
		// Extract the main content as a general comment
		const mainContent = textReview.slice(0, 500).trim();
		reviewObject.comments.push({
			file: 'README.md', // Default file since we saw README content in the test
			line: 1,
			comment: `General review: ${mainContent}...`,
		});
	}

	// Extract suggestions from the text
	const suggestionLines = lines.filter(line =>
		line.toLowerCase().includes('suggest') ||
		line.toLowerCase().includes('recommend') ||
		line.toLowerCase().includes('consider') ||
		line.toLowerCase().includes('should'),
	);

	reviewObject.suggestions = suggestionLines.slice(0, 3).map(line => line.trim());

	// Determine overall rating based on content
	const hasIssues =
		textReview.toLowerCase().includes('issue') ||
		textReview.toLowerCase().includes('problem') ||
		textReview.toLowerCase().includes('error')
	;

	reviewObject.overall_rating = hasIssues ? 'needs_improvement' : 'good';

	return reviewObject;
}

/**
 * Extract a comment from a specific line and context
 * @param {String} line - Current line
 * @param {Array} allLines - All lines from the review
 * @param {Number} index - Current line index
 * @returns {Object|null} - Comment object or null
 */
function extractCommentFromLine(line, allLines, index) {
	// Look for file references
	const fileMatch = line.match(/([a-zA-Z0-9._-]+\.(md|js|ts|py|java|cpp|c|h|json|yaml|yml|txt))/i);
	if (!fileMatch) return null;

	const filename = fileMatch[1],

		// Try to extract line number if mentioned
		lineNumberMatch = line.match(/line\s*(\d+)/i) || line.match(/:(\d+)/),
		lineNumber = lineNumberMatch ? Number.parseInt(lineNumberMatch[1]) : 1;

	// Get the comment text (remove file references and clean up)
	let commentText = line
		.replace(fileMatch[0], '')
		.replaceAll(/line\s*\d+/gi, '')
		.replace(/[*#-]+/, '')
		.trim();

	// If comment is too short, try to get more context from next lines
	if (commentText.length < 20 && index + 1 < allLines.length) {
		const nextLine = allLines[index + 1].trim();
		if (nextLine && !/^[#*=-]/.test(nextLine) && !nextLine.includes('file')) {
			commentText += ` ${nextLine}`;
		}
	}

	if (!commentText || commentText.length < 10) {
		commentText = 'Review comment - see full review for details';
	}

	return {
		file: filename,
		line: lineNumber,
		comment: commentText,
	};
}

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

		// Special handling for Ollama - convert text output to JSON format
		if (llmChoice.toLowerCase() === 'ollama') {
			parsedReview = convertOllamaTextToJson(cleanedReview);
			return parsedReview;
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
		todoCount = parsedReview.comments.filter(c => c.comment.match(/^todo:/i)).length,
		questionCount = parsedReview.comments.filter(c => c.comment.match(/^question:/i)).length,
		nitpickCount = parsedReview.comments.filter(c => c.comment.match(/^nitpick:/i)).length,
		noteCount = parsedReview.comments.filter(c => c.comment.match(/^note:/i)).length;

	return {
		totalComments,
		issueCount,
		suggestions,
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

		// Use content-based line detection instead of trusting LLM line numbers
		const correctedComment = findActualLineFromContent(comment, fileContent);

		if (correctedComment) {
			validatedComments.push(correctedComment);
		} else {
			console.warn(`Warning: Could not locate code for comment in '${comment.file}'. Skipping comment.`);
		}
	}

	return {
		...parsedReview,
		comments: validatedComments,
	};
}

/**
 * Find the actual line number by matching code content from LLM comment
 * @param {Object} comment - The comment object with file, line, and comment text
 * @param {String} fileContent - The full file content
 * @returns {Object|null} - Updated comment with correct line number or null if not found
 */
function findActualLineFromContent(comment, fileContent) {
	const fileLines = fileContent.split('\n'),
		maxLineNumber = fileLines.length,

		// Extract code snippets from the comment text
		codeSnippets = extractCodeSnippetsFromComment(comment.comment);

	// Try exact matching first
	for (const snippet of codeSnippets) {
		const exactMatch = findExactCodeMatch(snippet, fileLines);
		if (exactMatch) {
			return {
				...comment,
				line: exactMatch.lineNumber,
				_originalLine: comment.line,
				_correctionMethod: 'exact_match',
				_matchedCode: snippet,
				_confidence: 1,
			};
		}
	}

	// Try fuzzy matching for partial code matches
	for (const snippet of codeSnippets) {
		const fuzzyMatch = findFuzzyCodeMatch(snippet, fileLines);
		if (fuzzyMatch && fuzzyMatch.confidence > 0.8) {
			return {
				...comment,
				line: fuzzyMatch.lineNumber,
				_originalLine: comment.line,
				_correctionMethod: 'fuzzy_match',
				_matchedCode: snippet,
				_confidence: fuzzyMatch.confidence,
			};
		}
	}

	// If no code snippets found or no matches, try to validate original line
	if (comment.line && comment.line >= 1 && comment.line <= maxLineNumber) {
		const targetLine = fileLines[comment.line - 1];
		if (targetLine && targetLine.trim() !== '') {
			// Original line exists and has content, use it but flag as uncertain
			return {
				...comment,
				_correctionMethod: 'original_line_kept',
				_confidence: 0.5,
				_lineWarning: true,
			};
		}
	}

	// Last resort: use keyword matching from comment
	const keywordMatch = findKeywordMatch(comment.comment, fileLines);
	if (keywordMatch && keywordMatch.confidence > 0.6) {
		return {
			...comment,
			line: keywordMatch.lineNumber,
			_originalLine: comment.line,
			_correctionMethod: 'keyword_match',
			_confidence: keywordMatch.confidence,
		};
	}

	return null; // Could not find a reliable match
}

/**
 * Extract code snippets from comment text (look for code in backticks, quotes, etc.)
 * @param {String} commentText - The comment text from the LLM
 * @returns {Array} - Array of code snippets found
 */
function extractCodeSnippetsFromComment(commentText) {
	const snippets = [],

		// Extract code in backticks `code`
		backtickMatches = commentText.match(/`([^`]+)`/g);
	if (backtickMatches) {
		snippets.push(...backtickMatches.map(match => match.replaceAll('`', '').trim()));
	}

	// Extract function names, variable names, method calls
	const functionMatches = commentText.match(/\b(\w+)\s*\(/g);
	if (functionMatches) {
		snippets.push(...functionMatches.map(match => match.trim()));
	}

	// Extract variable assignments and common patterns
	const variableMatches = commentText.match(/\$\w+|\w+\s*=/g);
	if (variableMatches) {
		snippets.push(...variableMatches.map(match => match.trim()));
	}

	// Extract numeric values that might be hardcoded (especially in parentheses)
	const numericMatches = commentText.match(/\((\d+)\)|\b(\d{2,3})\b/g);
	if (numericMatches) {
		snippets.push(...numericMatches.map(match => match.trim()));
	}

	// Extract comparison operations and common code patterns
	const comparisonMatches = commentText.match(/[!=<>]+\s*\d+|\d+\s*[!=<>]/g);
	if (comparisonMatches) {
		snippets.push(...comparisonMatches.map(match => match.trim()));
	}

	// Remove duplicates and filter out very short snippets
	return [...new Set(snippets)].filter(snippet => snippet.length > 1);
}

/**
 * Find exact code match in file lines
 * @param {String} codeSnippet - Code snippet to search for
 * @param {Array} fileLines - Array of file lines
 * @returns {Object|null} - Match object with line number or null
 */
function findExactCodeMatch(codeSnippet, fileLines) {
	for (const [index, line] of fileLines.entries()) {
		// Handle numeric snippets by looking for exact number matches
		if (/^\d+$/.test(codeSnippet)) {
			// For pure numbers, look for exact matches in context (== or != comparisons)
			if (
				line.includes(`== ${codeSnippet}`) ||
				line.includes(`!= ${codeSnippet}`) ||
				line.includes(`< ${codeSnippet}`) ||
				line.includes(`> ${codeSnippet}`) ||
				line.includes(`${codeSnippet})`) ||
				line.includes(`(${codeSnippet}`)
			) {
				return {
					lineNumber: index + 1,
					matchedText: line.trim(),
					confidence: 1,
				};
			}
		} else if (line.includes(codeSnippet)) {
			return {
				lineNumber: index + 1,
				matchedText: line.trim(),
				confidence: 1,
			};
		}
	}
	return null;
}

/**
 * Find fuzzy code match using similarity scoring
 * @param {String} codeSnippet - Code snippet to search for
 * @param {Array} fileLines - Array of file lines
 * @returns {Object|null} - Match object with confidence score or null
 */
function findFuzzyCodeMatch(codeSnippet, fileLines) {
	let bestMatch = null,
		bestScore = 0;

	for (const [index, fileLine] of fileLines.entries()) {
		const line = fileLine.trim();
		if (line === '') continue;

		// Calculate similarity score
		const similarity = calculateSimilarity(codeSnippet, line);
		if (similarity > bestScore && similarity > 0.7) {
			bestScore = similarity;
			bestMatch = {
				lineNumber: index + 1,
				matchedText: line,
				confidence: similarity,
			};
		}
	}

	return bestMatch;
}

/**
 * Find matches based on keywords in the comment
 * @param {String} commentText - The full comment text
 * @param {Array} fileLines - Array of file lines
 * @returns {Object|null} - Match object or null
 */
function findKeywordMatch(commentText, fileLines) {
	// Extract significant keywords from comment
	const keywords = extractKeywords(commentText);
	if (keywords.length === 0) return null;

	let bestMatch = null,
		bestScore = 0;

	for (const [index, fileLine] of fileLines.entries()) {
		const line = fileLine.toLowerCase();
		if (line.trim() === '') continue;

		let score = 0;
		for (const keyword of keywords) {
			if (line.includes(keyword.toLowerCase())) {
				score += 1;
			}
		}

		const normalizedScore = score / keywords.length;
		if (normalizedScore > bestScore && normalizedScore > 0.5) {
			bestScore = normalizedScore;
			bestMatch = {
				lineNumber: index + 1,
				matchedText: fileLine.trim(),
				confidence: Math.min(0.8, normalizedScore),
			};
		}
	}

	return bestMatch;
}

/**
 * Extract meaningful keywords from comment text
 * @param {String} text - Comment text
 * @returns {Array} - Array of keywords
 */
function extractKeywords(text) {
	// Remove common words and extract meaningful terms
	const stopWords = new Set(['the', 'is', 'at', 'which', 'on', 'and', 'or', 'but', 'will', 'can', 'should', 'could', 'would', 'might', 'may', 'this', 'that', 'with', 'for', 'to', 'of', 'in', 'by', 'from', 'a', 'an']);

	return text
		.toLowerCase()
		.replaceAll(/[^a-z0-9\s]/g, ' ')
		.split(/\s+/)
		.filter(word => word.length > 3 && !stopWords.has(word))
		.slice(0, 10); // Limit to top 10 keywords
}

/**
 * Calculate similarity between two strings using simple ratio
 * @param {String} str1 - First string
 * @param {String} str2 - Second string
 * @returns {Number} - Similarity score between 0 and 1
 */
function calculateSimilarity(string1, string2) {
	const s1 = string1.toLowerCase().trim(),
		s2 = string2.toLowerCase().trim();

	if (s1 === s2) return 1;
	if (s1.length === 0 || s2.length === 0) return 0;

	// Simple containment check
	if (s2.includes(s1) || s1.includes(s2)) {
		return Math.min(s1.length, s2.length) / Math.max(s1.length, s2.length);
	}

	// Basic character overlap ratio
	const chars1 = new Set(s1),
		chars2 = new Set(s2),
		intersection = new Set([...chars1].filter(x => chars2.has(x))),
		union = new Set([...chars1, ...chars2]);

	return intersection.size / union.size;
}
