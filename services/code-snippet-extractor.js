/**
 * Advanced code snippet extractor with intelligent line matching for HTML reports
 * Features dynamic pattern detection and language-aware code analysis
 */

// Cache for language patterns and file analysis
const patternCache = new Map(),
	fileAnalysisCache = new Map();

export function extractCodeSnippet(fileContent, lineNumber, contextLines = 3, fileName = '') {
	if (!fileContent || !lineNumber || lineNumber < 1 || !Number.isInteger(lineNumber) || contextLines < 0) {
		return null;
	}

	const lines = fileContent.split('\n'),
		targetLineIndex = lineNumber - 1; // Convert to 0-based index

	if (targetLineIndex >= lines.length) {
		return null;
	}

	// Use intelligent line matching to find the most relevant code
	const bestMatch = findBestCodeMatch(lines, targetLineIndex, 5, fileName),
		adjustedLineNumber = bestMatch.lineIndex + 1,
		wasAdjusted = bestMatch.lineIndex !== targetLineIndex,

		// Calculate snippet bounds with intelligent context
		bounds = calculateSmartBounds(lines, bestMatch.lineIndex, contextLines),

		// Extract the snippet with context
		snippetLines = [];
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
			confidence: 1,
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
		confidence: 0.3,
	};
}

/**
 * Dynamically finds lines matching common vulnerability/issue patterns based on language
 * Uses intelligent pattern detection and caching for performance
 */
