/**
 * Advanced code snippet extractor with intelligent line matching for HTML reports
 * Features dynamic pattern detection and language-aware code analysis
 */

// Cache for language patterns and file analysis
const patternCache = new Map();
const fileAnalysisCache = new Map();
const MAX_CACHE_SIZE = 100;

// Cache cleanup to prevent memory leaks
function cleanupCaches() {
	if (patternCache.size > MAX_CACHE_SIZE) {
		const keysToDelete = Array.from(patternCache.keys()).slice(0, patternCache.size - MAX_CACHE_SIZE);
		keysToDelete.forEach(key => patternCache.delete(key));
	}

	if (fileAnalysisCache.size > MAX_CACHE_SIZE) {
		const keysToDelete = Array.from(fileAnalysisCache.keys()).slice(0, fileAnalysisCache.size - MAX_CACHE_SIZE);
		keysToDelete.forEach(key => fileAnalysisCache.delete(key));
	}
}

export function extractCodeSnippet(fileContent, lineNumber, contextLines = 3, fileName = '') {
	if (!fileContent || !lineNumber || lineNumber < 1 || !Number.isInteger(lineNumber) || contextLines < 0) {
		return null;
	}

	const lines = fileContent.split('\n');
	let targetLineIndex = lineNumber - 1; // Convert to 0-based index

	if (targetLineIndex >= lines.length) {
		return null;
	}

	// Use intelligent line matching to find the most relevant code
	const bestMatch = findBestCodeMatch(lines, targetLineIndex, 5, fileName);
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
function findBestCodeMatch(lines, originalIndex, searchRange = 5, fileName = '') {
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
	const patternMatch = findPatternMatch(lines, originalIndex, searchRange, fileName);
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
 * Dynamically finds lines matching common vulnerability/issue patterns based on language
 * Uses intelligent pattern detection and caching for performance
 */
function findPatternMatch(lines, originalIndex, searchRange, fileName = '') {
	const start = Math.max(0, originalIndex - searchRange);
	const end = Math.min(lines.length - 1, originalIndex + searchRange);

	// Get language-specific patterns with caching
	const language = detectLanguageFromContent(lines, fileName);
	const patterns = getLanguagePatterns(language, lines);

	if (!patterns || patterns.length === 0) {
		return null;
	}

	// Search for pattern matches with distance weighting
	let bestMatch = null;
	let bestScore = 0;

	for (let i = start; i <= end; i++) {
		const line = lines[i];
		if (!line) continue;

		for (const pattern of patterns) {
			if (pattern.regex.test(line)) {
				// Calculate score based on confidence and distance from original
				const distance = Math.abs(i - originalIndex);
				const distancePenalty = distance * 0.1;
				const score = pattern.confidence - distancePenalty;

				if (score > bestScore) {
					bestScore = score;
					bestMatch = {
						lineIndex: i,
						reason: pattern.reason,
						confidence: Math.max(0.1, score)
					};
				}
			}
		}
	}

	return bestMatch;
}

/**
 * Detects programming language from file content and name
 */
function detectLanguageFromContent(lines, fileName = '') {
	// Check cache first
	const cacheKey = `${fileName}:${lines.length}`;
	if (fileAnalysisCache.has(cacheKey)) {
		return fileAnalysisCache.get(cacheKey);
	}

	let language = 'unknown';

	// First try file extension
	if (fileName) {
		const ext = getFileExtension(fileName);
		const langFromExt = getLanguageFromExtension(ext);
		if (langFromExt !== 'text') {
			language = langFromExt;
		}
	}

	// If still unknown, analyze content patterns
	if (language === 'unknown') {
		language = detectLanguageFromSyntax(lines);
	}

	// Cache the result
	fileAnalysisCache.set(cacheKey, language);
	return language;
}

/**
 * Detects language from syntax patterns in code
 */
function detectLanguageFromSyntax(lines) {
	const sampleLines = lines.slice(0, Math.min(50, lines.length)).join('\n');

	// Language indicators with confidence scores
	const indicators = [
		{ pattern: /\$[a-zA-Z_][\w]*/, language: 'php', weight: 3 },
		{ pattern: /def\s+\w+\s*\(/, language: 'python', weight: 4 },
		{ pattern: /import\s+\w+|from\s+\w+\s+import/, language: 'python', weight: 3 },
		{ pattern: /function\s+\w+\s*\(|const\s+\w+\s*=|let\s+\w+\s*=/, language: 'javascript', weight: 3 },
		{ pattern: /class\s+\w+\s*<|def\s+\w+|end\b/, language: 'ruby', weight: 4 },
		{ pattern: /public\s+class|private\s+\w+|import\s+java/, language: 'java', weight: 4 },
		{ pattern: /fn\s+\w+|let\s+mut|use\s+std::/, language: 'rust', weight: 4 },
		{ pattern: /func\s+\w+|package\s+\w+|import\s+"/, language: 'go', weight: 4 },
	];

	let scores = {};

	for (const { pattern, language, weight } of indicators) {
		const matches = (sampleLines.match(pattern) || []).length;
		scores[language] = (scores[language] || 0) + matches * weight;
	}

	// Return language with highest score, or 'unknown'
	const maxLang = Object.keys(scores).reduce((a, b) => scores[a] > scores[b] ? a : b, 'unknown');
	return scores[maxLang] > 0 ? maxLang : 'unknown';
}

/**
 * Gets language-specific patterns with intelligent caching
 */
function getLanguagePatterns(language, lines) {
	const cacheKey = `patterns:${language}`;

	if (patternCache.has(cacheKey)) {
		return patternCache.get(cacheKey);
	}

	const patterns = generateLanguagePatterns(language, lines);
	patternCache.set(cacheKey, patterns);

	return patterns;
}

/**
 * Generates dynamic patterns based on language and content analysis
 */
function generateLanguagePatterns(language, lines) {
	const basePatterns = getBasePatterns(language);
	const contentPatterns = analyzeContentForPatterns(lines, language);

	return [...basePatterns, ...contentPatterns];
}

/**
 * Base patterns for different programming languages
 */
function getBasePatterns(language) {
	const patterns = {
		php: [
			{ regex: /\$[a-zA-Z_][\w]*\s*=.*['\"].*['\"]/, reason: 'Variable assignment', confidence: 0.7 },
			{ regex: /function\s+\w+\s*\(/, reason: 'Function definition', confidence: 0.8 },
			{ regex: /class\s+\w+/, reason: 'Class definition', confidence: 0.8 },
			{ regex: /if\s*\(.*\$/, reason: 'Conditional with variable', confidence: 0.7 },
			{ regex: /\-\>\w+\s*\(/, reason: 'Method call', confidence: 0.7 },
		],
		python: [
			{ regex: /def\s+\w+\s*\(/, reason: 'Function definition', confidence: 0.8 },
			{ regex: /class\s+\w+\s*\(?\w*\)?:/, reason: 'Class definition', confidence: 0.8 },
			{ regex: /if\s+.*:/, reason: 'Conditional statement', confidence: 0.7 },
			{ regex: /for\s+\w+\s+in\s+/, reason: 'For loop', confidence: 0.7 },
			{ regex: /import\s+\w+|from\s+\w+\s+import/, reason: 'Import statement', confidence: 0.6 },
		],
		javascript: [
			{ regex: /function\s+\w+\s*\(|const\s+\w+\s*=\s*\(/, reason: 'Function definition', confidence: 0.8 },
			{ regex: /class\s+\w+/, reason: 'Class definition', confidence: 0.8 },
			{ regex: /if\s*\(.*\)/, reason: 'Conditional statement', confidence: 0.7 },
			{ regex: /\.\w+\s*\(/, reason: 'Method call', confidence: 0.6 },
			{ regex: /require\s*\(|import\s+.*from/, reason: 'Module import', confidence: 0.6 },
		],
		ruby: [
			{ regex: /def\s+\w+/, reason: 'Method definition', confidence: 0.8 },
			{ regex: /class\s+\w+/, reason: 'Class definition', confidence: 0.8 },
			{ regex: /if\s+.*/, reason: 'Conditional statement', confidence: 0.7 },
			{ regex: /\w+\.each\s+do|\w+\.map\s+do/, reason: 'Iterator block', confidence: 0.7 },
			{ regex: /require\s+['\"]/, reason: 'Require statement', confidence: 0.6 },
		],
		java: [
			{ regex: /public\s+class\s+\w+|private\s+class\s+\w+/, reason: 'Class definition', confidence: 0.8 },
			{ regex: /public\s+\w+\s+\w+\s*\(|private\s+\w+\s+\w+\s*\(/, reason: 'Method definition', confidence: 0.8 },
			{ regex: /if\s*\(.*\)/, reason: 'Conditional statement', confidence: 0.7 },
			{ regex: /for\s*\(.*\)/, reason: 'For loop', confidence: 0.7 },
			{ regex: /import\s+[\w.]+;/, reason: 'Import statement', confidence: 0.6 },
		],
	};

	return patterns[language] || patterns.javascript; // Fallback to JavaScript patterns
}

/**
 * Analyzes file content to discover project-specific patterns
 */
function analyzeContentForPatterns(lines, language) {
	const patterns = [];
	const functionNames = new Set();
	const classNames = new Set();
	const variablePatterns = new Set();

	for (const line of lines.slice(0, Math.min(100, lines.length))) {
		if (!line || line.trim().length === 0) continue;

		// Extract function names
		const funcMatch = line.match(/(?:function|def|fn)\s+(\w+)/i);
		if (funcMatch) {
			functionNames.add(funcMatch[1]);
		}

		// Extract class names
		const classMatch = line.match(/class\s+(\w+)/i);
		if (classMatch) {
			classNames.add(classMatch[1]);
		}

		// Extract variable patterns based on language
		if (language === 'php') {
			const varMatch = line.match(/\$(\w+)/g);
			if (varMatch) {
				varMatch.forEach(v => variablePatterns.add(v));
			}
		}
	}

	// Generate patterns from discovered elements
	functionNames.forEach(name => {
		patterns.push({
			regex: new RegExp(`\\b${name}\\s*\\(`, 'i'),
			reason: `Call to function '${name}'`,
			confidence: 0.75
		});
	});

	classNames.forEach(name => {
		patterns.push({
			regex: new RegExp(`\\b${name}\\b`, 'i'),
			reason: `Reference to class '${name}'`,
			confidence: 0.7
		});
	});

	return patterns;
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

// Export cache cleanup function for external use
export function clearPatternCaches() {
	patternCache.clear();
	fileAnalysisCache.clear();
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
