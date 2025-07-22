/**
 * Advanced code snippet extractor with intelligent line matching for HTML reports
 */

export function extractCodeSnippet(fileContent, lineNumber, contextLines = 3) {
	if (!fileContent || !lineNumber || lineNumber < 1 || !Number.isInteger(lineNumber) || contextLines < 0) {
		return null;
	}

	const lines = fileContent.split('\n');
	let targetLineIndex = lineNumber - 1; // Convert to 0-based index

	if (targetLineIndex >= lines.length) {
		return null;
	}

	// Use intelligent line matching to find the most relevant code
	const bestMatch = findBestCodeMatch(lines, targetLineIndex, 5);
	const adjustedLineNumber = bestMatch.lineIndex + 1;
	const wasAdjusted = bestMatch.lineIndex !== targetLineIndex;

	// Calculate snippet bounds with intelligent context
	const bounds = calculateSmartBounds(lines, bestMatch.lineIndex, contextLines);

	// Extract the snippet with context
	const snippetLines = [];
	for (let index = bounds.start; index <= bounds.end; index++) {
		snippetLines.push({
			lineNumber: index + 1,
			content: lines[index] || '',
			isTarget: index === bestMatch.lineIndex,
		});
	}

	return {
		startLine: bounds.start + 1,
		endLine: bounds.end + 1,
		targetLine: adjustedLineNumber,
		originalTargetLine: lineNumber,
		adjusted: wasAdjusted,
		adjustmentReason: bestMatch.reason,
		confidence: bestMatch.confidence,
		lines: snippetLines,
	};
}

/**
 * Finds the best matching line using multiple strategies
 * @param {string[]} lines - File lines
 * @param {number} originalIndex - Original line index (0-based)
 * @param {number} searchRange - Search range around original position
 * @returns {Object} Best match with line index, reason, and confidence
 */
function findBestCodeMatch(lines, originalIndex, searchRange = 5) {
	const originalLine = lines[originalIndex];
	
	// If original line has meaningful content, use it
	if (originalLine && isSignificantCode(originalLine)) {
		return {
			lineIndex: originalIndex,
			reason: null,
			confidence: 1.0
		};
	}

	// Strategy 1: Look for specific code patterns based on common issues
	const patternMatch = findPatternMatch(lines, originalIndex, searchRange);
	if (patternMatch) {
		return patternMatch;
	}

	// Strategy 2: Find nearest significant code
	const significantMatch = findNearestSignificantCode(lines, originalIndex, searchRange);
	if (significantMatch) {
		return significantMatch;
	}

	// Strategy 3: Look for logical code blocks (functions, classes, etc.)
	const blockMatch = findRelevantCodeBlock(lines, originalIndex, searchRange);
	if (blockMatch) {
		return blockMatch;
	}

	// Fallback: Return original position
	return {
		lineIndex: originalIndex,
		reason: 'No better match found',
		confidence: 0.3
	};
}

/**
 * Finds lines matching common vulnerability/issue patterns
 */