function findPatternMatch(lines, originalIndex, searchRange, fileName = '') {
	const start = Math.max(0, originalIndex - searchRange),
		end = Math.min(lines.length - 1, originalIndex + searchRange),

		// Get language-specific patterns with caching
		language = detectLanguageFromContent(lines, fileName),
		patterns = getLanguagePatterns(language, lines);

	if (!patterns || patterns.length === 0) {
		return null;
	}

	// Search for pattern matches with distance weighting
	let bestMatch = null,
		bestScore = 0;

	for (let index = start; index <= end; index++) {
		const line = lines[index];
		if (!line) continue;

		for (const pattern of patterns) {
			if (pattern.regex.test(line)) {
				// Calculate score based on confidence and distance from original
				const distance = Math.abs(index - originalIndex),
					distancePenalty = distance * 0.1,
					score = pattern.confidence - distancePenalty;

				if (score > bestScore) {
					bestScore = score;
					bestMatch = {
						lineIndex: index,
						reason: pattern.reason,
						confidence: Math.max(0.1, score),
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
		const extension = getFileExtension(fileName),
			langFromExtension = getLanguageFromExtension(extension);
		if (langFromExtension !== 'text') {
			language = langFromExtension;
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
	const sampleLines = lines.slice(0, Math.min(50, lines.length)).join('\n'),

		// Language indicators with confidence scores
		indicators = [
			{ pattern: /\$[a-zA-Z_][\w]*/, language: 'php', weight: 3 },
			{ pattern: /def\s+\w+\s*\(/, language: 'python', weight: 4 },
			{ pattern: /import\s+\w+|from\s+\w+\s+import/, language: 'python', weight: 3 },
			{ pattern: /function\s+\w+\s*\(|const\s+\w+\s*=|let\s+\w+\s*=/, language: 'javascript', weight: 3 },
			{ pattern: /class\s+\w+\s*<|def\s+\w+|end\b/, language: 'ruby', weight: 4 },
			{ pattern: /public\s+class|private\s+\w+|import\s+java/, language: 'java', weight: 4 },
			{ pattern: /fn\s+\w+|let\s+mut|use\s+std::/, language: 'rust', weight: 4 },
			{ pattern: /func\s+\w+|package\s+\w+|import\s+"/, language: 'go', weight: 4 },
		],

		scores = {};

	for (const { pattern, language, weight } of indicators) {
		const matches = (sampleLines.match(pattern) || []).length;
		scores[language] = (scores[language] || 0) + matches * weight;
	}

	// Return language with highest score, or 'unknown'
	let maxLang = 'unknown',
		maxScore = 0;
	for (const lang of Object.keys(scores)) {
		if (scores[lang] > maxScore) {
			maxScore = scores[lang];
			maxLang = lang;
		}
	}
	return maxScore > 0 ? maxLang : 'unknown';
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
	const basePatterns = getBasePatterns(language),
		contentPatterns = analyzeContentForPatterns(lines, language);

	return [...basePatterns, ...contentPatterns];
}

/**
 * Base patterns for different programming languages
 */
function getBasePatterns(language) {
	const patterns = {
		php: [
			{ regex: /\$[a-zA-Z_][\w]*\s*=.*['"].*['"]/, reason: 'Variable assignment', confidence: 0.7 },
			{ regex: /function\s+\w+\s*\(/, reason: 'Function definition', confidence: 0.8 },
			{ regex: /class\s+\w+/, reason: 'Class definition', confidence: 0.8 },
			{ regex: /if\s*\(.*\$/, reason: 'Conditional with variable', confidence: 0.7 },
			{ regex: /->\w+\s*\(/, reason: 'Method call', confidence: 0.7 },
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
			{ regex: /require\s+['"]/, reason: 'Require statement', confidence: 0.6 },
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
	const patterns = [],
		functionNames = new Set(),
		classNames = new Set(),
		variablePatterns = new Set();

	for (const line of lines.slice(0, Math.min(100, lines.length))) {
		if (!line || line.trim().length === 0) continue;

		// Extract function names
		const functionMatch = line.match(/(?:function|def|fn)\s+(\w+)/i);
		if (functionMatch) {
			functionNames.add(functionMatch[1]);
		}

		// Extract class names
		const classMatch = line.match(/class\s+(\w+)/i);
		if (classMatch) {
			classNames.add(classMatch[1]);
		}

		// Extract variable patterns based on language
		if (language === 'php') {
			const variableMatch = line.match(/\$(\w+)/g);
			if (variableMatch) {
				for (const v of variableMatch) variablePatterns.add(v);
			}
		}
	}

	// Generate patterns from discovered elements
	for (const name of functionNames) {
		patterns.push({
			regex: new RegExp(`\\b${name}\\s*\\(`, 'i'),
			reason: `Call to function '${name}'`,
			confidence: 0.75,
		});
	}

	for (const name of classNames) {
		patterns.push({
			regex: new RegExp(`\\b${name}\\b`, 'i'),
			reason: `Reference to class '${name}'`,
			confidence: 0.7,
		});
	}

	return patterns;
}

/**
 * Finds the nearest line with significant code content
 */
function findNearestSignificantCode(lines, originalIndex, searchRange) {
	const start = Math.max(0, originalIndex - searchRange),
		end = Math.min(lines.length - 1, originalIndex + searchRange);

	// Search backwards first (more likely to find the relevant code)
	for (let index = originalIndex - 1; index >= start; index--) {
		if (isSignificantCode(lines[index])) {
			return {
				lineIndex: index,
				reason: 'Found significant code above',
				confidence: 0.7,
			};
		}
	}

	// Then search forwards
	for (let index = originalIndex + 1; index <= end; index++) {
		if (isSignificantCode(lines[index])) {
			return {
				lineIndex: index,
				reason: 'Found significant code below',
				confidence: 0.6,
			};
		}
	}

	return null;
}

/**
 * Finds relevant code blocks (function declarations, class methods, etc.)
 */
function findRelevantCodeBlock(lines, originalIndex, searchRange) {
	const start = Math.max(0, originalIndex - searchRange),
		end = Math.min(lines.length - 1, originalIndex + searchRange),

		blockPatterns = [
		// Function/method declarations
			/^\s*(public|private|protected|function|def)\s+\w+/i,
			// Class declarations
			/^\s*(class|interface|trait)\s+\w+/i,
			// Important statements
			/^\s*(if|for|while|switch|try|catch)\s*\(/i,
			// Variable assignments with significance
			/^\s*\$\w+\s*=.*[;}]\s*$/,
		];

	for (let index = start; index <= end; index++) {
		const line = lines[index];
		if (!line) continue;

		for (const pattern of blockPatterns) {
			if (pattern.test(line)) {
				return {
					lineIndex: index,
					reason: 'Found relevant code block',
					confidence: 0.75,
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
	let start = Math.max(0, targetIndex - contextLines),
		end = Math.min(lines.length - 1, targetIndex + contextLines);

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
	for (let index = start; index >= Math.max(0, targetIndex - 10); index--) {
		const line = lines[index];
		if (line && /^\s*(public|private|protected|function|def)\s+\w+/i.test(line)) {
			return index;
		}
	}

	// Look for complete statement start
	for (let index = start; index >= Math.max(0, targetIndex - 5); index--) {
		const line = lines[index];
		if (line && line.trim() && !line.trim().startsWith('*') && !line.trim().startsWith('//') && /^\s*\$\w+|^\s*(if|for|while|switch|try)\s*\(/i.test(line)) {
			return index;
		}
	}

	return start;
}

/**
 * Expands context forward to include complete statements/blocks
 */
function expandContextForward(lines, end, targetIndex) {
	// Look for end of current block/function
	let braceLevel = 0,
		foundOpenBrace = false;

	for (let index = targetIndex; index <= Math.min(lines.length - 1, targetIndex + 10); index++) {
		const line = lines[index];
		if (!line) continue;

		// Count braces to find block end
		for (const char of line) {
			if (char === '{') {
				braceLevel++;
				foundOpenBrace = true;
			} else if (char === '}') {
				braceLevel--;
				if (foundOpenBrace && braceLevel <= 0) {
					return Math.min(end + 2, index + 1); // Include closing brace + 1 line
				}
			}
		}

		// Look for natural statement endings
		if (line.trim().endsWith(';') || line.trim().endsWith('}')) {
			return Math.max(end, index);
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
