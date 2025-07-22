/**
 * Extracts code snippets from file content for HTML reports
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

	// Check if the target line is empty and try to find a better match nearby
	let adjustedLineNumber = lineNumber;
	if (!lines[targetLineIndex] || lines[targetLineIndex].trim() === '') {
		const betterMatch = findBestLineMatch(lines, targetLineIndex, 3);
		if (betterMatch !== null) {
			targetLineIndex = betterMatch;
			adjustedLineNumber = betterMatch + 1;
		}
	}

	// Calculate snippet bounds
	const startLine = Math.max(0, targetLineIndex - contextLines),
		endLine = Math.min(lines.length - 1, targetLineIndex + contextLines),

		// Extract the snippet
		snippetLines = [];
	for (let index = startLine; index <= endLine; index++) {
		snippetLines.push({
			lineNumber: index + 1,
			content: lines[index] || '',
			isTarget: index === targetLineIndex,
		});
	}

	return {
		startLine: startLine + 1,
		endLine: endLine + 1,
		targetLine: adjustedLineNumber,
		originalTargetLine: lineNumber,
		adjusted: adjustedLineNumber !== lineNumber,
		lines: snippetLines,
	};
}

function findBestLineMatch(lines, originalIndex, searchRange) {
	// Look for non-empty lines near the original position
	const start = Math.max(0, originalIndex - searchRange);
	const end = Math.min(lines.length - 1, originalIndex + searchRange);
	
	// First, search backwards for a non-empty line
	for (let i = originalIndex; i >= start; i--) {
		if (lines[i] && lines[i].trim()) {
			return i;
		}
	}
	
	// Then search forwards for a non-empty line
	for (let i = originalIndex + 1; i <= end; i++) {
		if (lines[i] && lines[i].trim()) {
			return i;
		}
	}
	
	// If no non-empty line found, return original
	return originalIndex;
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
			// Clean up the content (remove leading/trailing whitespace and empty lines)
			const cleanContent = fileContent.trim();
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