function findPatternMatch(lines, originalIndex, searchRange) {
	const start = Math.max(0, originalIndex - searchRange);
	const end = Math.min(lines.length - 1, originalIndex + searchRange);

	const patterns = [
		// Date/time parsing issues
		{
			regex: /DateTime::createFromFormat|date_create_from_format|\$.*\-\>format\(/i,
			reason: 'Found date parsing code',
			confidence: 0.95
		},
		// Email/security vulnerabilities  
		{
			regex: /mail\(|setFrom|setBcc|setTo|@.*\..*['"]/i,
			reason: 'Found email handling code',
			confidence: 0.9
		},
		// SQL injection patterns
		{
			regex: /\$.*query.*\$|\$.*sql.*\$|mysql_query|executeQuery/i,
			reason: 'Found SQL query code',
			confidence: 0.9
		},
		// Array operations that can fail
		{
			regex: /array_combine|array_merge|array_intersect/i,
			reason: 'Found array operation code',
			confidence: 0.9
		},
		// File operations
		{
			regex: /file_get_contents|fopen|include.*\$|require.*\$/i,
			reason: 'Found file operation code',
			confidence: 0.85
		},
		// Input validation issues
		{
			regex: /\$_GET|\$_POST|\$_REQUEST|filter_var|htmlspecialchars/i,
			reason: 'Found input handling code',
			confidence: 0.8
		},
		// Configuration/hardcoded values
		{
			regex: /['"].*@.*\..*['"]|['"]http[s]?:\/\/|define\(|const\s+\w+\s*=/i,
			reason: 'Found configuration/hardcoded values',
			confidence: 0.85
		}
	];

	for (let i = start; i <= end; i++) {
		const line = lines[i];
		if (!line) continue;

		for (const pattern of patterns) {
			if (pattern.regex.test(line)) {
				return {
					lineIndex: i,
					reason: pattern.reason,
					confidence: pattern.confidence
				};
			}
		}
	}

	return null;
}

/**
 * Finds the nearest line with significant code content
 */
function findNearestSignificantCode(lines, originalIndex, searchRange) {
	const start = Math.max(0, originalIndex - searchRange);
	const end = Math.min(lines.length - 1, originalIndex + searchRange);

	// Search backwards first (more likely to find the relevant code)
	for (let i = originalIndex - 1; i >= start; i--) {
		if (isSignificantCode(lines[i])) {
			return {
				lineIndex: i,
				reason: 'Found significant code above',
				confidence: 0.7
			};
		}
	}

	// Then search forwards
	for (let i = originalIndex + 1; i <= end; i++) {
		if (isSignificantCode(lines[i])) {
			return {
				lineIndex: i,
				reason: 'Found significant code below',
				confidence: 0.6
			};
		}
	}

	return null;
}

/**
 * Finds relevant code blocks (function declarations, class methods, etc.)
 */
function findRelevantCodeBlock(lines, originalIndex, searchRange) {
	const start = Math.max(0, originalIndex - searchRange);
	const end = Math.min(lines.length - 1, originalIndex + searchRange);

	const blockPatterns = [
		// Function/method declarations
		/^\s*(public|private|protected|function|def)\s+\w+/i,
		// Class declarations  
		/^\s*(class|interface|trait)\s+\w+/i,
		// Important statements
		/^\s*(if|for|while|switch|try|catch)\s*\(/i,
		// Variable assignments with significance
		/^\s*\$\w+\s*=.*[;}]\s*$/
	];

	for (let i = start; i <= end; i++) {
		const line = lines[i];
		if (!line) continue;

		for (const pattern of blockPatterns) {
			if (pattern.test(line)) {
				return {
					lineIndex: i,
					reason: 'Found relevant code block',
					confidence: 0.75
				};
			}
		}
	}

	return null;
}

/**
 * Determines if a line contains significant code (not just comments/whitespace)
 */
function isSignificantCode(line) {
	if (!line || typeof line !== 'string') {
		return false;
	}

	const trimmed = line.trim();
	
	// Empty lines
	if (!trimmed) {
		return false;
	}

	// Comment-only lines (various languages)
	if (/^(\/\/|#|\*|\/\*|\*\/|<!--)/.test(trimmed)) {
		return false;
	}

	// DocBlock/PHPDoc lines
	if (/^\s*\*\s*(@\w+|$)/.test(line)) {
		return false;
	}

	// Closing braces only
	if (/^[\s})\];]*$/.test(trimmed)) {
		return false;
	}

	// Opening braces only
	if (/^[\s{(,]*$/.test(trimmed)) {
		return false;
	}

	// Has actual code content
	return true;
}

/**
 * Calculates smart bounds for code context, ensuring logical grouping
 */
function calculateSmartBounds(lines, targetIndex, contextLines) {
	let start = Math.max(0, targetIndex - contextLines);
	let end = Math.min(lines.length - 1, targetIndex + contextLines);

	// Extend context to include complete logical blocks
	start = expandContextBackward(lines, start, targetIndex);
	end = expandContextForward(lines, end, targetIndex);

	return { start, end };
}

/**
 * Expands context backward to include complete statements/blocks
 */
function expandContextBackward(lines, start, targetIndex) {
	// Look for function/method start
	for (let i = start; i >= Math.max(0, targetIndex - 10); i--) {
		const line = lines[i];
		if (line && /^\s*(public|private|protected|function|def)\s+\w+/i.test(line)) {
			return i;
		}
	}

	// Look for complete statement start
	for (let i = start; i >= Math.max(0, targetIndex - 5); i--) {
		const line = lines[i];
		if (line && line.trim() && !line.trim().startsWith('*') && !line.trim().startsWith('//')) {
			// Check if this looks like start of a statement
			if (/^\s*\$\w+|^\s*(if|for|while|switch|try)\s*\(/i.test(line)) {
				return i;
			}
		}
	}

	return start;
}

/**
 * Expands context forward to include complete statements/blocks
 */
function expandContextForward(lines, end, targetIndex) {
	// Look for end of current block/function
	let braceLevel = 0;
	let foundOpenBrace = false;

	for (let i = targetIndex; i <= Math.min(lines.length - 1, targetIndex + 10); i++) {
		const line = lines[i];
		if (!line) continue;

		// Count braces to find block end
		for (const char of line) {
			if (char === '{') {
				braceLevel++;
				foundOpenBrace = true;
			} else if (char === '}') {
				braceLevel--;
				if (foundOpenBrace && braceLevel <= 0) {
					return Math.min(end + 2, i + 1); // Include closing brace + 1 line
				}
			}
		}

		// Look for natural statement endings
		if (line.trim().endsWith(';') || line.trim().endsWith('}')) {
			return Math.max(end, i);
		}
	}

	return end;
}

export function parseFileContents(fileContext) {
	const fileContents = new Map();

	if (!fileContext) {
		return fileContents;
	}

	// Split by file headers and process each file
	const sections = fileContext.split(/^--- (.+?) ---$/gm);

	// Process in pairs: [content, filename, content, filename, ...]
	// Skip first empty section
	for (let index = 1; index < sections.length; index += 2) {
		const fileName = sections[index],
			fileContent = sections[index + 1];

		if (fileName && fileContent) {
			// Clean up the content (remove leading/trailing whitespace but preserve structure)
			const cleanContent = fileContent.replace(/^\n+/, '').replace(/\n+$/, '');
			if (cleanContent) {
				fileContents.set(fileName, cleanContent);
			}
		}
	}

	return fileContents;
}

export function getFileExtension(filePath) {
	const lastDotIndex = filePath.lastIndexOf('.');
	if (lastDotIndex === -1 || lastDotIndex === filePath.length - 1) {
		return '';
	}
	return filePath.slice(Math.max(0, lastDotIndex + 1)).toLowerCase();
}

export function getLanguageFromExtension(extension) {
	const languageMap = {
		js: 'javascript',
		jsx: 'javascript',
		ts: 'typescript',
		tsx: 'typescript',
		py: 'python',
		rb: 'ruby',
		php: 'php',
		java: 'java',
		c: 'c',
		cpp: 'cpp',
		cc: 'cpp',
		cxx: 'cpp',
		h: 'c',
		hpp: 'cpp',
		cs: 'csharp',
		go: 'go',
		rs: 'rust',
		swift: 'swift',
		kt: 'kotlin',
		scala: 'scala',
		sh: 'bash',
		bash: 'bash',
		zsh: 'bash',
		fish: 'bash',
		ps1: 'powershell',
		sql: 'sql',
		html: 'html',
		htm: 'html',
		xml: 'xml',
		css: 'css',
		scss: 'scss',
		sass: 'sass',
		less: 'less',
		json: 'json',
		yaml: 'yaml',
		yml: 'yaml',
		toml: 'toml',
		ini: 'ini',
		conf: 'ini',
		config: 'ini',
		md: 'markdown',
		markdown: 'markdown',
		txt: 'text',
	};

	return languageMap[extension] || 'text';
}